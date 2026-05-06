-- 1. Update distribution logic to only include 'active' status
DROP FUNCTION IF EXISTS public.get_next_seller_for_distribution(uuid);
CREATE OR REPLACE FUNCTION public.get_next_seller_for_distribution(_store_id UUID)
RETURNS SETOF public.sellers AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.sellers
    WHERE 
        status = 'active'
        AND is_active = true 
        AND is_available = true
        AND (
            (_store_id IS NULL AND store_id IS NULL) -- General queue (no store)
            OR 
            (_store_id IS NOT NULL AND store_id = _store_id) -- Store specific queue
        )
    ORDER BY last_assigned_at ASC NULLS FIRST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 2. Create function to handle assignment with redirection logic
CREATE OR REPLACE FUNCTION public.assign_client_with_redirection(
    _phone TEXT,
    _seller_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_target_id UUID;
    v_status TEXT;
    v_substitute_id UUID;
    v_client_id UUID;
    v_seller_name TEXT;
    v_store_id UUID;
BEGIN
    -- Get original seller info
    SELECT status, substitute_id, name, store_id 
    INTO v_status, v_substitute_id, v_seller_name, v_store_id
    FROM public.sellers
    WHERE id = _seller_id;

    -- Get client
    SELECT id INTO v_client_id FROM public.clients WHERE phone = _phone ORDER BY created_at DESC LIMIT 1;

    -- Redirection logic
    IF v_status = 'active' THEN
        v_target_id := _seller_id;
    ELSIF v_substitute_id IS NOT NULL THEN
        v_target_id := v_substitute_id;
        
        -- Get substitute name and store
        SELECT name, store_id INTO v_seller_name, v_store_id FROM public.sellers WHERE id = v_target_id;

        -- Log redirection
        IF v_client_id IS NOT NULL THEN
            INSERT INTO public.lead_redirections (client_id, original_seller_id, redirected_to_seller_id, reason)
            VALUES (v_client_id, _seller_id, v_target_id, 'seller_' || v_status);
        END IF;
    ELSE
        -- No substitute and not active: return NULL to indicate queue fallback
        RETURN jsonb_build_object('success', false, 'reason', 'no_active_seller_or_substitute');
    END IF;

    -- Perform assignment
    IF v_client_id IS NULL THEN
        INSERT INTO public.clients (phone, name, assigned_seller_id, store_id, status, claimed_at, triaging, triage_step)
        VALUES (_phone, 'Cliente ' || _phone, v_target_id, v_store_id, 'em_atendimento', now(), false, NULL)
        RETURNING id INTO v_client_id;
    ELSE
        UPDATE public.clients
        SET assigned_seller_id = v_target_id,
            store_id = COALESCE(v_store_id, store_id),
            status = 'em_atendimento',
            claimed_at = now(),
            triaging = false,
            triage_step = NULL
        WHERE id = v_client_id;
    END IF;

    -- Update or insert lead
    IF EXISTS (SELECT 1 FROM public.leads WHERE client_phone = _phone) THEN
        UPDATE public.leads
        SET assigned_to = v_target_id,
            store_id = COALESCE(v_store_id, store_id),
            updated_at = now()
        WHERE client_phone = _phone;
    ELSE
        INSERT INTO public.leads (client_phone, client_name, assigned_to, stage, store_id, source)
        VALUES (_phone, 'Cliente ' || _phone, v_target_id, 'abordagem', v_store_id, 'whatsapp');
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'seller_id', v_target_id, 
        'seller_name', v_seller_name, 
        'store_id', v_store_id,
        'was_redirected', (v_target_id != _seller_id)
    );
END;
$$ LANGUAGE plpgsql;

-- 3. Update assign_client_by_seller_code to use the redirection logic
DROP FUNCTION IF EXISTS public.assign_client_by_seller_code(text,text);
CREATE OR REPLACE FUNCTION public.assign_client_by_seller_code(
  _phone text,
  _code text
) RETURNS TABLE(id uuid, name text, store_id uuid) AS $$
DECLARE
  _seller_id uuid;
  _result jsonb;
BEGIN
  SELECT s.id INTO _seller_id
  FROM public.sellers s
  WHERE s.code = TRIM(_code)
  LIMIT 1;

  IF _seller_id IS NULL THEN RETURN; END IF;

  -- Use redirection logic
  SELECT public.assign_client_with_redirection(_phone, _seller_id) INTO _result;

  IF (_result->>'success')::boolean = true THEN
    RETURN QUERY SELECT 
        (_result->>'seller_id')::uuid, 
        (_result->>'seller_name')::text, 
        (_result->>'store_id')::uuid;
  ELSE
    -- If no substitute, we return NULL so the caller (edge function) can fallback to queue
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql;
