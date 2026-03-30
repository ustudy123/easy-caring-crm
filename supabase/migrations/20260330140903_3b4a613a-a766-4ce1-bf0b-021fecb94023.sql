
-- Enum for kanban stages
CREATE TYPE public.kanban_stage AS ENUM ('novo_lead', 'em_atendimento', 'orcamento_enviado', 'negociacao', 'fechado');

-- Enum for interaction types
CREATE TYPE public.interaction_type AS ENUM ('whatsapp', 'phone', 'email', 'visit', 'note');

-- Enum for follow-up types
CREATE TYPE public.follow_up_type AS ENUM ('call', 'whatsapp', 'visit', 'email');

-- Enum for campaign channels
CREATE TYPE public.campaign_channel AS ENUM ('whatsapp', 'meta', 'instagram', 'google', 'indicacao');

-- Enum for campaign status
CREATE TYPE public.campaign_status AS ENUM ('active', 'paused', 'completed');

-- Enum for seller roles
CREATE TYPE public.seller_role AS ENUM ('vendedor', 'gerente');

-- Sellers table
CREATE TABLE public.sellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  role seller_role NOT NULL DEFAULT 'vendedor',
  leads_count INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  total_purchases NUMERIC NOT NULL DEFAULT 0,
  last_contact TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT,
  stage kanban_stage NOT NULL DEFAULT 'novo_lead',
  value NUMERIC NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES public.sellers(id),
  source TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  next_follow_up TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Follow-ups table
CREATE TABLE public.follow_ups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT false,
  assigned_to UUID REFERENCES public.sellers(id),
  type follow_up_type NOT NULL DEFAULT 'call',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Interactions table
CREATE TABLE public.interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  type interaction_type NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.sellers(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  channel campaign_channel NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  budget NUMERIC NOT NULL DEFAULT 0,
  leads_generated INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  status campaign_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (public read for now, will add auth later)
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (before auth is implemented)
CREATE POLICY "Allow public read sellers" ON public.sellers FOR SELECT USING (true);
CREATE POLICY "Allow public insert sellers" ON public.sellers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update sellers" ON public.sellers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete sellers" ON public.sellers FOR DELETE USING (true);

CREATE POLICY "Allow public read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Allow public insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update clients" ON public.clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete clients" ON public.clients FOR DELETE USING (true);

CREATE POLICY "Allow public read leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Allow public insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update leads" ON public.leads FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete leads" ON public.leads FOR DELETE USING (true);

CREATE POLICY "Allow public read follow_ups" ON public.follow_ups FOR SELECT USING (true);
CREATE POLICY "Allow public insert follow_ups" ON public.follow_ups FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update follow_ups" ON public.follow_ups FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete follow_ups" ON public.follow_ups FOR DELETE USING (true);

CREATE POLICY "Allow public read interactions" ON public.interactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert interactions" ON public.interactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update interactions" ON public.interactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete interactions" ON public.interactions FOR DELETE USING (true);

CREATE POLICY "Allow public read campaigns" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Allow public insert campaigns" ON public.campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update campaigns" ON public.campaigns FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete campaigns" ON public.campaigns FOR DELETE USING (true);

-- Trigger to auto-update updated_at on leads
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
