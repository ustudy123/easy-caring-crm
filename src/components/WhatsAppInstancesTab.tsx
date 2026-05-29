import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Phone, Smartphone, Store as StoreIcon, Trash2, Loader2, Wifi, WifiOff, Terminal, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type InstanceType = "store" | "seller";
type Provider = "uazapi" | "meta_cloud";
type InstanceStatus = "disconnected" | "qr_pending" | "connected" | "error";

interface WhatsAppInstance {
  id: string;
  name: string;
  phone_number: string;
  instance_type: InstanceType;
  store_id: string | null;
  seller_id: string | null;
  provider: Provider;
  status: InstanceStatus;
  qr_code: string | null;
  last_connected_at: string | null;
  api_url?: string | null;
  api_token?: string | null;
  stores?: { name: string } | null;
  sellers?: { name: string } | null;
}

interface Store { id: string; name: string }
interface Seller { id: string; name: string; store_id: string | null }

const STATUS_LABEL: Record<InstanceStatus, string> = {
  disconnected: "Desconectado",
  qr_pending: "Aguardando QR",
  connected: "Conectado",
  error: "Erro",
};

const STATUS_VARIANT: Record<InstanceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  disconnected: "secondary",
  qr_pending: "outline",
  connected: "default",
  error: "destructive",
};

export function WhatsAppInstancesTab() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<InstanceType>("store");
  const [storeId, setStoreId] = useState<string>("");
  const [sellerId, setSellerId] = useState<string>("");
  const [provider, setProvider] = useState<Provider>("uazapi");
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");

  const resetForm = () => {
    setName(""); setPhone(""); setType("store"); setStoreId(""); setSellerId(""); setProvider("uazapi");
    setApiUrl(""); setApiToken("");
  };

  const load = async () => {
    setLoading(true);
    const [instRes, storesRes, sellersRes] = await Promise.all([
      supabase.from("whatsapp_instances").select("*, stores(name), sellers(name)").order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name").order("name"),
      supabase.from("sellers").select("id, name, store_id").order("name"),
    ]);
    if (instRes.error) toast.error("Erro ao carregar números: " + instRes.error.message);
    setInstances((instRes.data as any[]) || []);
    setStores((storesRes.data as any[]) || []);
    setSellers((sellersRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("whatsapp_instances_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_instances" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCreate = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!name.trim() || !cleanPhone) {
      toast.error("Preencha nome e telefone");
      return;
    }
    if (type === "store" && !storeId) {
      toast.error("Selecione a loja");
      return;
    }
    if (type === "seller" && !sellerId) {
      toast.error("Selecione o vendedor");
      return;
    }

    setSaving(true);
    const sellerStoreId = type === "seller" ? sellers.find(s => s.id === sellerId)?.store_id ?? null : null;
    const { error } = await supabase.from("whatsapp_instances").insert({
      name: name.trim(),
      phone_number: cleanPhone,
      instance_type: type,
      store_id: type === "store" ? storeId : sellerStoreId,
      seller_id: type === "seller" ? sellerId : null,
      provider,
      api_url: apiUrl.trim() || null,
      api_token: apiToken.trim() || null,
      status: "disconnected",
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao criar número: " + error.message);
      return;
    }
    toast.success("Número cadastrado. Escaneie o QR Code para conectar.");
    setDialogOpen(false);
    resetForm();
    load();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir o número "${name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("whatsapp_instances").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Número excluído");
    load();
  };

  const checkStatus = async (instanceId?: string) => {
    if (instanceId) setCheckingId(instanceId); else setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-whatsapp-status", {
        body: instanceId ? { instanceId } : {},
      });
      if (error) throw error;
      const results = (data as any)?.results || [];
      const connected = results.filter((r: any) => r.status === "connected").length;
      toast.success(
        instanceId
          ? `Status atualizado: ${results[0]?.status === "connected" ? "Conectado" : "Desconectado"}`
          : `Verificação concluída • ${connected} conectado(s)`
      );
      await load();
    } catch (e: any) {
      toast.error("Erro ao verificar conexão: " + (e?.message || e));
    } finally {
      setChecking(false);
      setCheckingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" /> Números WhatsApp Conectados
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Gerencie múltiplos números: centrais de loja (com triagem) e números diretos de vendedor (sem triagem).
              </p>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-mono bg-muted p-1.5 rounded border max-w-fit">
                <Terminal className="h-3 w-3" />
                <span>Webhook: {window.location.origin.replace('lovable.app', 'supabase.co')}/functions/v1/whatsapp-webhook</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => checkStatus()} disabled={checking}>
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Verificar conexões
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Conectar novo número</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo número WhatsApp</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome de identificação</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Central Tijuca, João Pessoal" />
                  </div>
                  <div>
                    <Label>Número (somente dígitos com DDI)</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5521999991111" />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={type} onValueChange={(v: InstanceType) => setType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="store">Central da loja (com triagem)</SelectItem>
                        <SelectItem value="seller">Vendedor (vai direto, sem triagem)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {type === "store" && (
                    <div>
                      <Label>Loja</Label>
                      <Select value={storeId} onValueChange={setStoreId}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {type === "seller" && (
                    <div>
                      <Label>Vendedor</Label>
                      <Select value={sellerId} onValueChange={setSellerId}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>Provedor</Label>
                    <Select value={provider} onValueChange={(v: Provider) => setProvider(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uazapi">uazapi (Z-API)</SelectItem>
                        <SelectItem value="meta_cloud">Meta Cloud API</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {provider === "uazapi" && (
                    <>
                      <div>
                        <Label>Z-API Instance URL</Label>
                        <Input 
                          value={apiUrl} 
                          onChange={(e) => setApiUrl(e.target.value)} 
                          placeholder="https://api.z-api.io/instances/SUA_ID/token/SEU_TOKEN" 
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Cole a URL completa fornecida pelo Z-API.
                        </p>
                      </div>
                      <div>
                        <Label>Z-API Client Token (Opcional)</Label>
                        <Input 
                          value={apiToken} 
                          onChange={(e) => setApiToken(e.target.value)} 
                          placeholder="Client-Token (opcional)" 
                        />
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreate} disabled={saving}>
                    {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Cadastrar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : instances.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhum número cadastrado. Clique em "Conectar novo número" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vínculo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell className="font-mono text-xs">+{inst.phone_number}</TableCell>
                    <TableCell>
                      {inst.instance_type === "store" ? (
                        <Badge variant="outline" className="gap-1"><StoreIcon className="h-3 w-3" />Loja</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Smartphone className="h-3 w-3" />Vendedor</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {inst.instance_type === "store"
                        ? (inst.stores?.name || "—")
                        : (inst.sellers?.name || "—")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inst.status]} className="gap-1">
                        {inst.status === "connected" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {STATUS_LABEL[inst.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(inst.id, inst.name)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            <strong>Central da loja:</strong> mensagens passam pela triagem (código → cidade → distribuição aleatória entre vendedores da cidade).<br />
            <strong>Vendedor direto:</strong> mensagens vão diretamente para o vendedor vinculado, sem triagem. Se o vendedor estiver inativo, redireciona para o substituto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}