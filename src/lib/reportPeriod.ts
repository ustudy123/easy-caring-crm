import { startOfWeek, startOfMonth, startOfYear, addMonths, addYears, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ReportPeriod = "week" | "month" | "year" | "all";

/** Mês no formato "AAAA-MM" (ex.: "2026-08"). */
export const monthKeyOf = (d: Date) => format(d, "yyyy-MM");

/**
 * Intervalo [since, until) do período do relatório. Em "month" e "year" vale o mês
 * ou o ano escolhido (não só o atual), para consultar meses passados.
 */
export function reportPeriodRange(
  period: ReportPeriod,
  opts: { monthKey?: string; year?: number; now?: Date } = {},
): { since: Date | null; until: Date | null } {
  const now = opts.now ?? new Date();
  if (period === "week") return { since: startOfWeek(now, { weekStartsOn: 1 }), until: null };
  if (period === "month") {
    const [y, m] = (opts.monthKey ?? monthKeyOf(now)).split("-").map(Number);
    const since = new Date(y, m - 1, 1);
    return { since, until: addMonths(since, 1) };
  }
  if (period === "year") {
    const since = startOfYear(new Date(opts.year ?? now.getFullYear(), 0, 1));
    return { since, until: addYears(since, 1) };
  }
  return { since: null, until: null };
}

/** Meses do primeiro registro até o atual, do mais recente para o mais antigo. */
export function monthOptions(first: Date | null, now: Date = new Date()): { key: string; label: string }[] {
  const end = startOfMonth(now);
  let cur = startOfMonth(first && first < end ? first : end);
  const out: { key: string; label: string }[] = [];
  while (cur <= end) {
    const label = format(cur, "MMMM 'de' yyyy", { locale: ptBR });
    out.push({ key: monthKeyOf(cur), label: label.charAt(0).toUpperCase() + label.slice(1) });
    cur = addMonths(cur, 1);
  }
  return out.reverse();
}

/** Anos do primeiro registro até o atual, do mais recente para o mais antigo. */
export function yearOptions(first: Date | null, now: Date = new Date()): number[] {
  const start = first && first < now ? first.getFullYear() : now.getFullYear();
  const out: number[] = [];
  for (let y = now.getFullYear(); y >= start; y--) out.push(y);
  return out;
}
