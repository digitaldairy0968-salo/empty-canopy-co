-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('owner', 'supplier');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create dairies table
CREATE TABLE public.dairies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.dairies ENABLE ROW LEVEL SECURITY;

-- Create suppliers table (for pre-added suppliers by owner)
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id UUID REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  village_name TEXT,
  animal_type TEXT DEFAULT 'cow',
  address TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dairy_id, phone)
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create milk_entries table
CREATE TABLE public.milk_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  dairy_id UUID REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  time_of_day TEXT NOT NULL CHECK (time_of_day IN ('morning', 'evening')),
  quantity NUMERIC,
  fat NUMERIC,
  snf NUMERIC,
  lr NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(supplier_id, date, time_of_day)
);

ALTER TABLE public.milk_entries ENABLE ROW LEVEL SECURITY;

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id UUID REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Create rate_settings table
CREATE TABLE public.rate_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id UUID REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  rate_type TEXT NOT NULL DEFAULT 'per_liter',
  rate_value NUMERIC NOT NULL DEFAULT 50,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.rate_settings ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's dairy_id
CREATE OR REPLACE FUNCTION public.get_user_dairy_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.dairies WHERE owner_id = _user_id LIMIT 1),
    (SELECT dairy_id FROM public.suppliers WHERE user_id = _user_id LIMIT 1)
  )
$$;

-- RLS Policies

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- User roles: Users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roles" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Dairies: Owners can manage their dairy, suppliers can view their dairy
CREATE POLICY "Owners can manage their dairy" ON public.dairies
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Suppliers can view their dairy" ON public.dairies
  FOR SELECT USING (
    id IN (SELECT dairy_id FROM public.suppliers WHERE user_id = auth.uid())
  );

-- Suppliers: Owners can manage suppliers, suppliers can view themselves
CREATE POLICY "Owners can manage suppliers" ON public.suppliers
  FOR ALL USING (
    dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid())
  );

CREATE POLICY "Suppliers can view themselves" ON public.suppliers
  FOR SELECT USING (user_id = auth.uid() OR phone IN (
    SELECT phone FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Suppliers can update their user_id" ON public.suppliers
  FOR UPDATE USING (phone IN (
    SELECT phone FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Milk entries: Owners can manage, suppliers can view their own
CREATE POLICY "Owners can manage milk entries" ON public.milk_entries
  FOR ALL USING (
    dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid())
  );

CREATE POLICY "Suppliers can view own entries" ON public.milk_entries
  FOR SELECT USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
  );

-- Announcements: Owners can manage, dairy members can view
CREATE POLICY "Owners can manage announcements" ON public.announcements
  FOR ALL USING (
    dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid())
  );

CREATE POLICY "Dairy members can view announcements" ON public.announcements
  FOR SELECT USING (
    dairy_id IN (SELECT dairy_id FROM public.suppliers WHERE user_id = auth.uid())
    OR dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid())
  );

-- Rate settings: Owners can manage, suppliers can view
CREATE POLICY "Owners can manage rate settings" ON public.rate_settings
  FOR ALL USING (
    dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid())
  );

CREATE POLICY "Suppliers can view rate settings" ON public.rate_settings
  FOR SELECT USING (
    dairy_id IN (SELECT dairy_id FROM public.suppliers WHERE user_id = auth.uid())
  );

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, phone, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', '')
  );
  
  -- Insert role if provided
  IF NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data ->> 'role')::app_role);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();