-- Drop the existing policy
DROP POLICY IF EXISTS "Dairy owners can use activation codes" ON public.activation_codes;

-- Create a new policy that allows any authenticated user to update activation codes
-- This is needed because users activate codes BEFORE they have a dairy, or right after creating one
CREATE POLICY "Authenticated users can use activation codes" 
ON public.activation_codes 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND is_used = false
)
WITH CHECK (
  auth.uid() IS NOT NULL
);