-- Create function to update timestamps if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for FAT/SNF rate chart settings
CREATE TABLE public.fat_snf_rate_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dairy_id UUID NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  base_fat_rate NUMERIC NOT NULL DEFAULT 8,
  base_snf NUMERIC NOT NULL DEFAULT 9.5,
  snf_deduction_per_point NUMERIC NOT NULL DEFAULT 0.2,
  fat_min NUMERIC NOT NULL DEFAULT 5.0,
  fat_max NUMERIC NOT NULL DEFAULT 9.0,
  fat_step NUMERIC NOT NULL DEFAULT 0.5,
  snf_min NUMERIC NOT NULL DEFAULT 9.0,
  snf_max NUMERIC NOT NULL DEFAULT 9.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(dairy_id)
);

-- Enable Row Level Security
ALTER TABLE public.fat_snf_rate_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Owners can manage their FAT/SNF rate settings" 
ON public.fat_snf_rate_settings 
FOR ALL 
USING (dairy_id IN (SELECT id FROM dairies WHERE owner_id = auth.uid()))
WITH CHECK (dairy_id IN (SELECT id FROM dairies WHERE owner_id = auth.uid()));

CREATE POLICY "Suppliers can view their dairy's FAT/SNF rate settings" 
ON public.fat_snf_rate_settings 
FOR SELECT 
USING (dairy_id IN (SELECT dairy_id FROM suppliers WHERE user_id = auth.uid()));

CREATE POLICY "Admin can manage FAT/SNF rate settings" 
ON public.fat_snf_rate_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_fat_snf_rate_settings_updated_at
BEFORE UPDATE ON public.fat_snf_rate_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();