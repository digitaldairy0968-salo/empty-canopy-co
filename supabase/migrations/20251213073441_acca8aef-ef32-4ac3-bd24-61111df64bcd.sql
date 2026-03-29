-- Add unique constraint on dairy_id for subscriptions table
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_dairy_id_unique UNIQUE (dairy_id);