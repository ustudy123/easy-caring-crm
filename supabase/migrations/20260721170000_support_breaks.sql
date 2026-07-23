-- Pausa para almoço do suporte.
--
-- O tempo de almoço não deve contar como demora no atendimento: as
-- solicitações pendentes/em análise durante a pausa têm esse intervalo
-- descontado do tempo de resposta.
--
-- Uma pausa por pessoa por dia (o botão registra a saída e depois a volta).

CREATE TABLE IF NOT EXISTS public.support_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  break_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Garante uma única pausa por pessoa a cada dia.
  CONSTRAINT support_breaks_one_per_day UNIQUE (seller_id, break_date)
);

CREATE INDEX IF NOT EXISTS idx_support_breaks_seller_date
  ON public.support_breaks (seller_id, break_date);

ALTER TABLE public.support_breaks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.support_breaks TO authenticated;
GRANT ALL ON public.support_breaks TO service_role;

-- Todos os autenticados leem (o tempo de pausa entra no cálculo de SLA de
-- quem acompanha), mas cada um só registra/encerra a própria pausa.
DROP POLICY IF EXISTS "read support breaks" ON public.support_breaks;
CREATE POLICY "read support breaks"
  ON public.support_breaks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert own support break" ON public.support_breaks;
CREATE POLICY "insert own support break"
  ON public.support_breaks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "update own support break" ON public.support_breaks;
CREATE POLICY "update own support break"
  ON public.support_breaks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid()));
