INSERT INTO public.whatsapp_messages (
  message_id, 
  phone, 
  body, 
  is_from_me, 
  timestamp, 
  raw_data
) VALUES (
  'diag-' || gen_random_uuid(), 
  '5511957783553', 
  'Diagnóstico: Banco de dados OK. Aguardando sinal da uazapi.', 
  false, 
  now(), 
  '{"event": "diagnostic", "status": "active"}'::jsonb
);