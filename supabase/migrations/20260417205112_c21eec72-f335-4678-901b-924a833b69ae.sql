-- Function to list users with their emails (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  role app_role,
  seller_id uuid,
  seller_name text,
  store_id uuid,
  store_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this
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
    s.store_id,
    st.name AS store_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.sellers s ON s.user_id = u.id
  LEFT JOIN public.stores st ON st.id = s.store_id
  ORDER BY u.created_at DESC;
END;
$$;

-- Function to assign role + create/update seller record (admin only)
CREATE OR REPLACE FUNCTION public.admin_assign_user_role(
  _user_id uuid,
  _role app_role,
  _store_id uuid DEFAULT NULL,
  _seller_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_seller_id uuid;
  _seller_role seller_role;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Replace user roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);

  -- For roles that need a seller record (vendedor, suporte, gerente)
  IF _role IN ('vendedor', 'suporte', 'gerente') AND _store_id IS NOT NULL THEN
    -- Map app_role to seller_role enum
    IF _role = 'gerente' THEN
      _seller_role := 'gerente'::seller_role;
    ELSE
      _seller_role := 'vendedor'::seller_role;
    END IF;

    SELECT id INTO _existing_seller_id FROM public.sellers WHERE user_id = _user_id LIMIT 1;

    IF _existing_seller_id IS NULL THEN
      INSERT INTO public.sellers (user_id, name, role, store_id)
      VALUES (
        _user_id,
        COALESCE(_seller_name, (SELECT display_name FROM public.profiles WHERE user_id = _user_id), 'Sem nome'),
        _seller_role,
        _store_id
      );
    ELSE
      UPDATE public.sellers
      SET store_id = _store_id,
          role = _seller_role,
          name = COALESCE(_seller_name, name)
      WHERE id = _existing_seller_id;
    END IF;
  END IF;
END;
$$;

-- Function to revoke a user's role
CREATE OR REPLACE FUNCTION public.admin_revoke_user_role(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.sellers WHERE user_id = _user_id;
END;
$$;