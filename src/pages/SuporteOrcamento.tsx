import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCrm } from "@/contexts/CrmContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, DollarSign, AlertTriangle, Clock, CheckCircle, Send, Search, Filter } from "lucide-react";
import { Lead, KANBAN_STAGES } from "@/types/crm";
import { toast } from "sonner";

type RequestType = "orcamento" | "precificacao_especial";

interface SupportRequest {
  id: string;
  leadId: string;
  clientName: string;
  type: RequestType;
  description: string;
  status: "pendente" | "em_analise" | "concluido";
  createdAt: string;
}

export default function SuporteOrcamento() {
  const { leads, updateLead } = useCrm();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("orcamento");
  const [description, setDescription] = useState("");

  // Leads that are in relevant stages
  const relevantLeads = leads.filter(
    (l) => ["em_atendimento", "precificacao_especial", "orcamento_enviado", "negociacao"].includes(l.stage)
  );

  const filteredRequests = requests.filter((r) => {
    if (search && !r.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    return true;
  });

  const handleSubmit = () => {
    if (!selectedLeadId) {
      toast.error("Selecione um lead");
      return;
    }
    const lead = leads.find((l) => l.id === selectedLeadId);
    if (!lead) return;

    const newRequest: SupportRequest = {
      id: crypto.randomUUID(),
      leadId: lead.id,
      clientName: lead.clientName,
      type: requestType,
      description,
      status: "pendente",
      createdAt: new Date().toISOString(),
    };

    setRequests((prev) => [newRequest, ...prev]);

    // If special pricing, move lead to precificacao_especial stage
    if (requestType === "precificacao_especial" && lead.stage !== "precificacao_especial") {
      updateLead({ ...lead, stage: "precificacao_especial" });
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
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    toast.success("Status atualizado!");
  };

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
              className="border-kanban-pricing text-kanban-pricing hover:bg-kanban-pricing/10"
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

        {/* Requests list */}
        <div className="space-y-3">
          {filteredRequests.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhuma solicitação encontrada</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Use os botões acima para criar uma nova solicitação.
                </p>
              </CardContent>
            </Card>
          )}
          {filteredRequests.map((req) => {
            const cfg = statusConfig[req.status];
            return (
              <Card key={req.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground">{req.clientName}</span>
                        <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {req.type === "orcamento" ? "Orçamento" : "Prec. Especial"}
                        </Badge>
                      </div>
                      {req.description && (
                        <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-2">
                        {new Date(req.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {req.status === "pendente" && (
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => updateRequestStatus(req.id, "em_analise")}>
                          Analisar
                        </Button>
                      )}
                      {req.status === "em_analise" && (
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => updateRequestStatus(req.id, "concluido")}>
                          Concluir
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
