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

function stripAccents(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Chave fonética: normaliza variações comuns de grafia em PT-BR para comparar
// nomes "que soam igual" (Raphael/Rafael, Matheus/Mateus, Thayná/Tainá...).
function phoneticKey(s: string): string {
  return stripAccents((s || "").toLowerCase())
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/y/g, "i")
    .replace(/h/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Gera variações de grafia do termo digitado, pra consultar o ERP com cada uma.
function nameVariants(name: string): string[] {
  const base = name.trim();
  const out = new Set<string>([base]);
  const add = (v: string) => { if (v && v.trim() && v !== base) out.add(v); };
  add(stripAccents(base));
  add(base.replace(/ph/gi, "f"));
  add(base.replace(/f/gi, "ph"));
  add(base.replace(/th/gi, "t"));
  add(base.replace(/y/gi, "i"));
  return [...out].slice(0, 6);
}

function rankByName(results: any[], query: string): any[] {
  const qk = phoneticKey(query);
  const score = (n: string) => {
    const rk = phoneticKey(n);
    if (rk === qk) return 0;
    if (rk.startsWith(qk)) return 1;
    if (rk.includes(qk)) return 2;
    if (qk.includes(rk)) return 3;
    return 4;
  };
  return [...results].sort((a, b) => score(a.name) - score(b.name) || (a.name || "").length - (b.name || "").length);
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
    const emp = `codigoEmpresa=${encodeURIComponent(companyCode)}`;

    // Monta os caminhos/parâmetros possíveis do ERP para um termo já codificado.
    const templates = (nm: string) => [
      `${apiUrl}/cliente?${emp}&nome=${nm}`,
      `${apiUrl}/cliente?${emp}&nome=${nm}&paginacao=50`,
      `${apiUrl}/cliente?${emp}&razaoSocial=${nm}`,
      `${apiUrl}/cliente?${emp}&nomeFantasia=${nm}`,
      `${apiUrl}/cliente?${emp}&pesquisa=${nm}`,
      `${apiUrl}/cliente?${emp}&nome=${nm}&quantidadeRegistro=50&numeroPagina=1`,
      `${apiUrl}/cadastrosgerais/v10/cliente?${emp}&nome=${nm}`,
    ];

    const fetchUrl = async (url: string): Promise<{ status: number; data: any } | null> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      try {
        const res = await fetch(url, { headers, signal: ctrl.signal });
        const text = await res.text();
        let data: any = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }
        return { status: res.status, data };
      } catch (e: any) {
        console.error(`[citel-search-name] fetch error: ${e.message}`);
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

    const keyOf = (c: any) => String(c.erpId || c.document || c.name).toLowerCase();
    let lastStatus = 0;
    let lastBody: any = null;
    let workingTemplate = -1;

    // Busca no ERP os candidatos para UM termo (com suas variações de grafia),
    // descobrindo/reaproveitando o template de URL que o ERP aceita.
    const collectForTerm = async (term: string): Promise<Map<string, any>> => {
      const out = new Map<string, any>();
      const vars = nameVariants(term);
      const ingest = (data: any) => {
        for (const c of extractArray(data).map(mapErpClient).filter((c: any) => c.name)) {
          out.set(keyOf(c), c);
        }
      };
      // Descobre o template (primeiro HTTP 200) na primeira vez.
      if (workingTemplate < 0) {
        const tpls = templates(encodeURIComponent(vars[0]));
        for (let i = 0; i < tpls.length; i++) {
          const r = await fetchUrl(tpls[i]);
          if (!r) continue;
          lastStatus = r.status; lastBody = r.data;
          if (r.status >= 200 && r.status < 300) { workingTemplate = i; ingest(r.data); break; }
        }
        if (workingTemplate < 0) return out;
        for (let v = 1; v < vars.length; v++) {
          const r = await fetchUrl(templates(encodeURIComponent(vars[v]))[workingTemplate]);
          if (r && r.status >= 200 && r.status < 300) ingest(r.data);
        }
        return out;
      }
      for (const v of vars) {
        const r = await fetchUrl(templates(encodeURIComponent(v))[workingTemplate]);
        if (r && r.status >= 200 && r.status < 300) ingest(r.data);
      }
      return out;
    };

    // Separa o que foi digitado em termos (ex.: "André Cunha" -> ["André","Cunha"]).
    const terms = name.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2);
    console.log(`[citel-search-name] termo="${name}" termos=${JSON.stringify(terms)}`);

    const pool = new Map<string, any>();

    if (terms.length <= 1) {
      // Um termo só: busca normal (com variações de grafia).
      for (const [k, v] of await collectForTerm(name)) pool.set(k, v);
      const results = rankByName([...pool.values()], name);
      return results.length
        ? json({ found: true, total: results.length, results, query: name })
        : json({ found: false, total: 0, results: [], query: name, lastStatus, lastBody });
    }

    // Vários termos: monta o conjunto consultando os 2 termos mais distintivos
    // (os mais longos), depois filtra quem contém TODOS os termos, em qualquer ordem.
    const queryTerms = [...terms].sort((a, b) => b.length - a.length).slice(0, 2);
    for (const t of queryTerms) {
      for (const [k, v] of await collectForTerm(t)) pool.set(k, v);
    }

    const termKeys = terms.map(phoneticKey).filter(Boolean);
    const matchesAll = (c: any) => {
      const ck = phoneticKey(c.name);
      return termKeys.every((tk) => ck.includes(tk));
    };

    let results = [...pool.values()].filter(matchesAll);
    if (results.length === 0) results = [...pool.values()]; // melhor esforço se nada casar 100%
    results = rankByName(results, name);

    return results.length
      ? json({ found: true, total: results.length, results, query: name })
      : json({ found: false, total: 0, results: [], query: name, lastStatus, lastBody });
  } catch (e: any) {
    console.error("[citel-search-name] fatal", e);
    return json({ error: e.message }, 500);
  }
});