import { useMemo, useState } from "react";
import { Download, Eye, FileStack, FileText, Pencil, Receipt, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { SellerCombobox } from "@/components/SellerCombobox";
import { SalesGoalsReport } from "@/components/SalesGoalsReport";
import { SalesDocumentDialog } from "@/components/SalesDocumentDialog";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { SalesReviewQueue } from "@/components/SalesReviewQueue";
import { ProtectedView, useCanExport } from "@/components/ProtectedView";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { usePendingDocuments, useSalesDocuments, useSalesTeamSellers } from "@/hooks/useSalesGoals";
import { exportToCsv } from "@/lib/exportCsv";
import { cn } from "@/lib/utils";
import { brl, monthLabel, monthRange, monthStart, monthTitle } from "@/lib/salesGoals";
import { KIND_LABEL, wasEditedByHand, type SalesDocument, type SalesDocumentKind } from "@/lib/salesDocuments";

const day = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "—");

/**
 * Orçamentos e notas fiscais da equipe externa (Fase 7): sobe o PDF, a IA lê
 * os campos, e o mês aparece contra a meta. O vendedor vê só os seus; gerente,
 * os da loja; admin e suporte, todos.
 */
export default function SalesDocuments() {
  const { isAdmin, isGerente, isVendedor, isSuporte } = useRole();
  const sellers = useSalesTeamSellers();
  const canExport = useCanExport();
  const showGoals = isAdmin || isGerente || isVendedor;
  const canFilter = isAdmin || isGerente || isSuporte;
  // Importa em lote e acompanha a fila: admin, gerente e suporte. Confirma: admin e gerente.
  const canImport = isAdmin || isGerente || isSuporte;
  const canConfirm = isAdmin || isGerente;

  const [month, setMonth] = useState(() => monthStart());
  const range = useMemo(() => monthRange(month), [month]);
  const { documents, loading, error, reload: reloadMonth } = useSalesDocuments(range, sellers.length > 0);
  const { documents: pending, reload: reloadPending } = usePendingDocuments(canImport);
  const reload = () => { reloadMonth(); reloadPending(); };
  const [tab, setTab] = useState<SalesDocumentKind | "review">("quote");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sellerFilter, setSellerFilter] = useState("all");
  const [onlyMissingClose, setOnlyMissingClose] = useState(false);
  const [dialog, setDialog] = useState<{ kind: SalesDocumentKind; doc?: SalesDocument } | null>(null);
  const [deleting, setDeleting] = useState<SalesDocument | null>(null);

  const sellerIds = new Set(sellers.map((s) => s.id));
  const scoped = documents
    .filter((d) => sellerIds.has(d.sellerId))
    .filter((d) => sellerFilter === "all" || d.sellerId === sellerFilter);
  const missingClose = scoped.filter((d) => d.kind === "quote" && !d.expectedCloseDate);
  const visible = scoped
    .filter((d) => d.kind === tab)
    .filter((d) => tab !== "quote" || !onlyMissingClose || !d.expectedCloseDate);
  const sellerName = (id: string | null) => (id && sellers.find((s) => s.id === id)?.name) || "sem vendedor";
  const goalSellers = sellerFilter === "all" ? sellers : sellers.filter((s) => s.id === sellerFilter);

  const openPdf = async (d: SalesDocument) => {
    const { data, error: err } = await supabase.storage.from(d.storageBucket).createSignedUrl(d.storagePath, 300);
    if (err || !data?.signedUrl) { toast.error("Não foi possível abrir o PDF."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remove = async () => {
    if (!deleting) return;
    const { error: err } = await supabase.from("sales_documents").delete().eq("id", deleting.id);
    if (err) { toast.error(`Não foi possível excluir: ${err.message}`); return; }
    if (deleting.storageBucket === "sales-documents") await supabase.storage.from("sales-documents").remove([deleting.storagePath]);
    toast.success(`${KIND_LABEL[deleting.kind]} excluído.`);
    setDeleting(null);
    reload();
  };

  const handleExport = () => exportToCsv(
    visible,
    [
      { key: "tipo", label: "Tipo", format: (d) => KIND_LABEL[d.kind] },
      { key: "emissao", label: "Emissão", format: (d) => day(d.issueDate) },
      { key: "numero", label: "Número", format: (d) => d.documentNumber ?? "" },
      { key: "cliente", label: "Cliente", format: (d) => d.clientName ?? "" },
      { key: "documento", label: "CNPJ/CPF", format: (d) => d.clientDocument ?? "" },
      { key: "vendedor", label: "Vendedor", format: (d) => sellerName(d.sellerId) },
      { key: "valor", label: "Valor (R$)", format: (d) => d.totalValue?.toFixed(2).replace(".", ",") ?? "" },
      { key: "previsao", label: "Previsão de fechamento", format: (d) => day(d.expectedCloseDate) },
      { key: "parcelas", label: "Parcelas", format: (d) => d.installments.map((i) => `${brl(i.value)} em ${day(i.due_date)}`).join(" | ") },
    ],
    `${tab === "quote" ? "orcamentos" : "notas_fiscais"}_${month.toISOString().slice(0, 7)}`,
  );

  return (
    <AppLayout title="Orçamentos e Notas">
      <div className="space-y-5">
        {sellers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Esta tela é da equipe externa. Nenhum vendedor ativo da equipe externa para você acompanhar.
          </p>
        ) : (
          <>
            {showGoals && <SalesGoalsReport month={month} onMonthChange={setMonth} showQuotes={false} sellers={goalSellers} />}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-full bg-muted p-1">
                  {(["quote", "invoice", ...(canImport ? ["review" as const] : [])] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => { setTab(k); setOnlyMissingClose(false); }}
                      className={cn("px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                        tab === k ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground")}
                    >
                      {k === "quote" ? "Orçamentos" : k === "invoice" ? "Notas fiscais" : "A confirmar"} ({k === "review" ? pending.length : scoped.filter((d) => d.kind === k).length})
                    </button>
                  ))}
                </div>
                {canFilter && (
                  <SellerCombobox
                    value={sellerFilter}
                    onChange={setSellerFilter}
                    sellers={sellers}
                    presets={[{ value: "all", label: "Todos os vendedores" }]}
                    className="h-9 w-52 text-xs"
                  />
                )}
                {!showGoals && <p className="text-xs font-semibold text-muted-foreground">{monthTitle(month)}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => setDialog({ kind: "quote" })}>
                  <Upload className="h-3.5 w-3.5" /> Enviar orçamento
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialog({ kind: "invoice" })}>
                  <Receipt className="h-3.5 w-3.5" /> Enviar nota fiscal
                </Button>
                {canImport && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkOpen(true)}>
                    <FileStack className="h-3.5 w-3.5" /> Importar em lote
                  </Button>
                )}
              </div>
            </div>

            {missingClose.length > 0 && (
              <button
                onClick={() => { setTab("quote"); setOnlyMissingClose((v) => !v); }}
                className="w-full text-left rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800"
              >
                {missingClose.length} orçamento{missingClose.length > 1 ? "s" : ""} sem previsão de fechamento.{" "}
                {onlyMissingClose ? "Mostrar todos." : "Ver e informar a data."}
              </button>
            )}

            {error && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os documentos: {error}</p>}

            <ProtectedView className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <p className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-500" />
                  {tab === "review" ? "Aguardando confirmação (todos os meses)" : `${tab === "quote" ? "Orçamentos" : "Notas fiscais"} de ${monthLabel(month)}`}
                </p>
                {canExport && tab !== "review" && (
                  <button onClick={handleExport} disabled={visible.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40">
                    <Download className="h-3.5 w-3.5" /> Exportar
                  </button>
                )}
              </div>
              {tab === "review" ? (
                <SalesReviewQueue
                  documents={pending}
                  sellers={sellers}
                  canConfirm={canConfirm}
                  onChanged={reload}
                  onEdit={(d) => setDialog({ kind: d.kind, doc: d })}
                  onOpenPdf={openPdf}
                  onDelete={setDeleting}
                />
              ) : loading ? (
                <p className="text-sm text-muted-foreground p-6 text-center">Carregando…</p>
              ) : visible.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6 text-center">Nenhum documento neste mês.</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {visible.map((d) => (
                    <li key={d.id} className="px-4 py-3 text-xs space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-semibold text-foreground text-sm break-words">{d.clientName || d.fileName || "Sem cliente"}</p>
                        <p className="font-bold tabular-nums text-sm shrink-0">{d.totalValue === null ? "—" : brl(d.totalValue)}</p>
                      </div>
                      <p className="text-muted-foreground">
                        {d.documentNumber ? `Nº ${d.documentNumber} · ` : ""}Emissão {day(d.issueDate)}
                        {canFilter ? ` · ${sellerName(d.sellerId)}` : ""}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          {d.kind === "quote" && (d.expectedCloseDate
                            ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Previsão {day(d.expectedCloseDate)}</span>
                            : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Sem previsão</span>)}
                          {d.kind === "invoice" && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                              {d.installments.length ? `${d.installments.length} parcela${d.installments.length > 1 ? "s" : ""}` : "À vista"}
                            </span>
                          )}
                          {d.reviewStatus === "pending" && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">Aguardando confirmação</span>}
                          {!d.issueDate && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Falta conferir</span>}
                          {wasEditedByHand(d) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Valor editado</span>}
                          {d.supportRequestId && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Do suporte</span>}
                        </div>
                      <div className="relative z-20 flex shrink-0 gap-0.5">
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Abrir PDF" onClick={() => openPdf(d)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => setDialog({ kind: d.kind, doc: d })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Excluir" onClick={() => setDeleting(d)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ProtectedView>
          </>
        )}
      </div>

      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} onDone={() => { reload(); setTab("review"); }} />
      {dialog && (
        <SalesDocumentDialog
          open={!!dialog}
          onOpenChange={(o) => !o && setDialog(null)}
          kind={dialog.kind}
          document={dialog.doc ?? null}
          sellers={sellers}
          defaultSellerId={sellerFilter !== "all" ? sellerFilter : sellers.length === 1 ? sellers[0].id : null}
          onSaved={reload}
        />
      )}
      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onConfirm={remove}
        title={deleting ? `Excluir ${KIND_LABEL[deleting.kind].toLowerCase()}?` : ""}
        description="O documento sai das metas e o PDF é apagado. Não dá para desfazer."
      />
    </AppLayout>
  );
}
