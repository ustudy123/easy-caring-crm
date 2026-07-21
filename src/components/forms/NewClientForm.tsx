import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MaskedInput } from "@/components/ui/masked-input";
import { Client } from "@/types/crm";
import { useRole } from "@/contexts/RoleContext";
import { useSellers } from "@/hooks/useSellers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isValidPhone, isValidEmail, normalizePhoneBR } from "@/lib/masks";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";

interface NewClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (client: Client) => void;
}

export function NewClientForm({ open, onOpenChange, onSubmit }: NewClientFormProps) {
  const { isVendedor, sellerId, sellerName } = useRole();
  const sellers = useSellers();
  // Vendedor cadastra o cliente já vinculado a si; admin/gerente escolhem.
  const [assignedSellerId, setAssignedSellerId] = useState<string>("none");
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", city: "", tags: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSearching, setIsSearching] = useState(false);

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  const handleSearchErp = async () => {
    if (!isValidPhone(form.phone)) {
      setErrors((p) => ({ ...p, phone: "Telefone inválido (10 ou 11 dígitos)" }));
      toast({
        title: "Telefone inválido",
        description: "Informe um telefone válido antes de buscar no ERP.",
        variant: "destructive",
      });
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("citel-get-client", {
        body: { phone: form.phone },
      });
      if (error) throw error;
       if (data?.found && data.client) {
         setForm((p) => ({
           ...p,
           name: p.name || data.client.name || "",
           email: p.email || data.client.email || "",
           address: p.address || data.client.address || "",
           city: p.city || data.client.city || "",
         }));
         
         const strategyLabels: Record<string, string> = {
           cache: "Encontrado localmente (cache)",
           endpoint: "Encontrado via endpoint direto",
           scan: `Encontrado via varredura (página ${data.page})`,
         };

         toast({
           title: "Cliente encontrado no ERP",
           description: strategyLabels[data.strategy] || "Dados preenchidos automaticamente.",
         });
       } else if (data?.reason === "erp_unreachable") {
         toast({
           title: "ERP Indisponível",
           description: "Não foi possível conectar ao CITEL no momento.",
           variant: "destructive",
         });
       } else {
         toast({
           title: "Cliente não encontrado",
           description: "Nenhum registro no ERP para este telefone após varredura profunda.",
         });
       }
    } catch (err) {
      console.error("[NewClientForm] ERP lookup failed", err);
      toast({
        title: "Erro ao consultar ERP",
        description: "Não foi possível buscar no CITEL. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
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
      phone: normalizePhoneBR(form.phone),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      totalPurchases: 0,
      createdAt: new Date().toISOString(),
      notes: form.notes.trim() || undefined,
      // Vendedor sempre vincula a si; admin/gerente usam o escolhido.
      assignedSellerId: isVendedor && sellerId
        ? sellerId
        : (assignedSellerId === "none" ? null : assignedSellerId),
    };
    onSubmit(newClient);
    toast({ title: "Cliente cadastrado!", description: `${newClient.name} adicionado com sucesso.` });
    setForm({ name: "", phone: "", email: "", address: "", city: "", tags: "", notes: "" });
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-3 border-b border-border/50">
          <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">Novo Cliente</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Cadastre um novo cliente na sua base. Use o botão de busca para preencher via ERP.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-4 space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="client-name" className="text-xs font-semibold">
                Nome <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="client-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Nome completo"
                maxLength={100}
                required
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "client-name-error" : undefined}
                className={errors.name ? "border-destructive focus-visible:ring-destructive/40" : ""}
              />
              {errors.name && <p id="client-name-error" role="alert" className="text-xs text-destructive font-medium">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-phone" className="text-xs font-semibold">
                Telefone <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <div className="flex gap-2">
                <MaskedInput
                  id="client-phone"
                  mask="phone"
                  value={form.phone}
                  onValueChange={(_, masked) => update("phone", masked)}
                  placeholder="(11) 99999-0000"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "client-phone-error" : "client-phone-hint"}
                  className={`flex-1 ${errors.phone ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSearchErp}
                  disabled={isSearching || !isValidPhone(form.phone)}
                  title="Buscar no ERP CITEL"
                  aria-label="Buscar dados no ERP CITEL pelo telefone"
                  className="shrink-0 transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/30 active:scale-95"
                >
                  {isSearching ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
                </Button>
              </div>
              {errors.phone ? (
                <p id="client-phone-error" role="alert" className="text-xs text-destructive font-medium">{errors.phone}</p>
              ) : (
                <p id="client-phone-hint" className="text-[11px] text-muted-foreground">Digite e clique na lupa para buscar no ERP</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-email" className="text-xs font-semibold">E-mail</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="email@exemplo.com"
                maxLength={255}
                autoComplete="email"
                inputMode="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "client-email-error" : undefined}
                className={errors.email ? "border-destructive focus-visible:ring-destructive/40" : ""}
              />
              {errors.email && <p id="client-email-error" role="alert" className="text-xs text-destructive font-medium">{errors.email}</p>}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="client-address" className="text-xs font-semibold">Endereço</Label>
              <Input
                id="client-address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Rua, número, bairro"
                maxLength={200}
                autoComplete="street-address"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-city" className="text-xs font-semibold">Cidade</Label>
              <Input
                id="client-city"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="São Paulo"
                maxLength={100}
                autoComplete="address-level2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-tags" className="text-xs font-semibold">Tags</Label>
              <Input
                id="client-tags"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
                placeholder="residencial, fidelizado"
                maxLength={200}
                aria-describedby="client-tags-hint"
              />
              <p id="client-tags-hint" className="text-[11px] text-muted-foreground">Separe por vírgulas</p>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold">Vendedor</Label>
              {isVendedor ? (
                <Input value={sellerName || "Você"} disabled readOnly />
              ) : (
                <Select value={assignedSellerId} onValueChange={setAssignedSellerId}>
                  <SelectTrigger><SelectValue placeholder="Sem vendedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem vendedor —</SelectItem>
                    {sellers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="client-notes" className="text-xs font-semibold">Observações</Label>
              <Textarea
                id="client-notes"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Notas sobre o cliente..."
                maxLength={500}
                rows={3}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground text-right tabular-nums">{form.notes.length}/500</p>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-border/50 -mx-5 sm:-mx-6 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" className="sm:w-auto font-semibold shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
              Cadastrar Cliente
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
