import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// WhatsApp API config (uazapi)
const WHATSAPP_API_URL = "https://ipazua.uazapi.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

 // Function to send message via uazapi
 async function sendWhatsAppMessage(phone: string, text: string) {
   try {
     const response = await fetch(`${WHATSAPP_API_URL}/message/sendText?token=${Deno.env.get("WHATSAPP_API_TOKEN")}`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         chatId: `${phone}@s.whatsapp.net`,
         text: text
       })
     });
     return await response.json();
   } catch (e) {
     console.error("Error sending WhatsApp message:", e);
   }
 }
 
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
             // 1. First message from a new client: Start Triage
             const { data: newClient, error: createError } = await supabase.from("clients").insert({
               name: senderName,
               phone: cleanPhone,
               status: 'novo',
               triaging: true,
               last_message_at: new Date().toISOString(),
               last_message_from_client_at: new Date().toISOString()
             }).select("id, name, phone").single();
 
             if (!createError) {
               // Get stores for triage
               const { data: stores } = await supabase.from("stores").select("name");
               const storeList = stores?.map((s, i) => `${i + 1}. ${s.name}`).join("\n") || "";
               
               const welcomeMsg = `Olá! Seja bem-vindo(a). Para melhor atendê-lo(a), você tem preferência por alguma de nossas lojas?\n\n${storeList}\n\nResponda com o nome da loja ou diga "Não" para ser atendido por qualquer unidade.`;
               await sendWhatsAppMessage(cleanPhone, welcomeMsg);
             }
           } else if (client.triaging) {
             // 2. Client is in triage: Handle their response
             const normalizedText = text.toLowerCase().trim();
             const { data: stores } = await supabase.from("stores").select("id, name");
             
             let selectedStore = stores?.find(s => normalizedText.includes(s.name.toLowerCase()));
             
             if (selectedStore) {
               await supabase.from("clients").update({
                 store_id: selectedStore.id,
                 triaging: false,
                 last_message_at: new Date().toISOString(),
                 last_message_from_client_at: new Date().toISOString()
               }).eq("id", client.id);
               
               await supabase.from("leads").insert({
                 client_name: client.name,
                 client_phone: client.phone,
                 source: "whatsapp",
                 stage: "abordagem",
                 store_id: selectedStore.id
               });
 
               await sendWhatsAppMessage(cleanPhone, `Perfeito! Você será atendido pela unidade ${selectedStore.name}. Um consultor entrará em contato em breve.`);
             } else if (normalizedText === "não" || normalizedText === "nao" || normalizedText.includes("qualquer")) {
               await supabase.from("clients").update({
                 triaging: false,
                 last_message_at: new Date().toISOString(),
                 last_message_from_client_at: new Date().toISOString()
               }).eq("id", client.id);
 
               await supabase.from("leads").insert({
                 client_name: client.name,
                 client_phone: client.phone,
                 source: "whatsapp",
                 stage: "abordagem",
                 store_id: null // Available to everyone
               });
 
               await sendWhatsAppMessage(cleanPhone, `Entendido! Um de nossos consultores disponíveis entrará em contato em breve.`);
             } else {
               await sendWhatsAppMessage(cleanPhone, `Desculpe, não entendi. Por favor, digite o nome de uma de nossas lojas ou "Não" para qualquer unidade.`);
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

              if (sellerProfile) {
                if (!sellerProfile.is_active && sellerProfile.substitute_id) {
                  console.log(`Seller ${client.assigned_seller_id} is inactive. Redirecting to substitute ${sellerProfile.substitute_id}`);
                  const originalSellerId = client.assigned_seller_id;
                  updateData.assigned_seller_id = sellerProfile.substitute_id;
                  
                  // Log the redirection
                  await logTransfer(client.id, originalSellerId, sellerProfile.substitute_id, "Vendedor inativo/ausente (redirecionamento automático)");
                } else if (sellerProfile.is_active) {
                  // Check if this lead was recently transferred and if we should return it
                  const { data: lastTransfer } = await supabase
                    .from("service_transfers")
                    .select("*")
                    .eq("client_id", client.id)
                    .eq("to_seller_id", client.assigned_seller_id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (lastTransfer && lastTransfer.from_seller_id === sellerProfile.id) {
                    // Fetch settings to check auto_return_leads
                    const { data: settings } = await supabase.from("settings").select("auto_return_leads").limit(1).maybeSingle();
                    
                    if (settings?.auto_return_leads) {
                      console.log(`Seller ${sellerProfile.id} is active again. Returning lead ${client.id} from ${client.assigned_seller_id}`);
                      const currentSellerId = client.assigned_seller_id;
                      updateData.assigned_seller_id = sellerProfile.id;
                      await logTransfer(client.id, currentSellerId, sellerProfile.id, "Vendedor retornou de ausência (retorno automático)");
                    }
                  }
                }
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
