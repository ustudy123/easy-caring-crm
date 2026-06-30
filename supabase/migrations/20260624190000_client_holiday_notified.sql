-- Marca em qual dia o cliente já recebeu o aviso de feriado,
-- para o webhook não repetir a mensagem automática a cada mensagem recebida.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS holiday_notified_on date;
