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
    const { phone, message } = await req.json();

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const whatsappApiUrl = Deno.env.get("WHATSAPP_API_URL");
    const whatsappApiKey = Deno.env.get("WHATSAPP_API_KEY");

    if (!whatsappApiUrl || !whatsappApiKey) {
      return new Response(JSON.stringify({ error: "WhatsApp API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send message via uazapi
    const cleanPhone = phone.replace(/\D/g, "");

    // uazapi endpoint: POST /send/text with `token` header
    const baseUrl = whatsappApiUrl.replace(/\/+$/, "");
    const apiResponse = await fetch(`${baseUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": whatsappApiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
      }),
    });

    const apiData = await apiResponse.json();
    console.log("uazapi response:", JSON.stringify(apiData));

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

    const messageId = apiData?.key?.id || apiData?.id || crypto.randomUUID();

    await supabase.from("whatsapp_messages").insert({
      message_id: messageId,
      phone: cleanPhone,
      body: message,
      is_from_me: true,
      timestamp: new Date().toISOString(),
    });

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
