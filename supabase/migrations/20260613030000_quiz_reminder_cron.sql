-- Lembrete do Show das Tintas: notificação no CRM toda terça e quinta,
-- apenas para vendedores ativos, lembrando de fazer o quiz.

-- 1) Função que insere a notificação para cada vendedor ativo (com login),
--    evitando duplicar caso a rotina rode mais de uma vez no mesmo dia.
CREATE OR REPLACE FUNCTION public.notify_quiz_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT
    s.user_id,
    'quiz_reminder',
    'Show das Tintas 🎯',
    'Hoje tem quiz! Responda as perguntas do dia e marque pontos no ranking.',
    jsonb_build_object(
      'link', '/quiz',
      'day', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')
    )
  FROM public.sellers s
  WHERE s.user_id IS NOT NULL
    AND s.is_active IS NOT FALSE
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = s.user_id
        AND n.type = 'quiz_reminder'
        AND (n.created_at AT TIME ZONE 'America/Sao_Paulo')::date
            = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    );
END;
$$;

-- 2) Agendamento via pg_cron.
--    Terça (2) e quinta (4) às 12:00 UTC = 09:00 no horário de Brasília (UTC-3).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove o job anterior (se existir) para a migração ser idempotente.
DO $$
BEGIN
  PERFORM cron.unschedule('quiz-reminder-tue-thu');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'quiz-reminder-tue-thu',
  '0 12 * * 2,4',
  $$SELECT public.notify_quiz_reminder();$$
);
