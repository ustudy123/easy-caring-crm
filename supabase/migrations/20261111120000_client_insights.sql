-- Fase 8: Clientes Recorrentes detalhados. Histórico do cliente para o detalhe:
-- todas as oportunidades (cards) dele, inclusive arquivadas como recorrente, e as
-- notas fiscais confirmadas pelo CNPJ. SECURITY INVOKER: cada um vê só o que a
-- RLS já permite (vendedor os próprios cards, gerente a loja, admin tudo).

CREATE OR REPLACE FUNCTION public.get_client_leads(_client_id uuid)
RETURNS SETOF public.leads
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT l.*
    FROM public.leads l
    JOIN public.clients c ON c.id = _client_id
   WHERE public.digits_only(c.phone) IS NOT NULL
     AND regexp_replace(public.digits_only(l.client_phone), '^55', '') = regexp_replace(public.digits_only(c.phone), '^55', '')
   ORDER BY l.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_client_invoices(_client_id uuid)
RETURNS SETOF public.sales_documents
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT d.*
    FROM public.sales_documents d
    JOIN public.clients c ON c.id = _client_id
   WHERE d.kind = 'invoice'
     AND d.review_status = 'confirmed'
     AND length(coalesce(public.digits_only(c.cpf_cnpj), '')) >= 11
     AND public.digits_only(d.client_document) = public.digits_only(c.cpf_cnpj)
   ORDER BY d.issue_date DESC;
$$;

REVOKE ALL ON FUNCTION public.get_client_leads(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_client_invoices(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_leads(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_invoices(uuid) TO authenticated;
