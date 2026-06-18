-- Conta as tentativas de código errado na triagem do WhatsApp.
-- Após ~3 erros, o bot deixa de pedir o código e passa a perguntar a região.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS triage_code_attempts integer NOT NULL DEFAULT 0;
