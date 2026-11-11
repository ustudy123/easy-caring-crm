import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseMockState } from "@/test/supabaseMock";
import type { Lead } from "@/types/crm";

const state = vi.hoisted(() => ({ db: {}, calls: [] }) as SupabaseMockState);
const crm = vi.hoisted(() => ({ leads: [] as Lead[] }));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      ...createSupabaseMock(state),
      auth: { getUser: async () => ({ data: { user: { id: "u-admin" } } }) },
      channel: () => channel,
      removeChannel: () => {},
    },
  };
});
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/CrmContext", () => ({
  useCrm: () => ({
    leads: crm.leads, setLeads: vi.fn(), addLead: vi.fn(), updateLead: vi.fn(), deleteLead: vi.fn(), loading: false,
    sellers: [{ id: "s1", name: "Alexandre Dantas", store_id: "loja1", is_active: true }],
    addFollowUp: vi.fn(),
    alertTimesFor: () => ({ sellerMinutes: 30, managerMinutes: 60, adminMinutes: 90 }),
  }),
}));
vi.mock("@/contexts/RoleContext", () => ({ useRole: () => ({ storeId: null, isGerente: false, isAdmin: true }) }));
vi.mock("@/hooks/useInstances", () => ({ useInstances: () => ({ byId: {} }), useClientInstanceMap: () => ({}) }));
vi.mock("@/hooks/useExternalStores", () => ({ useExternalStores: () => new Set<string>() }));

import Kanban from "./Kanban";

const lead = (o: Partial<Lead>): Lead => ({
  id: "l1", clientName: "RR Fênix Nicholas", clientPhone: "5521993206917", stage: "sondagem", value: 0, assignedTo: "s1",
  source: "indicacao", tags: [], notes: "", createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", ...o,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
  state.db = { stores: [], sellers: [], pricing_requests: [] };
  state.calls = [];
  try { localStorage.clear(); } catch { /* sem armazenamento */ }
  crm.leads = [
    lead({ companyWorkSite: "RR Fenix", clientEmail: "compras@rrfenix.com.br", interestProducts: "Jotamastic 90" }),
    lead({ id: "l2", clientName: "Tiago - Raiteco", clientPhone: "553284817913", stage: "sondagem", updatedAt: "2026-11-11T11:55:00Z", value: 6484 }),
  ];
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const renderPage = () => render(<MemoryRouter><Kanban /></MemoryRouter>);

describe("Kanban cards", () => {
  it("renders the compact card with urgency, value and column alert count", async () => {
    renderPage();
    const card = (await screen.findByText("RR Fênix Nicholas")).closest("[data-urgency]") as HTMLElement;
    expect(card).toHaveAttribute("data-urgency", "critical");
    expect(within(card).getByTitle(/^Grave: \+1h30/)).toBeInTheDocument();
    expect(within(card).queryByText("(21) 99320-6917")).toBeNull();
    const other = screen.getByText("Tiago - Raiteco").closest("[data-urgency]") as HTMLElement;
    expect(other).toHaveAttribute("data-urgency", "ok");
    expect(within(other).getByText(/R\$\s?6\.484/)).toBeInTheDocument();
    expect(screen.getByTitle("1 em alerta de atendimento")).toBeInTheDocument();
  });

  it("switches to detailed cards and remembers the choice", async () => {
    renderPage();
    await screen.findByText("RR Fênix Nicholas");
    fireEvent.click(screen.getByRole("button", { name: /Detalhado/ }));
    const card = screen.getByText("RR Fênix Nicholas").closest("[data-urgency]") as HTMLElement;
    expect(within(card).getByText("(21) 99320-6917")).toBeInTheDocument();
    expect(within(card).getByText("compras@rrfenix.com.br")).toBeInTheDocument();
    expect(within(card).getByText("Jotamastic 90")).toBeInTheDocument();
    expect(within(card).getByText("Origem: Indicação")).toBeInTheDocument();
    expect(localStorage.getItem("kanban.cardDensity")).toBe("detailed");

    cleanup();
    renderPage();
    await screen.findByText("RR Fênix Nicholas");
    expect(screen.getByRole("button", { name: /Detalhado/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Compacto/ }));
    expect(screen.queryByText("compras@rrfenix.com.br")).toBeNull();
  });
});
