-- Reforço no backend da regra de vínculo de vendedor em leads.
--
-- A RLS de leads não impedia a troca do vendedor: no INSERT ela só valida
-- papel + loja (não o assigned_to), e no UPDATE o WITH CHECK também não impede
-- alterar o assigned_to. Ou seja, um vendedor poderia, via API, criar um lead
-- vinculado a outro vendedor ou "passar" um lead adiante — contornando a trava
-- que já existe na interface.
--
-- Este trigger fecha isso APENAS para vendedores:
--   - INSERT: o lead é sempre vinculado ao próprio vendedor.
--   - UPDATE: o assigned_to é preservado (não pode reatribuir).
--
-- Admin, gerente e suporte não são afetados (seguem controlados pela RLS).
-- A triagem/distribuição automática roda como service role (auth.uid() nulo),
-- então também não é afetada — continua atribuindo leads normalmente.

CREATE OR REPLACE FUNCTION public.enforce_lead_seller_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_seller uuid;
BEGIN
  -- Só se aplica a vendedores autenticados.
  IF NOT public.has_role(auth.uid(), 'vendedor') THEN
    RETURN NEW;
  END IF;

  my_seller := public.get_user_seller_id(auth.uid());

  IF TG_OP = 'INSERT' THEN
    -- Vendedor sempre cria o lead vinculado a si mesmo.
    IF my_seller IS NOT NULL THEN
      NEW.assigned_to := my_seller;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Vendedor não pode alterar o vendedor de um lead já existente.
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      NEW.assigned_to := OLD.assigned_to;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lead_seller_assignment ON public.leads;
CREATE TRIGGER trg_enforce_lead_seller_assignment
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lead_seller_assignment();
