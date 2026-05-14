// Edge Function: citel-explore (temporária / diagnóstico)
// Objetivo: inspecionar o Swagger do ERP CITEL e amostrar respostas reais
// de endpoints de clientes, pedidos e produtos para ajustarmos o mapeamento
// de campos nas demais funções (ex.: citel-get-client).
//
// Uso:
//   POST /functions/v1/citel-explore
//   body opcional:
//     {
//       "phone": "11999990000",     // usado para sample em clientes
//       "extraPaths": ["/api/xpto"] // paths adicionais a testar (GET)
//     }
//
// Requer usuário autenticado (verify_jwt = true no config.toml).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

// Reduz um objeto/array a um "shape": nomes de chaves e tipos, sem vazar
// dados sensíveis em massa. Mantém até 2 níveis de profundidade.
function shapeOf(value: unknown, depth = 0): unknown {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "array(0)";
    return [`array(${value.length})`, shapeOf(value[0], depth + 1)];
  }
  const t = typeof value;
  if (t !== "object") return t;
  if (depth >= 2) return "object";
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    out[k] = shapeOf(obj[k], depth + 1);
  }
  return out;
}

async function authedFetch(url: string, auth: string, timeoutMs = 10_000) {
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
      data = text.slice(0, 2000); // string crua (truncada)
    }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: `fetch_error: ${(e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

// Extrai paths do Swagger v2 (paths) ou OpenAPI v3 (paths).
function extractPathsFromSwagger(
  swagger: unknown,
): { path: string; methods: string[] }[] {
  if (!swagger || typeof swagger !== "object") return [];
  const paths = (swagger as Record<string, unknown>).paths;
  if (!paths || typeof paths !== "object") return [];
  const out: { path: string; methods: string[] }[] = [];
  for (const [p, def] of Object.entries(paths as Record<string, unknown>)) {
    if (!def || typeof def !== "object") continue;
    const methods = Object.keys(def as Record<string, unknown>).filter((m) =>
      ["get", "post", "put", "delete", "patch"].includes(m.toLowerCase())
    );
    out.push({ path: p, methods });
  }
  return out;
}

// Heurística: filtra paths que provavelmente são clientes/pedidos/produtos.
function categorize(paths: { path: string; methods: string[] }[]) {
  const match = (keywords: string[]) =>
    paths
      .filter((p) =>
        keywords.some((k) => p.path.toLowerCase().includes(k)) &&
        p.methods.includes("get")
      )
      .map((p) => p.path);
  return {
    clientes: match(["client", "custom"]),
    pedidos: match(["pedido", "order", "venda", "sale"]),
    produtos: match(["produto", "product", "item"]),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
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
      console.error("[citel-explore] auth error", userErr);
      return json({ error: "Unauthorized" }, 401);
    }

    // --- Body (tudo opcional) ---
    const body = await req.json().catch(() => null) as
      | { phone?: string; extraPaths?: string[] }
      | null;
    const phone = normalizePhone(body?.phone ?? "");
    const extraPaths = Array.isArray(body?.extraPaths) ? body!.extraPaths! : [];

    // --- Secrets ---
    // Sanitiza a URL base removendo sufixos comuns de documentação (Swagger UI).
    // Isso evita que o cliente concatene endpoints depois de "/doc/swagger-ui.html",
    // resultando em 404 do tipo "/doc/swagger-ui.html/api/clientes".
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
      return json({ error: "Integração CITEL não configurada" }, 500);
    }
    const auth = btoa(`${user}:${password}`);

    // --- 1) Tenta buscar Swagger em caminhos comuns ---
    const swaggerCandidates = [
      `${apiUrl}/swagger/v1/swagger.json`,
      `${apiUrl}/swagger.json`,
      `${apiUrl}/v2/api-docs`,
      `${apiUrl}/api-docs`,
      `${apiUrl}/openapi.json`,
    ];
    let swaggerUrl: string | null = null;
    let swaggerDoc: unknown = null;
    for (const u of swaggerCandidates) {
      const r = await authedFetch(u, auth);
      console.log("[citel-explore] swagger try", u, r.status);
      if (r.ok && r.data && typeof r.data === "object") {
        swaggerUrl = u;
        swaggerDoc = r.data;
        break;
      }
    }

    const allPaths = extractPathsFromSwagger(swaggerDoc);
    const categorized = categorize(allPaths);

    // --- 2) Escolhe endpoints candidatos a amostrar ---
    const clienteCandidates = [
      ...categorized.clientes,
      "/api/clientes",
      "/api/customers",
    ];
    const pedidoCandidates = [
      ...categorized.pedidos,
      "/api/pedidos",
      "/api/orders",
    ];
    const produtoCandidates = [
      ...categorized.produtos,
      "/api/produtos",
      "/api/products",
    ];

    const dedupe = (arr: string[]) =>
      Array.from(new Set(arr.map((p) => p.trim()).filter(Boolean))).slice(0, 6);

    const sample = async (
      label: string,
      candidates: string[],
      query?: string,
    ) => {
      const results: Array<{
        path: string;
        status: number;
        shape?: unknown;
        preview?: unknown;
        raw?: unknown;
      }> = [];
      for (const p of dedupe(candidates)) {
        // substitui placeholders {id}, {codigo}, etc., por 1 (amostra inofensiva)
        const clean = p.replace(/\{[^}]+\}/g, "1");
        const url = `${apiUrl}${clean}${query ? `?${query}` : ""}`;
        const r = await authedFetch(url, auth);
        console.log(`[citel-explore] ${label} ${r.status} ${url}`);
        const entry: typeof results[number] = { path: clean, status: r.status };
        if (r.ok) {
          entry.shape = shapeOf(r.data);
          // preview mínimo: primeiro item se array, ou o próprio objeto
          const first = Array.isArray(r.data)
            ? r.data[0]
            : (r.data && typeof r.data === "object" &&
                Array.isArray((r.data as Record<string, unknown>).data))
              ? ((r.data as Record<string, unknown>).data as unknown[])[0]
              : r.data;
          entry.preview = first ?? null;
        } else {
          entry.raw = typeof r.data === "string" ? r.data : r.data;
        }
        results.push(entry);
        // para cada categoria, paramos no primeiro 2xx
        if (r.ok) break;
      }
      return results;
    };

    const [clientesSamples, pedidosSamples, produtosSamples, extraSamples] =
      await Promise.all([
        sample(
          "clientes",
          clienteCandidates,
          phone ? `telefone=${encodeURIComponent(phone)}` : undefined,
        ),
        sample("pedidos", pedidoCandidates),
        sample("produtos", produtoCandidates),
        sample("extra", extraPaths),
      ]);

    return json({
      apiUrl,
      swagger: {
        found: !!swaggerDoc,
        url: swaggerUrl,
        totalPaths: allPaths.length,
        categorized,
      },
      samples: {
        clientes: clientesSamples,
        pedidos: pedidosSamples,
        produtos: produtosSamples,
        extra: extraSamples,
      },
      note:
        "Função temporária de diagnóstico. Remover após ajuste do mapeamento.",
    });
  } catch (e) {
    console.error("[citel-explore] unexpected", e);
    return json({ error: "Erro ao explorar ERP", detail: String(e) }, 500);
  }
});