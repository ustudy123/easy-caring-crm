-- Penalidade de -100 pontos quando o vendedor ATIVO não faz o quiz no dia de quiz.
-- Para a penalidade fazer sentido, o ranking passa a SOMAR os pontos do período
-- (antes usava o melhor score de uma rodada).

-- 1) Marca para distinguir linhas de penalidade das tentativas reais.
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS is_penalty boolean NOT NULL DEFAULT false;

-- 2) Ranking por soma de pontos (inclui as penalidades, que são negativas).
--    'attempts' conta apenas tentativas reais (ignora penalidades).
DROP FUNCTION IF EXISTS public.get_quiz_leaderboard(integer, timestamptz);

CREATE OR REPLACE FUNCTION public.get_quiz_leaderboard(
  limit_count integer DEFAULT 10,
  p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  best_score integer,
  attempts bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    qa.user_id,
    COALESCE(p.display_name, 'Usuário Anônimo') AS display_name,
    p.avatar_url,
    SUM(qa.score)::integer AS best_score,
    COUNT(*) FILTER (WHERE NOT qa.is_penalty) AS attempts
  FROM public.quiz_attempts qa
  LEFT JOIN public.profiles p ON p.user_id = qa.user_id
  WHERE (p_since IS NULL OR qa.completed_at >= p_since)
  GROUP BY qa.user_id, p.display_name, p.avatar_url
  ORDER BY best_score DESC
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(integer, timestamptz) TO authenticated, anon;

-- 3) Função de penalidade: roda no fim do dia de quiz e aplica -100 aos vendedores
--    ativos que não fizeram o quiz, sem penalizar duas vezes.
CREATE OR REPLACE FUNCTION public.apply_quiz_penalties()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_brt date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  dow int := EXTRACT(DOW FROM (now() AT TIME ZONE 'America/Sao_Paulo'));
BEGIN
  -- Só em dias de quiz: terça (2) e quinta (4).
  IF dow NOT IN (2, 4) THEN
    RETURN;
  END IF;

  INSERT INTO public.quiz_attempts (user_id, score, total_questions, correct_answers, is_penalty)
  SELECT s.user_id, -100, 0, 0, true
  FROM public.sellers s
  WHERE s.user_id IS NOT NULL
    AND s.is_active IS NOT FALSE
    -- não fez nenhuma tentativa real hoje
    AND NOT EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.user_id = s.user_id
        AND qa.is_penalty = false
        AND (qa.completed_at AT TIME ZONE 'America/Sao_Paulo')::date = today_brt
    )
    -- e ainda não foi penalizado hoje
    AND NOT EXISTS (
      SELECT 1 FROM public.quiz_attempts qp
      WHERE qp.user_id = s.user_id
        AND qp.is_penalty = true
        AND (qp.completed_at AT TIME ZONE 'America/Sao_Paulo')::date = today_brt
    );
END;
$$;

-- 4) Agenda a penalidade para terça e quinta às 23:55 (Brasília) = 02:55 UTC de qua/sex.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('quiz-penalty-tue-thu');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'quiz-penalty-tue-thu',
  '55 2 * * 3,5',
  $$SELECT public.apply_quiz_penalties();$$
);
