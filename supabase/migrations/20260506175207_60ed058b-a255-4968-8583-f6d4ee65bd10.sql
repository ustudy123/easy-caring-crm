-- Drop existing foreign keys that point to profiles
ALTER TABLE public.service_transfers 
DROP CONSTRAINT IF EXISTS service_transfers_from_seller_id_fkey,
DROP CONSTRAINT IF EXISTS service_transfers_to_seller_id_fkey;

-- Add correct foreign keys pointing to sellers
ALTER TABLE public.service_transfers 
ADD CONSTRAINT service_transfers_from_seller_id_fkey 
FOREIGN KEY (from_seller_id) REFERENCES public.sellers(id),
ADD CONSTRAINT service_transfers_to_seller_id_fkey 
FOREIGN KEY (to_seller_id) REFERENCES public.sellers(id);

-- Ensure RLS allows the operations we're doing
-- We already added policies in the previous migration, they should still work as they don't depend on the specific table being referenced in the FK.
