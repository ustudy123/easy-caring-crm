import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lead, KanbanStage } from "@/types/crm";
import { mockSellers } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";

interface NewLeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (lead: Lead) => void;
}

export function NewLeadForm({ open, onOpenChange, onSubmit }: NewLeadFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    value: "",
    source: "whatsapp",
    assignedTo: "",
    tags: "",
    notes: "",
    stage: "novo_lead" as KanbanStage,
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim() || !form.clientPhone.trim()) {
      toast({ title: "Campos obrigatórios", description: "Nome e telefone são obrigatórios.", variant: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    const newLead: Lead = {
      id: `l-${Date.now()}`,
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      clientEmail: form.clientEmail.trim() || undefined,
      stage: form.stage,
      value: Number(form.value) || 0,
      assignedTo: form.assignedTo || "1",
      source: form.source,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      notes: form.notes.trim(),
      createdAt: now,
      updatedAt: now,
    };
    onSubmit(newLead);
    toast({ title: "Lead criado!", description: `${newLead.clientName} adicionado ao Kanban.` });
    setForm({ clientName: "", clientPhone: "", clientEmail: "", value: "", source: "whatsapp", assignedTo: "", tags: "", notes: "", stage: "novo_lead" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome do cliente *</Label>
              <Input value={form.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder="Ex: João Pereira" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input value={form.clientPhone} onChange={(e) => update("clientPhone", e.target.value)} placeholder="(11) 99999-0000" maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.clientEmail} onChange={(e) => update("clientEmail", e.target.value)} placeholder="email@exemplo.com" maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor estimado (R$)</Label>
              <Input type="number" min="0" value={form.value} onChange={(e) => update("value", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={form.source} onValueChange={(v) => update("source", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="meta">Meta Ads</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={form.stage} onValueChange={(v) => update("stage", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo_lead">Novo Lead</SelectItem>
                  <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                  <SelectItem value="orcamento_enviado">Orçamento Enviado</SelectItem>
                  <SelectItem value="negociacao">Negociação</SelectItem>
                  <SelectItem value="fechado">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vendedor</Label>
              <Select value={form.assignedTo} onValueChange={(v) => update("assignedTo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {mockSellers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="residencial, apartamento" maxLength={200} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Detalhes sobre o lead..." maxLength={500} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Criar Lead</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
