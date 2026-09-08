-- Meta mensal de perguntas do quiz por vendedor.
-- Configurada pelo admin no cadastro do usuário e usada no relatório de metas
-- (% da meta atingida no mês). Nula = sem meta. Não é destrutivo; idempotente.
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS quiz_monthly_goal integer;
