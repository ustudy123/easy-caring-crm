import { Lead, KanbanStage } from "@/types/crm";

export type UrgencyLevel = "ok" | "attention" | "warning" | "critical";

// Max idle hours per stage before escalating urgency
const STAGE_THRESHOLDS: Record<KanbanStage, { attention: number; warning: number; critical: number }> = {
  novo_lead: { attention: 2, warning: 6, critical: 24 },
  em_atendimento: { attention: 12, warning: 24, critical: 48 },
  precificacao_especial: { attention: 24, warning: 48, critical: 72 },
  orcamento_enviado: { attention: 24, warning: 48, critical: 72 },
  negociacao: { attention: 24, warning: 48, critical: 96 },
  fechado: { attention: Infinity, warning: Infinity, critical: Infinity },
};

export function getIdleHours(lead: Lead): number {
  const lastUpdate = new Date(lead.updatedAt).getTime();
  const now = Date.now();
  return (now - lastUpdate) / (1000 * 60 * 60);
}

export function getUrgencyLevel(lead: Lead): UrgencyLevel {
  if (lead.stage === "fechado") return "ok";
  const hours = getIdleHours(lead);
  const thresholds = STAGE_THRESHOLDS[lead.stage];
  if (hours >= thresholds.critical) return "critical";
  if (hours >= thresholds.warning) return "warning";
  if (hours >= thresholds.attention) return "attention";
  return "ok";
}

export function formatIdleTime(lead: Lead): string {
  const hours = getIdleHours(lead);
  if (hours < 1) {
    const mins = Math.floor(hours * 60);
    return `${mins}min`;
  }
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${Math.floor(hours % 24)}h`;
}

export function getUrgencyConfig(level: UrgencyLevel) {
  switch (level) {
    case "critical":
      return {
        borderClass: "ring-2 ring-destructive/60",
        badgeClass: "bg-destructive text-destructive-foreground",
        label: "Crítico",
        pulse: true,
      };
    case "warning":
      return {
        borderClass: "ring-2 ring-warning/50",
        badgeClass: "bg-warning text-white",
        label: "Atenção",
        pulse: true,
      };
    case "attention":
      return {
        borderClass: "ring-1 ring-warning/30",
        badgeClass: "bg-warning/20 text-warning",
        label: "Sem ação",
        pulse: false,
      };
    default:
      return {
        borderClass: "",
        badgeClass: "",
        label: "",
        pulse: false,
      };
  }
}
