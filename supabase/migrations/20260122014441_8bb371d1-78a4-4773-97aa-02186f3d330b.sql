-- Add per-customer calculation visibility setting
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS can_see_calculations boolean NOT NULL DEFAULT true;