import { useMemo, useState } from "react";
import { CalendarClock, Download } from "lucide-react";
import { useCrm } from "@/contexts/CrmContext";
import { useRole } from "@/contexts/RoleContext";
import { useExternalStores } from "@/hooks/useExternalStores";
import { SellerCombobox } from "@/components/SellerCombobox";
import { exportToCsv } from "@/lib/exportCsv";
import { maskPhone } from "@/lib/masks";
import { isExternalLead, isOpenOpportunity, nextActionStatus, type NextActionStatus } from "@/lib/externalTeam";
import { KANBAN_STAGES, NEXT_ACTIONS, type Lead } from "@/types/crm";
import { cn } from "@/lib/utils";

const STAGE_LABEL: Record<string, string> = Object.fromEntries(KANBAN_STAGES.map((s) => [s.key, s.label]));
const ACTION_LABEL: Record<string, string> = Object.fromEntries(NEXT_ACTIONS.map((a) => [a.value, a.label]));
const STATUS_META: Record<Exclude<NextActionStatus, "ok">, { label: string; cls: string }> = {
  missing: { label: "Sem próxima ação", cls: "bg-amber-100 text-amber-700" },
  overdue: { label: "Atrasada", cls: "bg-red-100 text-red-700" },
};
const fmt = (iso?: string, withTime = false) =>
  iso ? new Date(iso).toLocaleString("pt-BR", withTime
    ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

/** Oportunidades abertas da equipe externa sem próxima ação ou com ela vencida. */
export function useNextActionGaps() {
  const { leads, sellers } = useCrm();
  const { isAdmin, isGerente, storeId } = useRole();
  const externalStores = useExternalStores();
  const restrictToStore = isGerente && !isAdmin && !!storeId;
  const rows = useMemo(() => leads
    .filter((l) => isOpenOpportunity(l) && isExternalLead(l, sellers, externalStores))
    .filter((l) => !restrictToStore || l.storeId === storeId || sellers.find((s) => s.id === l.assignedTo)?.store_id === storeId)
    .map((lead) => ({ lead, status: nextActionStatus(lead) }))
    .filter((r): r is { lead: Lead; status: "missing" | "overdue" } => r.status !== "ok"),
  [leads, sellers, externalStores, restrictToStore, storeId]);
  return {
    rows,
    hasExternalTeam: externalStores.size > 0,
    missing: rows.filter((r) => r.status === "missing").length,
    overdue: rows.filter((r) => r.status === "overdue").length,
  };
}

export function NextActionReport() {
  const { sellers } = useCrm();
  const { rows } = useNextActionGaps();
  const [statusFilter, setStatusFilter] = useState<"all" | "missing" | "overdue">("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const sellerName = (id?: string) => (id && sellers.find((s) => s.id === id)?.name) || "";

  const visible = rows
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => sellerFilter === "all" || (sellerFilter === "unassigned" ? !r.lead.assignedTo : r.lead.assignedTo === sellerFilter))
    .sort((a, b) => (a.lead.nextActionAt || "").localeCompare(b.lead.nextActionAt || ""));

  const sellerOptions = useMemo(() => {
    const ids = new Set(rows.map((r) => r.lead.assignedTo).filter(Boolean));
    return sellers.filter((s) => ids.has(s.id));
  }, [rows, sellers]);

  const handleExport = () => exportToCsv(
    visible,
    [
      { key: "cliente", label: "Cliente", format: (r) => r.lead.clientName },
      { key: "telefone", label: "Telefone", format: (r) => maskPhone(r.lead.clientPhone) },
      { key: "vendedor", label: "Vendedor", format: (r) => sellerName(r.lead.assignedTo) || "sem vendedor" },
      { key: "etapa", label: "Etapa", format: (r) => STAGE_LABEL[r.lead.stage] || r.lead.stage },
      { key: "ultimo", label: "Último contato", format: (r) => fmt(r.lead.lastContactAt) },
      { key: "acao", label: "Próxima ação", format: (r) => (r.lead.nextAction ? `${ACTION_LABEL[r.lead.nextAction]} ${fmt(r.lead.nextActionAt, true)}` : "") },
      { key: "situacao", label: "Situação", format: (r) => STATUS_META[r.status].label },
    ],
    "oportunidades_sem_proxima_acao",
  );

  return (
    <div className="rounded-3xl overflow-hidden bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">Equipe externa</p>
            <h3 className="text-lg font-black text-foreground">Oportunidades sem próxima ação</h3>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={visible.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Exportar Excel (CSV)
        </button>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Oportunidade aberta sem próxima ação e data é oportunidade abandonada. Defina a próxima ação no card do cliente.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {([["all", "Todas"], ["missing", "Sem próxima ação"], ["overdue", "Atrasadas"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={cn("px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                  statusFilter === k ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground")}
              >
                {label} ({k === "all" ? rows.length : rows.filter((r) => r.status === k).length})
              </button>
            ))}
          </div>
          <div className="w-[220px]">
            <SellerCombobox
              value={sellerFilter}
              onChange={setSellerFilter}
              presets={[{ value: "all", label: "Todos os vendedores" }, { value: "unassigned", label: "Sem vendedor" }]}
              sellers={sellerOptions}
            />
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Todas as oportunidades abertas têm próxima ação em dia. 👏</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {["Cliente", "Vendedor", "Etapa", "Último contato", "Próxima ação", "Situação"].map((h) => (
                    <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(({ lead, status }) => (
                  <tr key={lead.id} className="border-t border-border/40">
                    <td className="px-3 py-2 font-medium text-foreground">{lead.clientName}</td>
                    <td className="px-3 py-2">{sellerName(lead.assignedTo) || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{STAGE_LABEL[lead.stage] || lead.stage}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmt(lead.lastContactAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {lead.nextAction ? `${ACTION_LABEL[lead.nextAction]} · ${fmt(lead.nextActionAt, true)}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_META[status].cls)}>
                        {STATUS_META[status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
