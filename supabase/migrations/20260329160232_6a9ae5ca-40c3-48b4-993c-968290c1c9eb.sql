CREATE OR REPLACE FUNCTION public.link_supplier_to_dairy_by_code(_dairy_code text)
RETURNS TABLE(linked boolean, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_phone text;
  v_user_phone_10 text;
  v_dairy_id uuid;
  v_supplier_id uuid;
  v_supplier_user_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'not_authenticated';
    RETURN;
  END IF;

  IF NOT public.has_role(v_user_id, 'supplier'::public.app_role) THEN
    RETURN QUERY SELECT false, 'not_supplier';
    RETURN;
  END IF;

  IF _dairy_code IS NULL OR _dairy_code !~ '^\d{12}$' THEN
    RETURN QUERY SELECT false, 'invalid_code';
    RETURN;
  END IF;

  SELECT p.phone
  INTO v_profile_phone
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  v_user_phone_10 := RIGHT(regexp_replace(COALESCE(v_profile_phone, ''), '\D', '', 'g'), 10);

  IF length(v_user_phone_10) <> 10 THEN
    RETURN QUERY SELECT false, 'phone_missing';
    RETURN;
  END IF;

  SELECT d.id
  INTO v_dairy_id
  FROM public.dairies d
  WHERE d.code = _dairy_code
  LIMIT 1;

  IF v_dairy_id IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_code';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.suppliers s
    WHERE s.dairy_id = v_dairy_id
      AND s.user_id = v_user_id
  ) THEN
    RETURN QUERY SELECT true, NULL::text;
    RETURN;
  END IF;

  SELECT s.id, s.user_id
  INTO v_supplier_id, v_supplier_user_id
  FROM public.suppliers s
  WHERE s.dairy_id = v_dairy_id
    AND RIGHT(regexp_replace(COALESCE(s.phone, ''), '\D', '', 'g'), 10) = v_user_phone_10
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_supplier_id IS NULL THEN
    RETURN QUERY SELECT false, 'phone_not_found';
    RETURN;
  END IF;

  IF v_supplier_user_id IS NOT NULL AND v_supplier_user_id <> v_user_id THEN
    RETURN QUERY SELECT false, 'already_linked_other';
    RETURN;
  END IF;

  UPDATE public.suppliers
  SET user_id = v_user_id,
      updated_at = now()
  WHERE id = v_supplier_id;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.link_supplier_to_dairy_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_supplier_to_dairy_by_code(text) TO authenticated;