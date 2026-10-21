// Edge Function: citel-search-name
// Busca clientes no ERP CITEL por parte do nome via /cliente?nome=...
import { createErpFetcher, ErpSearchError } from "./erpFetch.ts";
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
    erpId: pickStr(raw, "codigoCliente", "codigo_cliente", "id", "codigo", "code", "cod", "codCliente", "cod_cliente", "idCliente", "autoIncrem"),
    name: pickStr(raw, "nome", "name", "razaoSocial", "razao_social", "fantasia", "nomeFantasia", "nome_fantasia") || "Cliente ERP",
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
  // A rota /cliente/{codigo} responde com UM cliente (objeto), não com lista.
  // Sem isto o retorno 200 era descartado e a busca por código não achava nada.
  for (const k of ["cliente", "customer", "data", "content", "record"]) {
    if (data[k] && typeof data[k] === "object" && !Array.isArray(data[k])) return [data[k]];
  }
  const looksLikeClient = ["nome", "name", "razaoSocial", "nomeFantasia", "codCliente", "codigo", "cpfCnpj"]
    .some((k) => data[k] !== undefined && data[k] !== null);
  if (looksLikeClient) return [data];
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
    const erpUser = Deno.env.get("CITEL_USER") ?? "";
    const erpPassword = Deno.env.get("CITEL_PASSWORD") ?? "";
    if (!apiUrl || !erpUser || !erpPassword) return json({ error: "Integração CITEL não configurada" }, 503);
    const auth = btoa(`${erpUser}:${erpPassword}`);
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

    const fetchUrl = createErpFetcher(headers);
    let successfulRequests = 0;
    const emptyResult = () => {
      if (successfulRequests === 0) {
        throw new ErpSearchError("Não foi possível consultar o ERP. Tente novamente em instantes.", 502,
          `No supported search endpoint. Last ERP status: ${lastStatus}`);
      }
      return json({ found: false, total: 0, results: [], query: name });
    };

    const keyOf = (c: any) => String(c.erpId || c.document || c.name).toLowerCase();
    let lastStatus = 0;
    let lastBody: any = null;

    // Busca por documento (CPF/CNPJ) ou código do cliente, quando o que foi
    // digitado é numérico. O ERP só era consultado por nome, então CPF/CNPJ/código
    // não traziam nada.
    //
    // Os nomes de parâmetro do Citel não estão documentados aqui, então tentamos
    // um conjunto de candidatos. O formato de sub-rota (`/cliente/telefone?numero=`)
    // é o único comprovadamente aceito (ver citel-get-client), por isso vem junto.
    // Cada tentativa é logada com o status, para o log revelar o que o ERP aceita.
    const digitsOnly = name.replace(/\D/g, "");
    const isNumericQuery = /^[\d.\-/\s]+$/.test(name) && digitsOnly.length > 0;

    let urls: string[] | null = null;
    if (isNumericQuery) {
      const enc = encodeURIComponent(digitsOnly);
      const bases = [`${apiUrl}/cliente`, `${apiUrl}/cadastrosgerais/v10/cliente`];

      if (digitsOnly.length === 11 || digitsOnly.length === 14) {
        // CPF (11) ou CNPJ (14)
        const params = ["cpfCnpj", "cnpjCpf", "numeroDocumento", "documento",
                        digitsOnly.length === 11 ? "cpf" : "cnpj"];
        urls = [
          // sub-rota, no formato que sabemos que o ERP usa
          ...bases.map((b) => `${b}/cpfcnpj?${emp}&numero=${enc}`),
          ...bases.map((b) => `${b}/documento?${emp}&numero=${enc}`),
          // query direta
          ...bases.flatMap((b) => params.map((p) => `${b}?${emp}&${p}=${enc}`)),
        ];
      } else if (digitsOnly.length <= 10) {
        // Código do cliente. O log do ERP provou que a rota aceita é
        // `/cliente/{codigo}?codigoEmpresa=N` e SÓ com o código completo de 8
        // dígitos: /cliente/00005490 -> 200, enquanto /cliente/5490 e
        // /cliente/005490 -> 404. Por isso o zero-padding vem primeiro e o
        // usuário pode digitar só "5490".
        const noZeros = digitsOnly.replace(/^0+/, "") || digitsOnly;
        const forms = [...new Set([noZeros.padStart(8, "0"), digitsOnly, noZeros,
          noZeros.padStart(6, "0")])].map(encodeURIComponent);
        const params = ["codigo", "codCliente", "codigoCliente", "cod", "id"];
        urls = [
          // rota comprovada (200 no ERP)
          ...forms.map((f) => `${apiUrl}/cliente/${f}?${emp}`),
          // alternativas, caso o ERP mude
          ...bases.flatMap((b) => forms.map((f) => `${b}/codigo?${emp}&numero=${f}`)),
          ...bases.flatMap((b) => forms.flatMap((f) => params.map((p) => `${b}?${emp}&${p}=${f}`))),
        ];
      }
    }

    if (urls) {
      const pool = new Map<string, any>();
      for (const url of urls) {
        const r = await fetchUrl(url);
        const status = r?.status ?? 0;
        if (r) { lastStatus = r.status; lastBody = r.data; }
        let hits = 0;
        if (r && r.status >= 200 && r.status < 300) {
          successfulRequests++;
          for (const c of extractArray(r.data).map(mapErpClient).filter((c: any) => c.name)) {
            pool.set(keyOf(c), c);
            hits++;
          }
        }
        // Log de diagnóstico: mostra exatamente qual URL o ERP aceitou.
        console.log(`[citel-search-name] tentativa status=${status} hits=${hits} url=${url.replace(/(token|key)=[^&]*/gi, "$1=***")}`);
        // 200 sem resultado costuma ser formato de resposta inesperado: mostra
        // um trecho do corpo para saber como o ERP devolveu o cliente.
        if (status === 200 && hits === 0 && r?.data) {
          console.log(`[citel-search-name] corpo (200 sem resultado): ${JSON.stringify(r.data).slice(0, 500)}`);
        }
        if (pool.size > 0) break;
      }
      const results = [...pool.values()];
      console.log(`[citel-search-name] busca por documento/codigo="${name}" -> ${results.length} resultado(s)`);
      return results.length
        ? json({ found: true, total: results.length, results, query: name })
        : emptyResult();
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
            if (r.status >= 200 && r.status < 300) { successfulRequests++; cachedWorkingTemplate = i; ingest(r.data); break; }
          }
        } else {
          const r = await fetchUrl(templates(enc)[cachedWorkingTemplate]);
          if (r) { lastStatus = r.status; lastBody = r.data; }
          if (r && r.status >= 200 && r.status < 300) { successfulRequests++; ingest(r.data); }
          else cachedWorkingTemplate = -1;
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
        : emptyResult();
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
      : emptyResult();
  } catch (e: any) {
    if (e instanceof ErpSearchError) {
      console.error(`[citel-search-name] ERP failure [${e.status}]: ${e.details}`);
      return json({ error: e.message, status: e.status, details: e.details }, e.status);
    }
    console.error("[citel-search-name] fatal", e);
    return json({ error: e.message }, 500);
  }
});