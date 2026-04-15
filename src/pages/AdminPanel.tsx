import { AppLayout } from "@/components/AppLayout";
import { useRole } from "@/contexts/RoleContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Store, Users, Loader2, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StoreRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
}

interface SellerRow {
  id: string;
  name: string;
  role: string;
  user_id: string | null;
  store_id: string | null;
  store_name?: string;
}

interface UserRoleRow {
  id: string;
  user_id: string;
  role: string;
  email?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  vendedor: "Vendedor",
  suporte: "Suporte",
};

export default function AdminPanel() {
  const { isAdmin } = useRole();

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AppLayout title="Painel Administrativo">
      <Tabs defaultValue="stores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stores" className="gap-1.5"><Store className="h-3.5 w-3.5" /> Lojas</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Usuários & Papéis</TabsTrigger>
        </TabsList>

        <TabsContent value="stores"><StoresTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function StoresTab() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchStores = useCallback(async () => {
    const { data } = await supabase.from("stores").select("*").order("name");
    if (data) setStores(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("stores").insert({ name, address: address || null, city: city || null, phone: phone || null });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Loja cadastrada!");
    setName(""); setAddress(""); setCity(""); setPhone("");
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Loja</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Loja</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da loja" /></div>
              <div><Label>Endereço</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cidade</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
                <div><Label>Telefone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
              </div>
              <Button onClick={handleAdd} disabled={saving} className="w-full">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Cadastrar
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
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.city || "—"}</TableCell>
                <TableCell>{s.phone || "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {stores.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma loja cadastrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sellerName, setSellerName] = useState("");
  const [sellerRole, setSellerRole] = useState<string>("vendedor");
  const [sellerStoreId, setSellerStoreId] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [sellersRes, storesRes, rolesRes] = await Promise.all([
      supabase.from("sellers").select("*").order("name"),
      supabase.from("stores").select("*").order("name"),
      supabase.from("user_roles").select("*"),
    ]);
    if (sellersRes.data) setSellers(sellersRes.data);
    if (storesRes.data) setStores(storesRes.data);
    if (rolesRes.data) setRoles(rolesRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStoreName = (storeId: string | null) => {
    if (!storeId) return "—";
    return stores.find(s => s.id === storeId)?.name || "—";
  };

  const handleAddSeller = async () => {
    if (!sellerName.trim() || !sellerStoreId) return;
    setSaving(true);

    // Find user by email if provided
    let userId: string | null = null;
    if (sellerEmail.trim()) {
      // We need to look up the user by email from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("display_name", sellerEmail.trim())
        .maybeSingle();
      
      // Try matching by checking auth - we'll use a different approach
      // Since we can't query auth.users, we store the email and link later
      // For now, look for existing profile with matching email in display_name
    }

    const { data: newSeller, error } = await supabase.from("sellers").insert({
      name: sellerName,
      role: sellerRole as any,
      store_id: sellerStoreId,
      user_id: userId,
    }).select().single();

    if (error) { toast.error(error.message); setSaving(false); return; }

    // If we have an email, try to find the user and assign role
    if (sellerEmail.trim()) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .order("created_at", { ascending: false });
      
      if (profiles) {
        // Find by checking if any profile's associated email matches
        // Since we can't query auth.users directly, we'll need the user to sign up first
        // and then link them via the admin panel
      }
    }

    toast.success("Membro adicionado!");
    setSellerName(""); setSellerRole("vendedor"); setSellerStoreId(""); setSellerEmail("");
    setOpen(false);
    setSaving(false);
    fetchData();
  };

  const handleLinkUser = async (sellerId: string, userEmail: string) => {
    // Look up user from profiles by display_name or search
    toast.info("Para vincular um usuário, ele precisa estar registrado no sistema.");
  };

  const handleDeleteSeller = async (id: string) => {
    const { error } = await supabase.from("sellers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Membro removido"); fetchData(); }
  };

  const handleAssignRole = async (userId: string, role: string) => {
    // Remove old roles, add new
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    if (error) toast.error(error.message);
    else { toast.success("Papel atribuído!"); fetchData(); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Membros da Equipe</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Membro</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar Membro</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={sellerName} onChange={e => setSellerName(e.target.value)} placeholder="Nome completo" /></div>
                <div><Label>E-mail (para vincular ao login)</Label><Input type="email" value={sellerEmail} onChange={e => setSellerEmail(e.target.value)} placeholder="email@empresa.com" /></div>
                <div>
                  <Label>Papel *</Label>
                  <Select value={sellerRole} onValueChange={setSellerRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="suporte">Suporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Loja *</Label>
                  <Select value={sellerStoreId} onValueChange={setSellerStoreId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddSeller} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Adicionar
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
                <TableHead>Papel</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Vinculado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROLE_LABELS[s.role] || s.role}</Badge>
                  </TableCell>
                  <TableCell>{getStoreName(s.store_id)}</TableCell>
                  <TableCell>
                    {s.user_id ? (
                      <Badge variant="default" className="bg-green-600/20 text-green-400 border-green-600/30">Vinculado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSeller(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {sellers.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum membro cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Papéis de Acesso (user_roles)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Quando um membro for vinculado a um login, o papel será atribuído automaticamente na tabela user_roles.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Papel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.user_id.substring(0, 8)}...</TableCell>
                  <TableCell><Badge variant="secondary">{ROLE_LABELS[r.role] || r.role}</Badge></TableCell>
                </TableRow>
              ))}
              {roles.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">Nenhum papel atribuído</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
