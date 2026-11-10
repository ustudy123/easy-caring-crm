import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseMockState } from "@/test/supabaseMock";
import { fileSha256 } from "@/lib/salesDocuments";

const state = vi.hoisted(() => ({ db: {}, calls: [], invokes: [], storage: [] }) as SupabaseMockState);
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: createSupabaseMock(state) };
});

import { BulkImportDialog } from "./BulkImportDialog";

const pdf = (name: string, body: string) => new File([`%PDF-1.4 ${body}`], name, { type: "application/pdf" });

beforeEach(() => { state.calls = []; state.invokes = []; state.storage = []; state.invoke = () => ({ ok: true }); });
afterEach(cleanup);

describe("BulkImportDialog", () => {
  it("uploads each PDF without a seller, reads it with AI and skips files sent before", async () => {
    const repeated = pdf("PROPOSTA APEX (1).pdf", "apex");
    state.db = { sales_documents: [{ id: "old", file_hash: await fileSha256(repeated) }] };
    const onDone = vi.fn();
    render(<BulkImportDialog open onOpenChange={vi.fn()} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Orçamentos" }));
    fireEvent.change(screen.getByLabelText("Arquivos PDF"), {
      target: { files: [pdf("PROPOSTA ENAVAL.pdf", "enaval"), repeated, new File(["x"], "foto.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(screen.getByText("1 de 3 lidos. Confira em “A confirmar”.")).toBeInTheDocument();
    expect(screen.getByText("Já enviado antes")).toBeInTheDocument();
    expect(screen.getByText("Falhou: não é PDF")).toBeInTheDocument();
    const inserts = state.calls.filter((c) => c.op === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values).toMatchObject({ kind: "quote", seller_id: null, file_name: "PROPOSTA ENAVAL.pdf" });
    expect(state.storage![0].path).toMatch(/^importacao\/[0-9a-f-]{36}\.pdf$/);
    expect(state.invokes).toEqual([{ fn: "sales-document-extract", body: { documentId: (inserts[0].values as { id: string }).id } }]);
  });
});
