
-- ============================================================
-- 1. Drop ALL existing permissive public policies on every table
-- ============================================================

-- campaigns
DROP POLICY IF EXISTS "Allow public delete campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Allow public insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Allow public read campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Allow public update campaigns" ON public.campaigns;

-- clients
DROP POLICY IF EXISTS "Allow public delete clients" ON public.clients;
DROP POLICY IF EXISTS "Allow public insert clients" ON public.clients;
DROP POLICY IF EXISTS "Allow public read clients" ON public.clients;
DROP POLICY IF EXISTS "Allow public update clients" ON public.clients;

-- follow_ups
DROP POLICY IF EXISTS "Allow public delete follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Allow public insert follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Allow public read follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Allow public update follow_ups" ON public.follow_ups;

-- interactions
DROP POLICY IF EXISTS "Allow public delete interactions" ON public.interactions;
DROP POLICY IF EXISTS "Allow public insert interactions" ON public.interactions;
DROP POLICY IF EXISTS "Allow public read interactions" ON public.interactions;
DROP POLICY IF EXISTS "Allow public update interactions" ON public.interactions;

-- leads
DROP POLICY IF EXISTS "Allow public delete leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public insert leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public read leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public update leads" ON public.leads;

-- sellers
DROP POLICY IF EXISTS "Allow public delete sellers" ON public.sellers;
DROP POLICY IF EXISTS "Allow public insert sellers" ON public.sellers;
DROP POLICY IF EXISTS "Allow public read sellers" ON public.sellers;
DROP POLICY IF EXISTS "Allow public update sellers" ON public.sellers;

-- whatsapp_messages
DROP POLICY IF EXISTS "Allow all access to whatsapp_messages" ON public.whatsapp_messages;

-- ============================================================
-- 2. Create new authenticated-only policies for every table
-- ============================================================

-- campaigns
CREATE POLICY "Authenticated users can read campaigns" ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete campaigns" ON public.campaigns FOR DELETE TO authenticated USING (true);

-- clients
CREATE POLICY "Authenticated users can read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

-- follow_ups
CREATE POLICY "Authenticated users can read follow_ups" ON public.follow_ups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert follow_ups" ON public.follow_ups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update follow_ups" ON public.follow_ups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete follow_ups" ON public.follow_ups FOR DELETE TO authenticated USING (true);

-- interactions
CREATE POLICY "Authenticated users can read interactions" ON public.interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert interactions" ON public.interactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update interactions" ON public.interactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete interactions" ON public.interactions FOR DELETE TO authenticated USING (true);

-- leads
CREATE POLICY "Authenticated users can read leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update leads" ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete leads" ON public.leads FOR DELETE TO authenticated USING (true);

-- sellers
CREATE POLICY "Authenticated users can read sellers" ON public.sellers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sellers" ON public.sellers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sellers" ON public.sellers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete sellers" ON public.sellers FOR DELETE TO authenticated USING (true);

-- whatsapp_messages
CREATE POLICY "Authenticated users can read whatsapp_messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert whatsapp_messages" ON public.whatsapp_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update whatsapp_messages" ON public.whatsapp_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete whatsapp_messages" ON public.whatsapp_messages FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. Fix function search_path vulnerability
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
