-- Create payment_history table for tracking customer payments
CREATE TABLE public.payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dairy_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_added NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add pending_balance column to suppliers table
ALTER TABLE public.suppliers ADD COLUMN pending_balance NUMERIC NOT NULL DEFAULT 0;

-- Enable Row Level Security
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payment_history
CREATE POLICY "Owners can manage payment history"
ON public.payment_history
FOR ALL
USING (dairy_id IN (SELECT id FROM public.dairies WHERE owner_id = auth.uid()));

CREATE POLICY "Admin can view all payment history"
ON public.payment_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Suppliers can view their own payment history"
ON public.payment_history
FOR SELECT
USING (supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid()));

-- Create index for better query performance
CREATE INDEX idx_payment_history_supplier_id ON public.payment_history(supplier_id);
CREATE INDEX idx_payment_history_dairy_id ON public.payment_history(dairy_id);
CREATE INDEX idx_payment_history_transaction_date ON public.payment_history(transaction_date DESC);