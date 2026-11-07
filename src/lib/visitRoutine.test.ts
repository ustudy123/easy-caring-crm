import { describe, expect, it } from "vitest";
import {
  countVisits, goalPercent, googleCalendarTemplateUrl, mapSellerGoals, quarterLabel, quarterRange,
  shiftWeek, validateVisitGoals, weekLabel, weekRange,
} from "./visitRoutine";
import type { FollowUp } from "@/types/crm";

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

const fu = (o: Partial<FollowUp>): FollowUp => ({
  id: Math.random().toString(36), leadId: "", clientName: "Cliente", clientPhone: "", scheduledAt: local(2026, 11, 4, 10).toISOString(),
  description: "", completed: false, assignedTo: "ana", type: "visit", ...o,
});

describe("weekRange", () => {
  it("runs from Monday 00:00 to the next Monday, so weekend visits count", () => {
    for (const day of [local(2026, 11, 2, 0, 0), local(2026, 11, 4, 15), local(2026, 11, 8, 23, 59)]) {
      const r = weekRange(day);
      expect(r.from).toEqual(local(2026, 11, 2));
      expect(r.to).toEqual(local(2026, 11, 9));
    }
    expect(weekLabel(weekRange(local(2026, 11, 8)))).toBe("02/11 a 08/11");
  });

  it("moves whole weeks across month and year boundaries", () => {
    const r = shiftWeek(weekRange(local(2026, 12, 30)), 1);
    expect(r.from).toEqual(local(2027, 1, 4));
    expect(shiftWeek(weekRange(local(2026, 11, 4)), -1).from).toEqual(local(2026, 10, 26));
  });
});

describe("quarterRange", () => {
  it("uses calendar quarters", () => {
    const q = quarterRange(local(2026, 11, 4));
    expect(q.from).toEqual(local(2026, 10, 1));
    expect(q.to).toEqual(local(2027, 1, 1));
    expect(quarterLabel(q)).toBe("4º trimestre de 2026");
    expect(quarterLabel(quarterRange(local(2027, 3, 31)))).toBe("1º trimestre de 2027");
  });
});

describe("countVisits", () => {
  it("counts planned and confirmed visits of the seller inside the week only", () => {
    const week = weekRange(local(2026, 11, 4));
    const list = [
      fu({ completed: true }),
      fu({ scheduledAt: local(2026, 11, 8, 22).toISOString() }),
      fu({ scheduledAt: local(2026, 11, 2, 0).toISOString(), completed: true }),
      fu({ scheduledAt: local(2026, 11, 9, 0).toISOString(), completed: true }), // próxima semana
      fu({ scheduledAt: local(2026, 11, 1, 23).toISOString(), completed: true }), // semana anterior
      fu({ type: "call", completed: true }),
      fu({ assignedTo: "bruno", completed: true }),
    ];
    expect(countVisits(list, "ana", week)).toEqual({ planned: 3, done: 2 });
  });
});

describe("goals", () => {
  it("defaults to 10 planned and 5 done with no new-clients goal", () => {
    expect(mapSellerGoals(null)).toEqual({ weeklyPlanned: 10, weeklyDone: 5, quarterlyNewClients: null });
    expect(mapSellerGoals({ weekly_visits_planned: 8, weekly_visits_done: 4, quarterly_new_clients: 3 }))
      .toEqual({ weeklyPlanned: 8, weeklyDone: 4, quarterlyNewClients: 3 });
  });

  it("rejects done above planned, fractions and out-of-range values", () => {
    expect(validateVisitGoals({ weeklyPlanned: 10, weeklyDone: 5, quarterlyNewClients: null })).toBeNull();
    expect(validateVisitGoals({ weeklyPlanned: 4, weeklyDone: 5, quarterlyNewClients: null })).toMatch(/planejadas/);
    expect(validateVisitGoals({ weeklyPlanned: 10.5, weeklyDone: 5, quarterlyNewClients: null })).toMatch(/inteiros/);
    expect(validateVisitGoals({ weeklyPlanned: 101, weeklyDone: 5, quarterlyNewClients: null })).toMatch(/100/);
    expect(validateVisitGoals({ weeklyPlanned: 10, weeklyDone: 5, quarterlyNewClients: -1 })).toMatch(/Clientes novos/);
  });

  it("caps the bar at 100% and treats a zero goal as reached", () => {
    expect(goalPercent(3, 5)).toBe(60);
    expect(goalPercent(7, 5)).toBe(100);
    expect(goalPercent(0, 0)).toBe(100);
    expect(goalPercent(2, null)).toBe(0);
  });
});

describe("googleCalendarTemplateUrl", () => {
  it("prefills title, one-hour slot in UTC and details", () => {
    const url = new URL(googleCalendarTemplateUrl(
      { clientName: "SERCON", clientPhone: "(21) 99999-0000", description: "Levar catálogo", scheduledAt: "2026-11-05T13:00:00.000Z" },
      "Visita",
    ));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Visita: SERCON");
    expect(url.searchParams.get("dates")).toBe("20261105T130000Z/20261105T140000Z");
    expect(url.searchParams.get("details")).toBe("Levar catálogo\nTelefone: (21) 99999-0000\nCriado pelo CRM Taeco");
  });
});
