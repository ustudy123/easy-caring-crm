// Edge Function: google-calendar-auth
// Conecta (e desconecta) o Google Agenda de um vendedor da equipe externa.
//  POST { action: "start", sellerId, returnTo }  → { url } da tela de autorização do Google
//  POST { action: "disconnect", sellerId }        → remove a conexão
//  GET  ?code&state                               → volta do Google: guarda o acesso,
//       cria a agenda "CRM Taeco · Nome" e devolve a pessoa ao CRM.
// verify_jwt = false (config.toml): a volta do Google não traz o token do CRM;
// o POST confere o usuário aqui e o GET vale só com o "state" assinado.
// Secrets: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  GoogleAuthError, GoogleCalendarApi, buildAuthUrl, exchangeCode, revokeToken, safeReturnTo, signState,
  verifyState, withQuery,
} from "../_shared/googleCalendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const page = (message: string, status = 400) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CRM Taeco</title><p style="font-family:sans-serif;padding:24px">${message}</p>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

const STATE_TTL_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-auth`;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  if (!CLIENT_ID || !CLIENT_SECRET) {
    const msg = "Google Agenda ainda não configurado: faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos Secrets do Supabase.";
    return req.method === "GET" ? page(msg, 503) : json({ error: msg }, 503);
  }

  // ── Volta do Google ─────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const state = await verifyState(url.searchParams.get("state") ?? "", CLIENT_SECRET);
    if (!state) return page("Este link de conexão expirou. Volte ao CRM e clique em “Conectar Google Agenda” de novo.");
    const back = (google: string) => Response.redirect(withQuery(state.returnTo, { google, vendedor: state.sellerId }), 302);

    const googleError = url.searchParams.get("error");
    if (googleError) return back(googleError === "access_denied" ? "cancelado" : "erro");
    const code = url.searchParams.get("code");
    if (!code) return back("erro");

    try {
      const tokens = await exchangeCode(fetch, { code, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri });
      const api = new GoogleCalendarApi(fetch, tokens.accessToken);

      const { data: seller, error: sellerErr } = await admin.from("sellers").select("id, name").eq("id", state.sellerId).maybeSingle();
      if (sellerErr || !seller) throw new Error("Vendedor não encontrado");
      const { data: existing } = await admin.from("google_calendar_connections")
        .select("calendar_id").eq("seller_id", state.sellerId).maybeSingle();

      // Reconexão na mesma conta: reaproveita a agenda; senão cria uma nova.
      let calendarId: string | null = existing?.calendar_id ?? null;
      if (calendarId && !(await api.calendarExists(calendarId))) calendarId = null;
      const reused = !!calendarId;
      if (!calendarId) {
        const created = await api.createCalendar(
          `CRM Taeco · ${seller.name}`,
          "Compromissos do CRM Taeco. O que você marcar aqui também aparece na Agenda do CRM.",
        );
        calendarId = created.id;
      }
      if (!reused) {
        const { error } = await admin.from("google_calendar_event_links").delete().eq("seller_id", state.sellerId);
        if (error) throw new Error(error.message);
      }

      const { error: saveErr } = await admin.from("google_calendar_connections").upsert({
        seller_id: state.sellerId,
        google_email: tokens.email,
        calendar_id: calendarId,
        refresh_token: tokens.refreshToken,
        access_token: tokens.accessToken,
        access_token_expires_at: tokens.expiresAt,
        sync_token: null,
        status: "active",
        last_error: null,
        last_synced_at: null,
        sync_lock_until: null,
        connected_at: new Date().toISOString(),
        connected_by: state.userId,
      }, { onConflict: "seller_id" });
      if (saveErr) throw new Error(saveErr.message);

      // Leva para o Google os compromissos desde 7 dias atrás; a próxima
      // sincronização (o CRM chama logo ao voltar) envia.
      const { error: backfillErr } = await admin.rpc("google_calendar_enqueue_backfill", { _seller_id: state.sellerId });
      if (backfillErr) throw new Error(backfillErr.message);

      return back("conectado");
    } catch (e) {
      console.error("google-calendar-auth: falha ao conectar", e);
      return back(e instanceof GoogleAuthError && e.code === "scope_denied" ? "permissao" : "erro");
    }
  }

  // ── Iniciar / desconectar (usuário logado no CRM) ───────────────────────────
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const sellerId = typeof body.sellerId === "string" ? body.sellerId : "";
    if (!sellerId) return json({ error: "Informe o vendedor" }, 400);

    // Admin, gerente da loja do vendedor ou o próprio vendedor.
    const { data: allowed, error: permErr } = await caller.rpc("can_view_seller", { _seller_id: sellerId });
    if (permErr) return json({ error: "Falha ao verificar permissão" }, 500);
    if (!allowed) return json({ error: "Sem permissão para este vendedor" }, 403);

    if (body.action === "start") {
      const { data: seller } = await admin.from("sellers").select("store_id").eq("id", sellerId).maybeSingle();
      const { data: store } = seller?.store_id
        ? await admin.from("stores").select("is_external_team").eq("id", seller.store_id).maybeSingle()
        : { data: null };
      if (!store?.is_external_team) return json({ error: "O Google Agenda é só para os vendedores da equipe externa." }, 400);

      const returnTo = safeReturnTo(body.returnTo, "");
      if (!returnTo) return json({ error: "Endereço de retorno inválido" }, 400);
      const state = await signState({ sellerId, userId: userData.user.id, returnTo, exp: Date.now() + STATE_TTL_MS }, CLIENT_SECRET);
      return json({ url: buildAuthUrl({ clientId: CLIENT_ID, redirectUri, state }) });
    }

    if (body.action === "disconnect") {
      const { data: conn } = await admin.from("google_calendar_connections")
        .select("refresh_token, google_email").eq("seller_id", sellerId).maybeSingle();
      for (const table of ["google_calendar_outbox", "google_calendar_event_links", "google_calendar_connections"]) {
        const { error } = await admin.from(table).delete().eq("seller_id", sellerId);
        if (error) return json({ error: error.message }, 500);
      }
      // Revogar no Google tira o acesso do app à conta inteira: só faz isso se
      // nenhum outro vendedor usa a mesma conta (ex.: um Gmail só para agendas).
      if (conn?.refresh_token) {
        const { count } = conn.google_email
          ? await admin.from("google_calendar_connections").select("seller_id", { count: "exact", head: true }).eq("google_email", conn.google_email)
          : { count: 0 };
        if (!count) await revokeToken(fetch, conn.refresh_token);
      }
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("google-calendar-auth", e);
    return json({ error: (e as Error).message || "Erro inesperado" }, 500);
  }
});
