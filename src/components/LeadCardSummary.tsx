import { CalendarClock, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { NEXT_ACTIONS, type Lead } from "@/types/crm";
import { isOpenOpportunity, nextActionStatus } from "@/lib/externalTeam";
import { qualificationProgress } from "@/lib/qualification";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Resumo compacto do card do cliente da equipe externa no Kanban: próxima ação,
 * último contato e progresso da qualificação. Oportunidade aberta sem próxima
 * ação (ou com a data vencida) fica destacada — "regra de ouro" da consultoria.
 * Segmento e cidade aparecem na linha de subtítulo do próprio card.
 */
export function LeadCardSummary({ lead, onOpenQualification }: { lead: Lead; onOpenQualification?: () => void }) {
  const open = isOpenOpportunity(lead);
  const status = nextActionStatus(lead);
  const actionLabel = NEXT_ACTIONS.find((a) => a.value === lead.nextAction)?.label;
  const progress = qualificationProgress(lead);
  const complete = progress.done === progress.total;

  return (
    <div className="space-y-1.5 text-[11px]">
      {open && (
        <p
          className={cn(
            "flex items-center gap-1.5 font-medium",
            status === "ok" && "text-sky-700",
            status === "overdue" && "text-red-600",
            status === "missing" && "text-amber-700",
          )}
          title={lead.nextActionAt ? fmtDateTime(lead.nextActionAt) : undefined}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {status === "missing"
              ? "Sem próxima ação"
              : `${status === "overdue" ? "Atrasada: " : ""}${actionLabel} · ${fmtDateTime(lead.nextActionAt!)}`}
          </span>
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title="Último contato pelo WhatsApp do CRM">{lead.lastContactAt ? `Contato em ${fmtDate(lead.lastContactAt)}` : "Sem contato"}</span>
        </span>
        {onOpenQualification && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenQualification(); }}
            title="Abrir a qualificação"
            aria-label={`Qualificação ${progress.done}/${progress.total}`}
            className="shrink-0 flex items-center gap-1.5 rounded-full px-1.5 py-0.5 hover:bg-muted transition-colors"
          >
            <span className="flex gap-[2px]" aria-hidden>
              {Array.from({ length: progress.total }, (_, i) => (
                <span key={i} className={cn("h-1.5 w-2 rounded-full", i < progress.done ? (complete ? "bg-emerald-500" : "bg-brand-500") : "bg-border")} />
              ))}
            </span>
            <span className={cn("font-semibold tabular-nums", complete ? "text-emerald-700" : "text-foreground/70")}>{progress.done}/{progress.total}</span>
          </button>
        )}
      </div>
    </div>
  );
}
