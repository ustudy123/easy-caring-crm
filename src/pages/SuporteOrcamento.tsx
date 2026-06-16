import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCrm } from "@/contexts/CrmContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText, DollarSign, Clock, CheckCircle, Send, Search, Filter, MessageSquare, Paperclip, Phone, Loader2, User, X, Download } from "lucide-react";
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
  seller_id?: string;
  response_notes?: string;
  response_pdf_url?: string;
  response_pdf_name?: string;
  responded_at?: string;
  responded_by_name?: string;
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
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [pdfRawUrl, setPdfRawUrl] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState("");
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [savingResponse, setSavingResponse] = useState(false);
  const canRespond = isAdmin || isSuporte || isGerente;

  // Pré-preenche a resposta ao abrir uma solicitação
  useEffect(() => {
    setResponseNotes(selectedRequest?.response_notes || "");
    setResponseFile(null);
  }, [selectedRequest?.id]);

  const submitResponse = async () => {
    if (!selectedRequest) return;
    setSavingResponse(true);
    try {
      let respUrl = selectedRequest.response_pdf_url || null;
      let respName = selectedRequest.response_pdf_name || null;
      if (responseFile) {
        const ext = responseFile.name.split(".").pop();
        const filePath = `responses/${selectedRequest.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("pricing_attachments").upload(filePath, responseFile);
        if (upErr) throw upErr;
        respUrl = filePath;
        respName = responseFile.name;
      }
      const responderName = sellers.find((s) => s.id === sellerId)?.name
        || (isAdmin ? "Administrador" : isSuporte ? "Suporte" : isGerente ? "Gerente" : "Equipe");
      const { error } = await supabase.from("pricing_support_requests").update({
        response_notes: responseNotes || null,
        response_pdf_url: respUrl,
        response_pdf_name: respName,
        responded_at: new Date().toISOString(),
        responded_by_name: responderName,
      }).eq("id", selectedRequest.id);
      if (error) throw error;
      toast.success("Resposta salva!");
      setResponseFile(null);
      setSelectedRequest({
        ...selectedRequest,
        response_notes: responseNotes || undefined,
        response_pdf_url: respUrl || undefined,
        response_pdf_name: respName || undefined,
        responded_at: new Date().toISOString(),
        responded_by_name: responderName,
      });
      fetchRequests();
    } catch (e: any) {
      toast.error("Erro ao salvar resposta: " + e.message);
    } finally {
      setSavingResponse(false);
    }
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("pricing_attachments").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o anexo.");
      return;
    }
    setPdfRawUrl(data.signedUrl);
    // Baixa como blob e exibe localmente — bloqueadores costumam barrar a URL
    // direta do Supabase, mas não um blob local.
    try {
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error("download falhou");
      const blob = await res.blob();
      setViewingPdf(URL.createObjectURL(blob));
    } catch {
      setViewingPdf(data.signedUrl);
    }
  };

  const closePdf = () => {
    if (viewingPdf && viewingPdf.startsWith("blob:")) URL.revokeObjectURL(viewingPdf);
    setViewingPdf(null);
    setPdfRawUrl(null);
  };

  const downloadAttachment = async (path: string, name?: string) => {
    const { data, error } = await supabase.storage.from("pricing_attachments").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível baixar o anexo.");
      return;
    }
    try {
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error("download falhou");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name || path.split("/").pop() || "anexo.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: abre a URL direta (o navegador faz o download)
      window.open(data.signedUrl, "_blank");
    }
  };

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
          request_type: requestType as any,
          client_name: selectedErpClient.name,
          erp_client_id: selectedErpClient.erpId,
          notes: description,
          pdf_url: pdfUrl,
          pdf_name: pdfFile?.name,
          // Só grava seller_id se o usuário atual for um vendedor real (evita
          // violar a FK quando o usuário é admin/suporte sem registro em sellers).
          seller_id: sellers.some((s) => s.id === sellerId) ? sellerId : null,
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
    else if (r.created_by === sellerId || r.seller_id === sellerId) isVisible = true;

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
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Lead / Cliente</label>
                {!selectedErpClient ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Buscar por nome no ERP..." 
                          value={erpSearch}
                          onChange={(e) => setErpSearch(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleErpSearch()}
                          className="pl-9"
                        />
                      </div>
                      <Button size="sm" onClick={handleErpSearch} disabled={searchingErp} variant="secondary">
                        {searchingErp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                      </Button>
                    </div>
                    {erpResults.length > 0 && (
                      <div className="max-h-60 overflow-y-auto border rounded-md divide-y bg-background shadow-sm animate-in fade-in slide-in-from-top-1">
                        {erpResults.map((client) => (
                          <div 
                            key={client.erpId} 
                            className="p-3 hover:bg-muted/50 cursor-pointer transition-colors group"
                            onClick={() => setSelectedErpClient(client)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-0.5">
                                <p className="text-sm font-semibold group-hover:text-brand-500 transition-colors">{client.name}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <span className="bg-muted px-1.5 py-0.5 rounded">ID: {client.erpId}</span>
                                  {client.phone && <span>• {client.phone}</span>}
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <CheckCircle className="h-4 w-4 text-brand-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-brand-500/5 border-brand-500/20 animate-in zoom-in-95">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-brand-500/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-brand-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-600">{selectedErpClient.name}</p>
                        <p className="text-[10px] text-muted-foreground">ERP ID: {selectedErpClient.erpId}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => {
                        setSelectedErpClient(null);
                        setErpResults([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
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
                                  onClick={() => setSelectedRequest(req)}
                                  className={`shadow-sm hover:shadow-md hover:ring-1 hover:ring-brand-500/30 transition-all cursor-pointer select-none ${snapshot.isDragging ? "rotate-2 shadow-xl ring-2 ring-primary/20" : ""}`}
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
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      {req.pdf_url && (
                                        <Button 
                                          variant="secondary" 
                                          className="h-6 px-2 text-[9px] font-semibold bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 border-none"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openAttachment(req.pdf_url!);
                                          }}
                                        >
                                          <Paperclip className="h-3 w-3 mr-1" />
                                          PDF
                                        </Button>
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
        )}

        {/* Detalhes da solicitação */}
        <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedRequest?.request_type === "orcamento"
                  ? <FileText className="h-5 w-5 text-brand-500" />
                  : <DollarSign className="h-5 w-5 text-kanban-recommendation" />}
                {selectedRequest?.client_name}
              </DialogTitle>
              <DialogDescription>
                {selectedRequest?.request_type === "orcamento" ? "Solicitação de orçamento" : "Negociação / precificação especial"}
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-3 py-1 text-sm">
                <div className="rounded-xl bg-muted/40 p-3 space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Vendedor</span>
                    <span className="font-medium text-right">{selectedRequest.vendedor_name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-medium">{new Date(selectedRequest.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {selectedRequest.status === "pendente" ? "Pendente" : selectedRequest.status === "em_analise" ? "Em análise" : "Concluído"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Detalhes</span>
                  <p className="rounded-xl border border-border/40 p-3 whitespace-pre-wrap">{selectedRequest.notes || "—"}</p>
                </div>

                {selectedRequest.pdf_url && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 rounded-xl bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 border-none"
                      onClick={() => openAttachment(selectedRequest.pdf_url!)}
                    >
                      <Paperclip className="h-4 w-4 mr-1" /> Abrir anexo
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      title="Baixar anexo"
                      onClick={() => downloadAttachment(selectedRequest.pdf_url!, selectedRequest.pdf_name)}
                    >
                      <Download className="h-4 w-4 mr-1" /> Baixar
                    </Button>
                  </div>
                )}

                {/* Resposta do suporte/admin (exibição) */}
                {(selectedRequest.response_notes || selectedRequest.response_pdf_url) && (
                  <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-500">Resposta do suporte</span>
                      {selectedRequest.responded_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {selectedRequest.responded_by_name} · {new Date(selectedRequest.responded_at).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                    {selectedRequest.response_notes && (
                      <p className="text-sm whitespace-pre-wrap">{selectedRequest.response_notes}</p>
                    )}
                    {selectedRequest.response_pdf_url && (
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="rounded-lg bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 border-none" onClick={() => openAttachment(selectedRequest.response_pdf_url!)}>
                          <Paperclip className="h-3.5 w-3.5 mr-1" /> Ver anexo da resposta
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => downloadAttachment(selectedRequest.response_pdf_url!, selectedRequest.response_pdf_name)}>
                          <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Formulário de resposta (suporte/admin/gerente) */}
                {canRespond && (
                  <div className="rounded-xl border border-border/50 p-3 space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {selectedRequest.response_notes || selectedRequest.response_pdf_url ? "Editar resposta" : "Responder solicitação"}
                    </span>
                    <Textarea
                      value={responseNotes}
                      onChange={(e) => setResponseNotes(e.target.value)}
                      placeholder="Escreva a resposta para o vendedor (ex.: orçamento aprovado, condições, observações)..."
                      className="min-h-[70px] text-sm"
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <label className="flex-1 min-w-0">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => setResponseFile(e.target.files?.[0] || null)}
                        />
                        <span className="flex items-center gap-1.5 cursor-pointer text-xs rounded-lg border border-dashed border-border px-3 py-2 hover:bg-muted/50 overflow-hidden">
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{responseFile ? responseFile.name : "Anexar arquivo (opcional)"}</span>
                        </span>
                      </label>
                      {responseFile && (
                        <Button variant="ghost" size="sm" className="h-8 text-destructive shrink-0" onClick={() => setResponseFile(null)}>Remover</Button>
                      )}
                    </div>
                    <Button
                      className="w-full rounded-xl bg-brand-500 hover:bg-brand-600"
                      disabled={savingResponse || (!responseNotes.trim() && !responseFile && !selectedRequest.response_notes && !selectedRequest.response_pdf_url)}
                      onClick={submitResponse}
                    >
                      {savingResponse ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                      Salvar resposta
                    </Button>
                  </div>
                )}

                <div className="space-y-1.5 pt-1">
                  <span className="text-xs text-muted-foreground">Mover para</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: "pendente", label: "Pendente" },
                      { key: "em_analise", label: "Em análise" },
                      { key: "concluido", label: "Concluído" },
                    ] as const).map((s) => (
                      <Button
                        key={s.key}
                        size="sm"
                        variant={selectedRequest.status === s.key ? "default" : "outline"}
                        className="rounded-xl text-xs"
                        disabled={selectedRequest.status === s.key}
                        onClick={async () => {
                          await updateRequestStatus(selectedRequest.id, s.key);
                          setSelectedRequest({ ...selectedRequest, status: s.key });
                        }}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setSelectedRequest(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Visualizador de PDF embutido */}
        <Dialog open={!!viewingPdf} onOpenChange={(open) => !open && closePdf()}>
          <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 overflow-hidden flex flex-col">
            <DialogHeader className="px-4 py-3 border-b">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Paperclip className="h-4 w-4 text-brand-500" /> Anexo do orçamento
              </DialogTitle>
            </DialogHeader>
            {viewingPdf && (
              <iframe src={viewingPdf} title="Anexo PDF" className="flex-1 w-full border-0" />
            )}
            <div className="px-4 py-2 border-t text-center">
              <a href={pdfRawUrl || "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline">
                Não carregou? Abrir em nova aba
              </a>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
