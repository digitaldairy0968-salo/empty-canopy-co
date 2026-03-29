-- Add owner settings table for storing owner preferences
CREATE TABLE IF NOT EXISTS public.owner_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dairy_id UUID NOT NULL UNIQUE REFERENCES public.dairies(id) ON DELETE CASCADE,
  uses_printer BOOLEAN DEFAULT false,
  milk_buying_basis TEXT DEFAULT 'fat' CHECK (milk_buying_basis IN ('fat', 'fat_snf')),
  calculation_system TEXT DEFAULT 'avg_fat' CHECK (calculation_system IN ('avg_fat', 'daily_total')),
  onboarding_completed BOOLEAN DEFAULT false,
  dairy_name_for_pdf TEXT,
  auto_print_enabled BOOLEAN DEFAULT false,
  bluetooth_fat_machine_connected BOOLEAN DEFAULT false,
  bluetooth_printer_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.owner_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Owners can view their own settings"
ON public.owner_settings
FOR SELECT
USING (dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can insert their own settings"
ON public.owner_settings
FOR INSERT
WITH CHECK (dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can update their own settings"
ON public.owner_settings
FOR UPDATE
USING (dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_owner_settings_updated_at
  BEFORE UPDATE ON public.owner_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();