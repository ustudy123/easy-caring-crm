-- Habilita realtime para quiz_attempts, para o ranking do Show das Tintas
-- atualizar em tempo real para todos os usuários quando alguém conclui o quiz.
-- A leitura consistente entre usuários é garantida pela função
-- get_quiz_leaderboard (SECURITY DEFINER), já que a RLS da tabela restringe
-- cada usuário às próprias tentativas.

-- REPLICA IDENTITY FULL garante payload completo nos eventos de realtime
ALTER TABLE public.quiz_attempts REPLICA IDENTITY FULL;

-- Adiciona à publicação apenas se ainda não estiver (evita erro de duplicidade)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'quiz_attempts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_attempts;
  END IF;
END $$;
