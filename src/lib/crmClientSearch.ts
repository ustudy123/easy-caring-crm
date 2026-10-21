import { supabase } from "@/integrations/supabase/client";

/** Resultado no mesmo formato da busca ERP (citel-search-name), marcado como vindo do CRM. */
export interface CrmClientMatch {
  erpId: string;
  name: string;
  phone?: string;
  document?: string;
  source: "crm";
}

type ClientRow = { name: string | null; phone: string | null; cpf_cnpj: string | null; erp_id: string | null; linked_erp_client_id: string | null };
type LeadRow = { client_name: string | null; client_phone: string | null };

/** Junta clientes e leads do CRM, sem repetir o mesmo nome+telefone; clientes (com ERP id) primeiro. */
export function mergeCrmMatches(clients: ClientRow[], leads: LeadRow[]): CrmClientMatch[] {
  const seen = new Set<string>();
  const out: CrmClientMatch[] = [];
  const push = (m: CrmClientMatch) => {
    const key = `${m.name.trim().toLowerCase()}|${(m.phone || "").replace(/\D/g, "")}`;
    if (!m.name.trim() || seen.has(key)) return;
    seen.add(key);
    out.push(m);
  };
  for (const c of clients) {
    push({ erpId: c.erp_id || c.linked_erp_client_id || "", name: c.name || "", phone: c.phone || undefined, document: c.cpf_cnpj || undefined, source: "crm" });
  }
  for (const l of leads) {
    push({ erpId: "", name: l.client_name || "", phone: l.client_phone || undefined, source: "crm" });
  }
  return out;
}

/**
 * Busca por parte do nome nos clientes e leads do CRM. Fallback da busca no ERP:
 * cobre o ERP fora do ar e clientes que ainda não estão (ou não são achados) lá.
 */
export async function searchCrmClients(query: string): Promise<CrmClientMatch[]> {
  const term = query.trim().replace(/[%_,()]/g, "");
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const [clients, leads] = await Promise.all([
    supabase.from("clients").select("name, phone, cpf_cnpj, erp_id, linked_erp_client_id")
      .ilike("name", like).is("hidden_at", null).limit(15),
    supabase.from("leads").select("client_name, client_phone")
      .ilike("client_name", like).is("hidden_at", null).limit(15),
  ]);
  if (clients.error) console.error("CRM client search failed:", clients.error);
  if (leads.error) console.error("CRM lead search failed:", leads.error);
  return mergeCrmMatches((clients.data || []) as ClientRow[], (leads.data || []) as LeadRow[]);
}
