-- Controle de repetição de perguntas por usuário no Show das Tintas.
--
-- Ate aqui cada rodada sorteava do zero, entao uma pergunta podia repetir na
-- rodada seguinte. Esta tabela registra o que cada usuario ja respondeu; o
-- sorteio passa a priorizar as nao-vistas e, quando elas acabam, repete
-- primeiro as vistas ha mais tempo.

CREATE TABLE IF NOT EXISTS public.quiz_seen_questions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  seen_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, question_id)
);

-- Busca "o que este usuario ja viu, do mais antigo para o mais novo".
CREATE INDEX IF NOT EXISTS idx_quiz_seen_user_lastseen
  ON public.quiz_seen_questions (user_id, last_seen_at);

ALTER TABLE public.quiz_seen_questions ENABLE ROW LEVEL SECURITY;

-- Cada usuario so enxerga e grava o proprio historico.
DROP POLICY IF EXISTS "own seen questions - select" ON public.quiz_seen_questions;
CREATE POLICY "own seen questions - select"
  ON public.quiz_seen_questions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own seen questions - insert" ON public.quiz_seen_questions;
CREATE POLICY "own seen questions - insert"
  ON public.quiz_seen_questions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own seen questions - update" ON public.quiz_seen_questions;
CREATE POLICY "own seen questions - update"
  ON public.quiz_seen_questions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Marca (ou atualiza) as perguntas de uma rodada como vistas por este usuario,
-- numa unica chamada. Roda como SECURITY DEFINER mas grava sempre para auth.uid().
CREATE OR REPLACE FUNCTION public.mark_questions_seen(p_question_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_question_ids IS NULL THEN RETURN; END IF;
  INSERT INTO public.quiz_seen_questions (user_id, question_id)
  SELECT auth.uid(), qid FROM unnest(p_question_ids) AS qid
  ON CONFLICT (user_id, question_id)
  DO UPDATE SET last_seen_at = now(),
                seen_count = public.quiz_seen_questions.seen_count + 1;
END;
$$;
