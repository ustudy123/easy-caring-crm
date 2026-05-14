// Edge Function: citel-get-client
// Busca cliente no ERP CITEL por telefone (Basic Auth server-side).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (body: unknown, status = 200) => 
  new Response(JSON.stringify(body), { 
    status, 
    headers: { ...corsHeaders, "Content-Type": "application/json" } 
  });

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

// Mapeia defensivamente os campos possíveis retornados pelo ERP.
function mapErpClient(raw: Record<string, unknown>) {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = raw[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return undefined;
  };
  return {
    erpId: pick("id", "codigo", "cod_cliente", "idCliente", "customerId"),
    name: pick("nome", "name", "razaoSocial", "razao_social", "fantasia"),
    email: pick("email", "e_mail"),
    address: pick("endereco", "address", "logradouro", "rua"),
    city: pick("cidade", "city", "municipio"),
  };
}

async function tryFetch(url: string, auth: string, timeoutMs = 10000) {
  console.log("[citel-get-client] GET", url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    console.log("[citel-get-client] status", res.status, "url", url);
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    console.error("[citel-get-client] fetch error", url, e.name, e.message);
    return { ok: false, status: 0, error: e.name, message: e.message };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // --- Auth: exige usuário logado ---
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing authorization" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      console.error("[citel-get-client] auth error", userErr);
      return json({ error: "Unauthorized" }, 401);
    }

    // --- Body ---
    const body = await req.json().catch(() => null) as { phone?: string } | null;
    const phone = normalizePhone(body?.phone ?? "");
    if (phone.length < 10 || phone.length > 11) {
      return json({ error: "Telefone inválido" }, 400);
    }

    // --- Secrets CITEL ---
    // Sanitiza a URL base removendo sufixos de Swagger UI/docs para evitar
    // que endpoints sejam concatenados após "/doc/swagger-ui.html".
    const apiUrl = (Deno.env.get("CITEL_API_URL") ?? "")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/swagger-ui(\.html)?$/i, "")
      .replace(/\/swagger\/index\.html$/i, "")
      .replace(/\/swagger$/i, "")
      .replace(/\/doc(s)?$/i, "")
      .replace(/\/+$/, "");
    const user = Deno.env.get("CITEL_USER") ?? "";
    const password = Deno.env.get("CITEL_PASSWORD") ?? "";
    if (!apiUrl || !user || !password) {
      console.error("[citel-get-client] missing CITEL secrets");
      return json({ error: "Integração CITEL não configurada" }, 500);
    }
    if (apiUrl.startsWith("http://")) {
      console.warn("[citel-get-client] CITEL endpoint is HTTP (no TLS)");
    }
    const auth = btoa(`${user}:${password}`);

    // --- Tenta endpoints prováveis ---
    const candidates = [
      `${apiUrl}/cliente/telefone?numero=${encodeURIComponent(phone)}`,
      `${apiUrl}/cliente?telefone=${encodeURIComponent(phone)}`,
      `${apiUrl}/cliente?numero=${encodeURIComponent(phone)}`,
      `${apiUrl}/cliente?celular=${encodeURIComponent(phone)}`,
    ];

    let last: { status: number; data?: unknown; error?: string } | null = null;
    let anyNetworkSuccess = false;

    for (const url of candidates) {
      anyNetworkSuccess = false;
      try {
        const r = await tryFetch(url, auth);
        last = { status: r.status, data: r.data };
        if (r.ok) {
          const arr = Array.isArray(r.data)
            ? r.data
            : (r.data && typeof r.data === "object" && Array.isArray((r.data as any).data))
              ? (r.data as any).data
              : (r.data && typeof r.data === "object" && Array.isArray((r.data as any).items))
                ? (r.data as any).items
                : r.data
                  ? [r.data]
                  : [];
          if (arr.length === 0) continue;
          const client = mapErpClient(arr[0] as Record<string, unknown>);
          // Se temos nome ou ID, consideramos sucesso
          if (!client.name && !client.erpId) continue;
          return json({ found: true, client });
        }
        if (r.status > 0) anyNetworkSuccess = true;
        if (r.status !== 404 && r.status !== 400) {
          console.error("[citel-get-client] ERP error", r.status, r.data);
        }
      } catch (e) {
        // J\u00e1 tratado no tryFetch
      }
    }

    if (!anyNetworkSuccess && last?.status === 0) {
      return json({ found: false, reason: "erp_unreachable", detail: last?.error });
    }
    console.log("[citel-get-client] no match; last response", last?.status);
    return json({ found: false, reason: "not_found" });
  } catch (e) {
    console.error("[citel-get-client] unexpected", e);
    return json({ error: "Erro ao consultar ERP" }, 500);
  }
});
