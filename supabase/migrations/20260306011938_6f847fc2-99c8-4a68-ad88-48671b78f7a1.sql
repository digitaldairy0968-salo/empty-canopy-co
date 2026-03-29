
-- 1. Subscription Varieties (Admin-managed tiers)
CREATE TABLE public.subscription_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_varieties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage varieties" ON public.subscription_varieties
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active varieties" ON public.subscription_varieties
  FOR SELECT TO authenticated
  USING (is_active = true);

-- 2. Variety Plans (pricing per variety)
CREATE TABLE public.variety_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variety_id uuid NOT NULL REFERENCES public.subscription_varieties(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 100,
  validity_days integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.variety_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage variety plans" ON public.variety_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active variety plans" ON public.variety_plans
  FOR SELECT TO authenticated
  USING (is_active = true);

-- 3. Dairy Features (admin toggle per dairy)
CREATE TABLE public.dairy_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dairy_id, feature_key)
);

ALTER TABLE public.dairy_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage dairy features" ON public.dairy_features
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can view their dairy features" ON public.dairy_features
  FOR SELECT TO authenticated
  USING (dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid()));

CREATE POLICY "Suppliers can view their dairy features" ON public.dairy_features
  FOR SELECT TO authenticated
  USING (dairy_id IN (SELECT dairy_id FROM public.suppliers WHERE user_id = auth.uid()));

-- 4. Referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  referral_code text NOT NULL,
  reward_applied boolean NOT NULL DEFAULT false,
  reward_applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all referrals" ON public.referrals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

CREATE POLICY "Authenticated users can insert referrals" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (referred_user_id = auth.uid());

-- 5. Add referral_code and referred_by_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_code text;

-- 6. Add selected_variety_id to subscriptions (track which variety was purchased)
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS variety_id uuid REFERENCES public.subscription_varieties(id);

-- 7. Make dairies.code nullable (admin controls when code is available)
ALTER TABLE public.dairies ALTER COLUMN code DROP NOT NULL;
ALTER TABLE public.dairies ALTER COLUMN code SET DEFAULT NULL;

-- 8. Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  code text;
  code_exists boolean;
BEGIN
  LOOP
    code := 'REF' || UPPER(SUBSTR(MD5(RANDOM()::text), 1, 6));
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$$;

-- 9. Updated handle_new_user trigger with referral support
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ref_code text;
BEGIN
  -- Generate referral code for owners
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'owner') = 'owner' THEN
    ref_code := public.generate_referral_code();
  END IF;

  INSERT INTO public.profiles (user_id, phone, name, referral_code, referred_by_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    ref_code,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    referral_code = COALESCE(profiles.referral_code, EXCLUDED.referral_code),
    referred_by_code = COALESCE(profiles.referred_by_code, EXCLUDED.referred_by_code);

  -- Auto-link supplier record if phone matches
  UPDATE public.suppliers
  SET user_id = NEW.id
  WHERE phone = COALESCE(NEW.raw_user_meta_data->>'phone', '')
    AND user_id IS NULL;

  -- Auto-create user role
  IF NEW.email = 'vishnugurjarsimal0968@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'owner')::app_role
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- If referred by someone, create referral record
  IF NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), '') IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code)
    SELECT p.user_id, NEW.id, p.referral_code
    FROM public.profiles p
    WHERE p.referral_code = UPPER(TRIM(NEW.raw_user_meta_data->>'referred_by_code'))
    LIMIT 1
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 10. Function to apply referral reward when user first buys premium
CREATE OR REPLACE FUNCTION public.apply_referral_reward(_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referral public.referrals%ROWTYPE;
  v_referrer_dairy_id uuid;
BEGIN
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referred_user_id = _referred_user_id
    AND reward_applied = false
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT id INTO v_referrer_dairy_id
  FROM public.dairies
  WHERE owner_id = v_referral.referrer_user_id
  LIMIT 1;

  IF v_referrer_dairy_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.subscriptions
  SET expires_at = GREATEST(expires_at, now()) + INTERVAL '30 days',
      status = 'active'
  WHERE dairy_id = v_referrer_dairy_id;

  UPDATE public.referrals
  SET reward_applied = true,
      reward_applied_at = now()
  WHERE id = v_referral.id;

  RETURN true;
END;
$$;
