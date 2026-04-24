-- Remover a política genérica
DROP POLICY "Allow service to insert messages" ON public.whatsapp_messages;

-- Criar uma política restrita para a service_role (usada pela Edge Function)
CREATE POLICY "Allow service_role to insert messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (auth.role() = 'service_role');
