import { WebhookLogsTab } from "@/components/WebhookLogsTab";
import { AppLayout } from "@/components/AppLayout";
import { useRole } from "@/contexts/RoleContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Plus, Store, Users, Loader2, Trash2, ShieldOff, Pencil, Terminal, RefreshCw, Eye, FileText, UserCheck, UserX, AlertCircle, History, Bell, Filter, Search, Download } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StoreRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
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
                <h3 className="text-2xl font-bold text-green-600">{stats.activeSellers}</h3>
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
                <h3 className="text-2xl font-bold text-orange-600">{stats.inactiveSellers}</h3>
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
                <h3 className="text-2xl font-bold text-red-600">{stats.pendingAlerts}</h3>
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
                <h3 className="text-2xl font-bold text-red-700">{stats.criticalAlerts}</h3>
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
               <Button variant="outline" size="sm" onClick={() => {
                 setFilterStore("all"); setFilterSeller("all"); setFilterType("all"); setFilterDate(""); setFilterDateEnd(""); setFilterClient("");
               }}>Limpar Filtros</Button>
              <Button variant="ghost" size="sm" onClick={fetchReports}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
         <CardContent className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
             <div className="space-y-1">
               <Label className="text-[10px] uppercase text-muted-foreground font-bold">Loja</Label>
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
              <Label className="text-[10px] uppercase text-muted-foreground font-bold">Vendedor</Label>
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
              <Label className="text-[10px] uppercase text-muted-foreground font-bold">Tipo</Label>
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
               <Label className="text-[10px] uppercase text-muted-foreground font-bold">Início</Label>
               <Input 
                 type="date" 
                 className="h-8 text-xs" 
                 value={filterDate} 
                 onChange={e => setFilterDate(e.target.value)} 
               />
             </div>
             <div className="space-y-1">
               <Label className="text-[10px] uppercase text-muted-foreground font-bold">Fim</Label>
               <Input 
                 type="date" 
                 className="h-8 text-xs" 
                 value={filterDateEnd} 
                 onChange={e => setFilterDateEnd(e.target.value)} 
               />
             </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground font-bold">Cliente</Label>
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

          <div className="rounded-md border">
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
          <TabsTrigger value="logs" className="gap-1.5"><Terminal className="h-3.5 w-3.5" /> Webhook Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="stores"><StoresTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
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
  const [employeeCount, setEmployeeCount] = useState<string>("0");
  const [saving, setSaving] = useState(false);

  const fetchStores = useCallback(async () => {
    const { data } = await supabase.from("stores").select("*").order("name");
    if (data) setStores(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const resetForm = () => {
    setEditingId(null);
    setName(""); setAddress(""); setCity(""); setPhone(""); setEmployeeCount("0");
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
    setEmployeeCount(String(s.employee_count ?? 0));
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
      employee_count: Math.max(0, parseInt(employeeCount, 10) || 0),
    };
    const { error } = editingId
      ? await supabase.from("stores").update(payload).eq("id", editingId)
      : await supabase.from("stores").insert(payload);
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
              </div>
              <div>
                <Label>Quantidade de funcionários</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={employeeCount}
                  onChange={e => setEmployeeCount(e.target.value)}
                  placeholder="0"
                />
              </div>
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
                <TableCell className="font-medium">{s.name}</TableCell>
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
  const [editStoreId, setEditStoreId] = useState<string>("");
  const [editName, setEditName] = useState<string>("");
  const [editCode, setEditCode] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editIsAvailable, setEditIsAvailable] = useState<boolean>(true);
  const [editStatus, setEditStatus] = useState<string>("active");
  const [editSubstituteId, setEditSubstituteId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [usersRes, storesRes] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.from("stores").select("*").order("name"),
    ]);
    if (usersRes.error) toast.error(usersRes.error.message);
    if (usersRes.data) setUsers(usersRes.data as AdminUserRow[]);
    if (storesRes.data) setStores(storesRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEdit = (u: AdminUserRow) => {
    setEditing(u);
    setEditRole(u.role || "vendedor");
    setEditStoreId(u.store_id || "");
    setEditName(u.seller_name || u.display_name || "");
    setEditCode(u.seller_code || "");
    setEditIsActive(u.is_active ?? true);
    setEditIsAvailable(u.is_available ?? true);
    setEditStatus(u.status || "active");
    setEditSubstituteId(u.substitute_id || "");
  };

  const handleSave = async () => {
    if (!editing) return;
    if (editRole !== "admin" && !editStoreId) {
      toast.error("Selecione uma loja");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("admin_assign_user_role", {
      _user_id: editing.user_id,
      _role: editRole as any,
      _store_id: editRole === "admin" ? null : editStoreId,
      _seller_name: editName || null,
      _seller_code: editRole === "vendedor" ? (editCode.trim() || null) : null,
      _is_active: editIsActive,
      _is_available: editIsAvailable,
      _status: editStatus,
      _substitute_id: editSubstituteId && editSubstituteId !== "none" ? editSubstituteId : null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Função atribuída!");
    setEditing(null);
    fetchData();
  };

  const handleRevoke = async (userId: string) => {
    const { error } = await supabase.rpc("admin_revoke_user_role", { _user_id: userId });
    if (error) toast.error(error.message);
    else { toast.success("Função removida"); fetchData(); }
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
              <TableHead>E-mail</TableHead>
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
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>{u.seller_name || u.display_name || "—"}</TableCell>
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
                    {u.role && u.role !== "admin" && (
                      <Button variant="ghost" size="icon" onClick={() => handleRevoke(u.user_id)} title="Revogar">
                        <ShieldOff className="h-4 w-4 text-destructive" />
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
                  <Label>Função *</Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="suporte">Suporte</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editRole !== "admin" && (
                  <div>
                    <Label>Loja *</Label>
                    <Select value={editStoreId} onValueChange={setEditStoreId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {editRole === "vendedor" && (
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
                {editRole === "vendedor" && (
                  <div className="flex gap-6 py-2">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="isActive" 
                        checked={editIsActive} 
                        onChange={e => setEditIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor="isActive" className="cursor-pointer">Vendedor Ativo</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="isAvailable" 
                        checked={editIsAvailable} 
                        onChange={e => setEditIsAvailable(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor="isAvailable" className="cursor-pointer">Disponível para Leads</Label>
                    </div>
                  </div>
                )}

                {editRole === "vendedor" && (
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
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
