REVOKE SELECT ON public.whatsapp_instances FROM authenticated;
REVOKE SELECT ON public.whatsapp_instances FROM anon;
GRANT SELECT (id, name, phone_number, instance_type, store_id, seller_id, provider, status, qr_code, last_connected_at, created_at, updated_at)
  ON public.whatsapp_instances TO authenticated;

CREATE POLICY "Admins can insert redirections"
  ON public.lead_redirections FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update redirections"
  ON public.lead_redirections FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete redirections"
  ON public.lead_redirections FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert redirection history"
  ON public.redirection_history FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert sla alerts"
  ON public.sla_alerts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete sla alerts"
  ON public.sla_alerts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can view whatsapp_media" ON storage.objects;
CREATE POLICY "Scoped read of whatsapp_media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp_media'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.phone = (storage.foldername(objects.name))[1]
          AND c.store_id = get_user_store_id(auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.clients c
        JOIN public.sellers s ON s.id = c.assigned_seller_id
        WHERE c.phone = (storage.foldername(objects.name))[1]
          AND s.user_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.get_next_seller_for_distribution(_store_id uuid)
 RETURNS SETOF sellers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.sellers
    WHERE 
        status = 'active'
        AND is_active = true 
        AND is_available = true
        AND (
            (_store_id IS NULL)
            OR 
            (store_id = _store_id)
        )
    ORDER BY distribution_priority DESC, last_assigned_at ASC NULLS FIRST
    LIMIT 1;
END;
$function$;

CREATE POLICY "Authenticated users can receive realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can send realtime"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (true);