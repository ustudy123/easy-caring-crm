import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeadCardSummary } from "./LeadCardSummary";
import type { Lead } from "@/types/crm";

const base: Lead = {
  id: "l1", clientName: "SERCON", clientPhone: "5522999990000", stage: "sondagem", value: 0, assignedTo: "andinho",
  source: "whatsapp", tags: [], notes: "", createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z",
};

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-04T12:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("LeadCardSummary", () => {
  it("highlights an open opportunity without next action", () => {
    render(<LeadCardSummary lead={base} onOpenQualification={() => {}} />);
    expect(screen.getByRole("button", { name: "Qualificação 0/6" })).toBeInTheDocument();
    expect(screen.getByText("Sem contato")).toBeInTheDocument();
    expect(screen.getByText("Sem próxima ação")).toBeInTheDocument();
  });

  it("shows the scheduled next action and the last contact", () => {
    render(<LeadCardSummary lead={{ ...base, lastContactAt: "2026-11-03T15:00:00Z", nextAction: "visita", nextActionAt: "2026-11-06T17:00:00Z" }} />);
    expect(screen.getByText(/Contato em 03\/11/)).toBeInTheDocument();
    expect(screen.getByText(/^Visita presencial · 06\/11/)).toBeInTheDocument();
  });

  it("marks an overdue next action", () => {
    render(<LeadCardSummary lead={{ ...base, nextAction: "ligacao", nextActionAt: "2026-11-02T13:00:00Z" }} />);
    expect(screen.getByText(/^Atrasada: Ligação/)).toBeInTheDocument();
  });

  it("does not ask for a next action on closed deals", () => {
    render(<LeadCardSummary lead={{ ...base, stage: "pos_venda" }} />);
    expect(screen.queryByText("Sem próxima ação")).toBeNull();
  });
});
