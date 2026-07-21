-- Múltiplos papéis por usuário.
--
-- A admin_assign_user_role apagava todos os papéis e inseria UM (um papel por
-- usuário). Agora um usuário pode acumular papéis (ex.: vendedor + suporte) e
-- ter acesso a tudo de cada função. Esta RPC recebe um ARRAY de papéis.
--
-- O vínculo com sellers (loja, código, nome) continua valendo quando o usuário
-- tem qualquer papel operacional (vendedor/gerente/suporte). Se tiver gerente
-- entre os papéis, o seller.role vira 'gerente'; senão 'vendedor'.

CREATE OR REPLACE FUNCTION public.admin_assign_user_roles(
  _user_id uuid,
  _roles app_role[],
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
  _has_operational boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF _roles IS NULL OR array_length(_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos uma função';
  END IF;

  _normalized_code := NULLIF(TRIM(_seller_code), '');
  IF _normalized_code IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.sellers WHERE code = _normalized_code AND (user_id IS DISTINCT FROM _user_id)) THEN
      RAISE EXCEPTION 'Código de vendedor % já está em uso', _normalized_code;
    END IF;
  END IF;

  -- Reescreve o conjunto de papéis do usuário (remove duplicatas do array).
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role)
  SELECT _user_id, r FROM unnest(_roles) AS r
  GROUP BY r;

  _has_operational := _roles && ARRAY['vendedor','suporte','gerente']::app_role[];

  IF _has_operational AND _store_id IS NOT NULL THEN
    IF 'gerente' = ANY(_roles) THEN
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
        _seller_role, _store_id, _normalized_code, _is_active, _is_available,
        COALESCE(_status, 'active'), _substitute_id
      );
    ELSE
      UPDATE public.sellers
      SET store_id = _store_id, role = _seller_role,
          name = COALESCE(_seller_name, name), code = _normalized_code,
          is_active = _is_active, is_available = _is_available,
          status = COALESCE(_status, status, 'active'), substitute_id = _substitute_id
      WHERE id = _existing_seller_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
