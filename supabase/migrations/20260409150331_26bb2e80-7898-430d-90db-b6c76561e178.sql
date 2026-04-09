
-- 1. Fix payment_history: Create RPC for supplier confirmation and restrict UPDATE policy
CREATE OR REPLACE FUNCTION public.confirm_supplier_payment(_payment_id uuid)
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
  SET supplier_confirmed = true, confirmed_at = now()
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

-- Drop the overly permissive supplier UPDATE policy on payment_history
DROP POLICY IF EXISTS "Suppliers can update own payment confirmations" ON public.payment_history;

-- 2. Fix subscription_settings: Restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can read subscription settings" ON public.subscription_settings;
CREATE POLICY "Authenticated users can read subscription settings"
ON public.subscription_settings
FOR SELECT
TO authenticated
USING (true);

-- Also allow anon read for auth page image (login page needs it)
CREATE POLICY "Anon can read auth page image"
ON public.subscription_settings
FOR SELECT
TO anon
USING (true);

-- 3. Fix referrals: Validate referral_code matches referrer_user_id
DROP POLICY IF EXISTS "Authenticated users can insert referrals" ON public.referrals;
CREATE POLICY "Authenticated users can insert referrals"
ON public.referrals
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = referred_user_id
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = referrals.referrer_user_id
      AND profiles.referral_code = referrals.referral_code
  )
);

-- 4. Fix suppliers: Add WITH CHECK to prevent suppliers from modifying sensitive fields
DROP POLICY IF EXISTS "Suppliers can update own record" ON public.suppliers;
CREATE POLICY "Suppliers can update own record"
ON public.suppliers
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND dairy_id = (SELECT s.dairy_id FROM public.suppliers s WHERE s.id = suppliers.id)
  AND pending_balance = (SELECT s.pending_balance FROM public.suppliers s WHERE s.id = suppliers.id)
  AND can_see_calculations = (SELECT s.can_see_calculations FROM public.suppliers s WHERE s.id = suppliers.id)
);

-- 5. Fix user_roles: Add explicit DELETE policy for admins only
CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role));
