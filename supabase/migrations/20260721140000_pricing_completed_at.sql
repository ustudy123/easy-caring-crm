-- Momento em que a solicitação foi para "Concluídos".
--
-- Usado para ocultar da tela os concluídos com mais de 3 dias (eles permanecem
-- no banco; só somem da visão, e admin/gerente podem reexibir). Diferente de
-- responded_at, que marca quando a resposta foi salva — o card pode ir para
-- concluído sem uma resposta anexada, ou ser respondido antes de concluir.

ALTER TABLE public.pricing_support_requests
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.pricing_support_requests.completed_at IS
  'Quando o status virou concluido. Base para ocultar concluidos antigos (>3 dias) da tela.';

-- Preenche os já concluídos que ainda não têm o marco, usando o melhor sinal
-- disponível (responded_at, senão created_at), para não sumirem/aparecerem
-- de forma inconsistente logo após a migração.
UPDATE public.pricing_support_requests
SET completed_at = COALESCE(responded_at, created_at)
WHERE status = 'concluido' AND completed_at IS NULL;
