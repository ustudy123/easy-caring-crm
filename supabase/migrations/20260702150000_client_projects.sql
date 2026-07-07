-- Projetos por cliente: um mesmo cliente pode ter vários projetos/negociações,
-- cada um em uma etapa diferente do funil.
CREATE TABLE IF NOT EXISTS public.client_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_phone text NOT NULL,
  client_name text,
  name text NOT NULL,
  stage text NOT NULL DEFAULT 'abordagem',
  notes text,
  seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_projects_phone ON public.client_projects (client_phone);

ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_projects TO authenticated;
GRANT ALL ON public.client_projects TO service_role;

DROP POLICY IF EXISTS "auth read projects" ON public.client_projects;
CREATE POLICY "auth read projects" ON public.client_projects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth manage projects" ON public.client_projects;
CREATE POLICY "auth manage projects" ON public.client_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
