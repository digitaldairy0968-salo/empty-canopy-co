-- Add customer_limit column to dairies table (NULL = unlimited)
ALTER TABLE public.dairies 
ADD COLUMN IF NOT EXISTS customer_limit integer DEFAULT NULL;

-- Helper function: get effective supplier count (active = within limit)
CREATE OR REPLACE FUNCTION public.get_dairy_customer_limit(_dairy_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_limit FROM public.dairies WHERE id = _dairy_id
$$;

-- Helper function: check if a supplier is within the dairy's customer limit
-- Returns true if supplier is allowed (within limit OR no limit set)
CREATE OR REPLACE FUNCTION public.is_supplier_within_limit(_supplier_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dairy_id uuid;
  v_limit integer;
  v_position integer;
BEGIN
  SELECT dairy_id INTO v_dairy_id FROM public.suppliers WHERE id = _supplier_id;
  IF v_dairy_id IS NULL THEN RETURN false; END IF;

  SELECT customer_limit INTO v_limit FROM public.dairies WHERE id = v_dairy_id;
  IF v_limit IS NULL THEN RETURN true; END IF;

  -- Determine 1-based position by created_at (oldest first)
  SELECT pos INTO v_position FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS pos
    FROM public.suppliers
    WHERE dairy_id = v_dairy_id
  ) ranked WHERE id = _supplier_id;

  RETURN v_position <= v_limit;
END;
$$;

-- Trigger function: enforce customer limit on supplier insert
CREATE OR REPLACE FUNCTION public.enforce_supplier_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  SELECT customer_limit INTO v_limit FROM public.dairies WHERE id = NEW.dairy_id;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.suppliers WHERE dairy_id = NEW.dairy_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'customer_limit_reached' USING HINT = 'Dairy customer limit reached. Contact admin to increase.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_supplier_limit ON public.suppliers;
CREATE TRIGGER trg_enforce_supplier_limit
BEFORE INSERT ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_supplier_limit();

-- Trigger function: block milk entries for suppliers beyond limit
CREATE OR REPLACE FUNCTION public.enforce_milk_entry_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_supplier_within_limit(NEW.supplier_id) THEN
    RAISE EXCEPTION 'supplier_beyond_limit' USING HINT = 'This supplier is beyond the dairy customer limit. Contact admin.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_milk_entry_limit ON public.milk_entries;
CREATE TRIGGER trg_enforce_milk_entry_limit
BEFORE INSERT OR UPDATE ON public.milk_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_milk_entry_limit();