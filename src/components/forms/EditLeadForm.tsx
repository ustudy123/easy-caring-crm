import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaskedInput } from "@/components/ui/masked-input";
import { Lead, KanbanStage, CLIENT_TYPES, LEAD_SOURCES } from "@/types/crm";
import { useSellers } from "@/hooks/useSellers";
import { useRole } from "@/contexts/RoleContext";
import { isValidPhone, isValidEmail, normalizePhoneBR } from "@/lib/masks";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

// Valor guardado em reais (ex.: "1234.56"); exibido em pt-BR (R$ 1.234,56).
// Enquanto digita, tratamos os dígitos como centavos: "12345" -> 123,45.
function onlyDigitsToValue(masked: string): string {
  const digits = masked.replace(/\D/g, "");
  if (!digits) return "";
  return (parseInt(digits, 10) / 100).toFixed(2);
}
function formatBRL(value: string): string {
  const n = Number(value);
  if (!isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface EditLeadFormProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (lead: Lead) => void;
  onDelete: (id: string) => void;
}

export function EditLeadForm({ lead, open, onOpenChange, onSubmit, onDelete }: EditLeadFormProps) {
  const { toast } = useToast();
  const sellers = useSellers();
  const { isVendedor, sellerId, sellerName } = useRole();
  const [form, setForm] = useState({
     clientName: "", clientPhone: "", clientEmail: "", value: "",
     source: "whatsapp", assignedTo: "", tags: "", notes: "", stage: "abordagem" as KanbanStage,
     clientType: "", companyWorkSite: "", interestProducts: "", storeName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lead) {
      setForm({
        clientName: lead.clientName,
        clientPhone: lead.clientPhone,
        clientEmail: lead.clientEmail || "",
        value: String(lead.value || ""),
        source: lead.source,
        assignedTo: lead.assignedTo,
        tags: lead.tags.join(", "),
         notes: lead.notes,
         stage: lead.stage,
         clientType: lead.clientType || "",
         companyWorkSite: lead.companyWorkSite || "",
         interestProducts: lead.interestProducts || "",
         storeName: lead.storeName || "",
      });
      setErrors({});
    }
  }, [lead]);

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.clientName.trim()) e.clientName = "Nome é obrigatório";
    if (!form.clientPhone.trim()) e.clientPhone = "Telefone é obrigatório";
    else if (!isValidPhone(form.clientPhone)) e.clientPhone = "Telefone inválido";
    if (form.clientEmail && !isValidEmail(form.clientEmail)) e.clientEmail = "E-mail inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !validate()) return;
    const updatedLead: Lead = {
      ...lead,
      clientName: form.clientName.trim(),
      clientPhone: normalizePhoneBR(form.clientPhone),
      clientEmail: form.clientEmail.trim() || undefined,
      stage: form.stage,
      value: Number(form.value) || 0,
      assignedTo: form.assignedTo || "",
      source: form.source,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
       notes: form.notes.trim(),
       updatedAt: new Date().toISOString(),
       clientType: form.clientType,
       companyWorkSite: form.companyWorkSite.trim(),
       interestProducts: form.interestProducts.trim(),
       storeName: form.storeName.trim(),
    };
    onSubmit(updatedLead);
    toast({ title: "Lead atualizado!", description: `${updatedLead.clientName} foi atualizado.` });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!lead) return;
    onDelete(lead.id);
    toast({ title: "Lead excluído", description: `${lead.clientName} foi removido.`, variant: "destructive" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Editar Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome do cliente *</Label>
              <Input value={form.clientName} onChange={(e) => update("clientName", e.target.value)} maxLength={100} />
              {errors.clientName && <p className="text-xs text-destructive">{errors.clientName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Cliente</Label>
              <Select value={form.clientType} onValueChange={(v) => update("clientType", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Empresa/Obra (Local)</Label>
              <Input value={form.companyWorkSite} onChange={(e) => update("companyWorkSite", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Interesse/Produto/Projeto</Label>
              <Input value={form.interestProducts} onChange={(e) => update("interestProducts", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <MaskedInput mask="phone" value={form.clientPhone} onValueChange={(_, masked) => update("clientPhone", masked)} />
              {errors.clientPhone && <p className="text-xs text-destructive">{errors.clientPhone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.clientEmail} onChange={(e) => update("clientEmail", e.target.value)} maxLength={255} />
              {errors.clientEmail && <p className="text-xs text-destructive">{errors.clientEmail}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Valor estimado (R$)</Label>
              <Input
                inputMode="numeric"
                value={form.value ? formatBRL(form.value) : ""}
                onChange={(e) => update("value", onlyDigitsToValue(e.target.value))}
                placeholder="R$ 0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={form.source} onValueChange={(v) => update("source", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                   {LEAD_SOURCES.map((s) => (
                     <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                   ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={form.stage} onValueChange={(v) => update("stage", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="abordagem">Abordagem</SelectItem>
                  <SelectItem value="sondagem">Sondagem</SelectItem>
                  <SelectItem value="recomendacao_tecnica">Recomendação</SelectItem>
                  <SelectItem value="demonstracao_valor">Demonstração</SelectItem>
                  <SelectItem value="contorno_objecoes">Objeções</SelectItem>
                  <SelectItem value="cross_sell">Venda Adicional</SelectItem>
                  <SelectItem value="fechamento">Fechamento</SelectItem>
                  <SelectItem value="pos_venda">Pós-Venda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vendedor</Label>
              {isVendedor ? (
                <Input
                  value={
                    form.assignedTo
                      ? (sellers.find((s) => s.id === form.assignedTo)?.name
                          || (form.assignedTo === sellerId ? (sellerName || "Você") : "Vendedor"))
                      : "Não atribuído"
                  }
                  disabled
                  readOnly
                />
              ) : (
                <Select value={form.assignedTo} onValueChange={(v) => update("assignedTo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {sellers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isVendedor && <p className="text-[11px] text-muted-foreground">Só um gerente/admin pode alterar o vendedor.</p>}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Palavras-chave (separadas por vírgula)</Label>
              <Input value={form.tags} onChange={(e) => update("tags", e.target.value)} maxLength={200} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} maxLength={500} rows={3} />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <ConfirmDeleteDialog
              trigger={<Button type="button" variant="destructive" size="sm">Excluir Lead</Button>}
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
