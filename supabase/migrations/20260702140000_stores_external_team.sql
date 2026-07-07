-- Marca uma "loja" como Equipe de Venda Externa: categoria que não segue o
-- fluxo padrão de atendimento (triagem/URA) e não aparece como opção de loja.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_external_team boolean NOT NULL DEFAULT false;
