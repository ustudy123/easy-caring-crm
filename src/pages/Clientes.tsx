import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { mockClients } from "@/data/mockData";
import { Client } from "@/types/crm";
import { NewClientForm } from "@/components/forms/NewClientForm";
import { EditClientForm } from "@/components/forms/EditClientForm";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Phone, Mail, MapPin, DollarSign, Tag, ChevronRight, Users, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function Clientes() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [showNewClient, setShowNewClient] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const addClient = (client: Client) => setClients((prev) => [client, ...prev]);
  const updateClient = (client: Client) => {
    setClients((prev) => prev.map((c) => (c.id === client.id ? client : c)));
    setSelectedClient(null);
  };
  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    setSelectedClient(null);
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppLayout title="Clientes">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, telefone ou tag..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button size="sm" className="bg-primary" onClick={() => setShowNewClient(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Cliente
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de Clientes</p>
                <p className="text-xl font-extrabold">{clients.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kanban-new/10">
                <DollarSign className="h-5 w-5 text-kanban-new" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Volume Total</p>
                <p className="text-xl font-extrabold">R$ {clients.reduce((s, c) => s + c.totalPurchases, 0).toLocaleString("pt-BR")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                <Tag className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fidelizados</p>
                <p className="text-xl font-extrabold">{clients.filter((c) => c.tags.includes("fidelizado")).length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <motion.div key={client.id} variants={item}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setSelectedClient(client)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{client.name}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />{client.phone}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {client.email && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" /> {client.email}
                    </div>
                  )}
                  {client.city && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {client.city}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm font-bold text-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      R$ {client.totalPurchases.toLocaleString("pt-BR")}
                    </div>
                    {client.lastContact && (
                      <span className="text-[10px] text-muted-foreground">
                        Último contato: {new Date(client.lastContact).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {client.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Client detail dialog with edit/delete */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-lg">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {selectedClient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  {selectedClient.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm font-semibold">{selectedClient.phone}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="text-sm font-semibold">{selectedClient.email || "—"}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Cidade</p>
                    <p className="text-sm font-semibold">{selectedClient.city || "—"}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Total Compras</p>
                    <p className="text-sm font-bold text-primary">R$ {selectedClient.totalPurchases.toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                {selectedClient.address && (
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Endereço</p>
                    <p className="text-sm font-semibold">{selectedClient.address}</p>
                  </div>
                )}
                {selectedClient.notes && (
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Observações</p>
                    <p className="text-sm">{selectedClient.notes}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {selectedClient.tags.map((tag) => (
                    <Badge key={tag} className="bg-primary/10 text-primary hover:bg-primary/20">{tag}</Badge>
                  ))}
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      deleteClient(selectedClient.id);
                      toast({ title: "Cliente excluído", description: `${selectedClient.name} foi removido.`, variant: "destructive" });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingClient(selectedClient);
                      setSelectedClient(null);
                    }}
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
