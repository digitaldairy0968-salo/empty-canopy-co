-- Add calculation method setting to rate_settings table
-- Options: 'avg_fat' (calculate using average FAT) or 'daily_total' (add up daily totals)
ALTER TABLE public.rate_settings 
ADD COLUMN calculation_method text NOT NULL DEFAULT 'avg_fat';

-- Add comment for documentation
COMMENT ON COLUMN public.rate_settings.calculation_method IS 'Method for bhugtan calculation: avg_fat = use average FAT for date range, daily_total = sum of daily calculated amounts';