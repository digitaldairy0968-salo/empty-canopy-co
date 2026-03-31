
-- 1. Update is_admin() to use user_roles table instead of hardcoded email
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- 2. Ensure the current admin user (by email) gets the admin role in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE u.email = 'vishnugurjarsimal0968@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Remove self-insert and self-update policies on user_roles (privilege escalation)
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;

-- 4. Add admin-only insert and update policies for user_roles
CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO public
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
TO public
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Fix profiles UPDATE policy - add WITH CHECK to prevent user_id impersonation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Add SELECT policy for dairy owners on activation_codes
CREATE POLICY "Dairy owners can read own activation codes"
ON public.activation_codes FOR SELECT
TO authenticated
USING (dairy_id = get_user_dairy_id(auth.uid()));
