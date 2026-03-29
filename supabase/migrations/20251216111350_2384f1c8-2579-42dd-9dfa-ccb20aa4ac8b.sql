-- Allow admin to view all dairies
CREATE POLICY "Admin can view all dairies" 
ON public.dairies 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to view all suppliers
CREATE POLICY "Admin can view all suppliers" 
ON public.suppliers 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to view all subscriptions (if not already covered)
DROP POLICY IF EXISTS "Admin can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admin can manage subscriptions" 
ON public.subscriptions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));