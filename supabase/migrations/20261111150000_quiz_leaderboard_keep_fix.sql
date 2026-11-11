-- Mantém a correção do ranking feita pelo Lovable em 06/11
-- (20261106221519): total sem nulo, tentativas contando todas as linhas e
-- desempate por tentativas. A Fase 10 (20261111140000) recriou a função a
-- partir da versão anterior e perdeu essa correção; aqui ficam as duas coisas:
-- a correção e o fim do período (p_until) com a foto do cadastro do operador.

CREATE OR REPLACE FUNCTION public.get_quiz_leaderboard(
  limit_count integer DEFAULT 10,
  p_since timestamptz DEFAULT NULL,
  p_until timestamptz DEFAULT NULL
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
    COALESCE(nullif(p.avatar_url, ''), (
      SELECT nullif(s.avatar, '') FROM public.sellers s
       WHERE s.user_id = qa.user_id AND nullif(s.avatar, '') IS NOT NULL
       LIMIT 1
    )) AS avatar_url,
    COALESCE(SUM(qa.score), 0)::integer AS best_score,
    COUNT(*) AS attempts
  FROM public.quiz_attempts qa
  LEFT JOIN public.profiles p ON p.user_id = qa.user_id
  WHERE (p_since IS NULL OR qa.completed_at >= p_since)
    AND (p_until IS NULL OR qa.completed_at < p_until)
  GROUP BY qa.user_id, p.display_name, p.avatar_url
  ORDER BY best_score DESC, attempts DESC
  LIMIT limit_count;
$$;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(integer, timestamptz, timestamptz) TO authenticated, anon;
