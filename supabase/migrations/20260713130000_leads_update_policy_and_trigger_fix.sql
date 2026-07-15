-- 1) Corrige o erro "new row violates row-level security policy for table leads"
--    ao reagendar/atualizar um lead.
--
--    A policy ativa (20260520183552) dizia espelhar o USING, mas não espelhava:
--      USING      : store_id = minha loja OR store_id IS NULL
--      WITH CHECK : store_id = minha loja            <- sem o "OR IS NULL"
--    Resultado: lead SEM loja (todo lead criado pelo formulário nasce com
--    store_id NULL) passava na leitura e falhava na gravação. O vendedor não
--    conseguia atualizar esses leads de jeito nenhum (reagendar, mover etapa...).
--
--    O WITH CHECK também tinha um copy/paste: (assigned_to = X OR assigned_to = X),
--    que impedia manter um lead sem dono. Agora espelha o USING de verdade.

DROP POLICY IF EXISTS "Seller can update own or unassigned leads" ON public.leads;
CREATE POLICY "Seller can update own or unassigned leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role))
  AND ((store_id = get_user_store_id(auth.uid())) OR (store_id IS NULL))
  AND ((assigned_to = get_user_seller_id(auth.uid())) OR (assigned_to IS NULL))
)
WITH CHECK (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role))
  AND ((store_id = get_user_store_id(auth.uid())) OR (store_id IS NULL))
  AND ((assigned_to = get_user_seller_id(auth.uid())) OR (assigned_to IS NULL))
);

-- 2) Restringe o trigger de vínculo de vendedor ao INSERT.
--
--    A versão anterior também travava o UPDATE (preservando assigned_to), o que
--    quebrava silenciosamente dois fluxos legítimos do app, ambos feitos por
--    UPDATE do próprio vendedor:
--      - "Assumir lead" (RPC accept_lead): é SECURITY DEFINER, mas auth.uid()
--        continua sendo o vendedor, então o trigger revertia a atribuição.
--      - "Transferir lead": atribui o lead a outro vendedor de propósito.
--
--    No INSERT a regra continua valendo: vendedor cria lead sempre vinculado a
--    si mesmo. A proteção na edição segue pela interface (campo travado).

CREATE OR REPLACE FUNCTION public.enforce_lead_seller_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_seller uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'vendedor') THEN
    RETURN NEW;
  END IF;

  my_seller := public.get_user_seller_id(auth.uid());

  IF my_seller IS NOT NULL THEN
    NEW.assigned_to := my_seller;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lead_seller_assignment ON public.leads;
CREATE TRIGGER trg_enforce_lead_seller_assignment
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lead_seller_assignment();
