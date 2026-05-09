-- Add the new stage to the enum
ALTER TYPE public.kanban_stage ADD VALUE IF NOT EXISTS 'precificacao_especial' AFTER 'contorno_objecoes';

-- Create a table for pricing support requests if it doesn't exist
CREATE TABLE IF NOT EXISTS public.pricing_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES public.sellers(id),
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_support_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Pricing requests are viewable by all sellers" ON public.pricing_support_requests
  FOR SELECT USING (true);

CREATE POLICY "Sellers can create pricing requests" ON public.pricing_support_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Managers/Admins can update pricing requests" ON public.pricing_support_requests
  FOR UPDATE USING (true);
