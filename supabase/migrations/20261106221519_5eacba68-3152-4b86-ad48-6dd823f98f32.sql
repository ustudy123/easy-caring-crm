CREATE OR REPLACE FUNCTION public.get_quiz_leaderboard(limit_count integer DEFAULT 10, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text, best_score integer, attempts bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT qa.user_id,
         COALESCE(p.display_name, 'Usuário Anônimo') AS display_name,
         p.avatar_url,
         COALESCE(SUM(qa.score), 0)::integer AS best_score,
         COUNT(*) AS attempts
  FROM public.quiz_attempts qa
  LEFT JOIN public.profiles p ON p.user_id = qa.user_id
  WHERE (p_since IS NULL OR qa.completed_at >= p_since)
  GROUP BY qa.user_id, p.display_name, p.avatar_url
  ORDER BY best_score DESC, attempts DESC
  LIMIT limit_count;
$function$;