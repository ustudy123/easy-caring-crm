import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
     const body = await req.json();
      const { phone, message, mediaUrl, mediaType, senderId, senderName } = body;

    if (!phone || (!message && !mediaUrl)) {
      return new Response(JSON.stringify({ error: "phone and (message or mediaUrl) are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const whatsappApiUrl = Deno.env.get("WHATSAPP_API_URL"); // Z-API URL format: https://api.z-api.io/instances/ID/token/TOKEN

    if (!whatsappApiUrl) {
      return new Response(JSON.stringify({ error: "WhatsApp API (Z-API) not configured. Please set WHATSAPP_API_URL." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const baseUrl = whatsappApiUrl.replace(/\/+$/, "");
    
    let endpoint = `${baseUrl}/send-text`;
    let apiBody: any;

    if (mediaUrl) {
      // Z-API handles image, video, audio separately, but we'll focus on image as it's common
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

    console.log(`Sending message via Z-API to ${cleanPhone}...`);

    const apiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiBody),
    });

    const apiData = await apiResponse.json();
    console.log("Z-API response:", JSON.stringify(apiData));

    if (!apiResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to send message", details: apiData }), {
        status: apiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store sent message in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const messageId = apiData?.messageId || apiData?.zaapId || apiData?.id || crypto.randomUUID();

    await supabase.from("whatsapp_messages").insert({
      message_id: messageId,
      phone: cleanPhone,
      body: message || (mediaUrl ? `[Arquivo: ${mediaType || 'mídia'}]` : ''),
      media_url: mediaUrl,
      media_type: mediaType,
      is_from_me: true,
      timestamp: new Date().toISOString(),
      sender_id: senderId,
      sender_name: senderName
    });

    // Update client metadata for response tracking
    await supabase
      .from("clients")
      .update({
        last_seller_response_at: new Date().toISOString(),
        alert_status: 'none',
        alert_notified_at: null
      })
      .eq("phone", cleanPhone);

    return new Response(JSON.stringify({ success: true, messageId }), {
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
