-- Add status and substitute fields to sellers
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'vacation', 'away')),
ADD COLUMN IF NOT EXISTS substitute_id UUID REFERENCES public.sellers(id);

-- Create lead_redirections table
CREATE TABLE IF NOT EXISTS public.lead_redirections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    original_seller_id UUID REFERENCES public.sellers(id),
    redirected_to_seller_id UUID REFERENCES public.sellers(id),
    reason TEXT NOT NULL, -- e.g., 'seller_vacation', 'seller_inactive', 'seller_away'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_redirections ENABLE ROW LEVEL SECURITY;

-- Policies for lead_redirections
CREATE POLICY "Admins can view all redirections" 
ON public.lead_redirections FOR SELECT 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'gerente')));

-- Create policy for sellers to see their own redirections (as original or redirected)
CREATE POLICY "Sellers can view their own redirections" 
ON public.lead_redirections FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.sellers 
        WHERE user_id = auth.uid() 
        AND (id = original_seller_id OR id = redirected_to_seller_id)
    )
);
