import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Banco em memória para o supabase.from(...) usado pela aba.
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const calls: { table: string; op: string; values?: Row; id?: string }[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => ({
    select: () => {
      const result = Promise.resolve({ data: db[table], error: null });
      return Object.assign(result, { order: () => Promise.resolve({ data: db[table], error: null }) });
    },
    insert: (values: Row) => {
      calls.push({ table, op: "insert", values });
      db[table].push({ id: `new-${calls.length}`, store_id: null, seller_id: null, ...values });
      return Promise.resolve({ error: null });
    },
    update: (values: Row) => ({
      eq: (_c: string, id: string) => {
        calls.push({ table, op: "update", values, id });
        db[table] = db[table].map((r) => (r.id === id ? { ...r, ...values } : r));
        return Promise.resolve({ error: null });
      },
    }),
    delete: () => ({
      eq: (_c: string, id: string) => {
        calls.push({ table, op: "delete", id });
        db[table] = db[table].filter((r) => r.id !== id);
        return Promise.resolve({ error: null });
      },
    }),
  });
  return { supabase: { from } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "admin-1" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AlertTimesTab } from "./AlertTimesTab";

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

beforeEach(() => {
  calls.length = 0;
  db.alert_time_settings = [{ id: "g", store_id: null, seller_id: null, seller_minutes: 30, manager_minutes: 60, admin_minutes: 90 }];
  db.stores = [
    { id: "matriz", name: "Matriz", is_external_team: false },
    { id: "ext", name: "Vendedor Externo", is_external_team: true },
  ];
  db.sellers = [
    { id: "andinho", name: "Andinho", store_id: "ext", is_active: true, status: "active" },
    { id: "velho", name: "Pretinho", store_id: "ext", is_active: false, status: "inactive" },
  ];
});
afterEach(cleanup);

const rowOf = (title: string) => screen.getAllByText(title).map((el) => el.closest(".rounded-xl") as HTMLElement).find(Boolean)!;

describe("AlertTimesTab", () => {
  it("shows the stores inheriting the global default", async () => {
    render(<AlertTimesTab />);
    const store = within(await waitFor(() => rowOf("Matriz")));
    expect(store.getByText("Usa: Padrão geral")).toBeInTheDocument();
    expect(store.getByLabelText("Matriz — Vendedor (minutos)")).toHaveValue(30);
    expect(store.getByLabelText("Matriz — Vendedor (minutos)")).toBeDisabled();
  });

  it("saves longer times for the external team store", async () => {
    render(<AlertTimesTab />);
    const store = within(await waitFor(() => rowOf("Vendedor Externo")));
    fireEvent.click(store.getByRole("button", { name: "Personalizar" }));
    fireEvent.change(store.getByLabelText("Vendedor Externo — Vendedor (minutos)"), { target: { value: "120" } });
    fireEvent.change(store.getByLabelText("Vendedor Externo — Gerente (minutos)"), { target: { value: "240" } });
    fireEvent.change(store.getByLabelText("Vendedor Externo — Gestão (minutos)"), { target: { value: "480" } });
    expect(store.getByText(/2 horas · avisa o vendedor/)).toBeInTheDocument();
    fireEvent.click(store.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(calls).toContainEqual(expect.objectContaining({
      op: "insert",
      values: expect.objectContaining({ store_id: "ext", seller_minutes: 120, manager_minutes: 240, admin_minutes: 480, updated_by: "admin-1" }),
    })));
  });

  it("blocks saving times out of order", async () => {
    render(<AlertTimesTab />);
    const global = within(await waitFor(() => rowOf("Padrão geral")));
    fireEvent.change(global.getByLabelText("Padrão geral — Gerente (minutos)"), { target: { value: "20" } });
    expect(global.getByRole("alert")).toHaveTextContent("vendedor < gerente < gestão");
    expect(global.getByRole("button", { name: /Salvar/ })).toBeDisabled();
  });

  it("lists only active sellers for exceptions, starting with the external team", async () => {
    render(<AlertTimesTab />);
    await waitFor(() => expect(screen.getByText("Andinho")).toBeInTheDocument());
    expect(screen.queryByText("Pretinho")).toBeNull();
  });

  it("a store with its own times can go back to the default", async () => {
    db.alert_time_settings.push({ id: "s1", store_id: "matriz", seller_id: null, seller_minutes: 45, manager_minutes: 90, admin_minutes: 135 });
    render(<AlertTimesTab />);
    const store = within(await waitFor(() => rowOf("Matriz")));
    expect(store.getByText("Personalizado")).toBeInTheDocument();
    fireEvent.click(store.getByRole("button", { name: /Usar padrão geral/ }));
    await waitFor(() => expect(calls).toContainEqual({ table: "alert_time_settings", op: "delete", id: "s1" }));
  });
});
