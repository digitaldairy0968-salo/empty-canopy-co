CREATE OR REPLACE FUNCTION public.apply_approved_edit_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_changes jsonb;
  v_entry_id uuid;
  v_supplier_user_id uuid;
  v_dairy_id uuid;
  v_supplier_id uuid;
  v_existing_shift text;
  v_quantity numeric;
  v_fat numeric;
  v_snf numeric;
  v_lr numeric;
BEGIN
  -- Only act when status changes to approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    v_changes := COALESCE(NEW.changes, '{}'::jsonb);
    v_entry_id := NEW.entry_id;
    v_dairy_id := NEW.dairy_id;
    v_supplier_id := NEW.supplier_id;

    SELECT me.time_of_day
    INTO v_existing_shift
    FROM public.milk_entries me
    WHERE me.id = v_entry_id;

    -- Map legacy + shift-specific keys to actual milk_entries columns
    v_quantity := COALESCE(
      NULLIF(v_changes->>'quantity', '')::numeric,
      CASE
        WHEN v_existing_shift = 'morning' THEN NULLIF(v_changes->>'morningMilk', '')::numeric
        WHEN v_existing_shift = 'evening' THEN NULLIF(v_changes->>'eveningMilk', '')::numeric
        ELSE COALESCE(NULLIF(v_changes->>'morningMilk', '')::numeric, NULLIF(v_changes->>'eveningMilk', '')::numeric)
      END
    );

    v_fat := COALESCE(
      NULLIF(v_changes->>'fat', '')::numeric,
      CASE
        WHEN v_existing_shift = 'morning' THEN NULLIF(v_changes->>'morningFat', '')::numeric
        WHEN v_existing_shift = 'evening' THEN NULLIF(v_changes->>'eveningFat', '')::numeric
        ELSE COALESCE(NULLIF(v_changes->>'morningFat', '')::numeric, NULLIF(v_changes->>'eveningFat', '')::numeric)
      END
    );

    v_snf := COALESCE(
      NULLIF(v_changes->>'snf', '')::numeric,
      CASE
        WHEN v_existing_shift = 'morning' THEN NULLIF(v_changes->>'morningSNF', '')::numeric
        WHEN v_existing_shift = 'evening' THEN NULLIF(v_changes->>'eveningSNF', '')::numeric
        ELSE COALESCE(NULLIF(v_changes->>'morningSNF', '')::numeric, NULLIF(v_changes->>'eveningSNF', '')::numeric)
      END
    );

    v_lr := COALESCE(
      NULLIF(v_changes->>'lr', '')::numeric,
      CASE
        WHEN v_existing_shift = 'morning' THEN NULLIF(v_changes->>'morningLR', '')::numeric
        WHEN v_existing_shift = 'evening' THEN NULLIF(v_changes->>'eveningLR', '')::numeric
        ELSE COALESCE(NULLIF(v_changes->>'morningLR', '')::numeric, NULLIF(v_changes->>'eveningLR', '')::numeric)
      END
    );

    UPDATE public.milk_entries
    SET
      quantity = COALESCE(v_quantity, quantity),
      fat = COALESCE(v_fat, fat),
      snf = COALESCE(v_snf, snf),
      lr = COALESCE(v_lr, lr),
      time_of_day = COALESCE(v_changes->>'time_of_day', time_of_day),
      date = COALESCE((v_changes->>'date')::date, date)
    WHERE id = v_entry_id;

    -- Mark responded timestamp
    NEW.responded_at := now();

    -- Notify supplier that edit was applied
    SELECT user_id INTO v_supplier_user_id
    FROM public.suppliers WHERE id = v_supplier_id;

    IF v_supplier_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (dairy_id, supplier_id, user_id, type, title, message, metadata)
      VALUES (
        v_dairy_id, v_supplier_id, v_supplier_user_id,
        'edit_approved',
        'एंट्री बदलाव स्वीकार हुआ',
        'आपने एंट्री बदलाव की अनुमति दी। एंट्री अपडेट हो गई है।',
        jsonb_build_object('entry_id', v_entry_id, 'changes', v_changes)
      );
    END IF;
  END IF;

  -- When rejected, just notify and set responded_at
  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    NEW.responded_at := now();

    SELECT user_id INTO v_supplier_user_id
    FROM public.suppliers WHERE id = NEW.supplier_id;

    IF v_supplier_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (dairy_id, supplier_id, user_id, type, title, message, metadata)
      VALUES (
        NEW.dairy_id, NEW.supplier_id, v_supplier_user_id,
        'edit_rejected',
        'एंट्री बदलाव अस्वीकार',
        'आपने एंट्री बदलाव की अनुमति नहीं दी।',
        jsonb_build_object('entry_id', NEW.entry_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;