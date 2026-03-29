-- Drop the overly permissive RLS policy
DROP POLICY IF EXISTS "Anyone can check dairy by code" ON public.dairies;

-- Create a secure RPC function to check if dairy code exists
CREATE OR REPLACE FUNCTION public.check_dairy_code_exists(dairy_code TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dairies
    WHERE code = dairy_code
  );
$$;

-- Create a secure RPC function to get dairy by code (returns only id, name, code - no owner_id)
CREATE OR REPLACE FUNCTION public.get_dairy_by_code(dairy_code TEXT)
RETURNS TABLE(id UUID, name TEXT, code TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name, d.code 
  FROM public.dairies d
  WHERE d.code = dairy_code
  LIMIT 1;
$$;