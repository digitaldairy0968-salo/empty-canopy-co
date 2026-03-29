
-- =============================================
-- 1. NOTIFICATIONS TABLE (in-app notifications for suppliers)
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_id uuid NOT NULL REFERENCES public.dairies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_supplier_id ON public.notifications(supplier_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- Dairy owners can manage all notifications for their dairy
CREATE POLICY "Dairy owners can manage notifications"
  ON public.notifications FOR ALL
  USING (EXISTS (SELECT 1 FROM dairies WHERE dairies.id = notifications.dairy_id AND dairies.owner_id = auth.uid()));

-- Suppliers can read their own notifications
CREATE POLICY "Suppliers can read own notifications"
  ON public.notifications FOR SELECT
  USING (EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = notifications.supplier_id AND suppliers.user_id = auth.uid()));

-- Suppliers can update (mark as read) their own notifications
CREATE POLICY "Suppliers can update own notifications"
  ON public.notifications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = notifications.supplier_id AND suppliers.user_id = auth.uid()));

-- Admins can manage all
CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================
-- 2. REFERRALS TABLE (track referral usage & rewards)
-- =============================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rewarded', 'expired')),
  reward_days integer DEFAULT 30,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);

-- Users can read their own referrals (as referrer or referred)
CREATE POLICY "Users can read own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- System inserts via trigger (security definer), users can also insert
CREATE POLICY "Authenticated users can insert referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_user_id);

-- Admins can manage all
CREATE POLICY "Admins can manage all referrals"
  ON public.referrals FOR ALL
  USING (is_admin(auth.uid()));

-- =============================================
-- 3. TRIGGER: Auto-notify supplier on milk entry changes
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_supplier_on_entry_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_name text;
  v_supplier_user_id uuid;
BEGIN
  SELECT name, user_id INTO v_supplier_name, v_supplier_user_id
  FROM public.suppliers WHERE id = NEW.supplier_id;

  IF v_supplier_user_id IS NOT NULL THEN
    IF TG_OP = 'UPDATE' THEN
      INSERT INTO public.notifications (dairy_id, supplier_id, user_id, type, title, message, metadata)
      VALUES (
        NEW.dairy_id, NEW.supplier_id, v_supplier_user_id,
        'entry_updated',
        'दूध एंट्री अपडेट हुई',
        'आपकी ' || NEW.date || ' की ' || NEW.time_of_day || ' एंट्री में बदलाव किया गया है।',
        jsonb_build_object('entry_id', NEW.id, 'date', NEW.date, 'time_of_day', NEW.time_of_day)
      );
    ELSIF TG_OP = 'INSERT' THEN
      INSERT INTO public.notifications (dairy_id, supplier_id, user_id, type, title, message, metadata)
      VALUES (
        NEW.dairy_id, NEW.supplier_id, v_supplier_user_id,
        'entry_added',
        'नई दूध एंट्री',
        NEW.date || ' ' || NEW.time_of_day || ' - ' || COALESCE(NEW.quantity, 0) || ' लीटर दर्ज हुआ।',
        jsonb_build_object('entry_id', NEW.id, 'date', NEW.date, 'quantity', NEW.quantity)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_milk_entry_notify ON public.milk_entries;
CREATE TRIGGER on_milk_entry_notify
  AFTER INSERT OR UPDATE ON public.milk_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_supplier_on_entry_change();

-- =============================================
-- 4. TRIGGER: Auto-notify supplier on payment
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_supplier_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_user_id uuid;
BEGIN
  SELECT user_id INTO v_supplier_user_id
  FROM public.suppliers WHERE id = NEW.supplier_id;

  IF v_supplier_user_id IS NOT NULL THEN
    IF COALESCE(NEW.amount_paid, 0) > 0 THEN
      INSERT INTO public.notifications (dairy_id, supplier_id, user_id, type, title, message, metadata)
      VALUES (
        NEW.dairy_id, NEW.supplier_id, v_supplier_user_id,
        'payment_added',
        'भुगतान जमा हुआ',
        '₹' || NEW.amount_paid || ' भुगतान जमा किया गया है।',
        jsonb_build_object('payment_id', NEW.id, 'amount', NEW.amount_paid)
      );
    END IF;
    IF COALESCE(NEW.amount_added, 0) > 0 THEN
      INSERT INTO public.notifications (dairy_id, supplier_id, user_id, type, title, message, metadata)
      VALUES (
        NEW.dairy_id, NEW.supplier_id, v_supplier_user_id,
        'balance_added',
        'बकाया जोड़ा गया',
        '₹' || NEW.amount_added || ' बकाया जोड़ा गया है।',
        jsonb_build_object('payment_id', NEW.id, 'amount', NEW.amount_added)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_notify ON public.payment_history;
CREATE TRIGGER on_payment_notify
  AFTER INSERT ON public.payment_history
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_supplier_on_payment();

-- =============================================
-- 5. TRIGGER: Track referral in referrals table
-- =============================================
CREATE OR REPLACE FUNCTION public.track_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_user_id uuid;
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    SELECT user_id INTO v_referrer_user_id
    FROM public.profiles
    WHERE referral_code = NEW.referred_by;

    IF v_referrer_user_id IS NOT NULL THEN
      INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code)
      VALUES (v_referrer_user_id, NEW.user_id, NEW.referred_by)
      ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_track_referral ON public.profiles;
CREATE TRIGGER on_profile_track_referral
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.track_referral();
