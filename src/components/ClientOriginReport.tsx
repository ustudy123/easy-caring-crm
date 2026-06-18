import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, startOfMonth } from "date-fns";
import { PieChart as PieIcon, Users, Loader2, AlertTriangle } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  sindico: "Síndico",
  comprador: "Comprador",
  pintor: "Pintor",
  arquiteto: "Arquiteto",
  construtor: "Construtor",
  consumidor_final: "Consumidor final",
  sem_categoria: "Sem classificação",
};

const CATEGORY_COLOR: Record<string, string> = {
  sindico: "bg-sky-500",
  comprador: "bg-emerald-500",
  pintor: "bg-amber-500",
  arquiteto: "bg-violet-500",
  construtor: "bg-rose-500",
  consumidor_final: "bg-slate-400",
  sem_categoria: "bg-muted-foreground/40",
};

const PERIODS = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "all", label: "Tudo" },
];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const phoneKey = (p: string) => (p || "").replace(/\D/g, "").slice(-8);

function sinceISO(period: string): string | null {
  const now = new Date();
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  if (period === "month") return startOfMonth(now).toISOString();
  return null;
}

interface Row { category: string; revenue: number; sales: number; }

export function ClientOriginReport() {
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [unclassified, setUnclassified] = useState(0);
  const [classified, setClassified] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const since = sinceISO(period);
        let leadsQ = supabase
          .from("leads")
          .select("client_phone, value, stage, closed_at")
          .in("stage", ["fechamento", "pos_venda"]);
        if (since) leadsQ = leadsQ.gte("closed_at", since);
        const [clientsRes, leadsRes] = await Promise.all([
          supabase.from("clients").select("phone, contact_category"),
          leadsQ,
        ]);
        if (cancel) return;

        const catByPhone = new Map<string, string>();
        let classifiedCount = 0;
        for (const c of (clientsRes.data as any[]) || []) {
          if (c.contact_category) {
            catByPhone.set(phoneKey(c.phone), c.contact_category);
            classifiedCount++;
          }
        }

        const agg = new Map<string, { revenue: number; sales: number }>();
        let total = 0;
        for (const l of (leadsRes.data as any[]) || []) {
          const cat = catByPhone.get(phoneKey(l.client_phone)) || "sem_categoria";
          const v = Number(l.value) || 0;
          const cur = agg.get(cat) || { revenue: 0, sales: 0 };
          cur.revenue += v;
          cur.sales += 1;
          agg.set(cat, cur);
          total += v;
        }

        setRows([...agg.entries()].map(([category, v]) => ({ category, revenue: v.revenue, sales: v.sales })).sort((a, b) => b.revenue - a.revenue));
        setTotalRevenue(total);
        setClassified(classifiedCount);
        setUnclassified((((clientsRes.data as any[]) || []).length) - classifiedCount);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [period]);

  return (
    <div className="rounded-3xl overflow-hidden bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <PieIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">Classificação</p>
            <h3 className="text-lg font-black text-foreground">Faturamento por origem</h3>
          </div>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${period === p.key ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-muted-foreground">Faturamento das vendas fechadas no período</p>
              <p className="text-xl font-black text-foreground">{brl(totalRevenue)}</p>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhuma venda fechada no período.</p>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => {
                  const share = totalRevenue > 0 ? r.revenue / totalRevenue : 0;
                  return (
                    <div key={r.category}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-foreground">{CATEGORY_LABELS[r.category] || r.category}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {brl(r.revenue)} · {Math.round(share * 100)}% · {r.sales} {r.sales === 1 ? "venda" : "vendas"}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${CATEGORY_COLOR[r.category] || "bg-brand-500"}`} style={{ width: `${Math.max(Math.round(share * 100), 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-4 pt-1 border-t border-border/50 mt-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> {classified} clientes classificados
              </span>
              {unclassified > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> {unclassified} sem classificação
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
