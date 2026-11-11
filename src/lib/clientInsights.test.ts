import { describe, expect, it, vi } from "vitest";
import type { Lead } from "@/types/crm";

vi.mock("@/lib/qualification", () => ({
  qualificationProgress: (l: Lead) => (l.notes === "completo" ? { done: 6, total: 6 } : { done: 1, total: 6 }),
}));

import { clientInsights, latestCardInfo, outcomeOf, recurrenceReasons } from "./clientInsights";

const lead = (o: Partial<Lead>): Lead => ({
  id: Math.random().toString(36), clientName: "SERCON", clientPhone: "21999990001", stage: "pos_venda", value: 0, assignedTo: "ana",
  source: "whatsapp", tags: [], notes: "", createdAt: "2026-01-01T12:00:00Z", updatedAt: "2026-01-01T12:00:00Z", ...o,
} as Lead);

const now = new Date("2026-11-11T12:00:00Z");
const leads = [
  lead({ closedAt: "2026-10-20T12:00:00Z", value: 10000, notes: "completo" }),      // 3 meses
  lead({ closedAt: "2026-07-01T12:00:00Z", value: 6000 }),                           // 6 meses
  lead({ closedAt: "2026-01-15T12:00:00Z", value: 4000, archived: true }),           // 1 ano
  lead({ closedAt: "2025-06-01T12:00:00Z", value: 99999 }),                          // fora de 1 ano
  lead({ stage: "perdido", closedAt: "2026-09-01T12:00:00Z", lostReason: "Preço", value: 7000 }),
  lead({ stage: "sondagem", value: 3000, createdAt: "2026-11-05T12:00:00Z", companyWorkSite: "Estaleiro Mauá", segment: "Naval" }),
];

describe("clientInsights", () => {
  it("soma o vendido por período e conta as passagens pelo funil", () => {
    const c = { purchaseCount: 4, clientType: "recorrente", tags: [] };
    expect(clientInsights(c, leads, [], 3, now)).toMatchObject({ soldInPeriod: 10000, salesInPeriod: 1, avgTicket: 10000 });
    expect(clientInsights(c, leads, [], 6, now)).toMatchObject({ soldInPeriod: 16000, salesInPeriod: 2 });
    const year = clientInsights(c, leads, [], 12, now);
    expect(year).toMatchObject({ soldInPeriod: 20000, salesInPeriod: 3, opportunities: 6, sales: 4, lost: 1, open: 1, fullFunnel: 1, lastSaleAt: "2026-10-20T12:00:00Z" });
    expect(year.history[0].stage).toBe("sondagem");
  });

  it("soma as notas fiscais do período", () => {
    const r = clientInsights({ purchaseCount: 0, tags: [] }, [], [{ totalValue: 700, issueDate: "2026-10-02" }, { totalValue: 300, issueDate: "2025-01-01" }], 12, now);
    expect(r).toMatchObject({ invoicedInPeriod: 700, invoicesInPeriod: 1, avgTicket: null });
  });

  it("explica por que é recorrente", () => {
    expect(recurrenceReasons({ purchaseCount: 3, clientType: "recorrente", tags: ["fidelizado"] }, 2)).toEqual([
      "Comprou 3 vezes (2 ou mais compras contam como recorrente).",
      "Marcado como cliente recorrente no encerramento da venda (pós-venda).",
      "Tem a palavra-chave “fidelizado”.",
    ]);
    expect(recurrenceReasons({ purchaseCount: 0, tags: [] }, 2)[0]).toMatch(/Comprou 2 vezes/);
    expect(recurrenceReasons({ purchaseCount: 1, tags: [] }, 1)[0]).toMatch(/Ainda não é recorrente/);
  });

  it("classifica cada passagem e pega os dados do card mais recente", () => {
    expect(leads.map(outcomeOf)).toEqual(["venda", "venda", "venda", "venda", "perdido", "aberto"]);
    expect(latestCardInfo(leads)).toMatchObject({ companyWorkSite: "Estaleiro Mauá", segment: "Naval" });
    expect(latestCardInfo([])).toBeNull();
  });
});
