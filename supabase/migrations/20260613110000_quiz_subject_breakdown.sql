-- Guarda o desempenho por assunto de cada tentativa do quiz, no formato
-- { "assunto": { "answered": N, "correct": M }, ... }. Alimenta o painel de
-- desempenho por assunto no CRM Dashboard. Tentativas antigas ficam NULL.
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS subject_breakdown jsonb;

COMMENT ON COLUMN public.quiz_attempts.subject_breakdown IS
  'Acertos por assunto na tentativa: { assunto: { answered, correct } }.';
