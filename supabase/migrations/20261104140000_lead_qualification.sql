-- Respostas da qualificação por etapa do funil (equipe externa), conforme o
-- documento "Qualificação de Clientes — Tintas Industriais". Um JSON por lead:
-- as perguntas mudam com o tempo e os relatórios leem as chaves direto.
-- O bloqueio de avanço de etapa é aplicado pelo app (src/lib/qualification.ts).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS qualification jsonb NOT NULL DEFAULT '{}'::jsonb;
