-- Fase 6b: Agenda do CRM ⇄ Google Agenda, só para a equipe externa.
-- Cada vendedor conecta uma conta Google e o CRM cria nela uma agenda própria
-- ("CRM Taeco · Nome"). O escopo calendar.app.created só dá acesso às agendas
-- criadas pelo app: os compromissos pessoais do vendedor nunca chegam ao CRM.
-- As funções google-calendar-auth e google-calendar-sync fazem a ponte; o app
-- só lê o estado da conexão (sem os tokens).

CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  seller_id uuid PRIMARY KEY REFERENCES public.sellers(id) ON DELETE CASCADE,
  google_email text,
  calendar_id text,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  sync_token text,
  status text NOT NULL DEFAULT 'active',
  last_error text,
  last_synced_at timestamptz,
  sync_lock_until timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  connected_by uuid,
  CONSTRAINT google_calendar_connections_status CHECK (status IN ('active', 'error', 'revoked'))
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
-- Tokens nunca saem para o navegador: leitura só das colunas sem segredo, e
-- nenhuma escrita pelo app (só as funções, com a chave de serviço).
REVOKE ALL ON public.google_calendar_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT (seller_id, google_email, calendar_id, status, last_error, last_synced_at, connected_at)
  ON public.google_calendar_connections TO authenticated;

DROP POLICY IF EXISTS "Read visible google calendar connections" ON public.google_calendar_connections;
CREATE POLICY "Read visible google calendar connections" ON public.google_calendar_connections
  FOR SELECT TO authenticated
  USING (public.can_view_seller(seller_id));

-- Compromisso do CRM ⇄ evento do Google. Sem FK no follow-up: depois de apagado
-- no CRM, o vínculo ainda diz qual evento apagar no Google.
CREATE TABLE IF NOT EXISTS public.google_calendar_event_links (
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  follow_up_id uuid NOT NULL,
  calendar_id text NOT NULL,
  google_event_id text NOT NULL,
  etag text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seller_id, follow_up_id),
  UNIQUE (calendar_id, google_event_id)
);
ALTER TABLE public.google_calendar_event_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_event_links FROM PUBLIC, anon, authenticated;

-- Fila do que mudou no CRM e ainda precisa ir para o Google.
CREATE TABLE IF NOT EXISTS public.google_calendar_outbox (
  id bigserial PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  follow_up_id uuid NOT NULL,
  op text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  CONSTRAINT google_calendar_outbox_op CHECK (op IN ('upsert', 'delete'))
);
CREATE INDEX IF NOT EXISTS google_calendar_outbox_seller_idx ON public.google_calendar_outbox (seller_id, id);
ALTER TABLE public.google_calendar_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_outbox FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.google_calendar_outbox_id_seq FROM PUBLIC, anon, authenticated;

-- Uma entrada por compromisso: a última mudança substitui a anterior.
CREATE OR REPLACE FUNCTION public.google_calendar_enqueue(_seller_id uuid, _follow_up_id uuid, _op text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _seller_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.google_calendar_connections c
     WHERE c.seller_id = _seller_id AND c.status <> 'revoked'
  ) THEN
    RETURN;
  END IF;
  DELETE FROM public.google_calendar_outbox WHERE seller_id = _seller_id AND follow_up_id = _follow_up_id;
  INSERT INTO public.google_calendar_outbox (seller_id, follow_up_id, op) VALUES (_seller_id, _follow_up_id, _op);
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_google_calendar_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mudança que veio do próprio Google (google_calendar_apply_event): não devolve.
  IF current_setting('app.google_sync', true) = 'on' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.google_calendar_enqueue(OLD.assigned_to, OLD.id, 'delete');
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      -- Trocou de vendedor: sai da agenda do anterior e entra na do novo.
      PERFORM public.google_calendar_enqueue(OLD.assigned_to, OLD.id, 'delete');
    ELSIF (NEW.scheduled_at, NEW.type, NEW.description, NEW.client_name, NEW.client_phone, NEW.completed)
          IS NOT DISTINCT FROM
          (OLD.scheduled_at, OLD.type, OLD.description, OLD.client_name, OLD.client_phone, OLD.completed) THEN
      -- Nada que apareça no Google mudou (ex.: last_notified_at).
      RETURN NULL;
    END IF;
  END IF;

  PERFORM public.google_calendar_enqueue(NEW.assigned_to, NEW.id, 'upsert');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_google_calendar_sync ON public.follow_ups;
CREATE TRIGGER trg_enqueue_google_calendar_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_google_calendar_sync();

-- Ao conectar: manda para o Google os compromissos desde 7 dias atrás.
CREATE OR REPLACE FUNCTION public.google_calendar_enqueue_backfill(_seller_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.google_calendar_outbox o
   USING public.follow_ups f
   WHERE o.seller_id = _seller_id AND o.follow_up_id = f.id
     AND f.assigned_to = _seller_id AND f.scheduled_at >= now() - interval '7 days';
  INSERT INTO public.google_calendar_outbox (seller_id, follow_up_id, op)
  SELECT _seller_id, f.id, 'upsert'
    FROM public.follow_ups f
   WHERE f.assigned_to = _seller_id
     AND f.scheduled_at >= now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Reserva as conexões para uma rodada de sincronização (evita duas rodadas
-- simultâneas na mesma agenda e chamadas repetidas em sequência).
CREATE OR REPLACE FUNCTION public.google_calendar_claim(
  _seller_id uuid DEFAULT NULL,
  _min_interval_seconds integer DEFAULT 60,
  _lock_seconds integer DEFAULT 240
)
RETURNS SETOF public.google_calendar_connections
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.google_calendar_connections c
     SET sync_lock_until = now() + make_interval(secs => _lock_seconds)
   WHERE c.status IN ('active', 'error')
     AND (_seller_id IS NULL OR c.seller_id = _seller_id)
     AND (c.sync_lock_until IS NULL OR c.sync_lock_until < now())
     AND (c.last_synced_at IS NULL OR c.last_synced_at <= now() - make_interval(secs => _min_interval_seconds))
  RETURNING c.*;
$$;

-- Aplica no CRM um evento que mudou no Google. Os campos já chegam
-- interpretados pela função (título → cliente/tipo/concluído).
CREATE OR REPLACE FUNCTION public.google_calendar_apply_event(
  _seller_id uuid,
  _calendar_id text,
  _event_id text,
  _etag text,
  _cancelled boolean,
  _client_name text,
  _type text,
  _completed boolean,
  _description text,
  _scheduled_at timestamptz,
  _crm_follow_up_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.google_calendar_event_links%ROWTYPE;
  v_store uuid;
  v_id uuid;
BEGIN
  PERFORM set_config('app.google_sync', 'on', true);

  SELECT * INTO v_link FROM public.google_calendar_event_links
   WHERE calendar_id = _calendar_id AND google_event_id = _event_id;

  -- Evento criado pelo CRM (traz o id do compromisso) cujo vínculo se perdeu,
  -- por exemplo ao reconectar a mesma agenda: refaz o vínculo em vez de duplicar.
  IF NOT FOUND AND _crm_follow_up_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.follow_ups WHERE id = _crm_follow_up_id AND assigned_to = _seller_id) THEN
      RETURN 'skipped';
    END IF;
    INSERT INTO public.google_calendar_event_links (seller_id, follow_up_id, calendar_id, google_event_id, etag)
    VALUES (_seller_id, _crm_follow_up_id, _calendar_id, _event_id, NULL)
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN
      RETURN 'skipped';
    END IF;
    SELECT * INTO v_link FROM public.google_calendar_event_links
     WHERE seller_id = _seller_id AND follow_up_id = _crm_follow_up_id;
  END IF;

  -- Eco da nossa própria gravação no Google.
  IF FOUND AND v_link.etag IS NOT DISTINCT FROM _etag THEN
    RETURN 'skipped';
  END IF;

  IF _cancelled THEN
    IF v_link.follow_up_id IS NULL THEN
      RETURN 'skipped';
    END IF;
    DELETE FROM public.follow_ups WHERE id = v_link.follow_up_id AND assigned_to = _seller_id;
    DELETE FROM public.google_calendar_event_links
     WHERE seller_id = v_link.seller_id AND follow_up_id = v_link.follow_up_id;
    RETURN 'deleted';
  END IF;

  IF _scheduled_at IS NULL THEN
    RETURN 'skipped';
  END IF;

  IF v_link.follow_up_id IS NULL THEN
    SELECT s.store_id INTO v_store FROM public.sellers s WHERE s.id = _seller_id;
    INSERT INTO public.follow_ups (lead_id, client_name, client_phone, scheduled_at, description, completed, assigned_to, type, store_id)
    VALUES (NULL, left(coalesce(nullif(btrim(_client_name), ''), 'Compromisso do Google'), 200), '', _scheduled_at,
            coalesce(_description, ''), coalesce(_completed, false), _seller_id,
            coalesce(_type, 'visit')::public.follow_up_type, v_store)
    RETURNING id INTO v_id;
    INSERT INTO public.google_calendar_event_links (seller_id, follow_up_id, calendar_id, google_event_id, etag)
    VALUES (_seller_id, v_id, _calendar_id, _event_id, _etag);
    RETURN 'created';
  END IF;

  UPDATE public.follow_ups
     SET scheduled_at = _scheduled_at,
         client_name = left(coalesce(nullif(btrim(_client_name), ''), client_name), 200),
         description = coalesce(_description, description),
         completed = coalesce(_completed, completed),
         type = coalesce(_type::public.follow_up_type, type)
   WHERE id = v_link.follow_up_id AND assigned_to = _seller_id;
  IF NOT FOUND THEN
    -- Apagado ou transferido no CRM: a fila de saída cuida do evento.
    RETURN 'skipped';
  END IF;
  -- Compromisso que é a próxima ação de um lead: a data do card acompanha.
  UPDATE public.leads
     SET next_action_at = _scheduled_at
   WHERE next_action_follow_up_id = v_link.follow_up_id
     AND next_action_at IS DISTINCT FROM _scheduled_at;
  UPDATE public.google_calendar_event_links
     SET etag = _etag, synced_at = now()
   WHERE seller_id = v_link.seller_id AND follow_up_id = v_link.follow_up_id;
  RETURN 'updated';
END;
$$;

-- Funções de serviço: só as edge functions (chave de serviço) chamam.
REVOKE ALL ON FUNCTION public.google_calendar_enqueue(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.google_calendar_enqueue_backfill(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.google_calendar_claim(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.google_calendar_apply_event(uuid, text, text, text, boolean, text, text, boolean, text, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.google_calendar_enqueue_backfill(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_claim(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_apply_event(uuid, text, text, text, boolean, text, text, boolean, text, timestamptz, uuid)
  TO service_role;
GRANT ALL ON public.google_calendar_connections, public.google_calendar_event_links, public.google_calendar_outbox TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.google_calendar_outbox_id_seq TO service_role;
-- Sem realtime nesta tabela: ela guarda tokens. O app relê o estado depois de
-- conectar, desconectar ou sincronizar.
