-- Deletar mensagens do WhatsApp associadas ao número
DELETE FROM public.whatsapp_messages WHERE phone LIKE '%11957783553%';

-- Deletar leads associados ao número
DELETE FROM public.leads WHERE client_phone LIKE '%11957783553%';

-- Deletar clientes associados ao número
DELETE FROM public.clients WHERE phone LIKE '%11957783553%';