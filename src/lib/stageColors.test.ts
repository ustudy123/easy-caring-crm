import { describe, expect, it } from "vitest";
import { KANBAN_STAGES } from "@/types/crm";
import { STAGE_COLORS, formatStageTotal } from "./stageColors";

describe("stage colors", () => {
  it("formats column totals with two decimals only when there are cents", () => {
    expect(formatStageTotal(80785.5)).toBe("R$ 80.785,50");
    expect(formatStageTotal(46743.76)).toBe("R$ 46.743,76");
    expect(formatStageTotal(13000)).toBe("R$ 13.000");
    expect(formatStageTotal(0)).toBe("R$ 0");
  });

  it("gives every board stage its own color, none of the urgency hues", () => {
    const solids = KANBAN_STAGES.map((s) => STAGE_COLORS[s.key].solid);
    expect(new Set(solids).size).toBe(KANBAN_STAGES.length);
    for (const c of solids) expect(c).not.toMatch(/red|orange|amber|yellow/);
  });
});
