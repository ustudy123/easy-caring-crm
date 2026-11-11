// Qualificação de clientes da equipe externa (documento "Qualificação de
// Clientes — Tintas Industriais", reunião de 28/10). Cada grupo de perguntas
// precisa estar preenchido para o card passar da etapa indicada: o funil anda
// etapa a etapa, sem pular. Mover para trás, perder ou reagendar é sempre livre.
import { KANBAN_STAGES, type KanbanStage, type Lead } from "@/types/crm";

export interface LeadQualification {
  // Etapas 2 e 3 — Sondagem e Recomendação
  paintTypes?: string[];
  paintTypesOther?: string;
  applicationPlace?: string;
  applicationPlaceOther?: string;
  surfacePrep?: string;
  brands?: string[];
  brandsOther?: string;
  applicationMethod?: string;
  technicalProblems?: string[];
  desiredImprovements?: string;
  // Etapas 4 e 5 — Orçamentação e Demonstração de valor
  petrobrasNorms?: boolean;
  techSpec?: boolean;
  techSpecWhich?: string;
  industrialTests?: boolean;
  purchaseDecision?: string;
  purchaseDecisionNotes?: string;
  // Etapa 6 — Objeções
  objections?: string[];
  objectionsOther?: string;
  // Etapa 7 — Venda adicional
  monthlyVolume?: string;
  // Etapa 8 — Fechamento
  orderSentAt?: string;
  orderCoversTotal?: boolean;
  nextOrderForecastAt?: string;
  postSaleAt?: string;
  // Etapa 9 — Pós-venda
  postSaleVisitAt?: string;
  deliveryRating?: number;
  productRating?: number;
  postSaleNotes?: string;
  /** áudio explicando a nota baixa (Storage seller-files, pasta posvenda/), alternativa ao texto */
  postSaleAudioPath?: string;
}

export const OTHER_PAINT = "Outras especificações ou sistemas de pintura";
export const OTHER_PLACE = "Outras peças";
export const OTHER_BRAND = "Outras marcas";
export const OTHER_PROBLEM = "Melhorias técnicas desejadas pelo cliente";
export const OTHER_OBJECTION = "Outra objeção";

export const PAINT_TYPES = [
  "Poliuretano (PU)", "Epóxi", "Anticrustante / antifouling", "Tintas para alta temperatura",
  "Primer / fundo anticorrosivo", "Esmaltes e outros acabamentos", OTHER_PAINT,
];
export const APPLICATION_PLACES = ["Tubulações", "Chapas", OTHER_PLACE];
export const SURFACE_PREPS = ["St2 e St3", "Jato abrasivo", "Hidrojateamento"];
export const BRANDS = ["WEG", "Akzo", "Renner", "Sherwin", OTHER_BRAND];
export const APPLICATION_METHODS = ["Pistola convencional", "Airless", "Rolo e trincha"];
export const TECHNICAL_PROBLEMS = [
  "Retrabalho, repintura ou descarte",
  "Problemas de aderência, corrosão ou descascamento",
  "Defeitos de acabamento, secagem ou cura",
  "Dificuldades de aplicação ou rendimento",
  "Não conformidades de espessura ou inspeção",
  "Impactos na produtividade, qualidade ou custo",
  OTHER_PROBLEM,
];
export const PURCHASE_DECISIONS = [
  "Influência do responsável técnico pela especificação",
  "Apenas o responsável de compras",
  "Decisor final e demais influenciadores internos",
];
export const OBJECTION_GROUPS: { title: string; options: string[] }[] = [
  {
    title: "Comercial",
    options: [
      "O preço por litro/galão está muito acima do concorrente",
      "O custo/m² está acima do concorrente",
      "O custo de manutenção/Ciclo de Vida (LCC) não justifica a pintura de alta performance",
      "O prazo de pagamento não está adequado para aprovação",
    ],
  },
  {
    title: "Técnica",
    options: [
      "Tenho dúvidas se resiste ao meu ambiente de corrosividade (C3, C4, C5, CX ou imersão)",
      "Espessura necessária (EPS) exige equipamento que o cliente não possui",
      "O esquema de pintura especificado exige etapas/demãos demais",
    ],
  },
  {
    title: "Normas",
    options: [
      "A especificação não atende às normas do setor (PETROBRAS, ISO, NORSOK)",
      "Exigência de suporte técnico em campo",
    ],
  },
  {
    title: "Risco de mudança e supply chain",
    options: [
      "Já usamos a marca X há anos e nunca tivemos problemas",
      "Prazo de entrega e disponibilidade do produto",
    ],
  },
  { title: "Outras", options: [OTHER_OBJECTION] },
];
export const MONTHLY_VOLUMES = ["Até 100 litros", "Até 200 litros", "Até 400 litros", "Acima de 400 litros"];

/** Nota até este valor exige explicação no pós-venda. */
export const LOW_RATING = 3;
export const LOW_RATING_MIN_CHARS = 20;

export interface QualificationGroup {
  key: string;
  title: string;
  /** O card só chega nesta etapa (ou depois) com o grupo completo. */
  requiredToReach: KanbanStage | null;
  /** Rótulos do que falta preencher. */
  missing: (lead: Lead) => string[];
}

const q = (lead: Lead): LeadQualification => lead.qualification ?? {};
const filled = (s?: string) => !!s && s.trim().length > 0;
const pickedWithOther = (values: string[] | undefined, other: string, otherText?: string) =>
  !!values?.length && (!values.includes(other) || filled(otherText));

export const QUALIFICATION_GROUPS: QualificationGroup[] = [
  {
    key: "abordagem",
    title: "Etapa 1 · Abordagem",
    requiredToReach: "sondagem",
    missing: (l) => [
      !filled(l.clientName) && "Nome do cliente",
      !filled(l.clientType) && "Tipo de cliente",
      !filled(l.companyWorkSite) && "Empresa/Obra",
      !filled(l.city) && "Cidade",
      !l.segment && "Segmento",
      !filled(l.clientPhone) && "Telefone",
      !filled(l.clientEmail) && "E-mail",
      !filled(l.source) && "Origem",
      !l.lastContactAt && "Último contato",
      (!l.nextAction || !l.nextActionAt) && "Próxima ação com data",
    ].filter(Boolean) as string[],
  },
  {
    key: "sondagem",
    title: "Etapas 2 e 3 · Sondagem e Recomendação",
    requiredToReach: "precificacao_especial",
    missing: (l) => {
      const x = q(l);
      return [
        !filled(l.interestProducts) && "Interesse/Produto/Projeto",
        !pickedWithOther(x.paintTypes, OTHER_PAINT, x.paintTypesOther) && "Tipos de tinta utilizados",
        !(filled(x.applicationPlace) && (x.applicationPlace !== OTHER_PLACE || filled(x.applicationPlaceOther))) && "Local de aplicação",
        !filled(x.surfacePrep) && "Preparação de superfície",
        !pickedWithOther(x.brands, OTHER_BRAND, x.brandsOther) && "Marcas utilizadas",
        !filled(x.applicationMethod) && "Método de aplicação",
        !pickedWithOther(x.technicalProblems, OTHER_PROBLEM, x.desiredImprovements) && "Problemas técnicos e de qualidade",
      ].filter(Boolean) as string[];
    },
  },
  {
    key: "orcamento",
    title: "Etapas 4 e 5 · Orçamentação e Demonstração de valor",
    requiredToReach: "contorno_objecoes",
    missing: (l) => {
      const x = q(l);
      return [
        x.petrobrasNorms === undefined && "Utiliza normas Petrobras?",
        (x.techSpec === undefined || (x.techSpec && !filled(x.techSpecWhich))) && "Especificação técnica (qual)",
        x.industrialTests === undefined && "Testes industriais ou amostras?",
        !filled(x.purchaseDecision) && "Como é tomada a decisão de compra",
        !(l.value > 0) && "Valor do orçamento",
        (!l.nextAction || !l.nextActionAt) && "Data do próximo contato (próxima ação)",
      ].filter(Boolean) as string[];
    },
  },
  {
    key: "objecoes",
    title: "Etapa 6 · Objeções",
    requiredToReach: "cross_sell",
    missing: (l) => {
      const x = q(l);
      return pickedWithOther(x.objections, OTHER_OBJECTION, x.objectionsOther) ? [] : ["Mapeamento das objeções"];
    },
  },
  {
    key: "venda_adicional",
    title: "Etapa 7 · Venda adicional",
    requiredToReach: "fechamento",
    missing: (l) => (filled(q(l).monthlyVolume) ? [] : ["Volume médio de tinta por mês"]),
  },
  {
    key: "fechamento",
    title: "Etapa 8 · Fechamento",
    requiredToReach: "pos_venda",
    missing: (l) => {
      const x = q(l);
      return [
        !x.orderSentAt && "Data do envio do pedido",
        x.orderCoversTotal === undefined && "O pedido atende a necessidade total do projeto?",
        x.orderCoversTotal === false && !x.nextOrderForecastAt && "Previsão do próximo pedido",
        !x.postSaleAt && "Data do pós-venda",
      ].filter(Boolean) as string[];
    },
  },
  {
    key: "pos_venda",
    title: "Etapa 9 · Pós-venda",
    requiredToReach: null,
    missing: (l) => {
      const x = q(l);
      return [
        !x.postSaleVisitAt && "Data da visita ao cliente",
        !x.deliveryRating && "Avaliação da entrega",
        !x.productRating && "Avaliação do sistema de pintura/produtos",
        postSaleNotesError(x) && "Explicação da nota (mínimo de 20 caracteres ou um áudio)",
      ].filter(Boolean) as string[];
    },
  },
];

const stageIndex = (s: KanbanStage) => KANBAN_STAGES.findIndex((k) => k.key === s);

/** Nota 3 ou menos exige explicação com ao menos 20 caracteres. */
export function postSaleNotesError(x: LeadQualification): string | null {
  const low = [x.deliveryRating, x.productRating].some((r) => !!r && r <= LOW_RATING);
  if (low && !x.postSaleAudioPath && (x.postSaleNotes ?? "").trim().length < LOW_RATING_MIN_CHARS) {
    return `Com nota ${LOW_RATING} ou menos, explique o ocorrido (mínimo de ${LOW_RATING_MIN_CHARS} caracteres) ou grave um áudio.`;
  }
  return null;
}

/**
 * O que falta para o lead chegar em `target`. Vazio = pode mover. Só bloqueia
 * avanço: voltar etapas e encerrar como perdido nunca pedem nada.
 */
export function missingForStage(lead: Lead, target: KanbanStage): { group: QualificationGroup; items: string[] }[] {
  if (target === "perdido") return [];
  const to = stageIndex(target);
  const from = stageIndex(lead.stage);
  if (to < 0 || (from >= 0 && to <= from)) return [];
  return QUALIFICATION_GROUPS
    .filter((g) => g.requiredToReach && stageIndex(g.requiredToReach) <= to)
    .map((group) => ({ group, items: group.missing(lead) }))
    .filter((r) => r.items.length > 0);
}

/** Progresso para o card: grupos completos até a etapa atual do lead (inclusive o próximo passo). */
export function qualificationProgress(lead: Lead): { done: number; total: number } {
  const groups = QUALIFICATION_GROUPS.filter((g) => g.requiredToReach);
  return { done: groups.filter((g) => g.missing(lead).length === 0).length, total: groups.length };
}

export function stageLabel(stage: KanbanStage): string {
  return KANBAN_STAGES.find((s) => s.key === stage)?.label ?? (stage === "perdido" ? "Perdido" : stage);
}
