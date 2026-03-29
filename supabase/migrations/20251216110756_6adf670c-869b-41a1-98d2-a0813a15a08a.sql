-- Add a secure, atomic activation flow for subscription codes
-- This avoids partial updates (code marked used but subscription not created)

CREATE OR REPLACE FUNCTION public.activate_subscription_code(
  _code text,
  _dairy_id uuid
)
RETURNS TABLE(
  status text,
  started_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.activation_codes%ROWTYPE;
  v_now timestamptz := now();
  v_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Ensure the caller owns the dairy they are activating
  IF NOT EXISTS (
    SELECT 1
    FROM public.dairies d
    WHERE d.id = _dairy_id
      AND d.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_dairy_owner';
  END IF;

  SELECT *
  INTO v_code
  FROM public.activation_codes
  WHERE code = upper(trim(_code))
    AND is_used = false
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  v_expires := v_now + (v_code.validity_days || ' days')::interval;

  -- Mark code as used
  UPDATE public.activation_codes
  SET is_used = true,
      used_at = v_now,
      dairy_id = _dairy_id
  WHERE id = v_code.id;

  -- Create or update subscription
  INSERT INTO public.subscriptions (
    dairy_id,
    status,
    started_at,
    expires_at,
    activation_code_id
  ) VALUES (
    _dairy_id,
    'active',
    v_now,
    v_expires,
    v_code.id
  )
  ON CONFLICT (dairy_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    expires_at = EXCLUDED.expires_at,
    activation_code_id = EXCLUDED.activation_code_id;

  RETURN QUERY
  SELECT 'active'::text, v_now, v_expires;
END;
$$;

-- Restrict execution to logged-in users (not anonymous)
REVOKE ALL ON FUNCTION public.activate_subscription_code(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_subscription_code(text, uuid) TO authenticated;
