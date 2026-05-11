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
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type FetchResult = {
  ok: boolean;
  status: number;
  data: any;
  preview: string;
};

type HeaderVariant = {
  label: string;
  headers: Record<string, string>;
};

type WorkingEndpoint = {
  url: string;
  headers: Record<string, string>;
  label: string;
  data: any;
  batch: any[];
};

function cleanApiBase(raw: string): string {
  return (raw || "")
    .trim()
    .replace(/\/+$/, "")
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
    id: pickStr(raw, "id", "codigo", "code", "cod", "codCliente", "cod_cliente", "idCliente"),
    name: pickStr(raw, "nome", "name", "razaoSocial", "razao_social", "fantasia", "nomeFantasia", "nome_fantasia") || "Cliente ERP",
    phone:
      pickStr(raw, "telefone", "phone", "celular", "mobile", "fone", "telefone1", "telefoneCelular", "telefoneCobranca", "telexCelular") ||
      pickFromNestedArray(raw, "clienteCompradorPrincipal", "celularCompraPrincipal", "telefoneCompraPrincipal") ||
      pickFromNestedArray(raw, "clienteCompradores", "numWhatsAppComprador", "celularComprador", "telefoneComprador") ||
      pickFromNestedArray(raw, "enderecoEntrega", "telefone") ||
      "",
    email:
      pickStr(raw, "email", "e_mail", "eMail", "emailNfe") ||
      pickFromNestedArray(raw, "clienteCompradorPrincipal", "emailCompraPrincipal") ||
      pickFromNestedArray(raw, "clienteCompradores", "emailComprador"),
    address: addressParts.length ? addressParts.join(", ") : pickStr(raw, "address"),
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

function continuationToken(data: any): string | null {
  if (!data || typeof data !== "object") return null;
  const token = data.continuationToken ?? data.continuation_token ?? data.nextToken ?? data.next_token;
  if (typeof token === "string" && token.trim()) return token.trim();
  if (typeof token === "number") return String(token);
  return null;
}

function appendQuery(url: string, params: Record<string, string | number | undefined>): string {
  const u = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") u.searchParams.set(key, String(value));
  }
  return u.toString();
}

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path.replace(/\/+$/, "");
  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

function swaggerBases(swaggerDoc: any, apiUrl: string): string[] {
  const bases = [apiUrl];
  const add = (value?: string) => {
    if (!value) return;
    const cleaned = value.replace(/\/+$/, "");
    if (cleaned && !bases.includes(cleaned)) bases.push(cleaned);
  };

  if (typeof swaggerDoc?.basePath === "string" && swaggerDoc.basePath !== "/") {
    add(joinUrl(apiUrl, swaggerDoc.basePath));
  }

  if (Array.isArray(swaggerDoc?.servers)) {
    for (const server of swaggerDoc.servers) {
      const rawUrl = typeof server?.url === "string" ? server.url : "";
      if (!rawUrl) continue;
      if (/^https?:\/\//i.test(rawUrl) && !rawUrl.includes("localhost")) add(rawUrl);
      if (rawUrl.startsWith("/")) add(joinUrl(apiUrl, rawUrl));
    }
  }

  return bases;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function authHeaders(auth: string): HeaderVariant[] {
  const companyCodes = unique([
    ...(Deno.env.get("CITEL_EMPRESA") ?? "").split(","),
    ...(Deno.env.get("CITEL_COMPANY_CODE") ?? "").split(","),
    ...(Deno.env.get("CITEL_COD_EMPRESA") ?? "").split(","),
    "1",
  ]);

  const base = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };

  const variants: HeaderVariant[] = [{ label: "sem empresa", headers: base }];
  for (const code of companyCodes) {
    variants.push({
      label: `empresa=${code}`,
      headers: { ...base, empresa: code, "x-empresa": code, codEmpresa: code },
    });
  }
  return variants;
}

async function tryFetch(url: string, headers: Record<string, string>, timeoutMs = 20_000): Promise<FetchResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data, preview: typeof data === "string" ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, data: `fetch_error: ${message}`, preview: `fetch_error: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSwagger(apiUrl: string, auth: string): Promise<{ doc: any; url: string | null; attempts: Array<{ url: string; status: number }> }> {
  const swaggerCandidates = [
    `${apiUrl}/swagger/v1/swagger.json`,
    `${apiUrl}/swagger.json`,
    `${apiUrl}/v2/api-docs`,
    `${apiUrl}/api-docs`,
    `${apiUrl}/openapi.json`,
    `${apiUrl}/doc/swagger.json`,
    `${apiUrl}/doc/v2/api-docs`,
    `${apiUrl}/doc/openapi.json`,
  ];

  const attempts: Array<{ url: string; status: number }> = [];
  for (const u of swaggerCandidates) {
    const r = await tryFetch(u, { Authorization: `Basic ${auth}`, Accept: "application/json" }, 10_000);
    attempts.push({ url: u, status: r.status });
    if (r.ok && r.data && typeof r.data === "object") return { doc: r.data, url: u, attempts };
  }
  return { doc: null, url: null, attempts };
}

function buildEndpointCandidates(apiUrl: string, swaggerDoc: any): string[] {
  const discoveredPaths: string[] = [];
  if (swaggerDoc?.paths && typeof swaggerDoc.paths === "object") {
    for (const [p, def] of Object.entries(swaggerDoc.paths as Record<string, any>)) {
      if (def && typeof def === "object" && (def as Record<string, any>).get) {
        const lower = p.toLowerCase();
        if ((lower.includes("client") || lower.includes("cliente") || lower.includes("custom")) && !p.includes("{")) {
          discoveredPaths.push(p);
        }
      }
    }
  }

  const bases = swaggerBases(swaggerDoc, apiUrl);
  const discovered = bases.flatMap((base) => discoveredPaths.map((path) => joinUrl(base, path)));
  const common = [
    joinUrl(apiUrl, "/cliente"),
    joinUrl(apiUrl, "/clientes"),
    joinUrl(apiUrl, "/cadastrosgerais/v10/cliente"),
    joinUrl(apiUrl, "/cadastrosgerais/v1/cliente"),
    joinUrl(apiUrl, "/api/cliente"),
    joinUrl(apiUrl, "/api/clientes"),
    joinUrl(apiUrl, "/api/customers"),
    joinUrl(apiUrl, "/api/Clientes"),
    joinUrl(apiUrl, "/api/v1/clientes"),
    joinUrl(apiUrl, "/customers"),
  ];

  return unique([...discovered, ...common]);
}

async function discoverWorkingEndpoint(endpoints: string[], headerVariants: HeaderVariant[]) {
  const attempts: Array<{ url: string; authVariant: string; status: number; count: number; token: boolean; error?: string; sampleKeys?: string[] }> = [];

  for (const endpoint of endpoints) {
    const firstUrls = unique([
      endpoint,
      appendQuery(endpoint, { paginacao: 200 }),
      appendQuery(endpoint, { pageSize: 200 }),
      appendQuery(endpoint, { limit: 200 }),
    ]);

    for (const variant of headerVariants) {
      for (const url of firstUrls) {
        const r = await tryFetch(url, variant.headers);
        const arr = r.ok ? extractArray(r.data) : [];
        attempts.push({
          url,
          authVariant: variant.label,
          status: r.status,
          count: arr.length,
          token: !!continuationToken(r.data),
          error: r.ok ? undefined : r.preview,
          sampleKeys: arr[0] && typeof arr[0] === "object" ? Object.keys(arr[0]).slice(0, 20) : undefined,
        });

        if (r.ok && arr.length > 0) {
          const working: WorkingEndpoint = {
            url: endpoint,
            headers: variant.headers,
            label: variant.label,
            data: r.data,
            batch: arr,
          };
          return { working, attempts };
        }
      }
    }
  }

  return { working: null as WorkingEndpoint | null, attempts };
}

async function collectAll(working: WorkingEndpoint): Promise<{ records: any[]; paginated: boolean; pages: number }> {
  const all: any[] = [...working.batch];
  let pages = 1;
  let paginated = false;

  let token = continuationToken(working.data);
  const seenTokens = new Set<string>();
  while (token && !seenTokens.has(token) && pages < 500) {
    seenTokens.add(token);
    const url = appendQuery(working.url, { paginacao: 200, continuationToken: token });
    const r = await tryFetch(url, working.headers);
    if (!r.ok) break;
    const arr = extractArray(r.data);
    if (arr.length === 0) break;
    all.push(...arr);
    pages += 1;
    paginated = true;
    token = continuationToken(r.data);
  }

  if (!paginated) {
    const pageStrategies = [
      (n: number) => appendQuery(working.url, { page: n, pageSize: 200 }),
      (n: number) => appendQuery(working.url, { page: n, size: 200 }),
      (n: number) => appendQuery(working.url, { pagina: n, porPagina: 200 }),
      (n: number) => appendQuery(working.url, { offset: (n - 1) * 200, limit: 200 }),
    ];

    let strategy: ((n: number) => string) | null = null;
    for (const build of pageStrategies) {
      const r = await tryFetch(build(2), working.headers);
      const arr = r.ok ? extractArray(r.data) : [];
      if (arr.length > 0 && JSON.stringify(arr[0]) !== JSON.stringify(working.batch[0])) {
        strategy = build;
        all.push(...arr);
        pages = 2;
        paginated = true;
        break;
      }
    }

    if (strategy) {
      for (let page = 3; page < 500; page++) {
        const r = await tryFetch(strategy(page), working.headers);
        if (!r.ok) break;
        const arr = extractArray(r.data);
        if (arr.length === 0) break;
        all.push(...arr);
        pages = page;
        if (arr.length < 50) break;
      }
    }
  }

  const deduped = new Map<string, any>();
  for (const record of all) {
    if (record && typeof record === "object") {
      const key = [record.codEmpresa, record.codCliente, record.id, record.codigo, record.cpfCnpj, record.cpf, record.cnpj]
        .filter((v) => v !== undefined && v !== null && String(v).trim())
        .join("|");
      deduped.set(key || JSON.stringify(record), record);
    }
  }

  return { records: Array.from(deduped.values()), paginated, pages };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const apiUrl = cleanApiBase(Deno.env.get("CITEL_API_URL") ?? "");
    const erpUser = Deno.env.get("CITEL_USER") ?? "";
    const erpPass = Deno.env.get("CITEL_PASSWORD") ?? "";
    if (!apiUrl || !erpUser || !erpPass) return json({ error: "Integração CITEL não configurada" }, 500);
    const auth = btoa(`${erpUser}:${erpPass}`);

    const swagger = await fetchSwagger(apiUrl, auth);
    const endpoints = buildEndpointCandidates(apiUrl, swagger.doc);
    const headerVariants = authHeaders(auth);
    const { working, attempts } = await discoverWorkingEndpoint(endpoints, headerVariants);

    if (!working) {
      return json({
        success: false,
        message: "Nenhum endpoint de clientes retornou dados. Se todos os /cliente retornarem 400, confira o código da empresa do ERP (secret CITEL_EMPRESA).",
        swagger: { found: !!swagger.doc, url: swagger.url, attempts: swagger.attempts },
        attempts,
      });
    }

    const collected = await collectAll(working);
    const mapped = collected.records.map((c) => mapErpClient(c as Record<string, any>));

    return json({
      success: true,
      total: collected.records.length,
      endpoint: working.url,
      authVariant: working.label,
      paginated: collected.paginated,
      pages: collected.pages,
      clients: mapped,
      raw: collected.records,
    });
  } catch (e) {
    console.error("[citel-list-all] error", e);
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: "Erro ao listar clientes da Citel", detail: message }, 500);
  }
});
