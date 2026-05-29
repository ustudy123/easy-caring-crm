import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalizes a Z-API instance URL down to its base (.../instances/<id>/token/<token>)
function getZApiBaseUrl(customUrl?: string | null, customToken?: string | null) {
  const rawUrl = (customUrl || Deno.env.get("WHATSAPP_API_URL"))?.trim();
  const instanceToken = (customToken || Deno.env.get("WHATSAPP_API_KEY"))?.trim();

  if (!rawUrl) return null;

  let baseUrl = rawUrl.replace(/\/+$/, "");
  // Strip any trailing action like /send-text, /status, /qr-code, etc.
  baseUrl = baseUrl.replace(/\/(send-(text|image|video|audio|file|document)|status|qr-code|restart|disconnect)$/i, "");

  if (baseUrl.includes("/token/")) {
    return baseUrl;
  }

  if (instanceToken) {
    if (/\/token$/i.test(baseUrl)) {
      return `${baseUrl}/${instanceToken}`;
    }
    if (/\/instances\/[^/]+$/i.test(baseUrl)) {
      return `${baseUrl}/token/${instanceToken}`;
    }
  }

  return baseUrl;
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
      // Only Z-API (uazapi) supports this live status probe
      if (inst.provider !== "uazapi") {
        results.push({ id: inst.id, status: inst.status, skipped: true });
        continue;
      }

      const baseUrl = getZApiBaseUrl(inst.api_url, inst.api_token);
      if (!baseUrl) {
        await supabase.from("whatsapp_instances").update({ status: "error" }).eq("id", inst.id);
        results.push({ id: inst.id, status: "error", reason: "missing_api_url" });
        continue;
      }

      const clientToken = inst.api_token || Deno.env.get("ZAPI_CLIENT_TOKEN");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (clientToken && !baseUrl.includes(clientToken)) headers["Client-Token"] = clientToken;

      let newStatus: "connected" | "disconnected" | "qr_pending" | "error" = "disconnected";
      try {
        const resp = await fetch(`${baseUrl}/status`, { method: "GET", headers });
        const text = await resp.text();
        let data: any = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

        console.log(`Z-API status for ${inst.name}:`, JSON.stringify(data));

        if (data?.connected === true || data?.smartphoneConnected === true) {
          newStatus = "connected";
        } else if (data?.error) {
          newStatus = "error";
        } else {
          // Not connected; if a session/QR is expected it's pending, otherwise disconnected
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