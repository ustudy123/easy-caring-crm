import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrm } from "@/contexts/CrmContext";
import { useSellers } from "@/hooks/useSellers";
import { KANBAN_STAGES } from "@/types/crm";
import { TrendingUp, Users, Clock, Target, ArrowUpRight, ArrowDownRight, Phone, MessageCircle, ArrowDown, CalendarDays, Sparkles } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Area, AreaChart } from "recharts";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { subDays, subMonths, startOfDay, isAfter, format, startOfWeek, startOfMonth } from "date-fns";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

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

const KPI_GRADIENTS = [
  "from-primary/90 to-info/80",
  "from-kanban-closed/90 to-success/80",
  "from-kanban-quote/90 to-warning/80",
  "from-accent/90 to-secondary/80",
];

export default function Dashboard() {
  const { leads, followUps } = useCrm();
  const sellers = useSellers();
  const avgResponseMin = useAvgResponseTime();
  const [period, setPeriod] = useState<PeriodKey>("all");

  const startDate = getStartDate(period);

  const filteredLeads = useMemo(() => {
    if (!startDate) return leads;
    return leads.filter((l) => isAfter(new Date(l.createdAt), startDate));
  }, [leads, startDate]);

  const filteredFollowUps = useMemo(() => {
    if (!startDate) return followUps;
    return followUps.filter((f) => isAfter(new Date(f.scheduledAt), startDate));
  }, [followUps, startDate]);

  const totalLeads = filteredLeads.length;
  const closedLeads = filteredLeads.filter((l) => l.stage === "fechado").length;
  const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;
  const pendingFollowUps = filteredFollowUps.filter((f) => !f.completed).length;

  const responseLabel = avgResponseMin !== null ? `${avgResponseMin} min` : "...";

  const prevPeriodLeads = useMemo(() => {
    if (!startDate) return [];
    const periodMs = Date.now() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - periodMs);
    return leads.filter((l) => {
      const d = new Date(l.createdAt);
      return isAfter(d, prevStart) && !isAfter(d, startDate);
    });
  }, [leads, startDate]);

  const prevActiveLeads = startDate ? prevPeriodLeads.filter((l) => l.stage !== "fechado").length : 0;
  const prevClosedLeads = startDate ? prevPeriodLeads.filter((l) => l.stage === "fechado").length : 0;
  const prevConversionRate = startDate && prevPeriodLeads.length > 0 ? Math.round((prevClosedLeads / prevPeriodLeads.length) * 100) : 0;

  const activeLeads = totalLeads - closedLeads;
  const activeLeadsDiff = startDate && prevActiveLeads > 0 ? Math.round(((activeLeads - prevActiveLeads) / prevActiveLeads) * 100) : null;
  const conversionDiff = startDate && prevConversionRate > 0 ? conversionRate - prevConversionRate : null;

  const formatChange = (diff: number | null) => {
    if (diff === null) return { text: "—", positive: true };
    return { text: `${diff >= 0 ? "+" : ""}${diff}%`, positive: diff >= 0 };
  };

  const activeChange = formatChange(activeLeadsDiff);
  const convChange = formatChange(conversionDiff);

  const kpis = [
    { label: "Leads Ativos", value: activeLeads, icon: Users, change: activeChange.text, positive: activeChange.positive },
    { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: Target, change: convChange.text, positive: convChange.positive },
    { label: "Tempo Médio Resposta", value: responseLabel, icon: Clock, change: "", positive: true },
    { label: "Follow-ups Pendentes", value: pendingFollowUps, icon: Phone, change: `${pendingFollowUps}`, positive: false },
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

  const COLORS = ["hsl(152,60%,42%)", "hsl(338,76%,52%)", "hsl(224,76%,48%)", "hsl(28,86%,52%)", "hsl(262,60%,55%)"];

  const timelineData = useMemo(() => {
    const useWeeks = period === "week" || period === "month";
    const grouped: Record<string, number> = {};

    filteredLeads.forEach((l) => {
      const d = new Date(l.createdAt);
      const key = useWeeks
        ? format(startOfWeek(d, { weekStartsOn: 1 }), "dd/MM")
        : format(startOfMonth(d), "MMM/yy");
      grouped[key] = (grouped[key] || 0) + 1;
    });

    const sortKeys: Record<string, number> = {};
    filteredLeads.forEach((l) => {
      const d = new Date(l.createdAt);
      const key = useWeeks
        ? format(startOfWeek(d, { weekStartsOn: 1 }), "dd/MM")
        : format(startOfMonth(d), "MMM/yy");
      if (!sortKeys[key]) {
        sortKeys[key] = useWeeks
          ? startOfWeek(d, { weekStartsOn: 1 }).getTime()
          : startOfMonth(d).getTime();
      }
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => (sortKeys[a] || 0) - (sortKeys[b] || 0))
      .map(([key, count]) => ({ periodo: key, leads: count }));
  }, [filteredLeads, period]);

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Bom dia" : greetingHour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <AppLayout title="Dashboard">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Welcome + Period filter */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
              {greeting} <span className="text-lg">👋</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Aqui está o resumo do seu CRM</p>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as PeriodKey)} className="bg-card border rounded-xl p-1 shadow-sm">
              {PERIOD_OPTIONS.map((opt) => (
                <ToggleGroupItem
                  key={opt.value}
                  value={opt.value}
                  className="text-xs px-3 py-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm rounded-lg transition-all"
                >
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => (
            <motion.div key={kpi.label} variants={item}>
              <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 group">
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* Gradient accent strip */}
                    <div className={`w-1.5 bg-gradient-to-b ${KPI_GRADIENTS[idx]} rounded-l-lg`} />
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                          <p className="mt-1.5 text-2xl font-extrabold text-foreground tracking-tight">{kpi.value}</p>
                        </div>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${KPI_GRADIENTS[idx]} shadow-lg group-hover:scale-105 transition-transform`}>
                          <kpi.icon className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                      {kpi.change && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                          {kpi.positive ? (
                            <span className="flex items-center gap-0.5 text-xs font-bold text-success">
                              <ArrowUpRight className="h-3 w-3" />{kpi.change}
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-xs font-bold text-accent">
                              <ArrowDownRight className="h-3 w-3" />{kpi.change}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">vs anterior</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Funnel conversion visual */}
        <motion.div variants={item}>
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
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
                          <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
                          <span className={`text-xs font-bold ${convRate && convRate >= 50 ? 'text-success' : 'text-destructive'}`}>
                            {convRate !== null ? `${convRate}%` : '—'}
                          </span>
                        </div>
                      )}
                      {i === 0 && <div className="h-6" />}
                      <div
                        className="rounded-xl flex flex-col items-center justify-center py-3 px-2 transition-all min-h-[70px] shadow-sm hover:shadow-md hover:scale-[1.02]"
                        style={{
                          backgroundColor: bgColor,
                          width: `${widthPct}%`,
                          minWidth: '80px',
                        }}
                      >
                        <span className="text-primary-foreground text-lg font-extrabold">{stage.leads}</span>
                        <span className="text-primary-foreground/80 text-[10px] font-medium text-center leading-tight">{stage.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1">
                        R$ {stage.valor.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-6 justify-center border-t pt-3">
                <div className="text-center">
                  <p className="text-lg font-extrabold text-foreground">
                    {funnelData[0]?.leads || 0} → {funnelData[funnelData.length - 1]?.leads || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Início → Fechado</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold gradient-text">
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

        {/* Timeline area chart */}
        <motion.div variants={item}>
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10">
                  <CalendarDays className="h-3.5 w-3.5 text-info" />
                </div>
                Evolução de Leads ao Longo do Tempo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(224,76%,48%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(224,76%,48%)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                        boxShadow: "var(--shadow-elevated)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke="hsl(224,76%,48%)"
                      strokeWidth={2.5}
                      fill="url(#leadGradient)"
                      dot={{ r: 4, fill: "hsl(224,76%,48%)", strokeWidth: 2, stroke: "hsl(var(--card))" }}
                      activeDot={{ r: 6 }}
                      name="Leads criados"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Nenhum lead no período selecionado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={item} className="lg:col-span-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/10">
                    <TrendingUp className="h-3.5 w-3.5 text-secondary" />
                  </div>
                  Leads e Valor por Etapa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={funnelData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === "valor" ? `R$ ${value.toLocaleString("pt-BR")}` : value
                      }
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="leads" fill="hsl(224,76%,48%)" radius={[8, 8, 0, 0]} name="Leads" />
                    <Bar dataKey="valor" fill="hsl(262,60%,55%)" radius={[8, 8, 0, 0]} name="valor" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10">
                    <MessageCircle className="h-3.5 w-3.5 text-success" />
                  </div>
                  Origem dos Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {sourceData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center">
                  {sourceData.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-muted-foreground">{s.name}</span>
                      <span className="font-semibold text-foreground">{s.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Sellers performance */}
        <motion.div variants={item}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-kanban-attending/10">
                  <Users className="h-3.5 w-3.5 text-kanban-attending" />
                </div>
                Desempenho por Vendedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sellerData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={70} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="leads" fill="hsl(217,78%,52%)" radius={[0, 8, 8, 0]} name="Leads" />
                  <Bar dataKey="conversoes" fill="hsl(152,60%,42%)" radius={[0, 8, 8, 0]} name="Conversões" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming follow-ups */}
        <motion.div variants={item}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
                  <CalendarDays className="h-3.5 w-3.5 text-accent" />
                </div>
                Próximos Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {followUps
                  .filter((f) => !f.completed)
                  .slice(0, 5)
                  .map((f) => (
                    <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-border/60 p-3 gap-2 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          f.type === 'call' ? 'bg-kanban-attending/15 text-kanban-attending' :
                          f.type === 'whatsapp' ? 'bg-kanban-new/15 text-kanban-new' :
                          f.type === 'visit' ? 'bg-kanban-negotiation/15 text-kanban-negotiation' :
                          'bg-kanban-quote/15 text-kanban-quote'
                        }`}>
                          {f.type === 'call' ? <Phone className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{f.clientName}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{f.description}</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap sm:text-right pl-12 sm:pl-0">
                        {new Date(f.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                {followUps.filter((f) => !f.completed).length === 0 && (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <CalendarDays className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum follow-up pendente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
