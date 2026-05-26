import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

 // WhatsApp API config (Z-API)
 // WHATSAPP_API_URL should be set in environment variables: https://api.z-api.io/instances/ID/token/TOKEN
 const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getZApiBaseUrl() {
  const rawUrl = Deno.env.get("WHATSAPP_API_URL")?.trim();
  const instanceToken = Deno.env.get("WHATSAPP_API_KEY")?.trim();

  if (!rawUrl) return null;

  let baseUrl = rawUrl.replace(/\/+$/, "");
  baseUrl = baseUrl.replace(/\/send-(text|image|video|audio|file|document)$/i, "");

  if (baseUrl.includes("/token/")) {
    return baseUrl;
  }

  if (instanceToken) {
    if (/\/token$/i.test(baseUrl)) {
      return `${baseUrl}/${instanceToken}`;
    }

    if (/\/instances\/[^/]+$/i.test(baseUrl)) {
      return `${baseUrl}/token/${instanceToken}`;
    }
  }

  return baseUrl;
}

  // Function to search client in Citel ERP via shared Edge Function
  async function searchCitelClient(phone: string, supabase: any) {
    try {
      const { data, error } = await supabase.functions.invoke('citel-get-client', {
        body: { phone }
      });
      if (error) {
        console.error("Error invoking citel-get-client:", error);
        return null;
      }
      if (data?.found && data.client) {
        // Adapta o formato retornado pelo citel-get-client para o esperado pelo webhook
        return {
          nome: data.client.name,
          email: data.client.email,
          endereco: data.client.address,
          cidade: data.client.city,
          id: data.client.erpId
        };
      }
    } catch (e) {
      console.error("Error searching Citel client:", e);
    }
    return null;
  }

 // Function to send message via Z-API
 async function sendWhatsAppMessage(phone: string, text: string, isTest: boolean = false) {
    const apiBaseUrl = getZApiBaseUrl();
    if (!apiBaseUrl) {
      console.error("WHATSAPP_API_URL not set");
      return { error: "API not configured" };
    }

    if (isTest) {
      console.log(`[TEST MODE] Would send WhatsApp message to ${phone}: ${text}`);
      return { success: true, message: "Test mode: message not sent to real API" };
    }
   try {
     const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
     const headers: Record<string, string> = { "Content-Type": "application/json" };
     if (clientToken) headers["Client-Token"] = clientToken;

      const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/send-text`, {
       method: "POST",
       headers,
       body: JSON.stringify({
         phone: phone,
         message: text
       })
     });
      const responseText = await response.text();
      let responseData: any = {};

      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = { raw: responseText };
      }

      console.log("Z-API send-text response:", JSON.stringify(responseData));
      return response.ok ? responseData : { error: true, details: responseData, status: response.status };
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
      Você é um assistente de triagem da *TF Tintas*, uma loja de materiais de construção, tintas, ferragens e acabamentos.
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
async function generateAutoReply(
  text: string,
  recentMessages: { body: string; is_from_me: boolean }[],
  clientName: string,
  clientCtx: { storeName?: string | null; sellerName?: string | null; interestProducts?: string | null } = {}
) {
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

  const knownStore = clientCtx.storeName ? `loja preferida: ${clientCtx.storeName}` : null;
  const knownSeller = clientCtx.sellerName ? `vendedor responsável: ${clientCtx.sellerName}` : null;
  const knownInterest = clientCtx.interestProducts ? `interesse/produto: ${clientCtx.interestProducts}` : null;
  const knownLines = [knownStore, knownSeller, knownInterest].filter(Boolean).join("\n- ");

  const missing: string[] = [];
  if (!clientCtx.storeName) missing.push("PREFERÊNCIA DE LOJA/UNIDADE (qual loja/unidade da TF Tintas o cliente prefere)");
  if (!clientCtx.sellerName) missing.push("CÓDIGO (RAMAL) DE VENDEDOR (se já tem um vendedor da TF Tintas, peça o código; se não, basta confirmar)");
  if (!clientCtx.interestProducts) missing.push("INTERESSE/PRODUTO (ex.: tinta para parede, ferramentas, material elétrico, hidráulica, acabamentos)");

  const systemPrompt = `Você é o Assistente Virtual da *TF Tintas*, uma loja de materiais de construção, tintas, ferragens, acabamentos e itens para obra e reforma.
O nome do cliente é ${clientName}. Seja educado, cordial e MUITO breve (1 a 2 frases curtas).

REGRAS ABSOLUTAS:
- NUNCA diga que não vendemos tintas ou materiais de construção — esse é exatamente o nosso ramo.
- NUNCA mencione intercâmbio, educação, viagens, idiomas ou qualquer outro segmento.
- NUNCA envie uma resposta genérica do tipo "Como posso ajudar?" sem fazer a pergunta de triagem pendente.
- Faça SEMPRE UMA pergunta por vez, na ordem listada em "INFORMAÇÕES PENDENTES".

INFORMAÇÕES JÁ CONHECIDAS DO CLIENTE:
${knownLines ? `- ${knownLines}` : "- (nenhuma)"}

INFORMAÇÕES PENDENTES (faça uma de cada vez, na ordem):
${missing.length ? missing.map((m, i) => `${i + 1}. ${m}`).join("\n") : "(nenhuma — pode atender normalmente o pedido do cliente)"}

COMO RESPONDER AGORA:
${missing.length
    ? `Cumprimente brevemente pelo nome (apenas se o cliente acabou de mandar saudação) e faça SOMENTE a próxima pergunta pendente da lista acima. Não pule etapas. Não pergunte tudo de uma vez.`
    : `Responda diretamente à pergunta/necessidade do cliente. Se for pedido de preço, estoque ou orçamento, diga que vai encaminhar para um consultor humano.`}
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
        messages: [
          { role: "system", content: systemPrompt },
          ...history
        ],
        temperature: 0.2,
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
 
        // Z-API webhook structure: 
        // Received message: { type: "ReceivedMessage", phone: "...", text: { message: "..." }, ... }
        // See: https://developer.z-api.io/en/webhooks/received-message
        const event = body.type || body.event || body.EventType;
        const data = body;
       
       console.log("Detected Event:", event);
       console.log("Event Data:", JSON.stringify(data));

        // Multi-instance routing: identify which connected number received the message.
        // Z-API provides `connectedPhone`; uazapi typically provides `instance` / `instanceId` / `owner`.
        const rawConnectedPhone = (
          data.connectedPhone || data.connected_phone || data.owner || data.toPhone || data.to || ""
        ).toString();
        const connectedPhoneClean = rawConnectedPhone
          .replace("@s.whatsapp.net", "")
          .replace("@c.us", "")
          .replace(/[^0-9]/g, "");
        const instanceHint = (data.instance || data.instanceId || data.instance_id || "").toString();

        let receivedInstance: any = null;
        if (connectedPhoneClean) {
          const { data: inst } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_type, store_id, seller_id, phone_number")
            .eq("phone_number", connectedPhoneClean)
            .maybeSingle();
          receivedInstance = inst || null;
        }
        if (!receivedInstance && instanceHint) {
          const { data: inst } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_type, store_id, seller_id, phone_number")
            .or(`phone_number.eq.${instanceHint},id.eq.${instanceHint}`)
            .maybeSingle();
          receivedInstance = inst || null;
        }
        const receivedInstanceId = receivedInstance?.id || null;
        console.log("Resolved instance:", JSON.stringify({ connectedPhoneClean, instanceHint, receivedInstanceId, type: receivedInstance?.instance_type }));

        // Z-API uses "ReceivedMessage" for incoming messages
        const isMessageEvent = event === "ReceivedMessage" || event === "ReceivedCallback" || event === "messages" || event === "message" || event === "chats";

       if (isMessageEvent) {
          // Z-API uses 'phone' directly for incoming messages
           const rawPhone = data.phone || data.wa_chatid || data.sender || data.chatid || data.from || "";
         const cleanPhone = rawPhone.toString()
           .replace("@s.whatsapp.net", "")
           .replace("@c.us", "")
           .replace("@g.us", "")
           .replace(/[^0-9]/g, "");

          // Z-API text is usually in text.message
           const text = data.text?.message || data.wa_lastMessageTextVote || data.text || data.body || data.message?.conversation || "[mensagem sem texto]";
          const messageId = data.messageId || data.messageid || data.id || crypto.randomUUID();
          const isFromMe = data.fromMe || false;
           const isGroup = data.isGroup || rawPhone.includes("-") || false;

          // Z-API uses ISO strings or timestamps
           const rawTs = data.waitingMessage || data.momment || Date.now();
          const tsMs = typeof rawTs === 'string' ? new Date(rawTs).getTime() : (rawTs > 1e12 ? rawTs : rawTs * 1000);
           const senderName = data.senderName || data.name || data.pushName || `Cliente ${cleanPhone}`;
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
          raw_data: body,
          received_on_instance_id: receivedInstanceId,
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
                  `Perfeito! Recebemos seu contato. Em instantes um de nossos consultores entrará em contato com você. ✅`,
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

          // Create in-app notification for new inbound WhatsApp message
          try {
            const notifStoreId = client?.store_id || null;
            const assignedSellerId = client?.assigned_seller_id || null;
            const preview = (text || "").toString().slice(0, 80);
            await supabase.from("notifications").insert({
              type: "whatsapp_new_message",
              title: "Nova mensagem WhatsApp",
              message: `${senderName}: ${preview}`,
              store_id: notifStoreId,
              role_target: assignedSellerId ? "vendedor" : "gerente",
              metadata: {
                seller_id: assignedSellerId,
                phone: cleanPhone,
                client_name: client?.name || senderName,
              },
              is_read: false,
            });
          } catch (notifErr) {
            console.error("Error creating whatsapp notification:", notifErr);
          }

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
              // 1. First message from a new client: Try to identify them via ERP Citel first
              const erpClient = await searchCitelClient(cleanPhone, supabase);

              const clientData = {
                name: erpClient?.nome || erpClient?.razao_social || senderName,
                phone: cleanPhone,
                email: erpClient?.email || null,
                address: erpClient?.endereco || erpClient?.logradouro || null,
                city: erpClient?.cidade || null,
                total_purchases: erpClient?.total_compras || erpClient?.valor_total || 0,
                status: 'novo',
                triaging: true,
                triage_step: 'ask_code',
                last_message_at: new Date().toISOString(),
                last_message_from_client_at: new Date().toISOString(),
                notes: erpClient ? `Cliente identificado via ERP Citel. ID: ${erpClient.id || 'N/A'}` : null,
                tags: erpClient ? ['erp_citel'] : []
              };

              const { error: createError } = await supabase.from("clients").upsert(clientData, { onConflict: 'phone' }).select("id").single();
 
              if (!createError) {
                const greeting = erpClient 
                  ? `Olá, *${erpClient.nome || erpClient.razao_social}*! 👋`
                  : `Olá! 👋`;
                const welcomeMsg = `${greeting} Você está falando com a *TF Tintas*.\n\nVocê já possui o *código (ramal)* de um vendedor?\n\n👉 Se *sim*, digite o código agora (ex: 1023).\n👉 Se *não*, responda com *N* para continuar.`;
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

               const distributeLead = async (storeId: string | null, reason: string = 'queue_to_seller') => {
                // Call the new RPC for round-robin distribution
                const { data: nextSeller, error: rpcError } = await supabase.rpc("get_next_seller_for_distribution", {
                  _store_id: storeId
                });

                if (!rpcError && nextSeller && nextSeller.length > 0) {
                  const picked = nextSeller[0];
                  await assignToSeller(picked.id, picked.name, picked.store_id);
                  
                  // Log queue assignment to redirection_history
                  await supabase.from("redirection_history").insert({
                    client_id: client.id,
                    to_seller_id: picked.id,
                    redirection_type: 'queue_to_seller',
                    reason: storeId ? 'Distribuído da fila da loja' : 'Distribuído da fila geral',
                    store_id: storeId
                  });

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
                     ? `Perfeito! Recebemos sua escolha pela unidade *${storeName}*. Em instantes um de nossos consultores entrará em contato com você. ✅`
                     : `Entendido! Em instantes um de nossos consultores entrará em contato com você. ✅`;
                  await sendWhatsAppMessage(cleanPhone, msg, isTest);
                }
              };

              const assignToSeller = async (sellerId: string, sellerName: string, storeId: string | null) => {
                const { data: result, error: rpcErr } = await supabase.rpc("assign_client_with_redirection", {
                  _phone: cleanPhone,
                  _seller_id: sellerId
                });

              if (!rpcErr && result?.success) {
                  await sendWhatsAppMessage(cleanPhone, `Perfeito! Recebemos seu contato. Em instantes um de nossos consultores entrará em contato com você. ✅`, isTest);
                } else {
                  // Fallback: if seller is inactive and has no substitute, distribute to store/general queue
                  await finishWithStore(storeId);
                }
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
                  // Move to ask_store: pergunta a CIDADE/REGIÃO em texto livre
                  await updateClient({ triage_step: 'ask_store' });
                  await sendWhatsAppMessage(
                    cleanPhone,
                    `Sem problemas! Para direcionarmos seu atendimento, em qual *cidade ou região* você está? 📍\n\nDigite o nome da sua cidade (ex: *São Paulo*) ou responda *N* para atendimento geral.`,
                    isTest
                  );
               } else {
                 await sendWhatsAppMessage(cleanPhone, `Por favor, digite seu *código de vendedor* (ex: 1023) ou responda *N* se não tiver.`, isTest);
               }
              } else if (step === 'ask_store') {
                const { data: stores } = await supabase.from("stores").select("id, name, city").order("name");
                const numMatch = trimmed.match(/^\d+$/);
                const selectedIndex = numMatch ? parseInt(trimmed, 10) : -1;
                const generalOptionIndex = (stores || []).length + 1;

                if (lower === 'n' || lower === 'nao' || lower === 'não' || selectedIndex === generalOptionIndex) {
                 await finishWithStore(null);
               } else {
                  let chosen = null as null | { id: string; name: string; city?: string | null };
                  if (selectedIndex > 0 && stores && selectedIndex <= stores.length) {
                    chosen = stores[selectedIndex - 1];
                  }
                   if (!chosen && stores) {
                     // Match por cidade ou nome da loja (substring nos dois sentidos)
                     chosen = stores.find(s => {
                       const cityLower = (s.city || '').toLowerCase().trim();
                       const nameLower = s.name.toLowerCase().trim();
                       if (cityLower && (lower.includes(cityLower) || cityLower.includes(lower))) return true;
                       if (nameLower && (lower.includes(nameLower) || nameLower.includes(lower))) return true;
                       return false;
                     }) || null;
                   }
                  
                  if (chosen) {
                     // Distribuição ALEATÓRIA por cidade: pega qualquer vendedor das lojas dessa cidade
                     const cityKey = (chosen.city || trimmed || '').trim();
                     await updateClient({ city: trimmed });
                     let assigned = false;
                     if (cityKey) {
                       const { data: randomSeller } = await supabase.rpc("get_random_seller_by_city", { _city: cityKey });
                       if (randomSeller && randomSeller.length > 0) {
                         const picked = randomSeller[0];
                         await assignToSeller(picked.id, picked.name, picked.store_id);
                         await supabase.from("redirection_history").insert({
                           client_id: client.id,
                           to_seller_id: picked.id,
                           redirection_type: 'city_random',
                           reason: `Distribuição aleatória por cidade: ${cityKey}`,
                           store_id: picked.store_id
                         });
                         await supabase.rpc("mark_seller_assigned", { _seller_id: picked.id });
                         assigned = true;
                       }
                     }
                     if (!assigned) {
                       // Fallback: distribuição padrão por loja escolhida
                       await updateClient({ store_id: chosen.id });
                       await finishWithStore(chosen.id, chosen.name);
                     }
                  } else {
                     // Fallback: cidade não bate com nenhuma loja — mostra menu numerado
                     console.log(`Fallback: client ${cleanPhone} sent city "${text}" with no store match. Showing numbered menu.`);
                     const storeList = (stores || []).map((s, i) => `${i + 1} - ${s.name}${s.city ? ` (${s.city})` : ''}`).join("\n");
                     const fullList = `${storeList}\n${generalOptionIndex} - Outra cidade / Atendimento geral`;
                     // Salva a cidade informada para contexto do vendedor
                     await updateClient({ city: trimmed });
                     await sendWhatsAppMessage(
                       cleanPhone,
                       `Não localizei uma loja na cidade *${trimmed}*. 🧐\n\nEscolha a unidade mais próxima digitando apenas o *número*:\n\n${fullList}`,
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

            // Rule 1: Conversation must always have a current responsible.
            // Rule 6: If returning and unassigned, try to distribute or restart triage.
            if (!client.assigned_seller_id) {
              // ALWAYS restart triage (URA) for unassigned clients so they go through:
              // 1) seller code  →  2) store preference (with options)  →  3) queue
              console.log(`Returning client ${cleanPhone} has no assigned seller. Restarting triage URA.`);
              updateData.triaging = true;
              updateData.triage_step = 'ask_code';
              updateData.store_id = client.store_id || targetStoreId;

              const greetingName = client.name && !client.name.startsWith('Cliente ') ? `, *${client.name}*` : '';
              const msg = `Olá${greetingName}! 👋 Você está falando com a *TF Tintas*.\n\nAntes de continuar, preciso te direcionar para o atendimento certo.\n\nVocê já possui o *código (ramal)* de um vendedor?\n\n👉 Se *sim*, digite o código agora (ex: 1023).\n👉 Se *não*, responda com *N* para continuar.`;
              await sendWhatsAppMessage(cleanPhone, msg, isTest);

              await supabase.from("clients").update(updateData).eq("id", client.id);
              return new Response(JSON.stringify({ success: true, action: "triage_restarted" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
             } else {
               // Check if the assigned seller's status has changed and if redirection is needed
               const { data: seller } = await supabase
                 .from("sellers")
                 .select("status, substitute_id, is_active, is_available")
                 .eq("id", client.assigned_seller_id)
                 .maybeSingle();

               const isInactive = seller && (
                 seller.status !== 'active' || 
                 seller.is_active === false || 
                 seller.is_available === false
               );

               if (seller && isInactive && seller.substitute_id) {
                 console.log(`Seller ${client.assigned_seller_id} is inactive (status: ${seller.status}, active: ${seller.is_active}, available: ${seller.is_available}). Redirecting to substitute ${seller.substitute_id}`);
                 const originalSellerId = client.assigned_seller_id;
                 
                 const { data: redirectResult } = await supabase.rpc("assign_client_with_redirection", {
                   _phone: cleanPhone,
                   _seller_id: originalSellerId
                 });

                 if (redirectResult?.success) {
                    console.log(`Redirection successful to ${redirectResult.seller_id}`);
                 }
               } else if (seller && isInactive && !seller.substitute_id) {
                 console.log(`Seller ${client.assigned_seller_id} is inactive with NO substitute. Re-distributing lead.`);
                 await distributeLead(client.store_id);
               }
             }

            await supabase
              .from("clients")
              .update(updateData)
              .eq("id", client.id);

            // Auto-reply with AI ONLY for clients without an assigned seller.
            // Once a vendor is assigned, the vendor handles the conversation — IA stays out.
            if (client.assigned_seller_id) {
              console.log(`Skipping AI auto-reply: client ${cleanPhone} is already assigned to seller ${client.assigned_seller_id}.`);
            } else try {
              // Fetch recent messages for context
              const { data: recentMsgs } = await supabase
                .from("whatsapp_messages")
                .select("body, is_from_me")
                .eq("phone", cleanPhone)
                .order("timestamp", { ascending: false })
                .limit(10);

              // Fetch context: store name, assigned seller name, and known interest
              let storeName: string | null = null;
              let sellerName: string | null = null;
              if (client.store_id) {
                const { data: s } = await supabase.from("stores").select("name").eq("id", client.store_id).maybeSingle();
                storeName = s?.name || null;
              }
              if (client.assigned_seller_id) {
                const { data: sel } = await supabase.from("sellers").select("name").eq("id", client.assigned_seller_id).maybeSingle();
                sellerName = sel?.name || null;
              }
              const interestProducts = (client as any).interest_products || (client as any).interest || null;

              const aiReply = await generateAutoReply(
                text,
                (recentMsgs || []).reverse(),
                client.name || senderName,
                { storeName, sellerName, interestProducts }
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
