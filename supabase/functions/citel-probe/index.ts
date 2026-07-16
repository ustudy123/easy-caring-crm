// Diagnóstico: lista parâmetros aceitos pelos endpoints /cliente do Swagger
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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
  const auth = btoa(`${Deno.env.get("CITEL_USER")}:${Deno.env.get("CITEL_PASSWORD")}`);
  
  console.log("[probe] fetching swagger from", apiUrl);
  
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);

  try {
    const r = await fetch(`${apiUrl}/v2/api-docs`, { 
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: ctrl.signal
    });
    console.log("[probe] swagger status", r.status);
     const doc: any = await r.json();
     const paths = doc?.paths ?? {};
     console.log("[probe] paths count", Object.keys(paths).length);
     
     const clientEndpoints: any[] = [];
     const phoneEndpoints: any[] = [];
     
     for (const [p, defs] of Object.entries(paths)) {
       const lowerPath = p.toLowerCase();
       const isClientRelated = lowerPath.includes("client");
       
       for (const [m, info] of Object.entries(defs as any)) {
         if (m !== "get") continue;
         const params = (info as any).parameters ?? [];
         const mappedParams = params.map((x: any) => ({ 
           name: x.name, 
           in: x.in, 
           required: !!x.required, 
           type: x.type || x.schema?.type,
           description: x.description 
         }));

         const hasPhoneParam = mappedParams.some((par: any) => 
           /telefone|fone|celular|contato/i.test(par.name)
         );
         const hasPhonePath = /telefone|fone|celular|contato/i.test(p);

         const endpointInfo = { path: p, method: m, params: mappedParams };

         if (isClientRelated) {
           clientEndpoints.push(endpointInfo);
         }
         
         if (hasPhoneParam || hasPhonePath) {
           phoneEndpoints.push(endpointInfo);
         }
       }
     }

     return json({ 
       reachable: true, 
       clientCount: clientEndpoints.length,
       phoneCount: phoneEndpoints.length,
       clientEndpoints,
       phoneEndpoints 
     });
  } catch (e: any) {
    console.error("[probe] error", e);
    return json({ reachable: false, error: e.message, type: e.name }, 200);
  } finally {
    clearTimeout(timer);
  }
});