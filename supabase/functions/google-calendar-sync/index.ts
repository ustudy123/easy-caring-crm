// Edge Function: google-calendar-sync
// Sincroniza a Agenda do CRM com o Google Agenda dos vendedores da equipe externa.
//  - Agendamento (Supabase → Integrations → Cron, a cada 5 minutos): sem usuário
//    logado, roda para todas as conexões (cada uma no máximo a cada 60 s).
//  - Botão "Sincronizar agora" no CRM: POST { sellerId } com o token do usuário;
//    roda só para aquele vendedor (admin, gerente da loja ou o próprio vendedor).
// Secrets: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { syncConnection, type SyncResult } from "../_shared/googleCalendar.ts";
import { claimConnections, supabaseSyncStore } from "../_shared/googleCalendarStore.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Papel do token (a assinatura já foi conferida pelo gateway: verify_jwt). */
function tokenRole(authHeader: string): string | null {
  try {
    const payload = authHeader.replace(/^Bearer\s+/i, "").split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof decoded.role === "string" ? decoded.role : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json({ error: "Google Agenda ainda não configurado: faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos Secrets do Supabase." }, 503);
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const authHeader = req.headers.get("Authorization") || "";

    let sellerId: string | null = null;
    let minIntervalSeconds = 60;
    if (tokenRole(authHeader) === "authenticated") {
      const caller = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
      const { data: userData, error: userErr } = await caller.auth.getUser();
      if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);
      const body = await req.json().catch(() => ({}));
      sellerId = typeof body.sellerId === "string" ? body.sellerId : null;
      if (!sellerId) return json({ error: "Informe o vendedor" }, 400);
      const { data: allowed, error: permErr } = await caller.rpc("can_view_seller", { _seller_id: sellerId });
      if (permErr) return json({ error: "Falha ao verificar permissão" }, 500);
      if (!allowed) return json({ error: "Sem permissão para este vendedor" }, 403);
      minIntervalSeconds = 10;
    }

    const connections = await claimConnections(admin, sellerId, minIntervalSeconds);
    if (sellerId && connections.length === 0) {
      return json({ synced: 0, busy: true, message: "Sincronizado há poucos segundos. Tente de novo em instantes." });
    }

    const store = supabaseSyncStore(admin);
    const results: SyncResult[] = [];
    for (const conn of connections) {
      try {
        results.push(await syncConnection(conn, { store, fetchFn: fetch, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }));
      } catch (e) {
        const message = `Falha ao sincronizar com o Google: ${(e as Error).message}`;
        console.error("google-calendar-sync", conn.seller_id, e);
        await store.finish(conn.seller_id, { status: "error", last_error: message }).catch(() => undefined);
        results.push({ sellerId: conn.seller_id, status: "error", pushed: 0, removed: 0, pulled: {}, error: message });
      }
    }
    return json({ synced: results.length, results });
  } catch (e) {
    console.error("google-calendar-sync", e);
    return json({ error: (e as Error).message || "Erro inesperado" }, 500);
  }
});
