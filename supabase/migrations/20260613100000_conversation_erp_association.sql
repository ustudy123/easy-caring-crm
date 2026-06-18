-- "Associar conversa": vincula o contato (conversa) a uma categoria e, quando
-- for intermediário (síndico/comprador/pintor/arquiteto/construtor), ao cliente
-- final cadastrado no ERP. Consumidor final = o próprio contato (sem vínculo).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contact_category text;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS linked_erp_client_id text;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS linked_erp_client_name text;

COMMENT ON COLUMN public.clients.contact_category IS
  'Classificação do contato: sindico, comprador, pintor, arquiteto, construtor ou consumidor_final.';
COMMENT ON COLUMN public.clients.linked_erp_client_id IS
  'ID do cliente final no ERP, quando o contato é intermediário.';
