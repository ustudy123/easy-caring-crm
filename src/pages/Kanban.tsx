import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCrm } from "@/contexts/CrmContext";
import { KANBAN_STAGES, Lead, KanbanStage } from "@/types/crm";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Phone, Mail, Tag, DollarSign, Plus, Search, Filter, Pencil, Clock, AlertTriangle, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { NewLeadForm } from "@/components/forms/NewLeadForm";
import { EditLeadForm } from "@/components/forms/EditLeadForm";
import { SwipeableCard } from "@/components/SwipeableCard";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { getUrgencyLevel, getUrgencyConfig, formatIdleTime } from "@/lib/leadUrgency";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const stageColorMap: Record<KanbanStage, string> = {
  novo_lead: "border-t-kanban-new",
  em_atendimento: "border-t-kanban-attending",
  precificacao_especial: "border-t-kanban-pricing",
  orcamento_enviado: "border-t-kanban-quote",
  negociacao: "border-t-kanban-negotiation",
  fechado: "border-t-kanban-closed",
};

const stageBgMap: Record<KanbanStage, string> = {
  novo_lead: "bg-kanban-new/10 text-kanban-new",
  em_atendimento: "bg-kanban-attending/10 text-kanban-attending",
  precificacao_especial: "bg-kanban-pricing/10 text-kanban-pricing",
  orcamento_enviado: "bg-kanban-quote/10 text-kanban-quote",
  negociacao: "bg-kanban-negotiation/10 text-kanban-negotiation",
  fechado: "bg-kanban-closed/10 text-kanban-closed",
};

const stageDotMap: Record<KanbanStage, string> = {
  novo_lead: "bg-kanban-new",
  em_atendimento: "bg-kanban-attending",
  precificacao_especial: "bg-kanban-pricing",
  orcamento_enviado: "bg-kanban-quote",
  negociacao: "bg-kanban-negotiation",
  fechado: "bg-kanban-closed",
};

export default function Kanban() {
  const navigate = useNavigate();
  const { leads, setLeads, addLead, updateLead, deleteLead } = useCrm();
  const [search, setSearch] = useState("");
  const [showNewLead, setShowNewLead] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filterSource !== "all" || filterUrgency !== "all";

  const clearFilters = () => {
    setFilterSource("all");
    setFilterUrgency("all");
  };


  const moveToNextStage = (lead: Lead) => {
    const stageKeys = KANBAN_STAGES.map(s => s.key);
    const idx = stageKeys.indexOf(lead.stage);
    if (idx < stageKeys.length - 1) {
      updateLead({ ...lead, stage: stageKeys[idx + 1] });
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (!l.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSource !== "all" && l.source !== filterSource) return false;
    if (filterUrgency !== "all") {
      const u = getUrgencyLevel(l);
      if (filterUrgency === "critical" && u !== "critical") return false;
      if (filterUrgency === "warning" && u !== "warning") return false;
      if (filterUrgency === "ok" && u !== "ok") return false;
    }
    return true;
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newStage = result.destination.droppableId as KanbanStage;
    setLeads((prev) =>
      prev.map((l) => (l.id === result.draggableId ? { ...l, stage: newStage } : l))
    );
    // Persist stage change to Supabase
    supabase.from("leads").update({ stage: newStage }).eq("id", result.draggableId).then(({ error }) => {
      if (error) console.error("Error updating lead stage:", error);
    });
  };

  return (
    <AppLayout title="Kanban Comercial">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar lead..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant={hasActiveFilters ? "default" : "outline"} size="sm">
                  <Filter className="h-3.5 w-3.5 mr-1" /> Filtros
                  {hasActiveFilters && <span className="ml-1 text-[10px]">●</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 space-y-3" align="start">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Origem</label>
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="meta">Meta Ads</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="indicacao">Indicação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Urgência</label>
                  <Select value={filterUrgency} onValueChange={setFilterUrgency}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="critical">Crítico</SelectItem>
                      <SelectItem value="warning">Atenção</SelectItem>
                      <SelectItem value="ok">Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={clearFilters}>
                    <X className="h-3 w-3 mr-1" /> Limpar filtros
                  </Button>
                )}
              </PopoverContent>
            </Popover>
            <Button size="sm" className="bg-primary" onClick={() => setShowNewLead(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Lead
            </Button>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-3 px-3 sm:-mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none">
            {KANBAN_STAGES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => l.stage === stage.key);
              const totalValue = stageLeads.reduce((s, l) => s + l.value, 0);

              const alertCount = stageLeads.filter(l => {
                const u = getUrgencyLevel(l);
                return u === "critical" || u === "warning";
              }).length;

              return (
                <div key={stage.key} className="flex-shrink-0 w-[280px] sm:w-72 snap-start">
                  <div className={`flex items-center justify-between rounded-t-xl p-3 ${stageBgMap[stage.key]}`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${stageDotMap[stage.key]}`} />
                      <span className="text-sm font-bold">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {alertCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] font-bold px-1.5 py-0 animate-urgency-pulse">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{alertCount}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] font-bold">{stageLeads.length}</Badge>
                    </div>
                  </div>
                  <div className="text-[10px] font-semibold text-muted-foreground px-3 py-1.5 bg-muted/50">
                    Total: R$ {totalValue.toLocaleString("pt-BR")}
                  </div>

                  <Droppable droppableId={stage.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[400px] space-y-2 rounded-b-xl p-2 transition-colors ${snapshot.isDraggingOver ? "bg-primary/5" : "bg-muted/30"}`}
                      >
                        {stageLeads.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                {(() => {
                                  const urgency = getUrgencyLevel(lead);
                                  const config = getUrgencyConfig(urgency);
                                  const idleTime = formatIdleTime(lead);
                                  return (
                                <SwipeableCard
                                  onEdit={() => setEditingLead(lead)}
                                  onDelete={() => setPendingDeleteId(lead.id)}
                                  onMoveNext={stage.key !== "fechado" ? () => moveToNextStage(lead) : undefined}
                                >
                                  <div className={`rounded-lg border-t-[3px] p-3 shadow-sm transition-shadow hover:shadow-md hover:bg-card hover:text-card-foreground hover:border-primary/40 cursor-grab active:cursor-grabbing group bg-card text-card-foreground ${stageColorMap[stage.key]} ${config.borderClass} ${config.pulse ? "animate-urgency-pulse" : ""} ${snapshot.isDragging ? "shadow-lg rotate-1" : ""}`}>
                                    <div className="flex items-start justify-between">
                                      <p className="text-sm font-bold text-foreground leading-tight">{lead.clientName}</p>
                                      <div className="flex items-center gap-1">
                                        {urgency !== "ok" && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${config.badgeClass}`}>
                                                  <Clock className="h-2.5 w-2.5" />{idleTime}
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Parado há {idleTime} — {config.label}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setEditingLead(lead); }}
                                        className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 -mr-1 -mt-1 rounded hover:bg-muted"
                                      >
                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                      </button>
                                      </div>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      <span>{lead.clientPhone}</span>
                                    </div>
                                    {lead.clientEmail && (
                                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Mail className="h-3 w-3" />
                                        <span className="truncate">{lead.clientEmail}</span>
                                      </div>
                                    )}
                                    <div className="mt-2 flex items-center justify-between">
                                      <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                                        <DollarSign className="h-3 w-3" />
                                        R$ {lead.value.toLocaleString("pt-BR")}
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">{lead.source}</span>
                                    </div>
                                    {lead.tags.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {lead.tags.map((tag) => (
                                          <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                            <Tag className="h-2.5 w-2.5" />{tag}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {lead.nextFollowUp && (
                                      <div className="mt-2 rounded bg-warning/10 px-2 py-1 text-[10px] font-semibold text-warning">
                                        📅 Follow-up: {new Date(lead.nextFollowUp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                      </div>
                                    )}
                                  </div>
                                </SwipeableCard>
                                  );
                                })()}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
      <NewLeadForm open={showNewLead} onOpenChange={setShowNewLead} onSubmit={addLead} />
      <EditLeadForm lead={editingLead} open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)} onSubmit={updateLead} onDelete={deleteLead} />
      <ConfirmDeleteDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        onConfirm={() => { if (pendingDeleteId) { deleteLead(pendingDeleteId); setPendingDeleteId(null); } }}
      />
    </AppLayout>
  );
}
