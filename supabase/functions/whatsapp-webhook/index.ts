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
        // Debug log full body for investigation
        console.log("Processing message data:", JSON.stringify(data));

        let phone = message.from || message.remoteJid || data.from || body.sender || body.instance || "";
        
        // Specific logic for your number to ensure it's captured correctly
        if (!phone && body.instance === "11957783553") {
          phone = "11957783553";
        }

        const cleanPhone = phone.toString().replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/[^0-9]/g, "");
        const text = message.body || message.text || message.conversation || data.body || body.content || "Mensagem de mídia ou vazia";
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
          store_id: "b7369414-9afe-4870-974e-45aa58173b8c"
        });
 
       // If incoming message (not from me), check if lead exists, create if not
       if (!isFromMe && cleanPhone) {
         const { data: existingLead, error: leadSearchError } = await supabase
           .from("leads")
           .select("id")
           .eq("client_phone", cleanPhone)
           .maybeSingle();

         if (leadSearchError) console.error("Error searching lead:", leadSearchError);

         if (!existingLead) {
           // Extract name from push name or contact
           const contactName = message.pushName || message.notifyName || data.pushName || `Cliente ${cleanPhone}`;
           
           // Default store_id from earlier check
           const defaultStoreId = "b7369414-9afe-4870-974e-45aa58173b8c";
 
           const { data: newLead, error: insertError } = await supabase.from("leads").insert({
             client_name: contactName,
             client_phone: cleanPhone,
             source: "whatsapp",
             stage: "abordagem",
             notes: `Mensagem automática: "${text.substring(0, 200)}"`,
             tags: ["whatsapp", "auto"],
             value: 0,
             store_id: defaultStoreId
           }).select().single();
 
           if (insertError) {
             console.error("Error creating lead:", insertError);
           } else {
             console.log(`New lead created: ${newLead.id}`);
             
             // Add interaction record
             await supabase.from("interactions").insert({
               lead_id: newLead.id,
               type: "whatsapp",
               description: `Primeira mensagem: ${text}`
             });
           }
         } else {
           // Lead exists, update interaction
           await supabase.from("interactions").insert({
             lead_id: existingLead.id,
             type: "whatsapp",
             description: text
           });
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
