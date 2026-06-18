-- Segmentação de assuntos do quiz por vendedor.
-- quiz_subjects guarda os assuntos (ex.: imobiliário, automotivo, industrial)
-- que o vendedor recebe no Show das Tintas.
-- NULL ou vazio = recebe TODOS os assuntos (sem restrição).
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS quiz_subjects text[];

COMMENT ON COLUMN public.sellers.quiz_subjects IS
  'Assuntos do quiz que o vendedor recebe. NULL/vazio = todos.';
