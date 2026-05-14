ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS erp_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_erp_id ON public.clients(erp_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);