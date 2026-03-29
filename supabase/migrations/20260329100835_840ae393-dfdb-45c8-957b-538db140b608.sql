
-- When supplier approves an edit request (status changes to 'approved'),
-- automatically apply the changes to the milk_entry
CREATE OR REPLACE FUNCTION public.apply_approved_edit_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb;
  v_entry_id uuid;
  v_supplier_user_id uuid;
  v_dairy_id uuid;
  v_supplier_id uuid;
BEGIN
  -- Only act when status changes to 'approved'
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    v_changes := NEW.changes;
    v_entry_id := NEW.entry_id;
    v_dairy_id := NEW.dairy_id;
    v_supplier_id := NEW.supplier_id;

    -- Apply each changed field to the milk entry
    UPDATE public.milk_entries
    SET
      quantity = COALESCE((v_changes->>'quantity')::numeric, quantity),
      fat = COALESCE((v_changes->>'fat')::numeric, fat),
      snf = COALESCE((v_changes->>'snf')::numeric, snf),
      lr = COALESCE((v_changes->>'lr')::numeric, lr),
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
$$;

DROP TRIGGER IF EXISTS on_edit_request_status_change ON public.entry_edit_requests;
CREATE TRIGGER on_edit_request_status_change
  BEFORE UPDATE ON public.entry_edit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_approved_edit_request();

-- Also: when owner creates an edit request, notify the supplier
CREATE OR REPLACE FUNCTION public.notify_supplier_on_edit_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_user_id uuid;
BEGIN
  SELECT user_id INTO v_supplier_user_id
  FROM public.suppliers WHERE id = NEW.supplier_id;

  IF v_supplier_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (dairy_id, supplier_id, user_id, type, title, message, metadata)
    VALUES (
      NEW.dairy_id, NEW.supplier_id, v_supplier_user_id,
      'edit_request',
      'एंट्री बदलाव की अनुमति चाहिए',
      'डेयरी मालिक आपकी एक एंट्री में बदलाव करना चाहता है। कृपया स्वीकार या अस्वीकार करें।',
      jsonb_build_object('entry_id', NEW.entry_id, 'changes', NEW.changes, 'reason', NEW.reason)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_edit_request_created ON public.entry_edit_requests;
CREATE TRIGGER on_edit_request_created
  AFTER INSERT ON public.entry_edit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_supplier_on_edit_request();
