-- Ranking passa a retornar também a foto de perfil (profiles.avatar_url).
-- Recria a função porque o tipo de retorno mudou (não é possível só REPLACE).

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
    MAX(qa.score)::integer AS best_score,
    COUNT(*) AS attempts
  FROM public.quiz_attempts qa
  LEFT JOIN public.profiles p ON p.user_id = qa.user_id
  WHERE (p_since IS NULL OR qa.completed_at >= p_since)
  GROUP BY qa.user_id, p.display_name, p.avatar_url
  ORDER BY best_score DESC
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(integer, timestamptz) TO authenticated, anon;
