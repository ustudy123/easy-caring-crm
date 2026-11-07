import type { FollowUp } from "@/types/crm";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Rotina de visitas da equipe externa (Fase 6). A semana vai de segunda 00:00 a
 * segunda 00:00 (visita de sábado ou domingo conta) e o trimestre é civil
 * (jan–mar, abr–jun, jul–set, out–dez), sempre no horário local.
 * Planejadas = visitas agendadas na semana; realizadas = as que o vendedor
 * confirmou. Mesma regra da função get_visit_progress no banco.
 */
export interface VisitGoals {
  weeklyPlanned: number;
  weeklyDone: number;
  /** null = meta ainda não definida no Admin. */
  quarterlyNewClients: number | null;
}

export const DEFAULT_VISIT_GOALS: VisitGoals = { weeklyPlanned: 10, weeklyDone: 5, quarterlyNewClients: null };
export const MAX_WEEKLY_VISITS = 100;
export const MAX_QUARTERLY_NEW_CLIENTS = 1000;

export interface Range { from: Date; to: Date }

export function weekRange(date: Date = new Date()): Range {
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (from.getDay() + 6) % 7; // segunda = 0
  from.setDate(from.getDate() - offset);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

export function shiftWeek(range: Range, weeks: number): Range {
  const from = new Date(range.from);
  from.setDate(from.getDate() + 7 * weeks);
  return weekRange(from);
}

export function quarterRange(date: Date = new Date()): Range {
  const q = Math.floor(date.getMonth() / 3);
  return { from: new Date(date.getFullYear(), q * 3, 1), to: new Date(date.getFullYear(), q * 3 + 3, 1) };
}

const dm = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** "02/11 a 08/11" */
export function weekLabel(range: Range): string {
  const last = new Date(range.to);
  last.setDate(last.getDate() - 1);
  return `${dm(range.from)} a ${dm(last)}`;
}

/** "4º trimestre de 2026" */
export function quarterLabel(range: Range): string {
  return `${Math.floor(range.from.getMonth() / 3) + 1}º trimestre de ${range.from.getFullYear()}`;
}

export function mapSellerGoals(row?: Pick<Tables<"seller_goals">, "weekly_visits_planned" | "weekly_visits_done" | "quarterly_new_clients"> | null): VisitGoals {
  if (!row) return DEFAULT_VISIT_GOALS;
  return {
    weeklyPlanned: row.weekly_visits_planned,
    weeklyDone: row.weekly_visits_done,
    quarterlyNewClients: row.quarterly_new_clients,
  };
}

/** Mensagem de erro das metas digitadas no Admin, ou null se estiverem válidas. */
export function validateVisitGoals(g: VisitGoals): string | null {
  const whole = (n: number) => Number.isInteger(n) && n >= 0;
  if (!whole(g.weeklyPlanned) || !whole(g.weeklyDone)) return "Use números inteiros a partir de 0.";
  if (g.weeklyPlanned > MAX_WEEKLY_VISITS || g.weeklyDone > MAX_WEEKLY_VISITS) return `No máximo ${MAX_WEEKLY_VISITS} visitas por semana.`;
  if (g.weeklyDone > g.weeklyPlanned) return "Realizadas não pode passar das planejadas.";
  if (g.quarterlyNewClients !== null) {
    if (!whole(g.quarterlyNewClients)) return "Clientes novos: use um número inteiro a partir de 0.";
    if (g.quarterlyNewClients > MAX_QUARTERLY_NEW_CLIENTS) return `Clientes novos: no máximo ${MAX_QUARTERLY_NEW_CLIENTS}.`;
  }
  return null;
}

export interface VisitCount { planned: number; done: number }

/** Visitas de um vendedor no período, a partir dos follow-ups já carregados. */
export function countVisits(followUps: FollowUp[], sellerId: string, range: Range): VisitCount {
  const from = range.from.getTime();
  const to = range.to.getTime();
  let planned = 0;
  let done = 0;
  for (const f of followUps) {
    if (f.type !== "visit" || f.assignedTo !== sellerId) continue;
    const t = new Date(f.scheduledAt).getTime();
    if (t < from || t >= to) continue;
    planned++;
    if (f.completed) done++;
  }
  return { planned, done };
}

/** Percentual de 0 a 100 para a barra de progresso; meta 0 conta como cumprida. */
export function goalPercent(value: number, goal: number | null): number {
  if (goal === null) return 0;
  if (goal <= 0) return 100;
  return Math.min(100, Math.round((value / goal) * 100));
}

const gcalStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * Link "Adicionar ao Google Agenda" (sem login no CRM nem configuração): abre o
 * Google Agenda com o compromisso preenchido para o vendedor salvar.
 */
export function googleCalendarTemplateUrl(
  f: Pick<FollowUp, "clientName" | "clientPhone" | "description" | "scheduledAt">,
  typeLabel: string,
  durationMinutes = 60,
): string {
  const start = new Date(f.scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const details = [f.description, f.clientPhone && `Telefone: ${f.clientPhone}`, "Criado pelo CRM Taeco"]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${typeLabel}: ${f.clientName}`,
    dates: `${gcalStamp(start)}/${gcalStamp(end)}`,
    details,
    ctz: "America/Sao_Paulo",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
