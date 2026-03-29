
-- =============================================
-- 1. CRITICAL: Unique constraint on milk_entries for upsert to work
-- The frontend uses onConflict: 'supplier_id,date,time_of_day'
-- =============================================
DO $$ BEGIN
  ALTER TABLE public.milk_entries 
    ADD CONSTRAINT milk_entries_supplier_date_shift_unique 
    UNIQUE (supplier_id, date, time_of_day);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. payment_history: Add date_range_start and date_range_end columns
-- Used by HisaabReport to track which date range a payment covers
-- and to prevent duplicate entries for same range
-- =============================================
ALTER TABLE public.payment_history 
  ADD COLUMN IF NOT EXISTS date_range_start date,
  ADD COLUMN IF NOT EXISTS date_range_end date;

-- =============================================
-- 3. Suppliers INSERT policy for supplier self-linking
-- When supplier signs up and joinDairy links them, they need
-- to be able to update their own record (already exists)
-- But also: owners insert suppliers, which is already covered.
-- Add policy for supplier to insert their own edit requests
-- =============================================
DO $$ BEGIN
  CREATE POLICY "Suppliers can insert own edit requests"
    ON public.entry_edit_requests FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM suppliers 
      WHERE suppliers.id = entry_edit_requests.supplier_id 
      AND suppliers.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 4. Fix: notification trigger should NOT fire when owner does
-- milk entry (only when entry is changed AFTER initial creation 
-- by the owner during normal flow). Use a flag to distinguish.
-- Actually the trigger is fine - suppliers DO want to see new entries.
-- But we should avoid the double-write issue from SupplierSettings.
-- The trigger on entry_edit_requests already handles the update,
-- so SupplierSettings client code doing its own update is redundant.
-- This is a frontend fix, not a DB fix. Will handle separately.
-- =============================================

-- =============================================
-- 5. Add foreign keys that are defined in types.ts but missing in DB
-- =============================================
DO $$ BEGIN
  ALTER TABLE public.activation_codes
    ADD CONSTRAINT activation_codes_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.announcements
    ADD CONSTRAINT announcements_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.dairy_features
    ADD CONSTRAINT dairy_features_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.entry_edit_requests
    ADD CONSTRAINT entry_edit_requests_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.entry_edit_requests
    ADD CONSTRAINT entry_edit_requests_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.entry_edit_requests
    ADD CONSTRAINT entry_edit_requests_entry_id_fkey
    FOREIGN KEY (entry_id) REFERENCES public.milk_entries(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.fat_snf_rate_settings
    ADD CONSTRAINT fat_snf_rate_settings_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.milk_entries
    ADD CONSTRAINT milk_entries_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.milk_entries
    ADD CONSTRAINT milk_entries_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.owner_settings
    ADD CONSTRAINT owner_settings_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.payment_history
    ADD CONSTRAINT payment_history_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.payment_history
    ADD CONSTRAINT payment_history_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.rate_settings
    ADD CONSTRAINT rate_settings_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.suppliers
    ADD CONSTRAINT suppliers_dairy_id_fkey
    FOREIGN KEY (dairy_id) REFERENCES public.dairies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.variety_plans
    ADD CONSTRAINT variety_plans_variety_id_fkey
    FOREIGN KEY (variety_id) REFERENCES public.subscription_varieties(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
