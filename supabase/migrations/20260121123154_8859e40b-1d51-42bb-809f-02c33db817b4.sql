-- Add show_calculations setting column to rate_settings table
ALTER TABLE public.rate_settings 
ADD COLUMN IF NOT EXISTS show_calculations_to_suppliers boolean NOT NULL DEFAULT true;

-- Add liter_rate column to rate_settings table for buyers
ALTER TABLE public.rate_settings 
ADD COLUMN IF NOT EXISTS liter_rate numeric NOT NULL DEFAULT 50;