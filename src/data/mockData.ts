import { Lead, Client, FollowUp, Campaign, Seller, Interaction } from '@/types/crm';

export const mockSellers: Seller[] = [
  { id: '1', name: 'Carlos Silva', role: 'vendedor', leadsCount: 24, conversions: 8 },
  { id: '2', name: 'Ana Oliveira', role: 'vendedor', leadsCount: 18, conversions: 12 },
  { id: '3', name: 'Pedro Santos', role: 'gerente', leadsCount: 15, conversions: 6 },
  { id: '4', name: 'Maria Costa', role: 'vendedor', leadsCount: 20, conversions: 10 },
];

export const mockLeads: Lead[] = [
  { id: 'l1', clientName: 'João Pereira', clientPhone: '(11) 99999-1234', clientEmail: 'joao@email.com', stage: 'novo_lead', value: 3500, assignedTo: '1', source: 'whatsapp', tags: ['residencial'], notes: 'Interessado em tinta para sala', createdAt: '2026-03-20T10:00:00', updatedAt: '2026-03-20T10:00:00', nextFollowUp: '2026-03-25T14:00:00' },
  { id: 'l2', clientName: 'Maria Souza', clientPhone: '(11) 98888-5678', stage: 'novo_lead', value: 1200, assignedTo: '2', source: 'instagram', tags: ['residencial', 'apartamento'], notes: 'Quer orçamento para pintura completa', createdAt: '2026-03-21T09:00:00', updatedAt: '2026-03-21T09:00:00' },
  { id: 'l3', clientName: 'Empresa ABC Ltda', clientPhone: '(11) 97777-9012', clientEmail: 'contato@abc.com', stage: 'em_atendimento', value: 15000, assignedTo: '1', source: 'indicacao', tags: ['comercial', 'grande porte'], notes: 'Pintura de escritório inteiro', createdAt: '2026-03-18T14:00:00', updatedAt: '2026-03-22T11:00:00', nextFollowUp: '2026-03-24T10:00:00' },
  { id: 'l4', clientName: 'Roberto Lima', clientPhone: '(11) 96666-3456', stage: 'em_atendimento', value: 4800, assignedTo: '3', source: 'meta', tags: ['residencial'], notes: 'Casa nova, precisa de tudo', createdAt: '2026-03-19T16:00:00', updatedAt: '2026-03-23T09:00:00' },
  { id: 'l5', clientName: 'Condomínio Solar', clientPhone: '(11) 95555-7890', clientEmail: 'sindico@solar.com', stage: 'orcamento_enviado', value: 28000, assignedTo: '2', source: 'google', tags: ['condominio', 'grande porte'], notes: 'Pintura da fachada do prédio', createdAt: '2026-03-15T10:00:00', updatedAt: '2026-03-22T15:00:00', nextFollowUp: '2026-03-26T09:00:00' },
  { id: 'l6', clientName: 'Fernanda Alves', clientPhone: '(11) 94444-1234', stage: 'orcamento_enviado', value: 6200, assignedTo: '4', source: 'whatsapp', tags: ['residencial'], notes: 'Quartos e sala', createdAt: '2026-03-17T11:00:00', updatedAt: '2026-03-23T14:00:00' },
  { id: 'l7', clientName: 'Restaurante Sabor & Arte', clientPhone: '(11) 93333-5678', stage: 'negociacao', value: 9500, assignedTo: '1', source: 'indicacao', tags: ['comercial', 'restaurante'], notes: 'Negociando desconto para pintura completa', createdAt: '2026-03-10T08:00:00', updatedAt: '2026-03-23T16:00:00', nextFollowUp: '2026-03-24T15:00:00' },
  { id: 'l8', clientName: 'Escola Futuro Brilhante', clientPhone: '(11) 92222-9012', clientEmail: 'direcao@futuro.edu', stage: 'negociacao', value: 18000, assignedTo: '3', source: 'meta', tags: ['institucional', 'grande porte'], notes: 'Pintura nas férias escolares', createdAt: '2026-03-12T13:00:00', updatedAt: '2026-03-22T10:00:00' },
  { id: 'l9', clientName: 'Lucas Mendes', clientPhone: '(11) 91111-3456', stage: 'fechado', value: 2800, assignedTo: '2', source: 'whatsapp', tags: ['residencial'], notes: 'Venda concluída - tinta Suvinil', createdAt: '2026-03-05T10:00:00', updatedAt: '2026-03-20T17:00:00' },
  { id: 'l10', clientName: 'Clínica Saúde Total', clientPhone: '(11) 90000-7890', clientEmail: 'admin@saudetotal.com', stage: 'fechado', value: 12000, assignedTo: '4', source: 'google', tags: ['comercial', 'saude'], notes: 'Entrega programada para semana que vem', createdAt: '2026-03-08T09:00:00', updatedAt: '2026-03-21T11:00:00' },
  { id: 'l11', clientName: 'Patricia Gomes', clientPhone: '(11) 99876-5432', stage: 'novo_lead', value: 800, assignedTo: '4', source: 'instagram', tags: ['residencial', 'pequeno'], notes: 'Quer apenas um quarto', createdAt: '2026-03-23T08:00:00', updatedAt: '2026-03-23T08:00:00' },
  { id: 'l12', clientName: 'Loja FastShop', clientPhone: '(11) 98765-4321', stage: 'em_atendimento', value: 7500, assignedTo: '2', source: 'indicacao', tags: ['comercial', 'loja'], notes: 'Reforma da fachada', createdAt: '2026-03-16T14:00:00', updatedAt: '2026-03-23T10:00:00' },
];

export const mockClients: Client[] = [
  { id: 'c1', name: 'João Pereira', phone: '(11) 99999-1234', email: 'joao@email.com', address: 'Rua das Flores, 123', city: 'São Paulo', tags: ['residencial', 'fidelizado'], totalPurchases: 12500, lastContact: '2026-03-20T10:00:00', createdAt: '2025-06-15', notes: 'Cliente fiel, sempre compra Suvinil' },
  { id: 'c2', name: 'Maria Souza', phone: '(11) 98888-5678', email: 'maria@email.com', address: 'Av. Paulista, 456', city: 'São Paulo', tags: ['residencial', 'apartamento'], totalPurchases: 3200, lastContact: '2026-03-21T09:00:00', createdAt: '2025-11-20' },
  { id: 'c3', name: 'Empresa ABC Ltda', phone: '(11) 97777-9012', email: 'contato@abc.com', address: 'Rua Comercial, 789', city: 'Guarulhos', tags: ['comercial', 'grande porte'], totalPurchases: 45000, lastContact: '2026-03-22T11:00:00', createdAt: '2024-03-10', notes: 'Conta corporativa, pagamento 30 dias' },
  { id: 'c4', name: 'Roberto Lima', phone: '(11) 96666-3456', address: 'Rua Nova, 321', city: 'Osasco', tags: ['residencial', 'novo'], totalPurchases: 0, lastContact: '2026-03-23T09:00:00', createdAt: '2026-03-19' },
  { id: 'c5', name: 'Fernanda Alves', phone: '(11) 94444-1234', email: 'fernanda@email.com', city: 'São Paulo', tags: ['residencial'], totalPurchases: 8900, lastContact: '2026-03-23T14:00:00', createdAt: '2025-08-05' },
  { id: 'c6', name: 'Lucas Mendes', phone: '(11) 91111-3456', address: 'Rua do Parque, 555', city: 'Santo André', tags: ['residencial', 'fidelizado'], totalPurchases: 15600, lastContact: '2026-03-20T17:00:00', createdAt: '2025-01-12' },
];

export const mockFollowUps: FollowUp[] = [
  { id: 'f1', leadId: 'l1', clientName: 'João Pereira', clientPhone: '(11) 99999-1234', scheduledAt: '2026-03-25T14:00:00', description: 'Ligar para confirmar interesse na tinta para sala', completed: false, assignedTo: '1', type: 'call' },
  { id: 'f2', leadId: 'l3', clientName: 'Empresa ABC Ltda', clientPhone: '(11) 97777-9012', scheduledAt: '2026-03-24T10:00:00', description: 'Enviar proposta detalhada por email', completed: false, assignedTo: '1', type: 'email' },
  { id: 'f3', leadId: 'l5', clientName: 'Condomínio Solar', clientPhone: '(11) 95555-7890', scheduledAt: '2026-03-26T09:00:00', description: 'Follow-up do orçamento da fachada', completed: false, assignedTo: '2', type: 'whatsapp' },
  { id: 'f4', leadId: 'l7', clientName: 'Restaurante Sabor & Arte', clientPhone: '(11) 93333-5678', scheduledAt: '2026-03-24T15:00:00', description: 'Negociar desconto final e fechar', completed: false, assignedTo: '1', type: 'visit' },
  { id: 'f5', leadId: 'l2', clientName: 'Maria Souza', clientPhone: '(11) 98888-5678', scheduledAt: '2026-03-23T16:00:00', description: 'Retornar sobre orçamento solicitado', completed: true, assignedTo: '2', type: 'whatsapp' },
  { id: 'f6', leadId: 'l8', clientName: 'Escola Futuro Brilhante', clientPhone: '(11) 92222-9012', scheduledAt: '2026-03-27T10:00:00', description: 'Agendar visita técnica para medição', completed: false, assignedTo: '3', type: 'visit' },
  { id: 'f7', leadId: 'l4', clientName: 'Roberto Lima', clientPhone: '(11) 96666-3456', scheduledAt: '2026-03-24T11:00:00', description: 'Enviar catálogo de cores por WhatsApp', completed: false, assignedTo: '3', type: 'whatsapp' },
];

export const mockCampaigns: Campaign[] = [
  { id: 'cp1', name: 'Promoção Verão 2026', channel: 'instagram', startDate: '2026-01-15', endDate: '2026-03-15', budget: 5000, leadsGenerated: 45, conversions: 12, status: 'completed' },
  { id: 'cp2', name: 'WhatsApp - Ofertas Semanais', channel: 'whatsapp', startDate: '2026-03-01', budget: 500, leadsGenerated: 28, conversions: 8, status: 'active' },
  { id: 'cp3', name: 'Meta Ads - Tintas Premium', channel: 'meta', startDate: '2026-03-10', budget: 3000, leadsGenerated: 32, conversions: 5, status: 'active' },
  { id: 'cp4', name: 'Google Ads - Loja de Tintas SP', channel: 'google', startDate: '2026-02-01', budget: 4500, leadsGenerated: 60, conversions: 15, status: 'active' },
  { id: 'cp5', name: 'Indicação Premiada', channel: 'indicacao', startDate: '2026-01-01', budget: 1000, leadsGenerated: 18, conversions: 10, status: 'active' },
];

export const mockInteractions: Interaction[] = [
  { id: 'i1', clientId: 'c1', leadId: 'l1', type: 'whatsapp', description: 'Cliente pediu orçamento para pintura da sala', createdAt: '2026-03-20T10:00:00', createdBy: '1' },
  { id: 'i2', clientId: 'c1', leadId: 'l1', type: 'phone', description: 'Ligou para confirmar medidas do ambiente', createdAt: '2026-03-21T14:30:00', createdBy: '1' },
  { id: 'i3', clientId: 'c3', leadId: 'l3', type: 'visit', description: 'Visita técnica ao escritório para medição', createdAt: '2026-03-19T09:00:00', createdBy: '1' },
  { id: 'i4', clientId: 'c3', leadId: 'l3', type: 'email', description: 'Enviado orçamento detalhado com 3 opções de tinta', createdAt: '2026-03-22T11:00:00', createdBy: '1' },
  { id: 'i5', clientId: 'c2', type: 'whatsapp', description: 'Novo contato via Instagram, quer pintar apartamento', createdAt: '2026-03-21T09:00:00', createdBy: '2' },
];
