-- Fase 10: Show das Tintas na visão do vendedor.
-- 1) Ranking por mês escolhido: get_quiz_leaderboard ganha o fim do período
--    (p_until). Chamadas antigas, só com início, continuam valendo.
-- 2) Foto no ranking: a do perfil ou, sem ela, a do cadastro do operador.
-- 3) O admin define a foto do operador no cadastro (Admin → Usuários & Papéis).

DROP FUNCTION IF EXISTS public.get_quiz_leaderboard(integer, timestamptz);

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
    SUM(qa.score)::integer AS best_score,
    COUNT(*) FILTER (WHERE NOT qa.is_penalty AND NOT qa.skipped_inactive) AS attempts
  FROM public.quiz_attempts qa
  LEFT JOIN public.profiles p ON p.user_id = qa.user_id
  WHERE (p_since IS NULL OR qa.completed_at >= p_since)
    AND (p_until IS NULL OR qa.completed_at < p_until)
  GROUP BY qa.user_id, p.display_name, p.avatar_url
  ORDER BY best_score DESC
  LIMIT limit_count;
$$;
GRANT EXECUTE ON FUNCTION public.get_quiz_leaderboard(integer, timestamptz, timestamptz) TO authenticated, anon;

-- Foto do operador definida pelo admin (o perfil só deixa cada um mudar o seu).
CREATE OR REPLACE FUNCTION public.admin_set_user_avatar(_user_id uuid, _url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Só o admin muda a foto de outro operador.' USING ERRCODE = '42501';
  END IF;
  IF _url IS NOT NULL AND _url !~ '/storage/v1/object/public/avatars/' THEN
    RAISE EXCEPTION 'A foto precisa estar no armazenamento de fotos do CRM.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles SET avatar_url = _url WHERE user_id = _user_id;
  UPDATE public.sellers SET avatar = _url WHERE user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_avatar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_avatar(uuid, text) TO authenticated;
