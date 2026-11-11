-- Fase 9: bloco de Feedback no Hub. O gestor sobe o PDF de feedback do semestre
-- de cada operador; o operador lê na tela (sem baixar nem imprimir) e responde
-- por texto ou áudio. A resposta fica gravada para o gestor ver.

-- Gestor de um operador: admin, ou gerente da loja dele (nunca o próprio operador).
CREATE OR REPLACE FUNCTION public.can_manage_feedback(_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _seller_id IS NOT NULL
     AND _seller_id IS DISTINCT FROM public.get_user_seller_id(auth.uid())
     AND (
       public.has_role(auth.uid(), 'admin')
       OR (public.has_role(auth.uid(), 'gerente') AND EXISTS (
         SELECT 1 FROM public.sellers s WHERE s.id = _seller_id AND s.store_id = public.get_user_store_id(auth.uid())
       ))
     );
$$;

CREATE TABLE IF NOT EXISTS public.seller_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  response_text text,
  response_audio_path text,
  responded_at timestamptz,
  CONSTRAINT seller_feedbacks_period CHECK (length(btrim(period_label)) BETWEEN 1 AND 80),
  CONSTRAINT seller_feedbacks_response_text CHECK (response_text IS NULL OR length(response_text) <= 5000)
);
CREATE INDEX IF NOT EXISTS seller_feedbacks_seller_idx ON public.seller_feedbacks (seller_id, created_at DESC);

ALTER TABLE public.seller_feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own or managed feedbacks" ON public.seller_feedbacks;
CREATE POLICY "Read own or managed feedbacks" ON public.seller_feedbacks
  FOR SELECT TO authenticated USING (public.can_view_seller(seller_id));
DROP POLICY IF EXISTS "Managers add feedbacks" ON public.seller_feedbacks;
CREATE POLICY "Managers add feedbacks" ON public.seller_feedbacks
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_feedback(seller_id));
DROP POLICY IF EXISTS "Managers delete feedbacks" ON public.seller_feedbacks;
CREATE POLICY "Managers delete feedbacks" ON public.seller_feedbacks
  FOR DELETE TO authenticated USING (public.can_manage_feedback(seller_id));
DROP POLICY IF EXISTS "Operator reads and answers, manager edits period" ON public.seller_feedbacks;
CREATE POLICY "Operator reads and answers, manager edits period" ON public.seller_feedbacks
  FOR UPDATE TO authenticated USING (public.can_view_seller(seller_id)) WITH CHECK (public.can_view_seller(seller_id));

-- O que cada um pode mudar: o operador marca como lido e responde uma vez
-- (a resposta fica gravada); o gestor só ajusta o período. Ninguém reescreve
-- a resposta de outro.
CREATE OR REPLACE FUNCTION public.guard_seller_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_operator boolean := NEW.seller_id = public.get_user_seller_id(auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF NEW.seller_id IS DISTINCT FROM OLD.seller_id OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'O feedback enviado não pode ser trocado; exclua e envie outro.' USING ERRCODE = '42501';
  END IF;

  IF (NEW.response_text, NEW.response_audio_path) IS DISTINCT FROM (OLD.response_text, OLD.response_audio_path) THEN
    IF NOT v_is_operator THEN
      RAISE EXCEPTION 'Só o próprio operador responde o feedback.' USING ERRCODE = '42501';
    END IF;
    IF OLD.responded_at IS NOT NULL THEN
      RAISE EXCEPTION 'A resposta já foi enviada e fica gravada.' USING ERRCODE = '42501';
    END IF;
    IF nullif(btrim(coalesce(NEW.response_text, '')), '') IS NULL AND NEW.response_audio_path IS NULL THEN
      RAISE EXCEPTION 'Escreva a resposta ou grave um áudio.' USING ERRCODE = '23514';
    END IF;
    NEW.responded_at := now();
    NEW.viewed_at := coalesce(NEW.viewed_at, OLD.viewed_at, now());
  ELSE
    NEW.responded_at := OLD.responded_at;
  END IF;

  IF NEW.viewed_at IS DISTINCT FROM OLD.viewed_at THEN
    IF NOT v_is_operator THEN
      NEW.viewed_at := OLD.viewed_at;
    ELSIF OLD.viewed_at IS NOT NULL THEN
      NEW.viewed_at := OLD.viewed_at; -- guarda a primeira leitura
    END IF;
  END IF;

  IF NEW.period_label IS DISTINCT FROM OLD.period_label AND NOT public.can_manage_feedback(NEW.seller_id) THEN
    RAISE EXCEPTION 'Só o gestor muda o período do feedback.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seller_feedbacks_guard ON public.seller_feedbacks;
CREATE TRIGGER seller_feedbacks_guard
  BEFORE UPDATE ON public.seller_feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.guard_seller_feedback();

-- ── Arquivos do operador: bucket privado, uma pasta por vendedor ─────────────
--   {seller_id}/feedback/*.pdf   PDF do feedback (o gestor sobe)
--   {seller_id}/respostas/*      áudio da resposta ao feedback (o operador sobe)
--   {seller_id}/posvenda/*       áudio do pós-venda com nota baixa (operador ou gestor)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('seller-files', 'seller-files', false, 15728640,
        ARRAY['application/pdf', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/x-m4a'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seller_file_access(_name text, _write boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder text := split_part(_name, '/', 1);
  v_kind text := split_part(_name, '/', 2);
  v_seller uuid;
BEGIN
  IF v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  v_seller := v_folder::uuid;
  IF NOT _write THEN
    RETURN public.can_view_seller(v_seller);
  END IF;
  RETURN CASE v_kind
    WHEN 'feedback' THEN public.can_manage_feedback(v_seller)
    WHEN 'respostas' THEN v_seller = public.get_user_seller_id(auth.uid())
    WHEN 'posvenda' THEN public.can_view_seller(v_seller)
    ELSE false
  END;
END;
$$;

DROP POLICY IF EXISTS "seller_files_select" ON storage.objects;
CREATE POLICY "seller_files_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'seller-files' AND public.seller_file_access(name, false));
DROP POLICY IF EXISTS "seller_files_insert" ON storage.objects;
CREATE POLICY "seller_files_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'seller-files' AND public.seller_file_access(name, true));
DROP POLICY IF EXISTS "seller_files_delete" ON storage.objects;
CREATE POLICY "seller_files_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'seller-files' AND public.seller_file_access(name, true));
