import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanLeadCard, type KanbanLeadCardProps } from "./KanbanLeadCard";
import type { Lead } from "@/types/crm";

const lead: Lead = {
  id: "l1", clientName: "RR Fênix Nicholas", clientPhone: "5521993206917", stage: "sondagem", value: 0, assignedTo: "s1",
  source: "whatsapp", tags: [], notes: "", createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z",
};

const handlers = () => ({
  onOpen: vi.fn(), onWhatsApp: vi.fn(), onTransfer: vi.fn(), onProjects: vi.fn(), onLose: vi.fn(), onEdit: vi.fn(),
});

function renderCard(props: Partial<KanbanLeadCardProps> = {}) {
  const h = handlers();
  render(<KanbanLeadCard lead={lead} urgency="ok" urgencyLabel="" idleTime="10min" responsibleName="Alexandre Dantas" {...h} {...props} />);
  return h;
}

afterEach(cleanup);

describe("KanbanLeadCard", () => {
  it("shows company, segment and city in one line and hides placeholder fields", () => {
    renderCard({ lead: { ...lead, companyWorkSite: "RR Fenix", segment: "Onshore", city: "Teresópolis", clientType: "Empresa/Obra" } });
    expect(screen.getByText("RR Fenix · Onshore · Teresópolis")).toBeInTheDocument();
    expect(screen.queryByText(/R\$\s?0/)).toBeNull();
    expect(screen.queryByText("Empresa/Obra")).toBeNull();
    expect(screen.getByText("Alexandre")).toBeInTheDocument();
  });

  it("ignores a work site that is only the form label", () => {
    renderCard({ lead: { ...lead, companyWorkSite: "Empresa" } });
    expect(screen.queryByText("Empresa")).toBeNull();
  });

  it("formats an unnamed contact by phone", () => {
    renderCard({ lead: { ...lead, clientName: "5521972014620", clientPhone: "5521972014620" } });
    expect(screen.getByText("(21) 97201-4620")).toBeInTheDocument();
    expect(screen.getByText("Contato sem nome")).toBeInTheDocument();
  });

  it("shows the value only when there is one", () => {
    renderCard({ lead: { ...lead, value: 35000 } });
    expect(screen.getByText(/R\$\s?35\.000/)).toBeInTheDocument();
  });

  it("marks urgency with the idle time and the configured alert label", () => {
    const h = renderCard({ urgency: "critical", urgencyLabel: "Grave: +1h30m", idleTime: "20d 18h" });
    expect(screen.getByTitle("Grave: +1h30m · parado há 20d 18h")).toHaveTextContent("20d 18h");
    fireEvent.click(screen.getByRole("button", { name: "Agir agora" }));
    expect(h.onEdit).toHaveBeenCalled();
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it("opens WhatsApp without opening the card", () => {
    const h = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Abrir conversa no WhatsApp" }));
    expect(h.onWhatsApp).toHaveBeenCalled();
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it("limits tags to two and counts the rest", () => {
    renderCard({ lead: { ...lead, tags: ["Jotamastic", "Penguard", "Hardtop"] } });
    expect(screen.getByText("Jotamastic")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByText("Hardtop")).toBeNull();
  });
});
