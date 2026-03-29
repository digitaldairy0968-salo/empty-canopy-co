-- Fix infinite recursion: dairies and suppliers policies reference each other
-- Solution: Use existing SECURITY DEFINER functions to break the cycle

-- Fix dairies: "Suppliers can read their dairy" policy
DROP POLICY IF EXISTS "Suppliers can read their dairy" ON public.dairies;
CREATE POLICY "Suppliers can read their dairy" ON public.dairies
  FOR SELECT TO authenticated
  USING (id = public.get_supplier_dairy_id(auth.uid()));

-- Fix suppliers: "Dairy owners can manage suppliers" policy  
DROP POLICY IF EXISTS "Dairy owners can manage suppliers" ON public.suppliers;
CREATE POLICY "Dairy owners can manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

-- Fix all other tables that reference dairies via subquery
-- announcements
DROP POLICY IF EXISTS "Dairy owners can manage announcements" ON public.announcements;
CREATE POLICY "Dairy owners can manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

DROP POLICY IF EXISTS "Suppliers can read dairy announcements" ON public.announcements;
CREATE POLICY "Suppliers can read dairy announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (dairy_id = public.get_supplier_dairy_id(auth.uid()));

-- dairy_features
DROP POLICY IF EXISTS "Dairy owners can read own features" ON public.dairy_features;
CREATE POLICY "Dairy owners can read own features" ON public.dairy_features
  FOR SELECT TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

DROP POLICY IF EXISTS "Suppliers can read dairy features" ON public.dairy_features;
CREATE POLICY "Suppliers can read dairy features" ON public.dairy_features
  FOR SELECT TO authenticated
  USING (dairy_id = public.get_supplier_dairy_id(auth.uid()));

-- entry_edit_requests
DROP POLICY IF EXISTS "Dairy owners can manage edit requests" ON public.entry_edit_requests;
CREATE POLICY "Dairy owners can manage edit requests" ON public.entry_edit_requests
  FOR ALL TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

-- fat_snf_rate_settings
DROP POLICY IF EXISTS "Dairy owners can manage fat_snf settings" ON public.fat_snf_rate_settings;
CREATE POLICY "Dairy owners can manage fat_snf settings" ON public.fat_snf_rate_settings
  FOR ALL TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

DROP POLICY IF EXISTS "Suppliers can read fat_snf settings" ON public.fat_snf_rate_settings;
CREATE POLICY "Suppliers can read fat_snf settings" ON public.fat_snf_rate_settings
  FOR SELECT TO authenticated
  USING (dairy_id = public.get_supplier_dairy_id(auth.uid()));

-- milk_entries
DROP POLICY IF EXISTS "Dairy owners can manage milk entries" ON public.milk_entries;
CREATE POLICY "Dairy owners can manage milk entries" ON public.milk_entries
  FOR ALL TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

-- notifications
DROP POLICY IF EXISTS "Dairy owners can manage notifications" ON public.notifications;
CREATE POLICY "Dairy owners can manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

-- owner_settings
DROP POLICY IF EXISTS "Dairy owners can manage owner settings" ON public.owner_settings;
CREATE POLICY "Dairy owners can manage owner settings" ON public.owner_settings
  FOR ALL TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

-- payment_history
DROP POLICY IF EXISTS "Dairy owners can manage payment history" ON public.payment_history;
CREATE POLICY "Dairy owners can manage payment history" ON public.payment_history
  FOR ALL TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

-- rate_settings
DROP POLICY IF EXISTS "Dairy owners can manage rate settings" ON public.rate_settings;
CREATE POLICY "Dairy owners can manage rate settings" ON public.rate_settings
  FOR ALL TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

DROP POLICY IF EXISTS "Suppliers can read dairy rate settings" ON public.rate_settings;
CREATE POLICY "Suppliers can read dairy rate settings" ON public.rate_settings
  FOR SELECT TO authenticated
  USING (dairy_id = public.get_supplier_dairy_id(auth.uid()));

-- subscriptions
DROP POLICY IF EXISTS "Dairy owners can insert subscription" ON public.subscriptions;
CREATE POLICY "Dairy owners can insert subscription" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (dairy_id = public.get_user_dairy_id(auth.uid()));

DROP POLICY IF EXISTS "Dairy owners can read own subscription" ON public.subscriptions;
CREATE POLICY "Dairy owners can read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));

DROP POLICY IF EXISTS "Dairy owners can update own subscription" ON public.subscriptions;
CREATE POLICY "Dairy owners can update own subscription" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (dairy_id = public.get_user_dairy_id(auth.uid()));