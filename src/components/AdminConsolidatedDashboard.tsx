import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCrm } from "@/contexts/CrmContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, DollarSign, Target, FileText, MessageCircle, UserPlus, Repeat, AlertTriangle, Clock, TrendingUp, Trophy } from "lucide-react";
import { startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { KANBAN_STAGES } from "@/types/crm";
import { SellerPerformance } from "@/components/SellerPerformance";

type Period = "today" | "week" | "month" | "year" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
  { key: "all", label: "Geral" },
];
function sinceForPeriod(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "today": return startOfDay(now);
    case "week": return startOfWeek(now, { weekStartsOn: 1 });
    case "month": return startOfMonth(now);
    case "year": return startOfYear(now);
    default: return null;
  }
}

const STALE_DAYS = 7;
const brl = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

interface SellerRow { id: string; name: string; store_id: string | null; }
interface StoreRow { id: string; name: string; }
interface ClientRow { id: string; created_at: string; total_purchases: number | null; last_message_at: string | null; tags: string[] | null; store_id: string | null; }
interface OrcamentoRow { id: string; status: string | null; created_at: string | null; store_id?: string | null; seller_id: string | null; }

export function AdminConsolidatedDashboard() {
  const { leads } = useCrm();
  const [period, setPeriod] = useState<Period>("month");
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sRes, stRes, cRes, oRes] = await Promise.all([
        supabase.from("sellers").select("id, name, store_id"),
        supabase.from("stores").select("id, name"),
        supabase.from("clients").select("id, created_at, total_purchases, last_message_at, tags, store_id"),
        supabase.from("pricing_support_requests").select("id, status, created_at, seller_id"),
      ]);
      if (sRes.data) setSellers(sRes.data as SellerRow[]);
      if (stRes.data) setStores(stRes.data as StoreRow[]);
      if (cRes.data) setClients(cRes.data as ClientRow[]);
      if (oRes.data) setOrcamentos(oRes.data as OrcamentoRow[]);
      setLoading(false);
    })();
  }, []);

  const since = sinceForPeriod(period);
  const inPeriod = (iso?: string | null) => !since || (iso ? new Date(iso) >= since : false);

  const m = useMemo(() => {
    const pLeads = leads.filter((l) => inPeriod(l.createdAt));
    const isWon = (s: string) => s === "fechamento" || s === "pos_venda";
    const won = pLeads.filter((l) => isWon(l.stage));
    const lost = pLeads.filter((l) => l.stage === "perdido");
    const open = pLeads.filter((l) => !isWon(l.stage) && l.stage !== "perdido");
    const decided = won.length + lost.length;

    const staleCutoff = new Date(Date.now() - STALE_DAYS * 86400000);
    const staleLeads = open.filter((l) => new Date(l.updatedAt) < staleCutoff);

    const valorOrcado = pLeads.reduce((s, l) => s + (l.value || 0), 0);
    const valorAprovado = won.reduce((s, l) => s + (l.value || 0), 0);
    const ticketMedio = won.length > 0 ? valorAprovado / won.length : 0;

    const pClients = clients.filter((c) => inPeriod(c.created_at));
    const recorrentes = clients.filter((c) => (c.total_purchases || 0) > 0 || (c.tags || []).includes("fidelizado")).length;
    const conversasWpp = clients.filter((c) => c.last_message_at).length;

    const pOrc = orcamentos.filter((o) => inPeriod(o.created_at));
    const orcPend = pOrc.filter((o) => o.status === "pendente").length;
    const orcAnalise = pOrc.filter((o) => o.status === "em_analise").length;
    const orcConcl = pOrc.filter((o) => o.status === "concluido").length;

    // Tempo médio até fechamento (proxy de tempo por etapa — não há histórico por etapa)
    const closedWithDates = won.filter((l) => l.closedAt);
    const avgDaysToClose = closedWithDates.length > 0
      ? Math.round(closedWithDates.reduce((s, l) => s + (new Date(l.closedAt!).getTime() - new Date(l.createdAt).getTime()) / 86400000, 0) / closedWithDates.length)
      : null;

    // Funil por etapa
    const funnel = KANBAN_STAGES.map((st) => {
      const arr = pLeads.filter((l) => l.stage === st.key);
      return { key: st.key, label: st.label, count: arr.length, value: arr.reduce((s, l) => s + (l.value || 0), 0) };
    });

    // Por loja
    const storeMap = stores.map((store) => {
      const arr = pLeads.filter((l) => l.storeId === store.id);
      const w = arr.filter((l) => isWon(l.stage));
      return { id: store.id, name: store.name, leads: arr.length, won: w.length, valor: w.reduce((s, l) => s + (l.value || 0), 0) };
    }).sort((a, b) => b.valor - a.valor);

    return {
      totalLeads: pLeads.length, open: open.length, won: won.length, lost: lost.length,
      winRate: decided > 0 ? Math.round((won.length / decided) * 100) : 0,
      stale: staleLeads.length, valorOrcado, valorAprovado, ticketMedio,
      novos: pClients.length, recorrentes, conversasWpp,
      orcTotal: pOrc.length, orcPend, orcAnalise, orcConcl,
      avgDaysToClose, funnel, storeMap,
    };
  }, [leads, clients, orcamentos, stores, since, period]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const kpis = [
    { label: "Leads no período", value: m.totalLeads, icon: Users, color: "#6C63FF" },
    { label: "Leads em aberto", value: m.open, icon: Target, color: "#1D9E75" },
    { label: "Sem interação (7d+)", value: m.stale, icon: AlertTriangle, color: "#E24B4A" },
    { label: "Win rate", value: `${m.winRate}%`, icon: TrendingUp, color: "#1D9E75" },
    { label: "Valor orçado", value: brl(m.valorOrcado), icon: FileText, color: "#BA7517" },
    { label: "Valor aprovado", value: brl(m.valorAprovado), icon: DollarSign, color: "#1D9E75" },
    { label: "Ticket médio", value: brl(m.ticketMedio), icon: DollarSign, color: "#6C63FF" },
    { label: "Orçamentos", value: m.orcTotal, icon: FileText, color: "#BA7517" },
    { label: "Conversas WhatsApp", value: m.conversasWpp, icon: MessageCircle, color: "#1D9E75" },
    { label: "Clientes novos", value: m.novos, icon: UserPlus, color: "#6C63FF" },
    { label: "Clientes recorrentes", value: m.recorrentes, icon: Repeat, color: "#BA7517" },
    { label: "Dias até fechar", value: m.avgDaysToClose !== null ? `${m.avgDaysToClose}d` : "—", icon: Clock, color: "#E24B4A" },
  ];

  const maxFunnel = Math.max(...m.funnel.map((f) => f.count), 1);
  const maxStore = Math.max(...m.storeMap.map((s) => s.valor), 1);

  return (
    <div className="space-y-5">
      {/* Filtro de período */}
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${period === p.key ? "bg-brand-500 text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="border border-black/8 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{k.label}</p>
                <k.icon className="h-3.5 w-3.5" style={{ color: k.color }} />
              </div>
              <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil por etapa */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-brand-500" /> Funil por etapa</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {m.funnel.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-28 shrink-0 truncate">{f.label}</span>
                <div className="flex-1 bg-muted/40 rounded-full h-5 overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full flex items-center justify-end pr-2" style={{ width: `${(f.count / maxFunnel) * 100}%` }}>
                    <span className="text-[10px] font-bold text-white">{f.count}</span>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground w-20 text-right tabular-nums">{brl(f.value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Orçamentos por status + Desempenho por loja */}
        <div className="space-y-4">
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-amber-500" /> Orçamentos por status</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-amber-50 p-3"><p className="text-2xl font-bold text-amber-600">{m.orcPend}</p><p className="text-[10px] text-muted-foreground mt-1">Pendentes</p></div>
                <div className="rounded-xl bg-blue-50 p-3"><p className="text-2xl font-bold text-blue-600">{m.orcAnalise}</p><p className="text-[10px] text-muted-foreground mt-1">Em análise</p></div>
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-bold text-emerald-600">{m.orcConcl}</p><p className="text-[10px] text-muted-foreground mt-1">Concluídos</p></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Desempenho por loja</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {m.storeMap.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhuma loja com dados.</p>
              ) : m.storeMap.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-24 shrink-0 truncate">{s.name}</span>
                  <div className="flex-1 bg-muted/40 rounded-full h-5 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.valor / maxStore) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-28 text-right tabular-nums">{s.won} ganhos · {brl(s.valor)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ranking de vendedores */}
      <SellerPerformance />
    </div>
  );
}
