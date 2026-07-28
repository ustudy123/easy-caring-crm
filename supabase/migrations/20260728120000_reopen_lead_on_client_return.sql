-- Reabertura de lead encerrado quando o cliente volta a mandar mensagem.
--
-- Regra pedida: se um atendimento foi ENCERRADO e o cliente manda mensagem de
-- novo EM OUTRO DIA, o lead deve voltar para o Kanban.
--
-- "Encerramento" (ver Kanban.tsx > handleMarkLost) tem estas saídas:
--   - Perda            -> stage = 'perdido'                (some do board)
--   - Venda recorrente -> stage = 'pos_venda', archived=true (some do board)
--   - Venda única      -> stage = 'pos_venda'              (CONTINUA no board)
--   - Reagendar        -> snoozed_until futuro + Agenda     (volta sozinho na data)
--   - Conversa Interna -> client_type = Equipe Interna      (reclassificação)
--
-- Só reabrimos os que REALMENTE saíram do board por encerramento: 'perdido' e
-- arquivados (recorrente). Reagendados têm retorno próprio (snoozed_until) e não
-- são tocados aqui. Venda única já está visível.
--
-- "Em outro dia": só reabre se o encerramento (closed_at) foi num dia de
-- calendário ANTERIOR ao de agora, no fuso America/Sao_Paulo. Mensagem no mesmo
-- dia do encerramento NÃO reabre (é a mesma conversa terminando).
--
-- Dispara via trigger no INSERT de whatsapp_messages (roda para toda mensagem
-- recebida, independentemente do caminho do webhook).

-- Índice funcional no telefone normalizado (só dígitos, sem o DDI 55 inicial),
-- para o casamento telefone-da-mensagem <-> client_phone do lead ser rápido.
-- (Os dois podem estar salvos em formatos diferentes, ex.: 5515...  vs  15...)
CREATE INDEX IF NOT EXISTS idx_leads_client_phone_digits
  ON public.leads (
    regexp_replace(regexp_replace(coalesce(client_phone, ''), '\D', '', 'g'), '^55', '')
  );

CREATE OR REPLACE FUNCTION public.reopen_lead_on_client_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits    text;
  v_lead_id   uuid;
  v_client_id uuid;
BEGIN
  -- Só reage a mensagens RECEBIDAS do cliente (is_from_me = false).
  -- Mensagens enviadas por nós (true) ou ambíguas (null) são ignoradas.
  IF NEW.is_from_me IS NOT FALSE THEN
    RETURN NEW;
  END IF;

  -- Telefone da mensagem normalizado: só dígitos, sem o DDI 55 inicial.
  v_digits := regexp_replace(regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g'), '^55', '');
  IF v_digits = '' THEN
    RETURN NEW;
  END IF;

  -- Se o cliente JÁ tem um lead ativo no board (não arquivado e não 'perdido'),
  -- ele já está no Kanban — não reabre outro, para não duplicar card.
  IF EXISTS (
    SELECT 1 FROM public.leads l
    WHERE regexp_replace(regexp_replace(coalesce(l.client_phone, ''), '\D', '', 'g'), '^55', '') = v_digits
      AND l.archived = false
      AND l.stage <> 'perdido'::public.kanban_stage
  ) THEN
    RETURN NEW;
  END IF;

  -- Procura o lead ENCERRADO mais recente desse cliente que se qualifica:
  --   'perdido' OU arquivado, e encerrado em um DIA ANTERIOR (fuso BRT).
  --   Reagendado (snoozed_until futuro) fica de fora (retorno próprio).
  SELECT l.id INTO v_lead_id
  FROM public.leads l
  WHERE regexp_replace(regexp_replace(coalesce(l.client_phone, ''), '\D', '', 'g'), '^55', '') = v_digits
    AND (l.stage = 'perdido'::public.kanban_stage OR l.archived = true)
    AND (l.snoozed_until IS NULL OR l.snoozed_until <= now())
    AND (
      l.closed_at IS NULL
      OR (l.closed_at AT TIME ZONE 'America/Sao_Paulo')::date
         < (now() AT TIME ZONE 'America/Sao_Paulo')::date
    )
  ORDER BY COALESCE(l.closed_at, l.updated_at) DESC NULLS LAST
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reabre: volta pro topo do funil (Abordagem) e limpa as marcas de encerramento.
  -- Mantém o vendedor responsável (assigned_to) como estava.
  UPDATE public.leads
  SET stage       = 'abordagem'::public.kanban_stage,
      archived    = false,
      lost_reason = NULL,
      closed_at   = NULL,
      updated_at  = now()
  WHERE id = v_lead_id;

  -- Log de auditoria na timeline do cliente. Não bloqueia a reabertura se falhar
  -- (ex.: cliente ainda sem registro em `clients`).
  BEGIN
    SELECT c.id INTO v_client_id
    FROM public.clients c
    WHERE regexp_replace(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), '^55', '') = v_digits
    LIMIT 1;

    IF v_client_id IS NOT NULL THEN
      INSERT INTO public.interactions (client_id, lead_id, type, description, created_by)
      VALUES (
        v_client_id,
        v_lead_id,
        'note',
        'Cliente voltou a enviar mensagem após o encerramento — lead reaberto no Kanban (Abordagem).',
        NULL
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reopen_lead_on_client_return ON public.whatsapp_messages;
CREATE TRIGGER trg_reopen_lead_on_client_return
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.reopen_lead_on_client_return();
