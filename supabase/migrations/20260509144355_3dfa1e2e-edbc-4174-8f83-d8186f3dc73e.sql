-- Excluir mensagens de WhatsApp
DELETE FROM public.whatsapp_messages 
WHERE phone = '5511957783553';

-- Excluir leads (isso deve disparar exclusão em cascata se houver FKs configuradas, 
-- caso contrário, removemos os registros principais)
DELETE FROM public.leads 
WHERE client_phone = '5511957783553';