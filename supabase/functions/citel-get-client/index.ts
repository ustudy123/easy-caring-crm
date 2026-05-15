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

async function tryFetch(url: string, headers: Record<string, string>, timeoutMs = 20_000) {
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

    // 1. Cache local desativado temporariamente (faltavam campos novos: cpfCnpj, cep, limite, última compra)

    // 2. Chamada direta ao endpoint /cliente/telefone (descoberto via Swagger)
    const apiUrl = cleanApiBase(Deno.env.get("CITEL_API_URL") ?? "");
    const auth = btoa(`${Deno.env.get("CITEL_USER")}:${Deno.env.get("CITEL_PASSWORD")}`);
    const companyCode = Deno.env.get("CITEL_EMPRESA") || "1";
    const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

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
      console.log(`[citel-get-client] status=${r.status} ok=${r.ok} bodyPreview=${JSON.stringify(r.data).slice(0, 500)}`);

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

      return json({ found: true, strategy: "direct", numeroUsado: numero, client: c });
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