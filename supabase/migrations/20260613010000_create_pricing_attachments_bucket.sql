-- Corrige "Erro ao enviar: Bucket not found" ao anexar PDF no orçamento.
-- A tela usa o bucket de Storage "pricing_attachments", que não existia.

-- Cria o bucket (privado; o acesso aos arquivos é feito por signed URLs).
INSERT INTO storage.buckets (id, name, public)
VALUES ('pricing_attachments', 'pricing_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para usuários autenticados neste bucket.
DROP POLICY IF EXISTS "pricing_attachments_insert" ON storage.objects;
CREATE POLICY "pricing_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pricing_attachments');

DROP POLICY IF EXISTS "pricing_attachments_select" ON storage.objects;
CREATE POLICY "pricing_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pricing_attachments');

DROP POLICY IF EXISTS "pricing_attachments_update" ON storage.objects;
CREATE POLICY "pricing_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pricing_attachments');

DROP POLICY IF EXISTS "pricing_attachments_delete" ON storage.objects;
CREATE POLICY "pricing_attachments_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pricing_attachments');
