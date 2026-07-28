-- Áudio opcional na solicitação de orçamento / negociação especial.
--
-- O vendedor pode gravar um áudio (MediaRecorder no navegador) explicando a
-- solicitação, no lugar de (ou além de) digitar. O arquivo é enviado para o
-- bucket de Storage "pricing_attachments" (que já existe e não restringe MIME),
-- e o caminho do objeto fica nesta coluna. O acesso ao arquivo é por signed URL,
-- reusando as políticas já existentes do bucket (insert/select para authenticated).
--
-- Não é destrutivo; idempotente.
ALTER TABLE public.pricing_support_requests
  ADD COLUMN IF NOT EXISTS audio_url text;
