 // Edge Function: citel-get-client (Robust Scanning Edition)
 // Reutiliza a lógica do citel-list-all para varredura profunda com continuationToken.
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 const json = (body: unknown, status = 200) => 
   new Response(JSON.stringify(body), { 
     status, 
     headers: { ...corsHeaders, "Content-Type": "application/json" } 
   });
 
 function normalizePhone(raw: string): string {
   return (raw || "").replace(/\D/g, "");
 }
 
 function phoneMatches(rawPhone: any, targetPhone: string): boolean {
   if (!rawPhone) return false;
   const digits = String(rawPhone).replace(/\D/g, "");
   if (digits.length < 10) return false;
   return digits.endsWith(targetPhone);
 }
 
 function cleanApiBase(raw: string): string {
   return (raw || "").trim().replace(/\/+$/, "").replace(/\/swagger-ui(\.html)?$/i, "").replace(/\/swagger\/index\.html$/i, "").replace(/\/swagger$/i, "").replace(/\/doc(s)?$/i, "").replace(/\/+$/, "");
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
     erpId: pickStr(raw, "id", "codigo", "code", "cod", "codCliente", "cod_cliente", "idCliente"),
     name: pickStr(raw, "nome", "name", "razaoSocial", "razao_social", "fantasia") || "Cliente ERP",
     email: pickStr(raw, "email", "e_mail", "eMail") || pickFromNestedArray(raw, "clienteCompradorPrincipal", "emailCompraPrincipal"),
     address: addressParts.length ? addressParts.join(", ") : pickStr(raw, "address"),
     city: pickStr(raw, "cidade", "city", "municipio"),
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
   return (typeof token === "string" && token.trim()) ? token.trim() : (typeof token === "number" ? String(token) : null);
 }
 
 function appendQuery(url: string, params: Record<string, string | number | undefined>): string {
   const u = new URL(url);
   for (const [key, value] of Object.entries(params)) {
     if (value !== undefined && value !== "") u.searchParams.set(key, String(value));
   }
   return u.toString();
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
     return { ok: false, status: 0, error: e.message };
   } finally {
     clearTimeout(timer);
   }
 }
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
   if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
 
   try {
     const authHeader = req.headers.get("Authorization") ?? "";
     const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
     const adminClient = createClient(supabaseUrl, supabaseServiceKey);
 
     const body = await req.json().catch(() => null) as { phone?: string } | null;
     const targetPhone = normalizePhone(body?.phone ?? "");
     if (targetPhone.length < 10) return json({ error: "Telefone muito curto" }, 400);
 
     // 1. Cache Local
     const { data: local } = await adminClient.from("clients").select("*").eq("phone", targetPhone).maybeSingle();
     if (local?.erp_id) {
       return json({ found: true, strategy: "cache", client: { erpId: local.erp_id, name: local.name, email: local.email, address: local.address, city: local.city } });
     }
 
     // 2. ERP Deep Scan
     const apiUrl = cleanApiBase(Deno.env.get("CITEL_API_URL") ?? "");
     const auth = btoa(`${Deno.env.get("CITEL_USER")}:${Deno.env.get("CITEL_PASSWORD")}`);
     const baseHeaders = { Authorization: `Basic ${auth}`, Accept: "application/json" };
     
     // Tenta carregar o Swagger para descobrir o endpoint real
     const swaggerUrls = [`${apiUrl}/v2/api-docs`, `${apiUrl}/swagger/v1/swagger.json` ];
     let discoveredPath = "/cliente";
     for (const u of swaggerUrls) {
       const r = await tryFetch(u, baseHeaders, 10000);
       if (r.ok && r.data?.paths) {
         for (const p of Object.keys(r.data.paths)) {
           if (/^\/cliente(s)?$/i.test(p)) { discoveredPath = p; break; }
         }
         break;
       }
     }
 
     const endpoint = `${apiUrl}${discoveredPath.startsWith("/") ? "" : "/"}${discoveredPath}`;
     let currentUrl = appendQuery(endpoint, { paginacao: 200 });
     let pages = 0;
     let totalScanned = 0;
     let reachable = false;
 
     while (pages < 500) {
       const r = await tryFetch(currentUrl, baseHeaders, 25000);
       if (r.status > 0) reachable = true;
       if (!r.ok) break;
 
       const items = extractArray(r.data);
       if (items.length === 0) break;
       
       pages++;
       totalScanned += items.length;
 
       for (const item of items) {
         // Coleta todos os telefones possíveis (planos e aninhados)
         const phones = [
           item.telefone, item.celular, item.fone, item.whatsapp, item.telefoneComercial, item.telefoneResidencial,
           item.clienteCompradorPrincipal?.celularCompraPrincipal,
           item.clienteCompradorPrincipal?.telefoneCompraPrincipal,
           ...(item.clienteCompradores?.flatMap((c: any) => [c.numWhatsAppComprador, c.celularComprador, c.telefoneComprador]) || []),
           ...(item.enderecoEntrega?.map((e: any) => e.telefone) || [])
         ];
 
         if (phones.some(p => phoneMatches(p, targetPhone))) {
           const c = mapErpClient(item);
           // Salva cache
           await adminClient.from("clients").upsert({
             phone: targetPhone, name: c.name, email: c.email, address: c.address, city: c.city, erp_id: c.erpId
           }, { onConflict: "phone" });
 
           return json({ found: true, strategy: "scan", page: pages, totalScanned, client: c });
         }
       }
 
       const token = continuationToken(r.data);
       if (!token) break;
       currentUrl = appendQuery(endpoint, { paginacao: 200, continuationToken: token });
     }
 
     if (!reachable) return json({ found: false, reason: "erp_unreachable" });
     return json({ found: false, reason: "not_found", pagesScanned: pages, totalScanned });
 
   } catch (e: any) {
     console.error("[citel-get-client] fatal", e);
     return json({ error: e.message }, 500);
   }
 });
