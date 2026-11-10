import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseMockState } from "@/test/supabaseMock";

const state = vi.hoisted(() => ({ db: {}, calls: [], storage: [] }) as SupabaseMockState);
const role = vi.hoisted(() => ({
  isAdmin: false, isGerente: false, isVendedor: true, isSuporte: false, storeId: "ext" as string | null, sellerId: "ana" as string | null, sellerName: "Ana" as string | null,
}));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: createSupabaseMock(state) };
});
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/CrmContext", () => ({
  useCrm: () => ({
    sellers: [
      { id: "ana", name: "Ana", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0 },
      { id: "bia", name: "Bia", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0 },
    ],
    leads: [],
    updateLead: vi.fn(),
  }),
  mapLeadFromDb: (r: unknown) => r,
}));
vi.mock("@/contexts/RoleContext", () => ({ useRole: () => role }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "ana@taeco.com.br" } }) }));
vi.mock("@/hooks/useExternalStores", () => ({ useExternalStores: () => new Set(["ext"]) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import SalesDocuments from "./SalesDocuments";

const doc = (o: Record<string, unknown>) => ({
  id: Math.random().toString(36), kind: "quote", seller_id: "ana", lead_id: null, support_request_id: null, storage_bucket: "sales-documents",
  storage_path: "ana/x.pdf", file_name: "x.pdf", document_number: null, client_name: "Cliente", client_document: null, total_value: 1000,
  issue_date: "2026-11-03", expected_close_date: "2026-11-20", installments: [], notes: null, ai_status: "done", ai_extracted: null, ai_error: null,
  created_at: "2026-11-03T12:00:00Z", review_status: "confirmed", ...o,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 7, 12));
  Object.assign(role, { isAdmin: false, isGerente: false, isVendedor: true, isSuporte: false, storeId: "ext", sellerId: "ana", sellerName: "Ana" });
  state.calls = [];
  state.db = {
    monthly_goals: [], month_business_days: [], store_holidays: [], seller_goals: [],
    sales_documents: [
      doc({ client_name: "SERCON", document_number: "4521" }),
      doc({ client_name: "Cliente via suporte", expected_close_date: null, support_request_id: "r1", storage_bucket: "pricing_attachments" }),
      doc({ kind: "invoice", client_name: "Nota SERCON", installments: [{ number: 1, value: 500, due_date: "2026-12-03" }, { number: 2, value: 500, due_date: "2027-01-03" }] }),
      doc({ seller_id: "bia", client_name: "Da Bia" }),
    ],
  };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("SalesDocuments", () => {
  it("shows the seller only their documents, flags missing closing dates and hides export", async () => {
    render(<SalesDocuments />);
    expect(await screen.findByText("SERCON")).toBeInTheDocument();
    expect(screen.queryByText("Da Bia")).not.toBeInTheDocument();
    expect(screen.getByText("Metas e orçamentos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exportar/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Todos os vendedores")).not.toBeInTheDocument();

    const banner = screen.getByRole("button", { name: /1 orçamento sem previsão de fechamento/ });
    fireEvent.click(banner);
    expect(screen.queryByText("SERCON")).not.toBeInTheDocument();
    const item = screen.getByText("Cliente via suporte").closest("li") as HTMLElement;
    expect(within(item).getByText("Sem previsão")).toBeInTheDocument();
    expect(within(item).getByText("Do suporte")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Notas fiscais \(1\)/ }));
    expect(screen.getByText("2 parcelas")).toBeInTheDocument();
  });

  it("lets support handle every seller's documents without the goals panel", async () => {
    Object.assign(role, { isAdmin: false, isGerente: false, isVendedor: false, isSuporte: true, storeId: null, sellerId: null, sellerName: null });
    render(<SalesDocuments />);
    expect(await screen.findByText("Da Bia")).toBeInTheDocument();
    expect(screen.queryByText("Metas e orçamentos")).not.toBeInTheDocument();
    expect(screen.getByText("Todos os vendedores")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exportar/ })).not.toBeInTheDocument();
  });

  it("lets managers export the list", async () => {
    Object.assign(role, { isAdmin: true, isGerente: false, isVendedor: false, isSuporte: false, storeId: null, sellerId: null, sellerName: null });
    render(<SalesDocuments />);
    expect(await screen.findByText("Da Bia")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Exportar/ }).length).toBeGreaterThan(0);
  });
});
