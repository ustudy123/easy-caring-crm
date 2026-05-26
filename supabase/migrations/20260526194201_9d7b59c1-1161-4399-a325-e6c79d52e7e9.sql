
-- Enums
CREATE TYPE public.whatsapp_instance_type AS ENUM ('store', 'seller');
CREATE TYPE public.whatsapp_provider AS ENUM ('uazapi', 'meta_cloud');
CREATE TYPE public.whatsapp_instance_status AS ENUM ('disconnected', 'qr_pending', 'connected', 'error');

-- Table
CREATE TABLE public.whatsapp_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone_number text NOT NULL UNIQUE,
  instance_type public.whatsapp_instance_type NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  provider public.whatsapp_provider NOT NULL DEFAULT 'uazapi',
  status public.whatsapp_instance_status NOT NULL DEFAULT 'disconnected',
  qr_code text,
  last_connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_instances_type_check CHECK (
    (instance_type = 'store' AND store_id IS NOT NULL AND seller_id IS NULL)
    OR (instance_type = 'seller' AND seller_id IS NOT NULL)
  )
);

CREATE INDEX idx_whatsapp_instances_store ON public.whatsapp_instances(store_id);
CREATE INDEX idx_whatsapp_instances_seller ON public.whatsapp_instances(seller_id);
CREATE INDEX idx_whatsapp_instances_phone ON public.whatsapp_instances(phone_number);

GRANT SELECT ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to whatsapp_instances"
  ON public.whatsapp_instances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view whatsapp_instances"
  ON public.whatsapp_instances FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerente'::app_role)
    OR public.has_role(auth.uid(), 'vendedor'::app_role)
    OR public.has_role(auth.uid(), 'suporte'::app_role)
  );

CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- New columns on existing tables
ALTER TABLE public.whatsapp_messages
  ADD COLUMN received_on_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

ALTER TABLE public.clients
  ADD COLUMN received_on_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

CREATE INDEX idx_whatsapp_messages_instance ON public.whatsapp_messages(received_on_instance_id);
CREATE INDEX idx_clients_received_on_instance ON public.clients(received_on_instance_id);
