// Diagnóstico: lista parâmetros aceitos pelos endpoints /cliente do Swagger
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const apiUrl = (Deno.env.get("CITEL_API_URL") ?? "").replace(/\/+$/, "");
  const auth = btoa(`${Deno.env.get("CITEL_USER")}:${Deno.env.get("CITEL_PASSWORD")}`);
  const r = await fetch(`${apiUrl}/v2/api-docs`, { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } });
  const doc: any = await r.json();
  const out: any[] = [];
  for (const [p, defs] of Object.entries(doc?.paths ?? {})) {
    const lower = p.toLowerCase();
    if (!lower.includes("client")) continue;
    for (const [m, info] of Object.entries(defs as any)) {
      if (m !== "get") continue;
      const params = (info as any).parameters ?? [];
      out.push({ path: p, params: params.map((x: any) => ({ name: x.name, in: x.in, required: x.required, type: x.type })) });
    }
  }
  return json({ count: out.length, endpoints: out });
});