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
 
 // Verifica se o telefone (últimos 10 ou 11 dígitos) bate com o alvo
 function phoneMatches(rawPhone: any, targetPhone: string): boolean {
   if (!rawPhone) return false;
   const digits = String(rawPhone).replace(/\D/g, "");
   if (digits.length < 10) return false;
   // Compara os últimos 10 ou 11 dígitos para ignorar DDI ou prefixos extras
   const suffixLength = targetPhone.length; // 10 ou 11
   return digits.endsWith(targetPhone);
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
     phone: pick("telefone", "celular", "fone", "whatsapp", "contato"),
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
 
     // --- 1. Cache Local ---
     const { data: localClient } = await supabase
       .from("clients")
       .select("*")
       .eq("phone", phone)
       .maybeSingle();
 
     if (localClient?.erp_id) {
       console.log("[citel-get-client] local cache hit", phone);
       return json({ 
         found: true, 
         strategy: "cache",
         client: {
           erpId: localClient.erp_id,
           name: localClient.name,
           email: localClient.email,
           address: localClient.address,
           city: localClient.city,
         }
       });
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
 
     // --- 2. Camada A: Endpoints Dedicados ---
     const candidates = [
       `${apiUrl}/cliente/telefone/${phone}`,
       `${apiUrl}/cliente/telefone?numero=${encodeURIComponent(phone)}`,
       `${apiUrl}/cliente?telefone=${encodeURIComponent(phone)}`,
       `${apiUrl}/cliente?numero=${encodeURIComponent(phone)}`,
     ];
 
     let last: { status: number; data?: unknown; error?: string } | null = null;
     let anyNetworkSuccess = false;
 
     for (const url of candidates) {
       const r = await tryFetch(url, auth, 5000); // Timeout curto para candidatos
       last = { status: r.status, data: r.data };
       if (r.status > 0) anyNetworkSuccess = true;
       
       if (r.ok) {
         const arr = Array.isArray(r.data) ? r.data : [r.data].filter(Boolean);
         if (arr.length > 0) {
           const client = mapErpClient(arr[0] as Record<string, unknown>);
           if (client.name || client.erpId) {
             // Salva no cache
             await supabase.from("clients").upsert({
               phone: phone,
               name: client.name,
               email: client.email,
               address: client.address,
               city: client.city,
               erp_id: client.erpId,
             }, { onConflict: "phone" });
 
             return json({ found: true, strategy: "endpoint", client });
           }
         }
       }
     }
 
     // --- 3. Camada B: Varredura por Paginação ---
     console.log("[citel-get-client] fallback: scanning /cliente pagination...");
     const maxPages = 20;
     for (let p = 1; p <= maxPages; p++) {
       const scanUrl = `${apiUrl}/cliente?numeroPagina=${p}&quantidadeRegistro=200`;
       const r = await tryFetch(scanUrl, auth, 12000);
       if (!r.ok) break;
 
       const data: any = r.data;
       const list = Array.isArray(data) ? data : (data?.data || data?.items || []);
       if (!Array.isArray(list) || list.length === 0) break;
 
       for (const item of list) {
         const c = mapErpClient(item);
         // Verifica múltiplos campos de telefone
         const possiblePhones = [
           item.telefone, item.celular, item.fone, item.whatsapp, 
           item.telefoneComercial, item.telefoneResidencial,
           ...(item.contatos?.map((ctx: any) => ctx.telefone) || [])
         ];
 
         if (possiblePhones.some(raw => phoneMatches(raw, phone))) {
           console.log("[citel-get-client] match found on page", p);
           // Salva no cache
           await supabase.from("clients").upsert({
             phone: phone,
             name: c.name,
             email: c.email,
             address: c.address,
             city: c.city,
             erp_id: c.erpId,
           }, { onConflict: "phone" });
 
           return json({ found: true, strategy: "scan", page: p, client: c });
         }
       }
     }
 
     if (!anyNetworkSuccess && last?.status === 0) {
       return json({ found: false, reason: "erp_unreachable", detail: last?.error });
     }
     console.log("[citel-get-client] no match after scan; last status", last?.status);
     return json({ found: false, reason: "not_found" });
  } catch (e) {
    console.error("[citel-get-client] unexpected", e);
    return json({ error: "Erro ao consultar ERP" }, 500);
  }
});
