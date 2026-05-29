ALTER TABLE public.whatsapp_instances 
ADD COLUMN api_url TEXT,
ADD COLUMN api_token TEXT;

-- Adiciona comentário para documentar que estes campos podem conter dados sensíveis
COMMENT ON COLUMN public.whatsapp_instances.api_token IS 'Token de acesso para a API do provedor (ex: Z-API)';
COMMENT ON COLUMN public.whatsapp_instances.api_url IS 'URL base da instância no provedor';