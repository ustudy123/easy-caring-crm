import { useState, useEffect } from "react";
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
import { useUserRole } from "@/hooks/useUserRole";
import { isValidPhone } from "@/lib/masks";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

interface EditFollowUpFormProps {
  followUp: FollowUp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (followUp: FollowUp) => void;
  onDelete: (id: string) => void;
}

export function EditFollowUpForm({ followUp, open, onOpenChange, onSubmit, onDelete }: EditFollowUpFormProps) {
  const { toast } = useToast();
  const sellers = useSellers();
  const { role, sellerId } = useUserRole();
  const isSellerOnly = role === "vendedor";
  const [form, setForm] = useState({
    clientName: "", clientPhone: "", description: "",
    type: "whatsapp" as FollowUp["type"], assignedTo: "", time: "10:00",
  });
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (followUp) {
      const d = new Date(followUp.scheduledAt);
      setForm({
        clientName: followUp.clientName,
        clientPhone: followUp.clientPhone,
        description: followUp.description,
        type: followUp.type,
        assignedTo: followUp.assignedTo,
        time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      });
      setDate(d);
      setErrors({});
    }
  }, [followUp]);

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.clientName.trim()) e.clientName = "Nome é obrigatório";
    if (!form.clientPhone.trim()) e.clientPhone = "Telefone é obrigatório";
    else if (!isValidPhone(form.clientPhone)) e.clientPhone = "Telefone inválido";
    if (!date) e.date = "Data é obrigatória";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUp || !validate()) return;
    const [hours, minutes] = form.time.split(":").map(Number);
    const scheduledDate = new Date(date!);
    scheduledDate.setHours(hours, minutes, 0, 0);

    const updated: FollowUp = {
      ...followUp,
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      scheduledAt: scheduledDate.toISOString(),
      description: form.description.trim(),
      assignedTo: (isSellerOnly && sellerId ? sellerId : form.assignedTo) || "",
      type: form.type,
    };
    onSubmit(updated);
    toast({ title: "Follow-up atualizado!", description: `${updated.clientName} — ${format(scheduledDate, "dd/MM/yyyy HH:mm")}` });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!followUp) return;
    onDelete(followUp.id);
    toast({ title: "Cliente retornou ao kanban", description: "Compromisso excluído" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Editar Follow-up</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome do cliente *</Label>
              <Input value={form.clientName} onChange={(e) => update("clientName", e.target.value)} maxLength={100} />
              {errors.clientName && <p className="text-xs text-destructive">{errors.clientName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <MaskedInput mask="phone" value={form.clientPhone} onValueChange={(_, masked) => update("clientPhone", masked)} />
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
            {!isSellerOnly && (
              <div className="col-span-2 space-y-1.5">
                <Label>Vendedor</Label>
                <Select value={form.assignedTo} onValueChange={(v) => update("assignedTo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {sellers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} maxLength={500} rows={3} />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <ConfirmDeleteDialog
              trigger={<Button type="button" variant="destructive" size="sm">Excluir</Button>}
              onConfirm={handleDelete}
            />
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
