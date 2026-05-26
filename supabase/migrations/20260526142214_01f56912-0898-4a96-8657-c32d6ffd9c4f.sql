-- 1. Trigger to enforce: inactive seller MUST have a substitute
CREATE OR REPLACE FUNCTION public.enforce_substitute_when_inactive()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_active = false OR NEW.status IN ('inactive', 'vacation', 'away'))
     AND NEW.substitute_id IS NULL THEN
    RAISE EXCEPTION 'É obrigatório selecionar um vendedor substituto antes de marcar como inativo / em férias / ausente.';
  END IF;

  -- Cannot be own substitute
  IF NEW.substitute_id IS NOT NULL AND NEW.substitute_id = NEW.id THEN
    RAISE EXCEPTION 'O vendedor substituto não pode ser o próprio vendedor.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_substitute_when_inactive ON public.sellers;
CREATE TRIGGER trg_enforce_substitute_when_inactive
BEFORE INSERT OR UPDATE ON public.sellers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_substitute_when_inactive();

-- 2. Allow gerente to update sellers in their own store
CREATE POLICY "Gerente can update store sellers"
ON public.sellers
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  AND store_id = get_user_store_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'gerente'::app_role)
  AND store_id = get_user_store_id(auth.uid())
);