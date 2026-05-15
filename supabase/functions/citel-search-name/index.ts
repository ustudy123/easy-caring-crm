// Edge Function: citel-search-name
// Busca clientes no ERP CITEL por parte do nome via /cliente?nome=...
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

function mapErpClient(raw: Record<string, any>) {
  const addressParts = [
    pickStr(raw, "endereco", "address", "logradouro", "rua"),
    pickStr(raw, "numero", "number"),
    pickStr(raw, "bairro", "neighborhood"),
  ].filter(Boolean);
  return {
    erpId: pickStr(raw, "id", "codigo", "code", "cod", "codCliente", "cod_cliente", "idCliente"),
    name: pickStr(raw, "nome", "name", "razaoSocial", "razao_social", "fantasia") || "Cliente ERP",
    document: pickStr(raw, "cpf", "cnpj", "cpfCnpj", "numeroDocumento", "documento"),
    email: pickStr(raw, "email", "e_mail", "eMail"),
    phone: pickStr(raw, "telefone", "celular", "fone", "whatsapp"),
    city: pickStr(raw, "cidade", "city", "municipio"),
    address: addressParts.length ? addressParts.join(", ") : pickStr(raw, "address"),
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null) as { name?: string } | null;
    const name = (body?.name ?? "").trim();
    if (name.length < 2) return json({ error: "Informe ao menos 2 caracteres do nome" }, 400);

    const apiUrl = cleanApiBase(Deno.env.get("CITEL_API_URL") ?? "");
    const auth = btoa(`${Deno.env.get("CITEL_USER")}:${Deno.env.get("CITEL_PASSWORD")}`);
    const companyCode = Deno.env.get("CITEL_EMPRESA") || "1";
    const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

    const url = `${apiUrl}/cliente?codigoEmpresa=${encodeURIComponent(companyCode)}&nome=${encodeURIComponent(name)}&quantidadeRegistro=50&numeroPagina=1`;
    console.log(`[citel-search-name] GET ${url}`);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch(url, { headers, signal: ctrl.signal });
    } catch (e: any) {
      clearTimeout(timer);
      return json({ found: false, reason: "erp_unreachable", error: e.message });
    }
    clearTimeout(timer);

    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    console.log(`[citel-search-name] status=${res.status} preview=${JSON.stringify(data).slice(0, 300)}`);

    if (!res.ok) {
      return json({ found: false, reason: "erp_error", status: res.status, body: data });
    }

    const items = extractArray(data);
    const results = items.map(mapErpClient).filter(c => c.name);
    return json({ found: results.length > 0, total: results.length, results, query: name });
  } catch (e: any) {
    console.error("[citel-search-name] fatal", e);
    return json({ error: e.message }, 500);
  }
});