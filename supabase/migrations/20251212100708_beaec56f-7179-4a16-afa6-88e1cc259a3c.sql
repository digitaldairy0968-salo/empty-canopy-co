-- Fix infinite recursion in RLS by removing suppliers-based policy on dairies
ALTER TABLE public.dairies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers can view their dairy" ON public.dairies;