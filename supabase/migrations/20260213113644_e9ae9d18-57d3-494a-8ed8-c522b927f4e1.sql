-- Add supplier_confirmed column to payment_history for payment confirmation
ALTER TABLE public.payment_history ADD COLUMN supplier_confirmed boolean DEFAULT NULL;
ALTER TABLE public.payment_history ADD COLUMN confirmed_at timestamp with time zone DEFAULT NULL;

-- Allow suppliers to update their own payment confirmation
CREATE POLICY "Suppliers can confirm their payments"
ON public.payment_history
FOR UPDATE
USING (supplier_id IN (
  SELECT id FROM public.suppliers WHERE user_id = auth.uid()
))
WITH CHECK (supplier_id IN (
  SELECT id FROM public.suppliers WHERE user_id = auth.uid()
));
