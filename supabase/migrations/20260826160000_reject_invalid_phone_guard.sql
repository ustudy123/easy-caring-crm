-- Trava definitiva no banco: impede a criação de leads/clientes com telefone
-- inválido (não-BR), independentemente da origem (webhook, app, RPC). Resolve de
-- vez os "números estranhos" no Kanban/Conversas, sem depender de deploy do
-- webhook. Descarta o insert silenciosamente (RETURN NULL), sem erro ao chamador.

CREATE OR REPLACE FUNCTION public.is_valid_br_phone(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NOT NULL AND (
    length(regexp_replace(p, '\D', '', 'g')) IN (10, 11)
    OR (length(regexp_replace(p, '\D', '', 'g')) IN (12, 13)
        AND left(regexp_replace(p, '\D', '', 'g'), 2) = '55')
  );
$$;

CREATE OR REPLACE FUNCTION public.reject_invalid_phone_lead()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_valid_br_phone(NEW.client_phone) THEN RETURN NULL; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reject_invalid_phone_lead ON public.leads;
CREATE TRIGGER trg_reject_invalid_phone_lead
  BEFORE INSERT ON public.leads FOR EACH ROW
  EXECUTE FUNCTION public.reject_invalid_phone_lead();

CREATE OR REPLACE FUNCTION public.reject_invalid_phone_client()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_valid_br_phone(NEW.phone) THEN RETURN NULL; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reject_invalid_phone_client ON public.clients;
CREATE TRIGGER trg_reject_invalid_phone_client
  BEFORE INSERT ON public.clients FOR EACH ROW
  EXECUTE FUNCTION public.reject_invalid_phone_client();
