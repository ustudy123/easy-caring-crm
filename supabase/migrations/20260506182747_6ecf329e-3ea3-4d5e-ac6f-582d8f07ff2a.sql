-- Create unified redirection history table
CREATE TABLE public.redirection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    from_seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
    to_seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    redirection_type TEXT NOT NULL, -- manual_transfer, inactive_seller, vacation, no_substitute, queue_to_seller
    reason TEXT,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.redirection_history ENABLE ROW LEVEL SECURITY;

-- Policies (Admins and Gerentes can see all history)
CREATE POLICY "Admins and gerentes can view all history"
ON public.redirection_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'gerente')
  )
);

CREATE POLICY "Sellers can view their own involvements"
ON public.redirection_history
FOR SELECT
USING (
  from_seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
  OR to_seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
);

-- Add indexes for better filtering
CREATE INDEX idx_redirection_history_client_id ON public.redirection_history(client_id);
CREATE INDEX idx_redirection_history_from_seller_id ON public.redirection_history(from_seller_id);
CREATE INDEX idx_redirection_history_to_seller_id ON public.redirection_history(to_seller_id);
CREATE INDEX idx_redirection_history_store_id ON public.redirection_history(store_id);
CREATE INDEX idx_redirection_history_created_at ON public.redirection_history(created_at);

-- Migrate existing manual transfers
INSERT INTO public.redirection_history (client_id, from_seller_id, to_seller_id, performed_by, redirection_type, reason, created_at)
SELECT client_id, from_seller_id, to_seller_id, performed_by, 'manual_transfer', reason, created_at
FROM public.service_transfers;

-- Migrate existing automatic redirections
INSERT INTO public.redirection_history (client_id, from_seller_id, to_seller_id, redirection_type, reason, created_at)
SELECT client_id, original_seller_id, redirected_to_seller_id, 
  CASE 
    WHEN reason = 'seller_vacation' THEN 'vacation'
    WHEN reason = 'seller_inactive' THEN 'inactive_seller'
    ELSE 'no_substitute'
  END, 
  reason, created_at
FROM public.lead_redirections;
