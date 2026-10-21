import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditLeadForm } from "./EditLeadForm";
import { KANBAN_STAGES, type Lead } from "@/types/crm";

vi.mock("@/hooks/useSellers", () => ({ useSellers: () => [] }));
vi.mock("@/contexts/RoleContext", () => ({ useRole: () => ({ isVendedor: true, sellerId: "", sellerName: "" }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });

const lead: Lead = {
  id: "lead-test", clientName: "DONE NATALIA", clientPhone: "5521983160797",
  stage: "precificacao_especial", value: 0, assignedTo: "", source: "whatsapp",
  tags: [], notes: "", createdAt: "2026-10-21T12:00:00Z", updatedAt: "2026-10-21T12:00:00Z",
};

afterEach(cleanup);

describe("lead stage editing", () => {
  it.each(KANBAN_STAGES)("allows selecting and saving $key", async ({ key, label }) => {
    const onSubmit = vi.fn();
    render(<EditLeadForm lead={lead} open onOpenChange={() => {}} onSubmit={onSubmit} onDelete={() => {}} />);
    const stageSelect = screen.getByRole("combobox", { name: "Etapa" });
    fireEvent.keyDown(stageSelect, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: label }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ stage: key })));
  });

  it("preserves the moved card's stage when editing other details", async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<EditLeadForm lead={{ ...lead, stage: "abordagem" }} open onOpenChange={() => {}} onSubmit={onSubmit} onDelete={() => {}} />);
    rerender(<EditLeadForm lead={lead} open onOpenChange={() => {}} onSubmit={onSubmit} onDelete={() => {}} />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "DONE NATALIA atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ stage: "precificacao_especial", clientName: "DONE NATALIA atualizado" })));
  });
});