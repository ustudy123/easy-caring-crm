import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseMockState } from "@/test/supabaseMock";
import type { Client } from "@/types/crm";

const state = vi.hoisted(() => ({ db: {}, calls: [] }) as SupabaseMockState);
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: createSupabaseMock(state) };
});
vi.mock("@/contexts/CrmContext", () => ({
  useCrm: () => ({ sellers: [{ id: "ana", name: "Ana", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0 }] }),
  mapLeadFromDb: (r: Record<string, unknown>) => ({
    id: r.id, clientName: "SERCON", clientPhone: "1", stage: r.stage, value: r.value, assignedTo: r.assigned_to, closedAt: r.closed_at,
    lostReason: r.lost_reason, createdAt: r.created_at, tags: [], notes: "", companyWorkSite: r.company_work_site, qualification: {},
  }),
}));

import { ClientInsightsPanel } from "./ClientInsightsPanel";

const client = { id: "c1", name: "SERCON", phone: "21999990001", tags: [], totalPurchases: 0, createdAt: "2026-01-01", purchaseCount: 2, clientType: "recorrente" } as Client;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
  state.rpc = {
    get_client_leads: () => [
      { id: "l1", stage: "pos_venda", value: 10000, assigned_to: "ana", closed_at: "2026-10-20T12:00:00Z", created_at: "2026-10-01T12:00:00Z", company_work_site: "Estaleiro Mauá" },
      { id: "l2", stage: "pos_venda", value: 6000, assigned_to: "ana", closed_at: "2026-06-01T12:00:00Z", created_at: "2026-05-01T12:00:00Z" },
      { id: "l3", stage: "perdido", value: 500, assigned_to: "ana", closed_at: "2026-09-01T12:00:00Z", lost_reason: "Preço", created_at: "2026-08-01T12:00:00Z" },
    ],
    get_client_invoices: () => [],
  };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("ClientInsightsPanel", () => {
  it("shows why the client is recurring, funnel passes and sales by period", async () => {
    render(<ClientInsightsPanel client={client} />);
    expect(await screen.findByText("Marcado como cliente recorrente no encerramento da venda (pós-venda).")).toBeInTheDocument();
    expect(screen.getByText("2 vezes até a venda")).toBeInTheDocument();
    expect(screen.getByText("3 oportunidades · 1 perdida · 0 em aberto")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s16\.000,00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "3 meses" }));
    await waitFor(() => expect(screen.getByText(/R\$\s10\.000,00/, { selector: "p.text-primary" })).toBeInTheDocument());
    expect(screen.getByText("Empresa / obra:")).toBeInTheDocument();
    expect(screen.getByText(/Preço/)).toBeInTheDocument();
  });
});
