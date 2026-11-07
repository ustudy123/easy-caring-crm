import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALERT_TIMES, formatAlertMinutes, formatAlertMinutesShort, resolveAlertTimes, validateAlertTimes,
  type AlertTimeSetting,
} from "./alertTimes";

const row = (o: Partial<AlertTimeSetting>): AlertTimeSetting => ({
  id: Math.random().toString(36), storeId: null, sellerId: null,
  sellerMinutes: 30, managerMinutes: 60, adminMinutes: 90, ...o,
});

const settings = [
  row({ sellerMinutes: 40, managerMinutes: 80, adminMinutes: 120 }),                         // padrão geral
  row({ storeId: "externa", sellerMinutes: 120, managerMinutes: 240, adminMinutes: 480 }),    // loja
  row({ sellerId: "andinho", sellerMinutes: 180, managerMinutes: 360, adminMinutes: 720 }),   // exceção
];

describe("resolveAlertTimes", () => {
  it("prefers the seller exception, then the store, then the global default", () => {
    expect(resolveAlertTimes(settings, { sellerId: "andinho", storeId: "externa" })).toEqual({
      times: { sellerMinutes: 180, managerMinutes: 360, adminMinutes: 720 }, source: "seller",
    });
    expect(resolveAlertTimes(settings, { sellerId: "leonardo", storeId: "externa" }).source).toBe("store");
    expect(resolveAlertTimes(settings, { sellerId: "raquel", storeId: "matriz" })).toEqual({
      times: { sellerMinutes: 40, managerMinutes: 80, adminMinutes: 120 }, source: "global",
    });
  });

  it("falls back to 30/60/90 without any configuration", () => {
    expect(resolveAlertTimes([], { sellerId: "x", storeId: "y" })).toEqual({ times: DEFAULT_ALERT_TIMES, source: "default" });
  });
});

describe("validateAlertTimes", () => {
  it("requires increasing positive whole minutes up to 7 days", () => {
    expect(validateAlertTimes({ sellerMinutes: 30, managerMinutes: 60, adminMinutes: 90 })).toBeNull();
    expect(validateAlertTimes({ sellerMinutes: 60, managerMinutes: 60, adminMinutes: 90 })).toMatch(/aumentar/);
    expect(validateAlertTimes({ sellerMinutes: 0, managerMinutes: 60, adminMinutes: 90 })).toMatch(/maiores que zero/);
    expect(validateAlertTimes({ sellerMinutes: 30.5, managerMinutes: 60, adminMinutes: 90 })).toMatch(/inteiros/);
    expect(validateAlertTimes({ sellerMinutes: 30, managerMinutes: 60, adminMinutes: 10081 })).toMatch(/7 dias/);
  });
});

describe("formatting", () => {
  it("writes durations the way the team speaks", () => {
    expect(formatAlertMinutes(1)).toBe("1 minuto");
    expect(formatAlertMinutes(30)).toBe("30 minutos");
    expect(formatAlertMinutes(60)).toBe("1 hora");
    expect(formatAlertMinutes(90)).toBe("1 hora e 30 minutos");
    expect(formatAlertMinutes(1440)).toBe("24 horas");
    expect(formatAlertMinutesShort(30)).toBe("30m");
    expect(formatAlertMinutesShort(90)).toBe("1h30m");
    expect(formatAlertMinutesShort(125)).toBe("2h05m");
  });
});
