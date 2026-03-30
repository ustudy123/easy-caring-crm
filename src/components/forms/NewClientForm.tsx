import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MaskedInput } from "@/components/ui/masked-input";
import { Client } from "@/types/crm";
import { isValidPhone, isValidEmail } from "@/lib/masks";
import { useToast } from "@/hooks/use-toast";

interface NewClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (client: Client) => void;
}

export function NewClientForm({ open, onOpenChange, onSubmit }: NewClientFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", city: "", tags: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nome é obrigatório";
    if (!form.phone.trim()) e.phone = "Telefone é obrigatório";
    else if (!isValidPhone(form.phone)) e.phone = "Telefone inválido (10 ou 11 dígitos)";
    if (form.email && !isValidEmail(form.email)) e.email = "E-mail inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const newClient: Client = {
      id: crypto.randomUUID(),
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
    setErrors({});
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
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <MaskedInput mask="phone" value={form.phone} onValueChange={(_, masked) => update("phone", masked)} placeholder="(11) 99999-0000" />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@exemplo.com" maxLength={255} />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
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
