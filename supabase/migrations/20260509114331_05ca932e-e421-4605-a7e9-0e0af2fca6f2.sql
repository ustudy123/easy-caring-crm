-- Add new columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS client_type TEXT,
ADD COLUMN IF NOT EXISTS company_work_site TEXT,
ADD COLUMN IF NOT EXISTS interest_products TEXT,
ADD COLUMN IF NOT EXISTS store_name TEXT;

-- Update existing records if possible (optional, but good for consistency)
-- For now we just leave them null or default to empty string if preferred.
