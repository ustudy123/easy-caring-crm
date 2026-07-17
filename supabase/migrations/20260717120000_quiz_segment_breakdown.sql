-- Nível por segmento no Show das Tintas.
--
-- Havia duas taxonomias diferentes nas perguntas:
--   quiz_questions.subject     = TEMA (Química, Patologias, Preparação...)
--   quiz_questions.paint_types = SEGMENTO (Imobiliária, Industrial, Automotiva)
-- e é o SEGMENTO que o admin escolhe por vendedor (sellers.quiz_subjects).
--
-- O subject_breakdown existente agrupa por TEMA e alimenta as estatísticas do
-- admin — continua como está. Para o nível por segmento (o vendedor pode ser
-- Avançado em Industrial e Básico em Imobiliária) é preciso acumular por
-- paint_type, daí esta coluna nova.

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS segment_breakdown jsonb;

COMMENT ON COLUMN public.quiz_attempts.segment_breakdown IS
  'Respondidas/acertos por SEGMENTO (paint_types: Imobiliária, Industrial, Automotiva). Base do nível por segmento. Não confundir com subject_breakdown, que é por tema.';
