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
import { CalendarIcon, Search, Loader2 } from "lucide-react";
import { MaskedInput } from "@/components/ui/masked-input";
import { FollowUp } from "@/types/crm";
import { useSellers } from "@/hooks/useSellers";
import { useUserRole } from "@/hooks/useUserRole";
import { isValidPhone, maskPhone } from "@/lib/masks";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface NewFollowUpFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (followUp: FollowUp) => void;
}

export function NewFollowUpForm({ open, onOpenChange, onSubmit }: NewFollowUpFormProps) {
  const { toast } = useToast();
  const sellers = useSellers();
  const { role, sellerId } = useUserRole();
  const isSellerOnly = role === "vendedor";
  const [form, setForm] = useState({
    clientName: "", clientPhone: "", description: "",
    type: "whatsapp" as FollowUp["type"], assignedTo: isSellerOnly && sellerId ? sellerId : "", time: "10:00",
  });
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [erpResults, setErpResults] = useState<any[]>([]);
  const [erpSearching, setErpSearching] = useState(false);

  const handleErpSearch = async () => {
    const q = form.clientName.trim();
    if (q.length < 2) { toast({ title: "Digite um nome para buscar no ERP", variant: "destructive" }); return; }
    setErpSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("citel-search-name", { body: { name: q } });
      if (error) throw error;
      const results = (data?.results as any[]) || [];
      setErpResults(results);
      if (!results.length) toast({ title: "Nenhum cliente encontrado no ERP", description: q });
    } catch (e: any) {
      toast({ title: "Erro ao buscar no ERP", description: e.message || String(e), variant: "destructive" });
    } finally {
      setErpSearching(false);
    }
  };

  const pickErp = (r: any) => {
    let digits = String(r.phone || "").replace(/\D/g, "");
    if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
    setForm((p) => ({
      ...p,
      clientName: r.name || p.clientName,
      clientPhone: digits ? maskPhone(digits) : p.clientPhone,
    }));
    setErrors((p) => ({ ...p, clientName: "", clientPhone: "" }));
    setErpResults([]);
  };

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
      id: crypto.randomUUID(),
      leadId: "",
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      scheduledAt: scheduledDate.toISOString(),
      description: form.description.trim(),
      completed: false,
      assignedTo: form.assignedTo || "",
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
              <div className="flex gap-2">
                <Input
                  value={form.clientName}
                  onChange={(e) => update("clientName", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleErpSearch(); } }}
                  placeholder="Ex: João Pereira"
                  maxLength={100}
                />
                <Button type="button" variant="outline" className="shrink-0 gap-1" onClick={handleErpSearch} disabled={erpSearching}>
                  {erpSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  ERP
                </Button>
              </div>
              {erpResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-44 overflow-y-auto bg-card">
                  {erpResults.map((r, i) => (
                    <button
                      key={r.erpId || r.document || i}
                      type="button"
                      onClick={() => pickErp(r)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {[r.phone, r.city, r.document].filter(Boolean).join(" · ") || "sem telefone cadastrado"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
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
