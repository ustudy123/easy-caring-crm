-- Campos do card do cliente (reunião de 28/10 + "Qualificação de Clientes —
-- Etapa 1" + planilha CRM_Regras da consultoria), por enquanto exibidos só para a
-- equipe de vendas externas:
--   cidade (municípios do RJ), segmento (Naval/Onshore/Offshore),
--   último contato (automático pela última mensagem enviada, editável),
--   próxima ação (Ligação/Visita presencial/Orçamentação) + data, que vira um
--   compromisso na Agenda.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_follow_up_id uuid REFERENCES public.follow_ups(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE public.leads ADD CONSTRAINT leads_segment_check
    CHECK (segment IS NULL OR segment IN ('Naval', 'Onshore', 'Offshore'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.leads ADD CONSTRAINT leads_next_action_check
    CHECK (next_action IS NULL OR next_action IN ('ligacao', 'visita', 'orcamentacao'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Último contato: toda mensagem ENVIADA ao cliente atualiza o card ──────────
-- (pelo CRM ou pelo celular; vale o mais recente, então uma data digitada à mão
-- só é substituída por um contato posterior a ela).
CREATE OR REPLACE FUNCTION public.touch_lead_last_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g'), '^55', '');
  v_at timestamptz := coalesce(NEW."timestamp", now());
BEGIN
  IF NEW.is_from_me IS NOT TRUE OR v_digits = '' THEN
    RETURN NEW;
  END IF;
  UPDATE public.leads
     SET last_contact_at = v_at
   WHERE regexp_replace(regexp_replace(coalesce(client_phone, ''), '\D', '', 'g'), '^55', '') = v_digits
     AND (last_contact_at IS NULL OR last_contact_at < v_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_lead_last_contact ON public.whatsapp_messages;
CREATE TRIGGER trg_touch_lead_last_contact
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_lead_last_contact();

-- ── Próxima ação vira compromisso na Agenda ───────────────────────────────────
-- Feito no banco para valer igual para vendedor, gerente e admin (a RLS de
-- follow_ups exige a loja de quem cria). Mudar a ação/data atualiza o mesmo
-- compromisso enquanto ele não foi concluído; concluído, cria um novo.
CREATE OR REPLACE FUNCTION public.sync_lead_next_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.follow_up_type;
  v_label text;
  v_store uuid;
  v_id uuid;
BEGIN
  IF NEW.next_action IS NULL OR NEW.next_action_at IS NULL THEN
    RETURN NEW;
  END IF;
  -- O app regrava todas as colunas do lead a cada alteração (ex.: mudar de etapa);
  -- só age quando a ação ou a data mudaram de fato.
  IF TG_OP = 'UPDATE'
     AND NEW.next_action IS NOT DISTINCT FROM OLD.next_action
     AND NEW.next_action_at IS NOT DISTINCT FROM OLD.next_action_at THEN
    RETURN NEW;
  END IF;

  v_type := CASE NEW.next_action
    WHEN 'ligacao' THEN 'call'
    WHEN 'visita' THEN 'visit'
    ELSE 'quote'
  END::public.follow_up_type;
  v_label := CASE NEW.next_action
    WHEN 'ligacao' THEN 'Ligação'
    WHEN 'visita' THEN 'Visita presencial'
    ELSE 'Orçamentação'
  END;
  -- Loja do vendedor responsável (a Agenda é por loja); sem vendedor, a do lead.
  SELECT s.store_id INTO v_store FROM public.sellers s WHERE s.id = NEW.assigned_to;
  v_store := coalesce(v_store, NEW.store_id);

  IF NEW.next_action_follow_up_id IS NOT NULL THEN
    UPDATE public.follow_ups
       SET type = v_type,
           scheduled_at = NEW.next_action_at,
           description = 'Próxima ação: ' || v_label,
           assigned_to = NEW.assigned_to,
           store_id = v_store,
           client_name = NEW.client_name,
           client_phone = NEW.client_phone
     WHERE id = NEW.next_action_follow_up_id
       AND completed = false;
    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.follow_ups (lead_id, client_name, client_phone, scheduled_at, description, completed, assigned_to, type, store_id)
  VALUES (NEW.id, NEW.client_name, NEW.client_phone, NEW.next_action_at, 'Próxima ação: ' || v_label, false, NEW.assigned_to, v_type, v_store)
  RETURNING id INTO v_id;

  -- Só grava o vínculo: esta UPDATE não mexe em next_action/next_action_at,
  -- então não dispara este gatilho de novo.
  UPDATE public.leads SET next_action_follow_up_id = v_id WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_next_action ON public.leads;
CREATE TRIGGER trg_sync_lead_next_action
  AFTER INSERT OR UPDATE OF next_action, next_action_at ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_next_action();

-- ── Carga inicial do último contato pelas mensagens já enviadas ────────────────
-- Sem o gatilho de updated_at, para não "zerar" o tempo parado de todos os cards
-- (os alertas de urgência usam leads.updated_at).
ALTER TABLE public.leads DISABLE TRIGGER leads_updated_at;
UPDATE public.leads l
   SET last_contact_at = m.last_at
  FROM (
    SELECT regexp_replace(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '^55', '') AS digits,
           max("timestamp") AS last_at
      FROM public.whatsapp_messages
     WHERE is_from_me IS TRUE AND "timestamp" IS NOT NULL
     GROUP BY 1
  ) m
 WHERE regexp_replace(regexp_replace(coalesce(l.client_phone, ''), '\D', '', 'g'), '^55', '') = m.digits
   AND m.digits <> ''
   AND (l.last_contact_at IS NULL OR l.last_contact_at < m.last_at);
ALTER TABLE public.leads ENABLE TRIGGER leads_updated_at;
