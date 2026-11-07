import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const role = { isAdmin: true, isGerente: false, storeId: null as string | null, sellerId: null as string | null };
const rpcCalls: { fn: string; args: { _from: string; _to: string } }[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: { _from: string; _to: string }) => {
      rpcCalls.push({ fn, args });
      if (fn === "get_visit_progress") {
        return Promise.resolve({ data: [{ seller_id: "andinho", planned: 8, done: 5 }, { seller_id: "bia", planned: 3, done: 1 }], error: null });
      }
      return Promise.resolve({
        data: [{ seller_id: "bia", lead_id: "l1", client_name: "SERCON", client_phone: "21999990000", closed_at: "2026-10-20T15:00:00Z", value: 1500 }],
        error: null,
      });
    },
    from: () => ({
      select: () => Promise.resolve({
        data: [{ seller_id: "bia", weekly_visits_planned: 6, weekly_visits_done: 3, quarterly_new_clients: 2 }],
        error: null,
      }),
    }),
  },
}));
vi.mock("@/contexts/CrmContext", () => ({
  useCrm: () => ({
    sellers: [
      { id: "andinho", name: "Andinho", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0 },
      { id: "bia", name: "Bia", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0 },
      { id: "velho", name: "Pretinho", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0, isActive: false },
      { id: "raquel", name: "Raquel", store_id: "matriz", role: "vendedor", leadsCount: 0, conversions: 0 },
    ],
  }),
}));
vi.mock("@/contexts/RoleContext", () => ({ useRole: () => role }));
vi.mock("@/hooks/useExternalStores", () => ({ useExternalStores: () => new Set(["ext"]) }));

import { VisitRoutineReport } from "./VisitRoutineReport";

beforeEach(() => {
  rpcCalls.length = 0;
  Object.assign(role, { isAdmin: true, isGerente: false, storeId: null, sellerId: null });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 4, 12));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const cardOf = (name: string, index = 0) => screen.getAllByText(name)[index].closest(".rounded-2xl") as HTMLElement;

describe("VisitRoutineReport", () => {
  it("shows each active external seller against their own weekly goal", async () => {
    render(<VisitRoutineReport />);
    expect(screen.getByText("Semana de 02/11 a 08/11")).toBeInTheDocument();
    expect(screen.queryByText("Pretinho")).not.toBeInTheDocument();
    expect(screen.queryByText("Raquel")).not.toBeInTheDocument();

    await waitFor(() => expect(within(cardOf("Andinho")).getByText("Meta batida")).toBeInTheDocument());
    expect(within(cardOf("Andinho")).getByText("8 / 10")).toBeInTheDocument();
    const bia = within(cardOf("Bia"));
    expect(bia.getByText("3 / 6")).toBeInTheDocument();
    expect(bia.getByText("1 / 3")).toBeInTheDocument();
    expect(bia.getByText("Faltam 2")).toBeInTheDocument();
  });

  it("counts new clients of the quarter, with the client list and no-goal label", async () => {
    render(<VisitRoutineReport />);
    expect(screen.getByText("Clientes novos · 4º trimestre de 2026")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("SERCON")).toBeInTheDocument());
    const bia = within(cardOf("Bia", 1));
    expect(bia.getByText("1 / 2")).toBeInTheDocument();
    expect(within(cardOf("Andinho", 1)).getByText("Clientes novos (sem meta definida)")).toBeInTheDocument();
    const quarterCall = rpcCalls.find((c) => c.fn === "get_new_clients")!;
    expect(new Date(quarterCall.args._from)).toEqual(new Date(2026, 9, 1));
    expect(new Date(quarterCall.args._to)).toEqual(new Date(2027, 0, 1));
  });

  it("navigates weeks and marks a finished week that missed the goal", async () => {
    render(<VisitRoutineReport />);
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    expect(screen.getByText("Semana de 26/10 a 01/11")).toBeInTheDocument();
    await waitFor(() => expect(within(cardOf("Bia")).getByText("Ficaram faltando 2")).toBeInTheDocument());
    const last = rpcCalls.filter((c) => c.fn === "get_visit_progress").at(-1)!;
    expect(new Date(last.args._from)).toEqual(new Date(2026, 9, 26));
    fireEvent.click(screen.getByRole("button", { name: "Esta semana" }));
    expect(screen.getByText("Semana de 02/11 a 08/11")).toBeInTheDocument();
    await waitFor(() => expect(within(cardOf("Bia")).getByText("Faltam 2")).toBeInTheDocument());
  });

  it("shows only the seller themself for a seller login", async () => {
    Object.assign(role, { isAdmin: false, isGerente: false, storeId: "ext", sellerId: "bia" });
    render(<VisitRoutineReport />);
    expect(screen.getAllByText("Bia").length).toBeGreaterThan(0);
    expect(screen.queryByText("Andinho")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("SERCON")).toBeInTheDocument());
  });
});
