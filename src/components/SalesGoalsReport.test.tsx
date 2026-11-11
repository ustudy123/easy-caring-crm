import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseMockState } from "@/test/supabaseMock";

const state = vi.hoisted(() => ({ db: {}, calls: [] }) as SupabaseMockState);
const role = vi.hoisted(() => ({ isAdmin: true, isGerente: false, storeId: null as string | null, sellerId: null as string | null, sellerName: null as string | null }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: createSupabaseMock(state) };
});
vi.mock("@/contexts/CrmContext", () => ({
  useCrm: () => ({
    sellers: [
      { id: "ana", name: "Ana", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0 },
      { id: "bia", name: "Bia", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0 },
    ],
  }),
  mapLeadFromDb: (r: Record<string, unknown>) => ({ id: r.id, assignedTo: r.assigned_to, notes: r.notes }),
}));
vi.mock("@/contexts/RoleContext", () => ({ useRole: () => role }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "andre@taeco.com.br" } }) }));
vi.mock("@/hooks/useExternalStores", () => ({ useExternalStores: () => new Set(["ext"]) }));
vi.mock("@/lib/qualification", () => ({
  qualificationProgress: (l: { notes: string }) => (l.notes === "completo" ? { done: 6, total: 6 } : { done: 2, total: 6 }),
}));
vi.mock("sonner", () => ({ toast }));

import { SalesGoalsReport } from "./SalesGoalsReport";

const doc = (o: Record<string, unknown>) => ({
  id: Math.random().toString(36), kind: "quote", seller_id: "ana", lead_id: null, support_request_id: null, storage_bucket: "sales-documents",
  storage_path: "x", file_name: "x.pdf", document_number: null, client_name: "Cliente", client_document: null, total_value: 0,
  issue_date: "2026-11-03", expected_close_date: null, installments: [], notes: null, ai_status: "done", ai_extracted: null, ai_error: null,
  created_at: "2026-11-03T12:00:00Z", review_status: "confirmed", ...o,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 7, 12));
  Object.assign(role, { isAdmin: true, isGerente: false, storeId: null, sellerId: null, sellerName: null });
  Object.values(toast).forEach((f) => f.mockReset());
  state.calls = [];
  state.db = {
    monthly_goals: [{ month: "2026-11-01", seller_id: "ana", quote_goal: 2_000_000, sales_goal: 500_000 }],
    month_business_days: [{ month: "2026-11-01", business_days: 20 }],
    store_holidays: [],
    seller_goals: [{ seller_id: "ana", weekly_visits_planned: 10, weekly_visits_done: 5, quarterly_new_clients: 3 }],
    sales_documents: [
      doc({ client_name: "SERCON", total_value: 600_000, expected_close_date: "2026-11-20" }),
      doc({ client_name: "Estaleiro", total_value: 400_000, issue_date: "2026-11-07" }),
      doc({ kind: "invoice", client_name: "SERCON", total_value: 200_000, issue_date: "2026-11-05" }),
    ],
  };
  state.rpc = {
    get_closed_sales: () => [{ id: "l1", assigned_to: "ana", notes: "completo" }, { id: "l2", assigned_to: "ana", notes: "" }],
    get_new_clients: () => [{ seller_id: "ana", lead_id: "l1", client_name: "SERCON", client_phone: "1", closed_at: "2026-11-05", value: 1 }],
  };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const cardOf = (name: string) => screen.getAllByText(name).map((el) => el.closest(".rounded-2xl")).find(Boolean) as HTMLElement;

describe("SalesGoalsReport", () => {
  it("shows quoted and sold against the goal with the daily target", async () => {
    render(<SalesGoalsReport />);
    expect(await screen.findByText("R$ 1 mi / R$ 2 mi (50%)")).toBeInTheDocument();
    const ana = within(cardOf("Ana"));
    expect(ana.getByText(/Meta do dia R\$\s100\.000,00 · hoje R\$\s400\.000,00 · até hoje deveria R\$\s500\.000,00/)).toBeInTheDocument();
    expect(ana.getByText("R$ 200 mil / R$ 500 mil (40%)")).toBeInTheDocument();
    expect(ana.getByText("20%")).toBeInTheDocument();
    expect(ana.getByText("1 orçamento sem previsão de fechamento")).toBeInTheDocument();
    expect(screen.getByText("20 dias úteis · 5 até hoje")).toBeInTheDocument();
    await waitFor(() => expect(ana.getByText("1 de 2 vendas")).toBeInTheDocument());
    expect(ana.getByText("1 / 3")).toBeInTheDocument();
    expect(within(cardOf("Bia")).getAllByText(/Sem meta de/)).toHaveLength(2);
  });

  it("lists the month's quotes by expected closing month", async () => {
    render(<SalesGoalsReport />);
    expect(await screen.findByText("nov/26: R$ 600 mil (1)")).toBeInTheDocument();
    expect(screen.getByText("Sem previsão: R$ 400 mil (1)")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("watermarks with the viewer, blocks printing and lets only managers export", async () => {
    render(<SalesGoalsReport />);
    await screen.findByText("R$ 1 mi / R$ 2 mi (50%)");
    expect(screen.getByTestId("watermark").dataset.text).toMatch(/^andre@taeco\.com\.br · 07\/11\/2026/);
    expect(screen.getByRole("button", { name: /Exportar/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    expect(toast.error).toHaveBeenCalledWith("A impressão deste painel está bloqueada.");
    cleanup();

    Object.assign(role, { isAdmin: false, isGerente: false, storeId: "ext", sellerId: "ana", sellerName: "Ana" });
    render(<SalesGoalsReport />);
    await screen.findByText("R$ 1 mi / R$ 2 mi (50%)");
    expect(screen.queryByRole("button", { name: /Exportar/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Bia")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getByTestId("watermark").dataset.text).toMatch(/^Ana · andre@taeco\.com\.br/);
  });
});
