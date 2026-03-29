
-- Update the handle_new_user trigger to auto-assign admin role for the admin email
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, phone, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Auto-link supplier record if phone matches
  UPDATE public.suppliers
  SET user_id = NEW.id
  WHERE phone = COALESCE(NEW.raw_user_meta_data->>'phone', '')
    AND user_id IS NULL;

  -- Auto-create user role
  -- If admin email, force admin role
  IF NEW.email = 'vishnugurjarsimal0968@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'owner')::app_role
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
