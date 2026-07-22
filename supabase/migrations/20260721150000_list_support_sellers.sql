-- Lista os suportes (com loja) para o campo "Direcionar para".
--
-- O front lia user_roles direto, mas a RLS de user_roles só deixa o usuário ver
-- o PRÓPRIO papel — então o vendedor recebia lista vazia e o campo sumia. Esta
-- função roda como SECURITY DEFINER e devolve só o necessário (id, nome, loja,
-- flag de supervisor), sem expor a tabela de papéis.

CREATE OR REPLACE FUNCTION public.list_support_sellers()
RETURNS TABLE (
  seller_id uuid,
  name text,
  is_support_supervisor boolean,
  store_id uuid,
  store_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    COALESCE(s.is_support_supervisor, false),
    s.store_id,
    COALESCE(st.name, 'Sem loja')
  FROM public.sellers s
  JOIN public.user_roles ur ON ur.user_id = s.user_id AND ur.role = 'suporte'
  LEFT JOIN public.stores st ON st.id = s.store_id
  ORDER BY COALESCE(st.name, 'Sem loja'), s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.list_support_sellers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_support_sellers() TO authenticated;

-- Nome de exibição do admin, para o campo travado de negociação especial.
-- Mesma razão: o vendedor não consegue ler user_roles de outro usuário.
CREATE OR REPLACE FUNCTION public.get_admin_display_name()
RETURNS text AS $$
  SELECT COALESCE(p.display_name, 'Administrador')
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY p.display_name NULLS LAST
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_admin_display_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_display_name() TO authenticated;
