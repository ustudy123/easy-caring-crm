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

// O Citel aninha o contato do cliente (ex.: clienteCompradorPrincipal), podendo
// vir como objeto ou array. Busca a primeira chave preenchida lá dentro.
function pickFromNested(raw: Record<string, any>, nestedKey: string, ...keys: string[]): string | undefined {
  const n = raw[nestedKey];
  if (Array.isArray(n)) {
    for (const item of n) {
      if (item && typeof item === "object") {
        const v = pickStr(item as Record<string, any>, ...keys);
        if (v) return v;
      }
    }
  } else if (n && typeof n === "object") {
    return pickStr(n as Record<string, any>, ...keys);
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
    email: pickStr(raw, "email", "e_mail", "eMail")
      || pickFromNested(raw, "clienteCompradorPrincipal", "emailCompraPrincipal", "email"),
    phone: pickStr(raw, "telefone", "celular", "fone", "whatsapp",
                   "telefone1", "telefonePrincipal", "telefoneComercial",
                   "celular1", "fone1", "telefoneCelular", "numeroTelefone")
      || pickFromNested(raw, "clienteCompradorPrincipal",
                        "telefoneCompraPrincipal", "foneCompraPrincipal",
                        "celularCompraPrincipal", "whatsappCompraPrincipal",
                        "telefone", "celular", "fone", "whatsapp"),
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
  return [...out].slice(0, 4);
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


// Cache do índice de template de URL que o ERP aceita. Persiste entre invocações
// "quentes" da função, evitando redescobrir o endpoint (várias chamadas HTTP
// sequenciais) a cada busca — principal causa da lentidão.
let cachedWorkingTemplate = -1;

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

    // Busca por documento (CPF/CNPJ) ou código do cliente, quando o que foi
    // digitado é numérico. O ERP só era consultado por nome, então CPF/CNPJ/código
    // não traziam nada. Importante: o código preserva zeros à esquerda (ex.: "010").
    const digitsOnly = name.replace(/\D/g, "");
    const isNumericQuery = /^[\d.\-/\s]+$/.test(name) && digitsOnly.length > 0;
    let docQueries: Array<[string, string]> | null = null;
    if (isNumericQuery) {
      if (digitsOnly.length === 11) {
        docQueries = [["cpf", digitsOnly], ["cpfCnpj", digitsOnly], ["cnpjCpf", digitsOnly], ["numeroDocumento", digitsOnly], ["documento", digitsOnly]];
      } else if (digitsOnly.length === 14) {
        docQueries = [["cnpj", digitsOnly], ["cpfCnpj", digitsOnly], ["cnpjCpf", digitsOnly], ["numeroDocumento", digitsOnly], ["documento", digitsOnly]];
      } else if (digitsOnly.length <= 10) {
        // Código do cliente — usa os dígitos como digitados (zeros à esquerda mantidos).
        docQueries = [["codigo", digitsOnly], ["codigoCliente", digitsOnly], ["cod", digitsOnly], ["codCliente", digitsOnly], ["id", digitsOnly]];
      }
    }

    if (docQueries) {
      const pool = new Map<string, any>();
      const bases = [`${apiUrl}/cliente`, `${apiUrl}/cadastrosgerais/v10/cliente`];
      // Tenta cada par (parâmetro, base) e para assim que achar resultados.
      outer:
      for (const [param, val] of docQueries) {
        for (const base of bases) {
          const r = await fetchUrl(`${base}?${emp}&${param}=${encodeURIComponent(val)}`);
          if (r) { lastStatus = r.status; lastBody = r.data; }
          if (r && r.status >= 200 && r.status < 300) {
            for (const c of extractArray(r.data).map(mapErpClient).filter((c: any) => c.name)) {
              pool.set(keyOf(c), c);
            }
          }
          if (pool.size > 0) break outer;
        }
      }
      const results = [...pool.values()];
      console.log(`[citel-search-name] busca por documento/codigo="${name}" -> ${results.length} resultado(s)`);
      return results.length
        ? json({ found: true, total: results.length, results, query: name })
        : json({ found: false, total: 0, results: [], query: name, lastStatus, lastBody });
    }

    // Busca no ERP os candidatos para UM termo (com suas variações de grafia).
    // Reaproveita o template já descoberto (cache de módulo) entre as chamadas.
    const collectForTerm = async (term: string): Promise<Map<string, any>> => {
      const out = new Map<string, any>();
      const vars = nameVariants(term);
      const ingest = (data: any) => {
        for (const c of extractArray(data).map(mapErpClient).filter((c: any) => c.name)) {
          out.set(keyOf(c), c);
        }
      };

      // Tenta as variações de grafia UMA DE CADA VEZ e para assim que achar
      // resultados. Sequencial (não paralelo) de propósito: o ERP engasga com
      // muitas requisições simultâneas, ficando mais lento. No caso comum, o
      // nome bate na 1ª variação e é só 1 chamada.
      for (const v of vars) {
        const enc = encodeURIComponent(v);
        if (cachedWorkingTemplate < 0) {
          // Descobre o template (primeiro HTTP 200) na primeira vez.
          const tpls = templates(enc);
          for (let i = 0; i < tpls.length; i++) {
            const r = await fetchUrl(tpls[i]);
            if (!r) continue;
            lastStatus = r.status; lastBody = r.data;
            if (r.status >= 200 && r.status < 300) { cachedWorkingTemplate = i; ingest(r.data); break; }
          }
        } else {
          const r = await fetchUrl(templates(enc)[cachedWorkingTemplate]);
          if (r) { lastStatus = r.status; lastBody = r.data; }
          if (r && r.status >= 200 && r.status < 300) ingest(r.data);
        }
        if (out.size > 0) break; // achou → não precisa tentar mais variações
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