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
          // PRIORITY: Check if message contains a seller code (ramal). If matched, route directly.
          const codeMatch = text.match(/\b(\d{3,10})\b/);
          if (codeMatch) {
            const candidateCode = codeMatch[1];
            const { data: sellerByCode } = await supabase
              .from("sellers")
              .select("id, name")
              .eq("code", candidateCode)
              .maybeSingle();
            if (sellerByCode) {
              const { data: assignResult, error: assignErr } = await supabase.rpc("assign_client_by_seller_code", {
                _phone: cleanPhone,
                _code: candidateCode,
              });
              if (!assignErr) {
                console.log(`Client ${cleanPhone} routed to seller ${sellerByCode.name} via code ${candidateCode}`);
                await sendWhatsAppMessage(
                  cleanPhone,
                  `Perfeito! Você será atendido(a) por ${sellerByCode.name}. Em instantes ele(a) entrará em contato. ✅`,
                  isTest
                );
                return new Response(JSON.stringify({ success: true, action: "routed_by_code", seller: sellerByCode.name }), {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
          }

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
             // 1. First message from a new client: Start URA flow at step "ask_code"
             const { error: createError } = await supabase.from("clients").upsert({
               name: senderName,
               phone: cleanPhone,
               status: 'novo',
               triaging: true,
               triage_step: 'ask_code',
               last_message_at: new Date().toISOString(),
               last_message_from_client_at: new Date().toISOString()
             }, { onConflict: 'phone' }).select("id").single();

             if (!createError) {
               const welcomeMsg = `Olá! 👋 Você está falando com a *TF Tintas*.\n\nVocê já possui o *código (ramal)* de um vendedor?\n\n👉 Se *sim*, digite o código agora (ex: 1023).\n👉 Se *não*, responda com *N* para continuar.`;
               await sendWhatsAppMessage(cleanPhone, welcomeMsg, isTest);
             }
           } else if (client.triaging) {
             // URA-style step machine
             const step = client.triage_step || 'ask_code';
             const trimmed = text.trim();
             const lower = trimmed.toLowerCase();

             const updateClient = async (patch: any) => {
               await supabase.from("clients").update({
                 ...patch,
                 last_message_at: new Date().toISOString(),
                 last_message_from_client_at: new Date().toISOString(),
               }).eq("id", client.id);
             };

              const distributeLead = async (storeId: string | null) => {
                // Call the new RPC for round-robin distribution
                const { data: nextSeller, error: rpcError } = await supabase.rpc("get_next_seller_for_distribution", {
                  _store_id: storeId
                });

                if (!rpcError && nextSeller && nextSeller.length > 0) {
                  const picked = nextSeller[0];
                  await assignToSeller(picked.id, picked.name, picked.store_id);
                  // Mark as assigned to update last_assigned_at
                  await supabase.rpc("mark_seller_assigned", { _seller_id: picked.id });
                  return true;
                }
                return false;
              };

              const finishWithStore = async (storeId: string | null, storeName?: string) => {
                const distributed = await distributeLead(storeId);
                
                if (!distributed) {
                  // Fallback: no seller available, just create the lead
                  await updateClient({ store_id: storeId, triaging: false, triage_step: null });
                  await supabase.from("leads").insert({
                    client_name: client.name,
                    client_phone: client.phone,
                    source: "whatsapp",
                    stage: "abordagem",
                    store_id: storeId,
                  });
                  const msg = storeName
                    ? `Perfeito! Você será atendido(a) pela unidade *${storeName}*. Um consultor entrará em contato em breve. ✅`
                    : `Entendido! Um de nossos consultores disponíveis entrará em contato em breve. ✅`;
                  await sendWhatsAppMessage(cleanPhone, msg, isTest);
                }
              };

             const assignToSeller = async (sellerId: string, sellerName: string, storeId: string | null) => {
               await updateClient({
                 assigned_seller_id: sellerId,
                 store_id: storeId,
                 status: 'em_atendimento',
                 claimed_at: new Date().toISOString(),
                 triaging: false,
                 triage_step: null,
               });
               if (storeId) {
                 await supabase.from("leads").insert({
                   client_name: client.name,
                   client_phone: client.phone,
                   source: "whatsapp",
                   stage: "abordagem",
                   store_id: storeId,
                   assigned_to: sellerId,
                 });
               }
               await sendWhatsAppMessage(cleanPhone, `Perfeito! Você será atendido(a) por *${sellerName}*. Em instantes ele(a) entrará em contato. ✅`, isTest);
             };

             if (step === 'ask_code') {
               const codeMatch = trimmed.match(/^\d{3,10}$/);
               if (codeMatch) {
                 const { data: sellerByCode } = await supabase
                   .from("sellers").select("id, name, store_id")
                   .eq("code", trimmed).maybeSingle();
                 if (sellerByCode) {
                   await assignToSeller(sellerByCode.id, sellerByCode.name, sellerByCode.store_id);
                 } else {
                   await sendWhatsAppMessage(cleanPhone, `Não localizei esse código. Verifique e digite novamente, ou responda *N* para continuar sem código.`, isTest);
                 }
               } else if (lower === 'n' || lower === 'nao' || lower === 'não') {
                 // Move to ask_store
                 const { data: stores } = await supabase.from("stores").select("id, name").order("name");
                  const storeList = (stores || []).map((s, i) => `${i + 1} - ${s.name}`).join("\n");
                  const generalOptionIndex = (stores || []).length + 1;
                  const fullList = `${storeList}\n${generalOptionIndex} - Ainda não sei / Quero atendimento geral`;
                  
                  await updateClient({ triage_step: 'ask_store' });
                  await sendWhatsAppMessage(
                    cleanPhone, 
                    `Para direcionarmos melhor seu atendimento, escolha a *loja ou região* mais próxima de você:\n\n${fullList}\n\nDigite apenas o *número* da opção desejada.`, 
                    isTest
                  );
               } else {
                 await sendWhatsAppMessage(cleanPhone, `Por favor, digite seu *código de vendedor* (ex: 1023) ou responda *N* se não tiver.`, isTest);
               }
             } else if (step === 'ask_store') {
               const { data: stores } = await supabase.from("stores").select("id, name").order("name");
                const numMatch = trimmed.match(/^\d+$/);
                const selectedIndex = numMatch ? parseInt(trimmed, 10) : -1;
                const generalOptionIndex = (stores || []).length + 1;

                if (lower === 'n' || lower === 'nao' || lower === 'não' || selectedIndex === generalOptionIndex) {
                 await finishWithStore(null);
               } else {
                 let chosen = null as null | { id: string; name: string };
                  if (selectedIndex > 0 && stores && selectedIndex <= stores.length) {
                    chosen = stores[selectedIndex - 1];
                 }
                 if (!chosen && stores) {
                   chosen = stores.find(s => lower.includes(s.name.toLowerCase())) || null;
                 }
                  if (chosen) {
                    // Now ask if they have a specific seller in that store
                    const { data: storeSellers } = await supabase
                      .from("sellers").select("id, name, code")
                      .eq("store_id", chosen.id).order("name");
                    const sellerList = (storeSellers || [])
                      .map(s => `👉 Código *${s.code || 'S/C'}* — ${s.name}`).join("\n");
                    
                    await updateClient({ store_id: chosen.id, triage_step: 'ask_seller' });
                    
                    const msg = `Você escolheu *${chosen.name}*. Possui um *vendedor específico* nessa loja?\n\n${sellerList || '(Nenhum vendedor disponível no momento)'}\n\n👉 Se sim, digite o *código* do vendedor.\n👉 Se não, responda com *N* para ser atendido pelo próximo disponível.`;
                    await sendWhatsAppMessage(cleanPhone, msg, isTest);
                  } else {
                    const storeList = (stores || []).map((s, i) => `${i + 1} - ${s.name}`).join("\n");
                    const generalOptionIndex = (stores || []).length + 1;
                    const fullList = `${storeList}\n${generalOptionIndex} - Ainda não sei / Quero atendimento geral`;
                    
                    await sendWhatsAppMessage(
                      cleanPhone, 
                      `Opção inválida. Por favor, escolha uma das opções abaixo (digite apenas o número):\n\n${fullList}`, 
                      isTest
                    );
                  }
               }
              } else if (step === 'ask_seller') {
                const storeId = client.store_id;
                if (lower === 'n' || lower === 'nao' || lower === 'não') {
                  const distributed = await distributeLead(storeId);
                  if (!distributed) {
                    const { data: store } = await supabase.from("stores").select("name").eq("id", storeId).maybeSingle();
                    await finishWithStore(storeId, store?.name);
                  }
                } else {
                 const codeMatch = trimmed.match(/^\d{3,10}$/);
                 if (codeMatch) {
                   const { data: sellerByCode } = await supabase
                     .from("sellers").select("id, name, store_id")
                     .eq("code", trimmed).maybeSingle();
                   if (sellerByCode) {
                     await assignToSeller(sellerByCode.id, sellerByCode.name, sellerByCode.store_id || storeId);
                   } else {
                     await sendWhatsAppMessage(cleanPhone, `Código não encontrado. Digite um código válido ou *N* para o próximo disponível.`, isTest);
                   }
                 } else {
                   await sendWhatsAppMessage(cleanPhone, `Não entendi. Digite o *código* do vendedor (ex: 1023) ou *N* para o próximo disponível.`, isTest);
                 }
               }
             } else {
               // Unknown step — restart
               await updateClient({ triage_step: 'ask_code' });
               await sendWhatsAppMessage(cleanPhone, `Olá novamente! Você possui o *código* de um vendedor? Digite o código ou *N* para continuar.`, isTest);
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
