import { CalendarClock, ClipboardCheck, MapPin, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { NEXT_ACTIONS, type Lead } from "@/types/crm";
import { isOpenOpportunity, nextActionStatus } from "@/lib/externalTeam";
import { qualificationProgress } from "@/lib/qualification";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Resumo do card do cliente da equipe externa no Kanban: segmento/cidade,
 * último contato e próxima ação. Oportunidade aberta sem próxima ação (ou com
 * a data vencida) fica destacada — "regra de ouro" da consultoria.
 */
export function LeadCardSummary({ lead, onOpenQualification }: { lead: Lead; onOpenQualification?: () => void }) {
  const open = isOpenOpportunity(lead);
  const status = nextActionStatus(lead);
  const actionLabel = NEXT_ACTIONS.find((a) => a.value === lead.nextAction)?.label;
  const place = [lead.segment, lead.city].filter(Boolean).join(" · ");
  const progress = qualificationProgress(lead);

  return (
    <div className="space-y-1 text-[10px]">
      {place && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0 text-primary/60" /> <span className="truncate">{place}</span>
        </p>
      )}
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <MessageSquareText className="h-3 w-3 shrink-0 text-primary/60" />
        {lead.lastContactAt ? `Último contato: ${fmtDate(lead.lastContactAt)}` : "Sem contato registrado"}
      </p>
      {open && (
        <p
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold",
            status === "ok" && "bg-sky-50 text-sky-700",
            status === "overdue" && "bg-red-50 text-red-700",
            status === "missing" && "bg-amber-50 text-amber-700",
          )}
        >
          <CalendarClock className="h-3 w-3 shrink-0" />
          {status === "missing"
            ? "Sem próxima ação"
            : `${status === "overdue" ? "Atrasada: " : ""}${actionLabel} · ${fmtDateTime(lead.nextActionAt!)}`}
        </p>
      )}
      {onOpenQualification && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenQualification(); }}
          className={cn(
            "w-full flex items-center gap-1.5 rounded-md border px-2 py-1 font-semibold transition-colors",
            progress.done === progress.total ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-background text-foreground hover:border-brand-500/50",
          )}
        >
          <ClipboardCheck className="h-3 w-3 shrink-0" /> Qualificação {progress.done}/{progress.total}
        </button>
      )}
    </div>
  );
}
