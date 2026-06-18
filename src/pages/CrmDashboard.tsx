import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrm } from "@/contexts/CrmContext";
import { useSellers } from "@/hooks/useSellers";
import { KANBAN_STAGES } from "@/types/crm";
import {
   TrendingUp, Users, Clock, Target,
   Phone, CalendarDays,
  } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { forwardRef, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { subDays, subMonths, startOfDay, isAfter, format, startOfWeek, startOfMonth } from "date-fns";
import { SellerPerformance } from "@/components/SellerPerformance";
import { AdminConsolidatedDashboard } from "@/components/AdminConsolidatedDashboard";
import { QuizAdminStats } from "@/components/QuizAdminStats";
import { ClientOriginReport } from "@/components/ClientOriginReport";
import { useRole } from "@/contexts/RoleContext";

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

const FUNNEL_COLORS = [
  "rgba(108, 99, 255, 1.0)",
  "rgba(108, 99, 255, 0.9)",
  "rgba(108, 99, 255, 0.8)",
  "rgba(108, 99, 255, 0.7)",
  "rgba(108, 99, 255, 0.6)",
  "rgba(108, 99, 255, 0.5)",
  "rgba(108, 99, 255, 0.45)",
  "rgba(29, 158, 117, 1.0)",
];

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

export default function CrmDashboard() {
  const { leads, followUps } = useCrm();
  const { isAdmin, isGerente } = useRole();
  const avgResponseMin = useAvgResponseTime();
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [chartsReady, setChartsReady] = useState(false);

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
  const wonLeads = filteredLeads.filter((l) => l.stage === "fechamento" || l.stage === "pos_venda").length;
  const lostLeads = filteredLeads.filter((l) => l.stage === "perdido").length;
  const decidedLeads = wonLeads + lostLeads;
  const closedLeads = wonLeads;
  // Win rate real: ganhos sobre negócios decididos (ganhos + perdidos)
  const winRate = decidedLeads > 0 ? Math.round((wonLeads / decidedLeads) * 100) : 0;
  const conversionRate = winRate;
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

  const prevActiveLeads = startDate ? prevPeriodLeads.filter((l) => l.stage !== "fechamento" && l.stage !== "pos_venda").length : 0;
  const prevClosedLeads = startDate ? prevPeriodLeads.filter((l) => l.stage === "fechamento" || l.stage === "pos_venda").length : 0;
  const prevConversionRate = startDate && prevPeriodLeads.length > 0 ? Math.round((prevClosedLeads / prevPeriodLeads.length) * 100) : 0;

  const activeLeads = totalLeads - wonLeads - lostLeads;
  const activeLeadsDiff = startDate && prevActiveLeads > 0 ? Math.round(((activeLeads - prevActiveLeads) / prevActiveLeads) * 100) : null;
  const conversionDiff = startDate && prevConversionRate > 0 ? conversionRate - prevConversionRate : null;

  const formatChange = (diff: number | null) => {
    if (diff === null) return { text: "—", positive: true };
    return { text: `${diff >= 0 ? "+" : ""}${diff}%`, positive: diff >= 0 };
  };

  const activeChange = formatChange(activeLeadsDiff);
  const convChange = formatChange(conversionDiff);

  const kpis = [
    { label: "Leads ativos", value: activeLeads, icon: Users, change: activeChange.text, positive: activeChange.positive, color: "#6C63FF", key: 'activeLeads' },
    { label: "Taxa de ganho", value: `${winRate}%`, icon: Target, change: lostLeads > 0 ? `${lostLeads} perdidos` : convChange.text, positive: convChange.positive, color: "#1D9E75", key: 'conversionRate' },
    { label: "Tempo resposta", value: responseLabel, icon: Clock, change: "", positive: true, color: "#BA7517", key: 'responseTime' },
    { label: "Follow-ups", value: pendingFollowUps, icon: Phone, change: `${pendingFollowUps}`, positive: pendingFollowUps === 0, color: "#E24B4A", key: 'pendingFollowUps' },
  ];

  const funnelData = KANBAN_STAGES.map((stage, i) => {
    const stageLeads = filteredLeads.filter((l) => l.stage === stage.key);
    return {
      name: stage.label,
      leads: stageLeads.length,
      valor: stageLeads.reduce((s, l) => s + l.value, 0),
      color: FUNNEL_COLORS[i],
    };
  });

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Bom dia" : greetingHour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <AppLayout title="CRM Dashboard">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 sm:space-y-8">
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
                  className="text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg transition-all"
                >
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <motion.div key={kpi.label} variants={item}>
              <Card className="group relative overflow-hidden border border-black/8 shadow-none bg-white rounded-[14px]">
                <div className="h-[3px] w-full" style={{ backgroundColor: kpi.color }} />
                <CardContent className="p-[18px] pt-[20px]">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 min-w-0">
                       <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.04em]">{kpi.label}</p>
                       <p className="text-[26px] font-medium text-foreground tracking-tight leading-none mt-2 tabular-nums">{kpi.value}</p>
                    </div>
                    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${kpi.color}15` }}>
                      <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant={kpi.positive ? "success" : "destructive"} className="rounded-[20px] px-2 py-0.5 text-[10px]">
                      {kpi.key === 'pendingFollowUps' ? kpi.change : (kpi.positive ? `↑ ${kpi.change}` : `↓ ${kpi.change}`)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div variants={item}>
          <Card className="border border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-medium text-foreground flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Funil de conversão
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              {!chartsReady ? (
                <ChartSkeleton height={180} />
              ) : (
                <div className="relative flex flex-col items-center gap-1 py-2">
                   {funnelData.map((stage, i) => {
                     const maxLeads = Math.max(...funnelData.map((s) => s.leads), 1);
                     const widthPct = Math.max(4, Math.round((stage.leads / maxLeads) * 100));
                     
                     return (
                        <div key={stage.name} className="relative flex items-center w-full">
                           <div className="w-16 sm:w-28 shrink-0 text-right pr-2 sm:pr-4">
                             <span className="text-[9px] sm:text-[11px] font-bold text-muted-foreground line-clamp-1">{stage.name}</span>
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
                          </div>
                        </div>
                     );
                   })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show">
          <SellerPerformance />
        </motion.div>

        {(isAdmin || isGerente) && (
          <motion.div variants={item} initial="hidden" animate="show">
            <AdminConsolidatedDashboard embedded />
          </motion.div>
        )}

        <motion.div variants={item} initial="hidden" animate="show">
          <ClientOriginReport />
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show">
          <QuizAdminStats />
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
