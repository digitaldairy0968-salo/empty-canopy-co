-- Allow admins to delete dairies
CREATE POLICY "Admin can delete dairies"
ON public.dairies
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete suppliers when deleting dairy
CREATE POLICY "Admin can delete suppliers"
ON public.suppliers
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete milk entries when deleting dairy
CREATE POLICY "Admin can delete milk entries"
ON public.milk_entries
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete announcements when deleting dairy
CREATE POLICY "Admin can delete announcements"
ON public.announcements
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete rate settings when deleting dairy
CREATE POLICY "Admin can delete rate settings"
ON public.rate_settings
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));