-- Pedido do André (19/11): o portal é HUB Taeco Tintas, mas o quiz volta
-- a se chamar Show das Tintas (card do Hub e lembrete de terça e quinta).

UPDATE public.modules SET name = 'Show das Tintas'
 WHERE id = 'quiz' AND name = 'HUB Taeco Tintas';

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
