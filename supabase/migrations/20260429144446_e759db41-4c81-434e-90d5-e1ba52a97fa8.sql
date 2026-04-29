-- Drop existing policies to recreate them with the fix
DROP POLICY IF EXISTS "Gerente can read store clients" ON public.clients;
DROP POLICY IF EXISTS "Gerente can manage store clients" ON public.clients;
DROP POLICY IF EXISTS "Seller can read own or unassigned clients" ON public.clients;
DROP POLICY IF EXISTS "Seller can insert clients in store" ON public.clients;
DROP POLICY IF EXISTS "Seller can update own clients" ON public.clients;

DROP POLICY IF EXISTS "Gerente can manage store leads" ON public.leads;
DROP POLICY IF EXISTS "Seller can read own or unassigned leads" ON public.leads;
DROP POLICY IF EXISTS "Seller can insert leads in store" ON public.leads;
DROP POLICY IF EXISTS "Seller can update own leads" ON public.leads;

-- Recreate Client Policies
CREATE POLICY "Gerente can read store clients" 
ON public.clients FOR SELECT 
USING (has_role(auth.uid(), 'gerente'::app_role) AND (store_id = get_user_store_id(auth.uid()) OR store_id IS NULL));

CREATE POLICY "Gerente can manage store clients" 
ON public.clients FOR ALL 
USING (has_role(auth.uid(), 'gerente'::app_role) AND (store_id = get_user_store_id(auth.uid()) OR store_id IS NULL));

CREATE POLICY "Seller can read own or unassigned clients" 
ON public.clients FOR SELECT 
USING (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role)) 
  AND (store_id = get_user_store_id(auth.uid()) OR store_id IS NULL)
  AND (assigned_seller_id = get_user_seller_id(auth.uid()) OR assigned_seller_id IS NULL)
);

CREATE POLICY "Seller can insert clients in store" 
ON public.clients FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role)) 
  AND (store_id = get_user_store_id(auth.uid()) OR store_id IS NULL)
);

CREATE POLICY "Seller can update own clients" 
ON public.clients FOR UPDATE 
USING (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role)) 
  AND (store_id = get_user_store_id(auth.uid()) OR store_id IS NULL)
  AND (assigned_seller_id = get_user_seller_id(auth.uid()) OR assigned_seller_id IS NULL)
)
WITH CHECK (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role)) 
  AND (store_id = get_user_store_id(auth.uid()))
);

-- Recreate Lead Policies
CREATE POLICY "Gerente can manage store leads" 
ON public.leads FOR ALL 
USING (has_role(auth.uid(), 'gerente'::app_role) AND (store_id = get_user_store_id(auth.uid()) OR store_id IS NULL));

CREATE POLICY "Seller can read own or unassigned leads" 
ON public.leads FOR SELECT 
USING (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role)) 
  AND (store_id = get_user_store_id(auth.uid()) OR store_id IS NULL)
  AND (assigned_to = get_user_seller_id(auth.uid()) OR assigned_to IS NULL)
);

CREATE POLICY "Seller can insert leads in store" 
ON public.leads FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role)) 
  AND (store_id = get_user_store_id(auth.uid()) OR store_id IS NULL)
);

CREATE POLICY "Seller can update own leads" 
ON public.leads FOR UPDATE 
USING (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role)) 
  AND (store_id = get_user_store_id(auth.uid()) OR store_id IS NULL)
  AND (assigned_to = get_user_seller_id(auth.uid()) OR assigned_to IS NULL)
)
WITH CHECK (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role)) 
  AND (store_id = get_user_store_id(auth.uid()))
);
