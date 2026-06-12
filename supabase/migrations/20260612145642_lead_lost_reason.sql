-- Ganho/perda no funil:
-- - novo estado 'perdido' no enum de estágios
-- - coluna lost_reason para o motivo da perda
-- - closed_at para marcar quando o lead foi encerrado (ganho ou perdido)
-- Observação: ALTER TYPE ... ADD VALUE precisa estar isolado e o valor novo
-- não pode ser usado na mesma transação, por isso fica sozinho nesta migration.

ALTER TYPE public.kanban_stage ADD VALUE IF NOT EXISTS 'perdido';

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS closed_at timestamptz;
