-- Unificação do nome do cliente: quando um lead recebe um nome REAL (não o
-- placeholder "Cliente <telefone>" que o webhook cria), esse nome é propagado
-- para o cadastro em `clients`, casando por dígitos do telefone (sem o DDI 55).
--
-- Regras:
--   - Só propaga nome REAL (ignora placeholders / só-dígitos).
--   - Só preenche quando o cliente ainda está com placeholder — NÃO sobrescreve
--     um nome real já existente (ex.: vindo do ERP).
-- Com isso o cadastro fica coerente em todas as telas (Conversas, Recorrentes,
-- Clientes) sem depender de merge no front.

CREATE OR REPLACE FUNCTION public.propagate_lead_name_to_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
BEGIN
  -- Ignora nome vazio ou placeholder ("Cliente 5511..." ou só dígitos/símbolos).
  IF NEW.client_name IS NULL
     OR btrim(NEW.client_name) = ''
     OR (lower(NEW.client_name) LIKE 'cliente%' AND NEW.client_name ~ '[0-9]')
     OR NEW.client_name ~ '^[0-9[:space:]()+.-]+$'
  THEN
    RETURN NEW;
  END IF;

  v_digits := regexp_replace(regexp_replace(coalesce(NEW.client_phone, ''), '\D', '', 'g'), '^55', '');
  IF v_digits = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.clients c
  SET name = NEW.client_name
  WHERE regexp_replace(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), '^55', '') = v_digits
    -- só preenche quando o cliente está com placeholder (não sobrescreve nome real)
    AND (
      c.name IS NULL
      OR btrim(c.name) = ''
      OR (lower(c.name) LIKE 'cliente%' AND c.name ~ '[0-9]')
      OR c.name ~ '^[0-9[:space:]()+.-]+$'
    )
    AND c.name IS DISTINCT FROM NEW.client_name;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_lead_name_to_client ON public.leads;
CREATE TRIGGER trg_propagate_lead_name_to_client
  AFTER INSERT OR UPDATE OF client_name ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_lead_name_to_client();
