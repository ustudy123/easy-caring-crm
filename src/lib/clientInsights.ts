import type { Client, Lead } from "@/types/crm";
import type { SalesDocument } from "@/lib/salesDocuments";
import { qualificationProgress } from "@/lib/qualification";

/**
 * Fase 8: detalhe do cliente recorrente. Cada card (lead) do cliente é uma
 * passagem pelo funil; venda = encerrado sem motivo de perda (mesma regra de
 * get_closed_sales e get_new_clients).
 */
export const PERIODS = [3, 6, 12] as const;
export type PeriodMonths = (typeof PERIODS)[number];

export const isSale = (l: Lead) => !!l.closedAt && !l.lostReason && l.stage !== "perdido";
export const isLost = (l: Lead) => l.stage === "perdido";

export type Outcome = "venda" | "perdido" | "aberto";
export const outcomeOf = (l: Lead): Outcome => (isSale(l) ? "venda" : isLost(l) ? "perdido" : "aberto");

export function periodStart(months: PeriodMonths, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

/** Por que o cliente aparece como recorrente (as mesmas regras da aba). */
export function recurrenceReasons(client: Pick<Client, "purchaseCount" | "clientType" | "tags">, sales: number): string[] {
  const reasons: string[] = [];
  const count = Math.max(client.purchaseCount ?? 0, sales);
  if (count >= 2) reasons.push(`Comprou ${count} vezes (2 ou mais compras contam como recorrente).`);
  if (client.clientType === "recorrente") reasons.push("Marcado como cliente recorrente no encerramento da venda (pós-venda).");
  if (client.tags?.includes("fidelizado")) reasons.push("Tem a palavra-chave “fidelizado”.");
  if (reasons.length === 0) reasons.push("Ainda não é recorrente: comprou uma vez ou nenhuma.");
  return reasons;
}

export interface ClientInsights {
  opportunities: number;
  sales: number;
  lost: number;
  open: number;
  /** vendas em que a qualificação estava completa (funil inteiro, equipe externa) */
  fullFunnel: number;
  soldInPeriod: number;
  salesInPeriod: number;
  invoicedInPeriod: number;
  invoicesInPeriod: number;
  avgTicket: number | null;
  lastSaleAt: string | null;
  reasons: string[];
  history: Lead[];
}

export function clientInsights(
  client: Pick<Client, "purchaseCount" | "clientType" | "tags">,
  leads: Lead[],
  invoices: Pick<SalesDocument, "totalValue" | "issueDate">[],
  months: PeriodMonths,
  now: Date = new Date(),
): ClientInsights {
  const from = periodStart(months, now).getTime();
  const sales = leads.filter(isSale);
  const inPeriod = sales.filter((l) => new Date(l.closedAt!).getTime() >= from);
  const soldInPeriod = inPeriod.reduce((a, l) => a + (Number(l.value) || 0), 0);
  const fromDay = periodStart(months, now).toISOString().slice(0, 10);
  const inv = invoices.filter((d) => d.issueDate && d.issueDate >= fromDay && d.totalValue !== null);
  const lastSale = sales.map((l) => l.closedAt!).sort().at(-1) ?? null;
  return {
    opportunities: leads.length,
    sales: sales.length,
    lost: leads.filter(isLost).length,
    open: leads.filter((l) => outcomeOf(l) === "aberto").length,
    fullFunnel: sales.filter((l) => { const p = qualificationProgress(l); return p.done === p.total; }).length,
    soldInPeriod,
    salesInPeriod: inPeriod.length,
    invoicedInPeriod: inv.reduce((a, d) => a + (d.totalValue ?? 0), 0),
    invoicesInPeriod: inv.length,
    avgTicket: inPeriod.length ? soldInPeriod / inPeriod.length : null,
    lastSaleAt: lastSale,
    reasons: recurrenceReasons(client, sales.length),
    history: [...leads].sort((a, b) => (b.closedAt ?? b.createdAt).localeCompare(a.closedAt ?? a.createdAt)),
  };
}

/** Dados do card mais recente (o que o Kanban mostra) para completar o cadastro. */
export function latestCardInfo(leads: Lead[]) {
  const latest = [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return null;
  return {
    email: latest.clientEmail,
    clientType: latest.clientType,
    companyWorkSite: latest.companyWorkSite,
    interestProducts: latest.interestProducts,
    segment: latest.segment,
    city: latest.city,
  };
}
