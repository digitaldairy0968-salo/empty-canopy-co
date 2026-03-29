-- Drop the unique constraint on dairy_id + phone since phone can be empty for multiple suppliers
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_dairy_id_phone_key;