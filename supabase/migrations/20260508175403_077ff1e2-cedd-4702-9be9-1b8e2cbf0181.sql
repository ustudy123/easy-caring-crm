-- Atualizar a função claim_whatsapp_client para incluir log de histórico
CREATE OR REPLACE FUNCTION public.claim_whatsapp_client(
  _phone text,
  _fallback_name text DEFAULT NULL
)
RETURNS TABLE (
  client_id uuid,
  seller_id uuid,
  store_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _auth_user_id uuid := auth.uid();
  _seller_id uuid;
  _store_id uuid;
  _client_id uuid;
  _client_name text;
  _lead_id uuid;
  _profile_id uuid;
  _previous_seller_id uuid;
BEGIN
  IF _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Obter perfil e vendedor
  SELECT p.id, s.id, s.store_id
  INTO _profile_id, _seller_id, _store_id
  FROM public.profiles p
  JOIN public.sellers s ON s.user_id = p.user_id
  WHERE p.user_id = _auth_user_id
  LIMIT 1;

  IF _seller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a um vendedor';
  END IF;

  -- Obter cliente atual (se existir)
  SELECT c.id, c.name, c.assigned_seller_id
  INTO _client_id, _client_name, _previous_seller_id
  FROM public.clients c
  WHERE c.phone = _phone
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF _client_id IS NULL THEN
    INSERT INTO public.clients (
      phone,
      name,
      assigned_seller_id,
      store_id,
      status,
      claimed_at
    ) VALUES (
      _phone,
      COALESCE(NULLIF(_fallback_name, ''), 'Cliente ' || _phone),
      _seller_id,
      _store_id,
      'em_atendimento',
      now()
    )
    RETURNING id, name INTO _client_id, _client_name;
  ELSE
    UPDATE public.clients
    SET assigned_seller_id = _seller_id,
        store_id = _store_id,
        status = 'em_atendimento',
        claimed_at = now()
    WHERE id = _client_id;
  END IF;

  -- Registrar no histórico de redirecionamento
  INSERT INTO public.redirection_history (
    client_id,
    from_seller_id,
    to_seller_id,
    redirection_type,
    reason,
    performed_by,
    store_id
  ) VALUES (
    _client_id,
    _previous_seller_id,
    _seller_id,
    'manual_claim',
    'Vendedor assumiu atendimento manualmente',
    _profile_id,
    _store_id
  );

  -- Atualizar ou criar Lead
  SELECT l.id
  INTO _lead_id
  FROM public.leads l
  WHERE l.client_phone = _phone
  ORDER BY l.created_at DESC
  LIMIT 1;

  IF _lead_id IS NULL THEN
    INSERT INTO public.leads (
      client_phone,
      client_name,
      assigned_to,
      stage,
      store_id,
      source
    ) VALUES (
      _phone,
      COALESCE(_client_name, NULLIF(_fallback_name, ''), 'Cliente ' || _phone),
      _seller_id,
      'abordagem',
      _store_id,
      'whatsapp'
    );
  ELSE
    UPDATE public.leads
    SET assigned_to = _seller_id,
        store_id = _store_id,
        updated_at = now()
    WHERE client_phone = _phone;
  END IF;

  RETURN QUERY SELECT _client_id, _seller_id, _store_id;
END;
$$;