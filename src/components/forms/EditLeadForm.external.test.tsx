import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditLeadForm } from "./EditLeadForm";
import type { Lead } from "@/types/crm";

vi.mock("@/hooks/useSellers", () => ({
  useSellers: () => [
    { id: "andinho", name: "Andinho", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0 },
    { id: "raquel", name: "Raquel", store_id: "matriz", role: "vendedor", leadsCount: 0, conversions: 0 },
  ],
}));
vi.mock("@/hooks/useExternalStores", () => ({ useExternalStores: () => new Set(["ext"]) }));
vi.mock("@/contexts/RoleContext", () => ({ useRole: () => ({ isVendedor: false, sellerId: "", sellerName: "" }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
afterEach(cleanup);

const lead: Lead = {
  id: "l1", clientName: "SERCON CONSTRUCOES", clientPhone: "5522999990000", stage: "sondagem", value: 0,
  assignedTo: "andinho", source: "whatsapp", tags: [], notes: "", createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z",
};

const pick = async (comboName: string, option: string) => {
  fireEvent.keyDown(screen.getByRole("combobox", { name: comboName }), { key: "ArrowDown", code: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
};

describe("EditLeadForm — external team card fields", () => {
  it("does not show the card fields for leads outside the external team", () => {
    render(<EditLeadForm lead={{ ...lead, assignedTo: "raquel" }} open onOpenChange={() => {}} onSubmit={() => {}} onDelete={() => {}} />);
    expect(screen.queryByText(/Card do cliente/)).toBeNull();
  });

  it("requires a date when a next action is chosen, then saves the fields", async () => {
    const onSubmit = vi.fn();
    render(<EditLeadForm lead={{ ...lead, city: "Macaé" }} open onOpenChange={() => {}} onSubmit={onSubmit} onDelete={() => {}} />);
    expect(screen.getByText(/Card do cliente/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Cidade" })).toHaveTextContent("Macaé");

    await pick("Segmento", "Offshore");
    // A cidade (busca com lista) é testada em LeadCardFields.test.tsx: dentro do
    // Dialog o jsdom não reproduz o foco do Radix; no Chromium funciona.
    await pick("Próxima ação", "Visita presencial");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe a data e a hora da próxima ação.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Data da próxima ação"), { target: { value: "2026-11-06T14:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      segment: "Offshore", city: "Macaé", nextAction: "visita", nextActionAt: new Date("2026-11-06T14:00").toISOString(),
    })));
  });
});

describe("EditLeadForm — funil etapa a etapa", () => {
  it("blocks moving forward without the qualification and explains what is missing", async () => {
    const onSubmit = vi.fn();
    render(<EditLeadForm lead={{ ...lead, stage: "abordagem" }} open onOpenChange={() => {}} onSubmit={onSubmit} onDelete={() => {}} />);
    await pick("Etapa", "Fechamento");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Para ir para Fechamento, complete a qualificação/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("moving back is always allowed", async () => {
    const onSubmit = vi.fn();
    render(<EditLeadForm lead={{ ...lead, stage: "contorno_objecoes" }} open onOpenChange={() => {}} onSubmit={onSubmit} onDelete={() => {}} />);
    await pick("Etapa", "Sondagem");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ stage: "sondagem" })));
  });
});
