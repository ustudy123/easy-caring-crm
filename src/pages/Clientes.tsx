import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Client } from "@/types/crm";
import { NewClientForm } from "@/components/forms/NewClientForm";
import { EditClientForm } from "@/components/forms/EditClientForm";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
  import { Search, Plus, Phone, Mail, MapPin, DollarSign, Tag, ChevronRight, Users, Pencil, Trash2, TrendingUp, RefreshCw, Loader2, Info } from "lucide-react";
 import { getDisplayClientName, isGenericName } from "@/lib/clientUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } } };
const fadeIn = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

function mapClientFromDb(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || undefined,
    address: row.address || undefined,
    city: row.city || undefined,
    tags: row.tags || [],
    totalPurchases: Number(row.total_purchases),
    lastContact: row.last_contact || undefined,
    createdAt: row.created_at,
    notes: row.notes || undefined,
  };
}

export default function Clientes() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
   const [clients, setClients] = useState<Client[]>([]);
   const [isSyncing, setIsSyncing] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

   const fetchClients = async () => {
     const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
     if (data) setClients(data.map(mapClientFromDb));
   };

   useEffect(() => {
     fetchClients();
   }, []);

   const handleSyncAll = async () => {
     setIsSyncing(true);
     try {
       const { data, error } = await supabase.functions.invoke('citel-sync-all');
       if (error) throw error;
       
       if (data.success) {
         toast({
           title: "Sincronização concluída",
           description: `${data.count} clientes foram sincronizados com o ERP Citel.`,
         });
         fetchClients();
       } else {
         toast({
           title: "Falha na sincronização",
           description: data.message || "Não foi possível sincronizar com o ERP.",
           variant: "destructive"
         });
       }
     } catch (error: any) {
       console.error("Sync error:", error);
       toast({
         title: "Erro de conexão",
         description: "Erro ao chamar a função de sincronização: " + (error.message || "Erro desconhecido"),
         variant: "destructive"
       });
     } finally {
       setIsSyncing(false);
     }
   };

  const addClient = async (client: Client) => {
    setClients((prev) => [client, ...prev]);
    await supabase.from("clients").insert({
      id: client.id, name: client.name, phone: client.phone,
      email: client.email || null, address: client.address || null,
      city: client.city || null, tags: client.tags,
      total_purchases: client.totalPurchases, notes: client.notes || null,
    });
  };

  const updateClient = async (client: Client) => {
    setClients((prev) => prev.map((c) => (c.id === client.id ? client : c)));
    setSelectedClient(null);
    await supabase.from("clients").update({
      name: client.name, phone: client.phone, email: client.email || null,
      address: client.address || null, city: client.city || null,
      tags: client.tags, notes: client.notes || null,
    }).eq("id", client.id);
  };

  const deleteClient = async (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    setSelectedClient(null);
    await supabase.from("clients").delete().eq("id", id);
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const totalVolume = clients.reduce((s, c) => s + c.totalPurchases, 0);
  const fidelizados = clients.filter((c) => c.tags.includes("fidelizado")).length;

  const kpis = [
    { label: "Total de Clientes", value: clients.length, icon: Users, gradient: "from-[hsl(224,76%,48%)] to-[hsl(262,60%,55%)]" },
    { label: "Volume Total", value: `R$ ${totalVolume.toLocaleString("pt-BR")}`, icon: DollarSign, gradient: "from-[hsl(152,60%,42%)] to-[hsl(174,62%,38%)]" },
    { label: "Fidelizados", value: fidelizados, icon: TrendingUp, gradient: "from-[hsl(338,76%,52%)] to-[hsl(28,86%,52%)]" },
  ];

  return (
    <AppLayout title="Clientes">
      <div className="space-y-5">
        {/* Header */}
         <motion.div variants={fadeIn} initial="hidden" animate="show" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
           <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1 w-full sm:w-auto">
             <div className="relative w-full sm:max-w-sm">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input placeholder="Buscar por nome, telefone ou tag..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/80 backdrop-blur-sm border-border/60 focus:border-primary/40" />
             </div>
             <Button 
               size="sm" 
               variant="outline"
               className="w-full sm:w-auto border-primary/20 hover:bg-primary/5 text-primary"
               onClick={handleSyncAll}
               disabled={isSyncing}
             >
               {isSyncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
               Sincronizar ERP
             </Button>
           </div>
           <Button size="sm" className="w-full sm:w-auto bg-brand-500 hover:opacity-90 text-primary-foreground shadow-none" onClick={() => setShowNewClient(true)}>
             <Plus className="h-3.5 w-3.5 mr-1" /> Novo Cliente
           </Button>
         </motion.div>

        {/* KPI Cards */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <motion.div key={kpi.label} variants={item}>
              <Card className="relative overflow-hidden border-black/8 bg-white hover:shadow-none transition-all duration-300 group">
                <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradient} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity`} />
                <CardContent className="flex items-center gap-4 p-5 relative">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br ${kpi.gradient} shadow-none`}>
                    <kpi.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground tracking-wide">{kpi.label}</p>
                    <p className="text-2xl font-medium text-foreground">{kpi.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Client Cards */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <motion.div key={client.id} variants={item}>
              <Card
                className="relative overflow-hidden border-black/8 bg-white hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                onClick={() => setSelectedClient(client)}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-500 to-brand-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-5 pl-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const displayName = getDisplayClientName(client);
                        const isGeneric = isGenericName(client.name);
                        return (
                          <>
                            <div className={`flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br ${isGeneric ? 'from-muted-foreground/20 to-muted-foreground/40 text-muted-foreground' : 'from-brand-500 to-brand-400 text-primary-foreground'} text-sm font-bold shadow-none`}>
                              {displayName.split(" ").filter(n => !n.includes('(')).map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className={`font-bold leading-tight ${isGeneric ? 'text-foreground/70 italic' : 'text-foreground'}`}>
                                {displayName}
                              </p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                <Phone className="h-3 w-3" />{client.phone}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {client.email && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.city && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" /> {client.city}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/40">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <DollarSign className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                      R$ {client.totalPurchases.toLocaleString("pt-BR")}
                    </div>
                    {client.lastContact && (
                      <span className="text-[10px] text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full">
                        {new Date(client.lastContact).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>

                  {client.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {client.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5 bg-primary/8 text-primary border-primary/15 hover:bg-primary/15 font-medium">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <motion.div variants={fadeIn} className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/30 mb-4">
                <Users className="h-10 w-10 opacity-20" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Nenhum cliente encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-[250px] text-center">
                {search 
                  ? `Não encontramos resultados para "${search}". Tente outro termo.`
                  : "Sua base de clientes está vazia no momento."}
              </p>
              {!search && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-6 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                  onClick={() => setShowNewClient(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar primeiro cliente
                </Button>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-lg mx-3 sm:mx-auto max-h-[90vh] overflow-y-auto border-border/40 bg-card/95 backdrop-blur-xl">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-gradient-to-br from-brand-500 to-brand-400 text-base font-bold text-primary-foreground shadow-none">
                    {selectedClient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <span className="text-foreground">{selectedClient.name}</span>
                    <p className="text-xs font-normal text-muted-foreground mt-0.5">
                      Cliente desde {new Date(selectedClient.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Telefone", value: selectedClient.phone, icon: Phone },
                    { label: "E-mail", value: selectedClient.email || "—", icon: Mail },
                    { label: "Cidade", value: selectedClient.city || "—", icon: MapPin },
                    { label: "Total Compras", value: `R$ ${selectedClient.totalPurchases.toLocaleString("pt-BR")}`, icon: DollarSign, highlight: true },
                  ].map((field) => (
                    <div key={field.label} className="rounded-[14px] bg-muted/50 border border-border/30 p-3.5 group hover:border-primary/20 transition-colors">
                      <div className="flex items-center gap-1.5 mb-1">
                        <field.icon className="h-3 w-3 text-muted-foreground" />
                        <p className="text-[10px] tracking-wider text-muted-foreground font-medium">{field.label}</p>
                      </div>
                      <p className={`text-sm font-semibold ${field.highlight ? "text-primary" : "text-foreground"}`}>{field.value}</p>
                    </div>
                  ))}
                </div>
                {selectedClient.address && (
                  <div className="rounded-[14px] bg-muted/50 border border-border/30 p-3.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[10px] tracking-wider text-muted-foreground font-medium">Endereço</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{selectedClient.address}</p>
                  </div>
                )}
                {selectedClient.notes && (
                  <div className="rounded-[14px] bg-muted/50 border border-border/30 p-3.5">
                    <p className="text-[10px] tracking-wider text-muted-foreground font-medium mb-1">Observações</p>
                    <p className="text-sm text-foreground">{selectedClient.notes}</p>
                  </div>
                )}
                {selectedClient.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedClient.tags.map((tag) => (
                      <Badge key={tag} className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">{tag}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-border/40">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="shadow-sm"
                    onClick={() => {
                      deleteClient(selectedClient.id);
                      toast({ title: "Cliente excluído", description: `${selectedClient.name} foi removido.`, variant: "destructive" });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                  <Button
                    size="sm"
                    className="bg-brand-500 hover:opacity-90 shadow-sm"
                    onClick={() => { setEditingClient(selectedClient); setSelectedClient(null); }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <NewClientForm open={showNewClient} onOpenChange={setShowNewClient} onSubmit={addClient} />
      <EditClientForm client={editingClient} open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)} onSubmit={updateClient} onDelete={deleteClient} />
    </AppLayout>
  );
}
