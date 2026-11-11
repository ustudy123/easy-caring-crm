// Edge Function: sales-document-extract
// Lê com IA o PDF de um orçamento ou nota fiscal já enviado (sales_documents) e
// preenche cliente, número, data de emissão, valor total e parcelas. Não apaga o
// que a pessoa já digitou; o resultado bruto fica em ai_extracted para conferência.
//  POST { documentId } com o token do usuário → { ok, fields?, error? }
// Secrets: OPENAI_API_KEY (já usada pelo WhatsApp). Opcional: OPENAI_DOCUMENT_MODEL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  ExtractionError, bytesToBase64, extractDocument, fillMissingFields, type DocumentKind,
} from "../_shared/documentExtraction.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_BUCKETS = new Set(["sales-documents", "pricing_attachments"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
  const models = [Deno.env.get("OPENAI_DOCUMENT_MODEL") || "gpt-4o", "gpt-4o-mini"].filter((m, i, a) => a.indexOf(m) === i);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    if (!documentId) return json({ error: "Informe o documento" }, 400);

    // Lido com o token de quem chama: a RLS garante que a pessoa pode mexer nele.
    const { data: doc, error: docErr } = await caller.from("sales_documents")
      .select("id, kind, storage_bucket, storage_path, file_name, document_number, client_name, client_document, total_value, issue_date, installments, extracted_seller_name")
      .eq("id", documentId)
      .maybeSingle();
    if (docErr) return json({ error: docErr.message }, 500);
    if (!doc) return json({ error: "Documento não encontrado" }, 404);
    if (!ALLOWED_BUCKETS.has(doc.storage_bucket)) return json({ error: "Arquivo fora do lugar esperado" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const fail = async (message: string) => {
      await admin.from("sales_documents").update({ ai_status: "failed", ai_error: message.slice(0, 500) }).eq("id", doc.id);
      return json({ ok: false, error: message });
    };

    if (!OPENAI_API_KEY) return fail("Leitura automática indisponível: falta OPENAI_API_KEY nos Secrets do Supabase. Preencha os campos à mão.");

    const { data: file, error: fileErr } = await admin.storage.from(doc.storage_bucket).download(doc.storage_path);
    if (fileErr || !file) return fail("Não foi possível abrir o PDF enviado.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES) return fail("O PDF passa de 10 MB. Preencha os campos à mão.");
    if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") return fail("O arquivo enviado não é um PDF.");

    let result;
    try {
      result = await extractDocument(fetch, {
        apiKey: OPENAI_API_KEY,
        models,
        kind: doc.kind as DocumentKind,
        base64: bytesToBase64(bytes),
        fileName: doc.file_name || "documento.pdf",
      });
    } catch (e) {
      console.error("sales-document-extract", doc.id, e);
      const detail = e instanceof ExtractionError ? e.message : "erro inesperado";
      return fail(`A leitura automática falhou (${detail}). Preencha os campos à mão.`);
    }

    const patch = fillMissingFields(doc, result.data);
    if (!doc.extracted_seller_name && result.data.seller_name) patch.extracted_seller_name = result.data.seller_name;
    const { error: saveErr } = await admin.from("sales_documents").update({
      ...patch,
      ai_status: "done",
      ai_extracted: result.data,
      ai_model: result.model,
      ai_error: null,
    }).eq("id", doc.id);
    if (saveErr) return json({ error: saveErr.message }, 500);

    // DE-PARA: sugere o vendedor (representante no PDF, CNPJ, histórico, carteira)
    // e marca possível duplicata. O gestor confirma na fila "A confirmar".
    const { data: match, error: matchErr } = await admin.rpc("suggest_sales_document_seller", { _doc_id: doc.id });
    if (matchErr) console.error("sales-document-extract: sugestão do vendedor", matchErr);

    return json({ ok: true, fields: result.data, model: result.model, sellerMatch: match ?? null });
  } catch (e) {
    console.error("sales-document-extract", e);
    return json({ error: (e as Error).message || "Erro inesperado" }, 500);
  }
});
