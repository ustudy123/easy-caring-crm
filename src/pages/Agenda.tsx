import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCrm } from "@/contexts/CrmContext";
import { supabase } from "@/integrations/supabase/client";
import { FollowUp } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Phone, MessageCircle, Mail, MapPin, CheckCircle2, Clock, Plus, CalendarDays, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { NewFollowUpForm } from "@/components/forms/NewFollowUpForm";
import { EditFollowUpForm } from "@/components/forms/EditFollowUpForm";

const typeConfig: Record<FollowUp["type"], { icon: typeof Phone; label: string; color: string }> = {
  call: { icon: Phone, label: "Ligação", color: "bg-kanban-attending/10 text-kanban-attending" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "bg-kanban-new/10 text-kanban-new" },
  email: { icon: Mail, label: "E-mail", color: "bg-kanban-quote/10 text-kanban-quote" },
  visit: { icon: MapPin, label: "Visita", color: "bg-kanban-negotiation/10 text-kanban-negotiation" },
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

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
  };

  const filtered = followUps
    .filter((f) => {
      if (view === "pending") return !f.completed;
      if (view === "completed") return f.completed;
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

  return (
    <AppLayout title="Agenda & Follow-ups">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Agendados</p>
                <p className="text-xl font-extrabold">{followUps.filter((f) => !f.completed).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kanban-quote/10">
                <Clock className="h-5 w-5 text-kanban-quote" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hoje</p>
                <p className="text-xl font-extrabold">{todayCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <Clock className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atrasados</p>
                <p className="text-xl font-extrabold text-destructive">{overdueCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Calendário</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="pointer-events-auto" />
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                {(["all", "pending", "completed"] as const).map((v) => (
                  <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)} className="text-xs sm:text-sm">
                    {v === "all" ? "Todos" : v === "pending" ? "Pendentes" : "Concluídos"}
                  </Button>
                ))}
              </div>
              <Button size="sm" className="bg-primary" onClick={() => setShowNewFollowUp(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo Follow-up
              </Button>
            </div>

            <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
              {filtered.map((f) => {
                const config = typeConfig[f.type];
                const Icon = config.icon;
                const isOverdue = new Date(f.scheduledAt) < new Date() && !f.completed;

                return (
                  <motion.div key={f.id} variants={item}>
                    <Card className={`transition-all group ${f.completed ? "opacity-60" : ""} ${isOverdue ? "border-destructive/50" : ""}`}>
                      <CardContent className="flex items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4">
                        <button
                          onClick={() => toggleComplete(f.id)}
                          className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full transition-colors mt-0.5 sm:mt-0 ${
                            f.completed ? "bg-kanban-closed text-white" : "border-2 border-muted-foreground/30 hover:border-primary"
                          }`}
                        >
                          {f.completed && <CheckCircle2 className="h-4 w-4" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <p className={`text-sm font-bold ${f.completed ? "line-through" : ""}`}>{f.clientName}</p>
                            <Badge variant="secondary" className={`text-[10px] ${config.color}`}>
                              <Icon className="h-2.5 w-2.5 mr-0.5" />{config.label}
                            </Badge>
                            {isOverdue && <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{f.description}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">📞 {f.clientPhone}</p>
                            <div className="flex items-center gap-2 sm:hidden">
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                {new Date(f.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {new Date(f.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <button onClick={() => setEditingFollowUp(f)} className="p-1 rounded hover:bg-muted">
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-2">
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold">
                              {new Date(f.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(f.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <button
                            onClick={() => setEditingFollowUp(f)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-muted"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>
      <NewFollowUpForm open={showNewFollowUp} onOpenChange={setShowNewFollowUp} onSubmit={addFollowUp} />
      <EditFollowUpForm followUp={editingFollowUp} open={!!editingFollowUp} onOpenChange={(open) => !open && setEditingFollowUp(null)} onSubmit={updateFollowUp} onDelete={deleteFollowUp} />
    </AppLayout>
  );
}
