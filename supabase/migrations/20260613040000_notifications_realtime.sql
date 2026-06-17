-- Ativa o tempo real (realtime) na tabela de notificações para que novos
-- alertas (ex.: lembrete do Show das Tintas) apareçam sem precisar atualizar
-- a página, mesmo para quem já está com o CRM aberto.

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN OTHERS THEN
  -- já está na publicação; ignora
  NULL;
END $$;
