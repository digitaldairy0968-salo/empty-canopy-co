
-- ==========================================
-- FULL BACKEND RECONSTRUCTION FOR DAIRY APP
-- ==========================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  referral_code text UNIQUE,
  referred_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. USER ROLES TABLE
CREATE TYPE public.app_role AS ENUM ('admin', 'owner', 'supplier');

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. DAIRIES TABLE
CREATE TABLE IF NOT EXISTS public.dairies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dairies ENABLE ROW LEVEL SECURITY;

-- 4. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  code text,
  animal_type text NOT NULL DEFAULT 'cow',
  animal_name text,
  village_name text,
  address text,
  pending_balance numeric DEFAULT 0,
  can_see_calculations boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- 5. MILK ENTRIES TABLE
CREATE TABLE IF NOT EXISTS public.milk_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  time_of_day text NOT NULL CHECK (time_of_day IN ('morning', 'evening')),
  quantity numeric,
  fat numeric,
  snf numeric,
  lr numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, date, time_of_day)
);

ALTER TABLE public.milk_entries ENABLE ROW LEVEL SECURITY;

-- 6. ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 7. RATE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.rate_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  rate_type text NOT NULL DEFAULT 'per_fat',
  rate_value numeric NOT NULL DEFAULT 8,
  liter_rate numeric DEFAULT 50,
  show_calculations_to_suppliers boolean DEFAULT true,
  calculation_method text DEFAULT 'avg_fat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_settings ENABLE ROW LEVEL SECURITY;

-- 8. FAT/SNF RATE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.fat_snf_rate_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_enabled boolean DEFAULT false,
  base_fat_rate numeric DEFAULT 8,
  base_snf numeric DEFAULT 9.5,
  snf_deduction_per_point numeric DEFAULT 0.2,
  fat_min numeric DEFAULT 5.0,
  fat_max numeric DEFAULT 9.0,
  fat_step numeric DEFAULT 0.5,
  snf_min numeric DEFAULT 9.0,
  snf_max numeric DEFAULT 9.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fat_snf_rate_settings ENABLE ROW LEVEL SECURITY;

-- 9. OWNER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.owner_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  uses_printer boolean DEFAULT false,
  milk_buying_basis text DEFAULT 'fat',
  calculation_system text DEFAULT 'avg_fat',
  onboarding_completed boolean DEFAULT false,
  dairy_name_for_pdf text,
  auto_print_enabled boolean DEFAULT false,
  bluetooth_fat_machine_connected boolean DEFAULT false,
  bluetooth_printer_connected boolean DEFAULT false,
  show_rakam_to_customers boolean DEFAULT true,
  bhugtan_output_type text DEFAULT 'print',
  code_direction text DEFAULT 'forward',
  prefill_enabled boolean DEFAULT false,
  prefill_fat numeric,
  prefill_snf numeric,
  prefill_lr numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_settings ENABLE ROW LEVEL SECURITY;

-- 10. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 11. SUBSCRIPTION SETTINGS TABLE (admin config)
CREATE TABLE IF NOT EXISTS public.subscription_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_price numeric NOT NULL DEFAULT 100,
  upi_id text NOT NULL DEFAULT '',
  qr_code_url text,
  admin_phone text NOT NULL DEFAULT '',
  default_validity_days integer DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_settings ENABLE ROW LEVEL SECURITY;

-- 12. ACTIVATION CODES TABLE
CREATE TABLE IF NOT EXISTS public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  validity_days integer NOT NULL DEFAULT 30,
  is_used boolean DEFAULT false,
  used_at timestamptz,
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

-- 13. PAYMENT PLANS TABLE
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL,
  validity_days integer NOT NULL DEFAULT 30,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

-- 14. DAIRY FEATURES TABLE (admin-controlled feature flags)
CREATE TABLE IF NOT EXISTS public.dairy_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL,
  feature_key text NOT NULL,
  is_enabled boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dairy_id, feature_key)
);

ALTER TABLE public.dairy_features ENABLE ROW LEVEL SECURITY;

-- 15. SUBSCRIPTION VARIETIES TABLE
CREATE TABLE IF NOT EXISTS public.subscription_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_varieties ENABLE ROW LEVEL SECURITY;

-- 16. VARIETY PLANS TABLE
CREATE TABLE IF NOT EXISTS public.variety_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variety_id uuid REFERENCES public.subscription_varieties(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  validity_days integer NOT NULL DEFAULT 30,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.variety_plans ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SECURITY DEFINER FUNCTION FOR ROLE CHECKS
-- ==========================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is admin by email
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'vishnugurjarsimal0968@gmail.com'
  )
$$;

-- Helper: get dairy_id for owner
CREATE OR REPLACE FUNCTION public.get_user_dairy_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.dairies WHERE owner_id = _user_id LIMIT 1
$$;

-- Helper: get dairy_id for supplier
CREATE OR REPLACE FUNCTION public.get_supplier_dairy_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dairy_id FROM public.suppliers WHERE user_id = _user_id LIMIT 1
$$;

-- ==========================================
-- RPC FUNCTIONS
-- ==========================================

-- Check if dairy code exists
CREATE OR REPLACE FUNCTION public.check_dairy_code_exists(dairy_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.dairies WHERE code = dairy_code)
$$;

-- Get dairy by code
CREATE OR REPLACE FUNCTION public.get_dairy_by_code(dairy_code text)
RETURNS TABLE(id uuid, name text, code text, owner_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name, d.code, d.owner_id
  FROM public.dairies d
  WHERE d.code = dairy_code
$$;

-- Activate subscription code (atomic)
CREATE OR REPLACE FUNCTION public.activate_subscription_code(_code text, _dairy_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_record RECORD;
  v_new_expiry timestamptz;
  v_current_expiry timestamptz;
BEGIN
  -- Check authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Check dairy ownership
  IF NOT EXISTS (SELECT 1 FROM public.dairies WHERE id = _dairy_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_dairy_owner';
  END IF;

  -- Find and lock the code
  SELECT * INTO v_code_record
  FROM public.activation_codes
  WHERE code = _code AND is_used = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  -- Mark code as used
  UPDATE public.activation_codes
  SET is_used = true, used_at = now(), dairy_id = _dairy_id
  WHERE id = v_code_record.id;

  -- Get current expiry
  SELECT expires_at INTO v_current_expiry
  FROM public.subscriptions
  WHERE dairy_id = _dairy_id;

  -- Calculate new expiry (extend from current if still active, or from now)
  IF v_current_expiry IS NOT NULL AND v_current_expiry > now() THEN
    v_new_expiry := v_current_expiry + (v_code_record.validity_days || ' days')::interval;
  ELSE
    v_new_expiry := now() + (v_code_record.validity_days || ' days')::interval;
  END IF;

  -- Upsert subscription
  INSERT INTO public.subscriptions (dairy_id, status, started_at, expires_at)
  VALUES (_dairy_id, 'active', now(), v_new_expiry)
  ON CONFLICT (dairy_id)
  DO UPDATE SET status = 'active', expires_at = v_new_expiry, updated_at = now();

  RETURN true;
END;
$$;

-- Apply referral reward
CREATE OR REPLACE FUNCTION public.apply_referral_reward(_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_code text;
  v_referrer_user_id uuid;
  v_referrer_dairy_id uuid;
BEGIN
  -- Get the referral code used by this user
  SELECT referred_by INTO v_referrer_code
  FROM public.profiles
  WHERE user_id = _referred_user_id;

  IF v_referrer_code IS NULL THEN
    RETURN false;
  END IF;

  -- Find the referrer
  SELECT user_id INTO v_referrer_user_id
  FROM public.profiles
  WHERE referral_code = v_referrer_code;

  IF v_referrer_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Find referrer's dairy
  SELECT id INTO v_referrer_dairy_id
  FROM public.dairies
  WHERE owner_id = v_referrer_user_id;

  IF v_referrer_dairy_id IS NULL THEN
    RETURN false;
  END IF;

  -- Extend referrer's subscription by 30 days
  UPDATE public.subscriptions
  SET expires_at = GREATEST(expires_at, now()) + interval '30 days',
      status = 'active',
      updated_at = now()
  WHERE dairy_id = v_referrer_dairy_id;

  -- Clear the referred_by so reward isn't applied again
  UPDATE public.profiles
  SET referred_by = NULL
  WHERE user_id = _referred_user_id;

  RETURN true;
END;
$$;

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral text;
BEGIN
  -- Generate a unique referral code
  v_referral := upper(substring(md5(NEW.id::text || now()::text) from 1 for 8));

  INSERT INTO public.profiles (user_id, name, phone, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_referral,
    CASE WHEN NEW.raw_user_meta_data->>'referred_by_code' IS NOT NULL
         THEN upper(NEW.raw_user_meta_data->>'referred_by_code')
         ELSE NULL
    END
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-create role from metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_dairies_updated_at BEFORE UPDATE ON public.dairies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_milk_entries_updated_at BEFORE UPDATE ON public.milk_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_rate_settings_updated_at BEFORE UPDATE ON public.rate_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_fat_snf_rate_settings_updated_at BEFORE UPDATE ON public.fat_snf_rate_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_owner_settings_updated_at BEFORE UPDATE ON public.owner_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_subscription_settings_updated_at BEFORE UPDATE ON public.subscription_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE OR REPLACE TRIGGER update_dairy_features_updated_at BEFORE UPDATE ON public.dairy_features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- PROFILES
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));

-- USER ROLES
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own roles" ON public.user_roles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));

-- DAIRIES
CREATE POLICY "Owners can read own dairy" ON public.dairies FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners can insert dairy" ON public.dairies FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update own dairy" ON public.dairies FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete own dairy" ON public.dairies FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Admins can read all dairies" ON public.dairies FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update all dairies" ON public.dairies FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete all dairies" ON public.dairies FOR DELETE USING (public.is_admin(auth.uid()));
CREATE POLICY "Suppliers can read their dairy" ON public.dairies FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suppliers WHERE suppliers.dairy_id = dairies.id AND suppliers.user_id = auth.uid())
);

-- SUPPLIERS
CREATE POLICY "Dairy owners can manage suppliers" ON public.suppliers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = suppliers.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Suppliers can read own record" ON public.suppliers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Suppliers can update own record" ON public.suppliers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all suppliers" ON public.suppliers FOR ALL USING (public.is_admin(auth.uid()));

-- MILK ENTRIES
CREATE POLICY "Dairy owners can manage milk entries" ON public.milk_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = milk_entries.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Suppliers can read own milk entries" ON public.milk_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suppliers WHERE suppliers.id = milk_entries.supplier_id AND suppliers.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all milk entries" ON public.milk_entries FOR ALL USING (public.is_admin(auth.uid()));

-- ANNOUNCEMENTS
CREATE POLICY "Dairy owners can manage announcements" ON public.announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = announcements.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Suppliers can read dairy announcements" ON public.announcements FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suppliers s WHERE s.dairy_id = announcements.dairy_id AND s.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all announcements" ON public.announcements FOR ALL USING (public.is_admin(auth.uid()));

-- RATE SETTINGS
CREATE POLICY "Dairy owners can manage rate settings" ON public.rate_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = rate_settings.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Suppliers can read dairy rate settings" ON public.rate_settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suppliers s WHERE s.dairy_id = rate_settings.dairy_id AND s.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all rate settings" ON public.rate_settings FOR ALL USING (public.is_admin(auth.uid()));

-- FAT/SNF RATE SETTINGS
CREATE POLICY "Dairy owners can manage fat_snf settings" ON public.fat_snf_rate_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = fat_snf_rate_settings.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Suppliers can read fat_snf settings" ON public.fat_snf_rate_settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suppliers s WHERE s.dairy_id = fat_snf_rate_settings.dairy_id AND s.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all fat_snf settings" ON public.fat_snf_rate_settings FOR ALL USING (public.is_admin(auth.uid()));

-- OWNER SETTINGS
CREATE POLICY "Dairy owners can manage owner settings" ON public.owner_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = owner_settings.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Admins can manage all owner settings" ON public.owner_settings FOR ALL USING (public.is_admin(auth.uid()));

-- SUBSCRIPTIONS
CREATE POLICY "Dairy owners can read own subscription" ON public.subscriptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = subscriptions.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Dairy owners can insert subscription" ON public.subscriptions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = subscriptions.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Dairy owners can update own subscription" ON public.subscriptions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = subscriptions.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions FOR ALL USING (public.is_admin(auth.uid()));

-- SUBSCRIPTION SETTINGS (admin-only write, public read for payment page)
CREATE POLICY "Anyone can read subscription settings" ON public.subscription_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage subscription settings" ON public.subscription_settings FOR ALL USING (public.is_admin(auth.uid()));

-- ACTIVATION CODES
CREATE POLICY "Admins can manage activation codes" ON public.activation_codes FOR ALL USING (public.is_admin(auth.uid()));

-- PAYMENT PLANS (public read, admin write)
CREATE POLICY "Anyone can read payment plans" ON public.payment_plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage payment plans" ON public.payment_plans FOR ALL USING (public.is_admin(auth.uid()));

-- DAIRY FEATURES
CREATE POLICY "Dairy owners can read own features" ON public.dairy_features FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = dairy_features.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Suppliers can read dairy features" ON public.dairy_features FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suppliers s WHERE s.dairy_id = dairy_features.dairy_id AND s.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all dairy features" ON public.dairy_features FOR ALL USING (public.is_admin(auth.uid()));

-- SUBSCRIPTION VARIETIES (public read, admin write)
CREATE POLICY "Anyone can read subscription varieties" ON public.subscription_varieties FOR SELECT USING (true);
CREATE POLICY "Admins can manage subscription varieties" ON public.subscription_varieties FOR ALL USING (public.is_admin(auth.uid()));

-- VARIETY PLANS (public read, admin write)
CREATE POLICY "Anyone can read variety plans" ON public.variety_plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage variety plans" ON public.variety_plans FOR ALL USING (public.is_admin(auth.uid()));

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_dairies_owner_id ON public.dairies(owner_id);
CREATE INDEX IF NOT EXISTS idx_dairies_code ON public.dairies(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_dairy_id ON public.suppliers(dairy_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON public.suppliers(phone);
CREATE INDEX IF NOT EXISTS idx_milk_entries_supplier_id ON public.milk_entries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_milk_entries_dairy_id ON public.milk_entries(dairy_id);
CREATE INDEX IF NOT EXISTS idx_milk_entries_date ON public.milk_entries(date);
CREATE INDEX IF NOT EXISTS idx_announcements_dairy_id ON public.announcements(dairy_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_dairy_id ON public.subscriptions(dairy_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON public.activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_dairy_features_dairy_id ON public.dairy_features(dairy_id);
