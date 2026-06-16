-- Resposta do suporte/admin/gerente nas solicitações de orçamento e negociação especial.
-- Permite anexar um novo arquivo e uma descrição como retorno ao vendedor.

ALTER TABLE public.pricing_support_requests
  ADD COLUMN IF NOT EXISTS response_notes text,
  ADD COLUMN IF NOT EXISTS response_pdf_url text,
  ADD COLUMN IF NOT EXISTS response_pdf_name text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by_name text;
