
-- Make lead_id nullable for follow_ups created independently
ALTER TABLE public.follow_ups ALTER COLUMN lead_id DROP NOT NULL;

-- Enable realtime for leads and follow_ups
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_ups;
