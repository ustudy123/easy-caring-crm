-- Update the profile of the test user to be linked to the main store
UPDATE public.profiles
SET store_id = 'b7369414-9afe-4870-974e-45aa58173b8c'
WHERE user_id = 'f3b46463-3648-47d4-895e-955b3e65ba90';

-- Also ensure any existing leads/clients for this phone (if any) are in the same store 
-- so the seller can actually see them after claiming.
-- But since the error is "row violates RLS", it's likely because the INSERT/UPDATE 
-- is failing due to the seller's store_id being NULL while the policy requires it 
-- to match the record's store_id.