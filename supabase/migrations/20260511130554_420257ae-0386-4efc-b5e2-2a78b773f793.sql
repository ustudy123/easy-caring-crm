-- Add tracking columns for reminders and resolution
ALTER TABLE public.sla_alerts 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP WITH TIME ZONE;

-- Also ensure we have indexes for performance on frequent lookups
CREATE INDEX IF NOT EXISTS idx_sla_alerts_unresolved ON public.sla_alerts (resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sla_alerts_client_unresolved ON public.sla_alerts (lead_id, resolved_at) WHERE resolved_at IS NULL;
