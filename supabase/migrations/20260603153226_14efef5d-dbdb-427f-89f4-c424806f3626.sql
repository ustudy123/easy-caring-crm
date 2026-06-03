-- Forçar adição de colunas se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_support_requests' AND column_name = 'request_type') THEN
        ALTER TABLE public.pricing_support_requests ADD COLUMN request_type text DEFAULT 'orcamento';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_support_requests' AND column_name = 'client_name') THEN
        ALTER TABLE public.pricing_support_requests ADD COLUMN client_name text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_support_requests' AND column_name = 'erp_client_id') THEN
        ALTER TABLE public.pricing_support_requests ADD COLUMN erp_client_id text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_support_requests' AND column_name = 'pdf_url') THEN
        ALTER TABLE public.pricing_support_requests ADD COLUMN pdf_url text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_support_requests' AND column_name = 'pdf_name') THEN
        ALTER TABLE public.pricing_support_requests ADD COLUMN pdf_name text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_support_requests' AND column_name = 'created_by') THEN
        ALTER TABLE public.pricing_support_requests ADD COLUMN created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();
    END IF;
END $$;

-- Garantir GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_support_requests TO authenticated;
GRANT ALL ON public.pricing_support_requests TO service_role;
