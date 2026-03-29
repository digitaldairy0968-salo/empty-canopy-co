-- Add admin role for the admin user
INSERT INTO public.user_roles (user_id, role)
SELECT '726fbebf-3563-4ec4-9755-31a2b6a8b247', 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = '726fbebf-3563-4ec4-9755-31a2b6a8b247' AND role = 'admin'
);

-- Add storage policy for admin to upload QR codes
CREATE POLICY "Admin can upload qr codes" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'qr-codes' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update qr codes" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'qr-codes' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can delete qr codes" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'qr-codes' AND 
  has_role(auth.uid(), 'admin'::app_role)
);