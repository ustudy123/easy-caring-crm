// Edge Function: citel-sales-tracking
// Rastreamento de vendas CRM x ERP (Ponto 7).
// Busca pedidos faturados no ERP (Citel), filtra os marcados como "CRM" via
// tipo de atendimento, e cruza telefone do cliente + código do vendedor com o
// histórico de "venda concluída" (lead em fechamento/pós-venda) no CRM.
// Retorna um relatório por vendedor com as vendas validadas.
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

function cleanApiBase(raw: string): string {
  return (raw || "").trim().replace(/\/+$/, "")
    .replace(/\/swagger-ui(\.html)?$/i, "")
    .replace(/\/swagger\/index\.html$/i, "")
    .replace(/\/swagger$/i, "")
    .replace(/\/doc(s)?$/i, "")
    .replace(/\/+$/, "");
}

// Últimos 8 dígitos do telefone — tolera variações de DDI (55) e 9º dígito.
function phoneKey(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  return d.slice(-8);
}

function toNumber(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function pick(obj: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function extractArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const k of ["content", "data", "items", "results", "rows", "records"]) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

async function tryFetch(url: string, headers: Record<string, string>, timeoutMs = 30_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    console.error(`[sales-tracking] fetch error ${url}: ${e.message}`);
    return { ok: false, status: 0, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const apiUrl = cleanApiBase(Deno.env.get("CITEL_API_URL") ?? "");
    const auth = btoa(`${Deno.env.get("CITEL_USER")}:${Deno.env.get("CITEL_PASSWORD")}`);
    const companyCode = Deno.env.get("CITEL_EMPRESA") || "1";
    const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

    if (!apiUrl) return json({ error: "CITEL_API_URL não configurada" }, 500);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    // dataHora: início do período no formato "YYYY-MM-DD" ou "YYYY-MM-DD HH:mm:ss".
    let dataHora: string = body.dataHora || body.dateFrom || "";
    if (!dataHora) {
      // padrão: primeiro dia do mês atual
      const now = new Date();
      dataHora = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataHora)) dataHora = `${dataHora} 00:00:00`;
    const dataHoraFim: string | null = body.dataHoraFim || body.dateTo || null; // filtro client-side opcional
    const maxPages: number = Math.min(body.maxPages || 20, 50);
    const pageSize: number = body.size || 100;

    // 1) Descobrir quais tipos de atendimento representam "CRM".
    const taRes = await tryFetch(`${apiUrl}/tipo-atendimento?codigoEmpresa=${encodeURIComponent(companyCode)}`, headers);
    const tipos = extractArray(taRes.data);
    const crmTipos = tipos.filter((t: any) => {
      const desc = String(pick(t, "descricao", "descricaoTipoAtendimento", "nome") || "").toLowerCase();
      return desc.includes("crm");
    });
    const crmTipoCodes = new Set(
      crmTipos.map((t: any) => String(pick(t, "codigo", "codigoTipoAtendimento", "id") ?? "")).filter(Boolean)
    );
    console.log(`[sales-tracking] tipos de atendimento: ${tipos.length}, CRM: ${[...crmTipoCodes].join(",") || "(nenhum)"}`);

    // 2) Buscar pedidos faturados a partir da data (paginado).
    const orders: any[] = [];
    for (let page = 0; page < maxPages; page++) {
      const url = `${apiUrl}/pedido-movimento/faturamento`
        + `?codigoEmpresa=${encodeURIComponent(companyCode)}`
        + `&data-hora=${encodeURIComponent(dataHora)}`
        + `&ja-faturado=true&page=${page}&size=${pageSize}`;
      const r = await tryFetch(url, headers);
      if (!r.ok) { console.error(`[sales-tracking] faturamento page ${page} status ${r.status}`); break; }
      const pageItems = extractArray(r.data);
      orders.push(...pageItems);
      const isLast = (r.data && (r.data.last === true || r.data.totalPages !== undefined && page + 1 >= r.data.totalPages)) || pageItems.length < pageSize;
      if (isLast) break;
    }
    console.log(`[sales-tracking] pedidos faturados lidos: ${orders.length}`);

    // 3) Filtrar pedidos marcados como CRM (por código de tipo, ou descrição "crm").
    const isCrmOrder = (o: any) => {
      const codigo = String(pick(o, "codigoTipoAtendimento") ?? "");
      const desc = String(pick(o, "descricaoTipoAtendimento") || "").toLowerCase();
      if (crmTipoCodes.size > 0 && crmTipoCodes.has(codigo)) return true;
      return desc.includes("crm");
    };
    const endFilter = dataHoraFim ? dataHoraFim.slice(0, 10) : null;
    const crmOrders = orders.filter((o) => {
      if (!isCrmOrder(o)) return false;
      if (endFilter) {
        const d = String(pick(o, "dataEntrada", "dataLiberacao", "dataUltimaAlteracao") || "").slice(0, 10);
        if (d && d > endFilter) return false;
      }
      return true;
    });
    console.log(`[sales-tracking] pedidos marcados como CRM: ${crmOrders.length}`);

    // 4) Carregar vendedores (code -> id/name) e leads de venda concluída do CRM.
    const { data: sellers } = await supabase.from("sellers").select("id, name, code");
    const sellerByCode = new Map<string, { id: string; name: string }>();
    for (const s of sellers ?? []) {
      if (s.code) sellerByCode.set(String(s.code), { id: s.id, name: s.name });
    }

    const { data: wonLeads } = await supabase
      .from("leads")
      .select("client_phone, assigned_to, stage, value")
      .in("stage", ["fechamento", "pos_venda"]);
    // index: phoneKey + assigned_to -> true
    const wonIndex = new Set<string>();
    for (const l of wonLeads ?? []) {
      if (l.client_phone && l.assigned_to) {
        wonIndex.add(`${phoneKey(l.client_phone)}|${l.assigned_to}`);
      }
    }

    // 5) Cruzar: para cada pedido CRM, validar telefone + vendedor + venda concluída.
    const bySeller = new Map<string, { sellerCode: string; sellerName: string; count: number; totalValue: number; sales: any[] }>();
    const unmatched: any[] = [];
    let validatedValue = 0;

    for (const o of crmOrders) {
      const phone = String(pick(o, "telefoneConsumidor", "telefone", "fone") || "");
      const sellerCode = String(pick(o, "codigoVendedor", "codigoVendedor2") ?? "");
      const value = toNumber(pick(o, "valorContabil", "totalProdutos", "totalContabil"));
      const numero = String(pick(o, "numeroDocumento", "numeroPocket", "numeroPedidoSite") || "");
      const date = String(pick(o, "dataEntrada", "dataLiberacao", "dataUltimaAlteracao") || "");

      const seller = sellerByCode.get(sellerCode);
      const matched = seller ? wonIndex.has(`${phoneKey(phone)}|${seller.id}`) : false;

      if (matched && seller) {
        validatedValue += value;
        const entry = bySeller.get(sellerCode) || { sellerCode, sellerName: seller.name, count: 0, totalValue: 0, sales: [] };
        entry.count += 1;
        entry.totalValue += value;
        entry.sales.push({ numeroDocumento: numero, phone, value, date });
        bySeller.set(sellerCode, entry);
      } else {
        unmatched.push({
          numeroDocumento: numero, phone, sellerCode,
          sellerName: seller?.name || null, value, date,
          reason: !seller ? "vendedor não encontrado no CRM" : "sem venda concluída no CRM para esse telefone/vendedor",
        });
      }
    }

    return json({
      success: true,
      period: { from: dataHora, to: dataHoraFim },
      crmTipoAtendimento: crmTipos.map((t: any) => ({
        codigo: pick(t, "codigo", "id"),
        descricao: pick(t, "descricao", "nome"),
      })),
      totals: {
        ordersScanned: orders.length,
        crmOrders: crmOrders.length,
        validated: [...bySeller.values()].reduce((s, e) => s + e.count, 0),
        validatedValue,
        unmatched: unmatched.length,
      },
      bySeller: [...bySeller.values()].sort((a, b) => b.totalValue - a.totalValue),
      unmatchedCrmOrders: unmatched.slice(0, 200),
    });
  } catch (e: any) {
    console.error(`[sales-tracking] erro: ${e.message}`);
    return json({ error: e.message }, 500);
  }
});
