import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { SupabaseMockState } from "@/test/supabaseMock";

const state = vi.hoisted(() => ({
  db: {}, calls: [], invokes: [],
  invoke: () => ({ url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" }),
}) as SupabaseMockState);
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: createSupabaseMock(state) };
});
vi.mock("@/hooks/useExternalStores", () => ({ useExternalStores: () => new Set(["ext"]) }));
const db = state.db;
const upserts = { get length() { return state.calls.filter((c) => c.op === "upsert" && c.table === "seller_goals").length; } };
const sellerGoalUpserts = () => state.calls.filter((c) => c.op === "upsert" && c.table === "seller_goals");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { VisitGoalsTab } from "./VisitGoalsTab";

const assign = vi.fn();
Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign, origin: "https://crm.example", pathname: "/admin" } });

const renderTab = () => render(<MemoryRouter><VisitGoalsTab /></MemoryRouter>);

beforeEach(() => {
  state.calls.length = 0;
  state.invokes!.length = 0;
  db.monthly_goals = [];
  db.month_business_days = [];
  db.store_holidays = [];
  assign.mockReset();
  db.google_calendar_connections = [
    { seller_id: "bia", google_email: "agenda.taeco@gmail.com", status: "active", last_error: null, last_synced_at: null, connected_at: "2026-11-07T10:00:00Z" },
  ];
  db.stores = [
    { id: "matriz", name: "Matriz", is_external_team: false },
    { id: "ext", name: "Vendedor Externo", is_external_team: true },
  ];
  db.sellers = [
    { id: "andinho", name: "Andinho", store_id: "ext", is_active: true, status: "active" },
    { id: "bia", name: "Bia", store_id: "ext", is_active: true, status: "active" },
    { id: "velho", name: "Pretinho", store_id: "ext", is_active: false, status: "inactive" },
    { id: "raquel", name: "Raquel", store_id: "matriz", is_active: true, status: "active" },
  ];
  db.seller_goals = [{ seller_id: "bia", weekly_visits_planned: 8, weekly_visits_done: 4, quarterly_new_clients: 3 }];
});
afterEach(cleanup);

// Os nomes também aparecem no quadro de metas do mês: procura no cartão de visitas.
const visitsCard = () => screen.getByText("Visitas e clientes novos").closest(".rounded-lg") as HTMLElement;
const rowOf = (name: string) => within(visitsCard()).getByText(name).closest(".rounded-xl") as HTMLElement;

describe("VisitGoalsTab", () => {
  it("lists only active external-team sellers, with saved goals or the default", async () => {
    renderTab();
    await waitFor(() => expect(within(visitsCard()).getByText("Andinho")).toBeInTheDocument());
    expect(screen.queryByText("Pretinho")).not.toBeInTheDocument();
    expect(screen.queryByText("Raquel")).not.toBeInTheDocument();
    expect(screen.getByText("Metas do mês: orçamentos e vendas")).toBeInTheDocument();

    const andinho = within(rowOf("Andinho"));
    expect(andinho.getByLabelText("Visitas planejadas / semana")).toHaveValue(10);
    expect(andinho.getByLabelText("Visitas realizadas / semana")).toHaveValue(5);
    expect(andinho.getByLabelText("Clientes novos / trimestre")).toHaveValue(null);
    expect(andinho.getByText(/usando o padrão/)).toBeInTheDocument();

    const bia = within(rowOf("Bia"));
    expect(bia.getByLabelText("Visitas planejadas / semana")).toHaveValue(8);
    expect(bia.getByLabelText("Clientes novos / trimestre")).toHaveValue(3);
    expect(bia.getByRole("button", { name: /Salvar/ })).toBeDisabled();
  });

  it("blocks done above planned and saves a per-seller goal", async () => {
    renderTab();
    await waitFor(() => expect(within(visitsCard()).getByText("Andinho")).toBeInTheDocument());
    const row = within(rowOf("Andinho"));

    fireEvent.change(row.getByLabelText("Visitas realizadas / semana"), { target: { value: "12" } });
    expect(row.getByRole("alert")).toHaveTextContent("Realizadas não pode passar das planejadas.");
    expect(row.getByRole("button", { name: /Salvar/ })).toBeDisabled();

    fireEvent.change(row.getByLabelText("Visitas planejadas / semana"), { target: { value: "15" } });
    fireEvent.change(row.getByLabelText("Clientes novos / trimestre"), { target: { value: "4" } });
    fireEvent.click(row.getByRole("button", { name: /Salvar/ }));

    await waitFor(() => expect(upserts).toHaveLength(1));
    expect(sellerGoalUpserts()[0]).toEqual({
      table: "seller_goals",
      op: "upsert",
      onConflict: "seller_id",
      values: { seller_id: "andinho", weekly_visits_planned: 15, weekly_visits_done: 12, quarterly_new_clients: 4 },
    });
  });

  it("shows each seller's Google Agenda status and starts the connection for the admin", async () => {
    renderTab();
    await waitFor(() => expect(within(visitsCard()).getByText("Andinho")).toBeInTheDocument());
    await waitFor(() => expect(within(rowOf("Bia")).getByText("Google Agenda: agenda.taeco@gmail.com")).toBeInTheDocument());
    expect(within(rowOf("Bia")).queryByRole("button", { name: /Conectar/ })).not.toBeInTheDocument();

    const andinho = within(rowOf("Andinho"));
    expect(andinho.getByText("Google Agenda: não conectado")).toBeInTheDocument();
    fireEvent.click(andinho.getByRole("button", { name: /Conectar/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?x=1"));
    expect(state.invokes).toEqual([{ fn: "google-calendar-auth", body: { action: "start", sellerId: "andinho", returnTo: "https://crm.example/admin" } }]);
  });
});
