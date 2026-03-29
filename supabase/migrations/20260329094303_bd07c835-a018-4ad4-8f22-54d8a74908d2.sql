
-- PAYMENT HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_added numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  balance_after numeric DEFAULT 0,
  notes text,
  supplier_confirmed boolean,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_history_supplier_id ON public.payment_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_dairy_id ON public.payment_history(dairy_id);

-- RLS for payment_history
CREATE POLICY "Dairy owners can manage payment history" ON public.payment_history FOR ALL USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = payment_history.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Suppliers can read own payment history" ON public.payment_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suppliers WHERE suppliers.id = payment_history.supplier_id AND suppliers.user_id = auth.uid())
);
CREATE POLICY "Suppliers can update own payment confirmations" ON public.payment_history FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.suppliers WHERE suppliers.id = payment_history.supplier_id AND suppliers.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all payment history" ON public.payment_history FOR ALL USING (public.is_admin(auth.uid()));

-- ENTRY EDIT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.entry_edit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid REFERENCES public.dairies(id) ON DELETE CASCADE NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  entry_id uuid REFERENCES public.milk_entries(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entry_edit_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_entry_edit_requests_supplier_id ON public.entry_edit_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_entry_edit_requests_status ON public.entry_edit_requests(status);

-- RLS for entry_edit_requests
CREATE POLICY "Dairy owners can manage edit requests" ON public.entry_edit_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.dairies WHERE dairies.id = entry_edit_requests.dairy_id AND dairies.owner_id = auth.uid())
);
CREATE POLICY "Suppliers can read own edit requests" ON public.entry_edit_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suppliers WHERE suppliers.id = entry_edit_requests.supplier_id AND suppliers.user_id = auth.uid())
);
CREATE POLICY "Suppliers can update own edit requests" ON public.entry_edit_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.suppliers WHERE suppliers.id = entry_edit_requests.supplier_id AND suppliers.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all edit requests" ON public.entry_edit_requests FOR ALL USING (public.is_admin(auth.uid()));

-- Create QR codes storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('qr-codes', 'qr-codes', true) ON CONFLICT (id) DO NOTHING;
