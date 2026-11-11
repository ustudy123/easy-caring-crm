import { useEffect, useMemo, useState } from "react";
import { Award, BadgeCheck, Building2, History, Loader2, Receipt, Repeat, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mapLeadFromDb, useCrm } from "@/contexts/CrmContext";
import { mapSalesDocument, type SalesDocument } from "@/lib/salesDocuments";
import { PERIODS, clientInsights, latestCardInfo, outcomeOf, type PeriodMonths } from "@/lib/clientInsights";
import { brl } from "@/lib/salesGoals";
import { cn } from "@/lib/utils";
import { KANBAN_STAGES, type Client, type Lead } from "@/types/crm";

const STAGE_LABEL: Record<string, string> = Object.fromEntries(KANBAN_STAGES.map((s) => [s.key, s.label]));
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

function Tile({ label, value, hint, icon: Icon, highlight }: { label: string; value: string; hint?: string; icon: typeof TrendingUp; highlight?: boolean }) {
  return (
    <div className="rounded-[14px] bg-muted/50 border border-border/30 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <p className="text-[10px] tracking-wider text-muted-foreground font-medium">{label}</p>
      </div>
      <p className={cn("text-sm font-bold tabular-nums", highlight ? "text-primary" : "text-foreground")}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

/**
 * Detalhe do cliente (Fase 8): por que é recorrente, quantas vezes passou pelo
 * funil, quanto comprou nos últimos 3, 6 ou 12 meses e o histórico de cada
 * oportunidade, com os dados do card do Kanban.
 */
export function ClientInsightsPanel({ client }: { client: Client }) {
  const { sellers } = useCrm();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [invoices, setInvoices] = useState<SalesDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<PeriodMonths>(12);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase.rpc("get_client_leads", { _client_id: client.id }),
      supabase.rpc("get_client_invoices", { _client_id: client.id }),
    ]).then(([leadsRes, invRes]) => {
      if (cancelled) return;
      setLeads((leadsRes.data ?? []).map(mapLeadFromDb));
      setInvoices((invRes.data ?? []).map(mapSalesDocument));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [client.id]);

  const data = useMemo(() => clientInsights(client, leads, invoices, months), [client, leads, invoices, months]);
  const card = useMemo(() => latestCardInfo(leads), [leads]);
  const sellerName = (id?: string) => (id && sellers.find((s) => s.id === id)?.name) || "—";

  if (loading) {
    return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…</p>;
  }

  const cardFields = card ? [
    ["Empresa / obra", card.companyWorkSite],
    ["Tipo de cliente", card.clientType],
    ["Segmento", card.segment],
    ["Cidade", card.city],
    ["Interesse", card.interestProducts],
  ].filter(([, v]) => !!v) as [string, string][] : [];

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/60 p-3">
        <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 mb-1"><Repeat className="h-3.5 w-3.5" /> Por que é recorrente</p>
        <ul className="list-disc pl-5 text-xs text-emerald-900 space-y-0.5">
          {data.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-bold text-foreground">Compras no período</p>
        <div className="flex gap-1 rounded-full bg-muted p-1" role="group" aria-label="Período">
          {PERIODS.map((m) => (
            <button key={m} type="button" onClick={() => setMonths(m)} aria-pressed={months === m}
              className={cn("px-3 py-1 text-xs font-semibold rounded-full", months === m ? "bg-brand-500 text-white" : "text-muted-foreground")}>
              {m === 12 ? "1 ano" : `${m} meses`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile icon={TrendingUp} highlight label={`Vendido em ${months === 12 ? "1 ano" : `${months} meses`}`} value={brl(data.soldInPeriod)}
          hint={`${data.salesInPeriod} venda${data.salesInPeriod === 1 ? "" : "s"} concluída${data.salesInPeriod === 1 ? "" : "s"} no CRM`} />
        <Tile icon={Award} label="Ticket médio no período" value={data.avgTicket === null ? "—" : brl(data.avgTicket)} hint={`Última compra: ${day(data.lastSaleAt)}`} />
        <Tile icon={Repeat} label="Passou pelo funil" value={`${data.sales} ${data.sales === 1 ? "vez" : "vezes"} até a venda`}
          hint={`${data.opportunities} oportunidade${data.opportunities === 1 ? "" : "s"} · ${data.lost} perdida${data.lost === 1 ? "" : "s"} · ${data.open} em aberto`} />
        <Tile icon={BadgeCheck} label="Funil completo" value={`${data.fullFunnel} de ${data.sales} vendas`} hint="Vendas com a qualificação de todas as etapas" />
        {invoices.length > 0 && (
          <Tile icon={Receipt} label={`Em notas fiscais (${months === 12 ? "1 ano" : `${months} meses`})`} value={brl(data.invoicedInPeriod)}
            hint={`${data.invoicesInPeriod} nota${data.invoicesInPeriod === 1 ? "" : "s"} confirmada${data.invoicesInPeriod === 1 ? "" : "s"} pelo CNPJ`} />
        )}
      </div>

      {cardFields.length > 0 && (
        <div className="rounded-[14px] bg-muted/50 border border-border/30 p-3">
          <p className="text-[10px] tracking-wider text-muted-foreground font-medium flex items-center gap-1.5 mb-1.5"><Building2 className="h-3 w-3" /> Dados do card</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {cardFields.map(([k, v]) => (
              <div key={k} className="min-w-0"><dt className="inline text-muted-foreground">{k}: </dt><dd className="inline font-medium text-foreground break-words">{v}</dd></div>
            ))}
          </dl>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Passagens pelo funil</p>
        {data.history.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum card deste cliente no CRM.</p>
        ) : (
          <ul className="divide-y divide-border/40 rounded-[14px] border border-border/40 text-xs">
            {data.history.map((l) => {
              const outcome = outcomeOf(l);
              return (
                <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    outcome === "venda" ? "bg-emerald-100 text-emerald-700" : outcome === "perdido" ? "bg-red-100 text-red-700" : "bg-sky-50 text-sky-700")}>
                    {outcome === "venda" ? "Venda" : outcome === "perdido" ? "Perdido" : STAGE_LABEL[l.stage] ?? l.stage}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {day(l.closedAt ?? l.createdAt)} · {sellerName(l.assignedTo)}
                    {outcome === "perdido" && l.lostReason ? ` · ${l.lostReason}` : ""}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{brl(Number(l.value) || 0)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
