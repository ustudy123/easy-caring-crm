 import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCrm } from "@/contexts/CrmContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { FileText, DollarSign, AlertTriangle, Clock, CheckCircle, Send, Search, Filter, GripVertical, User, MessageSquare } from "lucide-react";
 import { Lead } from "@/types/crm";
import { toast } from "sonner";
 import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

type RequestType = "orcamento" | "precificacao_especial";

interface SupportRequest {
  id: string;
  leadId: string;
  clientName: string;
   vendedorName: string;
  type: RequestType;
  description: string;
  status: "pendente" | "em_analise" | "concluido";
  createdAt: string;
}

export default function SuporteOrcamento() {
   const { leads, updateLead, sellers } = useCrm();
   const [requests, setRequests] = useState<SupportRequest[]>([
     {
       id: "1",
       leadId: "lead1",
       clientName: "Construtora Rocha",
       vendedorName: "Ricardo Silva",
       type: "orcamento",
       description: "Orçamento para pintura predial 5000m2",
       status: "pendente",
       createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
     },
     {
       id: "2",
       leadId: "lead2",
       clientName: "Indústria Metal",
       vendedorName: "Ana Santos",
       type: "precificacao_especial",
       description: "Solicitação de 15% de desconto para fechamento imediato",
       status: "em_analise",
       createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
     },
     {
       id: "3",
       leadId: "lead3",
       clientName: "Mercado Central",
       vendedorName: "Ricardo Silva",
       type: "orcamento",
       description: "Orçamento de tintas epóxi",
       status: "concluido",
       createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
     }
   ]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("orcamento");
  const [description, setDescription] = useState("");

  // Leads that are in relevant stages
  const relevantLeads = leads.filter(
    (l) => ["sondagem", "recomendacao_tecnica", "demonstracao_valor", "contorno_objecoes"].includes(l.stage)
  );

  const handleSubmit = () => {
    if (!selectedLeadId) {
      toast.error("Selecione um lead");
      return;
    }
     const lead = leads.find((l) => l.id === selectedLeadId);
    if (!lead) return;

     const seller = sellers.find(s => s.id === lead.assignedTo) || sellers.find(s => s.name === lead.assignedTo);
 
    const newRequest: SupportRequest = {
      id: crypto.randomUUID(),
      leadId: lead.id,
      clientName: lead.clientName,
       vendedorName: seller?.name || lead.assignedTo || "Vendedor não identificado",
      type: requestType,
      description,
      status: "pendente",
      createdAt: new Date().toISOString(),
    };

    setRequests((prev) => [newRequest, ...prev]);

    // If special pricing, move lead to recomendacao_tecnica stage
    if (requestType === "precificacao_especial" && lead.stage !== "recomendacao_tecnica") {
      updateLead({ ...lead, stage: "recomendacao_tecnica" });
    }

    toast.success(
      requestType === "orcamento"
        ? "Solicitação de orçamento enviada!"
        : "Solicitação de precificação especial enviada!"
    );

    setShowForm(false);
    setSelectedLeadId("");
    setDescription("");
  };

   const updateRequestStatus = (id: string, status: SupportRequest["status"]) => {
     const request = requests.find(r => r.id === id);
     if (!request) return;
 
     setRequests((prev) =>
       prev.map((r) => (r.id === id ? { ...r, status } : r))
     );
 
     const statusLabels = {
       pendente: "Pendente",
       em_analise: "em Análise",
       concluido: "Concluído"
     };
 
     toast.success(`Status atualizado para ${statusLabels[status]}!`);
     
     // Notificar vendedor
     toast.info(`Notificação enviada para ${request.vendedorName}: O orçamento de ${request.clientName} está ${statusLabels[status]}.`, {
       icon: <MessageSquare className="h-4 w-4" />,
       duration: 5000,
     });
   };
 
   const onDragEnd = (result: DropResult) => {
     if (!result.destination) return;
     
     const sourceStatus = result.source.droppableId as SupportRequest["status"];
     const destStatus = result.destination.droppableId as SupportRequest["status"];
     
     if (sourceStatus === destStatus) return;
     
     updateRequestStatus(result.draggableId, destStatus);
   };
 
   const columns: { id: SupportRequest["status"]; label: string; color: string; icon: any }[] = [
     { id: "pendente", label: "Pendentes", color: "text-warning bg-warning/10 border-warning/20", icon: Clock },
     { id: "em_analise", label: "Em Análise", color: "text-primary bg-primary/10 border-primary/20", icon: FileText },
     { id: "concluido", label: "Concluídos", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle },
   ];
 
   const filteredRequests = requests.filter((r) => {
     const searchLower = search.toLowerCase();
     if (search && !r.clientName.toLowerCase().includes(searchLower) && !r.vendedorName.toLowerCase().includes(searchLower)) return false;
     if (filterType !== "all" && r.type !== filterType) return false;
     return true;
   });

  const statusConfig = {
    pendente: { label: "Pendente", color: "bg-warning/15 text-warning border-warning/30" },
    em_analise: { label: "Em Análise", color: "bg-primary/15 text-primary border-primary/30" },
    concluido: { label: "Concluído", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  };

  const pendingCount = requests.filter((r) => r.status === "pendente").length;
  const inAnalysisCount = requests.filter((r) => r.status === "em_analise").length;
  const completedCount = requests.filter((r) => r.status === "concluido").length;

  return (
    <AppLayout title="Suporte a Orçamento">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{inAnalysisCount}</p>
                <p className="text-xs text-muted-foreground">Em Análise</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Concluídos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar solicitação..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="orcamento">Orçamento</SelectItem>
                <SelectItem value="precificacao_especial">Prec. Especial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => { setRequestType("orcamento"); setShowForm(true); }}
              className="bg-primary"
              size="sm"
            >
              <FileText className="h-3.5 w-3.5 mr-1" /> Solicitar Orçamento
            </Button>
            <Button
              onClick={() => { setRequestType("precificacao_especial"); setShowForm(true); }}
              variant="outline"
              size="sm"
              className="border-kanban-recommendation text-kanban-recommendation hover:bg-kanban-recommendation/10"
            >
              <DollarSign className="h-3.5 w-3.5 mr-1" /> Negociação Especial
            </Button>
          </div>
        </div>

        {/* New request form */}
        {showForm && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {requestType === "orcamento" ? "Nova Solicitação de Orçamento" : "Solicitação de Negociação Especial"}
              </CardTitle>
              <CardDescription>
                {requestType === "orcamento"
                  ? "Solicite a elaboração de um orçamento para o cliente."
                  : "Solicite análise de precificação especial para negociação diferenciada."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Lead</label>
                <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um lead..." /></SelectTrigger>
                  <SelectContent>
                    {relevantLeads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.clientName} — R$ {lead.value.toLocaleString("pt-BR")}
                      </SelectItem>
                    ))}
                    {relevantLeads.length === 0 && (
                      <SelectItem value="none" disabled>Nenhum lead disponível</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Descrição / Observações</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes da solicitação..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleSubmit}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Enviar Solicitação
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

          {/* Kanban Board */}
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
              {columns.map((col) => {
               const colRequests = filteredRequests.filter((r) => r.status === col.id);
               return (
                 <div key={col.id} className="flex-shrink-0 w-[300px] flex flex-col bg-muted/30 rounded-xl border border-border/40 min-h-[500px]">
                   {/* Column Header */}
                   <div className={`p-3 border-b border-border/40 rounded-t-xl flex items-center justify-between ${col.color}`}>
                     <div className="flex items-center gap-2">
                       <col.icon className="h-4 w-4" />
                       <span className="text-sm font-bold">{col.label}</span>
                     </div>
                     <Badge variant="secondary" className="bg-background/50 text-[10px] h-5">
                       {colRequests.length}
                     </Badge>
                   </div>
 
                   {/* Droppable Area */}
                   <Droppable droppableId={col.id}>
                     {(provided, snapshot) => (
                       <div
                         ref={provided.innerRef}
                         {...provided.droppableProps}
                         className={`p-3 space-y-3 min-h-[400px] transition-colors ${
                           snapshot.isDraggingOver ? "bg-primary/5" : ""
                         }`}
                       >
                         {colRequests.length === 0 && !snapshot.isDraggingOver && (
                           <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                             <FileText className="h-8 w-8 mb-2" />
                             <p className="text-[10px] font-medium">Nenhuma solicitação</p>
                           </div>
                         )}
                         {colRequests.map((req, index) => (
                           <Draggable key={req.id} draggableId={req.id} index={index}>
                             {(provided, snapshot) => (
                               <Card
                                 ref={provided.innerRef}
                                 {...provided.draggableProps}
                                 {...provided.dragHandleProps}
                                  className={`shadow-sm hover:shadow-md hover:bg-muted/30 transition-all ${
                                    snapshot.isDragging ? "rotate-2 shadow-xl ring-2 ring-primary/20" : ""
                                  }`}
                               >
                                 <CardContent className="p-3 space-y-2">
                                   <div className="flex items-start justify-between gap-2">
                                     <span className="text-xs font-bold truncate leading-tight flex-1">
                                       {req.clientName}
                                     </span>
                                     <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0 bg-muted/50">
                                       {req.type === "orcamento" ? "ORC" : "PREC"}
                                     </Badge>
                                   </div>
                                   
                                   {req.description && (
                                     <p className="text-[10px] text-muted-foreground line-clamp-2 italic">
                                       "{req.description}"
                                     </p>
                                   )}
 
                                   <div className="flex items-center justify-between pt-1.5 border-t border-border/40 mt-1.5">
                                     <div className="flex items-center gap-1.5 text-primary/80">
                                       <User className="h-3 w-3" />
                                       <span className="text-[9px] font-bold truncate max-w-[120px]">
                                         {req.vendedorName}
                                       </span>
                                     </div>
                                     <span className="text-[8px] text-muted-foreground font-medium">
                                       {new Date(req.createdAt).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
                                     </span>
                                   </div>
 
                                   <div className="flex gap-1 mt-2">
                                     {req.status === "pendente" && (
                                       <Button size="sm" variant="outline" className="text-[9px] h-6 w-full py-0 hover:bg-primary/10"
                                         onClick={() => updateRequestStatus(req.id, "em_analise")}>
                                         Analisar
                                       </Button>
                                     )}
                                     {req.status === "em_analise" && (
                                       <Button size="sm" variant="outline" className="text-[9px] h-6 w-full py-0 hover:bg-emerald-500/10"
                                         onClick={() => updateRequestStatus(req.id, "concluido")}>
                                         Concluir
                                       </Button>
                                     )}
                                     {req.status === "concluido" && (
                                       <div className="w-full flex justify-center">
                                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                                       </div>
                                     )}
                                   </div>
                                 </CardContent>
                               </Card>
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
    </AppLayout>
  );
}
