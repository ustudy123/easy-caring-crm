import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// WhatsApp API config (uazapi)
const WHATSAPP_API_URL = "https://ipazua.uazapi.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseKey);
 
      const rawBody = await req.text();
      console.log("Webhook Raw Body Received:", rawBody);
      
      let body;
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        console.error("Failed to parse JSON body:", e);
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Full Request Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));
 
      // MeuzAPI / Evolution API / Z-API structure detection
      const event = body.event || body.type || body.action;
      const data = body.data || body;
      
      console.log("Detected Event:", event);
 
     // Handle incoming message
     if (event === "messages" || event === "message" || event === "messages.upsert") {
       const message = data.message || data;
       const phone = message.from || message.remoteJid || data.from || "";
       const cleanPhone = phone.replace("@s.whatsapp.net", "").replace("@c.us", "");
       const text = message.body || message.text || message.conversation || data.body || "";
       const messageId = message.id || message.key?.id || data.id || crypto.randomUUID();
       const isFromMe = message.fromMe || message.key?.fromMe || data.fromMe || false;
       const timestamp = message.timestamp || data.timestamp || Math.floor(Date.now() / 1000);
 
       // Store message in whatsapp_messages table
       await supabase.from("whatsapp_messages").insert({
         message_id: messageId,
         phone: cleanPhone,
         body: text,
         is_from_me: isFromMe,
         timestamp: new Date(timestamp * 1000).toISOString(),
         raw_data: body,
       });
 
       // If incoming message (not from me), check if lead exists, create if not
       if (!isFromMe && cleanPhone) {
         const { data: existingLead } = await supabase
           .from("leads")
           .select("id")
           .eq("client_phone", cleanPhone)
           .maybeSingle();
 
         if (!existingLead) {
           // Extract name from push name or contact
           const contactName = message.pushName || message.notifyName || data.pushName || `WhatsApp ${cleanPhone}`;
           
           // Default store_id from earlier check
           const defaultStoreId = "b7369414-9afe-4870-974e-45aa58173b8c";
 
           await supabase.from("leads").insert({
             client_name: contactName,
             client_phone: cleanPhone,
             source: "whatsapp",
             stage: "abordagem",
             notes: `Mensagem automática: "${text.substring(0, 200)}"`,
             tags: ["whatsapp", "auto"],
             value: 0,
             store_id: defaultStoreId
           });
 
           console.log(`New lead created from WhatsApp: ${contactName} (${cleanPhone})`);
         }
 
         // Update last_contact on client if exists
         await supabase
           .from("clients")
           .update({ last_contact: new Date().toISOString() })
           .eq("phone", cleanPhone);
       }
 
       return new Response(JSON.stringify({ success: true, action: "message_processed" }), {
         status: 200,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     return new Response(JSON.stringify({ success: true, action: "event_received" }), {
       status: 200,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error: any) {
     console.error("Webhook error:", error);
     return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
