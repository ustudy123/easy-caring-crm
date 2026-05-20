
-- 1) Fix leads UPDATE WITH CHECK to mirror USING (prevent reassignment to other stores/sellers)
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
  AND (store_id = get_user_store_id(auth.uid()))
  AND ((assigned_to = get_user_seller_id(auth.uid())) OR (assigned_to = get_user_seller_id(auth.uid())))
);

-- 2) Restrict service_transfers INSERT policies to authenticated role only
DROP POLICY IF EXISTS "Users can insert their own transfers" ON public.service_transfers;
CREATE POLICY "Users can insert their own transfers"
ON public.service_transfers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = (SELECT profiles.user_id FROM profiles WHERE profiles.id = service_transfers.performed_by)
);

DROP POLICY IF EXISTS "Users can insert transfers" ON public.service_transfers;
CREATE POLICY "Users can insert transfers"
ON public.service_transfers
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR (from_seller_id IN (SELECT sellers.id FROM sellers WHERE sellers.user_id = auth.uid()))
);

-- 3) Explicitly block UPDATE/DELETE on redirection_history to protect audit trail integrity.
-- INSERTs continue to be performed only via SECURITY DEFINER functions / service_role.
CREATE POLICY "Block updates on redirection_history"
ON public.redirection_history
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Block deletes on redirection_history"
ON public.redirection_history
FOR DELETE
TO authenticated, anon
USING (false);
