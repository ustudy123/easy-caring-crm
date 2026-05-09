import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrm } from "@/contexts/CrmContext";
import { useSellers } from "@/hooks/useSellers";
import { KANBAN_STAGES } from "@/types/crm";
import {
   TrendingUp, Users, Clock, Target, ArrowUpRight, ArrowDownRight,
   Phone, MessageCircle, CalendarDays, Sparkles, BarChart3,
   AlertTriangle, ShieldAlert, CheckCircle2,
 } from "lucide-react";
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Area, AreaChart, LabelList,
} from "recharts";
import { motion } from "framer-motion";
 import { forwardRef, useEffect, useMemo, useState, Suspense, lazy } from "react";
 import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { subDays, subMonths, startOfDay, isAfter, format, startOfWeek, startOfMonth } from "date-fns";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

// --- Avg response time hook ---
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
      data.forEach((m) => { if (!byPhone[m.phone]) byPhone[m.phone] = []; byPhone[m.phone].push(m); });
      const responseTimes: number[] = [];
      Object.values(byPhone).forEach((msgs) => {
        for (let i = 0; i < msgs.length - 1; i++) {
          if (!msgs[i].is_from_me && msgs[i + 1].is_from_me && msgs[i].timestamp && msgs[i + 1].timestamp) {
            const diff = new Date(msgs[i + 1].timestamp!).getTime() - new Date(msgs[i].timestamp!).getTime();
            if (diff > 0 && diff < 24 * 60 * 60 * 1000) responseTimes.push(diff / 60000);
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

// Funnel gradient ramp: 8 stops from light blue to deep purple
const FUNNEL_COLORS = [
  "hsl(210, 80%, 62%)",
  "hsl(220, 76%, 56%)",
  "hsl(230, 72%, 52%)",
  "hsl(240, 68%, 50%)",
  "hsl(252, 64%, 48%)",
  "hsl(260, 62%, 46%)",
  "hsl(268, 60%, 44%)",
  "hsl(275, 58%, 42%)",
];

// Skeleton for chart loading (forwardRef so framer-motion can pass refs through)
const ChartSkeleton = forwardRef<HTMLDivElement, { height?: number }>(({ height = 260 }, ref) => {
  return (
    <div ref={ref} className="space-y-3" style={{ height }}>
      <div className="flex items-end gap-2 h-full">
        {[60, 80, 45, 90, 70, 55, 85, 40].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
});
ChartSkeleton.displayName = "ChartSkeleton";

// Custom tooltip for funnel
function FunnelTooltip({ stage, count, value, convRate }: { stage: string; count: number; value: number; convRate: number | null }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 shadow-lg text-xs space-y-1">
      <p className="font-bold text-foreground">{stage}</p>
      <p className="text-muted-foreground">Leads: <span className="font-semibold text-foreground">{count}</span></p>
      <p className="text-muted-foreground">Valor: <span className="font-semibold text-foreground">R$ {value.toLocaleString("pt-BR")}</span></p>
      {convRate !== null && (
        <p className="text-muted-foreground">Conversão: <span className="font-semibold text-foreground">{convRate}%</span></p>
      )}
    </div>
  );
}

 export default function Dashboard() {
   const isMobile = useIsMobile();
  const { leads, followUps } = useCrm();
  const sellers = useSellers();
  const avgResponseMin = useAvgResponseTime();
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [chartsReady, setChartsReady] = useState(false);
  const [hoveredFunnel, setHoveredFunnel] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setChartsReady(true), 600);
    return () => clearTimeout(t);
  }, []);

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
  const closedLeads = filteredLeads.filter((l) => l.stage === "fechamento" || l.stage === "pos_venda").length;
  const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;
  const pendingFollowUps = filteredFollowUps.filter((f) => !f.completed).length;
  const responseLabel = avgResponseMin !== null ? `${avgResponseMin} min` : "...";

  // Previous period comparison
  const prevPeriodLeads = useMemo(() => {
    if (!startDate) return [];
    const periodMs = Date.now() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - periodMs);
    return leads.filter((l) => {
      const d = new Date(l.createdAt);
      return isAfter(d, prevStart) && !isAfter(d, startDate);
    });
  }, [leads, startDate]);

  const prevActiveLeads = startDate ? prevPeriodLeads.filter((l) => l.stage !== "fechamento" && l.stage !== "pos_venda").length : 0;
  const prevClosedLeads = startDate ? prevPeriodLeads.filter((l) => l.stage === "fechamento" || l.stage === "pos_venda").length : 0;
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

  // KPI semantic colors: icon bg only
  const kpis = [
    { label: "LEADS ATIVOS", value: activeLeads, icon: Users, change: activeChange.text, positive: activeChange.positive, iconColor: "text-primary", iconBg: "bg-primary/10", key: 'activeLeads' },
    { label: "TAXA DE CONVERSÃO", value: `${conversionRate}%`, icon: Target, change: convChange.text, positive: convChange.positive, iconColor: "text-success", iconBg: "bg-success/10", key: 'conversionRate' },
    { label: "TEMPO MÉDIO RESPOSTA", value: responseLabel, icon: Clock, change: "", positive: true, iconColor: "text-warning", iconBg: "bg-warning/10", key: 'responseTime' },
    { label: "FOLLOW-UPS PENDENTES", value: pendingFollowUps, icon: Phone, change: `${pendingFollowUps}`, positive: pendingFollowUps === 0, iconColor: "text-destructive", iconBg: "bg-destructive/10", key: 'pendingFollowUps' },
  ];

  // Funnel data
  const funnelData = KANBAN_STAGES.map((stage, i) => {
    const stageLeads = filteredLeads.filter((l) => l.stage === stage.key);
    return {
      name: stage.label,
      leads: stageLeads.length,
      valor: stageLeads.reduce((s, l) => s + l.value, 0),
      color: FUNNEL_COLORS[i],
    };
  });

  // Horizontal bar data for "Leads e Valor por Etapa"
  const barData = funnelData.map((d) => ({
    name: d.name,
    leads: d.leads,
    valor: d.valor,
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
  const totalSourceLeads = sourceData.reduce((a, b) => a + b.value, 0);

  const SOURCE_COLORS = [
    "hsl(152, 60%, 42%)",
    "hsl(338, 76%, 52%)",
    "hsl(224, 76%, 48%)",
    "hsl(38, 92%, 50%)",
    "hsl(262, 60%, 55%)",
  ];

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
        sortKeys[key] = useWeeks ? startOfWeek(d, { weekStartsOn: 1 }).getTime() : startOfMonth(d).getTime();
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
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 sm:space-y-8">
        {/* Welcome + Period filter */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
              {greeting} <span className="text-base sm:text-lg">👋</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Aqui está o resumo do seu CRM</p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
            <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as PeriodKey)} className="bg-card border border-border/60 rounded-xl p-0.5 sm:p-1 shadow-sm">
              {PERIOD_OPTIONS.map((opt) => (
                <ToggleGroupItem
                  key={opt.value}
                  value={opt.value}
                  className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm rounded-lg transition-all"
                >
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </motion.div>

        {/* KPIs — glassmorphism cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {kpis.map((kpi) => (
            <motion.div key={kpi.label} variants={item}>
              <Card 
                tabIndex={0}
                className="group relative overflow-hidden border border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all duration-300 glass-card"
                style={{ borderLeft: `3px solid hsl(var(--${kpi.iconColor.replace('text-', '')}))` }}
              >
                <CardContent className="p-3 sm:p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5 sm:space-y-1 min-w-0">
                       <p className="text-[8px] sm:text-[10px] font-semibold text-muted-foreground tracking-[0.12em] truncate uppercase">{kpi.label}</p>
                       <p className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight tabular-nums leading-none mt-1 sm:mt-2">{kpi.value}</p>
                    </div>
                    <div className={`flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ${kpi.iconBg} group-hover:scale-105 transition-transform`}>
                      <kpi.icon className={`h-3.5 w-3.5 sm:h-5 sm:w-5 ${kpi.iconColor}`} />
                    </div>
                  </div>
                  {kpi.change && (
                    <div className="mt-2 sm:mt-3 flex items-center gap-1">
                      {kpi.key === 'pendingFollowUps' ? (
                        <span className="flex items-center gap-0.5 text-[10px] sm:text-xs font-bold text-warning">
                          <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />{kpi.change}
                        </span>
                      ) : kpi.positive ? (
                        <span className="flex items-center gap-0.5 text-[10px] sm:text-xs font-bold text-success">
                          <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />{kpi.change}
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[10px] sm:text-xs font-bold text-destructive">
                          <ArrowDownRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />{kpi.change}
                        </span>
                      )}
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">
                        {kpi.key === 'pendingFollowUps' ? 'pendentes' : 'vs período anterior'}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Funnel — waterfall visualization */}
        <motion.div variants={item}>
          <Card className="border border-border/50 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-default">
            <CardHeader className="pb-3">
              <CardTitle className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                Funil de Conversão
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              {!chartsReady ? (
                <ChartSkeleton height={180} />
              ) : (
                <>
                  <div className="relative flex flex-col items-center gap-1 py-2">
                    {funnelData.map((stage, i) => {
                      const maxLeads = Math.max(...funnelData.map((s) => s.leads), 1);
                      const widthPct = Math.max(25, Math.round((stage.leads / maxLeads) * 100));
                      const prevCount = i > 0 ? funnelData[i - 1].leads : null;
                      const convRate = prevCount && prevCount > 0 ? Math.round((stage.leads / prevCount) * 100) : null;
                      const isHovered = hoveredFunnel === i;

                      return (
                        <TooltipProvider key={stage.name}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative flex items-center w-full group/funnel cursor-help">
                                 <div className="w-16 sm:w-28 shrink-0 text-right pr-2 sm:pr-4">
                                   <span className="text-[9px] sm:text-[11px] font-bold text-muted-foreground leading-tight uppercase tracking-tighter sm:tracking-normal line-clamp-1">{stage.name}</span>
                                </div>
                                <div className="flex-1 flex items-center gap-1.5 sm:gap-3">
                                   <div className="flex-1 relative min-w-[60px]">
                                    <motion.div
                                      className="h-6 sm:h-9 rounded-sm sm:rounded-lg flex items-center justify-end pr-1.5 sm:pr-3 transition-all"
                                      style={{
                                        width: `${widthPct}%`,
                                        backgroundColor: stage.color,
                                      }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${widthPct}%` }}
                                      transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                                    >
                                      <span className="text-[9px] sm:text-xs font-bold text-white tabular-nums">{stage.leads}</span>
                                    </motion.div>
                                  </div>
                                  {convRate !== null && (
                                    <span className={`text-[8px] sm:text-[11px] font-black tabular-nums w-7 sm:w-10 shrink-0 ${convRate >= 50 ? 'text-success' : 'text-destructive'}`}>
                                      {convRate}%
                                    </span>
                                  )}
                                  {convRate === null && <span className="w-7 sm:w-10 shrink-0" />}
                                </div>
                              </div>
                            </TooltipTrigger>
                             <TooltipContent side={isMobile ? "top" : "right"}>
                              <FunnelTooltip stage={stage.name} count={stage.leads} value={stage.valor} convRate={convRate} />
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                  {/* Summary stats */}
                  <div className="mt-4 sm:mt-5 flex flex-wrap gap-4 sm:gap-8 justify-center border-t border-border/40 pt-3 sm:pt-4">
                     <div className="text-center min-w-[80px]">
                      <p className="text-lg sm:text-2xl font-extrabold text-foreground tabular-nums">
                        {funnelData[0]?.leads || 0} → {funnelData[funnelData.length - 1]?.leads || 0}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Início → Fechado</p>
                    </div>
                     <div className="text-center min-w-[80px]">
                      <p className="text-lg sm:text-2xl font-extrabold gradient-text tabular-nums">
                        {funnelData[0]?.leads > 0
                          ? `${Math.round((funnelData[funnelData.length - 1]?.leads / funnelData[0]?.leads) * 100)}%`
                          : "0%"}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Conversão Total</p>
                    </div>
                     <div className="text-center min-w-[80px]">
                      <p className="text-lg sm:text-2xl font-extrabold text-foreground tabular-nums">
                        R$ {funnelData.reduce((a, b) => a + b.valor, 0).toLocaleString("pt-BR")}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Valor Total no Funil</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Timeline area chart */}
        <motion.div variants={item}>
          <Card className="border border-border/50 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-default">
            <CardHeader className="pb-3">
              <CardTitle className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10">
                  <CalendarDays className="h-3.5 w-3.5 text-info" />
                </div>
                Evolução de Leads ao Longo do Tempo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!chartsReady ? (
                <ChartSkeleton />
              ) : timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(224,76%,48%)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(224,76%,48%)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <RTooltip
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

        {/* Charts row — horizontal bar + donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <motion.div variants={item} className="lg:col-span-2">
            <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-default">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/10">
                    <BarChart3 className="h-3.5 w-3.5 text-secondary" />
                  </div>
                  Leads e Valor por Etapa
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!chartsReady ? (
                  <ChartSkeleton height={300} />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                       <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={isMobile ? 60 : 90} />
                      <RTooltip
                        formatter={(value: number, name: string) =>
                          name === "Valor" ? `R$ ${value.toLocaleString("pt-BR")}` : value
                        }
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="leads" fill="hsl(224,76%,48%)" radius={[0, 6, 6, 0]} name="Leads">
                        <LabelList dataKey="leads" position="right" className="text-[11px] font-semibold fill-foreground" />
                      </Bar>
                      <Bar dataKey="valor" fill="hsl(262,60%,55%)" radius={[0, 6, 6, 0]} name="Valor">
                        <LabelList
                          dataKey="valor"
                          position="right"
                          className="text-[11px] font-semibold fill-foreground"
                          formatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-default">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10">
                    <MessageCircle className="h-3.5 w-3.5 text-success" />
                  </div>
                  Origem dos Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!chartsReady ? (
                  <ChartSkeleton height={200} />
                ) : (
                  <>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={sourceData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            strokeWidth={0}
                            cornerRadius={4}
                          >
                            {sourceData.map((_, i) => (
                              <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RTooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "12px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center stat */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <p className="text-2xl font-extrabold text-foreground tabular-nums leading-none">{totalSourceLeads}</p>
                          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Total</p>
                        </div>
                      </div>
                    </div>
                     <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-4 justify-center">
                      {sourceData.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-1.5 text-xs">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[i] }} />
                           <span className="text-muted-foreground whitespace-nowrap">{s.name}</span>
                          <span className="font-semibold text-foreground tabular-nums">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Sellers performance */}
        <motion.div variants={item}>
          <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-default">
            <CardHeader className="pb-3">
              <CardTitle className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10">
                  <Users className="h-3.5 w-3.5 text-info" />
                </div>
                Desempenho por Vendedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!chartsReady ? (
                <ChartSkeleton height={220} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sellerData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                     <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={isMobile ? 55 : 75} />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="leads" fill="hsl(224,76%,48%)" radius={[0, 6, 6, 0]} name="Leads" />
                    <Bar dataKey="conversoes" fill="hsl(152,60%,42%)" radius={[0, 6, 6, 0]} name="Conversões" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming follow-ups */}
        <motion.div variants={item}>
          <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-default">
            <CardHeader className="pb-3">
              <CardTitle className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10">
                  <CalendarDays className="h-3.5 w-3.5 text-warning" />
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
                    <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-border/50 p-3 gap-2 hover:bg-muted/30 hover:border-border transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          f.type === "call" ? "bg-info/10 text-info" :
                          f.type === "whatsapp" ? "bg-success/10 text-success" :
                          f.type === "visit" ? "bg-primary/10 text-primary" :
                          "bg-warning/10 text-warning"
                        }`}>
                          {f.type === "call" ? <Phone className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{f.clientName}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{f.description}</p>
                        </div>
                      </div>
                       <span className="text-xs font-medium text-muted-foreground whitespace-nowrap sm:text-right pl-[48px] sm:pl-0 tabular-nums">
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
