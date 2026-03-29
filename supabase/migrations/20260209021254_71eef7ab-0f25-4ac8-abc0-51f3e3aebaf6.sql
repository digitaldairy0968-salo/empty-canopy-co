-- Add new settings columns to owner_settings table
ALTER TABLE public.owner_settings 
ADD COLUMN IF NOT EXISTS show_rakam_to_customers boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS bhugtan_output_type text DEFAULT 'print' CHECK (bhugtan_output_type IN ('print', 'pdf', 'nothing'));