// Edge Function: citel-list-all
// Lista TODOS os clientes da API CITEL (com paginação automática) e retorna
// os registros brutos + mapeados, SEM gravar no banco. Usado para visualização
// na aba "API Citel" do painel admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function pickStr(raw: Record<string, any>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function mapErpClient(raw: Record<string, any>) {
  return {
    id: pickStr(raw, "id", "codigo", "code", "cod", "codCliente", "cod_cliente"),
    name: pickStr(raw, "nome", "name", "razaoSocial", "razao_social", "fantasia", "nomeFantasia", "nome_fantasia") || "Cliente ERP",
    phone: pickStr(raw, "telefone", "phone", "celular", "mobile", "fone", "telefone1", "telefoneCelular") || "",
    email: pickStr(raw, "email", "e_mail", "eMail"),
    address: pickStr(raw, "endereco", "address", "logradouro", "rua"),
    city: pickStr(raw, "cidade", "city", "municipio"),
    document: pickStr(raw, "cpf", "cnpj", "documento", "cpfCnpj", "cpf_cnpj"),
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

async function tryFetch(url: string, auth: string) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 500); }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: `fetch_error: ${(e as Error).message}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const apiUrl = (Deno.env.get("CITEL_API_URL") ?? "").replace(/\/+$/, "");
    const erpUser = Deno.env.get("CITEL_USER") ?? "";
    const erpPass = Deno.env.get("CITEL_PASSWORD") ?? "";
    if (!apiUrl || !erpUser || !erpPass) return json({ error: "Integração CITEL não configurada" }, 500);
    const auth = btoa(`${erpUser}:${erpPass}`);

    // Descobrir endpoint via Swagger
    const swaggerCandidates = [
      `${apiUrl}/swagger/v1/swagger.json`,
      `${apiUrl}/swagger.json`,
      `${apiUrl}/v2/api-docs`,
      `${apiUrl}/openapi.json`,
    ];
    let swaggerDoc: any = null;
    for (const u of swaggerCandidates) {
      const r = await tryFetch(u, auth);
      if (r.ok && r.data && typeof r.data === "object") { swaggerDoc = r.data; break; }
    }

    const discoveredPaths: string[] = [];
    if (swaggerDoc?.paths && typeof swaggerDoc.paths === "object") {
      for (const [p, def] of Object.entries(swaggerDoc.paths as Record<string, any>)) {
        if (def && typeof def === "object" && def.get) {
          const lower = p.toLowerCase();
          if ((lower.includes("client") || lower.includes("custom")) && !p.includes("{")) {
            discoveredPaths.push(p);
          }
        }
      }
    }

    const listEndpoints = Array.from(new Set([
      ...discoveredPaths.map((p) => `${apiUrl}${p}`),
      `${apiUrl}/api/clientes`,
      `${apiUrl}/api/customers`,
      `${apiUrl}/api/Clientes`,
      `${apiUrl}/api/v1/clientes`,
    ]));

    let workingBase: string | null = null;
    let firstBatch: any[] = [];
    const attempts: Array<{ url: string; status: number; count: number }> = [];

    for (const url of listEndpoints) {
      const r = await tryFetch(url, auth);
      const arr = r.ok ? extractArray(r.data) : [];
      attempts.push({ url, status: r.status, count: arr.length });
      if (r.ok && arr.length > 0) {
        workingBase = url;
        firstBatch = arr;
        break;
      }
    }

    if (!workingBase) {
      return json({ success: false, message: "Nenhum endpoint de clientes retornou dados.", attempts });
    }

    // Paginação
    const all: any[] = [...firstBatch];
    const pageStrategies = [
      (n: number) => `${workingBase}?page=${n}&pageSize=200`,
      (n: number) => `${workingBase}?page=${n}&size=200`,
      (n: number) => `${workingBase}?pagina=${n}&porPagina=200`,
      (n: number) => `${workingBase}?offset=${(n - 1) * 200}&limit=200`,
    ];

    let strategy: ((n: number) => string) | null = null;
    for (const s of pageStrategies) {
      const r = await tryFetch(s(2), auth);
      const arr = r.ok ? extractArray(r.data) : [];
      if (arr.length > 0 && JSON.stringify(arr[0]) !== JSON.stringify(firstBatch[0])) {
        strategy = s;
        all.push(...arr);
        break;
      }
    }

    if (strategy) {
      for (let page = 3; page < 200; page++) {
        const r = await tryFetch(strategy(page), auth);
        if (!r.ok) break;
        const arr = extractArray(r.data);
        if (arr.length === 0) break;
        all.push(...arr);
        if (arr.length < 50) break;
      }
    }

    const mapped = all.map((c) => mapErpClient(c as Record<string, any>));

    return json({
      success: true,
      total: all.length,
      endpoint: workingBase,
      paginated: !!strategy,
      clients: mapped,
      raw: all,
    });
  } catch (e) {
    console.error("[citel-list-all] error", e);
    return json({ error: String(e) }, 500);
  }
});