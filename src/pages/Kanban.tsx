 import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
 import { useCrm } from "@/contexts/CrmContext";
 import { useToast } from "@/hooks/use-toast";
import { KANBAN_STAGES, Lead, KanbanStage } from "@/types/crm";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
 import { 
    Phone, Mail, Tag, DollarSign, Plus, Search, Filter, Pencil, Clock, 
    AlertTriangle, X, FileText, GripVertical, CheckCircle2, Briefcase, 
    MapPin, Package, Forward, Zap, Loader2, ChevronLeft, ChevronRight, UserCircle
  } from "lucide-react";
 import { getDisplayClientName, isGenericName } from "@/lib/clientUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NewLeadForm } from "@/components/forms/NewLeadForm";
import { EditLeadForm } from "@/components/forms/EditLeadForm";
import { SwipeableCard } from "@/components/SwipeableCard";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { getUrgencyLevel, getUrgencyConfig, formatIdleTime } from "@/lib/leadUrgency";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InstanceBadge } from "@/components/InstanceBadge";
import { useInstances, useClientInstanceMap } from "@/hooks/useInstances";

const stageColorMap: Record<KanbanStage, string> = {
  abordagem: "border-l-kanban-approach",
  sondagem: "border-l-kanban-probing",
  recomendacao_tecnica: "border-l-kanban-recommendation",
  demonstracao_valor: "border-l-kanban-demonstration",
  contorno_objecoes: "border-l-kanban-objections",
  cross_sell: "border-l-kanban-crosssell",
  precificacao_especial: "border-l-kanban-pricing",
  fechamento: "border-l-kanban-closing",
  pos_venda: "border-l-kanban-postsale",
};

const stageBgMap: Record<KanbanStage, string> = {
  abordagem: "bg-kanban-approach/8 text-kanban-approach",
  sondagem: "bg-kanban-probing/8 text-kanban-probing",
  recomendacao_tecnica: "bg-kanban-recommendation/8 text-kanban-recommendation",
  demonstracao_valor: "bg-kanban-demonstration/8 text-kanban-demonstration",
  contorno_objecoes: "bg-kanban-objections/8 text-kanban-objections",
  cross_sell: "bg-kanban-crosssell/8 text-kanban-crosssell",
  precificacao_especial: "bg-kanban-pricing/8 text-kanban-pricing",
  fechamento: "bg-kanban-closing/8 text-kanban-closing",
  pos_venda: "bg-kanban-postsale/8 text-kanban-postsale",
};

const stageDotMap: Record<KanbanStage, string> = {
  abordagem: "bg-kanban-approach",
  sondagem: "bg-kanban-probing",
  recomendacao_tecnica: "bg-kanban-recommendation",
  demonstracao_valor: "bg-kanban-demonstration",
  contorno_objecoes: "bg-kanban-objections",
  cross_sell: "bg-kanban-crosssell",
  precificacao_especial: "bg-kanban-pricing",
  fechamento: "bg-kanban-closing",
  pos_venda: "bg-kanban-postsale",
};

const stageHeaderGradient: Record<KanbanStage, string> = {
  abordagem: "from-kanban-approach/15 to-kanban-approach/5",
  sondagem: "from-kanban-probing/15 to-kanban-probing/5",
  recomendacao_tecnica: "from-kanban-recommendation/15 to-kanban-recommendation/5",
  demonstracao_valor: "from-kanban-demonstration/15 to-kanban-demonstration/5",
  contorno_objecoes: "from-kanban-objections/15 to-kanban-objections/5",
  cross_sell: "from-kanban-crosssell/15 to-kanban-crosssell/5",
  precificacao_especial: "from-kanban-pricing/15 to-kanban-pricing/5",
  fechamento: "from-kanban-closing/15 to-kanban-closing/5",
  pos_venda: "from-kanban-postsale/15 to-kanban-postsale/5",
};

export default function Kanban() {
  const navigate = useNavigate();
   const { leads, setLeads, addLead, updateLead, deleteLead, loading, sellers } = useCrm();
   const { toast } = useToast();
   const [userSeller, setUserSeller] = useState<any>(null);
   useEffect(() => {
     const fetchUserSeller = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       if (user) {
         const { data: profile } = await supabase
           .from("profiles")
           .select("*, seller:sellers(*)")
           .eq("id", user.id)
           .maybeSingle();
         
         if (profile?.seller) {
           setUserSeller(profile.seller);
         }
       }
     };
     fetchUserSeller();
   }, []);

   const handleAcceptLead = async (leadId: string) => {
     if (!userSeller) {
       toast({
         title: "Erro ao assumir lead",
         description: "Você precisa estar vinculado a um perfil de vendedor para assumir leads.",
         variant: "destructive",
       });
       return;
     }

     const { data, error } = await supabase.rpc("accept_lead", {
       _lead_id: leadId,
       _seller_id: userSeller.id
     });

     if (error) {
       toast({
         title: "Erro ao assumir lead",
         description: error.message,
         variant: "destructive",
       });
     } else {
       toast({
         title: "Lead assumido!",
         description: "Agora você é o responsável por este atendimento.",
       });
     }
   };

  const [search, setSearch] = useState("");
  const [showNewLead, setShowNewLead] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [transferringLead, setTransferringLead] = useState<Lead | null>(null);
  const [transferSellerId, setTransferSellerId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
   const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filterSource !== "all" || filterUrgency !== "all";

  const clearFilters = () => {
    setFilterSource("all");
    setFilterUrgency("all");
  };

  const handleTransferLead = async (sellerId: string, reason: string) => {
    if (!transferringLead) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return;

    const targetSeller = sellers.find(s => s.id === sellerId);

    const { error: updateError } = await supabase
      .from("leads")
      .update({ assigned_to: sellerId, store_id: targetSeller?.store_id || transferringLead.storeId })
      .eq("id", transferringLead.id);

    if (updateError) {
      toast({ title: "Erro ao transferir", description: updateError.message, variant: "destructive" });
      return;
    }

    // Record in redirection history
    const { data: clientData } = await supabase.from("clients").select("id").eq("phone", transferringLead.clientPhone).maybeSingle();
    
    await supabase.from("redirection_history").insert({
      client_id: clientData?.id,
      from_seller_id: transferringLead.assignedTo,
      to_seller_id: sellerId,
      redirection_type: 'manual_transfer',
      reason: reason || 'Transferência manual via Kanban',
      performed_by: profile.id,
      store_id: targetSeller?.store_id || null
    });

    toast({ title: "Lead transferido", description: `Transferido para ${targetSeller?.name}` });
    setTransferringLead(null);
    // Force context refresh by updating lead in state
    updateLead({ ...transferringLead, assignedTo: sellerId, storeId: targetSeller?.store_id || transferringLead.storeId });
  };

  const handleRequestPricing = async (lead: Lead) => {
    const { error: updateError } = await supabase
      .from("leads")
      .update({ stage: 'precificacao_especial' })
      .eq("id", lead.id);

    if (updateError) {
      toast({ title: "Erro", description: updateError.message, variant: "destructive" });
      return;
    }

    await supabase.from("pricing_support_requests").insert({
      lead_id: lead.id,
      seller_id: userSeller?.id,
      status: 'pending'
    });

    toast({ 
      title: "Solicitação enviada!", 
      description: "O André foi notificado para análise de precificação especial.",
    });
    
    updateLead({ ...lead, stage: 'precificacao_especial' });
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
 
   const [scrollInfo, setScrollInfo] = useState({ left: 0, max: 0, countLeft: 0, countRight: 0 });
   const boardRef = useRef<HTMLDivElement>(null);
 
   const updateScrollInfo = () => {
     const el = boardRef.current;
     if (!el) return;
     
     const left = el.scrollLeft;
     const max = el.scrollWidth - el.clientWidth;
     
     // Calculate how many columns are hidden on each side
     const columns = Array.from(el.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.id.startsWith('stage-'));
     let countLeft = 0;
     let countRight = 0;
     
     columns.forEach(col => {
       const rect = col.getBoundingClientRect();
       const boardRect = el.getBoundingClientRect();
       if (rect.right < boardRect.left + 10) countLeft++;
       else if (rect.left > boardRect.right - 10) countRight++;
     });
 
     setScrollInfo({ left, max, countLeft, countRight });
   };
 
   useEffect(() => {
     const el = boardRef.current;
     if (el) {
       el.addEventListener('scroll', updateScrollInfo);
       window.addEventListener('resize', updateScrollInfo);
       // Initial check
       const timer = setTimeout(updateScrollInfo, 100);
       return () => {
         el.removeEventListener('scroll', updateScrollInfo);
         window.removeEventListener('resize', updateScrollInfo);
         clearTimeout(timer);
       };
     }
   }, [loading, filteredLeads.length]);
 
   const scrollBoard = (direction: 'left' | 'right') => {
     const el = boardRef.current;
     if (!el) return;
     const scrollAmount = direction === 'left' ? -300 : 300;
     el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
   };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newStage = result.destination.droppableId as KanbanStage;
    setLeads((prev) =>
      prev.map((l) => (l.id === result.draggableId ? { ...l, stage: newStage } : l))
    );
    supabase.from("leads").update({ stage: newStage }).eq("id", result.draggableId).then(({ error }) => {
      if (error) console.error("Error updating lead stage:", error);
    });
  };

  return (
    <AppLayout title="Kanban Comercial">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar lead..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl border-border/60 bg-card shadow-sm" />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {loading && <span className="text-[10px] text-muted-foreground animate-pulse mr-2">Carregando...</span>}
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-xl text-[10px] h-8"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </Button>
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant={hasActiveFilters ? "default" : "outline"} size="sm" className="rounded-xl">
                  <Filter className="h-3.5 w-3.5 mr-1" /> Filtros
                  {hasActiveFilters && <span className="ml-1 text-[10px]">●</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 space-y-3 rounded-xl" align="start">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Origem</label>
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                       <SelectItem value="whatsapp">WhatsApp</SelectItem>
                       <SelectItem value="instagram">Instagram</SelectItem>
                       <SelectItem value="meta">Meta Ads</SelectItem>
                       <SelectItem value="google">Google</SelectItem>
                       <SelectItem value="site">Site</SelectItem>
                       <SelectItem value="indicacao">Indicação</SelectItem>
                       <SelectItem value="loja">Loja</SelectItem>
                       <SelectItem value="campanha">Campanha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Urgência</label>
                  <Select value={filterUrgency} onValueChange={setFilterUrgency}>
                    <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
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
            <Button size="sm" variant="outline" className="rounded-xl border-kanban-objections/40 text-kanban-objections hover:bg-kanban-objections/10"
              onClick={() => navigate("/suporte-orcamento")}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Suporte Orçamento
            </Button>
            <Button size="sm" className="rounded-xl bg-primary shadow-sm shadow-primary/20" onClick={() => setShowNewLead(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Lead
            </Button>
          </div>
        </div>

        {/* Board Navigation for Mobile */}
        <div className="flex sm:hidden gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-3 px-3">
          {KANBAN_STAGES.map((stage) => (
            <button
              key={`nav-${stage.key}`}
              onClick={() => {
                const el = document.getElementById(`stage-${stage.key}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }}
              className="shrink-0 px-3 py-1.5 rounded-full bg-card border border-border/40 text-[10px] font-bold text-muted-foreground active:bg-primary active:text-primary-foreground transition-colors"
            >
              {stage.label}
            </button>
          ))}
        </div>

         {/* Board */}
         <DragDropContext onDragEnd={onDragEnd}>
           <div className="relative group/board">
             <div 
               ref={boardRef}
               className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-3 px-3 sm:-mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none scroll-smooth kanban-scrollbar"
             >
            {KANBAN_STAGES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => l.stage === stage.key);
              const totalValue = stageLeads.reduce((s, l) => s + l.value, 0);

              const alertCount = stageLeads.filter(l => {
                const u = getUrgencyLevel(l);
                return u === "critical" || u === "warning";
              }).length;

              return (
                <div 
                  key={stage.key} 
                  id={`stage-${stage.key}`}
                  className="flex-shrink-0 w-[85vw] sm:w-[280px] lg:w-[276px] flex flex-col snap-center sm:snap-start"
                >
                  {/* Column header */}
                  <div className={`flex items-center justify-between rounded-t-[12px] p-3 sm:p-3.5 bg-gradient-to-b ${stageHeaderGradient[stage.key]} border-x border-t border-b border-border/40 border-b-kanban-${stage.key === 'abordagem' ? 'approach' : stage.key === 'sondagem' ? 'probing' : stage.key === 'recomendacao_tecnica' ? 'recommendation' : stage.key === 'demonstracao_valor' ? 'demonstration' : stage.key === 'contorno_objecoes' ? 'objections' : stage.key === 'cross_sell' ? 'crosssell' : stage.key === 'fechamento' ? 'closing' : 'postsale'}/20`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`h-2.5 w-2.5 rounded-full ${stageDotMap[stage.key]} ring-2 ring-background shadow-sm`} />
                      <span className="text-[12px] sm:text-[13px] font-medium uppercase tracking-[0.05em] text-[11px] text-muted-foreground">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       {alertCount > 0 && (
                         <Badge variant="destructive" className="text-[11px] font-black px-2 py-0.5 h-6 animate-urgency-pulse rounded-full shadow-lg ring-2 ring-background">
                           <AlertTriangle className="h-3 w-3 mr-1" />{alertCount}
                         </Badge>
                       )}
                      <Badge variant="secondary" className="text-[11px] font-bold tabular-nums bg-foreground/8 rounded-full px-2 py-0.5 h-auto border-0">{stageLeads.length}</Badge>
                    </div>
                  </div>
                  {/* Value summary */}
                  <div className="text-[10px] font-semibold text-muted-foreground px-3.5 py-1.5 bg-muted/40 border-x border-border/40">
                    R$ {totalValue.toLocaleString("pt-BR")}
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={stage.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[420px] flex-1 space-y-2.5 rounded-b-[12px] p-2.5 transition-all duration-200 border border-t-0 border-border/40 ${
                          snapshot.isDraggingOver
                            ? "bg-primary/[0.04] border-primary/20"
                            : "bg-[#F4F4F7]"
                        }`}
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
                                      onMoveNext={stage.key !== "pos_venda" ? () => moveToNextStage(lead) : undefined}
                                    >
                                       <div className={`
                                         rounded-[10px] border-l-[3px] p-3.5 
                                         ${urgency === "ok" ? "bg-card" : ""} 
                                         text-card-foreground
                                         border border-border/30 border-l-0
                                         shadow-sm
                                         transition-all duration-200
                                         hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20 hover:bg-primary/5
                                         !cursor-pointer active:cursor-grabbing
                                         group
                                         ${stageColorMap[stage.key]} 
                                         ${config.borderClass} 
                                         ${config.pulse ? "animate-urgency-pulse" : ""} 
                                         ${snapshot.isDragging ? "shadow-xl ring-2 ring-primary/20 rotate-[1.5deg] scale-[1.02]" : ""}
                                       `}>
                                         {urgency !== "ok" && (
                                           <div className={`absolute -top-2 -right-1 z-10 ${config.badgeClass} text-[10px] px-2 py-0.5 rounded-full font-black shadow-lg tracking-tighter`}>
                                             {config.label}
                                           </div>
                                         )}
                                          {/* Header row */}
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                              {(() => {
                                                const displayName = getDisplayClientName({ 
                                                  name: lead.clientName, 
                                                  phone: lead.clientPhone, 
                                                  source: lead.source, 
                                                  notes: lead.notes 
                                                });
                                                const isGeneric = isGenericName(lead.clientName);
                                                return (
                                                  <>
                                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isGeneric ? 'bg-muted text-muted-foreground' : stageBgMap[stage.key]} text-[10px] font-extrabold`}>
                                                      {isGeneric ? <UserCircle className="h-4 w-4" /> : lead.clientName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <p className={`text-[13px] font-bold leading-tight truncate ${isGeneric ? 'text-foreground/70 italic' : 'text-foreground'}`}>
                                                      {displayName}
                                                    </p>
                                                  </>
                                                );
                                              })()}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              {!lead.assignedTo && userSeller && (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-7 text-[10px] font-bold px-3 rounded-lg border-primary/40 text-primary hover:bg-primary/5"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAcceptLead(lead.id);
                                                  }}
                                                >
                                                  Assumir Lead
                                                </Button>
                                              )}
                                              {urgency !== "ok" && (
                                                <div className="flex flex-col items-end">
                                                   <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-black ${config.badgeClass}`}>
                                                    <Clock className="h-3 w-3" /> {idleTime}
                                                  </span>
                                                </div>
                                              )}
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                                  {lead.stage !== 'precificacao_especial' && lead.stage !== 'fechamento' && lead.stage !== 'pos_venda' && (
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); handleRequestPricing(lead); }}
                                                      className="p-1 rounded-lg hover:bg-yellow-100 text-yellow-600"
                                                      title="Precificação Especial"
                                                    >
                                                      <Zap className="h-3 w-3" />
                                                    </button>
                                                  )}
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setTransferringLead(lead); }}
                                                    className="p-1 rounded-lg hover:bg-blue-100 text-brand-500"
                                                    title="Transferir"
                                                  >
                                                    <Forward className="h-3 w-3" />
                                                  </button>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingLead(lead); }}
                                                    className="p-1 rounded-lg hover:bg-muted"
                                                  >
                                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                                  </button>
                                                </div>
                                            </div>
                                          </div>

                                         {/* Detailed Info */}
                                         <div className="mt-2.5 space-y-1.5 border-t border-border/10 pt-2.5">
                                           <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                             <Phone className="h-3 w-3 shrink-0 text-primary/60" />
                                             <span className="font-medium">{lead.clientPhone}</span>
                                           </div>
                                           
                                           {lead.clientEmail && (
                                             <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                               <Mail className="h-3 w-3 shrink-0 text-primary/60" />
                                               <span className="truncate">{lead.clientEmail}</span>
                                             </div>
                                           )}

                                           {lead.clientType && (
                                             <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                               <Briefcase className="h-3 w-3 shrink-0 text-primary/60" />
                                               <span className="font-semibold text-foreground/80">{lead.clientType}</span>
                                             </div>
                                           )}

                                           {lead.companyWorkSite && (
                                             <div className="flex items-center gap-2 text-[11px] text-muted-foreground italic">
                                               <Briefcase className="h-3 w-3 shrink-0 text-primary/60" />
                                               <span>Obra: {lead.companyWorkSite}</span>
                                             </div>
                                           )}

                                           {lead.storeName && (
                                             <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                               <MapPin className="h-3 w-3 shrink-0 text-primary/60" />
                                               <span>{lead.storeName}</span>
                                             </div>
                                           )}

                                           {lead.interestProducts && (
                                             <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                               <Package className="h-3 w-3 shrink-0 text-primary/60" />
                                               <span className="text-primary font-medium">{lead.interestProducts}</span>
                                             </div>
                                           )}
                                         </div>
                                        {/* Value + Source */}
                                        <div className="mt-2.5 flex items-center justify-between">
                                          <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                                            <DollarSign className="h-3 w-3 text-success" />
                                            R$ {lead.value.toLocaleString("pt-BR")}
                                          </div>
                                          <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{lead.source}</span>
                                        </div>

                                        {/* Tags */}
                                        {lead.tags.length > 0 && (
                                          <div className="mt-2 flex flex-wrap gap-1">
                                            {lead.tags.map((tag) => (
                                              <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/10">
                                                <Tag className="h-2.5 w-2.5" />{tag}
                                              </span>
                                            ))}
                                          </div>
                                        )}

                                         <div className="flex flex-col gap-2 mt-2.5">
                                           {/* Follow-up reminder */}
                                           {lead.nextFollowUp && (
                                             <div className="rounded-lg bg-warning/8 border border-warning/15 px-2.5 py-1.5 text-[10px] font-semibold text-warning flex items-center gap-1.5">
                                               <Clock className="h-3 w-3" />
                                               Follow-up: {new Date(lead.nextFollowUp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                             </div>
                                           )}

                                           {/* Urgency Action */}
                                           {urgency === "critical" && (
                                             <Button 
                                               size="sm" 
                                               className="w-full h-8 text-[11px] font-black bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg shadow-red-600/20 border-0 flex items-center justify-center gap-2 animate-bounce-subtle mt-1"
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 setEditingLead(lead);
                                               }}
                                             >
                                               <Zap className="h-3 w-3" /> Agir agora
                                             </Button>
                                           )}
                                         </div>
                                      </div>
                                    </SwipeableCard>
                                  );
                                })()}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {stageLeads.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40">
                            <div className={`h-10 w-10 rounded-full ${stageBgMap[stage.key]} flex items-center justify-center mb-2 opacity-40`}>
                              <Plus className="h-4 w-4" />
                            </div>
                            <p className="text-[11px]">Sem leads</p>
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
             </div>
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

      <Dialog open={!!transferringLead} onOpenChange={(open) => !open && setTransferringLead(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="h-5 w-5 text-primary" /> Transferir Lead
            </DialogTitle>
            <DialogDescription>
              Selecione para quem deseja transferir o atendimento de <strong>{transferringLead?.clientName}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vendedor de Destino</Label>
              <Select value={transferSellerId} onValueChange={setTransferSellerId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione um vendedor..." />
                </SelectTrigger>
                <SelectContent>
                  {sellers.filter(s => s.id !== transferringLead?.assignedTo).map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground">ID: {s.id.slice(0, 8)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea 
                placeholder="Descreva o motivo da transferência..."
                className="rounded-xl resize-none h-20"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTransferringLead(null)} className="rounded-xl">Cancelar</Button>
            <Button 
              className="rounded-xl gap-2" 
              disabled={!transferSellerId || isTransferring}
              onClick={async () => {
                setIsTransferring(true);
                await handleTransferLead(transferSellerId, transferReason);
                setIsTransferring(false);
                setTransferSellerId("");
                setTransferReason("");
              }}
            >
              {isTransferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
              Transferir Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
