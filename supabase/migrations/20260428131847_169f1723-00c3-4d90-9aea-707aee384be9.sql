-- Add column to track last message from client specifically
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_message_from_client_at TIMESTAMP WITH TIME ZONE;

-- Insert sample stores if they don't exist
INSERT INTO public.stores (name)
SELECT name FROM (
  VALUES ('Loja A'), ('Loja B'), ('Loja C')
) AS t(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.stores WHERE name = t.name
);
