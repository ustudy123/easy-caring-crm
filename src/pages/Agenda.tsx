import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCrm } from "@/contexts/CrmContext";
import { useRole } from "@/contexts/RoleContext";
import { SellerCombobox } from "@/components/SellerCombobox";
import { FollowUp } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  const { followUps, setFollowUps, addFollowUp, updateFollowUp, deleteFollowUp, sellers } = useCrm();
  const { isAdmin, isGerente, storeId } = useRole();
  const restrictToStore = isGerente && !isAdmin && !!storeId;
  const canFilterBySeller = isAdmin || isGerente; // quem enxerga a agenda de vários vendedores
  const [sellerFilter, setSellerFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [view, setView] = useState<"all" | "pending" | "completed">("all");
  const [showNewFollowUp, setShowNewFollowUp] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);

  // Auto-collapse calendar on mobile initially
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setCalendarOpen(false);
    }
  }, []);

  const toggleComplete = (id: string) => {
    const fu = followUps.find(f => f.id === id);
    if (!fu) return;
    // Passa pelo updateFollowUp do contexto: concluir o follow-up de um
    // reagendamento devolve o lead ao Kanban (regra centralizada lá).
    updateFollowUp({ ...fu, completed: !fu.completed });
  };

  // Escopo do gerente (só a própria loja) + filtro pelo vendedor escolhido.
  const visibleSellers = restrictToStore ? sellers.filter((s) => s.store_id === storeId) : sellers;
  const myStoreSellerIds = new Set(visibleSellers.map((s) => s.id));
  const scoped = followUps
    .filter((f) => !restrictToStore || (f.assignedTo && myStoreSellerIds.has(f.assignedTo)))
    .filter((f) => sellerFilter === "all" || f.assignedTo === sellerFilter);

  const filtered = scoped
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

  const todayCount = scoped.filter((f) => {
    const d = new Date(f.scheduledAt);
    const today = new Date();
    return d.toDateString() === today.toDateString() && !f.completed;
  }).length;

  const overdueCount = scoped.filter((f) => {
    return new Date(f.scheduledAt) < new Date() && !f.completed;
  }).length;

  const pendingCount = scoped.filter((f) => !f.completed).length;

  const kpis = [
    { label: "Total Agendados", value: pendingCount, icon: CalendarDays, gradient: "from-[hsl(224,76%,48%)] to-[hsl(262,60%,55%)]" },
    { label: "Hoje", value: todayCount, icon: ListChecks, gradient: "from-[hsl(28,86%,52%)] to-[hsl(338,76%,52%)]" },
    { label: "Atrasados", value: overdueCount, icon: AlertTriangle, gradient: "from-[hsl(0,72%,51%)] to-[hsl(338,76%,52%)]", danger: overdueCount > 0 },
  ];

  // Dates that have follow-ups for calendar dot indicators
  const followUpDates = scoped.reduce<Record<string, number>>((acc, f) => {
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
              <Card className="relative overflow-hidden border-black/8 bg-white hover:shadow-none transition-all duration-300 group">
                <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradient} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity`} />
                <CardContent className="flex items-center gap-4 p-5 relative">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br ${kpi.gradient} shadow-none`}>
                    <kpi.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground tracking-wide">{kpi.label}</p>
                    <p className={`text-2xl font-medium ${kpi.danger ? "text-destructive" : "text-foreground"}`}>{kpi.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Card - Collapsible on Mobile */}
          <motion.div variants={fadeIn} initial="hidden" animate="show" className="lg:col-span-1">
            <Collapsible open={calendarOpen} onOpenChange={setCalendarOpen}>
              <Card className="border-black/8 bg-white overflow-hidden">
                <CardHeader className="pb-2 border-b border-border/30 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-400">
                      <CalendarDays className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    Calendário
                  </CardTitle>
                  <CollapsibleTrigger asChild className="lg:hidden">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                      {calendarOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent className="lg:block">
                  <CardContent className="flex justify-center pt-3">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        if (window.innerWidth < 1024) setCalendarOpen(false);
                      }}
                      className="pointer-events-auto"
                      modifiers={{
                        hasFollowUp: Object.keys(followUpDates).map(d => new Date(d)),
                      }}
                      modifiersClassNames={{
                        hasFollowUp: "bg-primary/15 font-bold text-primary",
                      }}
                    />
                  </CardContent>
                </CollapsibleContent>
                {!calendarOpen && selectedDate && (
                  <div className="px-4 py-2 bg-muted/30 lg:hidden">
                    <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" />
                      {selectedDate.toLocaleDateString("pt-BR", { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </Card>
            </Collapsible>
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
                    className={`text-xs sm:text-sm ${view === v ? "bg-brand-500 text-primary-foreground shadow-none border-0" : "border-border/50 bg-card/60 backdrop-blur-sm hover:bg-muted/80"}`}
                  >
                    {v === "all" ? "Todos" : v === "pending" ? "Pendentes" : "Concluídos"}
                  </Button>
                ))}
                {canFilterBySeller && (
                  <SellerCombobox
                    value={sellerFilter}
                    onChange={setSellerFilter}
                    sellers={visibleSellers}
                    presets={[{ value: "all", label: "Todos os vendedores" }]}
                    placeholder="Todos os vendedores"
                    className="h-9 w-52 text-xs"
                  />
                )}
              </div>
              <Button size="sm" className="bg-brand-500 hover:opacity-90 text-primary-foreground shadow-none" onClick={() => setShowNewFollowUp(true)}>
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
                    <Card className={`relative overflow-hidden border-black/8 bg-white transition-all duration-300 group hover:shadow-none hover:-translate-y-0.5 ${f.completed ? "opacity-50" : ""} ${isOverdue ? "border-destructive/40" : ""}`}>
                      {/* Left accent bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${isOverdue ? "from-destructive to-destructive/60" : config.gradient} ${f.completed ? "opacity-30" : "opacity-70 group-hover:opacity-100"} transition-opacity`} />

                      <CardContent className="flex items-start sm:items-center gap-3 sm:gap-4 p-4 pl-5">
                        {/* Toggle button */}
                        <button
                          onClick={() => toggleComplete(f.id)}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] transition-all duration-200 mt-0.5 sm:mt-0 ${
                            f.completed
                              ? "bg-gradient-to-br from-[hsl(152,60%,42%)] to-[hsl(174,62%,38%)] text-primary-foreground shadow-none"
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
                          <div className="text-right shrink-0 bg-muted/40 rounded-[14px] px-3 py-1.5">
                            <p className="text-xs font-bold text-foreground">
                              {new Date(f.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(f.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <button
                            onClick={() => setEditingFollowUp(f)}
                            className="opacity-0 group-hover:opacity-100 transition-all p-2 rounded-[14px] hover:bg-muted/80"
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
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/30 mb-4">
                    <CalendarDays className="h-10 w-10 opacity-20" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Nenhum follow-up encontrado</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[250px] text-center">
                    {selectedDate
                      ? `Não existem agendamentos registrados para ${selectedDate.toLocaleDateString("pt-BR")}.`
                      : "Você ainda não possui follow-ups agendados."}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-6 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                    onClick={() => setShowNewFollowUp(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeiro follow-up
                  </Button>
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
