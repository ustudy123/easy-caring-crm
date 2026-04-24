-- Permitir que o webhook insira mensagens sem restrição de role de usuário (anon access para insert)
-- Nota: O webhook usa a service_role_key geralmente, mas a RLS pode estar bloqueando se não houver política para service_role ou se for interpretado como anon.
-- Na verdade, service_role ignora RLS por padrão, mas se o webhook estiver usando anon ou se a RLS for restritiva demais, pode falhar.

CREATE POLICY "Allow service to insert messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (true);

-- Garantir que anon e authenticated possam ver as mensagens se necessário, 
-- mas aqui o foco é o insert do webhook.
