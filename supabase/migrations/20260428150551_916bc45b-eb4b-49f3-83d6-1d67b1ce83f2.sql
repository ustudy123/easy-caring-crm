-- Add fields to profiles for seller availability
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS substitute_id UUID REFERENCES public.profiles(id);

-- Add fields to clients for tracking response times and alerts
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS last_seller_response_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS alert_status TEXT DEFAULT 'none', -- none, yellow, red
ADD COLUMN IF NOT EXISTS alert_notified_at TIMESTAMP WITH TIME ZONE;

-- Create a table for transfer logs
CREATE TABLE IF NOT EXISTS public.service_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    from_seller_id UUID REFERENCES public.profiles(id),
    to_seller_id UUID REFERENCES public.profiles(id),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on transfer logs
ALTER TABLE public.service_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service transfers are viewable by everyone" 
ON public.service_transfers FOR SELECT USING (true);

CREATE POLICY "Managers can insert service transfers" 
ON public.service_transfers FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
);
