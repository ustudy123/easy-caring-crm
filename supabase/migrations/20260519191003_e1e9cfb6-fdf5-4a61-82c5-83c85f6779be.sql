DO $$
DECLARE
  _phone_pattern text := '%964768245%';
  _client_ids uuid[];
  _lead_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO _client_ids FROM public.clients WHERE phone LIKE _phone_pattern;
  SELECT array_agg(id) INTO _lead_ids FROM public.leads WHERE client_phone LIKE _phone_pattern;

  IF _lead_ids IS NOT NULL THEN
    DELETE FROM public.sla_alerts WHERE lead_id = ANY(_lead_ids);
    DELETE FROM public.pricing_support_requests WHERE lead_id = ANY(_lead_ids);
    DELETE FROM public.follow_ups WHERE lead_id = ANY(_lead_ids);
  END IF;

  IF _client_ids IS NOT NULL THEN
    DELETE FROM public.interactions WHERE client_id = ANY(_client_ids);
    DELETE FROM public.redirection_history WHERE client_id = ANY(_client_ids);
    DELETE FROM public.lead_redirections WHERE client_id = ANY(_client_ids);
    DELETE FROM public.service_transfers WHERE client_id = ANY(_client_ids);
  END IF;

  DELETE FROM public.follow_ups WHERE client_phone LIKE _phone_pattern;
  DELETE FROM public.whatsapp_messages WHERE phone LIKE _phone_pattern;
  DELETE FROM public.leads WHERE client_phone LIKE _phone_pattern;
  DELETE FROM public.clients WHERE phone LIKE _phone_pattern;
END $$;