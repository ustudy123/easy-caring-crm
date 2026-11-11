import { useState } from "react";
import { CheckCircle2, FileStack, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { KIND_LABEL, fileSha256, storagePathFor, type SalesDocumentKind } from "@/lib/salesDocuments";

const MAX_BYTES = 10 * 1024 * 1024;
const PARALLEL = 3;

type ItemStatus = "aguardando" | "enviando" | "lendo" | "pronto" | "repetido" | "falhou";
interface Item { name: string; status: ItemStatus; detail?: string }

const STATUS_LABEL: Record<ItemStatus, string> = {
  aguardando: "Na fila", enviando: "Enviando…", lendo: "Lendo com IA…", pronto: "Lido", repetido: "Já enviado antes", falhou: "Falhou",
};

/**
 * Importação em lote (admin, gerente e suporte): sobe vários PDFs de uma vez,
 * a IA lê cada um e o CRM sugere o vendedor (DE-PARA). Tudo entra na fila
 * "A confirmar" para o gestor da equipe externa ou o admin conferir.
 */
export function BulkImportDialog({ open, onOpenChange, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void;
}) {
  const [kind, setKind] = useState<SalesDocumentKind>("invoice");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);

  const setItem = (i: number, patch: Partial<Item>) => setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const importOne = async (file: File, i: number) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") { setItem(i, { status: "falhou", detail: "não é PDF" }); return; }
    if (file.size > MAX_BYTES) { setItem(i, { status: "falhou", detail: "passa de 10 MB" }); return; }
    setItem(i, { status: "enviando" });
    const hash = await fileSha256(file);
    const { data: dup } = await supabase.from("sales_documents").select("id").eq("file_hash", hash).limit(1);
    if (dup?.length) { setItem(i, { status: "repetido" }); return; }
    const id = crypto.randomUUID();
    const path = storagePathFor(null, id);
    const { error: upErr } = await supabase.storage.from("sales-documents").upload(path, file, { contentType: "application/pdf" });
    if (upErr) { setItem(i, { status: "falhou", detail: upErr.message }); return; }
    const { error: insErr } = await supabase.from("sales_documents").insert({ id, kind, seller_id: null, storage_path: path, file_name: file.name, file_hash: hash });
    if (insErr) {
      await supabase.storage.from("sales-documents").remove([path]);
      setItem(i, { status: "falhou", detail: insErr.message });
      return;
    }
    setItem(i, { status: "lendo" });
    const { data, error } = await supabase.functions.invoke("sales-document-extract", { body: { documentId: id } });
    if (error || data?.ok === false) setItem(i, { status: "pronto", detail: "leitura falhou: preencha na conferência" });
    else setItem(i, { status: "pronto" });
  };

  const start = async (files: File[]) => {
    if (!files.length) return;
    setItems(files.map((f) => ({ name: f.name, status: "aguardando" })));
    setRunning(true);
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        try { await importOne(files[i], i); } catch (e) { setItem(i, { status: "falhou", detail: (e as Error).message }); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, files.length) }, worker));
    setRunning(false);
    onDone();
  };

  const done = items.filter((i) => i.status === "pronto").length;
  const close = (o: boolean) => { if (!running) { onOpenChange(o); if (!o) setItems([]); } };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileStack className="h-4 w-4 text-brand-500" /> Importar em lote</DialogTitle>
          <DialogDescription>
            Selecione vários PDFs. A IA lê cada um e o CRM sugere o vendedor pelo nome no documento, pelo CNPJ ou pelo histórico.
            Nada conta nas metas até o gestor confirmar em “A confirmar”.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo dos documentos</Label>
            <div className="flex gap-1 rounded-full bg-muted p-1 w-fit">
              {(["invoice", "quote"] as const).map((k) => (
                <button key={k} type="button" disabled={running || items.length > 0} onClick={() => setKind(k)}
                  className={cn("px-3 py-1 text-xs font-semibold rounded-full", kind === k ? "bg-brand-500 text-white" : "text-muted-foreground")}>
                  {k === "invoice" ? "Notas fiscais" : "Orçamentos"}
                </button>
              ))}
            </div>
          </div>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <Label htmlFor="bulk-files" className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
                <FileStack className="h-4 w-4" /> Escolher PDFs ({KIND_LABEL[kind].toLowerCase()}s)
              </Label>
              <input id="bulk-files" type="file" multiple accept="application/pdf,.pdf" className="sr-only" aria-label="Arquivos PDF"
                onChange={(e) => start(Array.from(e.target.files ?? []))} />
              <p className="text-[11px] text-muted-foreground mt-2">Até 10 MB cada. PDFs já enviados antes são pulados.</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold" role="status">{running ? `Processando ${done} de ${items.length}…` : `${done} de ${items.length} lidos. Confira em “A confirmar”.`}</p>
              <ul className="max-h-72 overflow-y-auto divide-y divide-border/40 rounded-xl border border-border/60 text-xs">
                {items.map((it, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2">
                    {it.status === "pronto" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      : it.status === "falhou" ? <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        : it.status === "repetido" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          : <Loader2 className={cn("h-3.5 w-3.5 shrink-0", it.status !== "aguardando" && "animate-spin")} />}
                    <span className="min-w-0 flex-1 truncate">{it.name}</span>
                    <span className="shrink-0 text-muted-foreground">{STATUS_LABEL[it.status]}{it.detail ? `: ${it.detail}` : ""}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end"><Button onClick={() => close(false)} disabled={running}>Fechar</Button></div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
