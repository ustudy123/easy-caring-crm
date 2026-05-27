
-- 1. Profiles: enforce no role/store_id self-escalation
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.role := OLD.role;
    NEW.store_id := OLD.store_id;
    NEW.is_active := OLD.is_active;
    NEW.substitute_id := OLD.substitute_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_change_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_change_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_change();

-- 2. service_transfers: consolidate INSERT policies
DROP POLICY IF EXISTS "Managers can insert service transfers" ON public.service_transfers;
DROP POLICY IF EXISTS "Users can insert their own transfers" ON public.service_transfers;
DROP POLICY IF EXISTS "Users can insert transfers" ON public.service_transfers;

CREATE POLICY "Insert service transfers (scoped)"
ON public.service_transfers
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR (
    from_seller_id IN (SELECT s.id FROM public.sellers s WHERE s.user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = service_transfers.client_id
        AND c.store_id = public.get_user_store_id(auth.uid())
    )
    AND auth.uid() = (SELECT p.user_id FROM public.profiles p WHERE p.id = service_transfers.performed_by)
  )
);

-- 3. Make whatsapp_media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'whatsapp_media';
