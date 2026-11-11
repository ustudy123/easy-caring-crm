-- Tempos de alerta de atendimento configuráveis pelo gestor (reunião de 28/10).
-- Antes eram fixos para todos: 30 min (vendedor), 1 h (gerente) e 1h30 (gestão).
-- Uma linha por escopo, e vale o mais específico:
--   vendedor (seller_id)  >  loja (store_id)  >  padrão geral (os dois nulos).
-- Usado pelo Kanban/popup de urgência (src/lib/alertTimes.ts) e pela função
-- service-alerts (notificações de cliente sem resposta).
CREATE TABLE IF NOT EXISTS public.alert_time_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE,
  seller_minutes integer NOT NULL,
  manager_minutes integer NOT NULL,
  admin_minutes integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT alert_time_settings_one_scope CHECK (store_id IS NULL OR seller_id IS NULL),
  CONSTRAINT alert_time_settings_order CHECK (
    seller_minutes > 0 AND manager_minutes > seller_minutes AND admin_minutes > manager_minutes
    AND admin_minutes <= 10080
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS alert_time_settings_global_key
  ON public.alert_time_settings ((true)) WHERE store_id IS NULL AND seller_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS alert_time_settings_store_key
  ON public.alert_time_settings (store_id) WHERE store_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS alert_time_settings_seller_key
  ON public.alert_time_settings (seller_id) WHERE seller_id IS NOT NULL;

-- Padrão geral = os tempos que valiam até aqui.
INSERT INTO public.alert_time_settings (seller_minutes, manager_minutes, admin_minutes)
SELECT 30, 60, 90
WHERE NOT EXISTS (
  SELECT 1 FROM public.alert_time_settings WHERE store_id IS NULL AND seller_id IS NULL
);

ALTER TABLE public.alert_time_settings ENABLE ROW LEVEL SECURITY;

-- Todos os logados leem (o Kanban de cada um precisa dos tempos); só admin altera.
DROP POLICY IF EXISTS "Authenticated read alert times" ON public.alert_time_settings;
CREATE POLICY "Authenticated read alert times" ON public.alert_time_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage alert times" ON public.alert_time_settings;
CREATE POLICY "Admins manage alert times" ON public.alert_time_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Mudanças refletem na hora nas telas abertas.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_time_settings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
