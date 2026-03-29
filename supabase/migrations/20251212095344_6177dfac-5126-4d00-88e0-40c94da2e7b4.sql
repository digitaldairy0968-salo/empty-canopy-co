-- Create a security definer function to check if user is dairy owner
-- This avoids RLS recursion issues
CREATE OR REPLACE FUNCTION public.is_dairy_owner(_user_id uuid, _dairy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dairies
    WHERE id = _dairy_id
      AND owner_id = _user_id
  )
$$;

-- Drop existing restrictive policies on dairies that cause recursion
DROP POLICY IF EXISTS "Owners can manage their dairy" ON public.dairies;
DROP POLICY IF EXISTS "Suppliers can view their dairy" ON public.dairies;

-- Recreate policies using security definer functions to avoid recursion
-- Policy for owners to manage their own dairy
CREATE POLICY "Owners can manage their dairy"
ON public.dairies
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Policy for suppliers to view their linked dairy
CREATE POLICY "Suppliers can view their dairy"
ON public.dairies
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT dairy_id FROM public.suppliers WHERE user_id = auth.uid()
  )
);

-- Policy for anyone to check if a dairy code exists (for joining)
CREATE POLICY "Anyone can check dairy by code"
ON public.dairies
FOR SELECT
TO authenticated
USING (true);