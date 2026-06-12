-- Corrige contador de mensagens não lidas que nunca zera.
-- A policy de UPDATE em whatsapp_messages só permite admin/gerente/vendedor-dono,
-- então o "marcar como lida" falhava silenciosamente (0 linhas afetadas) para os
-- demais casos. Esta função SECURITY DEFINER apenas alterna is_read, com guarda
-- de papel: quem pode ler conversas pode marcá-las como lidas.

CREATE OR REPLACE FUNCTION public.mark_whatsapp_read(p_phone text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerente'::app_role)
    OR public.has_role(auth.uid(), 'vendedor'::app_role)
    OR public.has_role(auth.uid(), 'suporte'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para marcar mensagens como lidas';
  END IF;

  UPDATE public.whatsapp_messages
  SET is_read = true
  WHERE phone = p_phone
    AND is_from_me = false
    AND is_read = false;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_whatsapp_read(text) TO authenticated;
