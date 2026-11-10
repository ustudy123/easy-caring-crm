import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SellerCombobox } from "@/components/SellerCombobox";
import { useCrm } from "@/contexts/CrmContext";
import { useRole } from "@/contexts/RoleContext";
import {
  KIND_LABEL, fileSha256, kindMismatch, mapSalesDocument, storagePathFor, validateDraft, draftToRow,
  type DraftErrors, type SalesDocument, type SalesDocumentDraft, type SalesDocumentKind,
} from "@/lib/salesDocuments";
import { formatMoneyInput, parseMoneyInput } from "@/lib/salesGoals";
import type { Seller } from "@/types/crm";

const MAX_BYTES = 10 * 1024 * 1024;
const NO_LEAD = "__none__";

interface FormState {
  documentNumber: string;
  clientName: string;
  clientDocument: string;
  total: string;
  issueDate: string;
  expectedCloseDate: string;
  installments: { value: string; dueDate: string }[];
  notes: string;
}

const formFrom = (d: SalesDocument): FormState => ({
  documentNumber: d.documentNumber ?? "",
  clientName: d.clientName ?? "",
  clientDocument: d.clientDocument ?? "",
  total: formatMoneyInput(d.totalValue),
  issueDate: d.issueDate ?? "",
  expectedCloseDate: d.expectedCloseDate ?? "",
  installments: d.installments.map((i) => ({ value: formatMoneyInput(i.value), dueDate: i.due_date ?? "" })),
  notes: d.notes ?? "",
});

const toDraft = (f: FormState): SalesDocumentDraft => ({
  documentNumber: f.documentNumber,
  clientName: f.clientName,
  clientDocument: f.clientDocument,
  totalValue: parseMoneyInput(f.total),
  issueDate: f.issueDate,
  expectedCloseDate: f.expectedCloseDate,
  installments: f.installments.map((i) => ({ value: parseMoneyInput(i.value), dueDate: i.dueDate })),
  notes: f.notes,
});

async function functionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = JSON.parse(await error.context.text()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      // usa a mensagem padrão
    }
  }
  return "A leitura automática não respondeu. Preencha os campos à mão.";
}

/**
 * Envio de orçamento ou nota fiscal em PDF: sobe o arquivo, a IA lê e preenche
 * os campos, e a pessoa confere antes de salvar. No orçamento, o vendedor
 * informa a previsão de fechamento. Também edita um documento já enviado.
 */
export function SalesDocumentDialog({
  open, onOpenChange, kind, document, sellers, defaultSellerId, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: SalesDocumentKind;
  document?: SalesDocument | null;
  /** vendedores da equipe externa que esta pessoa pode escolher */
  sellers: Seller[];
  defaultSellerId?: string | null;
  onSaved: () => void;
}) {
  const { leads, updateLead } = useCrm();
  const { isVendedor, isAdmin, isGerente, isSuporte, sellerId: mySellerId } = useRole();
  const canPickSeller = isAdmin || isGerente || isSuporte || !isVendedor;

  const [doc, setDoc] = useState<SalesDocument | null>(document ?? null);
  const [sellerId, setSellerId] = useState<string>("");
  const [leadId, setLeadId] = useState<string>(NO_LEAD);
  const [form, setForm] = useState<FormState | null>(document ? formFrom(document) : null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState<null | "upload" | "read" | "save">(null);
  const createdHere = useRef(false);

  useEffect(() => {
    if (!open) return;
    setDoc(document ?? null);
    setForm(document ? formFrom(document) : null);
    setErrors({});
    setBusy(null);
    createdHere.current = false;
    setSellerId(document?.sellerId ?? (canPickSeller ? defaultSellerId ?? "" : mySellerId ?? ""));
    setLeadId(document?.leadId ?? NO_LEAD);
  }, [open, document, defaultSellerId, canPickSeller, mySellerId]);

  const sellerLeads = useMemo(
    () => leads.filter((l) => l.assignedTo === sellerId && l.stage !== "perdido").sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR")),
    [leads, sellerId],
  );

  const reloadDoc = async (id: string) => {
    const { data } = await supabase.from("sales_documents").select("*").eq("id", id).maybeSingle();
    return data ? mapSalesDocument(data) : null;
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { toast.error("Envie o arquivo em PDF."); return; }
    if (file.size > MAX_BYTES) { toast.error("O PDF passa de 10 MB."); return; }
    if (!sellerId) { toast.error("Escolha o vendedor."); return; }
    setBusy("upload");
    const hash = await fileSha256(file);
    const { data: same } = await supabase.from("sales_documents").select("id").eq("file_hash", hash).limit(1);
    if (same?.length) { setBusy(null); toast.error("Este PDF já foi enviado antes."); return; }
    const id = crypto.randomUUID();
    const path = storagePathFor(sellerId, id);
    const { error: upErr } = await supabase.storage.from("sales-documents").upload(path, file, { contentType: "application/pdf" });
    if (upErr) { setBusy(null); toast.error(`Não foi possível enviar o PDF: ${upErr.message}`); return; }
    const lead = leadId !== NO_LEAD ? leads.find((l) => l.id === leadId) : undefined;
    const { error: insErr } = await supabase.from("sales_documents").insert({
      id, kind, seller_id: sellerId, lead_id: lead?.id ?? null, storage_path: path, file_name: file.name, file_hash: hash,
    });
    if (insErr) {
      await supabase.storage.from("sales-documents").remove([path]);
      setBusy(null);
      toast.error(`Não foi possível registrar o documento: ${insErr.message}`);
      return;
    }
    createdHere.current = true;
    setBusy("read");
    const { data, error } = await supabase.functions.invoke("sales-document-extract", { body: { documentId: id } });
    if (error) toast.error(await functionError(error));
    else if (data?.ok === false && data.error) toast.error(data.error);
    const fresh = await reloadDoc(id);
    if (fresh) {
      // Sem cliente lido no PDF, usa o nome do card escolhido.
      const f = formFrom(fresh);
      if (!f.clientName && lead) f.clientName = lead.clientName;
      setDoc(fresh);
      setForm(f);
    }
    setBusy(null);
  };

  const discardAndClose = async () => {
    if (createdHere.current && doc) {
      await supabase.from("sales_documents").delete().eq("id", doc.id);
      await supabase.storage.from("sales-documents").remove([doc.storagePath]);
    }
    onOpenChange(false);
  };

  const save = async () => {
    if (!doc || !form) return;
    const draft = toDraft(form);
    const errs = validateDraft(kind, draft);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy("save");
    const row = draftToRow(kind, draft);
    if (row.document_number) {
      const { data: dup } = await supabase.from("sales_documents").select("id, issue_date")
        .eq("kind", kind).eq("document_number", row.document_number).neq("id", doc.id).limit(1);
      if (dup?.length) {
        setBusy(null);
        toast.error(`Já existe ${KIND_LABEL[kind].toLowerCase()} nº ${row.document_number} cadastrado.`);
        return;
      }
    }
    const lead = leadId !== NO_LEAD ? leads.find((l) => l.id === leadId) : undefined;
    const { error } = await supabase.from("sales_documents").update({ ...row, lead_id: lead?.id ?? null }).eq("id", doc.id);
    if (error) { setBusy(null); toast.error(`Não foi possível salvar: ${error.message}`); return; }
    // Orçamento no card: o valor do card (exigido na qualificação) vem do PDF.
    if (kind === "quote" && lead && !(lead.value > 0) && row.total_value) {
      updateLead({ ...lead, value: row.total_value });
    }
    createdHere.current = false;
    setBusy(null);
    toast.success(doc.reviewStatus === "confirmed"
      ? `${KIND_LABEL[kind]} salvo.`
      : `${KIND_LABEL[kind]} salvo. Ele passa a contar nas metas quando o gestor confirmar.`);
    onSaved();
    onOpenChange(false);
  };

  const set = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const setInstallment = (i: number, patch: Partial<FormState["installments"][number]>) =>
    setForm((f) => (f ? { ...f, installments: f.installments.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) } : f));

  const editing = !!document;
  const ai = doc?.aiExtracted ?? null;
  const title = `${editing ? "Editar" : "Enviar"} ${KIND_LABEL[kind].toLowerCase()}`;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : discardAndClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileUp className="h-4 w-4 text-brand-500" /> {title}</DialogTitle>
          <DialogDescription>
            {editing
              ? kind === "quote"
                ? "Confira os dados do orçamento e a previsão de fechamento."
                : "Confira os dados da nota fiscal e as parcelas."
              : kind === "quote"
              ? "Suba o PDF do orçamento: a IA lê cliente, número, data e valor total. Confira e informe a previsão de fechamento."
              : "Suba o PDF da nota fiscal: a IA lê cliente, número, data de emissão, valor total e parcelas. Confira antes de salvar."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {canPickSeller && (
            <div className="space-y-1.5">
              <Label>Vendedor</Label>
              {doc
                ? <p className="text-sm font-medium text-foreground">{sellers.find((s) => s.id === sellerId)?.name ?? "—"}</p>
                : <SellerCombobox value={sellerId} onChange={setSellerId} sellers={sellers} placeholder="Escolha o vendedor" />}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Card do cliente (opcional)</Label>
            <Select value={leadId} onValueChange={setLeadId} disabled={!sellerId}>
              <SelectTrigger aria-label="Card do cliente"><SelectValue placeholder="Sem card" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LEAD}>Sem card</SelectItem>
                {sellerLeads.map((l) => <SelectItem key={l.id} value={l.id}>{l.clientName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!form && (
            <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2">
              {busy ? (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" /> {busy === "upload" ? "Enviando o PDF…" : "Lendo o PDF com IA…"}
                </p>
              ) : (
                <>
                  <Label htmlFor="sales-doc-file" className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
                    <FileUp className="h-4 w-4" /> Escolher PDF
                  </Label>
                  <input
                    id="sales-doc-file"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    aria-label="Arquivo PDF"
                    disabled={!sellerId}
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">{sellerId ? "PDF de até 10 MB." : "Escolha o vendedor antes do arquivo."}</p>
                </>
              )}
            </div>
          )}

          {form && doc && (
            <>
              {doc.aiStatus === "done" && (
                <p className="flex items-start gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
                  <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Campos lidos pela IA. Confira antes de salvar.
                </p>
              )}
              {doc.aiStatus === "failed" && (
                <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {doc.aiError || "A leitura automática falhou."} Preencha os campos.
                </p>
              )}
              {kindMismatch(kind, ai) && (
                <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Este PDF parece {ai?.document_type === "invoice" ? "uma nota fiscal" : "um orçamento"}, não {kind === "quote" ? "um orçamento" : "uma nota fiscal"}. Confira o arquivo.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="sd-client">Cliente</Label>
                  <Input id="sd-client" value={form.clientName} onChange={(e) => set({ clientName: e.target.value })} />
                  {errors.clientName && <p className="text-xs text-destructive">{errors.clientName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sd-doc">CNPJ / CPF</Label>
                  <Input id="sd-doc" value={form.clientDocument} onChange={(e) => set({ clientDocument: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sd-number">Número {kind === "invoice" ? "da nota" : "do orçamento"}</Label>
                  <Input id="sd-number" value={form.documentNumber} onChange={(e) => set({ documentNumber: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sd-issue">Data de emissão</Label>
                  <Input id="sd-issue" type="date" value={form.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
                  {errors.issueDate && <p className="text-xs text-destructive">{errors.issueDate}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sd-total">Valor total (R$)</Label>
                  <Input id="sd-total" inputMode="decimal" value={form.total} onChange={(e) => set({ total: e.target.value })} />
                  {errors.totalValue && <p className="text-xs text-destructive">{errors.totalValue}</p>}
                </div>
                {kind === "quote" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="sd-close">Previsão de fechamento</Label>
                    <Input id="sd-close" type="date" value={form.expectedCloseDate} onChange={(e) => set({ expectedCloseDate: e.target.value })} />
                    {errors.expectedCloseDate && <p className="text-xs text-destructive">{errors.expectedCloseDate}</p>}
                  </div>
                )}
              </div>

              {kind === "invoice" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Parcelas</Label>
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                      onClick={() => set({ installments: [...form.installments, { value: "", dueDate: "" }] })}>
                      <Plus className="h-3.5 w-3.5" /> Parcela
                    </Button>
                  </div>
                  {form.installments.length === 0 && <p className="text-xs text-muted-foreground">À vista (sem parcelas).</p>}
                  {form.installments.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">{i + 1}ª</span>
                      <Input aria-label={`Valor da parcela ${i + 1}`} inputMode="decimal" className="h-9" value={it.value} onChange={(e) => setInstallment(i, { value: e.target.value })} />
                      <Input aria-label={`Vencimento da parcela ${i + 1}`} type="date" className="h-9" value={it.dueDate} onChange={(e) => setInstallment(i, { dueDate: e.target.value })} />
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={`Remover parcela ${i + 1}`}
                        onClick={() => set({ installments: form.installments.filter((_, idx) => idx !== i) })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {errors.installments && <p className="text-xs text-destructive">{errors.installments}</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="sd-notes">Observações</Label>
                <Textarea id="sd-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
              </div>
            </>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={discardAndClose} disabled={busy === "upload" || busy === "read"}>Cancelar</Button>
            {form && (
              <Button type="button" onClick={save} disabled={!!busy}>
                {busy === "save" && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
