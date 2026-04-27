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
 
        // uazapi webhook structure: 
        // Format A: { event: "message", data: { chatid, text, ... } }
        // Format B: { EventType: "chats", chat: { wa_chatid, wa_lastMessageTextVote, name, ... } }
        const event = body.event || body.type || body.action || body.EventType;
        const data = body.data || body.chat || body;
       
       console.log("Detected Event:", event);
       console.log("Event Data:", JSON.stringify(data));

       // Handle incoming message (uazapi sends "message" singular; also support legacy formats)
        const isMessageEvent = event === "messages" || event === "message" || event === "messages.upsert" || event === "chats";
       
       if (isMessageEvent) {
         // uazapi: phone comes from sender or chatid (e.g. "5511957783553@s.whatsapp.net")
          const rawPhone = data.wa_chatid || data.sender || data.chatid || data.from || data.remoteJid || data.key?.remoteJid || "";
         const cleanPhone = rawPhone.toString()
           .replace("@s.whatsapp.net", "")
           .replace("@c.us", "")
           .replace("@g.us", "")
           .replace(/[^0-9]/g, "");

         // uazapi: text is in data.text (not data.body)
          const text = data.wa_lastMessageTextVote || data.text || data.body || data.message?.conversation || data.content || "[mensagem sem texto]";
         const messageId = data.messageid || data.id || data.key?.id || crypto.randomUUID();
         const isFromMe = data.fromMe || data.key?.fromMe || false;
          const isGroup = data.wa_isGroup || data.isGroup || rawPhone.includes("@g.us");
         // uazapi uses messageTimestamp in milliseconds
          const rawTs = data.wa_lastMsgTimestamp || data.messageTimestamp || data.timestamp || Date.now();
         const tsMs = rawTs > 1e12 ? rawTs : rawTs * 1000;
          const senderName = data.name || data.wa_name || data.senderName || data.pushName || data.notifyName || `Cliente ${cleanPhone}`;

         console.log(`Parsed → phone: ${cleanPhone} | fromMe: ${isFromMe} | isGroup: ${isGroup} | text: "${text}"`);

         if (!cleanPhone) {
           console.warn("Skipping: no phone could be extracted from payload");
           return new Response(JSON.stringify({ success: true, action: "skipped_no_phone" }), {
             status: 200,
             headers: { ...corsHeaders, "Content-Type": "application/json" },
           });
         }
 
        // Store message in whatsapp_messages table
        const { error: msgError } = await supabase.from("whatsapp_messages").insert({
          message_id: messageId,
          phone: cleanPhone,
          body: text,
          is_from_me: isFromMe,
          timestamp: new Date(tsMs).toISOString(),
          raw_data: body
        });
        if (msgError) console.error("Error inserting whatsapp_messages:", msgError);
 
       // If incoming message (not from me, not group), check if lead exists, create if not
       if (!isFromMe && cleanPhone && !isGroup) {
         const { data: existingLead, error: leadSearchError } = await supabase
           .from("leads")
           .select("id")
           .eq("client_phone", cleanPhone)
           .maybeSingle();

         if (leadSearchError) console.error("Error searching lead:", leadSearchError);

         if (!existingLead) {
            // Get the first store available if none specified
            const { data: storeData } = await supabase.from("stores").select("id").limit(1).maybeSingle();
            const targetStoreId = storeData?.id || null;

            // Create or find a client first (interactions table requires client_id)
            let clientId;
            const { data: existingClient } = await supabase.from("clients").select("id").eq("phone", cleanPhone).maybeSingle();
            
            if (!existingClient) {
              const { data: newClient, error: clientError } = await supabase.from("clients").insert({
                name: senderName,
                phone: cleanPhone,
                store_id: targetStoreId,
                total_purchases: 0
              }).select("id").single();
              
              if (clientError) {
                console.error("Error creating client:", clientError);
              } else {
                clientId = newClient.id;
              }
            } else {
              clientId = existingClient.id;
            }

            const { data: newLead, error: insertError } = await supabase.from("leads").insert({
              client_name: senderName,
              client_phone: cleanPhone,
              source: "whatsapp",
              stage: "abordagem",
              notes: `Lead criado via WhatsApp: "${text.substring(0, 200)}"`,
              tags: ["whatsapp", "auto"],
              value: 0,
              store_id: targetStoreId
            }).select().single();
 
            if (insertError) {
              console.error("Error creating lead:", insertError);
            } else if (clientId) {
              console.log(`New lead created: ${newLead.id}`);
              
              // Add interaction record
              await supabase.from("interactions").insert({
                lead_id: newLead.id,
                client_id: clientId,
                type: "whatsapp",
                description: `Primeira mensagem: ${text}`
              });
            }
          } else {
            // Lead exists, try to find client to update interaction
            const { data: clientData } = await supabase.from("clients").select("id").eq("phone", cleanPhone).maybeSingle();
            if (clientData) {
              await supabase.from("interactions").insert({
                lead_id: existingLead.id,
                client_id: clientData.id,
                type: "whatsapp",
                description: text
              });
            }
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
