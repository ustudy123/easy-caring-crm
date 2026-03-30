import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Campaign } from "@/types/crm";
import { useToast } from "@/hooks/use-toast";

interface NewCampaignFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (campaign: Campaign) => void;
}

export function NewCampaignForm({ open, onOpenChange, onSubmit }: NewCampaignFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    channel: "whatsapp" as Campaign["channel"],
    budget: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    status: "active" as Campaign["status"],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nome é obrigatório";
    if (!form.startDate) e.startDate = "Data de início é obrigatória";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      channel: form.channel,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      budget: Number(form.budget) || 0,
      leadsGenerated: 0,
      conversions: 0,
      status: form.status,
    };
    onSubmit(campaign);
    toast({ title: "Campanha criada!", description: `${campaign.name} adicionada.` });
    setForm({ name: "", channel: "whatsapp", budget: "", startDate: new Date().toISOString().split("T")[0], endDate: "", status: "active" });
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Nova Campanha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome da campanha *</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: Black Friday 2026" maxLength={100} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={(v) => update("channel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="meta">Meta Ads</SelectItem>
                  <SelectItem value="google">Google Ads</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Orçamento (R$)</Label>
              <Input type="number" min="0" value={form.budget} onChange={(e) => update("budget", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Data início *</Label>
              <Input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Data fim (opcional)</Label>
              <Input type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Criar Campanha</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
