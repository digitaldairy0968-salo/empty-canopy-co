-- Fix QR code upload: Add storage RLS policies for qr-codes bucket
CREATE POLICY "Admins can upload QR codes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'qr-codes' AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can update QR codes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'qr-codes' AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can delete QR codes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'qr-codes' AND public.is_admin(auth.uid())
);

CREATE POLICY "Anyone can read QR codes"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'qr-codes');

-- Add auth_page_image_url to subscription_settings for admin-controllable auth page image
ALTER TABLE public.subscription_settings ADD COLUMN IF NOT EXISTS auth_page_image_url text DEFAULT NULL;

-- Create storage bucket for auth page images
INSERT INTO storage.buckets (id, name, public) VALUES ('auth-images', 'auth-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for auth-images bucket
CREATE POLICY "Admins can upload auth images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'auth-images' AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can update auth images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'auth-images' AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can delete auth images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'auth-images' AND public.is_admin(auth.uid())
);

CREATE POLICY "Anyone can read auth images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'auth-images');
