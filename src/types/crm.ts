export type KanbanStage = 'abordagem' | 'sondagem' | 'recomendacao_tecnica' | 'demonstracao_valor' | 'contorno_objecoes' | 'cross_sell' | 'precificacao_especial' | 'fechamento' | 'pos_venda' | 'perdido';

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
   clientType?: string;
   companyWorkSite?: string;
   interestProducts?: string;
   storeName?: string;
   storeId?: string;
   lostReason?: string;
   closedAt?: string;
   archived?: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  cpfCnpj?: string;
  zipCode?: string;
  tags: string[];
  totalPurchases: number;
  lastContact?: string;
  createdAt: string;
  notes?: string;
  purchaseCount?: number;
  clientType?: string;
  lastPurchaseAt?: string;
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
  store_id?: string;
  leadsCount: number;
  conversions: number;
}

export const KANBAN_STAGES: { key: KanbanStage; label: string; color: string }[] = [
  { key: 'abordagem', label: 'Abordagem', color: 'kanban-approach' },
  { key: 'sondagem', label: 'Sondagem', color: 'kanban-probing' },
  { key: 'recomendacao_tecnica', label: 'Recomendação', color: 'kanban-recommendation' },
  { key: 'precificacao_especial', label: 'Orçamento e Preço', color: 'kanban-pricing' },
  { key: 'demonstracao_valor', label: 'Demonstração', color: 'kanban-demonstration' },
  { key: 'contorno_objecoes', label: 'Objeções', color: 'kanban-objections' },
  { key: 'cross_sell', label: 'Cross-sell', color: 'kanban-crosssell' },
  { key: 'fechamento', label: 'Fechamento', color: 'kanban-closing' },
  { key: 'pos_venda', label: 'Pós-Venda', color: 'kanban-postsale' },
];
