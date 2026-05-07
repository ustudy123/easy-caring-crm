
-- 1. service_transfers: drop overly permissive SELECT
DROP POLICY IF EXISTS "Service transfers are viewable by everyone" ON public.service_transfers;

-- 2. service_transfers: fix manager INSERT (profiles.id -> user_id)
DROP POLICY IF EXISTS "Managers can insert service transfers" ON public.service_transfers;
CREATE POLICY "Managers can insert service transfers"
ON public.service_transfers FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gerente'::app_role));

-- 3. sla_alerts: fix profiles.id -> profiles.user_id
DROP POLICY IF EXISTS "Admins can view all SLA alerts" ON public.sla_alerts;
CREATE POLICY "Admins can view all SLA alerts"
ON public.sla_alerts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own SLA alerts" ON public.sla_alerts;
CREATE POLICY "Users can view their own SLA alerts"
ON public.sla_alerts FOR SELECT TO authenticated
USING (
  vendedor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gerente'::app_role)
);

-- 4. interactions: scope SELECT by store
DROP POLICY IF EXISTS "Users with roles can read interactions" ON public.interactions;
CREATE POLICY "Users with roles can read interactions"
ON public.interactions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = interactions.client_id
      AND (c.store_id = public.get_user_store_id(auth.uid()) OR public.get_user_store_id(auth.uid()) IS NULL)
  )
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = interactions.lead_id
      AND (l.store_id = public.get_user_store_id(auth.uid()) OR public.get_user_store_id(auth.uid()) IS NULL)
  )
);

-- 5. notifications: restrict INSERT to authenticated users with roles or service role
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gerente'::app_role)
  OR public.has_role(auth.uid(), 'vendedor'::app_role)
  OR public.has_role(auth.uid(), 'suporte'::app_role)
);

-- 6. whatsapp_messages: restrict UPDATE
DROP POLICY IF EXISTS "Users can update their own whatsapp messages status" ON public.whatsapp_messages;
CREATE POLICY "Users can update their own whatsapp messages status"
ON public.whatsapp_messages FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gerente'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.sellers s ON s.id = c.assigned_seller_id
    WHERE c.phone = whatsapp_messages.phone AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gerente'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.sellers s ON s.id = c.assigned_seller_id
    WHERE c.phone = whatsapp_messages.phone AND s.user_id = auth.uid()
  )
);

-- 7. storage.objects whatsapp_media: restrict listing to authenticated, deletion to owner/admin
DROP POLICY IF EXISTS "Qualquer um pode ver as mídias" ON storage.objects;
CREATE POLICY "Authenticated can view whatsapp_media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'whatsapp_media');

DROP POLICY IF EXISTS "Usuários autenticados podem deletar suas mídias" ON storage.objects;
CREATE POLICY "Owners or admins can delete whatsapp_media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'whatsapp_media'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- 8. Set search_path on remaining functions
ALTER FUNCTION public.assign_client_by_seller_code(text, text) SET search_path = public;
ALTER FUNCTION public.assign_client_with_redirection(text, uuid) SET search_path = public;
ALTER FUNCTION public.get_next_seller_for_distribution(uuid) SET search_path = public;
ALTER FUNCTION public.mark_seller_assigned(uuid) SET search_path = public;
ALTER FUNCTION public.admin_assign_user_role(uuid, app_role, uuid, text, text, boolean, boolean, text, uuid) SET search_path = public;
ALTER FUNCTION public.admin_list_users() SET search_path = public;

-- 9. Revoke EXECUTE on SECURITY DEFINER functions from anon/public; keep available where invoked via RLS or by authenticated callers
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_assign_user_role(uuid, app_role, uuid, text, text, boolean, boolean, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_whatsapp_client(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_seller_assigned(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
