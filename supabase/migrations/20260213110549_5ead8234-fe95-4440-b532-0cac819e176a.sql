
-- Payment Plans table for admin to create custom pricing options
CREATE TABLE public.payment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 100,
  validity_days INTEGER NOT NULL DEFAULT 30,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage payment plans"
ON public.payment_plans FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active plans"
ON public.payment_plans FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Insert default plan
INSERT INTO public.payment_plans (name, price, validity_days, description)
VALUES ('Monthly', 100, 30, 'Monthly subscription plan');

-- Entry edit requests table for permission system
CREATE TABLE public.entry_edit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dairy_id UUID NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES public.milk_entries(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  changes JSONB NOT NULL DEFAULT '{}',
  reason TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.entry_edit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can create edit requests"
ON public.entry_edit_requests FOR INSERT
WITH CHECK (dairy_id IN (SELECT id FROM dairies WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can view their dairy edit requests"
ON public.entry_edit_requests FOR SELECT
USING (dairy_id IN (SELECT id FROM dairies WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can update their dairy edit requests"
ON public.entry_edit_requests FOR UPDATE
USING (dairy_id IN (SELECT id FROM dairies WHERE owner_id = auth.uid()));

CREATE POLICY "Suppliers can view their edit requests"
ON public.entry_edit_requests FOR SELECT
USING (supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid()));

CREATE POLICY "Suppliers can respond to their edit requests"
ON public.entry_edit_requests FOR UPDATE
USING (supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid()));

-- Trigger for updated_at on payment_plans
CREATE TRIGGER update_payment_plans_updated_at
BEFORE UPDATE ON public.payment_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
