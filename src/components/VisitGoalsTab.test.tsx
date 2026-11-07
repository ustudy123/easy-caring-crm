import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const upserts: { table: string; values: Row; onConflict?: string }[] = [];
const invokes: { fn: string; body: Row }[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => ({
    select: () => {
      const result = Promise.resolve({ data: db[table], error: null });
      return Object.assign(result, { order: () => Promise.resolve({ data: db[table], error: null }) });
    },
    upsert: (values: Row, opts?: { onConflict?: string }) => {
      upserts.push({ table, values, onConflict: opts?.onConflict });
      db[table] = [...db[table].filter((r) => r.seller_id !== values.seller_id), values];
      return Promise.resolve({ error: null });
    },
  });
  const functions = {
    invoke: (fn: string, { body }: { body: Row }) => {
      invokes.push({ fn, body });
      return Promise.resolve({ data: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" }, error: null });
    },
  };
  return { supabase: { from, functions } };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { VisitGoalsTab } from "./VisitGoalsTab";

const assign = vi.fn();
Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign, origin: "https://crm.example", pathname: "/admin" } });

const renderTab = () => render(<MemoryRouter><VisitGoalsTab /></MemoryRouter>);

beforeEach(() => {
  upserts.length = 0;
  invokes.length = 0;
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

const rowOf = (name: string) => screen.getByText(name).closest(".rounded-xl") as HTMLElement;

describe("VisitGoalsTab", () => {
  it("lists only active external-team sellers, with saved goals or the default", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText("Andinho")).toBeInTheDocument());
    expect(screen.queryByText("Pretinho")).not.toBeInTheDocument();
    expect(screen.queryByText("Raquel")).not.toBeInTheDocument();

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
    await waitFor(() => expect(screen.getByText("Andinho")).toBeInTheDocument());
    const row = within(rowOf("Andinho"));

    fireEvent.change(row.getByLabelText("Visitas realizadas / semana"), { target: { value: "12" } });
    expect(row.getByRole("alert")).toHaveTextContent("Realizadas não pode passar das planejadas.");
    expect(row.getByRole("button", { name: /Salvar/ })).toBeDisabled();

    fireEvent.change(row.getByLabelText("Visitas planejadas / semana"), { target: { value: "15" } });
    fireEvent.change(row.getByLabelText("Clientes novos / trimestre"), { target: { value: "4" } });
    fireEvent.click(row.getByRole("button", { name: /Salvar/ }));

    await waitFor(() => expect(upserts).toHaveLength(1));
    expect(upserts[0]).toEqual({
      table: "seller_goals",
      onConflict: "seller_id",
      values: { seller_id: "andinho", weekly_visits_planned: 15, weekly_visits_done: 12, quarterly_new_clients: 4 },
    });
  });

  it("shows each seller's Google Agenda status and starts the connection for the admin", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText("Andinho")).toBeInTheDocument());
    await waitFor(() => expect(within(rowOf("Bia")).getByText("Google Agenda: agenda.taeco@gmail.com")).toBeInTheDocument());
    expect(within(rowOf("Bia")).queryByRole("button", { name: /Conectar/ })).not.toBeInTheDocument();

    const andinho = within(rowOf("Andinho"));
    expect(andinho.getByText("Google Agenda: não conectado")).toBeInTheDocument();
    fireEvent.click(andinho.getByRole("button", { name: /Conectar/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?x=1"));
    expect(invokes).toEqual([{ fn: "google-calendar-auth", body: { action: "start", sellerId: "andinho", returnTo: "https://crm.example/admin" } }]);
  });
});
