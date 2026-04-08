import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCrm } from "@/contexts/CrmContext";
import { supabase } from "@/integrations/supabase/client";
import { FollowUp } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Phone, MessageCircle, Mail, MapPin, CheckCircle2, Clock, Plus, CalendarDays, Pencil, ListChecks, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { NewFollowUpForm } from "@/components/forms/NewFollowUpForm";
import { EditFollowUpForm } from "@/components/forms/EditFollowUpForm";

const typeConfig: Record<FollowUp["type"], { icon: typeof Phone; label: string; gradient: string; bg: string }> = {
  call: { icon: Phone, label: "Ligação", gradient: "from-[hsl(217,78%,52%)] to-[hsl(224,76%,48%)]", bg: "bg-[hsl(217,78%,52%)]/10 text-[hsl(217,78%,52%)]" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", gradient: "from-[hsl(152,60%,42%)] to-[hsl(174,62%,38%)]", bg: "bg-[hsl(152,60%,42%)]/10 text-[hsl(152,60%,42%)]" },
  email: { icon: Mail, label: "E-mail", gradient: "from-[hsl(28,86%,52%)] to-[hsl(338,76%,52%)]", bg: "bg-[hsl(28,86%,52%)]/10 text-[hsl(28,86%,52%)]" },
  visit: { icon: MapPin, label: "Visita", gradient: "from-[hsl(262,60%,55%)] to-[hsl(224,76%,48%)]", bg: "bg-[hsl(262,60%,55%)]/10 text-[hsl(262,60%,55%)]" },
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };
const fadeIn = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function Agenda() {
  const { followUps, setFollowUps, addFollowUp, updateFollowUp, deleteFollowUp } = useCrm();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [view, setView] = useState<"all" | "pending" | "completed">("all");
  const [showNewFollowUp, setShowNewFollowUp] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);

  const toggleComplete = (id: string) => {
    const fu = followUps.find(f => f.id === id);
    const newCompleted = fu ? !fu.completed : true;
    setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, completed: newCompleted } : f)));
    supabase.from("follow_ups").update({ completed: newCompleted }).eq("id", id).then(({ error }) => {
      if (error) console.error("Error toggling follow-up:", error);
    });
  };

  const filtered = followUps
    .filter((f) => {
      if (view === "pending" && f.completed) return false;
      if (view === "completed" && !f.completed) return false;
      if (selectedDate) {
        const fDate = new Date(f.scheduledAt).toDateString();
        if (fDate !== selectedDate.toDateString()) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const todayCount = followUps.filter((f) => {
    const d = new Date(f.scheduledAt);
    const today = new Date();
    return d.toDateString() === today.toDateString() && !f.completed;
  }).length;

  const overdueCount = followUps.filter((f) => {
    return new Date(f.scheduledAt) < new Date() && !f.completed;
  }).length;

  const pendingCount = followUps.filter((f) => !f.completed).length;

  const kpis = [
    { label: "Total Agendados", value: pendingCount, icon: CalendarDays, gradient: "from-[hsl(224,76%,48%)] to-[hsl(262,60%,55%)]" },
    { label: "Hoje", value: todayCount, icon: ListChecks, gradient: "from-[hsl(28,86%,52%)] to-[hsl(338,76%,52%)]" },
    { label: "Atrasados", value: overdueCount, icon: AlertTriangle, gradient: "from-[hsl(0,72%,51%)] to-[hsl(338,76%,52%)]", danger: overdueCount > 0 },
  ];

  // Dates that have follow-ups for calendar dot indicators
  const followUpDates = followUps.reduce<Record<string, number>>((acc, f) => {
    const key = new Date(f.scheduledAt).toDateString();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <AppLayout title="Agenda & Follow-ups">
      <div className="space-y-5">
        {/* KPI Cards */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <motion.div key={kpi.label} variants={item}>
              <Card className="relative overflow-hidden border-border/40 bg-card/80 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group">
                <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradient} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity`} />
                <CardContent className="flex items-center gap-4 p-5 relative">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${kpi.gradient} shadow-lg`}>
                    <kpi.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{kpi.label}</p>
                    <p className={`text-2xl font-extrabold ${kpi.danger ? "text-destructive" : "text-foreground"}`}>{kpi.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Card */}
          <motion.div variants={fadeIn} initial="hidden" animate="show">
            <Card className="lg:col-span-1 border-border/40 bg-card/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-2 border-b border-border/30">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[hsl(262,60%,55%)]">
                    <CalendarDays className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  Calendário
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pt-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="pointer-events-auto"
                  modifiers={{
                    hasFollowUp: Object.keys(followUpDates).map(d => new Date(d)),
                  }}
                  modifiersClassNames={{
                    hasFollowUp: "bg-primary/15 font-bold text-primary",
                  }}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Follow-ups List */}
          <div className="lg:col-span-2 space-y-4">
            <motion.div variants={fadeIn} initial="hidden" animate="show" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                {(["all", "pending", "completed"] as const).map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={view === v ? "default" : "outline"}
                    onClick={() => setView(v)}
                    className={`text-xs sm:text-sm ${view === v ? "bg-gradient-to-r from-primary to-[hsl(262,60%,55%)] text-primary-foreground shadow-md border-0" : "border-border/50 bg-card/60 backdrop-blur-sm hover:bg-muted/80"}`}
                  >
                    {v === "all" ? "Todos" : v === "pending" ? "Pendentes" : "Concluídos"}
                  </Button>
                ))}
              </div>
              <Button size="sm" className="bg-gradient-to-r from-primary to-[hsl(262,60%,55%)] hover:opacity-90 text-primary-foreground shadow-md" onClick={() => setShowNewFollowUp(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo Follow-up
              </Button>
            </motion.div>

            <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
              {filtered.map((f) => {
                const config = typeConfig[f.type];
                const Icon = config.icon;
                const isOverdue = new Date(f.scheduledAt) < new Date() && !f.completed;

                return (
                  <motion.div key={f.id} variants={item}>
                    <Card className={`relative overflow-hidden border-border/40 bg-card/80 backdrop-blur-sm transition-all duration-300 group hover:shadow-lg hover:-translate-y-0.5 ${f.completed ? "opacity-50" : ""} ${isOverdue ? "border-destructive/40" : ""}`}>
                      {/* Left accent bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${isOverdue ? "from-destructive to-destructive/60" : config.gradient} ${f.completed ? "opacity-30" : "opacity-70 group-hover:opacity-100"} transition-opacity`} />

                      <CardContent className="flex items-start sm:items-center gap-3 sm:gap-4 p-4 pl-5">
                        {/* Toggle button */}
                        <button
                          onClick={() => toggleComplete(f.id)}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 mt-0.5 sm:mt-0 ${
                            f.completed
                              ? "bg-gradient-to-br from-[hsl(152,60%,42%)] to-[hsl(174,62%,38%)] text-primary-foreground shadow-md"
                              : "border-2 border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          {f.completed && <CheckCircle2 className="h-4 w-4" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <p className={`text-sm font-bold text-foreground ${f.completed ? "line-through text-muted-foreground" : ""}`}>{f.clientName}</p>
                            <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 border-0 font-medium ${config.bg}`}>
                              <Icon className="h-2.5 w-2.5 mr-0.5" />{config.label}
                            </Badge>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 animate-urgency-pulse">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Atrasado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{f.description}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" /> {f.clientPhone}
                            </div>
                            <div className="flex items-center gap-2 sm:hidden">
                              <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                                {new Date(f.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {new Date(f.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <button onClick={() => setEditingFollowUp(f)} className="p-1.5 rounded-lg hover:bg-muted/80 transition-colors">
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-3">
                          <div className="text-right shrink-0 bg-muted/40 rounded-xl px-3 py-1.5">
                            <p className="text-xs font-bold text-foreground">
                              {new Date(f.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(f.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <button
                            onClick={() => setEditingFollowUp(f)}
                            className="opacity-0 group-hover:opacity-100 transition-all p-2 rounded-xl hover:bg-muted/80"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}

              {filtered.length === 0 && (
                <motion.div variants={fadeIn} className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhum follow-up encontrado</p>
                  <p className="text-xs mt-1">
                    {selectedDate
                      ? `Sem agendamentos para ${selectedDate.toLocaleDateString("pt-BR")}`
                      : "Adicione um novo follow-up para começar"}
                  </p>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
      <NewFollowUpForm open={showNewFollowUp} onOpenChange={setShowNewFollowUp} onSubmit={addFollowUp} />
      <EditFollowUpForm followUp={editingFollowUp} open={!!editingFollowUp} onOpenChange={(open) => !open && setEditingFollowUp(null)} onSubmit={updateFollowUp} onDelete={deleteFollowUp} />
    </AppLayout>
  );
}
