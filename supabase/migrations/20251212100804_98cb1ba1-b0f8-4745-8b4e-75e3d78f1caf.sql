-- Create a safer policy for suppliers to view their dairy
CREATE POLICY "Suppliers can view their dairy" ON public.dairies
FOR SELECT
USING (id = public.get_user_dairy_id(auth.uid()));