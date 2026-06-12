import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

 // WhatsApp API config (Z-API)
 // WHATSAPP_API_URL should be set in environment variables: https://api.z-api.io/instances/ID/token/TOKEN
 const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Saudação conforme a hora (fuso de São Paulo/RJ) do momento da mensagem.
function saudacaoPorHora(tsMs: number): string {
  let hora: number;
  try {
    hora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date(tsMs)));
  } catch {
    hora = new Date(tsMs).getUTCHours() - 3; // fallback UTC-3
    if (hora < 0) hora += 24;
  }
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

// Evita que uma dependência externa lenta (OpenAI, ERP, API do WhatsApp)
// trave o webhook até o timeout da plataforma (~150s). Aborta após `ms`.
async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Executa uma promise com teto de tempo; se estourar, retorna `fallback`.
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms) as unknown as number;
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Chamada à OpenAI com fallback de modelo: tenta o primeiro e, se falhar
// (sem acesso ao modelo, erro de API, etc.), cai para o próximo. Loga o erro
// real para facilitar o diagnóstico nos logs da função.
const OPENAI_MODELS = ["gpt-4o-mini", "gpt-3.5-turbo"];

async function openaiChat(
  messages: any[],
  opts: { temperature?: number; max_tokens?: number; json?: boolean } = {}
): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY não configurada");
    return null;
  }
  for (const model of OPENAI_MODELS) {
    try {
      const payload: any = { model, messages, temperature: opts.temperature ?? 0.5 };
      if (opts.max_tokens) payload.max_tokens = opts.max_tokens;
      if (opts.json) payload.response_format = { type: "json_object" };

      const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify(payload),
      }, 12000);

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content;
      console.error(`OpenAI sem conteúdo (modelo ${model}):`, JSON.stringify(data?.error || data));
    } catch (e) {
      console.error(`Erro na OpenAI (modelo ${model}):`, e);
    }
  }
  return null;
}

function getApiConfig(inst?: { provider?: string; api_url?: string | null; api_token?: string | null } | null) {
  const provider = inst?.provider || "uazapi";
  const rawUrl = (inst?.api_url || Deno.env.get("WHATSAPP_API_URL"))?.trim();
  const token = (inst?.api_token || Deno.env.get("WHATSAPP_API_KEY"))?.trim();

  if (!rawUrl) return null;

  let baseUrl = rawUrl.replace(/\/+$/, "");

  // uazapiGO (ex.: ipazua.uazapi.com): POST {base}/send/text com header `token`.
  // Detecta pelo domínio para não depender do campo provider estar preenchido.
  if (provider === "uazapi_go" || /uazapi\./i.test(baseUrl)) {
    baseUrl = baseUrl
      .replace(/\/send\/(text|media|image|video|audio|file|document)$/i, "")
      .replace(/\/send-(text|image|video|audio|file|document)$/i, "");
    return { baseUrl, token, provider: "uazapi_go" };
  }

  if (provider === "whatsapi") {
    return { baseUrl, token, provider: "whatsapi" };
  }

  // Z-API (uazapi) legacy logic
  baseUrl = baseUrl.replace(/\/send-(text|image|video|audio|file|document)$/i, "");
  if (!baseUrl.includes("/token/") && token) {
    if (/\/token$/i.test(baseUrl)) {
      baseUrl = `${baseUrl}/${token}`;
    } else if (/\/instances\/[^/]+$/i.test(baseUrl)) {
      baseUrl = `${baseUrl}/token/${token}`;
    }
  }
  return { baseUrl, token, provider: "uazapi" };
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

 // Function to send message
 async function sendWhatsAppMessage(phone: string, text: string, isTest: boolean = false, inst: any) {
    const config = getApiConfig(inst);
    if (!config?.baseUrl) {
      console.error("API not configured");
      return { error: "API not configured" };
    }

    if (isTest) {
      console.log(`[TEST MODE] Would send WhatsApp message to ${phone}: ${text}`);
      return { success: true, message: "Test mode: message not sent to real API" };
    }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let endpoint = "";
      let body = {};

      if (config.provider === "uazapi_go") {
        // uazapiGO: header `token` + endpoint /send/text + body {number, text}
        headers["token"] = config.token || "";
        endpoint = `${config.baseUrl}/send/text`;
        body = { number: phone, text: text };
      } else if (config.provider === "whatsapi") {
        headers["token"] = config.token || "";
        endpoint = `${config.baseUrl}/message/text`;
        body = {
          number: phone,
          text: text,
          options: { delay: 1200, presence: "composing" }
        };
      } else {
        const clientToken = config.token || Deno.env.get("ZAPI_CLIENT_TOKEN");
        if (clientToken && !config.baseUrl.includes(clientToken)) headers["Client-Token"] = clientToken;
        endpoint = `${config.baseUrl}/send-text`;
        body = { phone, message: text };
      }

      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      const responseText = await response.text();
      let responseData: any = {};
      try { responseData = responseText ? JSON.parse(responseText) : {}; } catch { responseData = { raw: responseText }; }

      console.log("Send-text response:", JSON.stringify(responseData));
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
      Você é um assistente de triagem da *Taeco Tintas*, uma loja de materiais de construção, tintas, ferragens e acabamentos.
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
     const content = await openaiChat([{ role: "user", content: prompt }], { temperature: 0, json: true });
     if (!content) return null;
     return JSON.parse(content);
   } catch (e) {
     console.error("Error parsing triage response:", e);
     return null;
   }
 }

// Function to generate AI auto-reply for existing clients
async function generateAutoReply(
  text: string,
  recentMessages: { body: string; is_from_me: boolean }[],
  clientName: string,
  clientCtx: { storeName?: string | null; sellerName?: string | null; interestProducts?: string | null } = {},
  saudacao: string = "Olá"
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
  if (!clientCtx.storeName) missing.push("PREFERÊNCIA DE LOJA/UNIDADE (qual loja/unidade da Taeco Tintas o cliente prefere)");
  if (!clientCtx.sellerName) missing.push("CÓDIGO (RAMAL) DE VENDEDOR (se já tem um vendedor da Taeco Tintas, peça o código; se não, basta confirmar)");
  if (!clientCtx.interestProducts) missing.push("INTERESSE/PRODUTO (ex.: tinta para parede, ferramentas, material elétrico, hidráulica, acabamentos)");

  const systemPrompt = `Você atende os clientes da *Taeco Tintas* (tintas, materiais de construção, ferragens e acabamentos) pelo WhatsApp. Escreva como uma pessoa de verdade conversando no zap: simpático, natural e direto.

SEU PAPEL: você é o primeiro contato (SDR). Não resolve o pedido nem passa preço — sua função é entender rapidinho o que o cliente precisa, coletar as informações pendentes e encaminhar pra um consultor.

JEITO DE FALAR:
- MUITO curto: 1 frase, no máximo 2 bem curtas. Nada de textão.
- Conversacional: se for cumprimentar, use "${saudacao}" (condiz com o horário do cliente). Só cumprimente se ainda não cumprimentou nesta conversa.
- Tom humano e leve, linguagem simples do dia a dia. Pode usar o nome do cliente de vez em quando (não toda hora).
- Soe como gente, não como robô: evite "Como posso ajudá-lo?", "Prezado cliente", respostas decoradas e formalidade exagerada.
- Sem listas, sem bullet, sem repetir saudação se já cumprimentou.
- Faça UMA pergunta por vez e trate UM assunto por mensagem. NUNCA despeje várias perguntas ou tudo de uma vez — é uma conversa, vai com calma.
- Conduza sempre de volta ao objetivo: descobrir o que o cliente quer e encaminhar.

NUNCA:
- Diga que não vendemos tintas/material de construção — é exatamente o nosso ramo.
- Cite outros segmentos (intercâmbio, viagens, idiomas, etc.).
- Enrole ou prolongue a conversa à toa.

INFORMAÇÕES JÁ CONHECIDAS DO CLIENTE:
${knownLines ? `- ${knownLines}` : "- (nenhuma)"}

INFORMAÇÕES PENDENTES (colete uma de cada vez, nesta ordem):
${missing.length ? missing.map((m, i) => `${i + 1}. ${m}`).join("\n") : "(nenhuma — já dá pra encaminhar pro consultor)"}

O QUE FAZER AGORA:
${missing.length
    ? `Responda de forma natural ao que o cliente disse e, no mesmo fôlego, faça SÓ a próxima pergunta pendente da lista. Ex.: "Boa! Você prefere atendimento de qual loja?" — curto e humano.`
    : `Confirme rapidinho que vai chamar um consultor pra continuar. Ex.: "Show, já te conecto com um consultor pra finalizar 👍". Se pedir preço/estoque/orçamento, diga que um consultor humano resolve em seguida.`}
`;

  return await openaiChat(
    [{ role: "system", content: systemPrompt }, ...history],
    { temperature: 0.7, max_tokens: 120 }
  );
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

        // Brazilian numbers can vary by country code (55) and the 9th mobile digit,
        // so an exact phone_number match is unreliable. We compare by the last 8 digits.
        const phoneSuffix = (p: string) => (p || "").replace(/\D/g, "").slice(-8);

        let receivedInstance: any = null;
        if (connectedPhoneClean) {
          const { data: inst } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_type, store_id, seller_id, phone_number, api_url, api_token, provider")
            .eq("phone_number", connectedPhoneClean)
            .maybeSingle();
          receivedInstance = inst || null;
        }
        // Fallback: suffix-based match across all instances (handles 55/DDI + 9th-digit differences)
        if (!receivedInstance && connectedPhoneClean) {
          const { data: allInst } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_type, store_id, seller_id, phone_number, api_url, api_token, provider");
          const wantedSuffix = phoneSuffix(connectedPhoneClean);
          if (wantedSuffix && allInst) {
            receivedInstance =
              allInst.find((i: any) => phoneSuffix(i.phone_number) === wantedSuffix) || null;
          }
        }
        if (!receivedInstance && instanceHint) {
          const { data: inst } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_type, store_id, seller_id, phone_number, api_url, api_token, provider")
            .or(`phone_number.eq.${instanceHint},id.eq.${instanceHint}`)
            .maybeSingle();
          receivedInstance = inst || null;
        }
        const receivedInstanceId = receivedInstance?.id || null;
        console.log("Resolved instance:", JSON.stringify({ connectedPhoneClean, instanceHint, receivedInstanceId, type: receivedInstance?.instance_type }));

        // Z-API uses "ReceivedMessage" for incoming messages
        const isMessageEvent = event === "ReceivedMessage" || event === "ReceivedCallback" || event === "messages.upsert" || event === "messages" || event === "message" || event === "chats";

       if (isMessageEvent) {
          // uazapi aninha os dados em `message`; Z-API usa o nível de cima.
          const msg = data.message || data.data || {};

          const rawPhone = data.phone || msg.chatid || msg.sender || data.wa_chatid
            || data.sender || data.chatid || data.from || data.chat?.id
            || data.data?.key?.remoteJid || msg.key?.remoteJid || "";
         const cleanPhone = rawPhone.toString()
           .replace("@s.whatsapp.net", "")
           .replace("@c.us", "")
           .replace("@g.us", "")
           .replace(/[^0-9]/g, "");

          // Texto: uazapi usa message.text/content; Z-API usa text.message
          const rawText = data.text?.message || msg.text || msg.content || msg.caption
            || msg.body || msg.conversation || data.wa_lastMessageTextVote || data.text
            || data.body || data.message?.conversation || "";
          const text = (typeof rawText === "string" ? rawText : (rawText?.message || rawText?.text || "")) || "[mensagem sem texto]";

          const messageId = data.messageId || data.messageid || msg.messageid || msg.id || data.id
            || data.key?.id || msg.key?.id || data.data?.key?.id
            || (cleanPhone && (msg.messageTimestamp || data.momment) ? `${cleanPhone}-${msg.messageTimestamp || data.momment}` : null)
            || crypto.randomUUID();
          const isFromMe = data.fromMe || msg.fromMe || false;
           const isGroup = data.isGroup || msg.isGroup || msg.isgroup
             || (rawPhone || "").toString().includes("@g.us") || (rawPhone || "").toString().includes("-") || false;

          // Timestamp: uazapi usa messageTimestamp (segundos); Z-API ISO/ms
           const rawTs = msg.messageTimestamp || data.waitingMessage || data.momment || Date.now();
          const tsMs = typeof rawTs === 'string' ? new Date(rawTs).getTime() : (rawTs > 1e12 ? rawTs : rawTs * 1000);
           const senderName = msg.senderName || data.senderName || data.name || msg.pushName || data.pushName || `Cliente ${cleanPhone}`;
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
          // ── MULTI-INSTANCE: If message arrived on a seller's direct number,
          // skip triage entirely and route straight to that seller.
          if (receivedInstance?.instance_type === 'seller' && receivedInstance?.seller_id) {
            const directSellerId = receivedInstance.seller_id;
            const directStoreId = receivedInstance.store_id || null;

            // Use assign_client_with_redirection to honor substitute logic when seller is inactive
            const { data: assignResult } = await supabase.rpc("assign_client_with_redirection", {
              _phone: cleanPhone,
              _seller_id: directSellerId,
            });

            // Always tag the client with the instance the message came from (for reply routing + thread separation)
            await supabase.from("clients")
              .update({
                received_on_instance_id: receivedInstanceId,
                last_message_at: new Date().toISOString(),
                last_message_from_client_at: new Date().toISOString(),
                triaging: false,
                triage_step: null,
              })
              .eq("phone", cleanPhone);

            console.log(`Direct seller routing → seller ${directSellerId} via instance ${receivedInstanceId}. Result:`, JSON.stringify(assignResult));

            return new Response(JSON.stringify({
              success: true,
              action: "routed_direct_seller_number",
              instance_id: receivedInstanceId,
              seller_id: directSellerId,
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Track which instance brought the client in (for store-type instances and reply routing)
          if (receivedInstanceId) {
            await supabase.from("clients")
              .update({ received_on_instance_id: receivedInstanceId })
              .eq("phone", cleanPhone);
          }

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
                  `Perfeito! Já passo você pra um dos nossos consultores, em breve te chamam por aqui 👍`,
                  isTest,
                  receivedInstance
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

          // For store-type instances, default the client to that store so it shows
          // up in the store's "Geral" list and triage is scoped to the store.
          const instanceStoreId =
            receivedInstance?.instance_type === "store" ? receivedInstance.store_id || null : null;
          let targetStoreId = client?.store_id || instanceStoreId || null;
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
              const erpClient = await withTimeout(searchCitelClient(cleanPhone, supabase), 8000, null);

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
                store_id: targetStoreId,
                received_on_instance_id: receivedInstanceId,
                notes: erpClient ? `Cliente identificado via ERP Citel. ID: ${erpClient.id || 'N/A'}` : null,
                tags: erpClient ? ['erp_citel'] : []
              };

              const { error: createError } = await supabase.from("clients").upsert(clientData, { onConflict: 'phone' }).select("id").single();
 
              if (!createError) {
                const saud = saudacaoPorHora(tsMs);
                const nome = erpClient ? (erpClient.nome || erpClient.razao_social) : null;
                const abertura = nome ? `${saud}, *${nome}*! 😊` : `${saud}! 😊`;
                // Conversa em duas mensagens, como uma pessoa de verdade.
                await sendWhatsAppMessage(cleanPhone, `${abertura} Aqui é da *Taeco Tintas*, tudo bem? 🎨`, isTest, receivedInstance);
                await sendWhatsAppMessage(cleanPhone, `Pra eu te encaminhar pro atendimento certo: você já é atendido por algum vendedor nosso? Se sim, me passa o *código* dele (ex: 1023). Se ainda não, é só me dizer que eu já te direciono 😊`, isTest, receivedInstance);
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
                     ? `Show, anotei a unidade *${storeName}* 👍 Já te conecto com um consultor de lá.`
                     : `Fechou! Já te passo pra um consultor finalizar 👍`;
                  await sendWhatsAppMessage(cleanPhone, msg, isTest, receivedInstance);
                }
              };

              const assignToSeller = async (sellerId: string, sellerName: string, storeId: string | null) => {
                const { data: result, error: rpcErr } = await supabase.rpc("assign_client_with_redirection", {
                  _phone: cleanPhone,
                  _seller_id: sellerId
                });

              if (!rpcErr && result?.success) {
                  await sendWhatsAppMessage(cleanPhone, `Perfeito! Já passo você pra um dos nossos consultores, em breve te chamam por aqui 👍`, isTest, receivedInstance);
                } else {
                  // Fallback: if seller is inactive and has no substitute, distribute to store/general queue
                  await finishWithStore(storeId);
                }
              };

             if (step === 'ask_code') {
               // Extrai um código (3-10 dígitos) mesmo que venha dentro de uma frase
               // (ex.: "meu código é 1023"). Sem dígitos = cliente não tem código.
               const codeInText = trimmed.match(/\d{3,10}/);
               if (codeInText) {
                 const code = codeInText[0];
                 const { data: sellerByCode } = await supabase
                   .from("sellers").select("id, name, store_id")
                   .eq("code", code).maybeSingle();
                 if (sellerByCode) {
                   await assignToSeller(sellerByCode.id, sellerByCode.name, sellerByCode.store_id);
                 } else {
                   await sendWhatsAppMessage(cleanPhone, `Hmm, não achei esse código aqui 🤔 Dá uma conferida e manda de novo, ou se preferir é só me dizer que eu já te direciono 😊`, isTest, receivedInstance);
                 }
                } else {
                   // Qualquer resposta sem código = não tem vendedor. Segue o fluxo
                   // naturalmente, sem ficar exigindo um "N".
                   await updateClient({ triage_step: 'ask_store' });
                   const storeOptions = `Sem problema! 😊 Pra te mandar pra loja mais perto, qual região fica melhor pra você?\n\n1 — Niterói\n2 — Rio de Janeiro (Barra da Tijuca)\n3 — Macaé\n\nÉ só me dizer o *número* ou o nome da região 👍`;
                   await sendWhatsAppMessage(cleanPhone, storeOptions, isTest, receivedInstance);
                }
                } else if (step === 'ask_store') {
                  const { data: stores } = await supabase.from("stores").select("id, name, city").order("name");

                  // Aceita número (1/2/3) ou o nome da região (sem depender de acento)
                  const norm = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  let choice = trimmed;
                  if (/niter/.test(norm)) choice = '1';
                  else if (/barra|tijuca|rio/.test(norm)) choice = '2';
                  else if (/maca/.test(norm)) choice = '3';

                  // Mapeamento manual conforme solicitado
                  // 1 — Niterói -> 25b7fb23-89c6-4abc-af6a-75c8c41e0dc2
                  // 2 — Rio de Janeiro (Barra da Tijuca) -> b7369414-9afe-4870-974e-45aa58173b8c
                  // 3 — Macaé -> Múltiplas lojas (Matriz, Aeroporto, Riviera)

                  if (choice === '1') {
                    const chosenStoreId = '25b7fb23-89c6-4abc-af6a-75c8c41e0dc2';
                    const chosenStoreName = 'Niterói';
                    await updateClient({ store_id: chosenStoreId, triaging: false, triage_step: null });
                    await finishWithStore(chosenStoreId, chosenStoreName);
                  } else if (choice === '2') {
                    const chosenStoreId = 'b7369414-9afe-4870-974e-45aa58173b8c';
                    const chosenStoreName = 'Barra da Tijuca';
                    await updateClient({ store_id: chosenStoreId, triaging: false, triage_step: null });
                    await finishWithStore(chosenStoreId, chosenStoreName);
                  } else if (choice === '3') {
                    // Macaé region routing with multiple stores priority: Matriz -> Aeroporto -> Riviera
                    const macaeStores = [
                      { id: 'a6b2da10-3e07-421f-b05c-cdc696bfe46a', name: 'Matriz' },
                      { id: '80eb248f-02b0-4bc7-a545-63ae48b78d29', name: 'Aeroporto' },
                      { id: '16ad0928-0372-40ea-9a9a-774416551dc7', name: 'Riviera' }
                    ];

                    let distributed = false;
                    for (const store of macaeStores) {
                      console.log(`Attempting distribution for Macaé store: ${store.name} (${store.id})`);
                      distributed = await distributeLead(store.id);
                      if (distributed) {
                        await updateClient({ store_id: store.id, triaging: false, triage_step: null });
                        console.log(`Successfully distributed to store: ${store.name}`);
                        break;
                      }
                    }

                    if (!distributed) {
                      // Fallback to Matriz if no one is available in any store.
                      // finishWithStore will create a lead for managers to see.
                      console.log("No available sellers in Macaé stores. Falling back to Matriz queue.");
                      await updateClient({ store_id: macaeStores[0].id, triaging: false, triage_step: null });
                      await finishWithStore(macaeStores[0].id, macaeStores[0].name);
                    }
                  } else if (lower === 'n' || lower === 'nao' || lower === 'não') {
                    await finishWithStore(null);
                  } else {
                    await sendWhatsAppMessage(
                      cleanPhone,
                      `Acho que não peguei 😅 Me diz a região que fica melhor pra você — pode ser o número ou o nome:\n\n1 — Niterói\n2 — Rio de Janeiro (Barra da Tijuca)\n3 — Macaé`,
                      isTest,
                      receivedInstance
                    );
                  }
                } else if (step === 'ask_seller') {
                const storeId = client.store_id;
                const codeInText = trimmed.match(/\d{3,10}/);
                if (codeInText) {
                   const { data: sellerByCode } = await supabase
                     .from("sellers").select("id, name, store_id")
                     .eq("code", codeInText[0]).maybeSingle();
                   if (sellerByCode) {
                     await assignToSeller(sellerByCode.id, sellerByCode.name, sellerByCode.store_id || storeId);
                   } else {
                     await sendWhatsAppMessage(cleanPhone, `Não encontrei esse código 🤔 Confere e manda de novo, ou se preferir é só me dizer que eu te passo pro próximo consultor disponível 😊`, isTest, receivedInstance);
                   }
                } else {
                  // Sem código = segue pro próximo consultor disponível
                  const distributed = await distributeLead(storeId);
                  if (!distributed) {
                    const { data: store } = await supabase.from("stores").select("name").eq("id", storeId).maybeSingle();
                    await finishWithStore(storeId, store?.name);
                  }
                }
             } else {
               // Unknown step — restart
               await updateClient({ triage_step: 'ask_code' });
               await sendWhatsAppMessage(cleanPhone, `Oi de novo! 😊 Você é atendido por algum vendedor nosso? Me manda o *código* dele, ou se não tiver é só me avisar que eu sigo te ajudando.`, isTest, receivedInstance);
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

              const saud2 = saudacaoPorHora(tsMs);
              const greetingName = client.name && !client.name.startsWith('Cliente ') ? `, *${client.name}*` : '';
              await sendWhatsAppMessage(cleanPhone, `${saud2}${greetingName}! 😊 Aqui é da *Taeco Tintas*, tudo bem? 🎨`, isTest, receivedInstance);
              await sendWhatsAppMessage(cleanPhone, `Pra te direcionar certinho: você é atendido por algum vendedor nosso? Me manda o *código* dele (ex: 1023). Se ainda não, é só me dizer que eu cuido disso 😊`, isTest, receivedInstance);

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
                { storeName, sellerName, interestProducts },
                saudacaoPorHora(tsMs)
              );

              if (aiReply) {
                // Debounce anti-duplicidade: se o webhook for reprocessado (reenvio
                // do provedor), já teremos respondido este número há instantes. Só
                // envia se NÃO houver resposta nossa nos últimos 60 segundos.
                const debounceSince = new Date(Date.now() - 60000).toISOString();
                const { count: recentOutbound } = await supabase
                  .from("whatsapp_messages")
                  .select("id", { count: "exact", head: true })
                  .eq("phone", cleanPhone)
                  .eq("is_from_me", true)
                  .gte("timestamp", debounceSince);

                if (recentOutbound && recentOutbound > 0) {
                  console.log(`Auto-resposta ignorada (debounce): já respondemos ${cleanPhone} nos últimos 60s.`);
                } else {
                  await sendWhatsAppMessage(cleanPhone, aiReply, isTest, receivedInstance);

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
