-- Fase 7, ajuste pedido pelo André: importação em lote de orçamentos e notas,
-- com DE-PARA documento → vendedor e confirmação do gestor da equipe externa
-- (gerente da loja) ou do admin. Todo documento, inclusive o enviado pelo
-- próprio vendedor, só conta nas metas depois de confirmado.

-- ── Texto normalizado (sem acento, maiúsculo, só letras e números) ───────────
CREATE OR REPLACE FUNCTION public.norm_text(_s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(btrim(regexp_replace(upper(translate(coalesce(_s, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')), '[^A-Z0-9]+', ' ', 'g')), '');
$$;

CREATE OR REPLACE FUNCTION public.digits_only(_s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(regexp_replace(coalesce(_s, ''), '\D', '', 'g'), '');
$$;

-- ── Quem importa e quem confirma ──────────────────────────────────────────────
-- Gerente de loja da equipe externa (o "Gestor de Vendas Externas").
CREATE OR REPLACE FUNCTION public.is_external_team_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'gerente')
     AND EXISTS (SELECT 1 FROM public.stores s
                  WHERE s.id = public.get_user_store_id(auth.uid()) AND s.is_external_team);
$$;

-- Documento ainda sem vendedor (importado em lote): admin, suporte e gestor da
-- equipe externa. Com vendedor: como antes (ele mesmo, gerente da loja, admin, suporte).
CREATE OR REPLACE FUNCTION public.can_manage_sales_documents(_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _seller_id IS NULL THEN
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'suporte') OR public.is_external_team_manager()
    ELSE
      public.has_role(auth.uid(), 'suporte') OR public.can_view_seller(_seller_id)
  END;
$$;

-- Confirmar (e definir o vendedor de) um documento: admin, ou gerente da loja do vendedor.
CREATE OR REPLACE FUNCTION public.can_confirm_sales_document(_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _seller_id IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'gerente') AND EXISTS (
      SELECT 1 FROM public.sellers s WHERE s.id = _seller_id AND s.store_id = public.get_user_store_id(auth.uid())
    ))
  );
$$;

-- ── Colunas novas ─────────────────────────────────────────────────────────────
ALTER TABLE public.sales_documents ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE public.sales_documents
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS suggested_seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_match text,
  ADD COLUMN IF NOT EXISTS extracted_seller_name text,
  ADD COLUMN IF NOT EXISTS possible_duplicate_of uuid REFERENCES public.sales_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

DO $$
BEGIN
  ALTER TABLE public.sales_documents ADD CONSTRAINT sales_documents_review_status CHECK (review_status IN ('pending', 'confirmed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.sales_documents ADD CONSTRAINT sales_documents_confirmed_has_seller CHECK (review_status = 'pending' OR seller_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.sales_documents ADD CONSTRAINT sales_documents_seller_match CHECK (seller_match IS NULL OR seller_match IN ('representante', 'historico', 'carteira', 'card', 'nenhum'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS sales_documents_review_idx ON public.sales_documents (review_status, kind);
CREATE INDEX IF NOT EXISTS sales_documents_hash_idx ON public.sales_documents (file_hash);

-- Os documentos que já existiam (enviados antes desta regra) ficam confirmados.
UPDATE public.sales_documents SET review_status = 'confirmed'
 WHERE review_status = 'pending' AND seller_id IS NOT NULL AND confirmed_at IS NULL AND created_at < '2026-11-10 13:00:00-03';

-- ── Regras de confirmação (no banco, valem para qualquer tela) ────────────────
CREATE OR REPLACE FUNCTION public.guard_sales_document_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Funções do servidor (chave de serviço) só leem o PDF e sugerem o vendedor.
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'INSERT' THEN NEW.review_status := 'pending'; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.review_status := 'pending';
    NEW.confirmed_by := NULL;
    NEW.confirmed_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.review_status = 'confirmed' AND OLD.review_status = 'pending' THEN
    IF NOT public.can_confirm_sales_document(NEW.seller_id) THEN
      RAISE EXCEPTION 'Só o gestor da equipe externa ou o admin confirma documentos.' USING ERRCODE = '42501';
    END IF;
    NEW.confirmed_by := auth.uid();
    NEW.confirmed_at := now();
    RETURN NEW;
  END IF;

  -- Mexer no que conta na meta de um documento confirmado volta para conferência,
  -- a não ser que quem mexe possa confirmar.
  IF OLD.review_status = 'confirmed'
     AND (NEW.seller_id, NEW.kind, NEW.total_value, NEW.issue_date)
         IS DISTINCT FROM (OLD.seller_id, OLD.kind, OLD.total_value, OLD.issue_date)
     AND NOT public.can_confirm_sales_document(NEW.seller_id) THEN
    NEW.review_status := 'pending';
    NEW.confirmed_by := NULL;
    NEW.confirmed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_documents_review_guard ON public.sales_documents;
CREATE TRIGGER sales_documents_review_guard
  BEFORE INSERT OR UPDATE ON public.sales_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_sales_document_review();

-- ── DE-PARA cliente → vendedor, aprendido a cada confirmação ──────────────────
CREATE TABLE IF NOT EXISTS public.client_seller_map (
  client_key text PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  client_label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.client_seller_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers read client seller map" ON public.client_seller_map;
CREATE POLICY "Managers read client seller map" ON public.client_seller_map
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_external_team_manager());

CREATE OR REPLACE FUNCTION public.learn_client_seller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc text := public.digits_only(NEW.client_document);
  v_name text := public.norm_text(NEW.client_name);
BEGIN
  IF NEW.review_status <> 'confirmed' OR NEW.seller_id IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND OLD.review_status = 'confirmed'
     AND OLD.seller_id IS NOT DISTINCT FROM NEW.seller_id
     AND OLD.client_document IS NOT DISTINCT FROM NEW.client_document
     AND OLD.client_name IS NOT DISTINCT FROM NEW.client_name THEN
    RETURN NULL;
  END IF;
  IF v_doc IS NOT NULL AND length(v_doc) >= 11 THEN
    INSERT INTO public.client_seller_map (client_key, seller_id, client_label, updated_by)
    VALUES ('doc:' || v_doc, NEW.seller_id, NEW.client_name, auth.uid())
    ON CONFLICT (client_key) DO UPDATE SET seller_id = EXCLUDED.seller_id, client_label = EXCLUDED.client_label,
      updated_at = now(), updated_by = EXCLUDED.updated_by;
  END IF;
  IF v_name IS NOT NULL THEN
    INSERT INTO public.client_seller_map (client_key, seller_id, client_label, updated_by)
    VALUES ('nome:' || v_name, NEW.seller_id, NEW.client_name, auth.uid())
    ON CONFLICT (client_key) DO UPDATE SET seller_id = EXCLUDED.seller_id, client_label = EXCLUDED.client_label,
      updated_at = now(), updated_by = EXCLUDED.updated_by;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sales_documents_learn_client_seller ON public.sales_documents;
CREATE TRIGGER sales_documents_learn_client_seller
  AFTER INSERT OR UPDATE ON public.sales_documents
  FOR EACH ROW EXECUTE FUNCTION public.learn_client_seller();

-- ── Sugestão do vendedor e aviso de possível duplicata ───────────────────────
-- Ordem: nome do representante no PDF (SAR/vendedor) → DE-PARA pelo CNPJ →
-- carteira de clientes do CRM pelo CNPJ → DE-PARA pelo nome → card com o mesmo
-- nome de cliente. Só sugere quando a pista aponta para um único vendedor.
CREATE OR REPLACE FUNCTION public.suggest_sales_document_seller(_doc_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.sales_documents%ROWTYPE;
  v_rep text;
  v_doc text;
  v_name text;
  v_seller uuid;
  v_match text := 'nenhum';
  v_dup uuid;
BEGIN
  SELECT * INTO d FROM public.sales_documents WHERE id = _doc_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_sales_documents(d.seller_id) THEN
    RAISE EXCEPTION 'Sem permissão para este documento' USING ERRCODE = '42501';
  END IF;

  v_rep := public.norm_text(d.extracted_seller_name);
  v_doc := public.digits_only(d.client_document);
  v_name := public.norm_text(d.client_name);

  -- 1) Representante/vendedor escrito no documento (vendedores ativos da equipe externa).
  IF v_rep IS NOT NULL THEN
    SELECT CASE WHEN count(*) = 1 THEN min(s.id::text)::uuid END INTO v_seller
      FROM public.sellers s JOIN public.stores st ON st.id = s.store_id
     WHERE st.is_external_team AND coalesce(s.is_active, true) AND coalesce(s.status, 'active') <> 'inactive'
       AND public.norm_text(s.name) IS NOT NULL
       AND (public.norm_text(s.name) = v_rep
            OR v_rep LIKE public.norm_text(s.name) || ' %'
            OR public.norm_text(s.name) LIKE v_rep || ' %'
            OR split_part(public.norm_text(s.name), ' ', 1) = split_part(v_rep, ' ', 1));
    IF v_seller IS NOT NULL THEN v_match := 'representante'; END IF;
  END IF;

  -- 2) DE-PARA aprendido pelo CNPJ.
  IF v_seller IS NULL AND v_doc IS NOT NULL THEN
    SELECT m.seller_id INTO v_seller FROM public.client_seller_map m WHERE m.client_key = 'doc:' || v_doc;
    IF v_seller IS NOT NULL THEN v_match := 'historico'; END IF;
  END IF;

  -- 3) Carteira do CRM: cliente com o mesmo CNPJ e vendedor responsável.
  IF v_seller IS NULL AND v_doc IS NOT NULL THEN
    SELECT CASE WHEN count(DISTINCT c.assigned_seller_id) = 1 THEN min(c.assigned_seller_id::text)::uuid END INTO v_seller
      FROM public.clients c
     WHERE public.digits_only(c.cpf_cnpj) = v_doc AND c.assigned_seller_id IS NOT NULL;
    IF v_seller IS NOT NULL THEN v_match := 'carteira'; END IF;
  END IF;

  -- 4) DE-PARA aprendido pelo nome do cliente.
  IF v_seller IS NULL AND v_name IS NOT NULL THEN
    SELECT m.seller_id INTO v_seller FROM public.client_seller_map m WHERE m.client_key = 'nome:' || v_name;
    IF v_seller IS NOT NULL THEN v_match := 'historico'; END IF;
  END IF;

  -- 5) Card de cliente com o mesmo nome, de um único vendedor.
  IF v_seller IS NULL AND v_name IS NOT NULL THEN
    SELECT CASE WHEN count(DISTINCT l.assigned_to) = 1 THEN min(l.assigned_to::text)::uuid END INTO v_seller
      FROM public.leads l
     WHERE public.norm_text(l.client_name) = v_name AND l.assigned_to IS NOT NULL;
    IF v_seller IS NOT NULL THEN v_match := 'card'; END IF;
  END IF;

  -- Possível duplicata: mesmo arquivo, ou mesmo tipo + cliente + valor.
  SELECT o.id INTO v_dup FROM public.sales_documents o
   WHERE o.id <> d.id AND o.kind = d.kind
     AND ((d.file_hash IS NOT NULL AND o.file_hash = d.file_hash)
          OR (d.total_value IS NOT NULL AND o.total_value = d.total_value
              AND (public.digits_only(o.client_document) = v_doc OR public.norm_text(o.client_name) = v_name)))
   ORDER BY o.created_at
   LIMIT 1;

  UPDATE public.sales_documents
     SET suggested_seller_id = v_seller,
         seller_match = v_match,
         possible_duplicate_of = v_dup,
         -- Sem vendedor definido ainda: o sugerido já fica como vendedor do
         -- documento (pendente), para o gestor só confirmar.
         seller_id = CASE WHEN review_status = 'pending' AND seller_id IS NULL THEN v_seller ELSE seller_id END
   WHERE id = d.id;
  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.suggest_sales_document_seller(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_sales_document_seller(uuid) TO authenticated, service_role;

-- ── Arquivos importados em lote: pasta "importacao/" ─────────────────────────
CREATE OR REPLACE FUNCTION public.can_manage_sales_document_path(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder text := split_part(_name, '/', 1);
BEGIN
  IF v_folder = 'importacao' THEN
    -- Quem importa, ou quem cuida do vendedor a que o documento foi atribuído.
    RETURN public.can_manage_sales_documents(NULL) OR EXISTS (
      SELECT 1 FROM public.sales_documents sd
       WHERE sd.storage_bucket = 'sales-documents' AND sd.storage_path = _name
         AND sd.seller_id IS NOT NULL AND public.can_manage_sales_documents(sd.seller_id)
    );
  END IF;
  IF v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  RETURN public.can_manage_sales_documents(v_folder::uuid);
END;
$$;
