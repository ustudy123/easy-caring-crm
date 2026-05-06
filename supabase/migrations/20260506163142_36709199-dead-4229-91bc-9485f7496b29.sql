DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    display_name TEXT,
    created_at TIMESTAMPTZ,
    role public.app_role,
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
  SELECT
    u.id AS user_id,
    u.email::text,
    p.display_name,
    u.created_at,
    ur.role,
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
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.sellers s ON s.user_id = u.id
  LEFT JOIN public.stores st ON st.id = s.store_id
  LEFT JOIN public.sellers sub ON sub.id = s.substitute_id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
