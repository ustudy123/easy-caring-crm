import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { LeadCardFields, validateLeadCardFields, type LeadCardFieldsValue } from "./LeadCardFields";

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
afterEach(cleanup);

function Harness({ initial = {} }: { initial?: LeadCardFieldsValue }) {
  const [v, setV] = useState<LeadCardFieldsValue>(initial);
  return (
    <>
      <LeadCardFields value={v} onChange={(p) => setV((o) => ({ ...o, ...p }))} />
      <pre data-testid="value">{JSON.stringify(v)}</pre>
    </>
  );
}
const value = () => JSON.parse(screen.getByTestId("value").textContent || "{}");

describe("LeadCardFields", () => {
  it("searches RJ cities by part of the name and can clear the choice", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox", { name: "Cidade" }));
    fireEvent.change(screen.getByPlaceholderText("Digite parte do nome..."), { target: { value: "sao g" } });
    fireEvent.click(await screen.findByRole("option", { name: "São Gonçalo" }));
    expect(value().city).toBe("São Gonçalo");

    fireEvent.click(screen.getByRole("combobox", { name: "Cidade" }));
    fireEvent.click(await screen.findByRole("option", { name: "Limpar cidade" }));
    expect(value().city).toBeUndefined();
  });

  it("only asks for the date after a next action is chosen", () => {
    render(<Harness />);
    expect(screen.queryByLabelText("Data da próxima ação")).toBeNull();
    render(<Harness initial={{ nextAction: "ligacao" }} />);
    expect(screen.getByLabelText("Data da próxima ação")).toBeInTheDocument();
  });

  it("edits the last contact as a calendar date", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Último contato"), { target: { value: "2026-11-03" } });
    expect(new Date(value().lastContactAt).getDate()).toBe(3);
  });
});

describe("validateLeadCardFields", () => {
  it("requires action and date together", () => {
    expect(validateLeadCardFields({})).toEqual({});
    expect(validateLeadCardFields({ nextAction: "visita" })).toHaveProperty("nextActionAt");
    expect(validateLeadCardFields({ nextActionAt: "2026-11-06T17:00:00Z" })).toHaveProperty("nextAction");
    expect(validateLeadCardFields({ nextAction: "visita", nextActionAt: "2026-11-06T17:00:00Z" })).toEqual({});
  });
});
