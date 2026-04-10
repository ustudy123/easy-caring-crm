-- Create new enum type
CREATE TYPE public.kanban_stage_new AS ENUM (
  'abordagem',
  'sondagem',
  'recomendacao_tecnica',
  'demonstracao_valor',
  'contorno_objecoes',
  'cross_sell',
  'fechamento',
  'pos_venda'
);

-- Migrate leads data to use new stage values
ALTER TABLE public.leads
  ALTER COLUMN stage DROP DEFAULT;

ALTER TABLE public.leads
  ALTER COLUMN stage TYPE kanban_stage_new
  USING CASE stage::text
    WHEN 'novo_lead' THEN 'abordagem'::kanban_stage_new
    WHEN 'em_atendimento' THEN 'sondagem'::kanban_stage_new
    WHEN 'precificacao_especial' THEN 'recomendacao_tecnica'::kanban_stage_new
    WHEN 'orcamento_enviado' THEN 'demonstracao_valor'::kanban_stage_new
    WHEN 'negociacao' THEN 'contorno_objecoes'::kanban_stage_new
    WHEN 'fechado' THEN 'fechamento'::kanban_stage_new
    ELSE 'abordagem'::kanban_stage_new
  END;

ALTER TABLE public.leads
  ALTER COLUMN stage SET DEFAULT 'abordagem'::kanban_stage_new;

-- Drop old enum and rename new one
DROP TYPE public.kanban_stage;
ALTER TYPE public.kanban_stage_new RENAME TO kanban_stage;