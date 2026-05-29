DELETE FROM public.interactions WHERE client_id = '31905f80-c55d-46a2-bf39-5d20bdd13d9c';
DELETE FROM public.redirection_history WHERE client_id = '31905f80-c55d-46a2-bf39-5d20bdd13d9c';
DELETE FROM public.service_transfers WHERE client_id = '31905f80-c55d-46a2-bf39-5d20bdd13d9c';
DELETE FROM public.lead_redirections WHERE client_id = '31905f80-c55d-46a2-bf39-5d20bdd13d9c';
DELETE FROM public.whatsapp_messages WHERE phone ILIKE '%11964768245%';
DELETE FROM public.clients WHERE id = '31905f80-c55d-46a2-bf39-5d20bdd13d9c';