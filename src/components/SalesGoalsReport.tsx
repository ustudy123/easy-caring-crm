import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToCsv } from "@/lib/exportCsv";
import { qualificationProgress } from "@/lib/qualification";
import { quarterLabel, quarterRange } from "@/lib/visitRoutine";
import {
  brl, brlShort, conversionRate, countBusinessDays, goalProgress, groupByExpectedClose, isoDay, monthLabel, monthRange,
  monthStart, monthTitle, shiftMonth, type GoalProgress,
} from "@/lib/salesGoals";
import { isComplete, wasEditedByHand, type SalesDocument } from "@/lib/salesDocuments";
import { useExternalStores } from "@/hooks/useExternalStores";
import { useClosedSales, useExternalHolidays, useMonthlyGoals, useSalesDocuments } from "@/hooks/useSalesGoals";
import { useNewClients, useSellerGoals, useVisitRoutineSellers } from "@/hooks/useVisitRoutine";
import { ProtectedView, useCanExport } from "@/components/ProtectedView";
import type { Seller } from "@/types/crm";

const day = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function GoalBlock({ title, progress, unitLabel }: { title: string; progress: GoalProgress; unitLabel: string }) {
  const pct = progress.percent ?? 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground">{title}</span>
        <span className={cn("text-[11px] font-bold tabular-nums", progress.onTrack ? "text-emerald-600" : "text-foreground")}>
          {brlShort(progress.achieved)}{progress.goal !== null && ` / ${brlShort(progress.goal)} (${pct}%)`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-label={title} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", progress.onTrack ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {progress.goal === null ? (
        <p className="text-[10px] text-muted-foreground">Sem meta de {unitLabel} neste mês.</p>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Meta do dia {brl(progress.daily!)} · hoje {brl(progress.today)} · até hoje deveria {brl(progress.expectedToDate!)}
          {progress.onTrack === false && <span className="text-red-600 font-semibold"> · abaixo do ritmo</span>}
        </p>
      )}
    </div>
  );
}

interface Row {
  seller: Seller;
  quote: GoalProgress;
  sales: GoalProgress;
  conversion: number | null;
  closedSales: number;
  fullFunnel: number;
  newClients: number;
  newClientsGoal: number | null;
  quotesWithoutClose: number;
}

/**
 * Metas e orçamentos da equipe externa no mês: orçado (PDFs de orçamento) e
 * vendido (notas fiscais) contra a meta, meta do dia, conversão, vendas que
 * passaram pelo funil completo e clientes novos do trimestre. Painel protegido:
 * marca d'água, sem impressão e exportação só para a gestão.
 */
export function SalesGoalsReport({
  month: controlledMonth, onMonthChange, showQuotes = true, sellers: sellersProp,
}: {
  month?: Date;
  onMonthChange?: (m: Date) => void;
  showQuotes?: boolean;
  sellers?: Seller[];
}) {
  const visibleSellers = useVisitRoutineSellers();
  const sellers = sellersProp ?? visibleSellers;
  const [ownMonth, setOwnMonth] = useState(() => monthStart());
  const month = controlledMonth ?? ownMonth;
  const setMonth = (m: Date) => (onMonthChange ? onMonthChange(m) : setOwnMonth(m));
  const range = useMemo(() => monthRange(month), [month]);
  const quarter = useMemo(() => quarterRange(month), [month]);
  const enabled = sellers.length > 0;

  const { goals, businessDays } = useMonthlyGoals(month);
  const externalStores = useExternalStores();
  const holidays = useExternalHolidays(externalStores);
  const { documents } = useSalesDocuments(range, enabled);
  const closedSales = useClosedSales(range, enabled);
  const { rows: newClients } = useNewClients(quarter, enabled);
  const { goalFor } = useSellerGoals();
  const canExport = useCanExport();

  const calendar = useMemo(() => countBusinessDays(month, holidays), [month, holidays]);
  const days = businessDays ?? calendar.total;
  const todayKey = isoDay(new Date());
  const sellerIds = new Set(sellers.map((s) => s.id));
  const monthDocs = documents.filter((d) => isComplete(d) && sellerIds.has(d.sellerId));

  const rows: Row[] = sellers.map((seller) => {
    const mine = monthDocs.filter((d) => d.sellerId === seller.id);
    const sum = (kind: SalesDocument["kind"], onlyToday = false) => mine
      .filter((d) => d.kind === kind && (!onlyToday || d.issueDate === todayKey))
      .reduce((acc, d) => acc + (d.totalValue ?? 0), 0);
    const quoted = sum("quote");
    const sold = sum("invoice");
    const g = goals.get(seller.id);
    const base = { businessDays: days, elapsedBusinessDays: calendar.elapsed };
    const sales = closedSales.filter((l) => l.assignedTo === seller.id);
    return {
      seller,
      quote: goalProgress({ goal: g?.quoteGoal ?? null, achieved: quoted, today: sum("quote", true), ...base }),
      sales: goalProgress({ goal: g?.salesGoal ?? null, achieved: sold, today: sum("invoice", true), ...base }),
      conversion: conversionRate(sold, quoted),
      closedSales: sales.length,
      fullFunnel: sales.filter((l) => { const p = qualificationProgress(l); return p.done === p.total; }).length,
      newClients: newClients.filter((c) => c.sellerId === seller.id).length,
      newClientsGoal: goalFor(seller.id).quarterlyNewClients,
      quotesWithoutClose: documents.filter((d) => d.sellerId === seller.id && d.kind === "quote" && !d.expectedCloseDate).length,
    };
  });

  const quotes = monthDocs.filter((d) => d.kind === "quote");
  const closeGroups = groupByExpectedClose(quotes.map((q) => ({ expectedCloseDate: q.expectedCloseDate, totalValue: q.totalValue ?? 0 })));
  const sellerName = (id: string) => sellers.find((s) => s.id === id)?.name ?? "";

  const handleExport = () => exportToCsv(
    rows,
    [
      { key: "vendedor", label: "Vendedor", format: (r) => r.seller.name },
      { key: "mes", label: "Mês", format: () => monthLabel(month) },
      { key: "orcado", label: "Orçado (R$)", format: (r) => r.quote.achieved.toFixed(2).replace(".", ",") },
      { key: "meta_orc", label: "Meta de orçamentos (R$)", format: (r) => r.quote.goal?.toFixed(2).replace(".", ",") ?? "" },
      { key: "vendido", label: "Vendido em notas (R$)", format: (r) => r.sales.achieved.toFixed(2).replace(".", ",") },
      { key: "meta_venda", label: "Meta de vendas (R$)", format: (r) => r.sales.goal?.toFixed(2).replace(".", ",") ?? "" },
      { key: "conversao", label: "Conversão (%)", format: (r) => r.conversion ?? "" },
      { key: "funil", label: "Vendas com funil completo", format: (r) => `${r.fullFunnel} de ${r.closedSales}` },
      { key: "novos", label: `Clientes novos (${quarterLabel(quarter)})`, format: (r) => r.newClients },
    ],
    `metas_orcamentos_${isoDay(month).slice(0, 7)}`,
  );

  return (
    <ProtectedView className="rounded-3xl overflow-hidden bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">Equipe externa</p>
            <h3 className="text-base font-black text-foreground">Metas e orçamentos</h3>
          </div>
        </div>
        {canExport && (
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            className="relative z-20 inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Exportar Excel (CSV)
          </button>
        )}
      </div>

      <div className="p-5 space-y-4 text-xs">
        <div className="relative z-20 flex flex-wrap items-center gap-2">
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 hover:bg-muted">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <p className="text-sm font-bold text-foreground min-w-[140px] text-center">{monthTitle(month)}</p>
          <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 hover:bg-muted">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] text-muted-foreground">
            {days} dias úteis{businessDays ? "" : " (calendário)"} · {Math.min(calendar.elapsed, days)} até hoje
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum vendedor ativo da equipe externa.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((r) => (
              <div key={r.seller.id} className="rounded-2xl border border-border/60 p-4 space-y-3">
                <p className="text-sm font-bold text-foreground truncate">{r.seller.name}</p>
                <GoalBlock title="Orçado no mês" progress={r.quote} unitLabel="orçamentos" />
                <GoalBlock title="Vendido no mês (notas fiscais)" progress={r.sales} unitLabel="vendas" />
                <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">Conversão</p>
                    <p className="font-bold tabular-nums">{r.conversion === null ? "—" : `${r.conversion.toLocaleString("pt-BR")}%`}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Funil completo</p>
                    <p className="font-bold tabular-nums">{r.fullFunnel} de {r.closedSales} vendas</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Clientes novos (tri)</p>
                    <p className="font-bold tabular-nums">{r.newClients}{r.newClientsGoal !== null ? ` / ${r.newClientsGoal}` : ""}</p>
                  </div>
                </div>
                {r.quotesWithoutClose > 0 && (
                  <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                    {r.quotesWithoutClose} orçamento{r.quotesWithoutClose > 1 ? "s" : ""} sem previsão de fechamento
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {showQuotes && quotes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-black text-foreground">Orçamentos de {monthLabel(month)} por previsão de fechamento</h4>
            <div className="flex flex-wrap gap-1.5">
              {closeGroups.map((g) => (
                <span key={g.key} className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", g.key === "none" ? "bg-amber-100 text-amber-700" : "bg-muted text-foreground")}>
                  {g.label}: {brlShort(g.total)} ({g.count})
                </span>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    {["Emissão", "Cliente", "Vendedor", "Valor", "Previsão"].map((h) => (
                      <th key={h} className={cn("text-left font-semibold px-3 py-2 whitespace-nowrap", h === "Vendedor" && "hidden sm:table-cell")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id} className="border-t border-border/40">
                      <td className="px-3 py-1.5 whitespace-nowrap">{day(q.issueDate!)}</td>
                      <td className="px-3 py-1.5">{q.clientName}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap hidden sm:table-cell">{sellerName(q.sellerId)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                        {brl(q.totalValue ?? 0)}
                        {wasEditedByHand(q) && <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-700" title={`IA leu ${brl(q.aiExtracted!.total_value!)}`}>editado</span>}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {q.expectedCloseDate ? day(q.expectedCloseDate) : <span className="font-semibold text-amber-700">Sem previsão</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProtectedView>
  );
}

/** Resumo do mês atual para o cartão do dashboard (soma da equipe visível). */
export function useSalesGoalsSummary() {
  const sellers = useVisitRoutineSellers();
  const month = useMemo(() => monthStart(), []);
  const range = useMemo(() => monthRange(month), [month]);
  const { goals } = useMonthlyGoals(month);
  const { documents } = useSalesDocuments(range, sellers.length > 0);
  const ids = new Set(sellers.map((s) => s.id));
  const docs = documents.filter((d) => isComplete(d) && ids.has(d.sellerId));
  const sold = docs.filter((d) => d.kind === "invoice").reduce((a, d) => a + (d.totalValue ?? 0), 0);
  const quoted = docs.filter((d) => d.kind === "quote").reduce((a, d) => a + (d.totalValue ?? 0), 0);
  const salesGoal = sellers.reduce((a, s) => a + (goals.get(s.id)?.salesGoal ?? 0), 0);
  return { visible: sellers.length > 0, sold, quoted, salesGoal, conversion: conversionRate(sold, quoted) };
}
