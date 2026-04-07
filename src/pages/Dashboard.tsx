import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrm } from "@/contexts/CrmContext";
import { useSellers } from "@/hooks/useSellers";
import { KANBAN_STAGES } from "@/types/crm";
import { TrendingUp, Users, Clock, Target, ArrowUpRight, ArrowDownRight, Phone, MessageCircle, ArrowDown, CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { subDays, subMonths, startOfDay, isAfter } from "date-fns";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function useAvgResponseTime() {
  const [avgMinutes, setAvgMinutes] = useState<number | null>(null);

  useEffect(() => {
    const calc = async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("phone, is_from_me, timestamp")
        .order("timestamp", { ascending: true });

      if (!data || data.length === 0) { setAvgMinutes(0); return; }

      const byPhone: Record<string, typeof data> = {};
      data.forEach((m) => {
        if (!byPhone[m.phone]) byPhone[m.phone] = [];
        byPhone[m.phone].push(m);
      });

      const responseTimes: number[] = [];
      Object.values(byPhone).forEach((msgs) => {
        for (let i = 0; i < msgs.length - 1; i++) {
          if (!msgs[i].is_from_me && msgs[i + 1].is_from_me && msgs[i].timestamp && msgs[i + 1].timestamp) {
            const diff = new Date(msgs[i + 1].timestamp!).getTime() - new Date(msgs[i].timestamp!).getTime();
            if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
              responseTimes.push(diff / 60000);
            }
          }
        }
      });

      setAvgMinutes(responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0);
    };
    calc();
  }, []);

  return avgMinutes;
}

type PeriodKey = "week" | "month" | "quarter" | "all";

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "week", label: "7 dias" },
  { value: "month", label: "30 dias" },
  { value: "quarter", label: "90 dias" },
  { value: "all", label: "Tudo" },
];

function getStartDate(period: PeriodKey): Date | null {
  const now = new Date();
  switch (period) {
    case "week": return startOfDay(subDays(now, 7));
    case "month": return startOfDay(subMonths(now, 1));
    case "quarter": return startOfDay(subMonths(now, 3));
    default: return null;
  }
}

export default function Dashboard() {
  const { leads, followUps } = useCrm();
  const sellers = useSellers();
  const avgResponseMin = useAvgResponseTime();
  const [period, setPeriod] = useState<PeriodKey>("all");

  const startDate = getStartDate(period);

  const filteredLeads = useMemo(() => {
    if (!startDate) return leads;
    return leads.filter((l) => isAfter(new Date(l.createdAt), startDate));
  }, [leads, period]);

  const filteredFollowUps = useMemo(() => {
    if (!startDate) return followUps;
    return followUps.filter((f) => isAfter(new Date(f.scheduledAt), startDate));
  }, [followUps, period]);

  const totalLeads = filteredLeads.length;
  const closedLeads = filteredLeads.filter((l) => l.stage === "fechado").length;
  const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;
  const pendingFollowUps = filteredFollowUps.filter((f) => !f.completed).length;

  const responseLabel = avgResponseMin !== null ? `${avgResponseMin} min` : "...";

  const kpis = [
    { label: "Leads Ativos", value: totalLeads - closedLeads, icon: Users, change: "+12%", positive: true, color: "bg-primary" },
    { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: Target, change: "+3%", positive: true, color: "bg-kanban-closed" },
    { label: "Tempo Médio Resposta", value: responseLabel, icon: Clock, change: "", positive: true, color: "bg-kanban-quote" },
    { label: "Follow-ups Pendentes", value: pendingFollowUps, icon: Phone, change: `${pendingFollowUps}`, positive: false, color: "bg-accent" },
  ];

  const funnelData = KANBAN_STAGES.map((stage) => ({
    name: stage.label,
    leads: filteredLeads.filter((l) => l.stage === stage.key).length,
    valor: filteredLeads.filter((l) => l.stage === stage.key).reduce((s, l) => s + l.value, 0),
  }));

  const sellerData = sellers.map((s) => ({
    name: s.name.split(" ")[0],
    leads: s.leadsCount,
    conversoes: s.conversions,
  }));

  const sourceData = [
    { name: "WhatsApp", value: filteredLeads.filter((l) => l.source === "whatsapp").length },
    { name: "Instagram", value: filteredLeads.filter((l) => l.source === "instagram").length },
    { name: "Meta Ads", value: filteredLeads.filter((l) => l.source === "meta").length },
    { name: "Google", value: filteredLeads.filter((l) => l.source === "google").length },
    { name: "Indicação", value: filteredLeads.filter((l) => l.source === "indicacao").length },
  ];

  const COLORS = ["hsl(142,71%,45%)", "hsl(340,82%,52%)", "hsl(220,90%,56%)", "hsl(32,95%,50%)", "hsl(271,81%,56%)"];

  return (
    <AppLayout title="Dashboard">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <motion.div key={kpi.label} variants={item}>
              <Card className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                      <p className="mt-1 text-2xl font-extrabold text-foreground">{kpi.value}</p>
                    </div>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.color}`}>
                      <kpi.icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1">
                    {kpi.positive ? (
                      <ArrowUpRight className="h-3 w-3 text-success" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-accent" />
                    )}
                    <span className={`text-xs font-semibold ${kpi.positive ? "text-success" : "text-accent"}`}>
                      {kpi.change}
                    </span>
                    <span className="text-xs text-muted-foreground">vs mês anterior</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Funnel conversion visual */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Funil de Conversão por Etapa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-stretch gap-0">
                {funnelData.map((stage, i) => {
                  const prevCount = i > 0 ? funnelData[i - 1].leads : null;
                  const convRate = prevCount && prevCount > 0 ? Math.round((stage.leads / prevCount) * 100) : null;
                  const maxLeads = Math.max(...funnelData.map(s => s.leads), 1);
                  const widthPct = Math.max(30, Math.round((stage.leads / maxLeads) * 100));
                  const FUNNEL_COLORS = [
                    "hsl(var(--kanban-new))",
                    "hsl(var(--kanban-attending))",
                    "hsl(var(--kanban-pricing))",
                    "hsl(var(--kanban-quote))",
                    "hsl(var(--kanban-negotiation))",
                    "hsl(var(--kanban-closed))",
                  ];
                  const bgColor = FUNNEL_COLORS[i] || "hsl(var(--primary))";

                  return (
                    <div key={stage.name} className="flex flex-col items-center flex-1">
                      {i > 0 && (
                        <div className="flex flex-col items-center my-1 md:my-0 md:mb-2">
                          <ArrowDown className="h-4 w-4 text-muted-foreground" />
                          <span className={`text-xs font-bold ${convRate && convRate >= 50 ? 'text-success' : 'text-destructive'}`}>
                            {convRate !== null ? `${convRate}%` : '—'}
                          </span>
                        </div>
                      )}
                      {i === 0 && <div className="h-6" />}
                      <div
                        className="rounded-lg flex flex-col items-center justify-center py-3 px-2 transition-all min-h-[70px]"
                        style={{
                          backgroundColor: bgColor,
                          width: `${widthPct}%`,
                          minWidth: '80px',
                        }}
                      >
                        <span className="text-white text-lg font-extrabold">{stage.leads}</span>
                        <span className="text-white/80 text-[10px] font-medium text-center leading-tight">{stage.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1">
                        R$ {stage.valor.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Summary */}
              <div className="mt-4 flex flex-wrap gap-4 justify-center border-t pt-3">
                <div className="text-center">
                  <p className="text-lg font-extrabold text-foreground">
                    {funnelData[0]?.leads || 0} → {funnelData[funnelData.length - 1]?.leads || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Início → Fechado</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-foreground">
                    {funnelData[0]?.leads > 0
                      ? `${Math.round((funnelData[funnelData.length - 1]?.leads / funnelData[0]?.leads) * 100)}%`
                      : '0%'}
                  </p>
                  <p className="text-xs text-muted-foreground">Conversão Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar chart */}
          <motion.div variants={item} className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Leads e Valor por Etapa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={funnelData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === "valor" ? `R$ ${value.toLocaleString("pt-BR")}` : value
                      }
                    />
                    <Bar dataKey="leads" fill="hsl(220,90%,56%)" radius={[6, 6, 0, 0]} name="Leads" />
                    <Bar dataKey="valor" fill="hsl(280,65%,60%)" radius={[6, 6, 0, 0]} name="valor" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Source pie */}
          <motion.div variants={item}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-kanban-new" />
                  Origem dos Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {sourceData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2">
                  {sourceData.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Sellers performance */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Desempenho por Vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sellerData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="leads" fill="hsl(217,91%,60%)" radius={[0, 6, 6, 0]} name="Leads" />
                  <Bar dataKey="conversoes" fill="hsl(142,71%,45%)" radius={[0, 6, 6, 0]} name="Conversões" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming follow-ups */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Próximos Follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {followUps
                  .filter((f) => !f.completed)
                  .slice(0, 5)
                  .map((f) => (
                    <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          f.type === 'call' ? 'bg-kanban-attending/20 text-kanban-attending' :
                          f.type === 'whatsapp' ? 'bg-kanban-new/20 text-kanban-new' :
                          f.type === 'visit' ? 'bg-kanban-negotiation/20 text-kanban-negotiation' :
                          'bg-kanban-quote/20 text-kanban-quote'
                        }`}>
                          {f.type === 'call' ? <Phone className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{f.clientName}</p>
                          <p className="text-xs text-muted-foreground">{f.description}</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap sm:text-right pl-11 sm:pl-0">
                        {new Date(f.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
