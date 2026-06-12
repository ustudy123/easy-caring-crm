-- Liga os dois sistemas de "não lido": ao marcar as mensagens de um telefone
-- como lidas, também marca as notificações whatsapp_new_message desse mesmo
-- telefone como lidas. Assim o badge da Conversas (que conta notificações)
-- zera ao abrir a conversa. O realtime de notifications remove do estado local.

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

  -- 1. Mensagens recebidas desse telefone
  UPDATE public.whatsapp_messages
  SET is_read = true
  WHERE phone = p_phone
    AND is_from_me = false
    AND is_read = false;

  GET DIAGNOSTICS affected = ROW_COUNT;

  -- 2. Notificações de "nova mensagem" desse telefone (o que alimenta o badge)
  UPDATE public.notifications
  SET is_read = true
  WHERE type = 'whatsapp_new_message'
    AND is_read = false
    AND metadata->>'phone' = p_phone;

  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_whatsapp_read(text) TO authenticated;
