-- Permite que vendedores visualizem outros vendedores da mesma loja
-- Isso é necessário para que a lista de substitutos apareça corretamente
CREATE POLICY "Sellers can read colleagues in same store"
ON public.sellers
FOR SELECT
TO authenticated
USING (
  store_id IS NOT NULL 
  AND store_id = public.get_user_store_id(auth.uid())
);