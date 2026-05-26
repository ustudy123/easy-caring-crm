-- Permitir que usuários com funções válidas vejam todos os vendedores para possibilitar transferência entre lojas
CREATE POLICY "Authenticated roles can read all sellers for transfer"
ON public.sellers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
  OR has_role(auth.uid(), 'suporte'::app_role)
);