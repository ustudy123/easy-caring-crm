ALTER TABLE public.quiz_questions DROP COLUMN IF EXISTS category;
ALTER TABLE public.quiz_questions DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.quiz_questions DROP COLUMN IF EXISTS difficulty;

ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS difficulty TEXT;
