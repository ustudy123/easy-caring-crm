-- Arquiva o card quando o cliente vira recorrente (sai do Kanban principal).
-- O histórico é preservado (1 card por compra); ao comprar de novo, cria-se
-- um card novo. Relatórios continuam enxergando os arquivados.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
