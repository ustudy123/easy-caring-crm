-- Adicionar coluna is_read à tabela whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;

-- Marcar mensagens existentes como lidas para não poluir notificações novas
UPDATE public.whatsapp_messages SET is_read = true;

-- Garantir que as permissões RLS permitam atualização se necessário (geralmente sim para marcar como lida)
CREATE POLICY "Users can update their own whatsapp messages status" 
ON public.whatsapp_messages 
FOR UPDATE 
USING (true) 
WITH CHECK (true);
