-- Ensure RLS is enabled
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Drop the restrictive policy for updates on leads if it exists
DROP POLICY IF EXISTS "Seller can update own leads" ON public.leads;

-- Create a more permissive policy for sellers to assume leads
CREATE POLICY "Seller can update own or unassigned leads" 
ON public.leads 
FOR UPDATE 
TO authenticated
USING (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role)) 
  AND (
    (store_id = get_user_store_id(auth.uid())) 
    OR (store_id IS NULL)
  ) 
  AND (
    (assigned_to = get_user_seller_id(auth.uid())) 
    OR (assigned_to IS NULL)
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role))
  -- When updating, the lead must be assigned to the user or their store
);

-- Do the same for clients
DROP POLICY IF EXISTS "Sellers can update their own or unassigned clients" ON public.clients;
CREATE POLICY "Sellers can update their own or unassigned clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role))
  AND (
    (store_id = get_user_store_id(auth.uid())) 
    OR (store_id IS NULL)
  )
  AND (
    (assigned_seller_id = get_user_seller_id(auth.uid())) 
    OR (assigned_seller_id IS NULL)
  )
);

-- Ensure Sellers can insert clients (when assuming a new one from WhatsApp)
DROP POLICY IF EXISTS "Sellers can insert clients" ON public.clients;
CREATE POLICY "Sellers can insert clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role))
);

-- Ensure Sellers can insert leads
DROP POLICY IF EXISTS "Seller can insert leads" ON public.leads;
CREATE POLICY "Seller can insert leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role))
);
