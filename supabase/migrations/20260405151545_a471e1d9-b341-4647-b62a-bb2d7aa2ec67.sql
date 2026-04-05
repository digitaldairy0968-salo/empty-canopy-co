
CREATE OR REPLACE FUNCTION public.activate_demo_subscription(_dairy_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_demo_days integer;
  v_expires_at timestamptz;
BEGIN
  -- Check authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Check dairy ownership
  IF NOT EXISTS (SELECT 1 FROM public.dairies WHERE id = _dairy_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_dairy_owner';
  END IF;

  -- Check if demo was already used (subscription exists and was active before)
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE dairy_id = _dairy_id AND status = 'active' AND started_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'demo_already_used';
  END IF;

  -- Get demo days from settings
  SELECT COALESCE(ss.demo_days, 9) INTO v_demo_days
  FROM public.subscription_settings ss
  LIMIT 1;

  v_expires_at := now() + (v_demo_days || ' days')::interval;

  -- Upsert subscription
  INSERT INTO public.subscriptions (dairy_id, status, started_at, expires_at)
  VALUES (_dairy_id, 'active', now(), v_expires_at)
  ON CONFLICT (dairy_id)
  DO UPDATE SET status = 'active', started_at = now(), expires_at = v_expires_at, updated_at = now();

  -- Auto-enable advance features (except customer_code)
  INSERT INTO public.dairy_features (dairy_id, feature_key, is_enabled)
  VALUES
    (_dairy_id, 'entry_settings', true),
    (_dairy_id, 'connect_fat_machine', true)
  ON CONFLICT (dairy_id, feature_key)
  DO UPDATE SET is_enabled = true, updated_at = now();

  RETURN true;
END;
$$;
