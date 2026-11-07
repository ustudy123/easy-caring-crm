-- Fase 6a: rotina de visitas da equipe externa e meta trimestral de clientes novos.
-- Metas por vendedor (o André pediu variável por vendedor): visitas planejadas e
-- realizadas por semana e clientes novos por trimestre.

-- Quem pode ver os números de um vendedor: admin vê todos, gerente vê os da
-- própria loja e o vendedor vê os próprios.
CREATE OR REPLACE FUNCTION public.can_view_seller(_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _seller_id IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR _seller_id = public.get_user_seller_id(auth.uid())
    OR (
      public.has_role(auth.uid(), 'gerente')
      AND EXISTS (
        SELECT 1 FROM public.sellers s
         WHERE s.id = _seller_id
           AND s.store_id = public.get_user_store_id(auth.uid())
      )
    )
  );
$$;

CREATE TABLE IF NOT EXISTS public.seller_goals (
  seller_id uuid PRIMARY KEY REFERENCES public.sellers(id) ON DELETE CASCADE,
  weekly_visits_planned integer NOT NULL DEFAULT 10,
  weekly_visits_done integer NOT NULL DEFAULT 5,
  quarterly_new_clients integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT seller_goals_visits_range
    CHECK (weekly_visits_planned BETWEEN 0 AND 100 AND weekly_visits_done BETWEEN 0 AND 100),
  CONSTRAINT seller_goals_done_le_planned CHECK (weekly_visits_done <= weekly_visits_planned),
  CONSTRAINT seller_goals_new_clients_range
    CHECK (quarterly_new_clients IS NULL OR quarterly_new_clients BETWEEN 0 AND 1000)
);

ALTER TABLE public.seller_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read visible seller goals" ON public.seller_goals;
CREATE POLICY "Read visible seller goals" ON public.seller_goals
  FOR SELECT TO authenticated
  USING (public.can_view_seller(seller_id));

DROP POLICY IF EXISTS "Admin manages seller goals" ON public.seller_goals;
CREATE POLICY "Admin manages seller goals" ON public.seller_goals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS seller_goals_updated_at ON public.seller_goals;
CREATE TRIGGER seller_goals_updated_at
  BEFORE UPDATE ON public.seller_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Visitas do período por vendedor: planejadas = visitas agendadas no período,
-- realizadas = as que o vendedor confirmou (concluídas). Conta pela data agendada.
CREATE OR REPLACE FUNCTION public.get_visit_progress(_from timestamptz, _to timestamptz)
RETURNS TABLE (seller_id uuid, planned integer, done integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.assigned_to,
         count(*)::integer,
         (count(*) FILTER (WHERE f.completed))::integer
    FROM public.follow_ups f
   WHERE f.type = 'visit'
     AND f.assigned_to IS NOT NULL
     AND f.scheduled_at >= _from
     AND f.scheduled_at < _to
     AND public.can_view_seller(f.assigned_to)
   GROUP BY f.assigned_to;
$$;

-- Clientes novos do período: venda cujo cliente (telefone) não tem nenhuma venda
-- anterior em todo o histórico do CRM, de qualquer vendedor. Cliente que volta a
-- comprar não conta. Venda = lead encerrado sem motivo de perda.
CREATE OR REPLACE FUNCTION public.get_new_clients(_from timestamptz, _to timestamptz)
RETURNS TABLE (
  seller_id uuid,
  lead_id uuid,
  client_name text,
  client_phone text,
  closed_at timestamptz,
  value numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales AS (
    SELECT l.id, l.assigned_to, l.client_name, l.client_phone, l.closed_at, l.value,
           regexp_replace(regexp_replace(coalesce(l.client_phone, ''), '\D', '', 'g'), '^55', '') AS digits
      FROM public.leads l
     WHERE l.closed_at IS NOT NULL
       AND l.lost_reason IS NULL
       AND l.stage <> 'perdido'
  ),
  firsts AS (
    SELECT DISTINCT ON (digits) *
      FROM sales
     WHERE digits <> ''
     ORDER BY digits, closed_at, id
  )
  SELECT f.assigned_to, f.id, f.client_name, f.client_phone, f.closed_at, f.value::numeric
    FROM firsts f
   WHERE f.closed_at >= _from
     AND f.closed_at < _to
     AND public.can_view_seller(f.assigned_to)
   ORDER BY f.closed_at;
$$;

REVOKE ALL ON FUNCTION public.get_visit_progress(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_new_clients(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visit_progress(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_new_clients(timestamptz, timestamptz) TO authenticated;
