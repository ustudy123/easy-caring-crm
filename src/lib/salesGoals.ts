/**
 * Metas mensais da equipe externa (Fase 7): o gestor informa, por mês, a meta
 * de orçamentos e de vendas (R$) de cada vendedor e os dias úteis.
 * Meta diária = meta do mês ÷ dias úteis. Orçado = orçamentos (PDF) pela data
 * de emissão; vendido = notas fiscais pela data de emissão.
 */

export interface MonthRange { from: Date; to: Date }

/** Primeiro dia do mês, em horário local. */
export function monthStart(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthRange(month: Date): MonthRange {
  return { from: monthStart(month), to: new Date(month.getFullYear(), month.getMonth() + 1, 1) };
}

export function shiftMonth(month: Date, n: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + n, 1);
}

/** "2026-11-01" (chave do mês no banco). */
export function monthKey(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
}

/** "AAAA-MM-DD" de uma data local. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "novembro de 2026" */
export function monthLabel(month: Date): string {
  return month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** "Novembro de 2026" (título; o CSS capitalize deixaria "Novembro De 2026"). */
export function monthTitle(month: Date): string {
  const label = monthLabel(month);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "nov/26" */
export function shortMonthLabel(month: Date): string {
  const m = month.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${m}/${String(month.getFullYear()).slice(2)}`;
}

/**
 * Dias úteis do mês pelo calendário: segunda a sexta, menos feriados (datas
 * "AAAA-MM-DD"). `elapsed` conta até `today`, inclusive.
 */
export function countBusinessDays(month: Date, holidays: Set<string>, today: Date = new Date()) {
  const { from, to } = monthRange(month);
  const todayKey = isoDay(today);
  let total = 0;
  let elapsed = 0;
  const holidaysInMonth: string[] = [];
  for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const key = isoDay(d);
    if (holidays.has(key)) {
      holidaysInMonth.push(key);
      continue;
    }
    total++;
    if (key <= todayKey) elapsed++;
  }
  return { total, elapsed, holidays: holidaysInMonth };
}

export interface GoalProgress {
  goal: number | null;
  achieved: number;
  daily: number | null;
  /** quanto já deveria ter até hoje (meta diária × dias úteis passados) */
  expectedToDate: number | null;
  today: number;
  percent: number | null;
  onTrack: boolean | null;
}

/**
 * `businessDays` é o que o gestor informou (ou a sugestão do calendário);
 * `elapsedBusinessDays` vem do calendário e nunca passa do total informado.
 */
export function goalProgress(o: { goal: number | null; achieved: number; today: number; businessDays: number; elapsedBusinessDays: number }): GoalProgress {
  const goal = o.goal && o.goal > 0 ? o.goal : null;
  if (goal === null || o.businessDays <= 0) {
    return { goal, achieved: o.achieved, daily: null, expectedToDate: null, today: o.today, percent: null, onTrack: null };
  }
  const daily = goal / o.businessDays;
  const expectedToDate = daily * Math.min(o.elapsedBusinessDays, o.businessDays);
  return {
    goal,
    achieved: o.achieved,
    daily,
    expectedToDate,
    today: o.today,
    percent: Math.round((o.achieved / goal) * 100),
    onTrack: o.achieved >= expectedToDate,
  };
}

/** Vendido ÷ orçado, em %. null sem orçamento no período. */
export function conversionRate(sold: number, quoted: number): number | null {
  if (!(quoted > 0)) return null;
  return Math.round((sold / quoted) * 1000) / 10;
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** R$ compacto para cartões: "R$ 1,2 mi", "R$ 350 mil", "R$ 980". */
export function brlShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(n) >= 10_000) return `R$ ${Math.round(n / 1000).toLocaleString("pt-BR")} mil`;
  return brl(n).replace(/,00$/, "");
}

/** Campo de valor em reais: "12.500,50" ou "12500.5" → número; vazio → null; inválido → NaN. */
export function parseMoneyInput(raw: string): number | null {
  const s = raw.replace(/[R$\s]/g, "");
  if (!s) return null;
  let normalized = s;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

export function formatMoneyInput(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface ExpectedCloseGroup { key: string; label: string; total: number; count: number }

/** Orçamentos agrupados pelo mês previsto de fechamento ("sem previsão" por último). */
export function groupByExpectedClose(quotes: { expectedCloseDate: string | null; totalValue: number }[]): ExpectedCloseGroup[] {
  const map = new Map<string, ExpectedCloseGroup>();
  for (const q of quotes) {
    const key = q.expectedCloseDate ? q.expectedCloseDate.slice(0, 7) : "none";
    const label = q.expectedCloseDate ? shortMonthLabel(new Date(`${key}-01T12:00:00`)) : "Sem previsão";
    const g = map.get(key) ?? { key, label, total: 0, count: 0 };
    g.total += q.totalValue;
    g.count++;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : a.key.localeCompare(b.key)));
}
