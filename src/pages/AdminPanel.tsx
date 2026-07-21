import { Checkbox } from "@/components/ui/checkbox";
import { WebhookLogsTab } from "@/components/WebhookLogsTab";
import { WhatsAppInstancesTab } from "@/components/WhatsAppInstancesTab";
import { AppLayout } from "@/components/AppLayout";
import { useRole } from "@/contexts/RoleContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
  import { Plus, Store, Users, Loader2, Trash2, ShieldOff, Pencil, Terminal, RefreshCw, Eye, FileText, UserCheck, UserX, AlertCircle, History, Bell, Filter, Search, Download, Database, ChevronDown, ChevronRight, LayoutGrid, BarChart3, Phone, Info, KeyRound } from "lucide-react";
 function CitelIntegrationTab() {
  const [syncing, setSyncing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [phone, setPhone] = useState("");
  const [searchData, setSearchData] = useState<any>(null);
  // Inspeção da API: revela os endpoints/parâmetros reais de cliente do Citel.
  const [inspecting, setInspecting] = useState(false);
  const [apiSpec, setApiSpec] = useState<any>(null);

  const runInspect = async () => {
    setInspecting(true);
    setApiSpec(null);
    try {
      const { data, error } = await supabase.functions.invoke('citel-swagger-dump');
      if (error) throw error;
      setApiSpec(data);
      if (data?.success) toast.success("Documentação da API carregada.");
      else toast.warning(data?.note || "Não foi possível carregar a documentação.");
    } catch (err: any) {
      toast.error("Erro ao inspecionar a API: " + (err.message || "Verifique os logs"));
    } finally {
      setInspecting(false);
    }
  };

  const runSync = async () => {
    if (!confirm("Isso irá importar todos os clientes da Citel para o seu banco de dados. Deseja continuar?")) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('citel-sync-all');
      if (error) throw error;
      if (data.success) {
        toast.success(`Sincronização concluída! ${data.count} clientes importados/atualizados.`);
      } else {
        toast.error(data.message || "Erro na sincronização");
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error("Erro ao sincronizar: " + (err.message || "Verifique os logs"));
    } finally {
      setSyncing(false);
    }
  };

  const runSearch = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.warning("Digite um telefone válido (mín. 10 dígitos).");
      return;
    }
    setSearching(true);
    setSearchData(null);
    try {
      const { data, error } = await supabase.functions.invoke('citel-get-client', { body: { phone: digits } });
      if (error) throw error;
      setSearchData({ ...data, queriedPhone: digits });
      if (data.found) {
        toast.success(`Cliente encontrado: ${data.client?.name || "(sem nome)"}`);
      } else if (data.reason === "erp_unreachable") {
        toast.error("ERP CITEL inacessível. Verifique a conexão.");
      } else {
        toast.warning("Nenhum cliente encontrado com esse telefone.");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error("Erro ao buscar: " + (err.message || "Verifique os logs"));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" /> Integração ERP Citel
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Busque clientes do ERP por telefone ou sincronize a base completa.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={runInspect} disabled={inspecting || syncing || searching}>
                {inspecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Info className="h-4 w-4 mr-2" />}
                Inspecionar API
              </Button>
              <Button variant="outline" onClick={runSync} disabled={syncing || searching}>
                {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Sincronização Total
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiSpec && (
            <Card className="border-brand-500/40 bg-brand-500/5">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" /> Endpoints de cliente da API Citel
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Copie este conteúdo e envie ao suporte técnico para ajustar a busca por código/CPF/CNPJ.
                </p>
              </CardHeader>
              <CardContent>
                <pre className="text-[10px] bg-background/80 border border-border/60 rounded-lg p-2 max-h-72 overflow-auto whitespace-pre-wrap">
{JSON.stringify(
  apiSpec?.analysis?.clientEndpointsWithParams?.length
    ? { workingUrl: apiSpec.workingUrl, clientEndpoints: apiSpec.analysis.clientEndpointsWithParams }
    : apiSpec,
  null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
          <div className="flex items-end gap-3 max-w-2xl">
            <div className="flex-1 space-y-1">
              <Label>Buscar cliente por telefone no ERP</Label>
              <Input
                placeholder="Ex: 21973615596 (somente dígitos ou com DDD)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
              />
            </div>
            <Button onClick={runSearch} disabled={searching || syncing}>
              {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Procurar por telefone
            </Button>
          </div>

          {searchData?.found && searchData.client && (
            <Card className="border-emerald-300 bg-emerald-50/40 animate-in fade-in">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2 text-emerald-800">
                  <Database className="h-4 w-4" /> Cliente encontrado para {searchData.queriedPhone}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><span className="font-semibold">Nome:</span> {searchData.client.name || "—"}</div>
                  <div><span className="font-semibold">ID ERP:</span> <code className="text-xs bg-white px-1.5 py-0.5 rounded border">{searchData.client.erpId || "—"}</code></div>
                  <div><span className="font-semibold">CPF/CNPJ:</span> {searchData.client.cpfCnpj || "—"}</div>
                  <div>
                    <span className="font-semibold">Limite de Crédito:</span>{" "}
                    {searchData.client.creditLimit
                      ? Number(searchData.client.creditLimit).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"}
                  </div>
                  <div><span className="font-semibold">E-mail:</span> {searchData.client.email || "—"}</div>
                  <div><span className="font-semibold">Cidade:</span> {searchData.client.city || "—"}</div>
                  <div><span className="font-semibold">CEP:</span> {searchData.client.zipCode || "—"}</div>
                  <div>
                    <span className="font-semibold">Última compra:</span>{" "}
                    {searchData.client.lastPurchase
                      ? new Date(searchData.client.lastPurchase).toLocaleDateString("pt-BR")
                      : "—"}
                  </div>
                  <div className="md:col-span-2"><span className="font-semibold">Endereço:</span> {searchData.client.address || "—"}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {searchData && !searchData.found && (
            <div className="py-8 text-center border-2 border-dashed rounded-lg bg-muted/20 text-sm text-muted-foreground">
              {searchData.reason === "erp_unreachable"
                ? "ERP inacessível no momento. Tente novamente em alguns segundos."
                : `Nenhum cliente encontrado para o telefone "${searchData.queriedPhone || phone}".`}
            </div>
          )}

          {!searchData && !searching && (
            <div className="py-10 text-center border-2 border-dashed rounded-lg bg-muted/20">
              <Database className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-20" />
              <p className="text-sm text-muted-foreground">Digite um telefone e clique em "Procurar por telefone".</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
 
 import { useState, useEffect, useCallback, useRef, useMemo } from "react";
 import { 
   LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, 
   ResponsiveContainer, Area, AreaChart 
 } from "recharts";
 import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StoreRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  erp_company_code?: string | null;
  is_external_team?: boolean;
  employee_count: number;
}

interface AdminUserRow {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  role: string | null;
  seller_id: string | null;
  seller_name: string | null;
  seller_code: string | null;
  store_id: string | null;
  store_name: string | null;
  is_active: boolean;
  is_available: boolean;
  status: string | null;
  substitute_id: string | null;
  substitute_name: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  vendedor: "Vendedor",
  suporte: "Suporte",
};

 function ReportsTab() {
   const { isAdmin } = useRole();
   const [stats, setStats] = useState({ 
     activeSellers: 0, 
     inactiveSellers: 0, 
     pendingAlerts: 0,
     criticalAlerts: 0
   });
   const [redirections, setRedirections] = useState<any[]>([]);
   const [slaAlerts, setSlaAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [stores, setStores] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  
  // Filters
  const [filterStore, setFilterStore] = useState<string>("all");
  const [filterSeller, setFilterSeller] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
   const [filterDate, setFilterDate] = useState<string>("");
   const [filterDateEnd, setFilterDateEnd] = useState<string>("");
  const [filterClient, setFilterClient] = useState<string>("");
 
   const fetchReports = useCallback(async () => {
     setLoading(true);
     const ONE_HOUR_HALF_MS = 90 * 60 * 1000;
     const now = new Date().getTime();

     const ONE_HOUR_MS = 60 * 60 * 1000;
     const [sellersRes, leadsRes, slaAlertsRes, storesRes, allSellersRes] = await Promise.all([
       supabase.from("sellers").select("id, status"),
       supabase.from("leads").select("id, updated_at, stage"),
       supabase.from("sla_alerts")
         .select("*, vendedor:profiles(display_name), lead:leads(phone)")
         .order("created_at", { ascending: false })
         .limit(100),
       supabase.from("stores").select("id, name").order("name"),
       supabase.from("sellers").select("id, name").order("name")
     ]);

     // Statistics calculation
     if (sellersRes.data) {
       const active = sellersRes.data.filter(s => s.status === 'active').length;
       const inactive = sellersRes.data.filter(s => s.status !== 'active').length;
       setStats(prev => ({ ...prev, activeSellers: active, inactiveSellers: inactive }));
     }

      if (leadsRes.data) {
        // Match Kanban urgency logic: exclude fechamento/pos_venda; idle since updated_at
        const eligible = leadsRes.data.filter((l: any) => l.stage !== 'fechamento' && l.stage !== 'pos_venda');
        const pending = eligible.filter((l: any) => {
          const idle = now - new Date(l.updated_at).getTime();
          return idle >= ONE_HOUR_MS; // warning + critical
        }).length;
        const critical = eligible.filter((l: any) => {
          const idle = now - new Date(l.updated_at).getTime();
          return idle >= ONE_HOUR_HALF_MS;
        }).length;
        setStats(prev => ({ ...prev, pendingAlerts: pending, criticalAlerts: critical }));
      }

     // Fetch redirections with filters
    let query = supabase
      .from("redirection_history")
      .select(`
        *,
        client:clients(name, phone),
        from_seller:sellers!redirection_history_from_seller_id_fkey(name),
        to_seller:sellers!redirection_history_to_seller_id_fkey(name),
        performed_by_profile:profiles!redirection_history_performed_by_fkey(display_name),
        store:stores(name)
      `)
      .order("created_at", { ascending: false });

    if (filterStore !== "all") query = query.eq("store_id", filterStore);
    if (filterSeller !== "all") {
      query = query.or(`from_seller_id.eq.${filterSeller},to_seller_id.eq.${filterSeller}`);
    }
    if (filterType !== "all") query = query.eq("redirection_type", filterType);
     if (filterDate) {
       query = query.gte("created_at", new Date(filterDate).toISOString());
     }
     if (filterDateEnd) {
       const end = new Date(filterDateEnd);
       end.setHours(23, 59, 59, 999);
       query = query.lte("created_at", end.toISOString());
     } else if (filterDate && !filterDateEnd) {
       // If only start date is provided, show that single day
       const date = new Date(filterDate);
       const nextDay = new Date(date);
       nextDay.setDate(date.getDate() + 1);
       query = query.lt("created_at", nextDay.toISOString());
     }

    const { data: redirectionsData } = await query.limit(100);

    // Client filter is handled client-side if it's a search on name/phone
    let finalRedirections = redirectionsData || [];
    if (filterClient) {
      const search = filterClient.toLowerCase();
      finalRedirections = finalRedirections.filter(r => 
        r.client?.name?.toLowerCase().includes(search) || 
        r.client?.phone?.includes(search)
      );
    }
    setRedirections(finalRedirections);
 
    if (slaAlertsRes.data) {
      setSlaAlerts(slaAlertsRes.data);
    }
    if (storesRes.data) setStores(storesRes.data);
    if (allSellersRes.data) setSellers(allSellersRes.data);

     setLoading(false);
   }, [filterStore, filterSeller, filterType, filterDate, filterDateEnd, filterClient]);
 
    useEffect(() => { fetchReports(); }, [fetchReports]);
 
    const chartData = useMemo(() => {
      const groups: Record<string, number> = {};
      const sorted = [...redirections].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      sorted.forEach(r => {
        const date = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        groups[date] = (groups[date] || 0) + 1;
      });
      return Object.entries(groups).map(([date, count]) => ({ date, count }));
    }, [redirections]);
 
   if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
 
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      manual_transfer: "Transf. Manual",
      inactive_seller: "Vendedor Inativo",
      vacation: "Vendedor em Férias",
      no_substitute: "Sem Substituto",
      queue_to_seller: "Fila -> Vendedor"
    };
    return labels[type] || type;
  };

   const exportConversations = async () => {
     if (!filterDate && !filterDateEnd) {
       toast.error("Por favor, selecione um período (Início e Fim) para exportar.");
       return;
     }

     setLoading(true);
     try {
       // 1. Fetch filtered clients first
       let clientQuery = supabase
         .from("clients")
         .select(`
           name, 
           phone, 
           store_id,
           assigned_seller_id,
           assigned_seller:sellers!clients_assigned_seller_id_fkey(name), 
           store:stores!clients_store_id_fkey(name)
         `);
       
       if (filterStore !== "all") clientQuery = clientQuery.eq("store_id", filterStore);
       if (filterSeller !== "all") clientQuery = clientQuery.eq("assigned_seller_id", filterSeller);
       
       const { data: clients, error: cError } = await clientQuery;
       if (cError) throw cError;
       if (!clients || clients.length === 0) {
         toast.info("Nenhum cliente encontrado com os filtros de loja/vendedor.");
         setLoading(false);
         return;
       }

       // Client search filter (manual since it's a partial match)
       let filteredClients = clients;
       if (filterClient) {
         const search = filterClient.toLowerCase();
         filteredClients = clients.filter(c => 
           c.name?.toLowerCase().includes(search) || 
           c.phone.includes(search)
         );
       }

       if (filteredClients.length === 0) {
         toast.info("Nenhum cliente corresponde à busca.");
         setLoading(false);
         return;
       }

       const phoneList = filteredClients.map(c => c.phone);
       const clientsMap = new Map(filteredClients.map(c => [c.phone, c]));

       // 2. Fetch messages for these clients within the date range
       let messageQuery = supabase
         .from("whatsapp_messages")
         .select("*")
         .in("phone", phoneList)
         .order("timestamp", { ascending: true });

       if (filterDate) {
         messageQuery = messageQuery.gte("timestamp", new Date(filterDate).toISOString());
       }
       
       if (filterDateEnd) {
         const end = new Date(filterDateEnd);
         end.setHours(23, 59, 59, 999);
         messageQuery = messageQuery.lte("timestamp", end.toISOString());
       } else if (filterDate) {
         // Single day logic if only start date is provided
         const end = new Date(filterDate);
         end.setHours(23, 59, 59, 999);
         messageQuery = messageQuery.lte("timestamp", end.toISOString());
       }

       const { data: messages, error: mError } = await messageQuery;
       if (mError) throw mError;

       if (!messages || messages.length === 0) {
         toast.info("Nenhuma mensagem encontrada para o período e filtros selecionados.");
         setLoading(false);
         return;
       }

       // 4. Group by phone and sort by client name
       const groupedMessages: Record<string, any[]> = {};
       messages.forEach(m => {
         if (!groupedMessages[m.phone]) groupedMessages[m.phone] = [];
         groupedMessages[m.phone].push(m);
       });
 
       const sortedPhones = Object.keys(groupedMessages).sort((a, b) => {
         const nameA = clientsMap.get(a)?.name || "";
         const nameB = clientsMap.get(b)?.name || "";
         return nameA.localeCompare(nameB);
       });
 
       // 5. Format TXT
       let content = "";
        const startDateStr = filterDate ? new Date(filterDate).toLocaleDateString('pt-BR') : "";
        const endDateStr = filterDateEnd 
          ? new Date(filterDateEnd).toLocaleDateString('pt-BR') 
          : (filterDate ? new Date(filterDate).toLocaleDateString('pt-BR') : "");
 
       sortedPhones.forEach(phone => {
         const msgs = groupedMessages[phone];
         const client = clientsMap.get(phone);
         const clientName = client?.name || "Desconhecido";
         const storeName = client?.store?.name || "Geral";
         const sellerName = client?.assigned_seller?.name || "Não atribuído";
 
         content += `====================================\n`;
         content += `CLIENTE: ${clientName}\n`;
         content += `TELEFONE: ${phone}\n`;
         content += `LOJA: ${storeName}\n`;
         content += `VENDEDOR RESPONSÁVEL: ${sellerName}\n`;
         content += `PERÍODO: ${startDateStr} a ${endDateStr}\n`;
         content += `====================================\n\n`;
 
         msgs.forEach(m => {
           const ts = new Date(m.timestamp).toLocaleString('pt-BR', {
             day: '2-digit', month: '2-digit', year: 'numeric',
             hour: '2-digit', minute: '2-digit'
           });
           const sender = m.is_from_me ? (sellerName !== "Não atribuído" ? sellerName : "Vendedor") : "Cliente";
           content += `[${ts}] ${sender}: ${m.body}\n`;
         });
         content += `\n`;
       });
 
       const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
       const link = document.createElement("a");
       link.href = URL.createObjectURL(blob);
       link.download = `relatorio_conversas_${new Date().toISOString().split('T')[0]}.txt`;
       link.click();
       toast.success("Exportação concluída!");
     } catch (err: any) {
       console.error("Export error:", err);
       toast.error("Erro ao exportar: " + err.message);
     } finally {
       setLoading(false);
     }
   };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vendedores Ativos</p>
                <h3 className="text-2xl font-medium text-green-600">{stats.activeSellers}</h3>
              </div>
              <UserCheck className="h-8 w-8 text-green-100" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vendedores Ausentes</p>
                <h3 className="text-2xl font-medium text-orange-600">{stats.inactiveSellers}</h3>
              </div>
              <UserX className="h-8 w-8 text-orange-100" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alertas Pendentes</p>
                <h3 className="text-2xl font-medium text-red-600">{stats.pendingAlerts}</h3>
              </div>
              <AlertCircle className="h-8 w-8 text-red-100" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Alertas Graves (+1h30)</p>
                <h3 className="text-2xl font-medium text-red-700">{stats.criticalAlerts}</h3>
              </div>
              <AlertCircle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de Redirecionamentos
            </CardTitle>
             <div className="flex flex-wrap items-center gap-2">
               {isAdmin && (
                 <Button variant="outline" size="sm" onClick={exportConversations} disabled={loading}>
                   <Download className="h-4 w-4 mr-2" /> Exportar TXT
                 </Button>
               )}
               <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)} size="sm" className="border rounded-md p-0.5 bg-background">
                 <ToggleGroupItem value="table" aria-label="Tabela" className="h-7 px-2 data-[state=on]:bg-muted">
                   <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                   <span className="text-xs">Tabela</span>
                 </ToggleGroupItem>
                 <ToggleGroupItem value="chart" aria-label="Gráfico" className="h-7 px-2 data-[state=on]:bg-muted">
                   <BarChart3 className="h-3.5 w-3.5 mr-1" />
                   <span className="text-xs">Gráfico</span>
                 </ToggleGroupItem>
               </ToggleGroup>
 
               <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                 setFilterStore("all"); setFilterSeller("all"); setFilterType("all"); setFilterDate(""); setFilterDateEnd(""); setFilterClient("");
               }}>Limpar</Button>
              <Button variant="ghost" size="sm" onClick={fetchReports}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
         <CardContent className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
             <div className="space-y-1">
               <Label className="text-[10px] uppercase text-muted-foreground font-medium">Loja</Label>
              <Select value={filterStore} onValueChange={setFilterStore}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todas as Lojas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Lojas</SelectItem>
                  {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground font-medium">Vendedor</Label>
              <Select value={filterSeller} onValueChange={setFilterSeller}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos os Vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Vendedores</SelectItem>
                  {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground font-medium">Tipo</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos os Tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="manual_transfer">Transf. Manual</SelectItem>
                  <SelectItem value="inactive_seller">Vendedor Inativo</SelectItem>
                  <SelectItem value="vacation">Vendedor em Férias</SelectItem>
                  <SelectItem value="no_substitute">Sem Substituto</SelectItem>
                  <SelectItem value="queue_to_seller">Fila {"->"} Vendedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-1">
               <Label className="text-[10px] uppercase text-muted-foreground font-medium">Início</Label>
               <Input 
                 type="date" 
                 className="h-8 text-xs" 
                 value={filterDate} 
                 onChange={e => setFilterDate(e.target.value)} 
               />
             </div>
             <div className="space-y-1">
               <Label className="text-[10px] uppercase text-muted-foreground font-medium">Fim</Label>
               <Input 
                 type="date" 
                 className="h-8 text-xs" 
                 value={filterDateEnd} 
                 onChange={e => setFilterDateEnd(e.target.value)} 
               />
             </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground font-medium">Cliente</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input 
                  placeholder="Nome ou Tel..." 
                  className="h-8 pl-7 text-xs" 
                  value={filterClient}
                  onChange={e => setFilterClient(e.target.value)}
                />
              </div>
            </div>
          </div>

          {viewMode === "table" ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-xs">Origem</TableHead>
                    <TableHead className="text-xs">Destino</TableHead>
                    <TableHead className="text-xs">Loja</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs max-w-[200px]">Motivo</TableHead>
                    <TableHead className="text-xs">Autor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redirections.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{r.client?.name || 'Desconhecido'}</div>
                        <div className="text-[10px] text-muted-foreground">{r.client?.phone}</div>
                      </TableCell>
                      <TableCell className="text-xs">{r.from_seller?.name || '—'}</TableCell>
                      <TableCell className="text-xs">{r.to_seller?.name || '—'}</TableCell>
                      <TableCell className="text-xs">{r.store?.name || 'Geral'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                          {getTypeLabel(r.redirection_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={r.reason}>
                        {r.reason}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.performed_by_profile?.display_name || (r.redirection_type === 'manual_transfer' ? '—' : 'Sistema')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {redirections.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-xs">Nenhum registro encontrado com esses filtros</TableCell></TableRow>
                  )}
                  {loading && (
                     <TableRow><TableCell colSpan={8} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando...</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="h-[350px] w-full pt-6 bg-muted/5 rounded-lg border p-4">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRedir" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#888' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#888' }}
                    />
                    <RTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorRedir)" 
                      strokeWidth={2}
                      name="Redirecionamentos"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">Dados insuficientes para gerar tendência</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Histórico de Alertas SLA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slaAlerts.map(alert => (
                <TableRow key={alert.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(alert.created_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      alert.alert_level === 'amarelo' ? 'secondary' : 
                      alert.alert_level === 'vermelho' ? 'destructive' : 'outline'
                    } className={
                      alert.alert_level === 'amarelo' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' : 
                      alert.alert_level === 'crítico' ? 'bg-red-600 text-white hover:bg-red-600' : ''
                    }>
                      {alert.alert_level.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize text-xs">{alert.alert_type}</TableCell>
                  <TableCell className="font-medium text-xs">{alert.vendedor?.display_name || '—'}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate" title={alert.message}>
                    {alert.message}
                  </TableCell>
                </TableRow>
              ))}
              {slaAlerts.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">Nenhum alerta de SLA registrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
 }

export default function AdminPanel() {
  const { isAdmin } = useRole();

  if (!isAdmin) return <Navigate to="/" replace />;
  return (
    <AppLayout title="Painel Administrativo">
      <Tabs defaultValue="stores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stores" className="gap-1.5"><Store className="h-3.5 w-3.5" /> Lojas</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Usuários & Papéis</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Relatórios</TabsTrigger>
          <TabsTrigger value="citel" className="gap-1.5"><Database className="h-3.5 w-3.5" /> API Citel</TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5"><Phone className="h-3.5 w-3.5" /> Números WhatsApp</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><Terminal className="h-3.5 w-3.5" /> Webhook Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="stores"><StoresTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
        <TabsContent value="citel"><CitelIntegrationTab /></TabsContent>
        <TabsContent value="whatsapp"><WhatsAppInstancesTab /></TabsContent>
        <TabsContent value="logs"><WebhookLogsTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function StoresTab() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [erpCode, setErpCode] = useState("");
  const [isExternal, setIsExternal] = useState(false);
  
  const [saving, setSaving] = useState(false);

  const fetchStores = useCallback(async () => {
    const { data } = await supabase.from("stores").select("*").order("name");
    if (data) setStores(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const resetForm = () => {
    setEditingId(null);
    setName(""); setAddress(""); setCity(""); setPhone(""); setErpCode(""); setIsExternal(false);
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (s: StoreRow) => {
    setEditingId(s.id);
    setName(s.name);
    setAddress(s.address || "");
    setCity(s.city || "");
    setPhone(s.phone || "");
    setErpCode((s as any).erp_company_code || "");
    setIsExternal(!!(s as any).is_external_team);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name,
      address: address || null,
      city: city || null,
      phone: phone || null,
      erp_company_code: erpCode.trim() || null,
      is_external_team: isExternal,
    };
    const { error } = editingId
      ? await supabase.from("stores").update(payload as any).eq("id", editingId)
      : await supabase.from("stores").insert(payload as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Loja atualizada!" : "Loja cadastrada!");
    resetForm();
    setOpen(false);
    fetchStores();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("stores").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Loja removida"); fetchStores(); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Lojas Cadastradas</CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Loja</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Editar Loja" : "Cadastrar Loja"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da loja" /></div>
              <div><Label>Endereço</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cidade</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
                <div><Label>Telefone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
                <div><Label>Código da empresa (Autcom)</Label><Input value={erpCode} onChange={e => setErpCode(e.target.value)} placeholder="Ex: 001" /></div>
              </div>
              <label className="flex items-start gap-2 rounded-lg border border-border/60 p-2.5 cursor-pointer">
                <Checkbox checked={isExternal} onCheckedChange={(v) => setIsExternal(!!v)} className="mt-0.5" />
                <span className="text-sm">
                  Equipe de Venda Externa
                  <span className="block text-[11px] text-muted-foreground font-normal">Não segue o fluxo de loja (triagem/URA) e não aparece como opção de loja no atendimento.</span>
                </span>
              </label>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {editingId ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="text-center">Funcionários</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  {s.name}
                  {(s as any).is_external_team && (
                    <Badge variant="secondary" className="ml-2 text-[10px] bg-purple-100 text-purple-700">Venda Externa</Badge>
                  )}
                </TableCell>
                <TableCell>{s.city || "—"}</TableCell>
                <TableCell>{s.phone || "—"}</TableCell>
                <TableCell className="text-center tabular-nums">{s.employee_count ?? 0}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Editar">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {stores.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma loja cadastrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [editRole, setEditRole] = useState<string>("vendedor");
  // Múltiplos papéis por usuário. editRole vira o "principal" (mais alto) apenas
  // para as regras de UI que ainda dependem de um único (loja, código...).
  const [editRoles, setEditRoles] = useState<string[]>(["vendedor"]);
  // Redefinição de senha pelo admin.
  const [resetPwUser, setResetPwUser] = useState<AdminUserRow | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetPwSaving, setResetPwSaving] = useState(false);
  const [editStoreId, setEditStoreId] = useState<string>("");
  const [editName, setEditName] = useState<string>("");
  const [editCode, setEditCode] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editIsAvailable, setEditIsAvailable] = useState<boolean>(true);
  const [editStatus, setEditStatus] = useState<string>("active");
  const [editSubstituteId, setEditSubstituteId] = useState<string>("");
  const [editQuizSubjects, setEditQuizSubjects] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [usersRes, storesRes] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.from("stores").select("*").order("name"),
    ]);
    if (usersRes.error) toast.error(usersRes.error.message);
    if (usersRes.data) setUsers(usersRes.data as AdminUserRow[]);
    if (storesRes.data) setStores(storesRes.data);
    // Assuntos do quiz = os 3 tipos de tinta (o admin escolhe 1, 2 ou os 3 por vendedor).
    setAvailableSubjects(["Imobiliária", "Industrial", "Automotiva"]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // O papel "principal" (mais alto) é derivado do conjunto selecionado. As
  // regras de loja/código continuam olhando um único papel, e o mais alto é o
  // que faz sentido (admin dispensa loja; gerente define seller.role, etc.).
  useEffect(() => {
    const primary = editRoles.includes("admin") ? "admin"
      : editRoles.includes("gerente") ? "gerente"
      : editRoles.includes("suporte") ? "suporte"
      : editRoles.includes("vendedor") ? "vendedor"
      : "vendedor";
    setEditRole(primary);
  }, [editRoles]);

  const toggleEditRole = (r: string, on: boolean) => {
    setEditRoles((prev) => {
      if (on) return prev.includes(r) ? prev : [...prev, r];
      const next = prev.filter((x) => x !== r);
      return next.length ? next : prev; // não deixa ficar sem nenhum
    });
  };

  const openEdit = async (u: AdminUserRow) => {
    setEditing(u);
    // Carrega TODOS os papéis atuais do usuário (pode ter mais de um).
    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", u.user_id);
    const current = (roleRows ?? []).map((r: any) => r.role as string);
    const roles = current.length ? current : (u.role ? [u.role] : ["vendedor"]);
    setEditRoles(roles);
    setEditRole(u.role || roles[0] || "vendedor");
    const uStore = stores.find((s) => s.id === u.store_id);
    setEditStoreId(uStore?.is_external_team ? "external" : (u.store_id || ""));
    setEditName(u.seller_name || u.display_name || "");
    setEditCode(u.seller_code || "");
    setEditIsActive(u.is_active ?? true);
    setEditIsAvailable(u.is_available ?? true);
    setEditStatus(u.status || "active");
    setEditSubstituteId(u.substitute_id || "");
    setEditQuizSubjects([]);
    if (u.user_id) {
      const { data } = await supabase.from("sellers").select("quiz_subjects").eq("user_id", u.user_id).maybeSingle();
      setEditQuizSubjects(((data as any)?.quiz_subjects as string[] | null) || []);
    }
  };

  const toggleSubject = (s: string) =>
    setEditQuizSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  // Resolve a loja canônica de "Vendedor Externo": reusa uma equipe de venda
  // externa já existente ou cria uma na primeira vez que for usada.
  const ensureExternalStore = async (): Promise<string | null> => {
    const existing = stores.find((s) => s.is_external_team);
    if (existing) return existing.id;
    const { data, error } = await supabase
      .from("stores")
      .insert({ name: "Vendedor Externo", is_external_team: true } as any)
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Não foi possível criar a equipe de venda externa: " + (error?.message || ""));
      return null;
    }
    return data.id;
  };

  const handleSave = async () => {
    if (!editing) return;
    if (editRole !== "admin" && !editStoreId) {
      toast.error("Selecione uma loja");
      return;
    }
    if (editRoles.includes("vendedor")) {
      const inactive = !editIsActive || editStatus !== "active";
      if (inactive && !editSubstituteId) {
        toast.error("Selecione um vendedor substituto antes de marcar como inativo / em férias / ausente.");
        return;
      }
    }
    setSaving(true);
    let storeIdToSave: string | null = editRole === "admin" ? null : editStoreId;
    if (editRole !== "admin" && editStoreId === "external") {
      storeIdToSave = await ensureExternalStore();
      if (!storeIdToSave) { setSaving(false); return; }
    }
    const { error } = await (supabase as any).rpc("admin_assign_user_roles", {
      _user_id: editing.user_id,
      _roles: editRoles as any,
      _store_id: storeIdToSave,
      _seller_name: editName || null,
      _seller_code: editRoles.includes("vendedor") ? (editCode.trim() || null) : null,
      _is_active: editIsActive,
      _is_available: editIsAvailable,
      _status: editStatus,
      _substitute_id: editSubstituteId && editSubstituteId !== "none" ? editSubstituteId : null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    // Grava os assuntos do quiz do vendedor (separado da RPC).
    if (["vendedor", "gerente", "suporte"].includes(editRole)) {
      const { error: subjErr } = await supabase
        .from("sellers")
        .update({ quiz_subjects: editQuizSubjects.length ? editQuizSubjects : null } as any)
        .eq("user_id", editing.user_id);
      if (subjErr) {
        toast.error(`Função salva, mas os assuntos do quiz não: ${subjErr.message}`);
        setEditing(null);
        fetchData();
        return;
      }
    }
    toast.success("Função atribuída!");
    setEditing(null);
    fetchData();
  };

  const handleResetPassword = async () => {
    if (!resetPwUser || resetPw.length < 6) {
      toast.error("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    setResetPwSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-reset-password", {
      body: { user_id: resetPwUser.user_id, new_password: resetPw },
    });
    setResetPwSaving(false);
    if (error || (data as any)?.error) {
      toast.error("Erro ao redefinir senha: " + (error?.message || (data as any)?.error));
      return;
    }
    toast.success(`Senha redefinida para ${resetPwUser.display_name || resetPwUser.email}.`);
    setResetPwUser(null);
    setResetPw("");
  };

  const handleRevoke = async (userId: string) => {
    const { error } = await supabase.rpc("admin_revoke_user_role", { _user_id: userId });
    if (error) toast.error(error.message);
    else { toast.success("Função removida"); fetchData(); }
  };

  const handleDeleteUser = async (u: AdminUserRow) => {
    const nome = u.seller_name || u.display_name || u.email || "este usuário";
    if (!window.confirm(`Excluir ${nome} permanentemente? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.rpc("admin_delete_user" as any, { _user_id: u.user_id } as any);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else { toast.success("Usuário excluído"); fetchData(); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usuários Cadastrados</CardTitle>
        <p className="text-sm text-muted-foreground">
          Atribua função e loja para cada usuário que se cadastrou no sistema.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Redirecionar para</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead className="w-32">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.user_id}>
                <TableCell className="font-medium">{u.seller_name || u.display_name || "—"}</TableCell>
                <TableCell>
                  <Badge 
                    variant={u.status === 'active' ? "success" : "secondary" as any} 
                    className={
                      u.status === 'active' ? "bg-green-100 text-green-700" : 
                      u.status === 'vacation' ? "bg-orange-100 text-orange-700" : 
                      u.status === 'away' ? "bg-yellow-100 text-yellow-700" : ""
                    }
                  >
                    {u.status === 'active' ? 'Ativo' : 
                     u.status === 'inactive' ? 'Inativo' : 
                     u.status === 'vacation' ? 'Em férias' : 
                     u.status === 'away' ? 'Ausente' : 'Ativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.seller_code ? (
                    <Badge variant="outline" className="font-mono">{u.seller_code}</Badge>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {u.substitute_name ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserCheck className="h-3 w-3" /> {u.substitute_name}
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {u.role ? (
                    <Badge variant="secondary">{ROLE_LABELS[u.role] || u.role}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Sem função</Badge>
                  )}
                </TableCell>
                <TableCell>{u.store_name || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                      Atribuir
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setResetPwUser(u)} title="Redefinir senha">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    {u.role && u.role !== "admin" && (
                      <Button variant="ghost" size="icon" onClick={() => handleRevoke(u.user_id)} title="Revogar">
                        <ShieldOff className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    {u.role !== "admin" && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(u)} title="Excluir usuário">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Atribuir Função</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div>
                  <Label>Usuário</Label>
                  <Input value={editing.email} disabled />
                </div>
                <div>
                  <Label>Nome de exibição</Label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome do vendedor/gerente" />
                </div>
                <div>
                  <Label>Funções * <span className="text-[11px] font-normal text-muted-foreground">(pode marcar mais de uma)</span></Label>
                  <div className="space-y-2 mt-1.5">
                    {[
                      { v: "vendedor", label: "Vendedor" },
                      { v: "gerente", label: "Gerente" },
                      { v: "suporte", label: "Suporte" },
                    ].map((r) => (
                      <label key={r.v} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={editRoles.includes(r.v)}
                          onCheckedChange={(v) => toggleEditRole(r.v, !!v)}
                        />
                        <span className="text-sm">{r.label}</span>
                      </label>
                    ))}
                    {/* Admin não é atribuído livremente; só aparece se já for admin */}
                    {editRoles.includes("admin") && (
                      <label className="flex items-center gap-2">
                        <Checkbox checked disabled />
                        <span className="text-sm">Admin</span>
                      </label>
                    )}
                  </div>
                </div>
                {editRole !== "admin" && (
                  <div>
                    <Label>Loja *</Label>
                    <Select value={editStoreId} onValueChange={setEditStoreId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Lojas</SelectLabel>
                          {stores.filter(s => !s.is_external_team).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectItem value="external">Vendedor Externo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {editRoles.includes("vendedor") && (
                  <div>
                    <Label>Código do Vendedor (Ramal)</Label>
                    <Input
                      value={editCode}
                      onChange={e => setEditCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Ex: 1023"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Quando o cliente digitar este código no WhatsApp, será encaminhado direto para este vendedor.
                    </p>
                  </div>
                )}
                {editRoles.includes("vendedor") && (
                  <div className="flex gap-6 py-2">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="isActive" 
                        checked={editIsActive} 
                        onChange={e => setEditIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-primary"
                      />
                      <Label htmlFor="isActive" className="cursor-pointer">Vendedor Ativo</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="isAvailable" 
                        checked={editIsAvailable} 
                        onChange={e => setEditIsAvailable(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-primary"
                      />
                      <Label htmlFor="isAvailable" className="cursor-pointer">Disponível para Leads</Label>
                    </div>
                  </div>
                )}

                {editRoles.includes("vendedor") && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <Label>Status do Vendedor</Label>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                          <SelectItem value="vacation">Em férias</SelectItem>
                          <SelectItem value="away">Ausente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Substituto Responsável</Label>
                      <Select value={editSubstituteId || "none"} onValueChange={setEditSubstituteId}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum (Volta para fila)</SelectItem>
                          {users
                            .filter(u => u.seller_id && u.user_id !== editing.user_id && u.role === 'vendedor')
                            .map(u => (
                              <SelectItem key={u.seller_id} value={u.seller_id!}>
                                {u.seller_name || u.display_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {["vendedor", "gerente", "suporte"].includes(editRole) && (
                  <div className="pt-1">
                    <Label>Assuntos do Quiz</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Selecione os assuntos que cairão no quiz deste usuário. Deixe tudo desmarcado para incluir <strong>todos</strong> os assuntos.
                    </p>
                    {availableSubjects.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum assunto cadastrado nas perguntas ainda.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableSubjects.map((s) => {
                          const on = editQuizSubjects.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleSubject(s)}
                              className={`px-3 py-1 rounded-full text-sm border capitalize transition-colors ${on ? "bg-brand-500 text-white border-brand-500" : "bg-muted text-muted-foreground border-transparent hover:border-border"}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Redefinir senha (admin) */}
        <Dialog open={!!resetPwUser} onOpenChange={(o) => { if (!o) { setResetPwUser(null); setResetPw(""); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Redefinir senha</DialogTitle>
              <DialogDescription>
                Defina uma nova senha para <strong>{resetPwUser?.display_name || resetPwUser?.email}</strong>.
                Informe a nova senha ao usuário; ele pode trocá-la depois.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                type="text"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                autoComplete="new-password"
              />
              <p className="text-[11px] text-muted-foreground">
                Deixei o campo visível de propósito, para você copiar e repassar a senha.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setResetPwUser(null); setResetPw(""); }}>Cancelar</Button>
              <Button onClick={handleResetPassword} disabled={resetPw.length < 6 || resetPwSaving} className="gap-1.5">
                <KeyRound className="h-4 w-4" /> {resetPwSaving ? "Salvando..." : "Redefinir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
