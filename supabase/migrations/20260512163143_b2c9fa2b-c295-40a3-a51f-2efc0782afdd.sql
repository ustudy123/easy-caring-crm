
-- sla_alerts: remove public read
DROP POLICY IF EXISTS "SLA alerts are viewable by everyone" ON public.sla_alerts;

-- pricing_support_requests: replace permissive policies
DROP POLICY IF EXISTS "Pricing requests are viewable by all sellers" ON public.pricing_support_requests;
DROP POLICY IF EXISTS "Sellers can create pricing requests" ON public.pricing_support_requests;
DROP POLICY IF EXISTS "Managers/Admins can update pricing requests" ON public.pricing_support_requests;

CREATE POLICY "Authenticated sellers can view pricing requests"
ON public.pricing_support_requests FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
  OR has_role(auth.uid(), 'suporte'::app_role)
);

CREATE POLICY "Sellers can create pricing requests"
ON public.pricing_support_requests FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'vendedor'::app_role)
  OR has_role(auth.uid(), 'suporte'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Managers and admins can update pricing requests"
ON public.pricing_support_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

-- clients: tighten INSERT/UPDATE store enforcement
DROP POLICY IF EXISTS "Sellers can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Seller can insert clients in store" ON public.clients;
DROP POLICY IF EXISTS "Sellers can update their own or unassigned clients" ON public.clients;
DROP POLICY IF EXISTS "Seller can update own clients" ON public.clients;

CREATE POLICY "Seller can insert clients in own store"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role))
  AND store_id = get_user_store_id(auth.uid())
);

CREATE POLICY "Seller can update own store clients"
ON public.clients FOR UPDATE TO authenticated
USING (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role))
  AND store_id = get_user_store_id(auth.uid())
  AND ((assigned_seller_id = get_user_seller_id(auth.uid())) OR (assigned_seller_id IS NULL))
)
WITH CHECK (
  (has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'suporte'::app_role))
  AND store_id = get_user_store_id(auth.uid())
  AND assigned_seller_id = get_user_seller_id(auth.uid())
);

-- notifications: add visibility for vendedor and suporte role broadcasts
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR ((role_target = 'admin'::text) AND has_role(auth.uid(), 'admin'::app_role))
  OR ((role_target = 'manager'::text) AND (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))
  OR ((role_target = 'vendedor'::text) AND has_role(auth.uid(), 'vendedor'::app_role))
  OR ((role_target = 'suporte'::text) AND has_role(auth.uid(), 'suporte'::app_role))
);
