-- Add sender tracking to whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Ensure service_transfers has proper RLS for the new requirements
ALTER TABLE public.service_transfers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins and Managers can view all transfers" ON public.service_transfers;
DROP POLICY IF EXISTS "Sellers can view their own transfers" ON public.service_transfers;
DROP POLICY IF EXISTS "Users can insert transfers" ON public.service_transfers;

-- Admins and Managers can see all transfers
CREATE POLICY "Admins and Managers can view all transfers" 
ON public.service_transfers 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'gerente')
);

-- Sellers can see transfers where they are the origin or destination
CREATE POLICY "Sellers can view their own transfers" 
ON public.service_transfers 
FOR SELECT 
USING (
  from_seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()) OR 
  to_seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
);

-- Create a policy for inserting transfers
CREATE POLICY "Users can insert transfers" 
ON public.service_transfers 
FOR INSERT 
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'gerente') OR 
  from_seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
);
