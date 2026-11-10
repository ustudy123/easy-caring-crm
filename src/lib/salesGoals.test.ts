import { describe, expect, it } from "vitest";
import {
  brlShort, conversionRate, countBusinessDays, goalProgress, groupByExpectedClose, monthKey, monthLabel, monthRange,
  parseMoneyInput, shiftMonth,
} from "./salesGoals";
import {
  draftToRow, kindMismatch, validateDraft, wasEditedByHand, type SalesDocumentDraft,
} from "./salesDocuments";

const nov = new Date(2026, 10, 1);

describe("dias úteis", () => {
  it("conta segunda a sexta menos feriados, e quantos já passaram", () => {
    const holidays = new Set(["2026-11-02", "2026-11-20", "2026-11-15"]); // 15/11 cai num domingo
    const r = countBusinessDays(nov, holidays, new Date(2026, 10, 7, 15));
    expect(r).toEqual({ total: 19, elapsed: 4, holidays: ["2026-11-02", "2026-11-20"] });
    expect(countBusinessDays(nov, new Set(), new Date(2026, 9, 10)).elapsed).toBe(0);
    expect(countBusinessDays(nov, new Set(), new Date(2027, 0, 10)).elapsed).toBe(21);
  });

  it("usa a chave e o rótulo do mês", () => {
    expect(monthKey(nov)).toBe("2026-11-01");
    expect(monthLabel(nov)).toBe("novembro de 2026");
    expect(shiftMonth(new Date(2026, 11, 1), 1)).toEqual(new Date(2027, 0, 1));
    expect(monthRange(nov)).toEqual({ from: nov, to: new Date(2026, 11, 1) });
  });
});

describe("goalProgress", () => {
  it("divide a meta pelos dias úteis e compara com o esperado até hoje", () => {
    expect(goalProgress({ goal: 100_000, achieved: 25_000, today: 3_000, businessDays: 20, elapsedBusinessDays: 4 })).toEqual({
      goal: 100_000, achieved: 25_000, daily: 5_000, expectedToDate: 20_000, today: 3_000, percent: 25, onTrack: true,
    });
    expect(goalProgress({ goal: 100_000, achieved: 15_000, today: 0, businessDays: 20, elapsedBusinessDays: 4 }).onTrack).toBe(false);
  });

  it("não passa dos dias informados e fica neutro sem meta", () => {
    expect(goalProgress({ goal: 10_000, achieved: 0, today: 0, businessDays: 10, elapsedBusinessDays: 15 }).expectedToDate).toBe(10_000);
    expect(goalProgress({ goal: null, achieved: 500, today: 0, businessDays: 20, elapsedBusinessDays: 4 }))
      .toMatchObject({ goal: null, daily: null, percent: null, onTrack: null, achieved: 500 });
  });
});

describe("conversão e valores", () => {
  it("vendido ÷ orçado", () => {
    expect(conversionRate(200_000, 1_000_000)).toBe(20);
    expect(conversionRate(1, 3)).toBe(33.3);
    expect(conversionRate(500, 0)).toBeNull();
  });

  it("lê valores digitados em reais", () => {
    expect(parseMoneyInput("150.000,00")).toBe(150000);
    expect(parseMoneyInput("1.500")).toBe(1500);
    expect(parseMoneyInput("980,5")).toBe(980.5);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNaN();
    expect(parseMoneyInput("-10")).toBeNaN();
  });

  it("abrevia valores grandes nos cartões", () => {
    expect(brlShort(1_250_000)).toBe("R$ 1,3 mi");
    expect(brlShort(350_400)).toBe("R$ 350 mil");
    expect(brlShort(980)).toMatch(/^R\$\s980$/);
  });

  it("agrupa orçamentos pelo mês previsto, sem previsão por último", () => {
    expect(groupByExpectedClose([
      { expectedCloseDate: "2026-12-10", totalValue: 100 },
      { expectedCloseDate: null, totalValue: 50 },
      { expectedCloseDate: "2026-11-20", totalValue: 200 },
      { expectedCloseDate: "2026-11-28", totalValue: 300 },
    ])).toEqual([
      { key: "2026-11", label: "nov/26", total: 500, count: 2 },
      { key: "2026-12", label: "dez/26", total: 100, count: 1 },
      { key: "none", label: "Sem previsão", total: 50, count: 1 },
    ]);
  });
});

const draft = (o: Partial<SalesDocumentDraft> = {}): SalesDocumentDraft => ({
  documentNumber: "123", clientName: "SERCON", clientDocument: "", totalValue: 1000, issueDate: "2026-11-03",
  expectedCloseDate: "2026-11-20", installments: [], notes: "", ...o,
});

describe("formulário do documento", () => {
  it("orçamento exige previsão de fechamento depois da emissão", () => {
    expect(validateDraft("quote", draft())).toEqual({});
    expect(validateDraft("quote", draft({ expectedCloseDate: "" }))).toEqual({ expectedCloseDate: "Informe a previsão de fechamento." });
    expect(validateDraft("quote", draft({ expectedCloseDate: "2026-11-01" }))).toEqual({ expectedCloseDate: "A previsão não pode ser antes da emissão." });
    expect(validateDraft("quote", draft({ clientName: " ", totalValue: Number.NaN, issueDate: "" })))
      .toMatchObject({ clientName: "Informe o cliente.", totalValue: "Valor inválido.", issueDate: "Informe a data de emissão." });
  });

  it("nota fiscal exige valor e vencimento em cada parcela e não guarda previsão", () => {
    expect(validateDraft("invoice", draft({ expectedCloseDate: "", installments: [{ value: 500, dueDate: "" }] })))
      .toEqual({ installments: "Cada parcela precisa de valor e vencimento." });
    expect(draftToRow("invoice", draft({ installments: [{ value: 500, dueDate: "2026-12-03" }, { value: 500, dueDate: "2027-01-03" }] })))
      .toMatchObject({
        expected_close_date: null,
        installments: [{ number: 1, value: 500, due_date: "2026-12-03" }, { number: 2, value: 500, due_date: "2027-01-03" }],
      });
    expect(draftToRow("quote", draft({ documentNumber: " ", notes: "  " }))).toMatchObject({ document_number: null, notes: null, installments: [] });
  });

  it("sinaliza valor diferente do lido pela IA e tipo trocado", () => {
    const ai = { document_type: "invoice" as const, document_number: null, client_name: null, client_document: null, issue_date: null, total_value: 1000, installments: [], seller_name: null };
    expect(wasEditedByHand({ totalValue: 1000, aiExtracted: ai })).toBe(false);
    expect(wasEditedByHand({ totalValue: 1500, aiExtracted: ai })).toBe(true);
    expect(wasEditedByHand({ totalValue: 1500, aiExtracted: null })).toBe(false);
    expect(kindMismatch("quote", ai)).toBe(true);
    expect(kindMismatch("invoice", ai)).toBe(false);
  });
});
