-- Reagendamento de atendimento ("Quero reagendar" no Encerrar atendimento).
--
-- Quando o vendedor reagenda, o lead sai do Kanban até a data marcada e fica
-- listado na Agenda (via follow_ups). Na data/hora agendada o card volta ao
-- Kanban automaticamente — por isso guardamos uma DATA (snoozed_until) em vez
-- de usar a flag archived, que sumiria com o lead para sempre.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- Acelera o filtro do board (leads adiados para o futuro)
CREATE INDEX IF NOT EXISTS idx_leads_snoozed_until
  ON public.leads (snoozed_until)
  WHERE snoozed_until IS NOT NULL;

COMMENT ON COLUMN public.leads.snoozed_until IS
  'Se preenchido e no futuro, o lead está reagendado: fica fora do Kanban e aparece na Agenda até essa data/hora.';
