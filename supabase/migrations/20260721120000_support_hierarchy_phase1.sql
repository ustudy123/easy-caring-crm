-- Área de suporte por loja (Fase 1): escopo por loja, atribuição, encaminhamento
-- e hierarquia supervisor -> trainee.
--
-- Espelha a lógica gerente -> vendedores, mas para o suporte. O usuário de
-- suporte já vive em sellers (com store_id) quando tem loja, então o escopo por
-- loja reaproveita esse vínculo.

-- 1) Flag de supervisor de suporte no cadastro (sellers).
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS is_support_supervisor boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sellers.is_support_supervisor IS
  'Suporte com papel de supervisor: enxerga as solicitações de toda a loja e pode encaminhar para os trainees.';

-- 2) Atribuição e escopo na solicitação de suporte.
ALTER TABLE public.pricing_support_requests
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pricing_support_requests.assigned_to IS
  'Suporte responsável atual pela solicitação (para quem o vendedor direcionou, ou para quem o supervisor encaminhou).';
COMMENT ON COLUMN public.pricing_support_requests.store_id IS
  'Loja de origem da solicitação (loja do vendedor). Base do escopo por loja.';

CREATE INDEX IF NOT EXISTS idx_pricing_requests_assigned ON public.pricing_support_requests (assigned_to);
CREATE INDEX IF NOT EXISTS idx_pricing_requests_store ON public.pricing_support_requests (store_id);

-- 3) Histórico de encaminhamento — cada vez que a solicitação muda de
--    responsável fica registrado. Alimenta os relatórios de tempo por pessoa
--    (Fase futura de SLA) e dá rastreabilidade.
CREATE TABLE IF NOT EXISTS public.support_request_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.pricing_support_requests(id) ON DELETE CASCADE,
  from_seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  to_seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_assignments_request
  ON public.support_request_assignments (request_id, created_at);

ALTER TABLE public.support_request_assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.support_request_assignments TO authenticated;
GRANT ALL ON public.support_request_assignments TO service_role;

DROP POLICY IF EXISTS "auth read support assignments" ON public.support_request_assignments;
CREATE POLICY "auth read support assignments"
  ON public.support_request_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth insert support assignments" ON public.support_request_assignments;
CREATE POLICY "auth insert support assignments"
  ON public.support_request_assignments FOR INSERT TO authenticated WITH CHECK (true);
