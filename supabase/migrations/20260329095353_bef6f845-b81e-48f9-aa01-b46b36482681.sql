
-- Drop and recreate to be safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON public.dairies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.dairies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.suppliers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.milk_entries;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.milk_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.rate_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rate_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.owner_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.owner_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.fat_snf_rate_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.fat_snf_rate_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.subscriptions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.dairy_features;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.dairy_features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.subscription_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscription_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Unique constraints (use IF NOT EXISTS workaround)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.owner_settings ADD CONSTRAINT owner_settings_dairy_id_unique UNIQUE (dairy_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.fat_snf_rate_settings ADD CONSTRAINT fat_snf_rate_settings_dairy_id_unique UNIQUE (dairy_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.rate_settings ADD CONSTRAINT rate_settings_dairy_id_unique UNIQUE (dairy_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_dairy_id_unique UNIQUE (dairy_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-create default settings when dairy is created
CREATE OR REPLACE FUNCTION public.auto_create_dairy_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rate_settings (dairy_id) VALUES (NEW.id) ON CONFLICT (dairy_id) DO NOTHING;
  INSERT INTO public.owner_settings (dairy_id) VALUES (NEW.id) ON CONFLICT (dairy_id) DO NOTHING;
  INSERT INTO public.fat_snf_rate_settings (dairy_id) VALUES (NEW.id) ON CONFLICT (dairy_id) DO NOTHING;
  INSERT INTO public.subscriptions (dairy_id, status) VALUES (NEW.id, 'pending') ON CONFLICT (dairy_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_dairy_created ON public.dairies;
CREATE TRIGGER on_dairy_created
  AFTER INSERT ON public.dairies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_dairy_defaults();
