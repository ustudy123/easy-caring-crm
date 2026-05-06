-- Add performed_by column to service_transfers
ALTER TABLE public.service_transfers 
ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES public.profiles(id);

-- Add comments for documentation
COMMENT ON COLUMN public.service_transfers.performed_by IS 'The user ID of the person who manually initiated the transfer.';

-- Update RLS policies for service_transfers if needed
-- Allow all authenticated users to insert (they will only insert their own actions)
-- Allow admins and managers to see all transfers
-- Allow sellers to see transfers they are involved in

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'service_transfers' AND policyname = 'Admins and managers can view all transfers'
    ) THEN
        CREATE POLICY "Admins and managers can view all transfers" 
        ON public.service_transfers 
        FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'gerente')
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'service_transfers' AND policyname = 'Users can insert their own transfers'
    ) THEN
        CREATE POLICY "Users can insert their own transfers" 
        ON public.service_transfers 
        FOR INSERT 
        WITH CHECK (auth.uid() = (SELECT user_id FROM public.profiles WHERE id = performed_by));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'service_transfers' AND policyname = 'Sellers can view their own transfers'
    ) THEN
        CREATE POLICY "Sellers can view their own transfers" 
        ON public.service_transfers 
        FOR SELECT 
        USING (
            from_seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()) OR
            to_seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
        );
    END IF;
END $$;
