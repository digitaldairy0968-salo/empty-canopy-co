
-- Create subscription_settings table (Admin controls)
CREATE TABLE public.subscription_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_price numeric NOT NULL DEFAULT 100,
  upi_id text NOT NULL DEFAULT '',
  qr_code_url text,
  admin_phone text NOT NULL DEFAULT '',
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_settings ENABLE ROW LEVEL SECURITY;

-- Admin can manage, all authenticated can read
CREATE POLICY "Anyone can view subscription settings"
ON public.subscription_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin can manage subscription settings"
ON public.subscription_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default settings row
INSERT INTO public.subscription_settings (monthly_price, upi_id, admin_phone)
VALUES (100, '', '');

-- Create activation_codes table
CREATE TABLE public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE SET NULL,
  validity_days integer NOT NULL DEFAULT 30,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

-- Admin can manage all codes
CREATE POLICY "Admin can manage activation codes"
ON public.activation_codes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view unused codes to validate (but not see all)
CREATE POLICY "Users can validate codes"
ON public.activation_codes FOR SELECT
TO authenticated
USING (is_used = false);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'expired', 'pending')),
  started_at timestamp with time zone,
  expires_at timestamp with time zone,
  activation_code_id uuid REFERENCES public.activation_codes(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Admin can manage all subscriptions
CREATE POLICY "Admin can manage subscriptions"
ON public.subscriptions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Owners can view and update their own subscription
CREATE POLICY "Owners can view own subscription"
ON public.subscriptions FOR SELECT
TO authenticated
USING (dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can update own subscription"
ON public.subscriptions FOR UPDATE
TO authenticated
USING (dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid()));

-- Owners can insert their subscription when activating
CREATE POLICY "Owners can insert own subscription"
ON public.subscriptions FOR INSERT
TO authenticated
WITH CHECK (dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid()));

-- Create storage bucket for QR codes
INSERT INTO storage.buckets (id, name, public) VALUES ('qr-codes', 'qr-codes', true);

-- Storage policies for QR codes
CREATE POLICY "Anyone can view QR codes"
ON storage.objects FOR SELECT
USING (bucket_id = 'qr-codes');

CREATE POLICY "Admin can upload QR codes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'qr-codes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update QR codes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'qr-codes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete QR codes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'qr-codes' AND public.has_role(auth.uid(), 'admin'));
