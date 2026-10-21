import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { mergeCrmMatches } from "./crmClientSearch";

describe("mergeCrmMatches", () => {
  it("keeps the ERP id of synced clients and lists clients before leads", () => {
    const result = mergeCrmMatches(
      [{ name: "SERCOM LTDA", phone: "5522997790273", cpf_cnpj: "123", erp_id: "00005490", linked_erp_client_id: null }],
      [{ client_name: "Serc Obras", client_phone: "5521983160797" }],
    );
    expect(result).toEqual([
      { erpId: "00005490", name: "SERCOM LTDA", phone: "5522997790273", document: "123", source: "crm" },
      { erpId: "", name: "Serc Obras", phone: "5521983160797", source: "crm" },
    ]);
  });

  it("drops a lead that repeats a client's name and phone, and blank names", () => {
    const result = mergeCrmMatches(
      [{ name: "SERCOM", phone: "(22) 99779-0273", cpf_cnpj: null, erp_id: null, linked_erp_client_id: "77" }],
      [{ client_name: "sercom", client_phone: "22997790273" }, { client_name: " ", client_phone: "1" }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].erpId).toBe("77");
  });
});
