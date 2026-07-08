import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getApiConfig(inst: { provider: string; api_url?: string | null; api_token?: string | null }) {
  const provider = inst.provider || "uazapi";
  const rawUrl = (inst.api_url || Deno.env.get("WHATSAPP_API_URL"))?.trim();
  const token = (inst.api_token || Deno.env.get("WHATSAPP_API_KEY"))?.trim();

  if (!rawUrl) return null;

  let baseUrl = rawUrl.replace(/\/+$/, "");

  // uazapiGO (ex.: ipazua.uazapi.com): POST {base}/send/text com header `token`.
  if (provider === "uazapi_go" || /uazapi\./i.test(baseUrl)) {
    baseUrl = baseUrl
      .replace(/\/send\/(text|media|image|video|audio|file|document)$/i, "")
      .replace(/\/send-(text|image|video|audio|file|document)$/i, "");
    return { baseUrl, token, provider: "uazapi_go" };
  }

  if (provider === "whatsapi") {
    return { baseUrl, token, provider: "whatsapi" };
  }

  // Z-API (uazapi) legacy logic
  baseUrl = baseUrl.replace(/\/send-(text|image|video|audio|file|document)$/i, "");
  if (!baseUrl.includes("/token/") && token) {
    if (/\/token$/i.test(baseUrl)) {
      baseUrl = `${baseUrl}/${token}`;
    } else if (/\/instances\/[^/]+$/i.test(baseUrl)) {
      baseUrl = `${baseUrl}/token/${token}`;
    }
  }
  return { baseUrl, token, provider: "uazapi" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
     const body = await req.json();
      const { phone, message, mediaUrl, mediaType, senderId, senderName, instanceId, contactName } = body;

    if (!phone || (!message && !mediaUrl)) {
      return new Response(JSON.stringify({ error: "phone and (message or mediaUrl) are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve target instance: explicit instanceId > client's received_on_instance_id > default env
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Vendedor que está enviando (para escolher instância e vincular o cliente novo).
    let sellerRow: any = null;
    if (senderId) {
      const { data } = await supabase
        .from("sellers").select("id, store_id").eq("user_id", senderId).maybeSingle();
      sellerRow = data;
    }

    let resolvedInstanceId: string | null = instanceId || null;
    let customApiUrl: string | null = null;
    let customApiToken: string | null = null;

    if (!resolvedInstanceId) {
      const cleanPhoneLookup = phone.replace(/\D/g, "");
      const { data: client } = await supabase
        .from("clients")
        .select("received_on_instance_id")
        .eq("phone", cleanPhoneLookup)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedInstanceId = client?.received_on_instance_id || null;
    }

    // Nova conversa: sem instanceId e sem received_on_instance_id, resolve uma
    // instância padrão — senão o envio cai no env global (normalmente não
    // configurado no setup multi-instância) e retorna erro.
    if (!resolvedInstanceId) {
      // 1) instância conectada do próprio vendedor
      if (sellerRow?.id) {
        const { data } = await supabase.from("whatsapp_instances")
          .select("id").eq("instance_type", "seller").eq("seller_id", sellerRow.id)
          .eq("status", "connected").limit(1).maybeSingle();
        if (data?.id) resolvedInstanceId = data.id;
      }
      // 2) instância conectada da loja do vendedor
      if (!resolvedInstanceId && sellerRow?.store_id) {
        const { data } = await supabase.from("whatsapp_instances")
          .select("id").eq("instance_type", "store").eq("store_id", sellerRow.store_id)
          .eq("status", "connected").limit(1).maybeSingle();
        if (data?.id) resolvedInstanceId = data.id;
      }
      // 3) qualquer instância conectada (prefere 'store')
      if (!resolvedInstanceId) {
        const { data } = await supabase.from("whatsapp_instances")
          .select("id").eq("status", "connected")
          .order("instance_type", { ascending: false }).limit(1).maybeSingle();
        if (data?.id) resolvedInstanceId = data.id;
      }
      // 4) último recurso: qualquer instância (o status pode estar desatualizado)
      if (!resolvedInstanceId) {
        const { data } = await supabase.from("whatsapp_instances")
          .select("id").order("instance_type", { ascending: false }).limit(1).maybeSingle();
        if (data?.id) resolvedInstanceId = data.id;
      }
    }

    if (resolvedInstanceId) {
      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("api_url, api_token")
        .eq("id", resolvedInstanceId)
        .maybeSingle();
      
      if (inst) {
        customApiUrl = inst.api_url;
        customApiToken = inst.api_token;
      }
    }

    const apiConfig = getApiConfig({ 
      provider: resolvedInstanceId ? 'custom' : 'uazapi', // Placeholder as we'll fetch real one below
      api_url: customApiUrl, 
      api_token: customApiToken 
    });

    // Re-fetch to get the provider if we have a resolvedInstanceId
    let resolvedProvider = "uazapi";
    if (resolvedInstanceId) {
      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("api_url, api_token, provider")
        .eq("id", resolvedInstanceId)
        .maybeSingle();
      
      if (inst) {
        customApiUrl = inst.api_url;
        customApiToken = inst.api_token;
        resolvedProvider = inst.provider;
      }
    }

    const config = getApiConfig({ provider: resolvedProvider, api_url: customApiUrl, api_token: customApiToken });

    if (!config?.baseUrl) {
      return new Response(JSON.stringify({ error: "WhatsApp API not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const baseUrl = config.baseUrl;
    
    let endpoint = "";
    let apiBody: any;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (config.provider === "uazapi_go") {
      // uazapiGO: header `token` + /send/text (ou /send/media para anexos)
      headers["token"] = config.token || "";
      if (mediaUrl) {
        endpoint = `${baseUrl}/send/media`;
        apiBody = { number: cleanPhone, type: mediaType || "image", file: mediaUrl, text: message || "" };
      } else {
        endpoint = `${baseUrl}/send/text`;
        apiBody = { number: cleanPhone, text: message };
      }
    } else if (config.provider === "whatsapi") {
      headers["token"] = config.token || "";
      if (mediaUrl) {
        endpoint = `${baseUrl}/instance/send-link`; // WhatsAPI uses send-link or similar for media depending on spec
        // Looking at common uazapi patterns (v2.0): /message/text, /message/image
        // The provided spec was truncated, but standard is /message/text
        endpoint = `${baseUrl}/message/text`;
        if (mediaUrl) endpoint = `${baseUrl}/message/image`;
        
        apiBody = {
          number: cleanPhone,
          options: { delay: 1200, presence: "composing" }
        };
        if (mediaUrl) {
          apiBody.image = mediaUrl;
          apiBody.caption = message || "";
        } else {
          apiBody.text = message;
        }
      } else {
        endpoint = `${baseUrl}/message/text`;
        apiBody = {
          number: cleanPhone,
          text: message,
          options: { delay: 1200, presence: "composing" }
        };
      }
    } else {
      // Legacy Z-API
      endpoint = `${baseUrl}/send-text`;
      const clientToken = config.token || Deno.env.get("ZAPI_CLIENT_TOKEN");
      if (clientToken && !baseUrl.includes(clientToken)) headers["Client-Token"] = clientToken;

      if (mediaUrl) {
        endpoint = `${baseUrl}/send-image`;
        apiBody = {
          phone: cleanPhone,
          image: mediaUrl,
          caption: message || '',
        };
      } else {
        apiBody = {
          phone: cleanPhone,
          message: message,
        };
      }
    }

    console.log(`Enviando mensagem (${config.provider}) para ${cleanPhone} via ${endpoint}...`);

    const apiResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(apiBody),
    });

    const responseText = await apiResponse.text();
    let apiData: any = {};

    try {
      apiData = responseText ? JSON.parse(responseText) : {};
    } catch {
      apiData = { raw: responseText };
    }

    console.log("Z-API response:", JSON.stringify(apiData));

    const apiReturnedError = !apiResponse.ok || !!apiData?.error;

    if (apiReturnedError) {
      return new Response(JSON.stringify({ error: "Failed to send message", details: apiData }), {
        status: apiResponse.ok ? 502 : apiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageId = apiData?.messageId || apiData?.zaapId || apiData?.id || crypto.randomUUID();

    const { error: msgInsertErr } = await supabase.from("whatsapp_messages").insert({
      message_id: messageId,
      phone: cleanPhone,
      body: message || (mediaUrl ? `[Arquivo: ${mediaType || 'mídia'}]` : ''),
      media_url: mediaUrl,
      media_type: mediaType,
      is_from_me: true,
      timestamp: new Date().toISOString(),
      sender_id: senderId,
      sender_name: senderName,
      received_on_instance_id: resolvedInstanceId,
    });
    if (msgInsertErr) {
      console.error("Falha ao gravar whatsapp_messages:", JSON.stringify(msgInsertErr));
    }

    // Garante o registro do cliente (para a conversa aparecer nomeada na lista).
    // Roda como service role, então não esbarra na RLS de INSERT de clients.
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id, name")
      .eq("phone", cleanPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingClient?.id) {
      const upd: any = {
        last_seller_response_at: new Date().toISOString(),
        alert_status: 'none',
        alert_notified_at: null,
      };
      // "Nova conversa" passa contactName explicitamente (o usuário digitou),
      // então respeita o nome informado mesmo que o cliente já tenha um.
      if (contactName) {
        upd.name = contactName;
      }
      await supabase.from("clients").update(upd).eq("id", existingClient.id);
    } else {
      // Conversa nova: cria o cliente com o nome informado e vincula ao vendedor.
      await supabase.from("clients").insert({
        name: contactName || senderName || cleanPhone,
        phone: cleanPhone,
        assigned_seller_id: sellerRow?.id ?? null,
        store_id: sellerRow?.store_id ?? null,
        last_seller_response_at: new Date().toISOString(),
      } as any);
    }

    return new Response(JSON.stringify({
      success: true,
      messageId,
      instanceId: resolvedInstanceId,
      message_saved: !msgInsertErr,
      message_error: msgInsertErr?.message ?? null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send WhatsApp error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
