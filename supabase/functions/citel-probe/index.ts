// Diagnóstico: lista parâmetros aceitos pelos endpoints /cliente do Swagger
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
    console.log("[probe] paths count", Object.keys(doc?.paths ?? {}).length);
    
    const out: any[] = [];
    for (const [p, defs] of Object.entries(doc?.paths ?? {})) {
      const lower = p.toLowerCase();
      if (!lower.includes("client")) continue;
      for (const [m, info] of Object.entries(defs as any)) {
        if (m !== "get") continue;
        const params = (info as any).parameters ?? [];
        out.push({ 
          path: p, 
          params: params.map((x: any) => ({ 
            name: x.name, 
            in: x.in, 
            required: !!x.required, 
            type: x.type || x.schema?.type,
            description: x.description 
          })) 
        });
      }
    }
    return json({ reachable: true, count: out.length, endpoints: out });
  } catch (e: any) {
    console.error("[probe] error", e);
    return json({ reachable: false, error: e.message, type: e.name }, 200);
  } finally {
    clearTimeout(timer);
  }
});