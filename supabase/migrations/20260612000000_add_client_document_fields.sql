-- Campos estruturados vindos do ERP Citel para preencher formulários
-- (antes o CPF/CNPJ só ficava nas notas, em texto).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS zip_code text;

COMMENT ON COLUMN public.clients.cpf_cnpj IS 'CPF/CNPJ do cliente (preenchido automaticamente via ERP Citel quando identificado)';
COMMENT ON COLUMN public.clients.zip_code IS 'CEP do cliente (preenchido automaticamente via ERP Citel quando identificado)';
