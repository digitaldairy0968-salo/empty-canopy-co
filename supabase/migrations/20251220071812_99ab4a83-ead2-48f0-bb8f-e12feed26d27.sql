-- Add unique code to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS code TEXT;

-- Create a function to generate a unique supplier code
CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a 4-digit code
    new_code := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Check if code exists for this dairy
    SELECT EXISTS (
      SELECT 1 FROM public.suppliers 
      WHERE dairy_id = NEW.dairy_id AND code = new_code
    ) INTO code_exists;
    
    -- Exit loop if unique code found
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  NEW.code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate code on insert
DROP TRIGGER IF EXISTS set_supplier_code ON public.suppliers;
CREATE TRIGGER set_supplier_code
  BEFORE INSERT ON public.suppliers
  FOR EACH ROW
  WHEN (NEW.code IS NULL)
  EXECUTE FUNCTION public.generate_supplier_code();

-- Generate codes for existing suppliers that don't have one
DO $$
DECLARE
  supplier_row RECORD;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  FOR supplier_row IN SELECT id, dairy_id FROM public.suppliers WHERE code IS NULL
  LOOP
    LOOP
      new_code := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
      SELECT EXISTS (
        SELECT 1 FROM public.suppliers 
        WHERE dairy_id = supplier_row.dairy_id AND code = new_code
      ) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    
    UPDATE public.suppliers SET code = new_code WHERE id = supplier_row.id;
  END LOOP;
END $$;

-- Make code NOT NULL after populating existing records
ALTER TABLE public.suppliers ALTER COLUMN code SET NOT NULL;

-- Add unique constraint per dairy
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_dairy_code_unique ON public.suppliers(dairy_id, code);