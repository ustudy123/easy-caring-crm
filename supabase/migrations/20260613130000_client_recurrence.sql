-- Pós-venda e clientes recorrentes.
-- purchase_count: nº de vendas concluídas do cliente (compras).
-- client_type: 'unica' ou 'recorrente' (marcado pelo vendedor no pós-venda).
-- last_purchase_at: data da última venda concluída.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS purchase_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_purchase_at timestamptz;
