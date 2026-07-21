-- Corrige a duplicação de usuários na listagem do admin.
--
-- Com múltiplos papéis, o LEFT JOIN user_roles gerava UMA LINHA POR PAPEL, então
-- um usuário com 2 funções aparecia 2 vezes. Agora os papéis são agregados: uma
-- linha por usuário, com:
--   role  = papel principal (mais alto) — compatibilidade com o que já existe
--   roles = todos os papéis, texto "Funcao1/Funcao2" já rotulado em PT

DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    display_name TEXT,
    created_at TIMESTAMPTZ,
    role public.app_role,
    roles TEXT,
    seller_id UUID,
    seller_name TEXT,
    seller_code TEXT,
    store_id UUID,
    store_name TEXT,
    is_active BOOLEAN,
    is_available BOOLEAN,
    status TEXT,
    substitute_id UUID,
    substitute_name TEXT
) AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  WITH user_role_agg AS (
    SELECT
      ur.user_id,
      -- papel principal (mesma prioridade usada no front)
      (CASE
        WHEN bool_or(ur.role = 'admin')    THEN 'admin'
        WHEN bool_or(ur.role = 'gerente')  THEN 'gerente'
        WHEN bool_or(ur.role = 'suporte')  THEN 'suporte'
        ELSE 'vendedor'
      END)::public.app_role AS primary_role,
      -- rótulos em PT, na ordem de hierarquia, unidos por "/"
      string_agg(
        CASE ur.role
          WHEN 'admin'    THEN 'Admin'
          WHEN 'gerente'  THEN 'Gerente'
          WHEN 'suporte'  THEN 'Suporte'
          WHEN 'vendedor' THEN 'Vendedor'
          ELSE ur.role::text
        END,
        '/' ORDER BY
          CASE ur.role
            WHEN 'admin' THEN 1 WHEN 'gerente' THEN 2
            WHEN 'suporte' THEN 3 WHEN 'vendedor' THEN 4 ELSE 5
          END
      ) AS roles_label
    FROM public.user_roles ur
    GROUP BY ur.user_id
  )
  SELECT
    u.id AS user_id,
    u.email::text,
    p.display_name,
    u.created_at,
    ura.primary_role AS role,
    ura.roles_label AS roles,
    s.id AS seller_id,
    s.name AS seller_name,
    s.code AS seller_code,
    s.store_id,
    st.name AS store_name,
    COALESCE(s.is_active, true) AS is_active,
    COALESCE(s.is_available, true) AS is_available,
    s.status,
    s.substitute_id,
    sub.name AS substitute_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN user_role_agg ura ON ura.user_id = u.id
  LEFT JOIN public.sellers s ON s.user_id = u.id
  LEFT JOIN public.stores st ON st.id = s.store_id
  LEFT JOIN public.sellers sub ON sub.id = s.substitute_id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.admin_list_users() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
