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
    MapPin, Package, Forward, Zap, Loader2, ChevronLeft, ChevronRight, UserCircle, XCircle, Download, LayoutGrid, List, MessageCircle
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
   const { byId: instancesById } = useInstances();
   const clientInstanceByPhone = useClientInstanceMap();
   const [userSeller, setUserSeller] = useState<any>(null);
   // Gate de classificação obrigatória ao fechar a venda.
   const [classifyLead, setClassifyLead] = useState<Lead | null>(null);
   const [classifyCategory, setClassifyCategory] = useState("");
   const [savingClassify, setSavingClassify] = useState(false);
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
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [pricingLead, setPricingLead] = useState<Lead | null>(null);
  const [pricingNotes, setPricingNotes] = useState("");
  const [submittingPricing, setSubmittingPricing] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [transferringLead, setTransferringLead] = useState<Lead | null>(null);
  const [losingLead, setLosingLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [lostNote, setLostNote] = useState("");

  // Motivos padronizados de encerramento/perda (para gerar estatística).
  const LOST_REASONS = [
    "Sem budget no momento",
    "Lead duplicado / já atendido",
    "Sem necessidade ou interesse (só pesquisando)",
    "Prioriza preço absoluto",
    "Tentativas de contato esgotadas",
    "Cliente não tem interesse",
  ];
  const [transferSellerId, setTransferSellerId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
   const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filterUrgency !== "all";

  const clearFilters = () => {
    setFilterUrgency("all");
  };

  const handleExportPipeline = () => {
    const stageLabel = (k: string) => KANBAN_STAGES.find((s) => s.key === k)?.label ?? (k === "perdido" ? "Perdido" : k);
    const sellerName = (id: string) => sellers.find((s) => s.id === id)?.name ?? "";
    exportToCsv(
      leads,
      [
        { key: "clientName", label: "Cliente" },
        { key: "clientPhone", label: "Telefone" },
        { key: "stage", label: "Estágio", format: (l) => stageLabel(l.stage) },
        { key: "value", label: "Valor" },
        { key: "source", label: "Origem" },
        { key: "assignedTo", label: "Vendedor", format: (l) => sellerName(l.assignedTo) },
        { key: "interestProducts", label: "Interesse/Produto" },
        { key: "lostReason", label: "Motivo da perda" },
        { key: "createdAt", label: "Criado em", format: (l) => new Date(l.createdAt).toLocaleDateString("pt-BR") },
      ],
      "pipeline",
    );
  };

  const handleMarkLost = async () => {
    if (!losingLead) return;
    const reason = lostReason.trim();
    if (!reason) {
      toast({ title: "Selecione um motivo", description: "Escolha o motivo do encerramento para registrar a estatística.", variant: "destructive" });
      return;
    }
    const note = lostNote.trim();
    const closedAt = new Date().toISOString();

    // Atualiza o lead para o estado perdido com o motivo padronizado
    updateLead({ ...losingLead, stage: 'perdido', lostReason: reason, closedAt });

    // Registra na timeline do cliente (se houver cliente com o mesmo telefone)
    const { data: { user } } = await supabase.auth.getUser();
    const { data: client } = await supabase
      .from("clients").select("id").eq("phone", losingLead.clientPhone).maybeSingle();
    if (client?.id) {
      await supabase.from("interactions").insert({
        client_id: client.id,
        lead_id: losingLead.id,
        type: "note",
        description: `Negócio marcado como PERDIDO: ${reason}${note ? ` — ${note}` : ""}`,
        created_by: user?.id ?? null,
      });
    }

    toast({ title: "Lead marcado como perdido", description: losingLead.clientName });
    setLosingLead(null);
    setLostReason("");
    setLostNote("");
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

  const handleRequestPricing = (lead: Lead) => {
    setPricingNotes("");
    setPricingLead(lead);
  };

  const submitPricing = async () => {
    if (!pricingLead) return;
    setSubmittingPricing(true);
    try {
      // Garante que o lead esteja na etapa de precificação especial
      if (pricingLead.stage !== 'precificacao_especial') {
        await supabase.from("leads").update({ stage: 'precificacao_especial' }).eq("id", pricingLead.id);
        updateLead({ ...pricingLead, stage: 'precificacao_especial' });
      }

      const { error } = await supabase.from("pricing_support_requests").insert({
        request_type: 'precificacao_especial',
        client_name: pricingLead.clientName,
        lead_id: pricingLead.id,
        seller_id: pricingLead.assignedTo || userSeller?.id || null,
        notes: pricingNotes || null,
        status: 'pendente',
      });
      if (error) throw error;

      toast({ title: "Precificação especial solicitada!", description: "A solicitação foi registrada para análise." });
      setPricingLead(null);
      setPricingNotes("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmittingPricing(false);
    }
  };

  const moveToNextStage = (lead: Lead) => {
    const stageKeys = KANBAN_STAGES.map(s => s.key);
    const idx = stageKeys.indexOf(lead.stage);
    if (idx < stageKeys.length - 1) {
      const nextStage = stageKeys[idx + 1];
      if (nextStage === 'fechamento') {
        gateFechamento(lead, () => updateLead({ ...lead, stage: nextStage }));
        return;
      }
      updateLead({ ...lead, stage: nextStage });
    }
  };

  // Categorias de classificação obrigatória do cliente.
  const CONTACT_CATEGORIES: { value: string; label: string }[] = [
    { value: "sindico", label: "Síndico" },
    { value: "comprador", label: "Comprador" },
    { value: "pintor", label: "Pintor" },
    { value: "arquiteto", label: "Arquiteto" },
    { value: "construtor", label: "Construtor" },
    { value: "consumidor_final", label: "Consumidor final" },
  ];

  // Verifica se o cliente (por telefone) já tem categoria definida.
  const clientHasCategory = async (phone: string): Promise<boolean> => {
    const { data } = await supabase.from("clients").select("contact_category").eq("phone", phone);
    return (data || []).some((r: any) => r.contact_category);
  };

  // Gate: só executa a ação (mover pra Fechamento) se houver categoria; senão,
  // abre o diálogo de classificação obrigatória.
  const gateFechamento = async (lead: Lead, proceed: () => void) => {
    const ok = await clientHasCategory(lead.clientPhone);
    if (ok) { proceed(); return; }
    setClassifyCategory("");
    setClassifyLead(lead);
  };

  const saveClassification = async () => {
    if (!classifyLead || !classifyCategory) {
      toast({ title: "Selecione uma categoria", description: "É obrigatório classificar o cliente para fechar a venda.", variant: "destructive" });
      return;
    }
    setSavingClassify(true);
    try {
      const { data: updated, error } = await supabase
        .from("clients")
        .update({ contact_category: classifyCategory } as any)
        .eq("phone", classifyLead.clientPhone)
        .select("id");
      if (error) throw error;
      // Se o lead não tinha cadastro de cliente, cria um mínimo já classificado.
      if (!updated || updated.length === 0) {
        const { error: insErr } = await supabase
          .from("clients")
          .insert({ name: classifyLead.clientName, phone: classifyLead.clientPhone, contact_category: classifyCategory } as any);
        if (insErr) throw insErr;
      }
      updateLead({ ...classifyLead, stage: 'fechamento' });
      toast({ title: "Cliente classificado!", description: "Venda movida para Fechamento." });
      setClassifyLead(null);
    } catch (e: any) {
      toast({ title: "Erro ao classificar", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSavingClassify(false);
    }
  };

   const filteredLeads = leads.filter((l) => {
     if (!l.clientName.toLowerCase().includes(search.toLowerCase())) return false;
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

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const newStage = result.destination.droppableId as KanbanStage;

    // Classificação obrigatória antes de fechar a venda.
    if (newStage === 'fechamento') {
      const movedLead = leads.find((l) => l.id === result.draggableId);
      if (movedLead && movedLead.stage !== 'fechamento') {
        const ok = await clientHasCategory(movedLead.clientPhone);
        if (!ok) {
          setClassifyCategory("");
          setClassifyLead(movedLead);
          return; // não move até classificar
        }
      }
    }

    setLeads((prev) =>
      prev.map((l) => (l.id === result.draggableId ? { ...l, stage: newStage } : l))
    );
    supabase.from("leads").update({ stage: newStage }).eq("id", result.draggableId).then(({ error }) => {
      if (error) console.error("Error updating lead stage:", error);
    });

    // Ao entrar na etapa de precificação especial, abre o pop-up automaticamente
    if (newStage === 'precificacao_especial') {
      const movedLead = leads.find((l) => l.id === result.draggableId);
      if (movedLead) {
        setPricingNotes("");
        setPricingLead({ ...movedLead, stage: 'precificacao_especial' });
      }
    }
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
              onClick={handleExportPipeline}
              disabled={leads.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar
            </Button>
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
            <div className="inline-flex rounded-xl border border-border/60 bg-card p-0.5 shrink-0">
              <button
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="h-3.5 w-3.5" /> Lista
              </button>
            </div>
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
        {viewMode === "kanban" && (<>
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
                                       <div onClick={() => setEditingLead(lead)} className={`
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
                                              {lead.stage === 'precificacao_especial' && (
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleRequestPricing(lead); }}
                                                  className="inline-flex items-center gap-1 rounded-lg bg-kanban-pricing px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
                                                  title="Abrir precificação especial"
                                                >
                                                  <Zap className="h-3 w-3" /> Precificar
                                                </button>
                                              )}
                                              <button
                                                onClick={(e) => { e.stopPropagation(); navigate(`/conversas?phone=${lead.clientPhone.replace(/\D/g, "")}`); }}
                                                className="p-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600"
                                                title="Abrir conversa no WhatsApp"
                                              >
                                                <MessageCircle className="h-3.5 w-3.5" />
                                              </button>
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
                                                    onClick={(e) => { e.stopPropagation(); setLosingLead(lead); }}
                                                    className="p-1 rounded-lg hover:bg-red-100 text-red-500"
                                                    title="Marcar como perdido"
                                                  >
                                                    <XCircle className="h-3 w-3" />
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
                                          <div className="flex items-center gap-1.5">
                                            <InstanceBadge
                                              instance={instancesById[clientInstanceByPhone[lead.clientPhone]]}
                                              size="xs"
                                            />
                                            <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{lead.source}</span>
                                          </div>
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
         </>)}

         {/* Visualização em Lista */}
         {viewMode === "list" && (
           <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
             {filteredLeads.length === 0 ? (
               <div className="py-16 text-center text-sm text-muted-foreground">Nenhum lead encontrado.</div>
             ) : (
               <div className="overflow-x-auto">
                 <table className="w-full text-sm">
                   <thead>
                     <tr className="border-b border-border/50 bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                       <th className="px-4 py-2.5 font-semibold">Cliente</th>
                       <th className="px-4 py-2.5 font-semibold">Etapa</th>
                       <th className="px-4 py-2.5 font-semibold text-right">Valor</th>
                       <th className="px-4 py-2.5 font-semibold">Vendedor</th>
                       <th className="px-4 py-2.5 font-semibold hidden md:table-cell">Loja</th>
                       <th className="px-4 py-2.5 font-semibold hidden lg:table-cell">Atualizado</th>
                       <th className="px-4 py-2.5 font-semibold text-right"></th>
                     </tr>
                   </thead>
                   <tbody>
                     {[...filteredLeads]
                       .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                       .map((lead) => {
                         const stage = KANBAN_STAGES.find((s) => s.key === lead.stage);
                         const seller = sellers.find((s) => s.id === lead.assignedTo);
                         const urgency = getUrgencyLevel(lead);
                         const dotClass = urgency === "critical" ? "bg-red-500" : urgency === "warning" ? "bg-yellow-500" : "bg-emerald-500";
                         return (
                           <tr
                             key={lead.id}
                             onClick={() => setEditingLead(lead)}
                             className="border-b border-border/30 last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                           >
                             <td className="px-4 py-3">
                               <div className="flex items-center gap-2">
                                 <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
                                 <div className="min-w-0">
                                   <p className="font-medium text-foreground truncate">{lead.clientName}</p>
                                   <p className="text-[11px] text-muted-foreground truncate">{lead.clientPhone}</p>
                                 </div>
                               </div>
                             </td>
                             <td className="px-4 py-3">
                               <Badge variant="secondary" className="text-[10px] font-bold rounded-full border-0 bg-foreground/8">{stage?.label || lead.stage}</Badge>
                             </td>
                             <td className="px-4 py-3 text-right font-semibold tabular-nums">
                               {lead.value ? `R$ ${lead.value.toLocaleString("pt-BR")}` : "—"}
                             </td>
                             <td className="px-4 py-3 text-muted-foreground truncate">{seller?.name || "—"}</td>
                             <td className="px-4 py-3 text-muted-foreground hidden md:table-cell truncate">{lead.storeName || "—"}</td>
                             <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                               {new Date(lead.updatedAt).toLocaleDateString("pt-BR")}
                             </td>
                             <td className="px-4 py-3 text-right">
                               <div className="inline-flex items-center gap-2">
                                 <button
                                   onClick={(e) => { e.stopPropagation(); navigate(`/conversas?phone=${lead.clientPhone.replace(/\D/g, "")}`); }}
                                   className="text-green-600 hover:text-green-700"
                                   title="Abrir conversa no WhatsApp"
                                 >
                                   <MessageCircle className="h-3.5 w-3.5" />
                                 </button>
                                 <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                               </div>
                             </td>
                           </tr>
                         );
                       })}
                   </tbody>
                 </table>
               </div>
             )}
           </div>
         )}
      </div>
      <NewLeadForm open={showNewLead} onOpenChange={setShowNewLead} onSubmit={addLead} />
      <EditLeadForm lead={editingLead} open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)} onSubmit={updateLead} onDelete={deleteLead} />
      <ConfirmDeleteDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        onConfirm={() => { if (pendingDeleteId) { deleteLead(pendingDeleteId); setPendingDeleteId(null); } }}
      />

      {/* Pop-up de Precificação Especial */}
      <Dialog open={!!pricingLead} onOpenChange={(open) => { if (!open) { setPricingLead(null); setPricingNotes(""); } }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-kanban-pricing" /> Precificação Especial
            </DialogTitle>
            <DialogDescription>
              Solicite a análise de precificação para <strong>{pricingLead?.clientName}</strong> sem sair do Kanban.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{pricingLead?.clientName}</span>
              </div>
              {pricingLead?.clientPhone && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Telefone</span>
                  <span className="font-medium">{pricingLead.clientPhone}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Valor atual</span>
                <span className="font-medium tabular-nums">{pricingLead?.value ? `R$ ${pricingLead.value.toLocaleString("pt-BR")}` : "—"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Detalhes da precificação / desconto solicitado</Label>
              <Textarea
                value={pricingNotes}
                onChange={(e) => setPricingNotes(e.target.value)}
                placeholder="Ex.: cliente pediu 12% de desconto na linha premium para fechar o pedido..."
                className="rounded-xl min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setPricingLead(null); setPricingNotes(""); }}>Cancelar</Button>
            <Button className="rounded-xl bg-kanban-pricing hover:opacity-90" onClick={submitPricing} disabled={submittingPricing}>
              {submittingPricing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
              Solicitar precificação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Dialog: Marcar como perdido */}
      <Dialog open={!!losingLead} onOpenChange={(open) => { if (!open) { setLosingLead(null); setLostReason(""); setLostNote(""); } }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" /> Marcar como perdido
            </DialogTitle>
            <DialogDescription>
              {losingLead ? `Encerrar o negócio com ${losingLead.clientName} como perdido.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Motivo do encerramento</Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observação <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea
                placeholder="Detalhe extra, se quiser (ex.: origem da negativa, concorrente citado...)"
                value={lostNote}
                onChange={(e) => setLostNote(e.target.value)}
                className="rounded-xl"
              />
            </div>
            {lostReason === "Cliente não tem interesse" && (
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Lembrete: registre a origem da negativa na observação e mantenha um follow-up mensal com conteúdo de valor (não só preço).
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLosingLead(null); setLostReason(""); setLostNote(""); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleMarkLost}>
              <XCircle className="h-4 w-4 mr-1" /> Confirmar perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!classifyLead} onOpenChange={(open) => { if (!open) setClassifyLead(null); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Classifique o cliente</DialogTitle>
            <DialogDescription>
              Para fechar a venda de <strong>{classifyLead?.clientName}</strong>, é obrigatório informar o tipo de cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label className="text-xs font-semibold">Tipo de cliente</Label>
            <Select value={classifyCategory} onValueChange={setClassifyCategory}>
              <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
              <SelectContent>
                {CONTACT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground pt-1">
              Para intermediários (pintor, arquiteto…), você pode vincular o cliente final do ERP em Conversas → Associar conversa.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassifyLead(null)}>Cancelar</Button>
            <Button onClick={saveClassification} disabled={savingClassify}>
              {savingClassify ? "Salvando..." : "Classificar e fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
