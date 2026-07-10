-- Corrige o contador de mensagens não-lidas que não zerava ao abrir a conversa.
--
-- Causas possíveis: (a) a função não estava aplicada no banco, então o .rpc no
-- front dava erro e a atualização local (que zera o badge) nem rodava; e/ou
-- (b) a função casava o telefone EXATO (phone = p_phone), e qualquer diferença
-- de formatação (com/sem +, espaços, DDI) marcava 0 linhas — o badge até zerava
-- na hora, mas voltava ao recarregar porque nada foi gravado.
--
-- Agora a comparação é por dígitos normalizados (só números), tolerante a
-- formatação, tanto nas mensagens quanto nas notificações.

CREATE OR REPLACE FUNCTION public.mark_whatsapp_read(p_phone text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerente'::app_role)
    OR public.has_role(auth.uid(), 'vendedor'::app_role)
    OR public.has_role(auth.uid(), 'suporte'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para marcar mensagens como lidas';
  END IF;

  -- 1. Mensagens recebidas desse telefone (compara por dígitos)
  UPDATE public.whatsapp_messages
  SET is_read = true
  WHERE regexp_replace(phone, '\D', '', 'g') = digits
    AND is_from_me = false
    AND is_read = false;

  GET DIAGNOSTICS affected = ROW_COUNT;

  -- 2. Notificações de "nova mensagem" desse telefone (alimenta o badge global)
  UPDATE public.notifications
  SET is_read = true
  WHERE type = 'whatsapp_new_message'
    AND is_read = false
    AND regexp_replace(coalesce(metadata->>'phone', ''), '\D', '', 'g') = digits;

  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_whatsapp_read(text) TO authenticated;
