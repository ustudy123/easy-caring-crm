-- Horário de funcionamento da loja (base do SLA em horário comercial, Fase 2).
--
-- Modelo simples: um horário para os dias de semana (seg-sex) e um horário
-- separado para o sábado (que costuma ser diferente). Flags dizem se abre
-- sábado e domingo. Combinado com store_holidays, permite calcular o "próximo
-- momento útil" a partir de quando uma solicitação chega.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS open_time      time,           -- abertura seg-sex (ex.: 08:00)
  ADD COLUMN IF NOT EXISTS close_time     time,           -- fechamento seg-sex (ex.: 18:00)
  ADD COLUMN IF NOT EXISTS sat_open_time  time,           -- abertura sábado
  ADD COLUMN IF NOT EXISTS sat_close_time time,           -- fechamento sábado
  ADD COLUMN IF NOT EXISTS opens_saturday boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opens_sunday   boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stores.open_time IS 'Abertura nos dias de semana (seg-sex). NULL = não configurado.';
COMMENT ON COLUMN public.stores.close_time IS 'Fechamento nos dias de semana (seg-sex).';
COMMENT ON COLUMN public.stores.sat_open_time IS 'Abertura no sábado (usado só se opens_saturday).';
COMMENT ON COLUMN public.stores.sat_close_time IS 'Fechamento no sábado.';
COMMENT ON COLUMN public.stores.opens_saturday IS 'A loja abre aos sábados.';
COMMENT ON COLUMN public.stores.opens_sunday IS 'A loja abre aos domingos (usa o horário de semana).';
