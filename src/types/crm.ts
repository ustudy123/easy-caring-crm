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
   snoozedUntil?: string;
   urgencyAcknowledgedAt?: string;
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
  assignedSellerId?: string | null;
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
  storeId?: string;
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
  code?: string | null;
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

// Tipo de Cliente especial: leads "Equipe Interna" não aparecem no Kanban e
// suas conversas ficam em uma aba separada na página de Conversas.
export const CLIENT_TYPE_EQUIPE_INTERNA = "Equipe Interna";

// Motivos de encerramento. Ficam aqui para o Kanban (onde são escolhidos) e o
// Relatório de Encerramentos (onde são filtrados) usarem a MESMA lista — antes
// o relatório montava as opções só com o que já havia acontecido, então motivo
// novo ou pouco usado não aparecia no filtro.
export const VENDA_CONCLUIDA = "Venda concluída";
export const REAGENDAR = "Quero reagendar";
export const LOST_REASONS = [
  "Cliente sem Recurso Financeiro",
  "Sem Interesse (Só pesquisando)",
  "Cliente não fechou por preço",
  "Tentativas de contato esgotadas",
  "Conversa Interna",
] as const;

// Lista única de Tipos de Cliente. Estava duplicada nos formulários de lead;
// centralizar evita que as opções divirjam entre as telas.
export const CLIENT_TYPES = [
  "Pintor",
  "Arquiteto/Construtor",
  "Consumidor Final",
  "Empresa/Obra",
  CLIENT_TYPE_EQUIPE_INTERNA,
] as const;

// Origens de lead (rótulo exibido + valor gravado na coluna `source`).
// Fonte única usada em NewLeadForm e EditLeadForm. Manter em ordem alfabética
// por rótulo — ao adicionar uma origem nova, inserir na posição correta.
export const LEAD_SOURCES: { value: string; label: string }[] = [
  { value: "campanha", label: "Campanha" },
  { value: "google", label: "Google" },
  { value: "indicacao", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "loja", label: "Loja" },
  { value: "meta", label: "Meta Ads" },
  { value: "prospeccao", label: "Prospecção" },
  { value: "site", label: "Site" },
  { value: "whatsapp", label: "WhatsApp" },
];
