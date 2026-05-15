 import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
 
 const json = (b: unknown, s = 200) => 
   new Response(JSON.stringify(b, null, 2), { 
     status: s, 
     headers: { ...corsHeaders, "Content-Type": "application/json" } 
   });
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
 
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
   const auth = btoa(`${user}:${password}`);
 
   const candidates = [
     `${apiUrl}/doc/v2/api-docs`,
     `${apiUrl}/doc/api-docs`,
     `${apiUrl}/v2/api-docs`,
     `${apiUrl}/api-docs`,
     `${apiUrl}/swagger/v1/swagger.json`,
     `${apiUrl}/doc/swagger-resources`
   ];
 
   const results = [];
   let fullDoc: any = null;
   let workingUrl = "";
 
   for (const url of candidates) {
     const ctrl = new AbortController();
     const timer = setTimeout(() => ctrl.abort(), 45000);
     try {
       console.log(`[swagger-dump] trying ${url}...`);
       const res = await fetch(url, {
         headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
         signal: ctrl.signal
       });
       const text = await res.text();
       results.push({ url, status: res.status, preview: text.slice(0, 100) });
       if (res.ok) {
         try {
           const data = JSON.parse(text);
           if (data && typeof data === 'object') {
             fullDoc = data;
             workingUrl = url;
             break;
           }
         } catch { /* ignore parse error */ }
       }
     } catch (e: any) {
       results.push({ url, status: 0, error: e.message });
     } finally {
       clearTimeout(timer);
     }
   }
 
   if (!fullDoc) {
     return json({ success: false, attempts: results, note: "Não foi possível carregar o Swagger em nenhum dos caminhos padrão." }, 200);
   }
 
   const paths = fullDoc.paths ?? {};
   const analysis: any = {
     totalPaths: Object.keys(paths).length,
     phoneSearchEndpoints: [],
     clientEndpointsWithParams: []
   };
 
   for (const [p, defs] of Object.entries(paths)) {
     const lowerPath = p.toLowerCase();
     for (const [method, info] of Object.entries(defs as any)) {
       if (method !== "get") continue;
       const params = (info as any).parameters ?? [];
       const hasPhoneParam = params.some((par: any) => 
         /telefone|fone|celular|contato|whatsapp|whatsapp|mobile/i.test(par.name)
       );
       const hasPhonePath = /telefone|fone|celular|contato|whatsapp|whatsapp|mobile/i.test(p);
 
       const entry = { path: p, params: params.map((x: any) => ({ name: x.name, in: x.in, type: x.type || x.schema?.type })) };
 
       if (hasPhoneParam || hasPhonePath) {
         analysis.phoneSearchEndpoints.push(entry);
       }
       if (lowerPath.includes("client")) {
         analysis.clientEndpointsWithParams.push(entry);
       }
     }
   }
 
   return json({
     success: true,
     workingUrl,
     analysis,
     fullDocRawPreview: JSON.stringify(fullDoc).slice(0, 5000)
   });
 });