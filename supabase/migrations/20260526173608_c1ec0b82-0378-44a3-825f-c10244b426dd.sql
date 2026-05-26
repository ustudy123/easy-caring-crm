
-- 1) Fix seller self-update to prevent store_id escalation
DROP POLICY IF EXISTS "Seller can update own profile" ON public.sellers;

CREATE POLICY "Seller can update own profile"
ON public.sellers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (store_id IS NOT DISTINCT FROM public.get_user_store_id(auth.uid()))
);

-- 2) Restrict service_transfers INSERT to clients in the seller's own store
DROP POLICY IF EXISTS "Users can insert transfers" ON public.service_transfers;

CREATE POLICY "Users can insert transfers"
ON public.service_transfers
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gerente'::app_role)
  OR (
    from_seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = service_transfers.client_id
        AND c.store_id = public.get_user_store_id(auth.uid())
    )
  )
);
