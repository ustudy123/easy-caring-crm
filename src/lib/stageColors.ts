import type { KanbanStage } from "@/types/crm";

/**
 * Cores das etapas no Kanban: do frio (início do funil) ao verde (venda).
 * Vermelho, laranja e amarelo ficam de fora porque indicam urgência nos cards.
 * As classes são escritas por extenso para o Tailwind gerá-las.
 */
export interface StageColor {
  /** Bolinha e faixa do topo do cabeçalho. */
  solid: string;
  /** Fundo suave do cabeçalho da coluna. */
  soft: string;
  /** Texto do nome da etapa. */
  text: string;
  /** Atalho da etapa no celular. */
  chip: string;
}

export const STAGE_COLORS: Record<KanbanStage, StageColor> = {
  abordagem:             { solid: "bg-sky-500",     soft: "bg-sky-50",     text: "text-sky-800",     chip: "border-sky-200 bg-sky-50 text-sky-800" },
  sondagem:              { solid: "bg-blue-600",    soft: "bg-blue-50",    text: "text-blue-800",    chip: "border-blue-200 bg-blue-50 text-blue-800" },
  recomendacao_tecnica:  { solid: "bg-indigo-500",  soft: "bg-indigo-50",  text: "text-indigo-800",  chip: "border-indigo-200 bg-indigo-50 text-indigo-800" },
  precificacao_especial: { solid: "bg-violet-500",  soft: "bg-violet-50",  text: "text-violet-800",  chip: "border-violet-200 bg-violet-50 text-violet-800" },
  demonstracao_valor:    { solid: "bg-fuchsia-500", soft: "bg-fuchsia-50", text: "text-fuchsia-800", chip: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800" },
  contorno_objecoes:     { solid: "bg-slate-500",   soft: "bg-slate-100",  text: "text-slate-800",   chip: "border-slate-300 bg-slate-100 text-slate-800" },
  cross_sell:            { solid: "bg-teal-500",    soft: "bg-teal-50",    text: "text-teal-800",    chip: "border-teal-200 bg-teal-50 text-teal-800" },
  fechamento:            { solid: "bg-green-500",   soft: "bg-green-50",   text: "text-green-800",   chip: "border-green-200 bg-green-50 text-green-800" },
  pos_venda:             { solid: "bg-emerald-700", soft: "bg-emerald-50", text: "text-emerald-900", chip: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  perdido:               { solid: "bg-red-500",     soft: "bg-red-50",     text: "text-red-800",     chip: "border-red-200 bg-red-50 text-red-800" },
};

/** Total da coluna: centavos sempre com duas casas (R$ 80.785,50), inteiro sem casas (R$ 13.000). */
export function formatStageTotal(value: number): string {
  const cents = Math.round(value * 100) % 100 !== 0;
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`;
}
