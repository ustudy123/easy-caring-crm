import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { GoogleConnection } from "@/hooks/useGoogleCalendar";

const invokes: { fn: string; body: Record<string, unknown> }[] = [];
let reply: Record<string, unknown> = {};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (fn: string, { body }: { body: Record<string, unknown> }) => {
        invokes.push({ fn, body });
        return Promise.resolve({ data: reply, error: null });
      },
    },
  },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { GoogleCalendarCard, useGoogleReturn } from "./GoogleCalendarConnect";

const conn = (o: Partial<GoogleConnection> = {}): GoogleConnection => ({
  sellerId: "ana", googleEmail: "agenda.taeco@gmail.com", status: "active", lastError: null,
  lastSyncedAt: new Date().toISOString(), connectedAt: "2026-11-07T10:00:00Z", ...o,
});

beforeEach(() => {
  invokes.length = 0;
  reply = {};
  Object.values(toast).forEach((f) => f.mockReset());
});
afterEach(cleanup);

describe("GoogleCalendarCard", () => {
  it("explains the separate calendar before connecting", () => {
    render(<GoogleCalendarCard sellerId="ana" onChanged={vi.fn()} />);
    expect(screen.getByText(/agenda separada, “CRM Taeco”/)).toBeInTheDocument();
    expect(screen.getByText(/Compromissos pessoais das outras agendas não entram no CRM/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar Google Agenda" })).toBeInTheDocument();
  });

  it("syncs on demand and reloads the status", async () => {
    reply = { synced: 1, results: [{ status: "active", pushed: 2, removed: 0, pulled: {} }] };
    const onChanged = vi.fn();
    render(<GoogleCalendarCard sellerId="ana" connection={conn()} onChanged={onChanged} />);
    expect(screen.getByText(/Conectado: agenda.taeco@gmail.com · atualizado hoje às/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sincronizar agora/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(invokes).toEqual([{ fn: "google-calendar-sync", body: { sellerId: "ana" } }]);
    expect(toast.success).toHaveBeenCalledWith("Agenda sincronizada com o Google.");
  });

  it("asks for confirmation before disconnecting", async () => {
    reply = { ok: true };
    const onChanged = vi.fn();
    render(<GoogleCalendarCard sellerId="ana" connection={conn()} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: /Desconectar/ }));
    expect(invokes).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar desconexão/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(invokes).toEqual([{ fn: "google-calendar-auth", body: { action: "disconnect", sellerId: "ana" } }]);
  });

  it("shows the error and offers reconnecting when access was revoked", () => {
    render(<GoogleCalendarCard sellerId="ana" connection={conn({ status: "revoked", lastError: "A autorização do Google expirou." })} onChanged={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("A autorização do Google expirou.");
    expect(screen.getByRole("button", { name: /Conectar de novo/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sincronizar agora/ })).not.toBeInTheDocument();
  });
});

describe("useGoogleReturn", () => {
  function Probe({ onDone }: { onDone: () => void }) {
    useGoogleReturn(onDone);
    const loc = useLocation();
    return <p data-testid="search">{loc.search}</p>;
  }

  it("confirms the connection, runs the first sync and cleans the address", async () => {
    reply = { synced: 1, results: [] };
    const onDone = vi.fn();
    render(<MemoryRouter initialEntries={["/agenda?google=conectado&vendedor=ana&x=1"]}><Probe onDone={onDone} /></MemoryRouter>);
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Google Agenda conectado/));
    expect(invokes).toEqual([{ fn: "google-calendar-sync", body: { sellerId: "ana" } }]);
    expect(screen.getByTestId("search")).toHaveTextContent(/^\?x=1$/);
  });

  it("explains a cancelled connection without syncing", async () => {
    const onDone = vi.fn();
    render(<MemoryRouter initialEntries={["/agenda?google=cancelado&vendedor=ana"]}><Probe onDone={onDone} /></MemoryRouter>);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith("A conexão com o Google foi cancelada.");
    expect(invokes).toEqual([]);
  });
});
