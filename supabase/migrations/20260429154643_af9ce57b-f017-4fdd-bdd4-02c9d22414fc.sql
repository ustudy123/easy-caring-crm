-- Adicionar colunas para controle de triagem e preferência de loja
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS pending_store_preference UUID REFERENCES public.stores(id),
ADD COLUMN IF NOT EXISTS triaging BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.clients.pending_store_preference IS 'ID da loja preferida pelo cliente durante a triagem inicial.';
COMMENT ON COLUMN public.clients.triaging IS 'Indica se o cliente está atualmente sendo triado pela IA.';
