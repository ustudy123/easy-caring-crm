CREATE POLICY "Seller can update own profile"
ON public.sellers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());