import { Lead, KanbanStage } from "@/types/crm";

export type UrgencyLevel = "ok" | "attention" | "warning" | "critical";

 // Max idle hours before escalating urgency (0.5h = 30m, 1h = 60m, 1.5h = 90m)
 const GLOBAL_THRESHOLDS = {
   attention: 0.5, // 30 minutes
   warning: 1,     // 1 hour
   critical: 1.5,  // 1 hour 30 minutes
 };

export function getIdleHours(lead: Lead): number {
  const lastUpdate = new Date(lead.updatedAt).getTime();
  const now = Date.now();
  return (now - lastUpdate) / (1000 * 60 * 60);
}

export function getUrgencyLevel(lead: Lead): UrgencyLevel {
   if (lead.stage === "fechamento" || lead.stage === "pos_venda") return "ok";
   const hours = getIdleHours(lead);
   
   if (hours >= GLOBAL_THRESHOLDS.critical) return "critical";
   if (hours >= GLOBAL_THRESHOLDS.warning) return "warning";
   if (hours >= GLOBAL_THRESHOLDS.attention) return "attention";
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
         borderClass: "ring-4 ring-red-600 bg-red-500/20 dark:bg-red-900/60 shadow-[0_0_20px_rgba(220,38,38,0.4)]",
         badgeClass: "bg-red-600 text-white scale-110",
         label: "GRAVE: +1h30m",
         pulse: true,
       };
     case "warning":
       return {
         borderClass: "ring-4 ring-orange-500 bg-orange-400/20 dark:bg-orange-900/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]",
         badgeClass: "bg-orange-500 text-white scale-105",
         label: "ATENÇÃO: +1h",
         pulse: true,
       };
     case "attention":
       return {
         borderClass: "ring-4 ring-yellow-400 bg-yellow-300/20 dark:bg-yellow-900/40 shadow-[0_0_10px_rgba(250,204,21,0.2)]",
         badgeClass: "bg-yellow-500 text-white",
         label: "INICIAL: 30m",
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
