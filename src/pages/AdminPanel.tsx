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
 import { Plus, Store, Users, Loader2, Trash2, ShieldOff, Pencil, Terminal, RefreshCw, Eye, FileText, UserCheck, UserX, AlertCircle, History, Bell } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  vendedor: "Vendedor",
  suporte: "Suporte",
};

 function ReportsTab() {
   const [stats, setStats] = useState({ activeSellers: 0, inactiveSellers: 0, pendingAlerts: 0 });
   const [transfers, setTransfers] = useState<any[]>([]);
   const [slaAlerts, setSlaAlerts] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchReports = useCallback(async () => {
     setLoading(true);
      const ONE_HOUR_HALF_MS = 90 * 60 * 1000;
      const now = new Date().getTime();
     const [profilesRes, alertsRes, transfersRes, slaAlertsRes] = await Promise.all([
       supabase.from("profiles").select("id, is_active").eq("role", "vendedor"),
       supabase.from("clients").select("id, last_message_from_client_at").neq("alert_status", "none"),
       supabase.from("service_transfers")
         .select("*, client:clients(name), from_seller:profiles!service_transfers_from_seller_id_fkey(display_name), to_seller:profiles!service_transfers_to_seller_id_fkey(display_name)")
         .order("created_at", { ascending: false })
         .limit(20),
       supabase.from("sla_alerts")
         .select("*, vendedor:profiles(display_name), lead:leads(phone)")
         .order("created_at", { ascending: false })
         .limit(50)
     ]);
 
     if (profilesRes.data) {
       const active = profilesRes.data.filter(p => p.is_active).length;
       setStats(prev => ({ ...prev, activeSellers: active, inactiveSellers: profilesRes.data!.length - active }));
     }
     if (alertsRes.data) {
        const longWaitAlerts = alertsRes.data.filter(c => {
          if (!c.last_message_from_client_at) return false;
          return (now - new Date(c.last_message_from_client_at).getTime()) > ONE_HOUR_HALF_MS;
        });
        setStats(prev => ({ ...prev, pendingAlerts: longWaitAlerts.length }));
     }
     if (transfersRes.data) {
       setTransfers(transfersRes.data);
     }
     if (slaAlertsRes.data) {
       setSlaAlerts(slaAlertsRes.data);
     }
     setLoading(false);
   }, []);
 
   useEffect(() => { fetchReports(); }, [fetchReports]);
 
   if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
 
   return (
     <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
       </div>
 
       <Card>
         <CardHeader>
           <CardTitle className="text-base flex items-center gap-2">
             <History className="h-4 w-4" /> Histórico Recente de Redirecionamentos
           </CardTitle>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Data</TableHead>
                 <TableHead>Cliente</TableHead>
                 <TableHead>De</TableHead>
                 <TableHead>Para</TableHead>
                 <TableHead>Motivo</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {transfers.map(t => (
                 <TableRow key={t.id}>
                   <TableCell className="text-xs text-muted-foreground">
                     {new Date(t.created_at).toLocaleString('pt-BR')}
                   </TableCell>
                   <TableCell className="font-medium">{t.client?.name || 'Desconhecido'}</TableCell>
                   <TableCell>{t.from_seller?.display_name || 'Fila Geral'}</TableCell>
                   <TableCell>{t.to_seller?.display_name || 'Fila Geral'}</TableCell>
                   <TableCell className="text-xs">{t.reason}</TableCell>
                 </TableRow>
               ))}
               {transfers.length === 0 && (
                 <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum redirecionamento registrado</TableCell></TableRow>
               )}
             </TableBody>
           </Table>
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
                   <TableCell className="capitalize">{alert.alert_type}</TableCell>
                   <TableCell className="font-medium">{alert.vendedor?.display_name || '—'}</TableCell>
                   <TableCell className="text-xs max-w-xs truncate" title={alert.message}>
                     {alert.message}
                   </TableCell>
                 </TableRow>
               ))}
               {slaAlerts.length === 0 && (
                 <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum alerta de SLA registrado</TableCell></TableRow>
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
    } as any);
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
              <TableHead>Código</TableHead>
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
                  {u.seller_code ? (
                    <Badge variant="outline" className="font-mono">{u.seller_code}</Badge>
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
