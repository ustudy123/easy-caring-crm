import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, MapPin, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToCsv } from "@/lib/exportCsv";
import { maskPhone } from "@/lib/masks";
import {
  goalPercent, quarterLabel, quarterRange, shiftWeek, weekLabel, weekRange, type Range,
} from "@/lib/visitRoutine";
import { useNewClients, useSellerGoals, useVisitProgress, useVisitRoutineSellers } from "@/hooks/useVisitRoutine";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

function Bar({ value, goal, label }: { value: number; goal: number | null; label: string }) {
  const pct = goalPercent(value, goal);
  const reached = goal !== null && value >= goal;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-semibold text-muted-foreground">{label}</span>
        <span className={cn("font-bold tabular-nums", reached ? "text-emerald-600" : "text-foreground")}>
          {value}{goal !== null ? ` / ${goal}` : ""}
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={goal ?? undefined}
      >
        <div className={cn("h-full rounded-full", reached ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Resumo da semana atual para o cartão do dashboard. */
export function useVisitRoutineSummary() {
  const sellers = useVisitRoutineSellers();
  const { goalFor } = useSellerGoals();
  const range = useMemo(() => weekRange(), []);
  const { bySeller } = useVisitProgress(range, sellers.length > 0);
  let done = 0;
  let doneGoal = 0;
  let behind = 0;
  for (const s of sellers) {
    const count = bySeller.get(s.id)?.done ?? 0;
    const goal = goalFor(s.id).weeklyDone;
    done += count;
    doneGoal += goal;
    if (count < goal) behind++;
  }
  return { visible: sellers.length > 0, sellers: sellers.length, done, doneGoal, behind };
}

/**
 * Rotina de visitas da equipe externa: visitas planejadas e realizadas na semana
 * contra a meta de cada vendedor, e clientes novos no trimestre (primeira compra
 * em todo o histórico do CRM; cliente que volta não conta).
 */
export function VisitRoutineReport() {
  const sellers = useVisitRoutineSellers();
  const { goalFor } = useSellerGoals();
  const [week, setWeek] = useState<Range>(() => weekRange());
  const quarter = useMemo(() => quarterRange(week.from), [week.from]);
  const { bySeller, loading: loadingVisits, error: visitsError } = useVisitProgress(week, sellers.length > 0);
  const { rows: newClients, loading: loadingClients, error: clientsError } = useNewClients(quarter, sellers.length > 0);
  const isCurrentWeek = week.from.getTime() === weekRange().from.getTime();
  const weekIsOver = week.to.getTime() <= Date.now();

  const rows = sellers.map((s) => {
    const goals = goalFor(s.id);
    const visits = bySeller.get(s.id) ?? { planned: 0, done: 0 };
    const clients = newClients.filter((c) => c.sellerId === s.id);
    return { seller: s, goals, visits, clients };
  });

  const handleExport = () => exportToCsv(
    rows,
    [
      { key: "vendedor", label: "Vendedor", format: (r) => r.seller.name },
      { key: "semana", label: "Semana", format: () => weekLabel(week) },
      { key: "planejadas", label: "Visitas planejadas", format: (r) => r.visits.planned },
      { key: "meta_planejadas", label: "Meta planejadas", format: (r) => r.goals.weeklyPlanned },
      { key: "realizadas", label: "Visitas realizadas", format: (r) => r.visits.done },
      { key: "meta_realizadas", label: "Meta realizadas", format: (r) => r.goals.weeklyDone },
      { key: "novos", label: `Clientes novos (${quarterLabel(quarter)})`, format: (r) => r.clients.length },
      { key: "meta_novos", label: "Meta clientes novos", format: (r) => r.goals.quarterlyNewClients ?? "" },
    ],
    `rotina_visitas_${week.from.toISOString().slice(0, 10)}`,
  );

  const error = visitsError || clientsError;

  return (
    <div className="rounded-3xl overflow-hidden bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">Equipe externa</p>
            <h3 className="text-lg font-black text-foreground">Rotina de visitas</h3>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Exportar Excel (CSV)
        </button>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setWeek((w) => shiftWeek(w, -1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 hover:bg-muted"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-bold text-foreground min-w-[150px] text-center">Semana de {weekLabel(week)}</p>
          <button
            onClick={() => setWeek((w) => shiftWeek(w, 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 hover:bg-muted"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentWeek && (
            <button onClick={() => setWeek(weekRange())} className="text-xs font-semibold text-brand-600 hover:underline px-2">
              Esta semana
            </button>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-destructive">Não foi possível carregar a rotina: {error}</p>}

        {sellers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum vendedor ativo da equipe externa.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map(({ seller, goals, visits }) => {
                const missing = Math.max(0, goals.weeklyDone - visits.done);
                return (
                  <div key={seller.id} className="rounded-2xl border border-border/60 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-foreground truncate">{seller.name}</p>
                      {!loadingVisits && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            missing === 0 ? "bg-emerald-100 text-emerald-700"
                              : weekIsOver ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
                          )}
                        >
                          {missing === 0 ? "Meta batida" : weekIsOver ? `Ficaram faltando ${missing}` : `Faltam ${missing}`}
                        </span>
                      )}
                    </div>
                    <Bar label="Visitas planejadas" value={visits.planned} goal={goals.weeklyPlanned} />
                    <Bar label="Visitas realizadas" value={visits.done} goal={goals.weeklyDone} />
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-violet-600" />
                <h4 className="text-sm font-black text-foreground">Clientes novos · {quarterLabel(quarter)}</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Conta a primeira venda do cliente em todo o histórico do CRM. Cliente que volta a comprar não é cliente novo.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {rows.map(({ seller, goals, clients }) => (
                  <div key={seller.id} className="rounded-2xl border border-border/60 p-4 space-y-2">
                    <p className="font-bold text-foreground truncate">{seller.name}</p>
                    <Bar
                      label={goals.quarterlyNewClients === null ? "Clientes novos (sem meta definida)" : "Clientes novos"}
                      value={clients.length}
                      goal={goals.quarterlyNewClients}
                    />
                    {!loadingClients && clients.length > 0 && (
                      <ul className="text-xs divide-y divide-border/40">
                        {clients.map((c) => (
                          <li key={c.leadId} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="min-w-0">
                              <span className="block font-medium text-foreground truncate">{c.clientName}</span>
                              <span className="text-muted-foreground">{maskPhone(c.clientPhone)}</span>
                            </span>
                            <span className="text-right shrink-0">
                              <span className="block font-semibold tabular-nums">{brl(c.value)}</span>
                              <span className="text-muted-foreground">{day(c.closedAt)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
