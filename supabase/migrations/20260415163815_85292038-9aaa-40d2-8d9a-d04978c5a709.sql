
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'gerente', 'vendedor', 'suporte');

-- 2. Create stores table
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- 3. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Add columns to sellers
ALTER TABLE public.sellers ADD COLUMN user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.sellers ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- 5. Add columns to clients
ALTER TABLE public.clients ADD COLUMN assigned_seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- 6. Add store_id to leads
ALTER TABLE public.leads ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- 7. Add store_id to follow_ups
ALTER TABLE public.follow_ups ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- 8. Security definer functions

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get the store_id for the current user (via sellers table)
CREATE OR REPLACE FUNCTION public.get_user_store_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.sellers
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Get the seller id for the current user
CREATE OR REPLACE FUNCTION public.get_user_seller_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.sellers
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 9. RLS for stores: admin full, others read their own store
CREATE POLICY "Admin full access to stores" ON public.stores
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own store" ON public.stores
FOR SELECT TO authenticated
USING (id = public.get_user_store_id(auth.uid()));

-- 10. RLS for user_roles: admin manages, users read own
CREATE POLICY "Admin full access to user_roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own role" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 11. Update RLS for clients
DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;

-- Admin: full access
CREATE POLICY "Admin full access to clients" ON public.clients
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Gerente: all clients in their store
CREATE POLICY "Gerente can read store clients" ON public.clients
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente')
  AND store_id = public.get_user_store_id(auth.uid())
);

CREATE POLICY "Gerente can manage store clients" ON public.clients
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente')
  AND store_id = public.get_user_store_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'gerente')
  AND store_id = public.get_user_store_id(auth.uid())
);

-- Vendedor/Suporte: own assigned clients OR unassigned clients in their store
CREATE POLICY "Seller can read own or unassigned clients" ON public.clients
FOR SELECT TO authenticated
USING (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
  AND (
    assigned_seller_id = public.get_user_seller_id(auth.uid())
    OR assigned_seller_id IS NULL
  )
);

CREATE POLICY "Seller can insert clients in store" ON public.clients
FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
);

CREATE POLICY "Seller can update own clients" ON public.clients
FOR UPDATE TO authenticated
USING (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
  AND (
    assigned_seller_id = public.get_user_seller_id(auth.uid())
    OR assigned_seller_id IS NULL
  )
)
WITH CHECK (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
);

-- 12. Update RLS for leads
DROP POLICY IF EXISTS "Authenticated users can read leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;

CREATE POLICY "Admin full access to leads" ON public.leads
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gerente can manage store leads" ON public.leads
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente')
  AND store_id = public.get_user_store_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'gerente')
  AND store_id = public.get_user_store_id(auth.uid())
);

CREATE POLICY "Seller can read own or unassigned leads" ON public.leads
FOR SELECT TO authenticated
USING (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
  AND (
    assigned_to = public.get_user_seller_id(auth.uid())
    OR assigned_to IS NULL
  )
);

CREATE POLICY "Seller can insert leads in store" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
);

CREATE POLICY "Seller can update own leads" ON public.leads
FOR UPDATE TO authenticated
USING (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
  AND (
    assigned_to = public.get_user_seller_id(auth.uid())
    OR assigned_to IS NULL
  )
)
WITH CHECK (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
);

-- 13. Update RLS for follow_ups
DROP POLICY IF EXISTS "Authenticated users can read follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Authenticated users can insert follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Authenticated users can update follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Authenticated users can delete follow_ups" ON public.follow_ups;

CREATE POLICY "Admin full access to follow_ups" ON public.follow_ups
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gerente can manage store follow_ups" ON public.follow_ups
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente')
  AND store_id = public.get_user_store_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'gerente')
  AND store_id = public.get_user_store_id(auth.uid())
);

CREATE POLICY "Seller can read own follow_ups" ON public.follow_ups
FOR SELECT TO authenticated
USING (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
  AND (
    assigned_to = public.get_user_seller_id(auth.uid())
    OR assigned_to IS NULL
  )
);

CREATE POLICY "Seller can insert follow_ups" ON public.follow_ups
FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
);

CREATE POLICY "Seller can update own follow_ups" ON public.follow_ups
FOR UPDATE TO authenticated
USING (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
  AND (
    assigned_to = public.get_user_seller_id(auth.uid())
    OR assigned_to IS NULL
  )
)
WITH CHECK (
  (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'suporte'))
  AND store_id = public.get_user_store_id(auth.uid())
);

-- 14. Update sellers RLS
DROP POLICY IF EXISTS "Authenticated users can read sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authenticated users can insert sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authenticated users can update sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authenticated users can delete sellers" ON public.sellers;

CREATE POLICY "Admin full access to sellers" ON public.sellers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gerente can read store sellers" ON public.sellers
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente')
  AND store_id = public.get_user_store_id(auth.uid())
);

CREATE POLICY "Seller can read own profile" ON public.sellers
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 15. Campaigns: admin and gerente only
DROP POLICY IF EXISTS "Authenticated users can read campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can delete campaigns" ON public.campaigns;

CREATE POLICY "Admin full access to campaigns" ON public.campaigns
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gerente can read campaigns" ON public.campaigns
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gerente'));

-- 16. Interactions: follow store logic
DROP POLICY IF EXISTS "Authenticated users can read interactions" ON public.interactions;
DROP POLICY IF EXISTS "Authenticated users can insert interactions" ON public.interactions;
DROP POLICY IF EXISTS "Authenticated users can update interactions" ON public.interactions;
DROP POLICY IF EXISTS "Authenticated users can delete interactions" ON public.interactions;

CREATE POLICY "Admin full access to interactions" ON public.interactions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read interactions" ON public.interactions
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert interactions" ON public.interactions
FOR INSERT TO authenticated
WITH CHECK (true);
