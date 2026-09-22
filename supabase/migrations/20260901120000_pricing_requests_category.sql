-- Separa os registros de pricing_support_requests por categoria:
--   'orcamento' → tela Suporte a Orçamento (orçamento / negociação especial)
--   'pedido'    → nova tela Envio de Pedido (distribuição / representação)
-- Os registros existentes ficam como 'orcamento' (default). A tela filtra por
-- category, então uma não mistura com a outra.
ALTER TABLE public.pricing_support_requests
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'orcamento';
