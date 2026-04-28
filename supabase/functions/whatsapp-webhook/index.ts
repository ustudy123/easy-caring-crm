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
 
        // If incoming message (not from me, not group), handle lead distribution logic
        if (!isFromMe && cleanPhone && !isGroup) {
          const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("*")
            .eq("phone", cleanPhone)
            .maybeSingle();

          if (clientError) console.error("Error fetching client:", clientError);

          let targetStoreId = client?.store_id || null;
          const normalizedText = text.toLowerCase();

          // Lead distribution logic: check for store preference in the message
          const { data: allStores } = await supabase.from("stores").select("id, name");
          if (allStores) {
            for (const store of allStores) {
              if (normalizedText.includes(store.name.toLowerCase())) {
                targetStoreId = store.id;
                console.log(`Detected store preference: ${store.name}`);
                break;
              }
            }
          }

          // Helper to log transfers
          const logTransfer = async (clientId: string, fromId: string | null, toId: string | null, reason: string) => {
            await supabase.from("service_transfers").insert({
              client_id: clientId,
              from_seller_id: fromId,
              to_seller_id: toId,
              reason: reason
            });
          };

          if (!client) {
            // Create new client if not exists
            const { data: newClient, error: createError } = await supabase.from("clients").insert({
              name: senderName,
              phone: cleanPhone,
              store_id: targetStoreId,
              status: 'novo',
              last_message_at: new Date().toISOString(),
              last_message_from_client_at: new Date().toISOString()
            }).select("id").single();

            if (createError) {
              console.error("Error creating client:", createError);
            } else {
              // Create a lead record too
              await supabase.from("leads").insert({
                client_name: senderName,
                client_phone: cleanPhone,
                source: "whatsapp",
                stage: "abordagem",
                store_id: targetStoreId
              });
            }
          } else {
            // Update existing client
            let updateData: any = {
              last_message_at: new Date().toISOString(),
              last_message_from_client_at: new Date().toISOString(),
              alert_status: 'none' // Reset alerts when new message arrives
            };

            // Only update store_id if not already assigned to a seller (as per user instruction)
            if (!client.assigned_seller_id) {
              updateData.store_id = targetStoreId;
            } else {
              // Check if the assigned seller is active
              const { data: sellerProfile } = await supabase
                .from("profiles")
                .select("id, is_active, substitute_id")
                .eq("id", client.assigned_seller_id)
                .maybeSingle();

              if (sellerProfile && !sellerProfile.is_active && sellerProfile.substitute_id) {
                console.log(`Seller ${client.assigned_seller_id} is inactive. Redirecting to substitute ${sellerProfile.substitute_id}`);
                const originalSellerId = client.assigned_seller_id;
                updateData.assigned_seller_id = sellerProfile.substitute_id;
                
                // Log the redirection
                await logTransfer(client.id, originalSellerId, sellerProfile.substitute_id, "Vendedor inativo/ausente (redirecionamento automático)");
              }
            }

            await supabase
              .from("clients")
              .update(updateData)
              .eq("id", client.id);
          }
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
