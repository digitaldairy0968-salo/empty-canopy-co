
CREATE OR REPLACE FUNCTION public.confirm_supplier_payment(_payment_id uuid, _confirmed boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.payment_history
  SET supplier_confirmed = _confirmed, confirmed_at = now()
  WHERE id = _payment_id
    AND EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.id = payment_history.supplier_id
        AND suppliers.user_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found_or_not_authorized';
  END IF;

  RETURN true;
END;
$$;
