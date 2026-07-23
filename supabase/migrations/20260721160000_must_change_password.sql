-- Troca de senha obrigatória no próximo login.
--
-- Quando o admin redefine a senha de alguém, ele define uma senha temporária e
-- a repassa. Esta flag faz o sistema exigir que a pessoa escolha uma senha
-- própria no primeiro acesso — assim a senha definida pelo admin não continua
-- valendo indefinidamente.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'Se true, o usuário é obrigado a definir uma nova senha ao entrar (usado após reset feito pelo admin).';

-- O usuário precisa poder limpar a própria flag ao concluir a troca.
DROP POLICY IF EXISTS "Users can update own profile flag" ON public.profiles;
CREATE POLICY "Users can update own profile flag"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
