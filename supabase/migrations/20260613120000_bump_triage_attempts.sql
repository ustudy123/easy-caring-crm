-- Incremento atômico das tentativas de código na triagem do WhatsApp.
-- Evita corrida quando o cliente manda vários códigos em sequência rápida:
-- cada chamada trava a linha e devolve o novo valor (1, 2, 3...), garantindo
-- que o fallback de região dispare na tentativa correta.
CREATE OR REPLACE FUNCTION public.bump_triage_code_attempts(p_client_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.clients
     SET triage_code_attempts = triage_code_attempts + 1
   WHERE id = p_client_id
  RETURNING triage_code_attempts;
$$;
