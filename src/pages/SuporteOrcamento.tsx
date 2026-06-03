import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCrm } from "@/contexts/CrmContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, DollarSign, Clock, CheckCircle, Send, Search, Filter, MessageSquare, Paperclip, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";

type RequestType = "orcamento" | "precificacao_especial";

interface SupportRequest {
  id: string;
  client_name: string;
  vendedor_name?: string;
  request_type: RequestType;
  notes: string;
  status: "pendente" | "em_analise" | "concluido";
  created_at: string;
  pdf_url?: string;
  pdf_name?: string;
  erp_client_id?: string;
  created_by?: string;
}

export default function SuporteOrcamento() {
  const { sellers } = useCrm();
  const { role, isAdmin, isGerente, isSuporte, sellerId } = useRole();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>("orcamento");
  const [description, setDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ERP Search states
  const [erpSearch, setErpSearch] = useState("");
  const [erpResults, setErpResults] = useState<any[]>([]);
  const [searchingErp, setSearchingErp] = useState(false);
  const [selectedErpClient, setSelectedErpClient] = useState<any | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pricing_support_requests")
        .select(`
          *,
          sellers:seller_id (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((r: any) => ({
        ...r,
        vendedor_name: r.sellers?.name || "Vendedor não identificado"
      }));

      setRequests(formatted);
    } catch (error: any) {
      toast.error("Erro ao carregar solicitações: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleErpSearch = async () => {
    if (erpSearch.length < 2) {
      toast.error("Digite pelo menos 2 caracteres para buscar");
      return;
    }
    setSearchingErp(true);
    try {
      const { data, error } = await supabase.functions.invoke("citel-search-name", {
        body: { name: erpSearch }
      });
      if (error) throw error;
      setErpResults(data.results || []);
      if (!data.found) toast.info("Nenhum cliente encontrado no ERP");
    } catch (error: any) {
      toast.error("Erro na busca ERP: " + error.message);
    } finally {
      setSearchingErp(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedErpClient) {
      toast.error("Selecione um cliente do ERP");
      return;
    }
    if (!description.trim()) {
      toast.error("Descreva a solicitação");
      return;
    }

    setSubmitting(true);
    try {
      let pdfUrl = null;
      if (pdfFile) {
        const fileExt = pdfFile.name.split(".").pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("pricing_attachments")
          .upload(filePath, pdfFile);

        if (uploadError) throw uploadError;
        pdfUrl = filePath;
      }

      const { error: insertError } = await supabase
        .from("pricing_support_requests")
        .insert({
          request_type: requestType,
          client_name: selectedErpClient.name,
          erp_client_id: selectedErpClient.erpId,
          notes: description,
          pdf_url: pdfUrl,
          pdf_name: pdfFile?.name,
          seller_id: sellerId,
          status: "pendente"
        });

      if (insertError) throw insertError;

      toast.success("Solicitação enviada com sucesso!");
      setShowForm(false);
      resetForm();
      fetchRequests();
    } catch (error: any) {
      toast.error("Erro ao enviar: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedErpClient(null);
    setDescription("");
    setPdfFile(null);
    setErpSearch("");
    setErpResults([]);
  };

  const updateRequestStatus = async (id: string, status: SupportRequest["status"]) => {
    try {
      const { error } = await supabase
        .from("pricing_support_requests")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success("Status atualizado!");
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const destStatus = result.destination.droppableId as SupportRequest["status"];
    if (result.source.droppableId === destStatus) return;
    updateRequestStatus(result.draggableId, destStatus);
  };

  const columns: { id: SupportRequest["status"]; label: string; color: string; icon: any }[] = [
    { id: "pendente", label: "Pendentes", color: "text-warning bg-warning/10 border-warning/20", icon: Clock },
    { id: "em_analise", label: "Em Análise", color: "text-brand-500 bg-brand-500/10 border-primary/20", icon: FileText },
    { id: "concluido", label: "Concluídos", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle },
  ];

  const filteredRequests = requests.filter((r) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || 
      r.client_name.toLowerCase().includes(searchLower) || 
      r.vendedor_name?.toLowerCase().includes(searchLower);
    
    const matchesType = filterType === "all" || r.request_type === filterType;

    // Filter by visibility rules
    let isVisible = false;
    if (isAdmin) isVisible = true;
    else if (isSuporte && r.request_type === "orcamento") isVisible = true;
    else if (isGerente && r.request_type === "precificacao_especial") isVisible = true;
    else if (r.created_by === sellerId) isVisible = true; // Fallback for owner (matching sellerId)

    return matchesSearch && matchesType && isVisible;
  });

  const pendingCount = filteredRequests.filter((r) => r.status === "pendente").length;
  const inAnalysisCount = filteredRequests.filter((r) => r.status === "em_analise").length;
  const completedCount = filteredRequests.filter((r) => r.status === "concluido").length;

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
                <p className="text-2xl font-medium text-foreground">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15">
                <FileText className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <p className="text-2xl font-medium text-foreground">{inAnalysisCount}</p>
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
                <p className="text-2xl font-medium text-foreground">{completedCount}</p>
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
              onClick={() => { setRequestType("orcamento"); setShowForm(true); resetForm(); }}
              className="bg-brand-500"
              size="sm"
            >
              <FileText className="h-3.5 w-3.5 mr-1" /> Solicitar Orçamento
            </Button>
            <Button
              onClick={() => { setRequestType("precificacao_especial"); setShowForm(true); resetForm(); }}
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
                  ? "Busque o cliente no ERP e solicite a elaboração de um orçamento."
                  : "Busque o cliente no ERP e solicite análise de precificação especial."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Buscar Cliente no ERP</label>
                <div className="flex gap-2 mb-2">
                  <Input 
                    placeholder="Digite o nome do cliente..." 
                    value={erpSearch}
                    onChange={(e) => setErpSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleErpSearch()}
                  />
                  <Button size="sm" onClick={handleErpSearch} disabled={searchingErp}>
                    {searchingErp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {erpResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded-md p-1 bg-muted/20">
                    {erpResults.map((client) => (
                      <div 
                        key={client.erpId} 
                        className={`p-2 text-xs hover:bg-brand-500/10 cursor-pointer rounded flex justify-between items-center ${selectedErpClient?.erpId === client.erpId ? "bg-brand-500/20" : ""}`}
                        onClick={() => setSelectedErpClient(client)}
                      >
                        <span className="font-medium">{client.name}</span>
                        <span className="text-muted-foreground">ID: {client.erpId}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedErpClient && (
                  <Badge variant="outline" className="mt-2 bg-brand-500/10 border-brand-500/30">
                    Selecionado: {selectedErpClient.name}
                  </Badge>
                )}
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
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Anexar PDF (opcional)</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    id="pdf-upload"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  />
                  <label
                    htmlFor="pdf-upload"
                    className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md cursor-pointer border border-input transition-colors text-xs font-medium"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {pdfFile ? pdfFile.name : "Selecionar arquivo PDF"}
                  </label>
                  {pdfFile && (
                    <Button variant="ghost" size="sm" onClick={() => setPdfFile(null)} className="h-8 text-destructive">
                      Remover
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  Enviar Solicitação
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
              {columns.map((col) => {
                const colRequests = filteredRequests.filter((r) => r.status === col.id);
                return (
                  <div key={col.id} className="flex-shrink-0 w-[300px] flex flex-col bg-muted/30 rounded-[14px] border border-border/40 min-h-[500px]">
                    <div className={`p-3 border-b border-border/40 rounded-t-xl flex items-center justify-between ${col.color}`}>
                      <div className="flex items-center gap-2">
                        <col.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{col.label}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{colRequests.length}</Badge>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`p-3 space-y-3 min-h-[400px] ${snapshot.isDraggingOver ? "bg-brand-500/5" : ""}`}
                        >
                          {colRequests.map((req, index) => (
                            <Draggable key={req.id} draggableId={req.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`shadow-sm hover:shadow-md transition-all ${snapshot.isDragging ? "rotate-2 shadow-xl ring-2 ring-primary/20" : ""}`}
                                >
                                  <CardContent className="p-3 space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="text-xs font-bold truncate flex-1">{req.client_name}</span>
                                      <Badge variant="outline" className="text-[9px] uppercase">
                                        {req.request_type === "orcamento" ? "ORC" : "PREC"}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground line-clamp-2 italic">"{req.notes}"</p>
                                    <div className="flex justify-between items-center text-[9px] text-muted-foreground pt-1 border-t border-border/10">
                                      <span className="truncate max-w-[120px]">{req.vendedor_name}</span>
                                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                                    </div>
                                    {req.pdf_url && (
                                      <Button 
                                        variant="link" 
                                        className="h-auto p-0 text-[9px] text-brand-500"
                                        onClick={async () => {
                                          const { data } = await supabase.storage
                                            .from("pricing_attachments")
                                            .createSignedUrl(req.pdf_url!, 60);
                                          if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                        }}
                                      >
                                        <Paperclip className="h-2 w-2 mr-1" />
                                        Ver PDF
                                      </Button>
                                    )}
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
        )}
      </div>
    </AppLayout>
  );
}
