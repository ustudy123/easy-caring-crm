-- Tabela de histórico de alertas de SLA
CREATE TABLE public.sla_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    vendedor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    alert_type TEXT NOT NULL, -- 'vendedor', 'gestor', 'admin'
    alert_level TEXT NOT NULL, -- 'amarelo', 'vermelho', 'crítico'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.sla_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Admins can view all SLA alerts" 
ON public.sla_alerts 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE POLICY "Users can view their own SLA alerts" 
ON public.sla_alerts 
FOR SELECT 
USING (
    vendedor_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'manager')
    )
);

-- Index para performance
CREATE INDEX idx_sla_alerts_created_at ON public.sla_alerts(created_at DESC);
CREATE INDEX idx_sla_alerts_vendedor ON public.sla_alerts(vendedor_id);