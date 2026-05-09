-- Check if we need to add specific roles or types to notification-related tables if any, 
-- but usually, the current structure handles text-based roles.
-- Ensuring we have a way to track SLA alerts in a dedicated table for reporting
CREATE TABLE IF NOT EXISTS public.sla_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES public.sellers(id),
  alert_level TEXT NOT NULL, -- yellow, red, critical
  alert_type TEXT NOT NULL, -- seller, manager, admin
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sla_alerts ENABLE ROW LEVEL SECURITY;

-- Simple policy for visibility
CREATE POLICY "SLA alerts are viewable by everyone" ON public.sla_alerts FOR SELECT USING (true);
