-- Cadastro por apelido: o perfil passa a guardar o nome completo (full_name)
-- além do apelido (display_name = "como quer ser chamado").
-- O login é feito por apelido + senha; o e-mail interno é gerado pelo app.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

-- Atualiza o trigger para popular também o nome completo a partir do metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;
