import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { MaskedInput } from "@/components/ui/masked-input";
import { FollowUp } from "@/types/crm";
import { useSellers } from "@/hooks/useSellers";
import { isValidPhone } from "@/lib/masks";
import { useToast } from "@/hooks/use-toast";

interface NewFollowUpFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (followUp: FollowUp) => void;
}

export function NewFollowUpForm({ open, onOpenChange, onSubmit }: NewFollowUpFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    clientName: "", clientPhone: "", description: "",
    type: "whatsapp" as FollowUp["type"], assignedTo: "", time: "10:00",
  });
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.clientName.trim()) e.clientName = "Nome é obrigatório";
    if (!form.clientPhone.trim()) e.clientPhone = "Telefone é obrigatório";
    else if (!isValidPhone(form.clientPhone)) e.clientPhone = "Telefone inválido (10 ou 11 dígitos)";
    if (!date) e.date = "Data é obrigatória";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const [hours, minutes] = form.time.split(":").map(Number);
    const scheduledDate = new Date(date!);
    scheduledDate.setHours(hours, minutes, 0, 0);

    const newFollowUp: FollowUp = {
      id: `f-${Date.now()}`,
      leadId: "",
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      scheduledAt: scheduledDate.toISOString(),
      description: form.description.trim(),
      completed: false,
      assignedTo: form.assignedTo || "1",
      type: form.type,
    };
    onSubmit(newFollowUp);
    toast({ title: "Follow-up agendado!", description: `${newFollowUp.clientName} — ${format(scheduledDate, "dd/MM/yyyy HH:mm")}` });
    setForm({ clientName: "", clientPhone: "", description: "", type: "whatsapp", assignedTo: "", time: "10:00" });
    setDate(undefined);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Novo Follow-up</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome do cliente *</Label>
              <Input value={form.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder="Ex: João Pereira" maxLength={100} />
              {errors.clientName && <p className="text-xs text-destructive">{errors.clientName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <MaskedInput mask="phone" value={form.clientPhone} onValueChange={(_, masked) => update("clientPhone", masked)} placeholder="(11) 99999-0000" />
              {errors.clientPhone && <p className="text-xs text-destructive">{errors.clientPhone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => update("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="visit">Visita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setErrors((p) => ({ ...p, date: "" })); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input type="time" value={form.time} onChange={(e) => update("time", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
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
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="O que precisa ser feito..." maxLength={500} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Agendar Follow-up</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
