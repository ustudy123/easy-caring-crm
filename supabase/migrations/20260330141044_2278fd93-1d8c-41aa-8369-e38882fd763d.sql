
-- Insert sellers
INSERT INTO public.sellers (id, name, role, leads_count, conversions) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Carlos Silva', 'vendedor', 24, 8),
  ('a1b2c3d4-0001-4000-8000-000000000002', 'Ana Oliveira', 'vendedor', 18, 12),
  ('a1b2c3d4-0001-4000-8000-000000000003', 'Pedro Santos', 'gerente', 15, 6),
  ('a1b2c3d4-0001-4000-8000-000000000004', 'Maria Costa', 'vendedor', 20, 10);

-- Insert clients
INSERT INTO public.clients (id, name, phone, email, address, city, tags, total_purchases, last_contact, notes, created_at) VALUES
  ('b1b2c3d4-0001-4000-8000-000000000001', 'João Pereira', '(11) 99999-1234', 'joao@email.com', 'Rua das Flores, 123', 'São Paulo', ARRAY['residencial','fidelizado'], 12500, '2026-03-20T10:00:00Z', 'Cliente fiel, sempre compra Suvinil', '2025-06-15T00:00:00Z'),
  ('b1b2c3d4-0001-4000-8000-000000000002', 'Maria Souza', '(11) 98888-5678', 'maria@email.com', 'Av. Paulista, 456', 'São Paulo', ARRAY['residencial','apartamento'], 3200, '2026-03-21T09:00:00Z', NULL, '2025-11-20T00:00:00Z'),
  ('b1b2c3d4-0001-4000-8000-000000000003', 'Empresa ABC Ltda', '(11) 97777-9012', 'contato@abc.com', 'Rua Comercial, 789', 'Guarulhos', ARRAY['comercial','grande porte'], 45000, '2026-03-22T11:00:00Z', 'Conta corporativa, pagamento 30 dias', '2024-03-10T00:00:00Z'),
  ('b1b2c3d4-0001-4000-8000-000000000004', 'Roberto Lima', '(11) 96666-3456', NULL, 'Rua Nova, 321', 'Osasco', ARRAY['residencial','novo'], 0, '2026-03-23T09:00:00Z', NULL, '2026-03-19T00:00:00Z'),
  ('b1b2c3d4-0001-4000-8000-000000000005', 'Fernanda Alves', '(11) 94444-1234', 'fernanda@email.com', NULL, 'São Paulo', ARRAY['residencial'], 8900, '2026-03-23T14:00:00Z', NULL, '2025-08-05T00:00:00Z'),
  ('b1b2c3d4-0001-4000-8000-000000000006', 'Lucas Mendes', '(11) 91111-3456', NULL, 'Rua do Parque, 555', 'Santo André', ARRAY['residencial','fidelizado'], 15600, '2026-03-20T17:00:00Z', NULL, '2025-01-12T00:00:00Z');

-- Insert leads
INSERT INTO public.leads (id, client_name, client_phone, client_email, stage, value, assigned_to, source, tags, notes, created_at, updated_at, next_follow_up) VALUES
  ('c1b2c3d4-0001-4000-8000-000000000001', 'João Pereira', '(11) 99999-1234', 'joao@email.com', 'novo_lead', 3500, 'a1b2c3d4-0001-4000-8000-000000000001', 'whatsapp', ARRAY['residencial'], 'Interessado em tinta para sala', '2026-03-20T10:00:00Z', '2026-03-20T10:00:00Z', '2026-03-25T14:00:00Z'),
  ('c1b2c3d4-0001-4000-8000-000000000002', 'Maria Souza', '(11) 98888-5678', NULL, 'novo_lead', 1200, 'a1b2c3d4-0001-4000-8000-000000000002', 'instagram', ARRAY['residencial','apartamento'], 'Quer orçamento para pintura completa', '2026-03-21T09:00:00Z', '2026-03-21T09:00:00Z', NULL),
  ('c1b2c3d4-0001-4000-8000-000000000003', 'Empresa ABC Ltda', '(11) 97777-9012', 'contato@abc.com', 'em_atendimento', 15000, 'a1b2c3d4-0001-4000-8000-000000000001', 'indicacao', ARRAY['comercial','grande porte'], 'Pintura de escritório inteiro', '2026-03-18T14:00:00Z', '2026-03-22T11:00:00Z', '2026-03-24T10:00:00Z'),
  ('c1b2c3d4-0001-4000-8000-000000000004', 'Roberto Lima', '(11) 96666-3456', NULL, 'em_atendimento', 4800, 'a1b2c3d4-0001-4000-8000-000000000003', 'meta', ARRAY['residencial'], 'Casa nova, precisa de tudo', '2026-03-19T16:00:00Z', '2026-03-23T09:00:00Z', NULL),
  ('c1b2c3d4-0001-4000-8000-000000000005', 'Condomínio Solar', '(11) 95555-7890', 'sindico@solar.com', 'orcamento_enviado', 28000, 'a1b2c3d4-0001-4000-8000-000000000002', 'google', ARRAY['condominio','grande porte'], 'Pintura da fachada do prédio', '2026-03-15T10:00:00Z', '2026-03-22T15:00:00Z', '2026-03-26T09:00:00Z'),
  ('c1b2c3d4-0001-4000-8000-000000000006', 'Fernanda Alves', '(11) 94444-1234', NULL, 'orcamento_enviado', 6200, 'a1b2c3d4-0001-4000-8000-000000000004', 'whatsapp', ARRAY['residencial'], 'Quartos e sala', '2026-03-17T11:00:00Z', '2026-03-23T14:00:00Z', NULL),
  ('c1b2c3d4-0001-4000-8000-000000000007', 'Restaurante Sabor & Arte', '(11) 93333-5678', NULL, 'negociacao', 9500, 'a1b2c3d4-0001-4000-8000-000000000001', 'indicacao', ARRAY['comercial','restaurante'], 'Negociando desconto para pintura completa', '2026-03-10T08:00:00Z', '2026-03-23T16:00:00Z', '2026-03-24T15:00:00Z'),
  ('c1b2c3d4-0001-4000-8000-000000000008', 'Escola Futuro Brilhante', '(11) 92222-9012', 'direcao@futuro.edu', 'negociacao', 18000, 'a1b2c3d4-0001-4000-8000-000000000003', 'meta', ARRAY['institucional','grande porte'], 'Pintura nas férias escolares', '2026-03-12T13:00:00Z', '2026-03-22T10:00:00Z', NULL),
  ('c1b2c3d4-0001-4000-8000-000000000009', 'Lucas Mendes', '(11) 91111-3456', NULL, 'fechado', 2800, 'a1b2c3d4-0001-4000-8000-000000000002', 'whatsapp', ARRAY['residencial'], 'Venda concluída - tinta Suvinil', '2026-03-05T10:00:00Z', '2026-03-20T17:00:00Z', NULL),
  ('c1b2c3d4-0001-4000-8000-000000000010', 'Clínica Saúde Total', '(11) 90000-7890', 'admin@saudetotal.com', 'fechado', 12000, 'a1b2c3d4-0001-4000-8000-000000000004', 'google', ARRAY['comercial','saude'], 'Entrega programada para semana que vem', '2026-03-08T09:00:00Z', '2026-03-21T11:00:00Z', NULL),
  ('c1b2c3d4-0001-4000-8000-000000000011', 'Patricia Gomes', '(11) 99876-5432', NULL, 'novo_lead', 800, 'a1b2c3d4-0001-4000-8000-000000000004', 'instagram', ARRAY['residencial','pequeno'], 'Quer apenas um quarto', '2026-03-23T08:00:00Z', '2026-03-23T08:00:00Z', NULL),
  ('c1b2c3d4-0001-4000-8000-000000000012', 'Loja FastShop', '(11) 98765-4321', NULL, 'em_atendimento', 7500, 'a1b2c3d4-0001-4000-8000-000000000002', 'indicacao', ARRAY['comercial','loja'], 'Reforma da fachada', '2026-03-16T14:00:00Z', '2026-03-23T10:00:00Z', NULL);

-- Insert follow-ups
INSERT INTO public.follow_ups (id, lead_id, client_name, client_phone, scheduled_at, description, completed, assigned_to, type) VALUES
  ('d1b2c3d4-0001-4000-8000-000000000001', 'c1b2c3d4-0001-4000-8000-000000000001', 'João Pereira', '(11) 99999-1234', '2026-03-25T14:00:00Z', 'Ligar para confirmar interesse na tinta para sala', false, 'a1b2c3d4-0001-4000-8000-000000000001', 'call'),
  ('d1b2c3d4-0001-4000-8000-000000000002', 'c1b2c3d4-0001-4000-8000-000000000003', 'Empresa ABC Ltda', '(11) 97777-9012', '2026-03-24T10:00:00Z', 'Enviar proposta detalhada por email', false, 'a1b2c3d4-0001-4000-8000-000000000001', 'email'),
  ('d1b2c3d4-0001-4000-8000-000000000003', 'c1b2c3d4-0001-4000-8000-000000000005', 'Condomínio Solar', '(11) 95555-7890', '2026-03-26T09:00:00Z', 'Follow-up do orçamento da fachada', false, 'a1b2c3d4-0001-4000-8000-000000000002', 'whatsapp'),
  ('d1b2c3d4-0001-4000-8000-000000000004', 'c1b2c3d4-0001-4000-8000-000000000007', 'Restaurante Sabor & Arte', '(11) 93333-5678', '2026-03-24T15:00:00Z', 'Negociar desconto final e fechar', false, 'a1b2c3d4-0001-4000-8000-000000000001', 'visit'),
  ('d1b2c3d4-0001-4000-8000-000000000005', 'c1b2c3d4-0001-4000-8000-000000000002', 'Maria Souza', '(11) 98888-5678', '2026-03-23T16:00:00Z', 'Retornar sobre orçamento solicitado', true, 'a1b2c3d4-0001-4000-8000-000000000002', 'whatsapp'),
  ('d1b2c3d4-0001-4000-8000-000000000006', 'c1b2c3d4-0001-4000-8000-000000000008', 'Escola Futuro Brilhante', '(11) 92222-9012', '2026-03-27T10:00:00Z', 'Agendar visita técnica para medição', false, 'a1b2c3d4-0001-4000-8000-000000000003', 'visit'),
  ('d1b2c3d4-0001-4000-8000-000000000007', 'c1b2c3d4-0001-4000-8000-000000000004', 'Roberto Lima', '(11) 96666-3456', '2026-03-24T11:00:00Z', 'Enviar catálogo de cores por WhatsApp', false, 'a1b2c3d4-0001-4000-8000-000000000003', 'whatsapp');

-- Insert campaigns
INSERT INTO public.campaigns (id, name, channel, start_date, end_date, budget, leads_generated, conversions, status) VALUES
  ('e1b2c3d4-0001-4000-8000-000000000001', 'Promoção Verão 2026', 'instagram', '2026-01-15', '2026-03-15', 5000, 45, 12, 'completed'),
  ('e1b2c3d4-0001-4000-8000-000000000002', 'WhatsApp - Ofertas Semanais', 'whatsapp', '2026-03-01', NULL, 500, 28, 8, 'active'),
  ('e1b2c3d4-0001-4000-8000-000000000003', 'Meta Ads - Tintas Premium', 'meta', '2026-03-10', NULL, 3000, 32, 5, 'active'),
  ('e1b2c3d4-0001-4000-8000-000000000004', 'Google Ads - Loja de Tintas SP', 'google', '2026-02-01', NULL, 4500, 60, 15, 'active'),
  ('e1b2c3d4-0001-4000-8000-000000000005', 'Indicação Premiada', 'indicacao', '2026-01-01', NULL, 1000, 18, 10, 'active');

-- Insert interactions
INSERT INTO public.interactions (id, client_id, lead_id, type, description, created_by, created_at) VALUES
  ('f1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0001-4000-8000-000000000001', 'c1b2c3d4-0001-4000-8000-000000000001', 'whatsapp', 'Cliente pediu orçamento para pintura da sala', 'a1b2c3d4-0001-4000-8000-000000000001', '2026-03-20T10:00:00Z'),
  ('f1b2c3d4-0001-4000-8000-000000000002', 'b1b2c3d4-0001-4000-8000-000000000001', 'c1b2c3d4-0001-4000-8000-000000000001', 'phone', 'Ligou para confirmar medidas do ambiente', 'a1b2c3d4-0001-4000-8000-000000000001', '2026-03-21T14:30:00Z'),
  ('f1b2c3d4-0001-4000-8000-000000000003', 'b1b2c3d4-0001-4000-8000-000000000003', 'c1b2c3d4-0001-4000-8000-000000000003', 'visit', 'Visita técnica ao escritório para medição', 'a1b2c3d4-0001-4000-8000-000000000001', '2026-03-19T09:00:00Z'),
  ('f1b2c3d4-0001-4000-8000-000000000004', 'b1b2c3d4-0001-4000-8000-000000000003', 'c1b2c3d4-0001-4000-8000-000000000003', 'email', 'Enviado orçamento detalhado com 3 opções de tinta', 'a1b2c3d4-0001-4000-8000-000000000001', '2026-03-22T11:00:00Z'),
  ('f1b2c3d4-0001-4000-8000-000000000005', 'b1b2c3d4-0001-4000-8000-000000000002', NULL, 'whatsapp', 'Novo contato via Instagram, quer pintar apartamento', 'a1b2c3d4-0001-4000-8000-000000000002', '2026-03-21T09:00:00Z');
