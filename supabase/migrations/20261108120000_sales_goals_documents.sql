-- Fase 7: metas mensais (orçamento e venda) com dias úteis, e orçamentos e
-- notas fiscais em PDF lidos por IA, para o painel da equipe externa.

-- ── Dias úteis do mês (o gestor informa; o app sugere seg–sex menos feriados) ──
CREATE TABLE IF NOT EXISTS public.month_business_days (
  month date PRIMARY KEY,
  business_days integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT month_business_days_first_day CHECK (extract(day FROM month) = 1),
  CONSTRAINT month_business_days_range CHECK (business_days BETWEEN 1 AND 31)
);
ALTER TABLE public.month_business_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read business days" ON public.month_business_days;
CREATE POLICY "Authenticated read business days" ON public.month_business_days
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin manages business days" ON public.month_business_days;
CREATE POLICY "Admin manages business days" ON public.month_business_days
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS month_business_days_updated_at ON public.month_business_days;
CREATE TRIGGER month_business_days_updated_at
  BEFORE UPDATE ON public.month_business_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Metas do mês por vendedor (R$) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monthly_goals (
  month date NOT NULL,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  quote_goal numeric(14, 2),
  sales_goal numeric(14, 2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (month, seller_id),
  CONSTRAINT monthly_goals_first_day CHECK (extract(day FROM month) = 1),
  CONSTRAINT monthly_goals_values CHECK (coalesce(quote_goal, 0) >= 0 AND coalesce(sales_goal, 0) >= 0)
);
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read visible monthly goals" ON public.monthly_goals;
CREATE POLICY "Read visible monthly goals" ON public.monthly_goals
  FOR SELECT TO authenticated USING (public.can_view_seller(seller_id));
DROP POLICY IF EXISTS "Admin manages monthly goals" ON public.monthly_goals;
CREATE POLICY "Admin manages monthly goals" ON public.monthly_goals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS monthly_goals_updated_at ON public.monthly_goals;
CREATE TRIGGER monthly_goals_updated_at
  BEFORE UPDATE ON public.monthly_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Orçamentos e notas fiscais ────────────────────────────────────────────────
-- Quem cuida dos documentos de um vendedor: ele mesmo, o gerente da loja, o
-- admin e o suporte (que também sobe orçamento e nota).
CREATE OR REPLACE FUNCTION public.can_manage_sales_documents(_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _seller_id IS NOT NULL
     AND (public.has_role(auth.uid(), 'suporte') OR public.can_view_seller(_seller_id));
$$;

CREATE TABLE IF NOT EXISTS public.sales_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  support_request_id uuid REFERENCES public.pricing_support_requests(id) ON DELETE SET NULL,
  storage_bucket text NOT NULL DEFAULT 'sales-documents',
  storage_path text NOT NULL,
  file_name text,
  document_number text,
  client_name text,
  client_document text,
  total_value numeric(14, 2),
  issue_date date,
  expected_close_date date,
  installments jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  ai_status text NOT NULL DEFAULT 'pending',
  ai_extracted jsonb,
  ai_model text,
  ai_error text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_documents_kind CHECK (kind IN ('quote', 'invoice')),
  CONSTRAINT sales_documents_bucket CHECK (storage_bucket IN ('sales-documents', 'pricing_attachments')),
  CONSTRAINT sales_documents_ai_status CHECK (ai_status IN ('pending', 'done', 'failed')),
  CONSTRAINT sales_documents_total CHECK (total_value IS NULL OR total_value >= 0),
  CONSTRAINT sales_documents_installments CHECK (jsonb_typeof(installments) = 'array'),
  CONSTRAINT sales_documents_close_date_quote CHECK (kind = 'quote' OR expected_close_date IS NULL)
);
CREATE INDEX IF NOT EXISTS sales_documents_seller_issue_idx ON public.sales_documents (seller_id, kind, issue_date);
CREATE INDEX IF NOT EXISTS sales_documents_number_idx ON public.sales_documents (kind, document_number);
-- Um orçamento por resposta do suporte (a resposta pode ser regravada).
CREATE UNIQUE INDEX IF NOT EXISTS sales_documents_support_request_uidx
  ON public.sales_documents (support_request_id) WHERE support_request_id IS NOT NULL;

ALTER TABLE public.sales_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Manage visible sales documents" ON public.sales_documents;
CREATE POLICY "Manage visible sales documents" ON public.sales_documents
  FOR ALL TO authenticated
  USING (public.can_manage_sales_documents(seller_id))
  WITH CHECK (public.can_manage_sales_documents(seller_id));

DROP TRIGGER IF EXISTS sales_documents_updated_at ON public.sales_documents;
CREATE TRIGGER sales_documents_updated_at
  BEFORE UPDATE ON public.sales_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Arquivos: bucket privado, uma pasta por vendedor ({seller_id}/arquivo.pdf) ─
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sales-documents', 'sales-documents', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

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
  IF v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  RETURN public.can_manage_sales_documents(v_folder::uuid);
END;
$$;

DROP POLICY IF EXISTS "sales_documents_files_insert" ON storage.objects;
CREATE POLICY "sales_documents_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sales-documents' AND public.can_manage_sales_document_path(name));
DROP POLICY IF EXISTS "sales_documents_files_select" ON storage.objects;
CREATE POLICY "sales_documents_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sales-documents' AND public.can_manage_sales_document_path(name));
DROP POLICY IF EXISTS "sales_documents_files_delete" ON storage.objects;
CREATE POLICY "sales_documents_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sales-documents' AND public.can_manage_sales_document_path(name));

-- ── Vendas concluídas do período (inclui as arquivadas como recorrente) ──────
-- O painel confere quais passaram pelo funil completo (qualificação inteira).
CREATE OR REPLACE FUNCTION public.get_closed_sales(_from timestamptz, _to timestamptz)
RETURNS SETOF public.leads
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
    FROM public.leads l
   WHERE l.closed_at >= _from
     AND l.closed_at < _to
     AND l.lost_reason IS NULL
     AND l.stage <> 'perdido'
     AND public.can_view_seller(l.assigned_to)
   ORDER BY l.closed_at;
$$;

REVOKE ALL ON FUNCTION public.get_closed_sales(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_closed_sales(timestamptz, timestamptz) TO authenticated;
