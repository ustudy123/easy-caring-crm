-- Completa a trava de telefone inválido: também barra MENSAGENS com telefone
-- não-BR (fecha a última porta — Conversas). Reusa is_valid_br_phone.
CREATE OR REPLACE FUNCTION public.reject_invalid_phone_message()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_valid_br_phone(NEW.phone) THEN RETURN NULL; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reject_invalid_phone_message ON public.whatsapp_messages;
CREATE TRIGGER trg_reject_invalid_phone_message
  BEFORE INSERT ON public.whatsapp_messages FOR EACH ROW
  EXECUTE FUNCTION public.reject_invalid_phone_message();
