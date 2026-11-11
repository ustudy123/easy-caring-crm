import type { Lead } from "@/types/crm";

/**
 * O lead é da equipe externa se o vendedor responsável está numa loja externa
 * ou, sem vendedor, se o próprio lead está numa loja externa.
 */
export function isExternalLead(
  lead: Pick<Lead, "assignedTo" | "storeId">,
  sellers: { id: string; store_id?: string | null }[],
  externalStoreIds: Set<string>,
): boolean {
  if (externalStoreIds.size === 0) return false;
  const sellerStore = lead.assignedTo ? sellers.find((s) => s.id === lead.assignedTo)?.store_id : undefined;
  const store = sellerStore || lead.storeId;
  return !!store && externalStoreIds.has(store);
}

/** Converte ISO para o valor de <input type="datetime-local"> no fuso do navegador. */
export function toLocalDateTimeInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converte ISO para o valor de <input type="date"> no fuso do navegador. */
export function toLocalDateInput(iso?: string): string {
  return toLocalDateTimeInput(iso).slice(0, 10);
}

/** Valor de <input type="datetime-local"> ou "date" (meio-dia local) para ISO. */
export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value.length === 10 ? `${value}T12:00` : value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Situação da próxima ação de uma oportunidade aberta ("regra de ouro" da consultoria). */
export type NextActionStatus = "ok" | "missing" | "overdue";

export function nextActionStatus(lead: Pick<Lead, "nextAction" | "nextActionAt">, now: Date = new Date()): NextActionStatus {
  if (!lead.nextAction || !lead.nextActionAt) return "missing";
  return new Date(lead.nextActionAt).getTime() < now.getTime() ? "overdue" : "ok";
}

/** Oportunidade aberta = ainda no funil (não fechada, não perdida, não arquivada). */
export function isOpenOpportunity(lead: Pick<Lead, "stage" | "archived">): boolean {
  return !lead.archived && !["fechamento", "pos_venda", "perdido"].includes(lead.stage);
}
