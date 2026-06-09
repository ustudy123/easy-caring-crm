-- Atualiza as contagens existentes
UPDATE public.stores s
SET employee_count = (
  SELECT count(*)
  FROM public.sellers sel
  WHERE sel.store_id = s.id
);

-- Função para atualizar a contagem de funcionários
CREATE OR REPLACE FUNCTION public.update_store_employee_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.store_id IS NOT NULL) THEN
            UPDATE public.stores
            SET employee_count = (SELECT count(*) FROM public.sellers WHERE store_id = NEW.store_id)
            WHERE id = NEW.store_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.store_id IS NOT NULL) THEN
            UPDATE public.stores
            SET employee_count = (SELECT count(*) FROM public.sellers WHERE store_id = OLD.store_id)
            WHERE id = OLD.store_id;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.store_id IS DISTINCT FROM NEW.store_id) THEN
            -- Atualiza contagem da loja antiga
            IF (OLD.store_id IS NOT NULL) THEN
                UPDATE public.stores
                SET employee_count = (SELECT count(*) FROM public.sellers WHERE store_id = OLD.store_id)
                WHERE id = OLD.store_id;
            END IF;
            -- Atualiza contagem da nova loja
            IF (NEW.store_id IS NOT NULL) THEN
                UPDATE public.stores
                SET employee_count = (SELECT count(*) FROM public.sellers WHERE store_id = NEW.store_id)
                WHERE id = NEW.store_id;
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover triggers se já existirem (para evitar erros de re-execução)
DROP TRIGGER IF EXISTS tr_update_store_employee_count_insert ON public.sellers;
DROP TRIGGER IF EXISTS tr_update_store_employee_count_delete ON public.sellers;
DROP TRIGGER IF EXISTS tr_update_store_employee_count_update ON public.sellers;

-- Criar Triggers
CREATE TRIGGER tr_update_store_employee_count_insert
AFTER INSERT ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.update_store_employee_count();

CREATE TRIGGER tr_update_store_employee_count_delete
AFTER DELETE ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.update_store_employee_count();

CREATE TRIGGER tr_update_store_employee_count_update
AFTER UPDATE OF store_id ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.update_store_employee_count();