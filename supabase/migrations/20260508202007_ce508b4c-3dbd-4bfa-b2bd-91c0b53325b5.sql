
-- 1. Fix get_user_seller_id: remove profiles.id fallback
CREATE OR REPLACE FUNCTION public.get_user_seller_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id FROM public.sellers s WHERE s.user_id = _user_id LIMIT 1
$$;

-- 2. Prevent role self-escalation on profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_change ON public.profiles;
CREATE TRIGGER profiles_prevent_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

-- Replace notifications policies that rely on profiles.role with has_role()
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (
  auth.uid() = user_id
  OR (role_target = 'admin' AND public.has_role(auth.uid(), 'admin'::app_role))
  OR (role_target = 'manager' AND (public.has_role(auth.uid(), 'gerente'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)))
);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Scope whatsapp_messages SELECT to store
DROP POLICY IF EXISTS "Users with roles can read whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Users with roles can read whatsapp_messages"
ON public.whatsapp_messages FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.phone = whatsapp_messages.phone
      AND c.store_id = public.get_user_store_id(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.sellers s ON s.id = c.assigned_seller_id
    WHERE c.phone = whatsapp_messages.phone AND s.user_id = auth.uid()
  )
);

-- 4. Remove IS NULL escape hatch on interactions SELECT
DROP POLICY IF EXISTS "Users with roles can read interactions" ON public.interactions;
CREATE POLICY "Users with roles can read interactions"
ON public.interactions FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.get_user_store_id(auth.uid()) IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.clients c WHERE c.id = interactions.client_id AND c.store_id = public.get_user_store_id(auth.uid()))
      OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = interactions.lead_id AND l.store_id = public.get_user_store_id(auth.uid()))
    )
  )
);
