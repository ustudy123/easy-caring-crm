import { Lead } from "@/types/crm";
import { AlertTimes, DEFAULT_ALERT_TIMES, formatAlertMinutesShort } from "@/lib/alertTimes";

export type UrgencyLevel = "ok" | "attention" | "warning" | "critical";

// Os tempos vêm da configuração do gestor (Admin → Alertas), resolvidos por
// vendedor/loja em useCrm().alertTimesFor(lead). Sem configuração: 30m/1h/1h30.

export function getIdleHours(lead: Lead): number {
  const lastUpdate = new Date(lead.updatedAt).getTime();
  const now = Date.now();
  return (now - lastUpdate) / (1000 * 60 * 60);
}

export function getUrgencyLevel(lead: Lead, times: AlertTimes = DEFAULT_ALERT_TIMES): UrgencyLevel {
  if (lead.stage === "fechamento" || lead.stage === "pos_venda") return "ok";
  const minutes = getIdleHours(lead) * 60;
  if (minutes >= times.adminMinutes) return "critical";
  if (minutes >= times.managerMinutes) return "warning";
  if (minutes >= times.sellerMinutes) return "attention";
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

export function getUrgencyConfig(level: UrgencyLevel, times: AlertTimes = DEFAULT_ALERT_TIMES) {
  switch (level) {
     case "critical":
       return {
          borderClass: "ring-[3px] ring-red-600/60 bg-red-50/80 dark:bg-red-950/40 shadow-[0_8px_25px_-5px_rgba(220,38,38,0.3)]",
          badgeClass: "bg-red-600 text-white shadow-red-600/20 scale-105",
          label: `Grave: +${formatAlertMinutesShort(times.adminMinutes)}`,
         pulse: true,
       };
     case "warning":
       return {
         borderClass: "ring-4 ring-orange-500 bg-orange-400/20 dark:bg-orange-900/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]",
         badgeClass: "bg-orange-500 text-white scale-105",
          label: `Atenção: +${formatAlertMinutesShort(times.managerMinutes)}`,
         pulse: true,
       };
     case "attention":
       return {
         borderClass: "ring-4 ring-yellow-400 bg-yellow-300/20 dark:bg-yellow-900/40 shadow-[0_0_10px_rgba(250,204,21,0.2)]",
         badgeClass: "bg-yellow-500 text-white",
          label: `Inicial: ${formatAlertMinutesShort(times.sellerMinutes)}`,
         pulse: true,
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
