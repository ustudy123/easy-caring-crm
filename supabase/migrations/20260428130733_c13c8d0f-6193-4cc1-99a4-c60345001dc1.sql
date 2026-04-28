-- Add store_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);

-- Add status to clients for lead management
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'novo';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;

-- Create a view or index for fast lead lookup
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_seller ON public.clients(assigned_seller_id);
CREATE INDEX IF NOT EXISTS idx_clients_store_id ON public.clients(store_id);