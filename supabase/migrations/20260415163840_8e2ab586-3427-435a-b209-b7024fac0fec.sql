
-- Fix interactions: remove overly permissive insert
DROP POLICY IF EXISTS "Authenticated can insert interactions" ON public.interactions;

CREATE POLICY "Users can insert interactions" ON public.interactions
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'vendedor')
  OR public.has_role(auth.uid(), 'suporte')
);

-- Fix interactions: restrict read to users with roles
DROP POLICY IF EXISTS "Authenticated can read interactions" ON public.interactions;

CREATE POLICY "Users with roles can read interactions" ON public.interactions
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'vendedor')
  OR public.has_role(auth.uid(), 'suporte')
);

-- Update whatsapp_messages
DROP POLICY IF EXISTS "Authenticated users can read whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can update whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can delete whatsapp_messages" ON public.whatsapp_messages;

CREATE POLICY "Admin full access to whatsapp_messages" ON public.whatsapp_messages
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users with roles can read whatsapp_messages" ON public.whatsapp_messages
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'vendedor')
  OR public.has_role(auth.uid(), 'suporte')
);

CREATE POLICY "Users with roles can insert whatsapp_messages" ON public.whatsapp_messages
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'vendedor')
  OR public.has_role(auth.uid(), 'suporte')
);
