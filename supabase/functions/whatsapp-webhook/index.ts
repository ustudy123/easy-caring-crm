import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

 // WhatsApp API config (uazapi)
 const WHATSAPP_API_URL = "https://ipazua.uazapi.com";
 const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

 // Function to send message via uazapi
 async function sendWhatsAppMessage(phone: string, text: string, isTest: boolean = false) {
    if (isTest) {
      console.log(`[TEST MODE] Would send WhatsApp message to ${phone}: ${text}`);
      return { success: true, message: "Test mode: message not sent to real API" };
    }
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

 // Function to analyze message with OpenAI
 async function analyzeMessageWithAI(text: string, stores: { id: string; name: string }[]) {
   if (!OPENAI_API_KEY) {
     console.error("OPENAI_API_KEY not set");
     return null;
   }

   const storeNames = stores.map(s => s.name).join(", ");
   const prompt = `
     Você é um assistente de triagem de uma empresa de intercâmbio/educação. 
     Um cliente enviou a seguinte mensagem: "${text}"
     
     As lojas disponíveis são: ${storeNames}
     
     Sua tarefa é identificar se o cliente expressou preferência por uma dessas lojas ou se ele não tem preferência.
     
     Responda APENAS em formato JSON:
     {
       "preference": "nome_da_loja_exato" ou "nenhuma" ou "incerto",
       "reason": "breve explicação"
     }
     
     Se ele disser "não tenho preferência", "qualquer uma", "tanto faz", responda "nenhuma".
     Se ele citar uma das lojas da lista, responda o nome exato da loja.
     Se não estiver claro, responda "incerto".
   `;

   try {
     const response = await fetch("https://api.openai.com/v1/chat/completions", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "Authorization": `Bearer ${OPENAI_API_KEY}`
       },
       body: JSON.stringify({
         model: "gpt-3.5-turbo",
         messages: [{ role: "user", content: prompt }],
         temperature: 0
       })
     });
     const data = await response.json();
     const content = data.choices[0].message.content;
     return JSON.parse(content);
   } catch (e) {
     console.error("Error calling OpenAI:", e);
     return null;
   }
 }

// Function to generate AI auto-reply for existing clients
async function generateAutoReply(text: string, recentMessages: { body: string; is_from_me: boolean }[], clientName: string) {
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set for auto-reply");
    return null;
  }

  // Build conversation history for context
  const history = recentMessages.slice(-10).map(m => ({
    role: m.is_from_me ? "assistant" as const : "user" as const,
    content: m.body
  }));

  // Add the current message
  history.push({ role: "user", content: text });

  const systemPrompt = `Você é um assistente virtual de atendimento de uma empresa de intercâmbio/educação. 
Seu nome é Assistente Virtual. Seja educado, prestativo e breve nas respostas.
O nome do cliente é ${clientName}.
Responda de forma natural e amigável. Se o cliente mandar uma saudação (oi, olá, etc), cumprimente-o e pergunte como pode ajudá-lo.
Se não souber a resposta para algo específico, diga que vai encaminhar para um consultor humano.
Mantenha as respostas curtas (máximo 2-3 frases).`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          ...history
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("Error calling OpenAI for auto-reply:", e);
    return null;
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
       const isTest = body.test_mode === true;

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
        if (msgError) {
          if (msgError.code === '23505') {
            console.log(`Deduplicated: message ${messageId} already exists.`);
            return new Response(JSON.stringify({ success: true, action: "deduplicated" }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          console.error("Error inserting whatsapp_messages:", msgError);
        }
 
        // If incoming message (not from me, not group), handle lead distribution logic
        if (!isFromMe && cleanPhone && !isGroup) {
          const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("*")
            .eq("phone", cleanPhone)
            .order("created_at", { ascending: false })
            .limit(1)
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
             const { data: newClient, error: createError } = await supabase.from("clients").upsert({
               name: senderName,
               phone: cleanPhone,
               status: 'novo',
               triaging: true,
               last_message_at: new Date().toISOString(),
               last_message_from_client_at: new Date().toISOString()
             }, { onConflict: 'phone' }).select("id, name, phone").single();
 
             if (!createError) {
               // Get stores for triage
               const { data: stores } = await supabase.from("stores").select("name");
               const storeList = stores?.map((s, i) => `${i + 1}. ${s.name}`).join("\n") || "";
               
               const welcomeMsg = `Olá! Seja bem-vindo(a). Para melhor atendê-lo(a), você tem preferência por alguma de nossas lojas?\n\n${storeList}\n\nResponda com o nome da loja ou diga "Não" para ser atendido por qualquer unidade.`;
               await sendWhatsAppMessage(cleanPhone, welcomeMsg, isTest);
             }
           } else if (client.triaging) {
             // 2. Client is in triage: Handle their response using OpenAI
             const { data: stores } = await supabase.from("stores").select("id, name");
             const aiResult = await analyzeMessageWithAI(text, stores || []);
             console.log("AI Triage Result:", aiResult);

             if (aiResult?.preference && aiResult.preference !== "nenhuma" && aiResult.preference !== "incerto") {
               const selectedStore = stores?.find(s => s.name === aiResult.preference);
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

                  await sendWhatsAppMessage(cleanPhone, `Perfeito! Você será atendido pela unidade ${selectedStore.name}. Um consultor entrará em contato em breve.`, isTest);
               } else {
                  await sendWhatsAppMessage(cleanPhone, `Desculpe, não entendi qual unidade você prefere. Por favor, digite o nome de uma de nossas lojas ou "Não" para qualquer unidade.`, isTest);
               }
             } else if (aiResult?.preference === "nenhuma") {
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

                await sendWhatsAppMessage(cleanPhone, `Entendido! Um de nossos consultores disponíveis entrará em contato em breve.`, isTest);
             } else {
                await sendWhatsAppMessage(cleanPhone, `Desculpe, não entendi. Por favor, digite o nome de uma de nossas lojas ou "Não" para qualquer unidade.`, isTest);
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

            // Auto-reply with AI for existing clients
            try {
              // Fetch recent messages for context
              const { data: recentMsgs } = await supabase
                .from("whatsapp_messages")
                .select("body, is_from_me")
                .eq("phone", cleanPhone)
                .order("timestamp", { ascending: false })
                .limit(10);

              const aiReply = await generateAutoReply(
                text,
                (recentMsgs || []).reverse(),
                client.name || senderName
              );

              if (aiReply) {
                await sendWhatsAppMessage(cleanPhone, aiReply, isTest);

                // Store the AI reply in whatsapp_messages
                await supabase.from("whatsapp_messages").insert({
                  message_id: `ai-reply-${crypto.randomUUID()}`,
                  phone: cleanPhone,
                  body: aiReply,
                  is_from_me: true,
                  timestamp: new Date().toISOString(),
                  raw_data: { type: "ai_auto_reply" }
                });
              }
            } catch (aiError) {
              console.error("Error generating AI auto-reply:", aiError);
            }
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
