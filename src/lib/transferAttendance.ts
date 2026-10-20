import { supabase } from "@/integrations/supabase/client";

interface TransferAttendanceInput {
  sellerId: string;
  leadId?: string;
  clientId?: string;
  reason?: string;
}

export interface TransferAttendanceResult {
  seller_id: string;
  store_id: string | null;
  lead_ids: string[];
}

export async function transferAttendance(input: TransferAttendanceInput): Promise<TransferAttendanceResult> {
  const { data, error } = await supabase.rpc("transfer_attendance", {
    p_seller_id: input.sellerId,
    p_lead_id: input.leadId ?? null,
    p_client_id: input.clientId ?? null,
    p_reason: input.reason ?? "",
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)
    || typeof data.seller_id !== "string" || !Array.isArray(data.lead_ids)
    || !data.lead_ids.every((id) => typeof id === "string")
    || (data.store_id !== null && typeof data.store_id !== "string")) {
    throw new Error("Não foi possível confirmar a transferência. Atualize a tela antes de tentar novamente.");
  }
  return { seller_id: data.seller_id, store_id: typeof data.store_id === "string" ? data.store_id : null, lead_ids: data.lead_ids as string[] };
}