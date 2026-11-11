// Tempos de alerta de atendimento (tabela alert_time_settings). Vale o mais
// específico: exceção do vendedor > loja > padrão geral > 30/60/90 fixos.
// A função service-alerts aplica a mesma regra no servidor.
import type { Tables } from "@/integrations/supabase/types";

export interface AlertTimes {
  /** Alerta para o vendedor responsável (antes fixo em 30 min). */
  sellerMinutes: number;
  /** Alerta para o gerente (antes 1 h). */
  managerMinutes: number;
  /** Alerta para a gestão/admin (antes 1h30). */
  adminMinutes: number;
}

export interface AlertTimeSetting extends AlertTimes {
  id: string;
  storeId: string | null;
  sellerId: string | null;
}

export const DEFAULT_ALERT_TIMES: AlertTimes = { sellerMinutes: 30, managerMinutes: 60, adminMinutes: 90 };

type AlertTimeSettingRow = Pick<
  Tables<"alert_time_settings">,
  "id" | "store_id" | "seller_id" | "seller_minutes" | "manager_minutes" | "admin_minutes"
>;

export function mapAlertTimeSetting(row: AlertTimeSettingRow): AlertTimeSetting {
  return {
    id: row.id,
    storeId: row.store_id ?? null,
    sellerId: row.seller_id ?? null,
    sellerMinutes: Number(row.seller_minutes),
    managerMinutes: Number(row.manager_minutes),
    adminMinutes: Number(row.admin_minutes),
  };
}

const pick = (s: AlertTimeSetting): AlertTimes => ({
  sellerMinutes: s.sellerMinutes, managerMinutes: s.managerMinutes, adminMinutes: s.adminMinutes,
});

/** De onde vêm os tempos efetivos (para a tela de configuração mostrar "herdado de"). */
export type AlertTimesSource = "seller" | "store" | "global" | "default";

export function resolveAlertTimes(
  settings: AlertTimeSetting[],
  { sellerId, storeId }: { sellerId?: string | null; storeId?: string | null },
): { times: AlertTimes; source: AlertTimesSource } {
  const bySeller = sellerId ? settings.find((s) => s.sellerId === sellerId) : undefined;
  if (bySeller) return { times: pick(bySeller), source: "seller" };
  const byStore = storeId ? settings.find((s) => s.storeId === storeId && !s.sellerId) : undefined;
  if (byStore) return { times: pick(byStore), source: "store" };
  const global = settings.find((s) => !s.storeId && !s.sellerId);
  if (global) return { times: pick(global), source: "global" };
  return { times: DEFAULT_ALERT_TIMES, source: "default" };
}

/** Os três tempos precisam ser crescentes (vendedor < gerente < gestão), até 7 dias. */
export function validateAlertTimes(t: AlertTimes): string | null {
  const values = [t.sellerMinutes, t.managerMinutes, t.adminMinutes];
  if (values.some((v) => !Number.isInteger(v) || v <= 0)) return "Informe minutos inteiros maiores que zero.";
  if (t.adminMinutes > 10080) return "O tempo máximo é de 7 dias (10080 minutos).";
  if (!(t.sellerMinutes < t.managerMinutes && t.managerMinutes < t.adminMinutes)) {
    return "Os tempos precisam aumentar: vendedor < gerente < gestão.";
  }
  return null;
}

/** 30 → "30 minutos", 60 → "1 hora", 90 → "1 hora e 30 minutos", 1440 → "24 horas". */
export function formatAlertMinutes(min: number): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (min < 60) return plural(min, "minuto");
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? plural(h, "hora") : `${plural(h, "hora")} e ${plural(m, "minuto")}`;
}

/** Versão curta para selos: 30 → "30m", 60 → "1h", 90 → "1h30m". */
export function formatAlertMinutesShort(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}m`;
}
