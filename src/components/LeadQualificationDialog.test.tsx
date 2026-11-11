import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeadQualificationDialog } from "./LeadQualificationDialog";
import type { Lead } from "@/types/crm";

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
afterEach(cleanup);

const lead: Lead = {
  id: "l1", clientName: "SERCON", clientPhone: "5522999990000", stage: "recomendacao_tecnica", value: 0, assignedTo: "a",
  source: "whatsapp", tags: [], notes: "", createdAt: "", updatedAt: "",
  clientType: "Empresa/Obra", companyWorkSite: "Estaleiro", city: "Niterói", segment: "Naval", clientEmail: "c@x.com",
  lastContactAt: "2026-11-03T12:00:00Z", nextAction: "visita", nextActionAt: "2026-11-06T17:00:00Z", interestProducts: "Casco",
};

const choose = (group: string, option: string) => {
  const g = within(screen.getByRole("group", { name: group }));
  fireEvent.click(g.queryByRole("checkbox", { name: option }) ?? g.getByRole("radio", { name: option }));
};

describe("LeadQualificationDialog", () => {
  it("lists what is missing and only moves once the stage is complete", () => {
    const onSave = vi.fn();
    render(<LeadQualificationDialog lead={lead} targetStage="precificacao_especial" open onOpenChange={() => {}} onSave={onSave} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Etapas 2 e 3 · Sondagem e Recomendação");
    const move = screen.getByRole("button", { name: "Salvar e mover para Orçamento e Preço" });
    expect(move).toBeDisabled();

    choose("Tipos de tinta", "Epóxi");
    choose("Tipos de tinta", "Poliuretano (PU)");
    choose("Local de aplicação", "Chapas");
    choose("Preparação de superfície", "Jato abrasivo");
    choose("Marcas", "WEG");
    choose("Método de aplicação", "Airless");
    choose("Problemas técnicos", "Retrabalho, repintura ou descarte");

    expect(move).toBeEnabled();
    fireEvent.click(move);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        qualification: expect.objectContaining({
          paintTypes: ["Epóxi", "Poliuretano (PU)"], applicationPlace: "Chapas", surfacePrep: "Jato abrasivo",
          brands: ["WEG"], applicationMethod: "Airless", technicalProblems: ["Retrabalho, repintura ou descarte"],
        }),
      }),
      "precificacao_especial",
    );
  });

  it("asks for the text of an 'other' option", () => {
    render(<LeadQualificationDialog lead={lead} targetStage="precificacao_especial" open onOpenChange={() => {}} onSave={() => {}} />);
    choose("Marcas", "Outras marcas");
    expect(screen.getByLabelText("Outras marcas")).toBeInTheDocument();
  });

  it("requires an explanation for a low post-sale rating", () => {
    const onSave = vi.fn();
    render(<LeadQualificationDialog lead={{ ...lead, stage: "pos_venda" }} open onOpenChange={() => {}} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Etapa 9/ }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Avaliação da entrega" })).getByRole("radio", { name: "2 estrelas" }));
    const save = screen.getByRole("button", { name: "Salvar" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Observação do pós-venda"), { target: { value: "A entrega atrasou três dias." } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ qualification: expect.objectContaining({ deliveryRating: 2 }) }), undefined);
  });

  it("does not offer to move when the target depends on closing the sale", () => {
    render(<LeadQualificationDialog lead={lead} targetStage="pos_venda" canMove={false} open onOpenChange={() => {}} onSave={() => {}} />);
    expect(screen.queryByRole("button", { name: /Salvar e mover/ })).toBeNull();
    expect(screen.getByText(/encerrar como venda concluída/)).toBeInTheDocument();
  });
});
