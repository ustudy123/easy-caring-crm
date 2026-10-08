ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS silence_alert_hours integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS silence_alerted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_msgs_instance_ts ON public.whatsapp_messages (received_on_instance_id, "timestamp" DESC);

CREATE OR REPLACE FUNCTION public.check_whatsapp_silence()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT i.id, i.name, i.phone_number, i.silence_alert_hours, i.silence_alerted_at,
      (SELECT max(coalesce(m."timestamp", m.created_at)) FROM whatsapp_messages m
        WHERE m.received_on_instance_id = i.id AND coalesce(m.is_from_me,false) = false) AS last_in
    FROM whatsapp_instances i
    WHERE i.silence_alert_hours > 0
  LOOP
    IF coalesce(r.last_in, '-infinity') < now() - make_interval(hours => r.silence_alert_hours)
       AND (r.silence_alerted_at IS NULL OR r.silence_alerted_at < coalesce(r.last_in,'-infinity')
            OR r.silence_alerted_at < now() - make_interval(hours => greatest(r.silence_alert_hours,24))) THEN
      INSERT INTO notifications (role_target, type, title, message, metadata)
      VALUES ('admin', 'whatsapp_silence', 'WhatsApp sem receber mensagens',
        format('O número %s (+%s) está há mais de %s h sem receber mensagens%s. Verifique a conexão.',
          r.name, r.phone_number, r.silence_alert_hours,
          CASE WHEN r.last_in IS NULL THEN ' (nunca recebeu)' ELSE ' (última: ' || to_char(r.last_in AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') || ')' END),
        jsonb_build_object('instance_id', r.id, 'last_message_at', r.last_in));
      UPDATE whatsapp_instances SET silence_alerted_at = now() WHERE id = r.id;
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_whatsapp_silence() FROM anon, authenticated, public;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('whatsapp-silence-check', '0 * * * *', $$SELECT public.check_whatsapp_silence();$$);