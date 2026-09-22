-- Soft delete: coluna hidden_at (nula = visível). O app filtra hidden_at IS NULL
-- na leitura, então o registro some das telas mas continua no banco (recuperável
-- com hidden_at = NULL). Não é destrutivo.
ALTER TABLE public.leads             ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE public.clients           ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
