-- Código da empresa no Autcom/ERP por loja.
-- Usado para buscar o PDF do orçamento por loja (o número do orçamento é único por loja).
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS erp_company_code text;
