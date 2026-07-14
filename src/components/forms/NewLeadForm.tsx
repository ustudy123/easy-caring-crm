import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaskedInput } from "@/components/ui/masked-input";
import { Lead, KanbanStage, CLIENT_TYPE_EQUIPE_INTERNA } from "@/types/crm";
import { useSellers } from "@/hooks/useSellers";
import { useRole } from "@/contexts/RoleContext";
import { isValidPhone, isValidEmail, normalizePhoneBR } from "@/lib/masks";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Database } from "lucide-react";

interface NewLeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (lead: Lead) => void;
}

export function NewLeadForm({ open, onOpenChange, onSubmit }: NewLeadFormProps) {
  const { toast } = useToast();
  const sellers = useSellers();
  const { isVendedor, sellerId, sellerName } = useRole();
  const [form, setForm] = useState({
     clientName: "", clientPhone: "", clientEmail: "", value: "",
     source: "whatsapp", assignedTo: "", tags: "", notes: "", stage: "abordagem" as KanbanStage,
     clientType: "", companyWorkSite: "", interestProducts: "", storeName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchingErp, setSearchingErp] = useState(false);

  // Vendedor só pode vincular o lead a si mesmo ao cadastrar.
  useEffect(() => {
    if (open && isVendedor && sellerId) {
      setForm((p) => ({ ...p, assignedTo: sellerId }));
    }
  }, [open, isVendedor, sellerId]);

  const buscarNoErp = async () => {
    const phone = form.clientPhone.replace(/\D/g, "");
    if (phone.length < 10) {
      toast({ title: "Telefone incompleto", description: "Preencha o telefone antes de buscar no ERP.", variant: "destructive" });
      return;
    }
    setSearchingErp(true);
    try {
      const { data, error } = await supabase.functions.invoke("citel-get-client", { body: { phone } });
      if (error) throw error;
      if (data?.found && data.client) {
        const c = data.client;
        setForm((p) => ({
          ...p,
          clientName: c.name || p.clientName,
          clientEmail: c.email || p.clientEmail,
          notes: [p.notes, c.cpfCnpj ? `CPF/CNPJ: ${c.cpfCnpj}` : null, c.address ? `Endereço: ${c.address}` : null].filter(Boolean).join("\n"),
        }));
        toast({ title: "Cliente encontrado no ERP!", description: `${c.name} — dados preenchidos.` });
      } else {
        toast({ title: "Não encontrado", description: "Nenhum cliente com esse telefone no ERP." });
      }
    } catch (e: any) {
      toast({ title: "Erro na busca ERP", description: e.message, variant: "destructive" });
    } finally {
      setSearchingErp(false);
    }
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
    if (form.clientEmail && !isValidEmail(form.clientEmail)) e.clientEmail = "E-mail inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const now = new Date().toISOString();
    const newLead: Lead = {
      id: crypto.randomUUID(),
      clientName: form.clientName.trim(),
      clientPhone: normalizePhoneBR(form.clientPhone),
      clientEmail: form.clientEmail.trim() || undefined,
      stage: form.stage,
      value: Number(form.value) || 0,
      assignedTo: isVendedor && sellerId ? sellerId : (form.assignedTo || ""),
      source: form.source,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      notes: form.notes.trim(),
      createdAt: now,
       updatedAt: now,
       clientType: form.clientType,
       companyWorkSite: form.companyWorkSite.trim(),
       interestProducts: form.interestProducts.trim(),
       storeName: form.storeName.trim(),
    };
    onSubmit(newLead);
    toast({ title: "Lead criado!", description: `${newLead.clientName} adicionado ao Kanban.` });
     setForm({ clientName: "", clientPhone: "", clientEmail: "", value: "", source: "whatsapp", assignedTo: "", tags: "", notes: "", stage: "abordagem", clientType: "", companyWorkSite: "", interestProducts: "", storeName: "" });
    setErrors({});
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
              {errors.clientName && <p className="text-xs text-destructive">{errors.clientName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Cliente</Label>
              <Select value={form.clientType} onValueChange={(v) => update("clientType", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pintor">Pintor</SelectItem>
                  <SelectItem value="Arquiteto/Construtor">Arquiteto/Construtor</SelectItem>
                  <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                  <SelectItem value="Empresa/Obra">Empresa/Obra</SelectItem>
                  <SelectItem value={CLIENT_TYPE_EQUIPE_INTERNA}>Equipe Interna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Empresa/Obra (Local)</Label>
              <Input value={form.companyWorkSite} onChange={(e) => update("companyWorkSite", e.target.value)} placeholder="Ex: Edifício Central" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Interesse/Produto/Projeto</Label>
              <Input value={form.interestProducts} onChange={(e) => update("interestProducts", e.target.value)} placeholder="Ex: Resina, Massa, Premium" />
            </div>
            <div className="space-y-1.5">
              <Label>Loja/Região Taeco</Label>
              <Input value={form.storeName} onChange={(e) => update("storeName", e.target.value)} placeholder="Ex: Loja Matriz" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <MaskedInput mask="phone" value={form.clientPhone} onValueChange={(_, masked) => update("clientPhone", masked)} placeholder="(11) 99999-0000" />
              {errors.clientPhone && <p className="text-xs text-destructive">{errors.clientPhone}</p>}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={buscarNoErp}
                disabled={searchingErp}
                className="mt-1.5 h-8 text-xs gap-1.5 rounded-lg border-brand-500/40 text-brand-500 hover:bg-brand-500/10"
              >
                {searchingErp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                Trazer dados do ERP
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.clientEmail} onChange={(e) => update("clientEmail", e.target.value)} placeholder="email@exemplo.com" maxLength={255} />
              {errors.clientEmail && <p className="text-xs text-destructive">{errors.clientEmail}</p>}
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
                   <SelectItem value="site">Site</SelectItem>
                   <SelectItem value="indicacao">Indicação</SelectItem>
                   <SelectItem value="loja">Loja</SelectItem>
                   <SelectItem value="campanha">Campanha</SelectItem>
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
                  <SelectItem value="cross_sell">Cross-sell</SelectItem>
                  <SelectItem value="fechamento">Fechamento</SelectItem>
                  <SelectItem value="pos_venda">Pós-Venda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vendedor</Label>
              {isVendedor ? (
                <>
                  <Input value={sellerName || "Você"} disabled readOnly />
                  <p className="text-[11px] text-muted-foreground">O lead será vinculado a você.</p>
                </>
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
