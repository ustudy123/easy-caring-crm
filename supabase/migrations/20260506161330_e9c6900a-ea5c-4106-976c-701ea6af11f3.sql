-- Add availability and distribution columns to sellers
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create function for round-robin lead distribution
CREATE OR REPLACE FUNCTION public.get_next_seller_for_distribution(_store_id UUID DEFAULT NULL)
RETURNS SETOF public.sellers AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.sellers
    WHERE 
        is_active = true 
        AND is_available = true
        AND (
            (_store_id IS NULL AND store_id IS NULL) -- General queue (no store)
            OR 
            (_store_id IS NOT NULL AND store_id = _store_id) -- Store specific queue
        )
    ORDER BY last_assigned_at ASC NULLS FIRST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to mark seller as assigned and update timestamp
CREATE OR REPLACE FUNCTION public.mark_seller_assigned(_seller_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.sellers
    SET 
        last_assigned_at = now(),
        leads_count = leads_count + 1
    WHERE id = _seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
