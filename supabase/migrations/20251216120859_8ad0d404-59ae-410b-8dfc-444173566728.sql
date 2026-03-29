-- Add default_validity_days column to subscription_settings
ALTER TABLE public.subscription_settings 
ADD COLUMN IF NOT EXISTS default_validity_days integer NOT NULL DEFAULT 30;