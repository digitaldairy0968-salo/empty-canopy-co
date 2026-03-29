
-- Add code_direction to owner_settings (forward = code increases, reverse = code decreases)
ALTER TABLE public.owner_settings ADD COLUMN IF NOT EXISTS code_direction text DEFAULT 'forward';

-- Add default fat/snf/lr prefill settings
ALTER TABLE public.owner_settings ADD COLUMN IF NOT EXISTS prefill_enabled boolean DEFAULT false;
ALTER TABLE public.owner_settings ADD COLUMN IF NOT EXISTS prefill_fat numeric DEFAULT null;
ALTER TABLE public.owner_settings ADD COLUMN IF NOT EXISTS prefill_snf numeric DEFAULT null;
ALTER TABLE public.owner_settings ADD COLUMN IF NOT EXISTS prefill_lr numeric DEFAULT null;

-- Add date range tracking to payment_history to prevent duplicate bhugtan
ALTER TABLE public.payment_history ADD COLUMN IF NOT EXISTS date_range_start date DEFAULT null;
ALTER TABLE public.payment_history ADD COLUMN IF NOT EXISTS date_range_end date DEFAULT null;
