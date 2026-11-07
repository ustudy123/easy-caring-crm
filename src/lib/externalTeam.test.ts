import { describe, expect, it } from "vitest";
import { fromLocalInput, isExternalLead, isOpenOpportunity, nextActionStatus, toLocalDateInput, toLocalDateTimeInput } from "./externalTeam";

const sellers = [{ id: "andinho", store_id: "ext" }, { id: "raquel", store_id: "matriz" }];
const ext = new Set(["ext"]);

describe("isExternalLead", () => {
  it("uses the store of the responsible seller", () => {
    expect(isExternalLead({ assignedTo: "andinho", storeId: "matriz" }, sellers, ext)).toBe(true);
    expect(isExternalLead({ assignedTo: "raquel", storeId: "ext" }, sellers, ext)).toBe(false);
  });
  it("falls back to the lead store when there is no seller", () => {
    expect(isExternalLead({ assignedTo: "", storeId: "ext" }, sellers, ext)).toBe(true);
    expect(isExternalLead({ assignedTo: "", storeId: undefined }, sellers, ext)).toBe(false);
    expect(isExternalLead({ assignedTo: "andinho" }, sellers, new Set())).toBe(false);
  });
});

describe("next action status", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  it("flags missing and overdue next actions", () => {
    expect(nextActionStatus({}, now)).toBe("missing");
    expect(nextActionStatus({ nextAction: "visita" }, now)).toBe("missing");
    expect(nextActionStatus({ nextAction: "visita", nextActionAt: "2026-11-04T11:00:00Z" }, now)).toBe("overdue");
    expect(nextActionStatus({ nextAction: "ligacao", nextActionAt: "2026-11-05T09:00:00Z" }, now)).toBe("ok");
  });
  it("only open opportunities count", () => {
    expect(isOpenOpportunity({ stage: "sondagem" })).toBe(true);
    for (const stage of ["fechamento", "pos_venda", "perdido"] as const) expect(isOpenOpportunity({ stage })).toBe(false);
    expect(isOpenOpportunity({ stage: "abordagem", archived: true })).toBe(false);
  });
});

describe("date inputs", () => {
  it("round-trips datetime-local and date values in local time", () => {
    const iso = fromLocalInput("2026-11-06T14:30")!;
    expect(toLocalDateTimeInput(iso)).toBe("2026-11-06T14:30");
    expect(toLocalDateInput(fromLocalInput("2026-11-03"))).toBe("2026-11-03");
    expect(fromLocalInput("")).toBeUndefined();
    expect(toLocalDateTimeInput(undefined)).toBe("");
  });
});
