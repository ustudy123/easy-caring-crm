-- Registra quando alguém deu "Estou ciente" no alerta de atraso de um lead.
-- Uma vez marcado, o alerta não volta a aparecer (para vendedor, gerente e admin).
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS urgency_acknowledged_at timestamptz;
