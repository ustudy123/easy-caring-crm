import type { ReactNode } from "react";
import {
  Clock, FileText, FolderKanban, Forward, MessageCircle, MoreHorizontal, Package, Pencil, Tag, XCircle, Zap,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDisplayClientName, isGenericName } from "@/lib/clientUtils";
import type { UrgencyLevel } from "@/lib/leadUrgency";
import type { Lead } from "@/types/crm";

/** Cor da faixa lateral e do selo de tempo parado por nível de urgência. */
const URGENCY_STYLE: Record<UrgencyLevel, { bar: string; pill: string }> = {
  ok: { bar: "bg-transparent", pill: "" },
  attention: { bar: "bg-yellow-400", pill: "bg-yellow-50 text-yellow-800 ring-yellow-200" },
  warning: { bar: "bg-orange-500", pill: "bg-orange-50 text-orange-700 ring-orange-200" },
  critical: { bar: "bg-red-600", pill: "bg-red-50 text-red-700 ring-red-200" },
};

/** Valores que o formulário grava como rótulo, não como empresa de verdade. */
const PLACEHOLDER_WORKSITES = new Set(["empresa", "empresa/obra", "obra", "-", "--"]);

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v % 1 ? 2 : 0 });

export interface KanbanLeadCardProps {
  lead: Lead;
  urgency: UrgencyLevel;
  /** Rótulo do alerta montado com os tempos resolvidos (ex.: "Grave: +1h30m"). */
  urgencyLabel: string;
  idleTime: string;
  responsibleName?: string;
  /** Selo do número de WhatsApp em que o cliente escreveu. */
  channel?: ReactNode;
  pricing?: { label: string; className: string } | null;
  /** Resumo da equipe externa (próxima ação, último contato, qualificação). */
  externalSummary?: ReactNode;
  isDragging?: boolean;
  onOpen: () => void;
  onWhatsApp: () => void;
  onAccept?: () => void;
  onRequestPricing?: () => void;
  onSendOrder?: () => void;
  onTransfer: () => void;
  onProjects: () => void;
  onLose: () => void;
  onEdit: () => void;
}

function IconAction({ title, onClick, className, children }: { title: string; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn("p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors", className)}
    >
      {children}
    </button>
  );
}

/**
 * Card do lead no Kanban. Mostra só o que ajuda a decidir em quem mexer:
 * nome, empresa/cidade, valor, responsável, tempo parado e (equipe externa)
 * próxima ação e qualificação. Telefone, e-mail e produtos ficam no detalhe.
 * A urgência aparece na faixa lateral e no selo de tempo — o fundo fica branco
 * para o vermelho continuar chamando atenção onde importa.
 */
export function KanbanLeadCard({
  lead, urgency, urgencyLabel, idleTime, responsibleName, channel, pricing, externalSummary, isDragging,
  onOpen, onWhatsApp, onAccept, onRequestPricing, onSendOrder, onTransfer, onProjects, onLose, onEdit,
}: KanbanLeadCardProps) {
  const style = URGENCY_STYLE[urgency];
  const generic = isGenericName(lead.clientName);
  const title = generic ? formatPhone(lead.clientPhone) : lead.clientName;
  const fallbackTitle = generic ? getDisplayClientName({ name: lead.clientName, phone: lead.clientPhone, source: lead.source, notes: lead.notes }) : null;
  const worksite = lead.companyWorkSite && !PLACEHOLDER_WORKSITES.has(lead.companyWorkSite.trim().toLowerCase()) ? lead.companyWorkSite.trim() : "";
  const subtitle = [
    worksite || (generic ? "Contato sem nome" : ""),
    lead.segment,
    lead.city,
  ].filter(Boolean).join(" · ");
  const visibleTags = lead.tags.slice(0, 2);
  const hiddenTags = lead.tags.length - visibleTags.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      data-urgency={urgency}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(16,24,40,0.06)]",
        "transition-all duration-150 hover:shadow-md hover:border-foreground/15 cursor-pointer active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        isDragging && "shadow-xl ring-2 ring-brand-500/30 rotate-[1deg]",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", style.bar)} />

      <div className="pl-3.5 pr-3 pt-3 pb-2.5 space-y-2">
        {/* Nome + tempo parado */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className={cn("text-[13px] font-semibold leading-snug text-foreground line-clamp-2", generic && "tabular-nums")} title={fallbackTitle ?? title}>
              {title}
            </p>
            {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground truncate" title={subtitle}>{subtitle}</p>}
          </div>
          {urgency !== "ok" && (
            <span
              className={cn("shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1", style.pill)}
              title={`${urgencyLabel} · parado há ${idleTime}`}
            >
              <Clock className="h-3 w-3" /> {idleTime}
            </span>
          )}
        </div>

        {/* Valor + responsável */}
        {(lead.value > 0 || responsibleName) && (
          <div className="flex items-center justify-between gap-2">
            {lead.value > 0 && <span className="text-[14px] font-bold tabular-nums text-foreground">{brl(lead.value)}</span>}
            {responsibleName && (
              <span className="flex items-center gap-1.5 min-w-0 text-[11px] text-muted-foreground" title="Vendedor responsável">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-foreground/70">
                  {initials(responsibleName)}
                </span>
                <span className="truncate max-w-[90px]">{responsibleName.split(" ")[0]}</span>
              </span>
            )}
          </div>
        )}

        {/* Selos: orçamento/negociação e etiquetas */}
        {(pricing || visibleTags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1">
            {pricing && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", pricing.className)}>
                <FileText className="h-3 w-3" /> {pricing.label}
              </span>
            )}
            {visibleTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                <Tag className="h-2.5 w-2.5" />{tag}
              </span>
            ))}
            {hiddenTags > 0 && <span className="text-[10px] font-medium text-muted-foreground" title={lead.tags.slice(2).join(", ")}>+{hiddenTags}</span>}
          </div>
        )}

        {externalSummary}

        {lead.nextFollowUp && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
            <Clock className="h-3.5 w-3.5" />
            Follow-up: {new Date(lead.nextFollowUp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}

        {onAccept && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-full text-[11px] font-semibold rounded-lg border-brand-500/40 text-brand-600 hover:bg-brand-50"
            onClick={(e) => { e.stopPropagation(); onAccept(); }}
          >
            Assumir lead
          </Button>
        )}

        {/* Rodapé: canal + ações */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2 -mb-0.5">
          <div className="min-w-0 flex items-center overflow-hidden">{channel}</div>
          <div className="flex shrink-0 items-center gap-0.5">
            {urgency === "critical" && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="flex md:hidden md:group-hover:flex items-center gap-1 whitespace-nowrap rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 mr-0.5"
              >
                <Zap className="h-3 w-3" /> Agir agora
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Mais ações"
                  aria-label="Mais ações"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                {onRequestPricing && (
                  <DropdownMenuItem onSelect={onRequestPricing}><Zap className="mr-2 h-4 w-4 text-amber-600" /> Orçamento ou negociação</DropdownMenuItem>
                )}
                {onSendOrder && (
                  <DropdownMenuItem onSelect={onSendOrder}><Package className="mr-2 h-4 w-4 text-emerald-600" /> Enviar pedido</DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={onTransfer}><Forward className="mr-2 h-4 w-4" /> Transferir</DropdownMenuItem>
                <DropdownMenuItem onSelect={onProjects}><FolderKanban className="mr-2 h-4 w-4" /> Projetos</DropdownMenuItem>
                <DropdownMenuItem onSelect={onEdit}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onLose} className="text-red-600 focus:text-red-700"><XCircle className="mr-2 h-4 w-4" /> Encerrar atendimento</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <IconAction title="Abrir conversa no WhatsApp" onClick={onWhatsApp} className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700">
              <MessageCircle className="h-4 w-4" />
            </IconAction>
          </div>
        </div>
      </div>
    </div>
  );
}
