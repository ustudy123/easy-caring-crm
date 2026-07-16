-- Habilita realtime em sellers e stores.
--
-- A lista de vendedores era carregada uma única vez, quando o app abre (o
-- CrmProvider fica montado o tempo todo), então cadastrar/remover um vendedor
-- só refletia depois de um F5. Agora as telas que listam vendedores (filtro do
-- Kanban, Novo Lead, Transferir, Projetos...) atualizam ao vivo.
--
-- stores entra junto porque o filtro do admin agrupa os vendedores por loja.

ALTER TABLE public.sellers REPLICA IDENTITY FULL;
ALTER TABLE public.stores REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sellers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sellers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'stores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stores;
  END IF;
END $$;
