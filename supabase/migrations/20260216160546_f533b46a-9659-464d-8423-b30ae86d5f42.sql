
-- Allow suppliers to update their own milk entries (needed for edit request approval)
CREATE POLICY "Suppliers can update own entries"
ON public.milk_entries
FOR UPDATE
USING (supplier_id IN (
  SELECT suppliers.id FROM suppliers WHERE suppliers.user_id = auth.uid()
));
