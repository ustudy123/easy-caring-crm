import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalizes a Z-API instance URL down to its base (.../instances/<id>/token/<token>)
function getApiConfig(inst: { provider: string; api_url?: string | null; api_token?: string | null }) {
  const provider = inst.provider || "uazapi";
  const rawUrl = (inst.api_url || Deno.env.get("WHATSAPP_API_URL"))?.trim();
  const token = (inst.api_token || Deno.env.get("WHATSAPP_API_KEY"))?.trim();

  if (!rawUrl) return null;

  let baseUrl = rawUrl.replace(/\/+$/, "");

  // uazapiGO (ex.: ipazua.uazapi.com): header `token`, endpoints /instance/status e /send/text.
  if (provider === "uazapi_go" || provider === "uazapi" || /uazapi\./i.test(baseUrl)) {
    baseUrl = baseUrl
      .replace(/\/send\/(text|media|image|video|audio|file|document)$/i, "")
      .replace(/\/send-(text|image|video|audio|file|document)$/i, "")
      .replace(/\/instance\/(status|connection|connect|disconnect|qrcode)$/i, "");
    return { baseUrl, token, provider: "uazapi_go" };
  }

  if (provider === "whatsapi") {
    return { baseUrl, token, provider: "whatsapi" };
  }

  // Z-API (legacy) logic
  baseUrl = baseUrl.replace(/\/(send-(text|image|video|audio|file|document)|status|qr-code|restart|disconnect)$/i, "");
  if (!baseUrl.includes("/token/") && token) {
    if (/\/token$/i.test(baseUrl)) {
      baseUrl = `${baseUrl}/${token}`;
    } else if (/\/instances\/[^/]+$/i.test(baseUrl)) {
      baseUrl = `${baseUrl}/token/${token}`;
    }
  }
  return { baseUrl, token, provider: "zapi" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let instanceId: string | null = null;
    try {
      const body = await req.json();
      instanceId = body?.instanceId || null;
    } catch {
      instanceId = null;
    }

    // Fetch the instance(s) to check
    let query = supabase
      .from("whatsapp_instances")
      .select("id, name, api_url, api_token, provider, status");
    if (instanceId) query = query.eq("id", instanceId);

    const { data: instances, error } = await query;
    if (error) throw error;

    const results: any[] = [];

    for (const inst of instances || []) {
      const config = getApiConfig(inst);
      if (!config?.baseUrl) {
        await supabase.from("whatsapp_instances").update({ status: "error" }).eq("id", inst.id);
        results.push({ id: inst.id, status: "error", reason: "missing_api_url" });
        continue;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let statusEndpoint = "";

      if (config.provider === "uazapi_go") {
        headers["token"] = config.token || "";
        statusEndpoint = `${config.baseUrl}/instance/status`;
      } else if (config.provider === "whatsapi") {
        headers["token"] = config.token || "";
        statusEndpoint = `${config.baseUrl}/instance/connection`;
      } else {
        const clientToken = config.token || Deno.env.get("ZAPI_CLIENT_TOKEN");
        if (clientToken && !config.baseUrl.includes(clientToken)) headers["Client-Token"] = clientToken;
        statusEndpoint = `${config.baseUrl}/status`;
      }

      let newStatus: "connected" | "disconnected" | "qr_pending" | "error" = "disconnected";
      try {
        const resp = await fetch(statusEndpoint, { method: "GET", headers });
        const text = await resp.text();
        let data: any = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

        console.log(`API status for ${inst.name} (${config.provider}) @ ${statusEndpoint}:`, JSON.stringify(data));

        // Detecção robusta (uazapi/z-api/whatsapi): checa vários formatos de resposta.
        const nested = data?.instance || {};
        const st = String(data?.status ?? data?.state ?? nested?.status ?? nested?.state ?? "").toLowerCase();
        const isConnected =
          data?.connected === true || data?.smartphoneConnected === true ||
          data?.loggedIn === true || nested?.loggedIn === true ||
          st === "connected" || st === "open";

        if (isConnected) {
          newStatus = "connected";
        } else if (data?.error) {
          newStatus = "error";
        } else {
          newStatus = "disconnected";
        }
      } catch (e) {
        console.error(`Status probe failed for ${inst.name}:`, e);
        newStatus = "error";
      }

      const update: Record<string, unknown> = { status: newStatus };
      if (newStatus === "connected") update.last_connected_at = new Date().toISOString();
      await supabase.from("whatsapp_instances").update(update).eq("id", inst.id);
      results.push({ id: inst.id, status: newStatus });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("check-whatsapp-status error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});