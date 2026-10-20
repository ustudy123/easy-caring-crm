CREATE OR REPLACE FUNCTION public.transfer_attendance(p_seller_id uuid, p_lead_id uuid DEFAULT NULL, p_client_id uuid DEFAULT NULL, p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 v_uid uuid := auth.uid(); v_actor uuid; v_store uuid; v_profile uuid;
 v_admin boolean; v_manager boolean; v_operational boolean;
 v_target public.sellers%ROWTYPE; v_lead public.leads%ROWTYPE; v_client public.clients%ROWTYPE;
 v_phone text; v_previous uuid; v_source_store uuid; v_ids uuid[] := ARRAY[]::uuid[]; r record;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sua sessão expirou. Entre novamente para transferir.' USING ERRCODE='42501'; END IF;
 IF (p_lead_id IS NULL) = (p_client_id IS NULL) THEN RAISE EXCEPTION 'Informe um único atendimento para transferir.' USING ERRCODE='22023'; END IF;
 IF length(coalesce(p_reason,'')) > 2000 THEN RAISE EXCEPTION 'O motivo deve ter até 2000 caracteres.' USING ERRCODE='22023'; END IF;
 v_admin := public.has_role(v_uid,'admin'); v_manager := public.has_role(v_uid,'gerente');
 v_operational := public.has_role(v_uid,'vendedor') OR public.has_role(v_uid,'suporte');
 IF NOT (v_admin OR v_manager OR v_operational) THEN RAISE EXCEPTION 'Sem permissão para transferir atendimentos.' USING ERRCODE='42501'; END IF;
 v_actor := public.get_user_seller_id(v_uid); v_store := public.get_user_store_id(v_uid);
 SELECT id INTO v_profile FROM public.profiles WHERE user_id=v_uid;
 IF v_profile IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
 SELECT * INTO v_target FROM public.sellers WHERE id=p_seller_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vendedor de destino não encontrado.' USING ERRCODE='22023'; END IF;
 IF v_target.is_active IS FALSE OR coalesce(v_target.status,'active') <> 'active' THEN RAISE EXCEPTION 'O vendedor de destino está inativo ou ausente.' USING ERRCODE='22023'; END IF;
 IF p_lead_id IS NOT NULL THEN
   SELECT client_phone INTO v_phone FROM public.leads WHERE id=p_lead_id;
 ELSE
   SELECT phone INTO v_phone FROM public.clients WHERE id=p_client_id;
 END IF;
 IF v_phone IS NULL THEN RAISE EXCEPTION 'Atendimento não encontrado.' USING ERRCODE='22023'; END IF;
 v_phone := regexp_replace(v_phone,'\D','','g');
 IF length(v_phone) IN (12,13) AND left(v_phone,2)='55' THEN v_phone := substr(v_phone,3); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('transfer:' || v_phone,0));
 IF p_client_id IS NOT NULL THEN
   SELECT * INTO v_client FROM public.clients WHERE id=p_client_id FOR UPDATE;
 ELSE
   SELECT * INTO v_client FROM public.clients WHERE
     (CASE WHEN length(regexp_replace(phone,'\D','','g')) IN (12,13) AND left(regexp_replace(phone,'\D','','g'),2)='55' THEN substr(regexp_replace(phone,'\D','','g'),3) ELSE regexp_replace(phone,'\D','','g') END)=v_phone
     ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 END IF;
 IF p_lead_id IS NOT NULL THEN
   SELECT * INTO v_lead FROM public.leads WHERE id=p_lead_id FOR UPDATE;
   v_previous := v_lead.assigned_to; v_source_store := v_lead.store_id;
 ELSE
   v_previous := v_client.assigned_seller_id; v_source_store := v_client.store_id;
 END IF;
 IF NOT (v_admin OR (v_manager AND (v_source_store IS NULL OR v_source_store=v_store)) OR
   (v_operational AND (v_source_store IS NULL OR v_source_store=v_store) AND (v_previous IS NULL OR v_previous=v_actor))) THEN
   RAISE EXCEPTION 'Sem permissão para transferir este atendimento.' USING ERRCODE='42501';
 END IF;
 IF v_client.id IS NOT NULL AND NOT (v_admin OR (v_manager AND (v_client.store_id IS NULL OR v_client.store_id=v_store)) OR
   (v_operational AND (v_client.store_id IS NULL OR v_client.store_id=v_store) AND (v_client.assigned_seller_id IS NULL OR v_client.assigned_seller_id=v_actor))) THEN
   RAISE EXCEPTION 'O cliente está vinculado a outro responsável. Peça a transferência a um administrador.' USING ERRCODE='42501';
 END IF;
 FOR r IN SELECT id,assigned_to,store_id FROM public.leads WHERE id=p_lead_id OR
   (NOT archived AND (CASE WHEN length(regexp_replace(client_phone,'\D','','g')) IN (12,13) AND left(regexp_replace(client_phone,'\D','','g'),2)='55' THEN substr(regexp_replace(client_phone,'\D','','g'),3) ELSE regexp_replace(client_phone,'\D','','g') END)=v_phone) ORDER BY id FOR UPDATE
 LOOP
   IF NOT (v_admin OR (v_manager AND (r.store_id IS NULL OR r.store_id=v_store)) OR
     (v_operational AND (r.store_id IS NULL OR r.store_id=v_store) AND (r.assigned_to IS NULL OR r.assigned_to=v_actor))) THEN
     RAISE EXCEPTION 'Existe outro card deste cliente com outro responsável. Peça ajuda a um administrador.' USING ERRCODE='42501';
   END IF;
   v_ids := array_append(v_ids,r.id);
 END LOOP;
 UPDATE public.leads SET assigned_to=p_seller_id,store_id=coalesce(v_target.store_id,store_id),updated_at=now() WHERE id=ANY(v_ids);
 IF v_client.id IS NOT NULL THEN
   UPDATE public.clients SET assigned_seller_id=p_seller_id,store_id=coalesce(v_target.store_id,store_id),status='em_atendimento',claimed_at=now(),triaging=false,triage_step=NULL WHERE id=v_client.id;
   INSERT INTO public.service_transfers(client_id,from_seller_id,to_seller_id,reason,performed_by)
     VALUES(v_client.id,v_previous,p_seller_id,nullif(btrim(p_reason),''),v_profile);
 END IF;
 INSERT INTO public.redirection_history(client_id,from_seller_id,to_seller_id,redirection_type,reason,performed_by,store_id)
 VALUES(v_client.id,v_previous,p_seller_id,'manual_transfer',coalesce(nullif(btrim(p_reason),''),'Transferência manual'),v_profile,coalesce(v_target.store_id,v_source_store));
 RETURN jsonb_build_object('seller_id',p_seller_id,'store_id',coalesce(v_target.store_id,v_source_store),'client_id',v_client.id,'lead_ids',to_jsonb(v_ids));
END; $$;
REVOKE ALL ON FUNCTION public.transfer_attendance(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_attendance(uuid,uuid,uuid,text) TO authenticated;

-- Regression test with real source/destination identities. The exception rolls
-- back all test writes, including both audit entries, before returning.
DO $$
DECLARE result jsonb; before_client uuid; before_lead uuid; previous_claim text := current_setting('request.jwt.claim.sub',true);
BEGIN
 SELECT assigned_to INTO before_lead FROM public.leads WHERE id='e5ee0d1b-ab20-460c-a359-293efba5df5d';
 SELECT assigned_seller_id INTO before_client FROM public.clients WHERE id='83c26441-e7a2-40ec-a31e-f1753518068e';
 BEGIN
   PERFORM set_config('request.jwt.claim.sub','fc209bb0-1cda-427d-8847-358954eade38',true);
   result := public.transfer_attendance('0a203eb6-4a8e-48e5-a79f-d5b288bbfea9','e5ee0d1b-ab20-460c-a359-293efba5df5d',NULL,'Teste reversível Raquel para Andinho');
   IF (SELECT assigned_to FROM public.leads WHERE id='e5ee0d1b-ab20-460c-a359-293efba5df5d') IS DISTINCT FROM '0a203eb6-4a8e-48e5-a79f-d5b288bbfea9'::uuid THEN RAISE EXCEPTION 'Lead transfer regression'; END IF;
   IF (SELECT assigned_seller_id FROM public.clients WHERE id='83c26441-e7a2-40ec-a31e-f1753518068e') IS DISTINCT FROM '0a203eb6-4a8e-48e5-a79f-d5b288bbfea9'::uuid THEN RAISE EXCEPTION 'Client transfer regression'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.redirection_history WHERE client_id='83c26441-e7a2-40ec-a31e-f1753518068e' AND to_seller_id='0a203eb6-4a8e-48e5-a79f-d5b288bbfea9' AND performed_by=(SELECT id FROM public.profiles WHERE user_id='fc209bb0-1cda-427d-8847-358954eade38') AND reason='Teste reversível Raquel para Andinho') THEN RAISE EXCEPTION 'Audit transfer regression'; END IF;
   RAISE EXCEPTION 'rollback transfer test' USING ERRCODE='PT001';
 EXCEPTION WHEN SQLSTATE 'PT001' THEN NULL;
 END;
 IF (SELECT assigned_to FROM public.leads WHERE id='e5ee0d1b-ab20-460c-a359-293efba5df5d') IS DISTINCT FROM before_lead OR (SELECT assigned_seller_id FROM public.clients WHERE id='83c26441-e7a2-40ec-a31e-f1753518068e') IS DISTINCT FROM before_client THEN RAISE EXCEPTION 'Test rollback failed'; END IF;
 BEGIN
   PERFORM set_config('request.jwt.claim.sub','f0e33e41-2916-4a36-82b6-2714a1ceec66',true);
   PERFORM public.transfer_attendance('0a203eb6-4a8e-48e5-a79f-d5b288bbfea9','e5ee0d1b-ab20-460c-a359-293efba5df5d',NULL,'Unauthorized regression');
   RAISE EXCEPTION 'Unauthorized transfer was accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',coalesce(previous_claim,''),true);
END; $$;