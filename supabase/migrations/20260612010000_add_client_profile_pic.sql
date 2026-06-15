-- Foto de perfil do cliente no WhatsApp, sincronizada pela integração (uazapi).
-- A URL é atualizada a cada mensagem recebida, mantendo-a relativamente fresca
-- (URLs de foto do WhatsApp tendem a expirar).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS profile_pic_url text;

COMMENT ON COLUMN public.clients.profile_pic_url IS 'URL da foto de perfil do cliente no WhatsApp (sincronizada via webhook uazapi)';
