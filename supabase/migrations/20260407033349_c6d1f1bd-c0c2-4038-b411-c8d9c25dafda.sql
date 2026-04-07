
-- Digital coins balance table
CREATE TABLE public.digital_coins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.digital_coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read own coins" ON public.digital_coins FOR SELECT TO authenticated USING (dairy_id = get_user_dairy_id(auth.uid()));
CREATE POLICY "Admins can manage all coins" ON public.digital_coins FOR ALL USING (is_admin(auth.uid()));

CREATE TRIGGER update_digital_coins_updated_at BEFORE UPDATE ON public.digital_coins FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Coin transactions log
CREATE TABLE public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'credit',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read own transactions" ON public.coin_transactions FOR SELECT TO authenticated USING (dairy_id = get_user_dairy_id(auth.uid()));
CREATE POLICY "Admins can manage all transactions" ON public.coin_transactions FOR ALL USING (is_admin(auth.uid()));

-- Update referral reward: 100 coins instead of subscription extension
CREATE OR REPLACE FUNCTION public.apply_referral_reward(_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referrer_code text;
  v_referrer_user_id uuid;
  v_referrer_dairy_id uuid;
BEGIN
  SELECT referred_by INTO v_referrer_code FROM public.profiles WHERE user_id = _referred_user_id;
  IF v_referrer_code IS NULL THEN RETURN false; END IF;

  SELECT user_id INTO v_referrer_user_id FROM public.profiles WHERE referral_code = v_referrer_code;
  IF v_referrer_user_id IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_referrer_dairy_id FROM public.dairies WHERE owner_id = v_referrer_user_id;
  IF v_referrer_dairy_id IS NULL THEN RETURN false; END IF;

  -- Add 100 coins to referrer
  INSERT INTO public.digital_coins (dairy_id, balance)
  VALUES (v_referrer_dairy_id, 100)
  ON CONFLICT (dairy_id) DO UPDATE SET balance = digital_coins.balance + 100, updated_at = now();

  -- Log transaction
  INSERT INTO public.coin_transactions (dairy_id, amount, type, description)
  VALUES (v_referrer_dairy_id, 100, 'credit', 'Referral reward for user ' || _referred_user_id::text);

  -- Update referral status
  UPDATE public.referrals SET status = 'rewarded', rewarded_at = now() WHERE referred_user_id = _referred_user_id AND status = 'pending';

  -- Clear referred_by
  UPDATE public.profiles SET referred_by = NULL WHERE user_id = _referred_user_id;

  RETURN true;
END;
$$;

-- Purchase plan with coins RPC
CREATE OR REPLACE FUNCTION public.purchase_plan_with_coins(_dairy_id uuid, _plan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan RECORD;
  v_current_balance integer;
  v_current_expiry timestamptz;
  v_new_expiry timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dairies WHERE id = _dairy_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_dairy_owner';
  END IF;

  -- Get plan details
  SELECT * INTO v_plan FROM public.variety_plans WHERE id = _plan_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  -- Check balance
  SELECT COALESCE(balance, 0) INTO v_current_balance FROM public.digital_coins WHERE dairy_id = _dairy_id;
  IF v_current_balance IS NULL THEN v_current_balance := 0; END IF;

  IF v_current_balance < v_plan.price::integer THEN RAISE EXCEPTION 'insufficient_coins'; END IF;

  -- Deduct coins
  UPDATE public.digital_coins SET balance = balance - v_plan.price::integer, updated_at = now() WHERE dairy_id = _dairy_id;

  -- Log transaction
  INSERT INTO public.coin_transactions (dairy_id, amount, type, description)
  VALUES (_dairy_id, v_plan.price::integer, 'debit', 'Plan purchase: ' || v_plan.name);

  -- Calculate new expiry
  SELECT expires_at INTO v_current_expiry FROM public.subscriptions WHERE dairy_id = _dairy_id;
  IF v_current_expiry IS NOT NULL AND v_current_expiry > now() THEN
    v_new_expiry := v_current_expiry + (v_plan.validity_days || ' days')::interval;
  ELSE
    v_new_expiry := now() + (v_plan.validity_days || ' days')::interval;
  END IF;

  -- Upsert subscription
  INSERT INTO public.subscriptions (dairy_id, status, started_at, expires_at)
  VALUES (_dairy_id, 'active', now(), v_new_expiry)
  ON CONFLICT (dairy_id) DO UPDATE SET status = 'active', expires_at = v_new_expiry, updated_at = now();

  RETURN true;
END;
$$;
