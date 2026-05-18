// Edge Function: citel-get-client (Direct Endpoint Edition)
// Usa /cliente/telefone descoberto via Swagger — busca instantânea (<2s).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

function cleanApiBase(raw: string): string {
  return (raw || "").trim().replace(/\/+$/, "")
    .replace(/\/swagger-ui(\.html)?$/i, "")
    .replace(/\/swagger\/index\.html$/i, "")
    .replace(/\/swagger$/i, "")
    .replace(/\/doc(s)?$/i, "")
    .replace(/\/+$/, "");
}

function pickStr(raw: Record<string, any>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function pickFromNestedArray(raw: Record<string, any>, arrayKey: string, ...keys: string[]): string | undefined {
  const arr = raw[arrayKey];
  if (!Array.isArray(arr)) return undefined;
  for (const item of arr) {
    if (item && typeof item === "object") {
      const v = pickStr(item as Record<string, any>, ...keys);
      if (v) return v;
    }
  }
  return undefined;
}

function mapErpClient(raw: Record<string, any>) {
  const addressParts = [
    pickStr(raw, "endereco", "address", "logradouro", "rua"),
    pickStr(raw, "numero", "number"),
    pickStr(raw, "bairro", "neighborhood"),
  ].filter(Boolean);

  return {
    erpId: pickStr(raw, "codigoCliente", "codigo_cliente", "id", "codigo", "code", "cod", "codCliente", "cod_cliente", "idCliente", "autoIncrem"),
    name: pickStr(raw, "nome", "name", "razaoSocial", "razao_social", "fantasia") || "Cliente ERP",
    email: pickStr(raw, "email", "e_mail", "eMail") || pickFromNestedArray(raw, "clienteCompradorPrincipal", "emailCompraPrincipal"),
    address: addressParts.length ? addressParts.join(", ") : pickStr(raw, "address"),
    city: (raw.cidade && typeof raw.cidade === "object" ? pickStr(raw.cidade as any, "nomeCidade", "nome", "name") : pickStr(raw, "cidade", "city", "municipio")),
    cpfCnpj: pickStr(raw, "cpfCnpj", "cpf_cnpj", "cnpj", "cpf", "documento", "cnpjCpf"),
    zipCode: pickStr(raw, "cep", "zipCode", "zip_code", "codigoPostal"),
    creditLimit: pickStr(raw, "limiteCredito", "limite_credito", "creditLimit", "limite"),
    lastPurchase: pickStr(raw, "ultimaCompra", "ultima_compra", "dataUltimaCompra", "data_ultima_compra", "lastPurchase", "lastPurchaseDate"),
  };
}

function extractArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const k of ["data", "items", "results", "clientes", "customers", "content", "rows", "records"]) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

 async function tryFetch(url: string, headers: Record<string, string>, timeoutMs = 20_000): Promise<{ ok: boolean, status: number, data?: any, error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    console.error(`[citel-get-client] fetch error for ${url}: ${e.message}`);
    return { ok: false, status: 0, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

 async function tryFetchWithRetry(
   url: string, 
   headers: Record<string, string>, 
   options: { attempts?: number, timeoutMs?: number, baseDelayMs?: number } = {}
 ) {
   const { attempts = 3, timeoutMs = 8000, baseDelayMs = 500 } = options;
   let lastResponse: { ok: boolean, status: number, data?: any, error?: string } = { ok: false, status: 0 };
 
   for (let i = 0; i < attempts; i++) {
     lastResponse = await tryFetch(url, headers, timeoutMs);
     
     // Retry on transient errors: timeout (0), 408 (Request Timeout), 429 (Too Many Requests), or 5xx (Server Errors)
     const isRetriable = lastResponse.status === 0 || 
                         lastResponse.status === 408 || 
                         lastResponse.status === 429 || 
                         lastResponse.status >= 500;
 
     if (lastResponse.ok || !isRetriable) return lastResponse;
 
     if (i < attempts - 1) {
       // Exponential backoff with jitter
       const delay = baseDelayMs * Math.pow(2, i) * (0.8 + Math.random() * 0.4);
       console.log(`[citel-get-client] retry attempt ${i + 1} failed status=${lastResponse.status}, waiting ${Math.round(delay)}ms for ${url}`);
       await new Promise(r => setTimeout(r, delay));
     }
   }
   return lastResponse;
 }
 
 // Simple in-memory cache to remember which endpoint works for enrichment
 const winnerEndpointsCache = new Map<string, string>();
 
 Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => null) as { phone?: string } | null;
    const targetPhone = normalizePhone(body?.phone ?? "");
    if (targetPhone.length < 10) return json({ error: "Telefone muito curto" }, 400);

    // 1. Configuração ERP (usada para chamada direta e enriquecimento)
    const apiUrl = cleanApiBase(Deno.env.get("CITEL_API_URL") ?? "");
    const auth = btoa(`${Deno.env.get("CITEL_USER")}:${Deno.env.get("CITEL_PASSWORD")}`);
    const companyCode = Deno.env.get("CITEL_EMPRESA") || "1";
    const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

     // Função auxiliar: tenta enriquecer dados via /cliente/{erpId} ou variantes
     async function enrich(erpId: string): Promise<Record<string, any> | null> {
       const enrichmentTask = (async () => {
         const companyKey = `${apiUrl}-${companyCode}`;
         const winnerTemplate = winnerEndpointsCache.get(companyKey);
         
         const candidates = [
           `${apiUrl}/cliente/${encodeURIComponent(erpId)}?codigoEmpresa=${encodeURIComponent(companyCode)}`,
           `${apiUrl}/cliente/codigo/${encodeURIComponent(erpId)}?codigoEmpresa=${encodeURIComponent(companyCode)}`,
           `${apiUrl}/cliente?codigoEmpresa=${encodeURIComponent(companyCode)}&codigoCliente=${encodeURIComponent(erpId)}`,
         ];
 
         // Prioritize the winner template if we have one
         if (winnerTemplate) {
           const winnerUrl = winnerTemplate.replace("{{erpId}}", encodeURIComponent(erpId));
           candidates.sort((a, b) => (a === winnerUrl ? -1 : b === winnerUrl ? 1 : 0));
         }
 
         for (const url of candidates) {
           console.log(`[citel-get-client] ENRICH GET ${url}`);
           const r = await tryFetchWithRetry(url, headers, { attempts: 3, timeoutMs: 8000 });
           console.log(`[citel-get-client] enrich status=${r.status} preview=${(JSON.stringify(r.data) ?? "").slice(0, 1500)}`);
           
           if (!r.ok) continue;
 
           const items = extractArray(r.data);
           const single = items.length > 0
             ? items[0]
             : (r.data && typeof r.data === "object" && !Array.isArray(r.data) ? r.data : null);
           
           if (single) {
             // Store the success pattern (using {{erpId}} as placeholder)
             if (!winnerTemplate) {
               const pattern = url.replace(encodeURIComponent(erpId), "{{erpId}}");
               winnerEndpointsCache.set(companyKey, pattern);
             }
             return single;
           }
         }
         return null;
       })();
 
       // Global budget for enrichment: 15 seconds
       const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => {
         console.log(`[citel-get-client] enrichment timed out after 15s`);
         resolve(null);
       }, 15000));
 
       return Promise.race([enrichmentTask, timeoutPromise]);
     }

    // 2. Cache local — resposta rápida; tenta enriquecer em seguida
    const { data: local } = await adminClient.from("clients").select("*").eq("phone", targetPhone).maybeSingle();
    if (local?.erp_id) {
      const baseClient: any = {
        erpId: local.erp_id, name: local.name, email: local.email,
        address: local.address, city: local.city,
      };
      const enriched = await enrich(local.erp_id);
      if (enriched) {
        const m = mapErpClient(enriched);
        return json({ found: true, strategy: "cache+enrich", client: { ...baseClient, ...m, erpId: local.erp_id } });
      }
      return json({ found: true, strategy: "cache", client: baseClient });
    }

    // 3. Chamada direta ao endpoint /cliente/telefone (descoberto via Swagger)

    // Variações: número completo, sem DDI 55, últimos 11 e últimos 10 dígitos
    const variants = Array.from(new Set<string>([
      targetPhone,
      targetPhone.startsWith("55") && targetPhone.length > 11 ? targetPhone.slice(2) : targetPhone,
      targetPhone.slice(-11),
      targetPhone.slice(-10),
    ].filter(v => v.length >= 10)));

    let lastStatus = 0;
    let lastError: string | undefined;

    for (const numero of variants) {
      const url = `${apiUrl}/cliente/telefone?codigoEmpresa=${encodeURIComponent(companyCode)}&numero=${encodeURIComponent(numero)}&somenteAtivos=true`;
      console.log(`[citel-get-client] GET ${url}`);
      const r = await tryFetch(url, headers, 30_000);
      lastStatus = r.status;
      lastError = (r as any).error;
      console.log(`[citel-get-client] status=${r.status} ok=${r.ok} bodyPreview=${(JSON.stringify(r.data) ?? "").slice(0, 2000)}`);

      if (!r.ok) continue;

      const items = extractArray(r.data);
      const single = items.length > 0
        ? items[0]
        : (r.data && typeof r.data === "object" && !Array.isArray(r.data) ? r.data : null);
      console.log(`[citel-get-client] items.length=${items.length} hasSingle=${!!single}`);
      if (!single) continue;

      const c = mapErpClient(single);
      console.log(`[citel-get-client] mapped erpId=${c.erpId} name=${c.name}`);
      if (!c.erpId) continue;

      await adminClient.from("clients").upsert({
        phone: targetPhone, name: c.name, email: c.email, address: c.address, city: c.city, erp_id: c.erpId,
      }, { onConflict: "phone" });

      // Tenta enriquecer com endpoint por código (CPF/CNPJ, CEP, limite, última compra)
      const enriched = c.erpId ? await enrich(c.erpId) : null;
      const merged = enriched ? { ...c, ...mapErpClient(enriched), erpId: c.erpId } : c;
      return json({ found: true, strategy: enriched ? "direct+enrich" : "direct", numeroUsado: numero, client: merged });
    }

    if (lastStatus === 0) {
      return json({ found: false, reason: "erp_unreachable", error: lastError });
    }
    return json({ found: false, reason: "not_found", lastStatus });
  } catch (e: any) {
    console.error("[citel-get-client] fatal", e);
    return json({ error: e.message }, 500);
  }
});