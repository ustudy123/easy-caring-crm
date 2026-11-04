-- Novo tipo de compromisso na Agenda: "Orçamentação", uma das opções de
-- "Próxima ação" do card do cliente (Qualificação de Clientes — Etapa 1).
-- Fica num arquivo próprio porque um valor novo de enum só pode ser usado
-- depois de confirmado.
ALTER TYPE public.follow_up_type ADD VALUE IF NOT EXISTS 'quote';
