import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseMockState } from "@/test/supabaseMock";
import type { SalesDocument } from "@/lib/salesDocuments";

const state = vi.hoisted(() => ({ db: {}, calls: [], invokes: [], storage: [] }) as SupabaseMockState);
const updateLead = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: createSupabaseMock(state) };
});
vi.mock("@/contexts/CrmContext", () => ({
  useCrm: () => ({
    leads: [{ id: "lead1", clientName: "SERCON CONSTRUCOES", assignedTo: "ana", stage: "precificacao_especial", value: 0 }],
    updateLead,
  }),
}));
vi.mock("@/contexts/RoleContext", () => ({
  useRole: () => ({ isVendedor: true, isAdmin: false, isGerente: false, isSuporte: false, sellerId: "ana" }),
}));
vi.mock("sonner", () => ({ toast }));

import { SalesDocumentDialog } from "./SalesDocumentDialog";

const sellers = [{ id: "ana", name: "Ana", store_id: "ext", role: "vendedor" as const, leadsCount: 0, conversions: 0 }];
const aiRead = { document_type: "quote", document_number: "4521", client_name: "SERCON", client_document: "12.345.678/0001-90", issue_date: "2026-11-03", total_value: 1_000_000, installments: [] };

beforeEach(() => {
  state.calls = [];
  state.invokes = [];
  state.storage = [];
  state.db = { sales_documents: [] };
  updateLead.mockReset();
  Object.values(toast).forEach((f) => f.mockReset());
  // Simula a função: preenche os campos do documento com o que a IA leu.
  state.invoke = (_fn, body) => {
    state.db.sales_documents = state.db.sales_documents.map((d) => (d.id === body.documentId
      ? { ...d, ...aiRead, document_type: undefined, ai_status: "done", ai_extracted: aiRead, installments: [] }
      : d));
    return { ok: true };
  };
});
afterEach(cleanup);

const pdf = () => new File(["%PDF-1.4"], "orcamento.pdf", { type: "application/pdf" });
const renderDialog = (props: Partial<Parameters<typeof SalesDocumentDialog>[0]> = {}) => {
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();
  render(<SalesDocumentDialog open onOpenChange={onOpenChange} kind="quote" sellers={sellers} onSaved={onSaved} {...props} />);
  return { onSaved, onOpenChange };
};

describe("SalesDocumentDialog", () => {
  it("uploads the PDF, fills the fields read by AI and requires the expected closing date", async () => {
    const { onSaved } = renderDialog();
    fireEvent.change(screen.getByLabelText("Arquivo PDF"), { target: { files: [pdf()] } });

    await waitFor(() => expect(screen.getByLabelText("Cliente")).toHaveValue("SERCON"));
    const [doc] = state.db.sales_documents as { id: string; storage_path: string }[];
    expect(state.storage).toEqual([{ op: "upload", bucket: "sales-documents", path: `ana/${doc.id}.pdf` }]);
    expect(state.calls[0]).toMatchObject({ table: "sales_documents", op: "insert", values: { kind: "quote", seller_id: "ana", lead_id: null, file_name: "orcamento.pdf" } });
    expect(state.invokes).toEqual([{ fn: "sales-document-extract", body: { documentId: doc.id } }]);
    expect(screen.getByLabelText("Valor total (R$)")).toHaveValue("1.000.000,00");
    expect(screen.getByText(/Campos lidos pela IA/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe a previsão de fechamento.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Previsão de fechamento"), { target: { value: "2026-11-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(state.calls.at(-1)).toMatchObject({
      table: "sales_documents", op: "update", filters: [`id=${doc.id}`],
      values: { client_name: "SERCON", document_number: "4521", total_value: 1_000_000, issue_date: "2026-11-03", expected_close_date: "2026-11-20", lead_id: null },
    });
    expect(toast.success).toHaveBeenCalledWith("Orçamento salvo.");
  });

  it("deletes the uploaded file and record when cancelled", async () => {
    const { onOpenChange } = renderDialog();
    fireEvent.change(screen.getByLabelText("Arquivo PDF"), { target: { files: [pdf()] } });
    await waitFor(() => expect(screen.getByLabelText("Cliente")).toHaveValue("SERCON"));
    const [doc] = state.db.sales_documents as { id: string }[];
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(state.db.sales_documents).toEqual([]);
    expect(state.storage!.at(-1)).toEqual({ op: "remove", bucket: "sales-documents", path: `ana/${doc.id}.pdf` });
  });

  it("refuses a non-PDF file", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Arquivo PDF"), { target: { files: [new File(["x"], "foto.png", { type: "image/png" })] } });
    expect(toast.error).toHaveBeenCalledWith("Envie o arquivo em PDF.");
    expect(state.storage).toEqual([]);
  });

  const existing = (o: Partial<SalesDocument> = {}): SalesDocument => ({
    id: "d1", kind: "quote", sellerId: "ana", leadId: "lead1", supportRequestId: null, storageBucket: "sales-documents", storagePath: "ana/d1.pdf",
    fileName: "o.pdf", documentNumber: "4521", clientName: "SERCON", clientDocument: null, totalValue: 250_000, issueDate: "2026-11-03",
    expectedCloseDate: "2026-11-30", installments: [], notes: null, aiStatus: "done", aiExtracted: null, aiError: null, createdAt: "2026-11-03T12:00:00Z", ...o,
  });

  it("fills the card value from the quote when the linked card has none", async () => {
    state.db.sales_documents = [{ id: "d1", kind: "quote" }];
    const { onSaved } = renderDialog({ document: existing() });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateLead).toHaveBeenCalledWith(expect.objectContaining({ id: "lead1", value: 250_000 }));
    expect(state.calls.at(-1)).toMatchObject({ op: "update", values: { lead_id: "lead1" } });
  });

  it("blocks a duplicated document number", async () => {
    state.db.sales_documents = [{ id: "d1", kind: "quote" }, { id: "other", kind: "quote", document_number: "4521", issue_date: "2026-10-01" }];
    const { onSaved } = renderDialog({ document: existing() });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Já existe orçamento nº 4521 cadastrado."));
    expect(onSaved).not.toHaveBeenCalled();
    expect(state.calls.filter((c) => c.op === "update")).toEqual([]);
  });

  it("asks to fill by hand when the AI could not read the PDF", async () => {
    renderDialog({ document: existing({ aiStatus: "failed", aiError: "A leitura automática falhou (Incorrect API key).", clientName: null, totalValue: null }) });
    expect(screen.getByRole("alert")).toHaveTextContent("A leitura automática falhou (Incorrect API key). Preencha os campos.");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe o cliente.")).toBeInTheDocument();
    expect(screen.getByText("Informe o valor total.")).toBeInTheDocument();
  });
});
