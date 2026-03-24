import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Client } from "@/types/crm";
import { useToast } from "@/hooks/use-toast";

interface NewClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (client: Client) => void;
}

export function NewClientForm({ open, onOpenChange, onSubmit }: NewClientFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    tags: "",
    notes: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Campos obrigatórios", description: "Nome e telefone são obrigatórios.", variant: "destructive" });
      return;
    }
    const newClient: Client = {
      id: `c-${Date.now()}`,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      totalPurchases: 0,
      createdAt: new Date().toISOString(),
      notes: form.notes.trim() || undefined,
    };
    onSubmit(newClient);
    toast({ title: "Cliente cadastrado!", description: `${newClient.name} adicionado com sucesso.` });
    setForm({ name: "", phone: "", email: "", address: "", city: "", tags: "", notes: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Novo Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Nome completo" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(11) 99999-0000" maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@exemplo.com" maxLength={255} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Rua, número, bairro" maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="São Paulo" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>Tags (vírgula)</Label>
              <Input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="residencial, fidelizado" maxLength={200} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Notas sobre o cliente..." maxLength={500} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Cadastrar Cliente</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
