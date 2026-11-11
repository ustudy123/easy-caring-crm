import { describe, expect, it } from "vitest";
import { canSendResponse, feedbackStatus, suggestedPeriod } from "./feedback";
import { postSaleNotesError } from "./qualification";

describe("feedback", () => {
  it("mostra se foi lido e respondido", () => {
    expect(feedbackStatus({ viewedAt: null, respondedAt: null })).toBe("novo");
    expect(feedbackStatus({ viewedAt: "2026-11-01", respondedAt: null })).toBe("lido");
    expect(feedbackStatus({ viewedAt: "2026-11-01", respondedAt: "2026-11-02" })).toBe("respondido");
  });

  it("sugere o semestre que acabou de fechar", () => {
    expect(suggestedPeriod(new Date(2027, 0, 10))).toBe("2º semestre de 2026");
    expect(suggestedPeriod(new Date(2026, 6, 15))).toBe("1º semestre de 2026");
    expect(suggestedPeriod(new Date(2026, 10, 11))).toBe("2º semestre de 2026");
  });

  it("aceita resposta com texto ou áudio", () => {
    expect(canSendResponse("  ", null)).toBe(false);
    expect(canSendResponse("Entendi", null)).toBe(true);
    expect(canSendResponse("", new Blob(["a"]))).toBe(true);
  });

  it("pós-venda com nota baixa aceita áudio no lugar do texto", () => {
    expect(postSaleNotesError({ deliveryRating: 2, postSaleNotes: "curto" })).toMatch(/ou grave um áudio/);
    expect(postSaleNotesError({ deliveryRating: 2, postSaleNotes: "curto", postSaleAudioPath: "s/posvenda/a.webm" })).toBeNull();
  });
});
