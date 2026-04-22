import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getIdleHours,
  getUrgencyLevel,
  formatIdleTime,
  getUrgencyConfig,
} from "./leadUrgency";
import type { Lead, KanbanStage } from "@/types/crm";

const NOW = new Date("2025-01-15T12:00:00.000Z").getTime();

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    clientName: "Test",
    clientPhone: "11999990000",
    stage: "abordagem",
    value: 0,
    assignedTo: "",
    source: "manual",
    tags: [],
    notes: "",
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

function leadIdleHours(hours: number, stage: KanbanStage = "abordagem"): Lead {
  return makeLead({
    stage,
    updatedAt: new Date(NOW - hours * 3600 * 1000).toISOString(),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getIdleHours", () => {
  it("returns 0 for a just-updated lead", () => {
    expect(getIdleHours(makeLead())).toBe(0);
  });

  it("returns positive hours for past updates", () => {
    expect(getIdleHours(leadIdleHours(5))).toBeCloseTo(5, 5);
  });

  it("can return negative hours for future updatedAt", () => {
    const future = makeLead({
      updatedAt: new Date(NOW + 3600 * 1000).toISOString(),
    });
    expect(getIdleHours(future)).toBeCloseTo(-1, 5);
  });
});

describe("getUrgencyLevel", () => {
  it("always returns 'ok' for fechamento and pos_venda", () => {
    expect(getUrgencyLevel(leadIdleHours(9999, "fechamento"))).toBe("ok");
    expect(getUrgencyLevel(leadIdleHours(9999, "pos_venda"))).toBe("ok");
  });

  it("returns 'ok' below the attention threshold (abordagem < 2h)", () => {
    expect(getUrgencyLevel(leadIdleHours(1, "abordagem"))).toBe("ok");
  });

  it("returns 'attention' at the attention threshold (abordagem 2h)", () => {
    expect(getUrgencyLevel(leadIdleHours(2, "abordagem"))).toBe("attention");
  });

  it("returns 'warning' at the warning threshold (abordagem 6h)", () => {
    expect(getUrgencyLevel(leadIdleHours(6, "abordagem"))).toBe("warning");
  });

  it("returns 'critical' at the critical threshold (abordagem 24h)", () => {
    expect(getUrgencyLevel(leadIdleHours(24, "abordagem"))).toBe("critical");
    expect(getUrgencyLevel(leadIdleHours(100, "abordagem"))).toBe("critical");
  });

  it("uses per-stage thresholds (sondagem only attention at 12h)", () => {
    expect(getUrgencyLevel(leadIdleHours(6, "sondagem"))).toBe("ok");
    expect(getUrgencyLevel(leadIdleHours(12, "sondagem"))).toBe("attention");
    expect(getUrgencyLevel(leadIdleHours(24, "sondagem"))).toBe("warning");
    expect(getUrgencyLevel(leadIdleHours(48, "sondagem"))).toBe("critical");
  });

  it.each<[KanbanStage, number, "ok" | "attention" | "warning" | "critical"]>([
    ["recomendacao_tecnica", 24, "attention"],
    ["demonstracao_valor", 48, "warning"],
    ["contorno_objecoes", 96, "critical"],
    ["cross_sell", 72, "critical"],
  ])("computes urgency for %s after %ih -> %s", (stage, h, expected) => {
    expect(getUrgencyLevel(leadIdleHours(h, stage))).toBe(expected);
  });
});

describe("formatIdleTime", () => {
  it("formats sub-hour idleness in minutes", () => {
    expect(formatIdleTime(leadIdleHours(0.5))).toBe("30min");
  });

  it("returns 0min for a freshly-updated lead", () => {
    expect(formatIdleTime(makeLead())).toBe("0min");
  });

  it("formats single-day idleness in hours", () => {
    expect(formatIdleTime(leadIdleHours(5))).toBe("5h");
    expect(formatIdleTime(leadIdleHours(23.9))).toBe("23h");
  });

  it("formats multi-day idleness as 'Xd Yh'", () => {
    expect(formatIdleTime(leadIdleHours(25))).toBe("1d 1h");
    expect(formatIdleTime(leadIdleHours(50))).toBe("2d 2h");
  });
});

describe("getUrgencyConfig", () => {
  it("returns blank config for 'ok'", () => {
    const c = getUrgencyConfig("ok");
    expect(c.label).toBe("");
    expect(c.borderClass).toBe("");
    expect(c.badgeClass).toBe("");
    expect(c.pulse).toBe(false);
  });

  it("returns critical config with pulse and destructive ring", () => {
    const c = getUrgencyConfig("critical");
    expect(c.label).toBe("Crítico");
    expect(c.pulse).toBe(true);
    expect(c.borderClass).toMatch(/destructive/);
  });

  it("returns warning config with pulse", () => {
    const c = getUrgencyConfig("warning");
    expect(c.label).toBe("Atenção");
    expect(c.pulse).toBe(true);
  });

  it("returns attention config without pulse", () => {
    const c = getUrgencyConfig("attention");
    expect(c.label).toBe("Sem ação");
    expect(c.pulse).toBe(false);
  });
});