-- Feriados por loja: dias em que a loja fica fechada.
-- message: mensagem automática enviada ao cliente nesse dia.
-- redirect_store_id: loja que assume o atendimento (opcional). Se nulo, não redireciona.
CREATE TABLE IF NOT EXISTS public.store_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  message text,
  redirect_store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_store_holidays_store_date ON public.store_holidays (store_id, holiday_date);

ALTER TABLE public.store_holidays ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_holidays TO authenticated;
GRANT ALL ON public.store_holidays TO service_role;

-- A tela é restrita a admin no app; a edge function usa service_role (ignora RLS).
DROP POLICY IF EXISTS "auth read holidays" ON public.store_holidays;
CREATE POLICY "auth read holidays" ON public.store_holidays FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth manage holidays" ON public.store_holidays;
CREATE POLICY "auth manage holidays" ON public.store_holidays FOR ALL TO authenticated USING (true) WITH CHECK (true);
