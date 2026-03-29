-- Fix 1: Add explicit policy to deny anonymous access to profiles
-- The existing policy requires auth.uid() = user_id, which already blocks anonymous
-- But let's also add admin access to view all profiles (needed for AdminDashboard)
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Replace the overly permissive subscription_settings policy
-- Drop the "Anyone can view subscription settings" policy
DROP POLICY IF EXISTS "Anyone can view subscription settings" ON public.subscription_settings;

-- Create a new policy that only allows dairy owners to view subscription settings
-- (they need this to see payment info on PaymentRequired page)
CREATE POLICY "Dairy owners can view subscription settings"
ON public.subscription_settings
FOR SELECT
USING (
  -- User must be authenticated and either:
  -- 1. Be an admin
  -- 2. Be a dairy owner (have a dairy in dairies table)
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (SELECT 1 FROM public.dairies WHERE owner_id = auth.uid())
  )
);