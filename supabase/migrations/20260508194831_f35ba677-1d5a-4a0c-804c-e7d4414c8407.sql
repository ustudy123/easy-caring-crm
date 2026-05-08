CREATE OR REPLACE FUNCTION public.accept_lead(_lead_id UUID, _seller_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client_phone TEXT;
    v_client_id UUID;
    v_old_seller_id UUID;
BEGIN
    -- Obter dados do lead e do cliente vinculado
    SELECT client_phone, assigned_to INTO v_client_phone, v_old_seller_id
    FROM leads
    WHERE id = _lead_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lead não encontrado');
    END IF;

    -- Obter o ID do cliente pelo telefone (assumindo que o telefone é único e o vínculo existe)
    SELECT id INTO v_client_id
    FROM clients
    WHERE phone = v_client_phone
    LIMIT 1;

    -- Atualizar o lead
    UPDATE leads
    SET assigned_to = _seller_id,
        updated_at = NOW()
    WHERE id = _lead_id;

    -- Atualizar o cliente
    IF v_client_id IS NOT NULL THEN
        UPDATE clients
        SET assigned_seller_id = _seller_id,
            triaging = false,
            triage_step = NULL,
            last_message_at = NOW()
        WHERE id = v_client_id;

        -- Registrar no histórico de redirecionamento
        INSERT INTO redirection_history (
            client_id,
            from_seller_id,
            to_seller_id,
            redirection_type,
            reason,
            performed_by
        ) VALUES (
            v_client_id,
            v_old_seller_id,
            _seller_id,
            'manual_take',
            'Vendedor assumiu o atendimento manualmente',
            auth.uid()
        );
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;