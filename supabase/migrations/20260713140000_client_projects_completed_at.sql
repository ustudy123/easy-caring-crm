-- Conclusão de projeto.
--
-- Até aqui um projeto só tinha `stage` (etapa do funil), sem nada que dissesse
-- "este projeto acabou". Agora o botão "Concluir projeto" preenche completed_at.
--
-- Uso: no Kanban só aparecem os projetos ATIVOS (completed_at IS NULL); na
-- página de Clientes Recorrentes aparecem TODOS, inclusive os concluídos.

ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Acelera o filtro de projetos ativos por cliente
CREATE INDEX IF NOT EXISTS idx_client_projects_phone_active
  ON public.client_projects (client_phone)
  WHERE completed_at IS NULL;

COMMENT ON COLUMN public.client_projects.completed_at IS
  'Preenchido quando o projeto é concluído. NULL = projeto ativo (aparece no Kanban).';
