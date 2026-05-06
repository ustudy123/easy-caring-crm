
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS sellers_code_unique_idx ON public.sellers (code) WHERE code IS NOT NULL;

DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
 RETURNS TABLE(user_id uuid, email text, display_name text, created_at timestamp with time zone, role app_role, seller_id uuid, seller_name text, seller_code text, store_id uuid, store_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    st.name AS store_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.sellers s ON s.user_id = u.id
  LEFT JOIN public.stores st ON st.id = s.store_id
  ORDER BY u.created_at DESC;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_assign_user_role(uuid, app_role, uuid, text);
CREATE OR REPLACE FUNCTION public.admin_assign_user_role(_user_id uuid, _role app_role, _store_id uuid DEFAULT NULL::uuid, _seller_name text DEFAULT NULL::text, _seller_code text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      INSERT INTO public.sellers (user_id, name, role, store_id, code)
      VALUES (
        _user_id,
        COALESCE(_seller_name, (SELECT display_name FROM public.profiles WHERE user_id = _user_id), 'Sem nome'),
        _seller_role,
        _store_id,
        _normalized_code
      );
    ELSE
      UPDATE public.sellers
      SET store_id = _store_id,
          role = _seller_role,
          name = COALESCE(_seller_name, name),
          code = _normalized_code
      WHERE id = _existing_seller_id;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_client_by_seller_code(_phone text, _code text)
 RETURNS TABLE(seller_id uuid, seller_name text, store_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _seller_id uuid;
  _seller_name text;
  _store_id uuid;
  _client_id uuid;
  _normalized_code text;
BEGIN
  _normalized_code := NULLIF(TRIM(_code), '');
  IF _normalized_code IS NULL THEN RETURN; END IF;

  SELECT s.id, s.name, s.store_id
  INTO _seller_id, _seller_name, _store_id
  FROM public.sellers s
  WHERE s.code = _normalized_code
  LIMIT 1;

  IF _seller_id IS NULL THEN RETURN; END IF;

  SELECT id INTO _client_id FROM public.clients WHERE phone = _phone ORDER BY created_at DESC LIMIT 1;

  IF _client_id IS NULL THEN
    INSERT INTO public.clients (phone, name, assigned_seller_id, store_id, status, claimed_at, triaging)
    VALUES (_phone, 'Cliente ' || _phone, _seller_id, _store_id, 'em_atendimento', now(), false)
    RETURNING id INTO _client_id;
  ELSE
    UPDATE public.clients
    SET assigned_seller_id = _seller_id,
        store_id = COALESCE(_store_id, store_id),
        status = 'em_atendimento',
        claimed_at = now(),
        triaging = false
    WHERE id = _client_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.leads WHERE client_phone = _phone) THEN
    UPDATE public.leads
    SET assigned_to = _seller_id,
        store_id = COALESCE(_store_id, store_id),
        updated_at = now()
    WHERE client_phone = _phone;
  ELSE
    INSERT INTO public.leads (client_phone, client_name, assigned_to, stage, store_id, source)
    VALUES (_phone, 'Cliente ' || _phone, _seller_id, 'abordagem', _store_id, 'whatsapp');
  END IF;

  RETURN QUERY SELECT _seller_id, _seller_name, _store_id;
END;
$function$;
