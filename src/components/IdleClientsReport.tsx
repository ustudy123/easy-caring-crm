import { useEffect, useMemo, useState } from "react";
import { useCrm } from "@/contexts/CrmContext";
import { supabase } from "@/integrations/supabase/client";
import { getUrgencyLevel, formatIdleTime, getIdleHours, UrgencyLevel } from "@/lib/leadUrgency";
import { KANBAN_STAGES } from "@/types/crm";
import { maskPhone } from "@/lib/masks";
import { exportToCsv } from "@/lib/exportCsv";
import { AlertTriangle, Download, Clock } from "lucide-react";

const STAGE_LABEL: Record<string, string> = Object.fromEntries(KANBAN_STAGES.map((s) => [s.key, s.label]));

const LEVEL_META: Record<UrgencyLevel, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "" },
  attention: { label: "Inicial (+30m)", cls: "bg-yellow-100 text-yellow-700" },
  warning: { label: "Atenção (+1h)", cls: "bg-orange-100 text-orange-700" },
  critical: { label: "Grave (+1h30)", cls: "bg-red-100 text-red-700" },
};

export function IdleClientsReport() {
  const { leads, sellers } = useCrm();
  const [tick, setTick] = useState(0);
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const [levelFilter, setLevelFilter] = useState<"all" | UrgencyLevel>("all");

  // Recalcula os tempos ociosos periodicamente para o relatório ficar "vivo".
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Nomes das lojas (para a coluna Loja).
  useEffect(() => {
    supabase.from("stores").select("id, name").then(({ data }) => {
      if (data) setStoreNames(Object.fromEntries((data as any[]).map((s) => [s.id, s.name])));
    });
  }, []);

  const sellerName = (id: string) => sellers.find((s) => s.id === id)?.name || "";

  const rows = useMemo(() => {
    void tick; // força recálculo dos tempos
    return leads
      .map((l) => ({ lead: l, level: getUrgencyLevel(l), idleH: getIdleHours(l) }))
      .filter((r) => r.level !== "ok")
      .filter((r) => levelFilter === "all" || r.level === levelFilter)
      .sort((a, b) => b.idleH - a.idleH);
  }, [leads, tick, levelFilter]);

  const counts = useMemo(() => {
    void tick;
    const levels = leads.map((l) => getUrgencyLevel(l)).filter((x) => x !== "ok");
    return {
      total: levels.length,
      critical: levels.filter((x) => x === "critical").length,
      warning: levels.filter((x) => x === "warning").length,
      attention: levels.filter((x) => x === "attention").length,
    };
  }, [leads, tick]);

  const handleExport = () => {
    if (rows.length === 0) return;
    exportToCsv(
      rows,
      [
        { key: "cliente", label: "Cliente", format: (r) => r.lead.clientName },
        { key: "telefone", label: "Telefone", format: (r) => maskPhone(r.lead.clientPhone) },
        { key: "vendedor", label: "Vendedor responsável", format: (r) => sellerName(r.lead.assignedTo) || "sem vendedor designado" },
        { key: "loja", label: "Loja", format: (r) => (r.lead.storeId ? storeNames[r.lead.storeId] || "" : "") },
        { key: "empresa", label: "Empresa/Obra", format: (r) => r.lead.companyWorkSite || "" },
        { key: "etapa", label: "Etapa", format: (r) => STAGE_LABEL[r.lead.stage] || r.lead.stage },
        { key: "tempo", label: "Tempo parado", format: (r) => formatIdleTime(r.lead) },
        { key: "nivel", label: "Nível", format: (r) => LEVEL_META[r.level].label },
      ],
      "clientes_sem_atendimento",
    );
  };

  return (
    <div className="rounded-3xl overflow-hidden bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-destructive">Tempo real</p>
            <h3 className="text-lg font-black text-foreground">Clientes sem atendimento</h3>
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

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniCard label="Sem atendimento" value={counts.total} tone="muted" />
          <MiniCard label="Grave (+1h30)" value={counts.critical} tone="red" />
          <MiniCard label="Atenção (+1h)" value={counts.warning} tone="orange" />
          <MiniCard label="Inicial (+30m)" value={counts.attention} tone="yellow" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Filtrar por nível:</span>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as any)}
            className="h-8 rounded-lg border border-border/60 bg-card px-2 text-xs"
          >
            <option value="all">Todos</option>
            <option value="critical">Grave (+1h30)</option>
            <option value="warning">Atenção (+1h)</option>
            <option value="attention">Inicial (+30m)</option>
          </select>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{rows.length} cliente(s)</span>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                <th className="py-2 font-semibold">Cliente</th>
                <th className="py-2 font-semibold">Telefone</th>
                <th className="py-2 font-semibold">Vendedor responsável</th>
                <th className="py-2 font-semibold">Loja</th>
                <th className="py-2 font-semibold">Etapa</th>
                <th className="py-2 font-semibold text-right">Tempo parado</th>
                <th className="py-2 font-semibold text-right">Nível</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum cliente sem atendimento. 🎉</td></tr>
              )}
              {rows.map(({ lead, level }) => {
                const resp = sellerName(lead.assignedTo);
                return (
                  <tr key={lead.id} className="border-b border-border/30">
                    <td className="py-2.5 font-medium text-foreground">{lead.clientName}</td>
                    <td className="py-2.5 text-muted-foreground tabular-nums">{maskPhone(lead.clientPhone)}</td>
                    <td className={`py-2.5 ${resp ? "text-foreground" : "text-muted-foreground italic"}`}>{resp || "sem vendedor designado"}</td>
                    <td className="py-2.5 text-muted-foreground">{lead.storeId ? storeNames[lead.storeId] || "—" : "—"}</td>
                    <td className="py-2.5 text-muted-foreground">{STAGE_LABEL[lead.stage] || lead.stage}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-foreground">
                      <span className="inline-flex items-center gap-1 justify-end"><Clock className="h-3 w-3 text-muted-foreground" />{formatIdleTime(lead)}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${LEVEL_META[level].cls}`}>{LEVEL_META[level].label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ label, value, tone }: { label: string; value: number; tone: "muted" | "red" | "orange" | "yellow" }) {
  const toneCls =
    tone === "red" ? "text-red-600" :
    tone === "orange" ? "text-orange-600" :
    tone === "yellow" ? "text-yellow-600" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-black tabular-nums ${toneCls}`}>{value}</p>
    </div>
  );
}
