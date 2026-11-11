import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrm } from "@/contexts/CrmContext";
import { useSellerGoals } from "@/hooks/useVisitRoutine";
import { countVisits, goalPercent, weekLabel, weekRange } from "@/lib/visitRoutine";

/**
 * Faixa na Agenda com as visitas da semana do vendedor da equipe externa contra
 * a meta dele. Conta a partir dos follow-ups carregados, então muda na hora em
 * que o vendedor confirma uma visita.
 */
export function VisitWeekStrip({ sellerId, sellerName }: { sellerId: string; sellerName?: string }) {
  const { followUps } = useCrm();
  const { goalFor } = useSellerGoals();
  const range = useMemo(() => weekRange(), []);
  const visits = countVisits(followUps, sellerId, range);
  const goals = goalFor(sellerId);
  const items = [
    { label: "Planejadas", value: visits.planned, goal: goals.weeklyPlanned },
    { label: "Realizadas", value: visits.done, goal: goals.weeklyDone },
  ];

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="h-4 w-4 text-violet-600 shrink-0" />
        <p className="text-xs font-semibold text-violet-900 truncate">
          Visitas da semana ({weekLabel(range)}){sellerName ? ` · ${sellerName}` : ""}
        </p>
      </div>
      <div className="flex flex-1 gap-4">
        {items.map((it) => {
          const reached = it.value >= it.goal;
          return (
            <div key={it.label} className="flex-1 min-w-0 space-y-1">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-violet-900/70 font-medium">{it.label}</span>
                <span className={cn("font-bold tabular-nums", reached ? "text-emerald-700" : "text-violet-900")}>
                  {it.value}/{it.goal}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-violet-100 overflow-hidden">
                <div
                  className={cn("h-full rounded-full", reached ? "bg-emerald-500" : "bg-violet-500")}
                  style={{ width: `${goalPercent(it.value, it.goal)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
