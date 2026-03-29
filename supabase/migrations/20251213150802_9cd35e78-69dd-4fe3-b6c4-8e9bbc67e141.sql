-- Fix 1: Add policy to explicitly require authentication for profiles SELECT
-- This ensures anonymous users cannot read any profile data
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix 2: Update subscription_settings to explicitly require authentication
-- First drop the existing policy and recreate with explicit auth check
DROP POLICY IF EXISTS "Dairy owners can view subscription settings" ON public.subscription_settings;

-- Create new policy that explicitly requires authentication
CREATE POLICY "Authenticated dairy owners can view subscription settings"
ON public.subscription_settings
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (SELECT 1 FROM public.dairies WHERE owner_id = auth.uid())
  )
);