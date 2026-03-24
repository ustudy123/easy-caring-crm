import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MaskedInput } from "@/components/ui/masked-input";
import { Client } from "@/types/crm";
import { isValidPhone, isValidEmail } from "@/lib/masks";
import { useToast } from "@/hooks/use-toast";

interface EditClientFormProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (client: Client) => void;
  onDelete: (id: string) => void;
}

export function EditClientForm({ client, open, onOpenChange, onSubmit, onDelete }: EditClientFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", city: "", tags: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        phone: client.phone,
        email: client.email || "",
        address: client.address || "",
        city: client.city || "",
        tags: client.tags.join(", "),
        notes: client.notes || "",
      });
      setErrors({});
    }
  }, [client]);

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nome é obrigatório";
    if (!form.phone.trim()) e.phone = "Telefone é obrigatório";
    else if (!isValidPhone(form.phone)) e.phone = "Telefone inválido";
    if (form.email && !isValidEmail(form.email)) e.email = "E-mail inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !validate()) return;
    const updated: Client = {
      ...client,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      notes: form.notes.trim() || undefined,
    };
    onSubmit(updated);
    toast({ title: "Cliente atualizado!", description: `${updated.name} foi atualizado.` });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!client) return;
    onDelete(client.id);
    toast({ title: "Cliente excluído", description: `${client.name} foi removido.`, variant: "destructive" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Editar Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={100} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <MaskedInput mask="phone" value={form.phone} onValueChange={(_, masked) => update("phone", masked)} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} maxLength={255} />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>Tags (vírgula)</Label>
              <Input value={form.tags} onChange={(e) => update("tags", e.target.value)} maxLength={200} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} maxLength={500} rows={3} />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>Excluir Cliente</Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
