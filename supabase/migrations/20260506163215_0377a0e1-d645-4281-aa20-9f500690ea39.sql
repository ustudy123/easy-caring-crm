DROP FUNCTION IF EXISTS public.admin_assign_user_role(uuid, public.app_role, uuid, text, text, boolean, boolean);
CREATE OR REPLACE FUNCTION public.admin_assign_user_role(
  _user_id uuid,
  _role app_role,
  _store_id uuid DEFAULT NULL,
  _seller_name text DEFAULT NULL,
  _seller_code text DEFAULT NULL,
  _is_active boolean DEFAULT true,
  _is_available boolean DEFAULT true,
  _status text DEFAULT 'active',
  _substitute_id uuid DEFAULT NULL
) RETURNS void AS $$
DECLARE
  _existing_seller_id uuid;
  _seller_role seller_role;
  _normalized_code text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  _normalized_code := NULLIF(TRIM(_seller_code), '');

  IF _normalized_code IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.sellers WHERE code = _normalized_code AND (user_id IS DISTINCT FROM _user_id)) THEN
      RAISE EXCEPTION 'Código de vendedor % já está em uso', _normalized_code;
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);

  IF _role IN ('vendedor', 'suporte', 'gerente') AND _store_id IS NOT NULL THEN
    IF _role = 'gerente' THEN
      _seller_role := 'gerente'::seller_role;
    ELSE
      _seller_role := 'vendedor'::seller_role;
    END IF;

    SELECT id INTO _existing_seller_id FROM public.sellers WHERE user_id = _user_id LIMIT 1;

    IF _existing_seller_id IS NULL THEN
      INSERT INTO public.sellers (user_id, name, role, store_id, code, is_active, is_available, status, substitute_id)
      VALUES (
        _user_id,
        COALESCE(_seller_name, (SELECT display_name FROM public.profiles WHERE user_id = _user_id), 'Sem nome'),
        _seller_role,
        _store_id,
        _normalized_code,
        _is_active,
        _is_available,
        COALESCE(_status, 'active'),
        _substitute_id
      );
    ELSE
      UPDATE public.sellers
      SET store_id = _store_id,
          role = _seller_role,
          name = COALESCE(_seller_name, name),
          code = _normalized_code,
          is_active = _is_active,
          is_available = _is_available,
          status = COALESCE(_status, status, 'active'),
          substitute_id = _substitute_id
      WHERE id = _existing_seller_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
