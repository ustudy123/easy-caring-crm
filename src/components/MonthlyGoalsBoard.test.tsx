import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseMockState } from "@/test/supabaseMock";

const state = vi.hoisted(() => ({ db: {}, calls: [] }) as SupabaseMockState);
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: createSupabaseMock(state) };
});
vi.mock("@/hooks/useExternalStores", () => ({ useExternalStores: () => new Set(["ext"]) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { MonthlyGoalsBoard } from "./MonthlyGoalsBoard";

const sellers = [
  { id: "andinho", name: "Andinho", store_id: "ext", storeName: "Vendedor Externo" },
  { id: "bia", name: "Bia", store_id: "ext", storeName: "Vendedor Externo" },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 7, 12));
  state.calls = [];
  state.db = {
    monthly_goals: [
      { month: "2026-11-01", seller_id: "andinho", quote_goal: 500000, sales_goal: 100000 },
      { month: "2026-10-01", seller_id: "bia", quote_goal: 300000, sales_goal: 60000 },
    ],
    month_business_days: [],
    store_holidays: [{ store_id: "ext", holiday_date: "2026-11-02" }, { store_id: "ext", holiday_date: "2026-11-20" }],
  };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("MonthlyGoalsBoard", () => {
  it("suggests business days from the calendar and shows the daily goal", async () => {
    render(<MonthlyGoalsBoard sellers={sellers} />);
    expect(await screen.findByText(/Pelo calendário: 19 \(segunda a sexta, menos 2 feriados: 02\/11, 20\/11\)/)).toBeInTheDocument();
    expect(screen.getByText("Novembro de 2026")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Meta de orçamentos (R$)")[0]).toHaveValue("500.000,00");
    expect(screen.getAllByLabelText("Meta de vendas (R$)")[0]).toHaveValue("100.000,00");
    expect(screen.getByText(/R\$\s26\.315,79 em orçamentos/)).toBeInTheDocument();
  });

  it("saves the whole board in one go and removes cleared goals", async () => {
    render(<MonthlyGoalsBoard sellers={sellers} />);
    await screen.findByText(/Pelo calendário: 19/);
    fireEvent.change(screen.getByLabelText("Dias úteis do mês"), { target: { value: "20" } });
    const [, biaSales] = screen.getAllByLabelText("Meta de vendas (R$)");
    fireEvent.change(biaSales, { target: { value: "80.000" } });
    const [andinhoQuote] = screen.getAllByLabelText("Meta de orçamentos (R$)");
    const [andinhoSales] = screen.getAllByLabelText("Meta de vendas (R$)");
    fireEvent.change(andinhoQuote, { target: { value: "" } });
    fireEvent.change(andinhoSales, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar quadro/ }));

    await waitFor(() => expect(state.calls.some((c) => c.op === "delete")).toBe(true));
    expect(state.calls).toEqual([
      { table: "month_business_days", op: "upsert", values: { month: "2026-11-01", business_days: 20 }, onConflict: "month" },
      { table: "monthly_goals", op: "upsert", values: [{ month: "2026-11-01", seller_id: "bia", quote_goal: null, sales_goal: 80000 }], onConflict: "month,seller_id" },
      { table: "monthly_goals", op: "delete", filters: ["month=2026-11-01", "seller_id in andinho"] },
    ]);
  });

  it("blocks invalid business days and amounts", async () => {
    render(<MonthlyGoalsBoard sellers={sellers} />);
    await screen.findByText(/Pelo calendário: 19/);
    fireEvent.change(screen.getByLabelText("Dias úteis do mês"), { target: { value: "40" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Dias úteis: um número inteiro de 1 a 31.");
    fireEvent.change(screen.getByLabelText("Dias úteis do mês"), { target: { value: "" } });
    fireEvent.change(screen.getAllByLabelText("Meta de vendas (R$)")[1], { target: { value: "muito" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Use valores em reais");
    expect(screen.getByRole("button", { name: /Salvar quadro/ })).toBeDisabled();
  });

  it("copies last month's goals into the board without saving", async () => {
    render(<MonthlyGoalsBoard sellers={sellers} />);
    await screen.findByText(/Pelo calendário: 19/);
    fireEvent.click(screen.getByRole("button", { name: /Copiar do mês anterior/ }));
    await waitFor(() => expect(screen.getAllByLabelText("Meta de orçamentos (R$)")[1]).toHaveValue("300.000,00"));
    expect(screen.getAllByLabelText("Meta de orçamentos (R$)")[0]).toHaveValue("");
    expect(state.calls).toEqual([]);
  });
});
