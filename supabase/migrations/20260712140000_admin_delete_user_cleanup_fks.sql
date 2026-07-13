-- Corrige a exclusão de usuário, que falhava por FKs sem cascade apontando para
-- auth.users (ex.: "violates foreign key constraint user_modules_user_id_fkey").
--
-- O RPC roda em transação: como o DELETE FROM auth.users falhava, a exclusão
-- inteira era revertida. Agora limpamos todas as referências antes:
--   - permissões / histórico do próprio usuário: DELETE
--   - dados de negócio (mensagens enviadas, solicitações criadas): SET NULL,
--     para preservar o registro apenas desvinculando o usuário.

CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir o próprio usuário';
  END IF;

  -- Referências que devem sumir junto com o usuário
  DELETE FROM public.user_roles     WHERE user_id = _user_id;
  DELETE FROM public.sellers        WHERE user_id = _user_id;
  DELETE FROM public.profiles       WHERE user_id = _user_id;
  DELETE FROM public.user_modules   WHERE user_id = _user_id;
  DELETE FROM public.quiz_attempts  WHERE user_id = _user_id;
  DELETE FROM public.notifications  WHERE user_id = _user_id;

  -- Dados de negócio: preserva o registro, apenas desvincula o usuário
  UPDATE public.whatsapp_messages       SET sender_id  = NULL WHERE sender_id  = _user_id;
  UPDATE public.pricing_support_requests SET created_by = NULL WHERE created_by = _user_id;

  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
