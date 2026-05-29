-- Add priority column to sellers
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS distribution_priority INTEGER DEFAULT 0;

-- Update the distribution function to honor priority
CREATE OR REPLACE FUNCTION public.get_next_seller_for_distribution(_store_id UUID)
RETURNS SETOF public.sellers AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.sellers
    WHERE 
        status = 'active'
        AND is_active = true 
        AND is_available = true
        AND (
            (_store_id IS NULL) -- If null, can be any store (fallback or general)
            OR 
            (store_id = _store_id) -- Store specific
        )
    ORDER BY distribution_priority DESC, last_assigned_at ASC NULLS FIRST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
