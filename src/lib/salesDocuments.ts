import type { ExtractedDocument, Installment } from "../../supabase/functions/_shared/documentExtraction";
import type { Tables } from "@/integrations/supabase/types";

export type { ExtractedDocument, Installment };
export type SalesDocumentKind = "quote" | "invoice";

export const KIND_LABEL: Record<SalesDocumentKind, string> = { quote: "Orçamento", invoice: "Nota fiscal" };

/** Orçamento ou nota fiscal enviado em PDF (Fase 7). */
export interface SalesDocument {
  id: string;
  kind: SalesDocumentKind;
  sellerId: string;
  leadId: string | null;
  supportRequestId: string | null;
  storageBucket: string;
  storagePath: string;
  fileName: string | null;
  documentNumber: string | null;
  clientName: string | null;
  clientDocument: string | null;
  totalValue: number | null;
  issueDate: string | null;
  expectedCloseDate: string | null;
  installments: Installment[];
  notes: string | null;
  aiStatus: "pending" | "done" | "failed";
  aiExtracted: ExtractedDocument | null;
  aiError: string | null;
  createdAt: string;
}

export function mapSalesDocument(row: Tables<"sales_documents">): SalesDocument {
  return {
    id: row.id,
    kind: row.kind as SalesDocumentKind,
    sellerId: row.seller_id,
    leadId: row.lead_id,
    supportRequestId: row.support_request_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    documentNumber: row.document_number,
    clientName: row.client_name,
    clientDocument: row.client_document,
    totalValue: row.total_value === null ? null : Number(row.total_value),
    issueDate: row.issue_date,
    expectedCloseDate: row.expected_close_date,
    installments: Array.isArray(row.installments) ? (row.installments as unknown as Installment[]) : [],
    notes: row.notes,
    aiStatus: (row.ai_status as SalesDocument["aiStatus"]) ?? "pending",
    aiExtracted: (row.ai_extracted as unknown as ExtractedDocument | null) ?? null,
    aiError: row.ai_error,
    createdAt: row.created_at,
  };
}

/** Documento conta no painel quando já tem valor e data de emissão. */
export const isComplete = (d: Pick<SalesDocument, "totalValue" | "issueDate">) => d.totalValue !== null && !!d.issueDate;

/** Valor salvo diferente do que a IA leu: o painel sinaliza para conferência. */
export function wasEditedByHand(d: Pick<SalesDocument, "totalValue" | "aiExtracted">): boolean {
  const ai = d.aiExtracted?.total_value;
  return typeof ai === "number" && d.totalValue !== null && Math.abs(ai - d.totalValue) >= 0.01;
}

/** A IA achou outro tipo de documento (ex.: nota enviada como orçamento). */
export function kindMismatch(kind: SalesDocumentKind, ai: ExtractedDocument | null): boolean {
  return !!ai && ai.document_type !== "other" && ai.document_type !== kind;
}

export interface SalesDocumentDraft {
  documentNumber: string;
  clientName: string;
  clientDocument: string;
  totalValue: number | null;
  issueDate: string;
  expectedCloseDate: string;
  installments: { value: number | null; dueDate: string }[];
  notes: string;
}

export function draftFromDocument(d: SalesDocument): SalesDocumentDraft {
  return {
    documentNumber: d.documentNumber ?? "",
    clientName: d.clientName ?? "",
    clientDocument: d.clientDocument ?? "",
    totalValue: d.totalValue,
    issueDate: d.issueDate ?? "",
    expectedCloseDate: d.expectedCloseDate ?? "",
    installments: d.installments.map((i) => ({ value: i.value, dueDate: i.due_date ?? "" })),
    notes: d.notes ?? "",
  };
}

export type DraftErrors = Partial<Record<"clientName" | "totalValue" | "issueDate" | "expectedCloseDate" | "installments", string>>;

export function validateDraft(kind: SalesDocumentKind, d: SalesDocumentDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.clientName.trim()) e.clientName = "Informe o cliente.";
  if (d.totalValue === null) e.totalValue = "Informe o valor total.";
  else if (Number.isNaN(d.totalValue)) e.totalValue = "Valor inválido.";
  if (!d.issueDate) e.issueDate = "Informe a data de emissão.";
  if (kind === "quote") {
    if (!d.expectedCloseDate) e.expectedCloseDate = "Informe a previsão de fechamento.";
    else if (d.issueDate && d.expectedCloseDate < d.issueDate) e.expectedCloseDate = "A previsão não pode ser antes da emissão.";
  }
  if (kind === "invoice" && d.installments.some((i) => i.value === null || Number.isNaN(i.value) || !i.dueDate)) {
    e.installments = "Cada parcela precisa de valor e vencimento.";
  }
  return e;
}

/** Colunas do banco a partir do formulário. */
export function draftToRow(kind: SalesDocumentKind, d: SalesDocumentDraft) {
  return {
    document_number: d.documentNumber.trim() || null,
    client_name: d.clientName.trim(),
    client_document: d.clientDocument.trim() || null,
    total_value: d.totalValue,
    issue_date: d.issueDate || null,
    expected_close_date: kind === "quote" ? d.expectedCloseDate || null : null,
    installments: kind === "invoice"
      ? d.installments.map((i, idx) => ({ number: idx + 1, value: i.value, due_date: i.dueDate || null }))
      : [],
    notes: d.notes.trim() || null,
  };
}

/** Nome do arquivo no bucket: uma pasta por vendedor. */
export function storagePathFor(sellerId: string, id: string): string {
  return `${sellerId}/${id}.pdf`;
}
