import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsDialog } from "./ProjectsDialog";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), role: { isVendedor: true, sellerId: "logged-seller", sellerName: "Logado" } }));
vi.mock("@/contexts/RoleContext", () => ({ useRole: () => mocks.role }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, is: () => query,
      order: () => Promise.resolve({ data: table === "sellers" ? [{ id: "main-seller", name: "Alexandre" }] : [], error: null }),
      insert: mocks.insert, update: mocks.update,
    };
    return query;
  } },
}));

describe("new project seller assignment", () => {
  beforeEach(() => { mocks.insert.mockReset(); mocks.insert.mockResolvedValue({ error: null }); });
  afterEach(cleanup);

  it("inherits the main card seller instead of the logged-in seller", async () => {
    render(<ProjectsDialog open onOpenChange={() => {}} clientPhone="21999999999" parentSellerId="main-seller" />);
    fireEvent.click(await screen.findByRole("button", { name: "Novo projeto" }));
    fireEvent.change(screen.getByPlaceholderText("Ex.: Pintura galpão A"), { target: { value: "MAQUINA GRACO" } });
    fireEvent.click(screen.getByRole("button", { name: /^Criar$/ }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ seller_id: "main-seller", name: "MAQUINA GRACO" })));
  });

  it("preserves an unassigned main card without assigning the logged-in seller", async () => {
    render(<ProjectsDialog open onOpenChange={() => {}} clientPhone="21999999999" parentSellerId={null} />);
    fireEvent.click(await screen.findByRole("button", { name: "Novo projeto" }));
    fireEvent.change(screen.getByPlaceholderText("Ex.: Pintura galpão A"), { target: { value: "Projeto sem vendedor" } });
    fireEvent.click(screen.getByRole("button", { name: /^Criar$/ }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ seller_id: null })));
  });
});