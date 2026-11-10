import type { ExtractedDocument, Installment } from "../../supabase/functions/_shared/documentExtraction";
import type { Tables } from "@/integrations/supabase/types";

export type { ExtractedDocument, Installment };
export type SalesDocumentKind = "quote" | "invoice";

export const KIND_LABEL: Record<SalesDocumentKind, string> = { quote: "Orçamento", invoice: "Nota fiscal" };

/** Orçamento ou nota fiscal enviado em PDF (Fase 7). */
export interface SalesDocument {
  id: string;
  kind: SalesDocumentKind;
  /** null: importado em lote e ainda sem vendedor */
  sellerId: string | null;
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
  /** só conta nas metas depois que o gestor (ou admin) confirma */
  reviewStatus: "pending" | "confirmed";
  suggestedSellerId: string | null;
  sellerMatch: SellerMatch | null;
  extractedSellerName: string | null;
  possibleDuplicateOf: string | null;
  fileHash: string | null;
}

export type SellerMatch = "representante" | "historico" | "carteira" | "card" | "nenhum";

/** Por que o CRM sugeriu esse vendedor (DE-PARA documento → vendedor). */
export const MATCH_LABEL: Record<SellerMatch, string> = {
  representante: "pelo vendedor escrito no PDF",
  historico: "pelo histórico do cliente",
  carteira: "pela carteira de clientes (CNPJ)",
  card: "pelo card do cliente",
  nenhum: "sem pista: escolha o vendedor",
};

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
    reviewStatus: row.review_status === "confirmed" ? "confirmed" : "pending",
    suggestedSellerId: row.suggested_seller_id,
    sellerMatch: (row.seller_match as SellerMatch | null) ?? null,
    extractedSellerName: row.extracted_seller_name,
    possibleDuplicateOf: row.possible_duplicate_of,
    fileHash: row.file_hash,
  };
}

/** Documento conta no painel quando o gestor confirmou e ele tem valor e data de emissão. */
export const isComplete = (d: Pick<SalesDocument, "totalValue" | "issueDate" | "reviewStatus">) =>
  d.reviewStatus === "confirmed" && d.totalValue !== null && !!d.issueDate;

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

/** Nome do arquivo no bucket: uma pasta por vendedor; importação em lote vai para "importacao/". */
export function storagePathFor(sellerId: string | null, id: string): string {
  return `${sellerId ?? "importacao"}/${id}.pdf`;
}

/** SHA-256 do arquivo, para avisar quando o mesmo PDF já foi enviado. */
export async function fileSha256(file: Blob): Promise<string> {
  const buf = typeof file.arrayBuffer === "function"
    ? await file.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}
