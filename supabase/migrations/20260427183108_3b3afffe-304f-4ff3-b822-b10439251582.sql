-- Add media columns to whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Create storage bucket for whatsapp media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('whatsapp_media', 'whatsapp_media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Qualquer um pode ver as mídias" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'whatsapp_media');

CREATE POLICY "Usuários autenticados podem fazer upload de mídias" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'whatsapp_media' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar suas mídias" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'whatsapp_media' AND auth.role() = 'authenticated');
