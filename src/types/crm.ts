export type KanbanStage = 'novo_lead' | 'em_atendimento' | 'precificacao_especial' | 'orcamento_enviado' | 'negociacao' | 'fechado';

export interface Lead {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  stage: KanbanStage;
  value: number;
  assignedTo: string;
  source: string;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  nextFollowUp?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  tags: string[];
  totalPurchases: number;
  lastContact?: string;
  createdAt: string;
  notes?: string;
}

export interface Interaction {
  id: string;
  clientId: string;
  leadId?: string;
  type: 'whatsapp' | 'phone' | 'email' | 'visit' | 'note';
  description: string;
  createdAt: string;
  createdBy: string;
}

export interface FollowUp {
  id: string;
  leadId: string;
  clientName: string;
  clientPhone: string;
  scheduledAt: string;
  description: string;
  completed: boolean;
  assignedTo: string;
  type: 'call' | 'whatsapp' | 'visit' | 'email';
}

export interface Campaign {
  id: string;
  name: string;
  channel: 'whatsapp' | 'meta' | 'instagram' | 'google' | 'indicacao';
  startDate: string;
  endDate?: string;
  budget: number;
  leadsGenerated: number;
  conversions: number;
  status: 'active' | 'paused' | 'completed';
}

export interface Seller {
  id: string;
  name: string;
  avatar?: string;
  role: 'vendedor' | 'gerente';
  leadsCount: number;
  conversions: number;
}

export const KANBAN_STAGES: { key: KanbanStage; label: string; color: string }[] = [
  { key: 'novo_lead', label: 'Novo Lead', color: 'kanban-new' },
  { key: 'em_atendimento', label: 'Em Atendimento', color: 'kanban-attending' },
  { key: 'orcamento_enviado', label: 'Orçamento Enviado', color: 'kanban-quote' },
  { key: 'negociacao', label: 'Negociação', color: 'kanban-negotiation' },
  { key: 'fechado', label: 'Fechado', color: 'kanban-closed' },
];
