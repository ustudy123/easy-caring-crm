import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrm } from "@/contexts/CrmContext";
import { mockSellers, mockCampaigns } from "@/data/mockData";
import { KANBAN_STAGES } from "@/types/crm";
import { TrendingUp, Users, DollarSign, Target, ArrowUpRight, ArrowDownRight, Phone, MessageCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const { leads, followUps } = useCrm();
  const totalLeads = leads.length;
  const closedLeads = leads.filter((l) => l.stage === "fechado").length;
  const conversionRate = Math.round((closedLeads / totalLeads) * 100);
  const totalValue = leads.reduce((sum, l) => sum + l.value, 0);
  const avgTicket = Math.round(totalValue / totalLeads);
  const pendingFollowUps = followUps.filter((f) => !f.completed).length;

  const kpis = [
    { label: "Leads Ativos", value: totalLeads - closedLeads, icon: Users, change: "+12%", positive: true, color: "bg-primary" },
    { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: Target, change: "+3%", positive: true, color: "bg-kanban-closed" },
    { label: "Ticket Médio", value: `R$ ${avgTicket.toLocaleString("pt-BR")}`, icon: DollarSign, change: "+8%", positive: true, color: "bg-kanban-quote" },
    { label: "Follow-ups Pendentes", value: pendingFollowUps, icon: Phone, change: `${pendingFollowUps}`, positive: false, color: "bg-accent" },
  ];

  const funnelData = KANBAN_STAGES.map((stage) => ({
    name: stage.label,
    leads: leads.filter((l) => l.stage === stage.key).length,
    valor: leads.filter((l) => l.stage === stage.key).reduce((s, l) => s + l.value, 0),
  }));

  const sellerData = mockSellers.map((s) => ({
    name: s.name.split(" ")[0],
    leads: s.leadsCount,
    conversoes: s.conversions,
  }));

  const sourceData = [
    { name: "WhatsApp", value: leads.filter((l) => l.source === "whatsapp").length },
    { name: "Instagram", value: leads.filter((l) => l.source === "instagram").length },
    { name: "Meta Ads", value: leads.filter((l) => l.source === "meta").length },
    { name: "Google", value: leads.filter((l) => l.source === "google").length },
    { name: "Indicação", value: leads.filter((l) => l.source === "indicacao").length },
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

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Funnel */}
          <motion.div variants={item} className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Funil de Vendas
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
