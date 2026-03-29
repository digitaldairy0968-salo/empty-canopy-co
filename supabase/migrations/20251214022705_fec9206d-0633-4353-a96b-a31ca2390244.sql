-- Fix: Update activation_codes RLS policy to allow dairy owners to update codes they use
-- First drop existing user validate policy and recreate with UPDATE permission

DROP POLICY IF EXISTS "Users can validate codes" ON public.activation_codes;

-- Allow authenticated users to select unused codes
CREATE POLICY "Authenticated users can view unused codes"
ON public.activation_codes
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_used = false);

-- Allow dairy owners to update activation codes (mark as used)
CREATE POLICY "Dairy owners can use activation codes"
ON public.activation_codes
FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND
  is_used = false AND
  EXISTS (SELECT 1 FROM public.dairies WHERE owner_id = auth.uid())
)
WITH CHECK (
  auth.uid() IS NOT NULL AND
  EXISTS (SELECT 1 FROM public.dairies WHERE owner_id = auth.uid())
);