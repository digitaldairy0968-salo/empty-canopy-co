-- Drop the restrictive UPDATE policy on activation_codes
DROP POLICY IF EXISTS "Dairy owners can use activation codes" ON public.activation_codes;

-- Create a new permissive policy that allows dairy owners to mark codes as used
CREATE POLICY "Dairy owners can use activation codes" 
ON public.activation_codes 
FOR UPDATE 
USING (
  (auth.uid() IS NOT NULL) 
  AND (is_used = false)
  AND (EXISTS (SELECT 1 FROM dairies WHERE dairies.owner_id = auth.uid()))
)
WITH CHECK (
  (auth.uid() IS NOT NULL)
  AND (EXISTS (SELECT 1 FROM dairies WHERE dairies.owner_id = auth.uid()))
);