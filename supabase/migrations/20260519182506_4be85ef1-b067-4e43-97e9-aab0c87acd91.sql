
DO $$
DECLARE
  v_phone_pattern text := '%64768245%';
  v_client_ids uuid[];
  v_lead_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_client_ids FROM public.clients WHERE phone LIKE v_phone_pattern;
  SELECT array_agg(id) INTO v_lead_ids FROM public.leads WHERE client_phone LIKE v_phone_pattern;

  IF v_client_ids IS NOT NULL THEN
    DELETE FROM public.interactions WHERE client_id = ANY(v_client_ids);
    DELETE FROM public.redirection_history WHERE client_id = ANY(v_client_ids);
    DELETE FROM public.lead_redirections WHERE client_id = ANY(v_client_ids);
    DELETE FROM public.service_transfers WHERE client_id = ANY(v_client_ids);
  END IF;

  IF v_lead_ids IS NOT NULL THEN
    DELETE FROM public.interactions WHERE lead_id = ANY(v_lead_ids);
    DELETE FROM public.sla_alerts WHERE lead_id = ANY(v_lead_ids);
    DELETE FROM public.pricing_support_requests WHERE lead_id = ANY(v_lead_ids);
    DELETE FROM public.follow_ups WHERE lead_id = ANY(v_lead_ids);
  END IF;

  DELETE FROM public.follow_ups WHERE client_phone LIKE v_phone_pattern;
  DELETE FROM public.whatsapp_messages WHERE phone LIKE v_phone_pattern;
  DELETE FROM public.leads WHERE client_phone LIKE v_phone_pattern;
  DELETE FROM public.clients WHERE phone LIKE v_phone_pattern;
END $$;
