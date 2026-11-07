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

  it("uses 30m / 1h / 1h30 when nothing is configured", () => {
    expect(getUrgencyLevel(leadIdleHours(0.4))).toBe("ok");
    expect(getUrgencyLevel(leadIdleHours(0.5))).toBe("attention");
    expect(getUrgencyLevel(leadIdleHours(1))).toBe("warning");
    expect(getUrgencyLevel(leadIdleHours(1.5))).toBe("critical");
    expect(getUrgencyLevel(leadIdleHours(100, "sondagem"))).toBe("critical");
  });

  it("uses the configured times (e.g. longer ones for the external team)", () => {
    const external = { sellerMinutes: 120, managerMinutes: 240, adminMinutes: 480 };
    expect(getUrgencyLevel(leadIdleHours(1.5), external)).toBe("ok");
    expect(getUrgencyLevel(leadIdleHours(2), external)).toBe("attention");
    expect(getUrgencyLevel(leadIdleHours(4), external)).toBe("warning");
    expect(getUrgencyLevel(leadIdleHours(8), external)).toBe("critical");
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

  it("labels the default levels with 30m / 1h / 1h30m", () => {
    expect(getUrgencyConfig("attention").label).toBe("Inicial: 30m");
    expect(getUrgencyConfig("warning").label).toBe("Atenção: +1h");
    const critical = getUrgencyConfig("critical");
    expect(critical.label).toBe("Grave: +1h30m");
    expect(critical.pulse).toBe(true);
    expect(critical.borderClass).toMatch(/red/);
  });

  it("labels follow the configured times", () => {
    const t = { sellerMinutes: 45, managerMinutes: 120, adminMinutes: 210 };
    expect(getUrgencyConfig("attention", t).label).toBe("Inicial: 45m");
    expect(getUrgencyConfig("warning", t).label).toBe("Atenção: +2h");
    expect(getUrgencyConfig("critical", t).label).toBe("Grave: +3h30m");
  });
});
