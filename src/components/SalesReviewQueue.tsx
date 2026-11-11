import { useState } from "react";
import { AlertTriangle, CheckCheck, CheckCircle2, Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SellerCombobox } from "@/components/SellerCombobox";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/salesGoals";
import { KIND_LABEL, MATCH_LABEL, type SalesDocument } from "@/lib/salesDocuments";
import type { Seller } from "@/types/crm";

const day = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "—");

/** Pronto para confirmar: tem vendedor, cliente, valor e data. */
export const readyToConfirm = (d: SalesDocument) => !!d.sellerId && !!d.clientName && d.totalValue !== null && !!d.issueDate;

/**
 * Fila "A confirmar": documentos importados ou enviados que ainda não contam nas
 * metas. O gestor da equipe externa (gerente da loja) ou o admin confere o
 * vendedor sugerido e confirma; a confirmação ensina o DE-PARA cliente → vendedor.
 */
export function SalesReviewQueue({
  documents, sellers, canConfirm, onChanged, onEdit, onOpenPdf, onDelete,
}: {
  documents: SalesDocument[];
  sellers: Seller[];
  canConfirm: boolean;
  onChanged: () => void;
  onEdit: (d: SalesDocument) => void;
  onOpenPdf: (d: SalesDocument) => void;
  onDelete: (d: SalesDocument) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const byId = new Map(documents.map((d) => [d.id, d]));
  const sellerOf = (d: SalesDocument) => overrides[d.id] ?? d.sellerId ?? "";

  const confirm = async (list: SalesDocument[]) => {
    setBusy(list.length > 1 ? "all" : list[0].id);
    let ok = 0;
    const failures: string[] = [];
    for (const d of list) {
      const seller = sellerOf(d);
      const { error } = await supabase.from("sales_documents").update({ seller_id: seller, review_status: "confirmed" }).eq("id", d.id);
      if (error) failures.push(`${d.clientName ?? d.fileName}: ${error.message}`);
      else ok++;
    }
    setBusy(null);
    if (ok) toast.success(ok === 1 ? "Documento confirmado." : `${ok} documentos confirmados.`);
    if (failures.length) toast.error(failures.slice(0, 3).join(" · "));
    setOverrides({});
    onChanged();
  };

  const ready = documents.filter((d) => readyToConfirm({ ...d, sellerId: sellerOf(d) || null }));

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground p-6 text-center">Nada aguardando confirmação.</p>;
  }

  return (
    <div className="space-y-3">
      {canConfirm ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <p className="text-xs text-muted-foreground">
            Confira o vendedor de cada documento. Só depois de confirmado ele conta no orçado ou no vendido.
          </p>
          <Button size="sm" className="gap-1.5" disabled={!ready.length || !!busy} onClick={() => confirm(ready)}>
            {busy === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Confirmar {ready.length} pronto{ready.length === 1 ? "" : "s"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground px-4 pt-3">O gestor da equipe externa ou o admin confirma estes documentos.</p>
      )}
      <ul className="divide-y divide-border/40">
        {documents.map((d) => {
          const seller = sellerOf(d);
          const dup = d.possibleDuplicateOf ? byId.get(d.possibleDuplicateOf) : undefined;
          const missing = [!d.clientName && "cliente", d.totalValue === null && "valor", !d.issueDate && "data"].filter(Boolean);
          return (
            <li key={d.id} className="px-4 py-3 text-xs space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground break-words">{d.clientName || d.fileName || "Sem cliente"}</p>
                  <p className="text-muted-foreground">
                    {KIND_LABEL[d.kind]}{d.documentNumber ? ` nº ${d.documentNumber}` : ""} · Emissão {day(d.issueDate)}
                    {d.clientDocument ? ` · ${d.clientDocument}` : ""}
                  </p>
                </div>
                <p className="font-bold tabular-nums text-sm shrink-0">{d.totalValue === null ? "—" : brl(d.totalValue)}</p>
              </div>

              <div className="flex flex-wrap gap-1">
                {d.sellerMatch && (
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    d.sellerMatch === "nenhum" ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                    Vendedor sugerido {MATCH_LABEL[d.sellerMatch]}
                    {d.sellerMatch === "representante" && d.extractedSellerName ? ` (${d.extractedSellerName})` : ""}
                  </span>
                )}
                {d.possibleDuplicateOf && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                    <AlertTriangle className="inline h-3 w-3 mr-0.5" />
                    Possível duplicata{dup ? ` de ${dup.fileName ?? dup.clientName}` : " de um documento já cadastrado"}
                  </span>
                )}
                {missing.length > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Falta {missing.join(", ")}</span>
                )}
                {d.aiStatus === "failed" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Leitura automática falhou</span>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canConfirm ? (
                  <SellerCombobox
                    value={seller}
                    onChange={(v) => setOverrides((o) => ({ ...o, [d.id]: v }))}
                    sellers={sellers}
                    placeholder="Escolha o vendedor"
                    className="h-8 w-56 text-xs"
                  />
                ) : (
                  <span className="text-muted-foreground">Vendedor: {sellers.find((s) => s.id === seller)?.name ?? "a definir"}</span>
                )}
                <div className="relative z-20 ml-auto flex gap-0.5">
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Abrir PDF" onClick={() => onOpenPdf(d)}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => onEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Excluir" onClick={() => onDelete(d)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  {canConfirm && (
                    <Button size="sm" className="h-8 gap-1" aria-label={`Confirmar ${d.clientName ?? d.fileName ?? "documento"}`}
                      disabled={!readyToConfirm({ ...d, sellerId: seller || null }) || !!busy} onClick={() => confirm([d])}>
                      {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Confirmar
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
