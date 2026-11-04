import { describe, expect, it } from "vitest";
import type { Lead } from "@/types/crm";
import { missingForStage, OTHER_BRAND, OTHER_PAINT, postSaleNotesError, qualificationProgress } from "./qualification";

const stage1: Partial<Lead> = {
  clientType: "Empresa/Obra", companyWorkSite: "Estaleiro X", city: "Niterói", segment: "Naval",
  clientEmail: "compras@x.com", lastContactAt: "2026-11-03T12:00:00Z", nextAction: "visita", nextActionAt: "2026-11-06T17:00:00Z",
};
const stage23: Partial<Lead> = {
  interestProducts: "Pintura de casco",
  qualification: {
    paintTypes: ["Epóxi"], applicationPlace: "Chapas", surfacePrep: "Jato abrasivo", brands: ["WEG"],
    applicationMethod: "Airless", technicalProblems: ["Problemas de aderência, corrosão ou descascamento"],
  },
};
const lead = (o: Partial<Lead> = {}): Lead => ({
  id: "1", clientName: "SERCON", clientPhone: "5522999990000", stage: "abordagem", value: 0, assignedTo: "a",
  source: "whatsapp", tags: [], notes: "", createdAt: "", updatedAt: "", ...o,
});
const labels = (l: Lead, to: Parameters<typeof missingForStage>[1]) => missingForStage(l, to).flatMap((r) => r.items);

describe("missingForStage", () => {
  it("blocks leaving Abordagem until the stage 1 fields are filled", () => {
    expect(labels(lead(), "sondagem")).toEqual([
      "Tipo de cliente", "Empresa/Obra", "Cidade", "Segmento", "E-mail", "Último contato", "Próxima ação com data",
    ]);
    expect(missingForStage(lead(stage1), "sondagem")).toEqual([]);
  });

  it("lets the card walk through Sondagem and Recomendação, but not into Orçamento without the questions", () => {
    const l = lead({ ...stage1, stage: "sondagem" });
    expect(missingForStage(l, "recomendacao_tecnica")).toEqual([]);
    expect(missingForStage(l, "precificacao_especial").map((r) => r.group.key)).toEqual(["sondagem"]);
    expect(missingForStage(lead({ ...stage1, ...stage23, stage: "recomendacao_tecnica" }), "precificacao_especial")).toEqual([]);
  });

  it("cannot skip stages: jumping to Fechamento requires every earlier group", () => {
    const keys = missingForStage(lead(), "fechamento").map((r) => r.group.key);
    expect(keys).toEqual(["abordagem", "sondagem", "orcamento", "objecoes", "venda_adicional"]);
  });

  it("an 'other' option needs its text", () => {
    const l = lead({ ...stage1, ...stage23, stage: "recomendacao_tecnica" });
    l.qualification = { ...l.qualification, paintTypes: [OTHER_PAINT], brands: ["Akzo", OTHER_BRAND], brandsOther: "Jotun" };
    expect(labels(l, "precificacao_especial")).toEqual(["Tipos de tinta utilizados"]);
  });

  it("never blocks going back or losing the deal", () => {
    expect(missingForStage(lead({ stage: "fechamento" }), "sondagem")).toEqual([]);
    expect(missingForStage(lead(), "perdido")).toEqual([]);
    expect(missingForStage(lead({ stage: "sondagem" }), "sondagem")).toEqual([]);
  });

  it("option A: a legacy card in Orçamento must complete the earlier stages to advance", () => {
    expect(missingForStage(lead({ stage: "precificacao_especial" }), "demonstracao_valor").map((r) => r.group.key))
      .toEqual(["abordagem", "sondagem"]);
  });

  it("closing requires the stage 8 answers, including the next order when the order is partial", () => {
    const l = lead({ ...stage1, ...stage23, stage: "fechamento", value: 5000 });
    l.qualification = {
      ...l.qualification, petrobrasNorms: true, techSpec: false, industrialTests: false,
      purchaseDecision: "Apenas o responsável de compras", objections: ["Prazo de entrega e disponibilidade do produto"],
      monthlyVolume: "Até 200 litros", orderSentAt: "2026-11-05", orderCoversTotal: false, postSaleAt: "2026-11-20",
    };
    expect(labels(l, "pos_venda")).toEqual(["Previsão do próximo pedido"]);
    l.qualification.nextOrderForecastAt = "2026-12-10";
    expect(missingForStage(l, "pos_venda")).toEqual([]);
    expect(qualificationProgress(l)).toEqual({ done: 6, total: 6 });
  });
});

describe("post-sale ratings", () => {
  it("a rating of 3 or less requires an explanation of at least 20 characters", () => {
    expect(postSaleNotesError({ deliveryRating: 5, productRating: 4 })).toBeNull();
    expect(postSaleNotesError({ deliveryRating: 3, productRating: 5 })).toMatch(/20 caracteres/);
    expect(postSaleNotesError({ deliveryRating: 2, postSaleNotes: "Atrasou a entrega." })).not.toBeNull();
    expect(postSaleNotesError({ deliveryRating: 2, postSaleNotes: "Atrasou a entrega em três dias." })).toBeNull();
  });
});
