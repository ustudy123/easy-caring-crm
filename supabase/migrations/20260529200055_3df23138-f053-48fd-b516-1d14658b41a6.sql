-- Update existing stores with their cities
UPDATE public.stores SET city = 'Niterói' WHERE id = '25b7fb23-89c6-4abc-af6a-75c8c41e0dc2';
UPDATE public.stores SET city = 'Rio de Janeiro' WHERE id = 'd8fa579e-a051-43a4-a1b6-a27a4ebc9d6e';
UPDATE public.stores SET city = 'Barra da Tijuca' WHERE id = 'b7369414-9afe-4870-974e-45aa58173b8c';
UPDATE public.stores SET city = 'Macaé' WHERE id = '0e3a0306-58b0-4449-8526-177a91d7d6d4';

-- Create specific stores for Macaé if they don't exist
-- I'll use new UUIDs for them
INSERT INTO public.stores (id, name, city)
VALUES 
  (gen_random_uuid(), 'Matriz', 'Macaé'),
  (gen_random_uuid(), 'Aeroporto', 'Macaé'),
  (gen_random_uuid(), 'Riviera', 'Macaé')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions (as required by rules)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
