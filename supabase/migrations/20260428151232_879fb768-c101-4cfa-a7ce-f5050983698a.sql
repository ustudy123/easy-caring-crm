-- Add setting for automatic return of leads
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS auto_return_leads BOOLEAN DEFAULT true;

-- Ensure updated_at exists on profiles for better tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update trigger for profiles if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
        CREATE TRIGGER update_profiles_updated_at
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
