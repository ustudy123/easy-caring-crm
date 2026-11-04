import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SellerCombobox } from "./SellerCombobox";

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

afterEach(cleanup);

const sellers = [
  { id: "a", name: "Raquel", isActive: true },
  { id: "b", name: "Pretinho", isActive: false },          // mapeado (Seller.isActive)
  { id: "c", name: "Nelson", is_active: false },           // cru do banco
  { id: "d", name: "Leonardo", status: "inactive" },       // status "Inativo" no Admin
  { id: "e", name: "Andinho", status: "vacation" },        // férias continua na lista
];

describe("SellerCombobox", () => {
  it("hides inactivated operators from the options", () => {
    render(<SellerCombobox value="all" onChange={() => {}} sellers={sellers} presets={[{ value: "all", label: "Todos" }]} />);
    fireEvent.click(screen.getByRole("combobox"));
    const names = screen.getAllByRole("option").map((o) => o.textContent);
    expect(names).toEqual(["Todos", "Raquel", "Andinho"]);
  });

  it("still shows the name of an inactive operator that is already selected", () => {
    render(<SellerCombobox value="b" onChange={() => {}} sellers={sellers} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Pretinho");
  });

  it("drops store groups left without active operators", () => {
    render(
      <SellerCombobox
        value="all"
        onChange={() => {}}
        groups={[
          { label: "Matriz", items: [sellers[0], sellers[1]] },
          { label: "Tijuca", items: [sellers[2]] },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByText("Tijuca")).toBeNull();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Raquel"]);
  });
});
