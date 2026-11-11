import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "@/types/crm";

const lead = (o: Partial<Lead>): Lead => ({
  id: Math.random().toString(36), clientName: "X", clientPhone: "5522999990000", stage: "sondagem", value: 0,
  assignedTo: "andinho", source: "whatsapp", tags: [], notes: "", createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", ...o,
});
const leads = [
  lead({ clientName: "Sem ação" }),
  lead({ clientName: "Atrasado", nextAction: "ligacao", nextActionAt: "2026-11-03T12:00:00Z" }),
  lead({ clientName: "Em dia", nextAction: "visita", nextActionAt: "2026-11-09T12:00:00Z" }),
  lead({ clientName: "Fechado", stage: "pos_venda" }),
  lead({ clientName: "Balcão", assignedTo: "raquel" }),
];
vi.mock("@/contexts/CrmContext", () => ({
  useCrm: () => ({
    leads,
    sellers: [
      { id: "andinho", name: "Andinho", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0 },
      { id: "raquel", name: "Raquel", store_id: "matriz", role: "vendedor", leadsCount: 0, conversions: 0 },
    ],
  }),
}));
vi.mock("@/contexts/RoleContext", () => ({ useRole: () => ({ isAdmin: true, isGerente: false, storeId: null }) }));
vi.mock("@/hooks/useExternalStores", () => ({ useExternalStores: () => new Set(["ext"]) }));

import { NextActionReport } from "./NextActionReport";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-04T12:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const clients = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent);

describe("NextActionReport", () => {
  it("lists only open external-team opportunities without next action or overdue", () => {
    render(<NextActionReport />);
    expect(clients().sort()).toEqual(["Atrasado", "Sem ação"]);
    expect(screen.getByRole("button", { name: "Sem próxima ação (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atrasadas (1)" })).toBeInTheDocument();
  });

  it("filters by situation", () => {
    render(<NextActionReport />);
    fireEvent.click(screen.getByRole("button", { name: "Atrasadas (1)" }));
    expect(clients()).toEqual(["Atrasado"]);
  });
});
