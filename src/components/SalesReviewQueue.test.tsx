import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseMockState } from "@/test/supabaseMock";
import type { SalesDocument } from "@/lib/salesDocuments";

const state = vi.hoisted(() => ({ db: {}, calls: [] }) as SupabaseMockState);
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: createSupabaseMock(state) };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { SalesReviewQueue } from "./SalesReviewQueue";

const sellers = [{ id: "alex", name: "Alexandre Dantas", store_id: "ext", role: "vendedor" as const, leadsCount: 0, conversions: 0 }];
const doc = (o: Partial<SalesDocument>): SalesDocument => ({
  id: Math.random().toString(36), kind: "quote", sellerId: "alex", leadId: null, supportRequestId: null, storageBucket: "sales-documents",
  storagePath: "importacao/x.pdf", fileName: "PROPOSTA X.pdf", documentNumber: null, clientName: "ENAVAL", clientDocument: "02.445.332/0001-05",
  totalValue: 8596.62, issueDate: "2026-10-20", expectedCloseDate: null, installments: [], notes: null, aiStatus: "done", aiExtracted: null,
  aiError: null, createdAt: "", reviewStatus: "pending", suggestedSellerId: "alex", sellerMatch: "representante", extractedSellerName: "ALEXANDRE DANTAS",
  possibleDuplicateOf: null, fileHash: null, ...o,
});

beforeEach(() => { state.calls = []; state.db = { sales_documents: [] }; });
afterEach(cleanup);

const props = (documents: SalesDocument[], canConfirm = true) => ({
  documents, sellers, canConfirm, onChanged: vi.fn(), onEdit: vi.fn(), onOpenPdf: vi.fn(), onDelete: vi.fn(),
});

describe("SalesReviewQueue", () => {
  it("shows why the seller was suggested and flags duplicates and missing data", () => {
    const first = doc({ id: "d1", clientName: "CRIAT", fileName: "PROPOSTA CRIAT 28-10.pdf" });
    render(<SalesReviewQueue {...props([
      first,
      doc({ id: "d2", clientName: "CRIAT", possibleDuplicateOf: "d1" }),
      doc({ id: "d3", clientName: "Cliente Novo", sellerId: null, sellerMatch: "nenhum", issueDate: null }),
    ])} />);
    expect(screen.getAllByText("Vendedor sugerido pelo vendedor escrito no PDF (ALEXANDRE DANTAS)")).toHaveLength(2);
    expect(screen.getByText(/Possível duplicata de PROPOSTA CRIAT 28-10.pdf/)).toBeInTheDocument();
    expect(screen.getByText("Vendedor sugerido sem pista: escolha o vendedor")).toBeInTheDocument();
    expect(screen.getByText("Falta data")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar 2 prontos/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirmar Cliente Novo" })).toBeDisabled();
  });

  it("confirms a document with its seller", async () => {
    const p = props([doc({ id: "d1" })]);
    render(<SalesReviewQueue {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ENAVAL" }));
    await waitFor(() => expect(p.onChanged).toHaveBeenCalled());
    expect(state.calls).toEqual([{ table: "sales_documents", op: "update", values: { seller_id: "alex", review_status: "confirmed" }, filters: ["id=d1"] }]);
  });

  it("confirms every ready document at once", async () => {
    const p = props([doc({ id: "d1" }), doc({ id: "d2", clientName: "HAPO" }), doc({ id: "d3", sellerId: null, sellerMatch: "nenhum" })]);
    render(<SalesReviewQueue {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar 2 prontos/ }));
    await waitFor(() => expect(p.onChanged).toHaveBeenCalled());
    expect(state.calls.map((c) => c.filters)).toEqual([["id=d1"], ["id=d2"]]);
  });

  it("only lists for support, without confirming", () => {
    render(<SalesReviewQueue {...props([doc({ id: "d1" })], false)} />);
    expect(screen.getByText("O gestor da equipe externa ou o admin confirma estes documentos.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole("listitem")).getByText("Vendedor: Alexandre Dantas")).toBeInTheDocument();
  });
});
