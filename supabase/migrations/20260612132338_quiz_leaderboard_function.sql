-- Função de ranking do Show das Tintas
-- Resolve o nome do jogador (profiles.display_name) e permite ranking
-- entre todos os usuários, contornando de forma controlada a RLS
-- de quiz_attempts (que só deixa cada usuário ver as próprias tentativas).
-- Expõe apenas display_name + pontuação agregada (nada sensível).

CREATE OR REPLACE FUNCTION public.get_quiz_leaderboard(limit_count integer DEFAULT 10)
RETURNS TABLE (
  user_id uuid,
  display_name text,
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
    MAX(qa.score)::integer AS best_score,
    COUNT(*) AS attempts
  FROM public.quiz_attempts qa
  LEFT JOIN public.profiles p ON p.user_id = qa.user_id
  GROUP BY qa.user_id, p.display_name
  ORDER BY best_score DESC
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(integer) TO authenticated, anon;
