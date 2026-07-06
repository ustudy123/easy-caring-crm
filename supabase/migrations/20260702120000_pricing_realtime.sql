-- Habilita realtime na tabela de solicitações de suporte/orçamento,
-- para que mudanças de status/resposta reflitam ao vivo entre os perfis
-- de vendas e suporte (sem precisar recarregar a página).
ALTER TABLE public.pricing_support_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pricing_support_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_support_requests;
  END IF;
END $$;
