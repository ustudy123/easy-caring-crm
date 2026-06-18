-- Status ativo/inativo no quiz:
-- - Vendedor ATIVO que não faz o quiz no dia -> penalidade de -100 (já existente).
-- - Vendedor INATIVO (férias/folga) que não faz -> NÃO perde pontos, mas o sistema
--   REGISTRA que não respondeu por estar inativo (linha de 0 ponto marcada).
-- O próprio vendedor controla seu status (is_active) em Configurações.

-- Colunas de marcação (idempotente: cria se ainda não existir).
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS is_penalty boolean NOT NULL DEFAULT false;
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS skipped_inactive boolean NOT NULL DEFAULT false;

-- Ranking: soma de pontos; 'attempts' conta só tentativas reais
-- (ignora penalidades e registros de inativo).
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
    COUNT(*) FILTER (WHERE NOT qa.is_penalty AND NOT qa.skipped_inactive) AS attempts
  FROM public.quiz_attempts qa
  LEFT JOIN public.profiles p ON p.user_id = qa.user_id
  WHERE (p_since IS NULL OR qa.completed_at >= p_since)
  GROUP BY qa.user_id, p.display_name, p.avatar_url
  ORDER BY best_score DESC
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(integer, timestamptz) TO authenticated, anon;

-- Rotina diária (terça/quinta): penaliza ativos faltantes e registra inativos faltantes.
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

  -- 1) Penalidade -100 para ATIVOS que não fizeram o quiz hoje.
  INSERT INTO public.quiz_attempts (user_id, score, total_questions, correct_answers, is_penalty)
  SELECT s.user_id, -100, 0, 0, true
  FROM public.sellers s
  WHERE s.user_id IS NOT NULL
    AND s.is_active IS NOT FALSE
    AND NOT EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.user_id = s.user_id
        AND qa.is_penalty = false
        AND qa.skipped_inactive = false
        AND (qa.completed_at AT TIME ZONE 'America/Sao_Paulo')::date = today_brt
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.quiz_attempts qp
      WHERE qp.user_id = s.user_id
        AND qp.is_penalty = true
        AND (qp.completed_at AT TIME ZONE 'America/Sao_Paulo')::date = today_brt
    );

  -- 2) Registro (sem perda de pontos) para INATIVOS que não fizeram o quiz hoje:
  --    marca que não respondeu por estar inativo.
  INSERT INTO public.quiz_attempts (user_id, score, total_questions, correct_answers, skipped_inactive)
  SELECT s.user_id, 0, 0, 0, true
  FROM public.sellers s
  WHERE s.user_id IS NOT NULL
    AND s.is_active = false
    AND NOT EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.user_id = s.user_id
        AND qa.is_penalty = false
        AND qa.skipped_inactive = false
        AND (qa.completed_at AT TIME ZONE 'America/Sao_Paulo')::date = today_brt
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.quiz_attempts qs
      WHERE qs.user_id = s.user_id
        AND qs.skipped_inactive = true
        AND (qs.completed_at AT TIME ZONE 'America/Sao_Paulo')::date = today_brt
    );
END;
$$;
