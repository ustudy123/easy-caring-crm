import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { transferAttendance } from "./transferAttendance";

describe("manual attendance transfer", () => {
  beforeEach(() => rpc.mockReset());

  it("transfers Raquel's lead to Andinho through a single transaction", async () => {
    rpc.mockResolvedValue({ data: { seller_id: "0a203eb6-4a8e-48e5-a79f-d5b288bbfea9", store_id: "bfdd7148-603e-4006-8c65-4cdaffd03987", lead_ids: ["e5ee0d1b-ab20-460c-a359-293efba5df5d"] }, error: null });
    const result = await transferAttendance({ leadId: "e5ee0d1b-ab20-460c-a359-293efba5df5d", sellerId: "0a203eb6-4a8e-48e5-a79f-d5b288bbfea9", reason: "Atendimento pelo Andinho" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("transfer_attendance", { p_lead_id: "e5ee0d1b-ab20-460c-a359-293efba5df5d", p_client_id: null, p_seller_id: "0a203eb6-4a8e-48e5-a79f-d5b288bbfea9", p_reason: "Atendimento pelo Andinho" });
    expect(result.seller_id).toBe("0a203eb6-4a8e-48e5-a79f-d5b288bbfea9");
  });

  it("uses the same transaction for a conversation", async () => {
    rpc.mockResolvedValue({ data: { seller_id: "seller", store_id: null, lead_ids: [] }, error: null });
    await transferAttendance({ clientId: "client", sellerId: "seller" });
    expect(rpc).toHaveBeenCalledWith("transfer_attendance", { p_lead_id: null, p_client_id: "client", p_seller_id: "seller", p_reason: "" });
  });

  it("propagates rejected transfers instead of reporting success", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Sem permissão para transferir este atendimento" } });
    await expect(transferAttendance({ leadId: "lead", sellerId: "seller" })).rejects.toThrow("Sem permissão para transferir este atendimento");
  });
});