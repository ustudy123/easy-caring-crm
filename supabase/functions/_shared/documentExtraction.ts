// Leitura por IA do PDF de orçamento ou nota fiscal (Fase 7). Usa a mesma chave
// da OpenAI do projeto (OPENAI_API_KEY), que já aceita PDF na API de chat.
// Sem APIs do Deno, para os testes (vitest) importarem direto.

export type DocumentKind = "quote" | "invoice";

export interface Installment {
  number: number | null;
  value: number;
  due_date: string | null;
}

export interface ExtractedDocument {
  document_type: "quote" | "invoice" | "other";
  document_number: string | null;
  client_name: string | null;
  client_document: string | null;
  issue_date: string | null;
  total_value: number | null;
  installments: Installment[];
}

const KIND_LABEL: Record<DocumentKind, string> = { quote: "orçamento (proposta comercial)", invoice: "nota fiscal (DANFE)" };

export const EXTRACTION_PROMPT = [
  "Você lê documentos comerciais brasileiros da Taeco Tintas e devolve os dados em JSON.",
  "A Taeco Tintas é quem emite o documento: NUNCA a informe como cliente.",
  "O cliente é o destinatário da nota fiscal ou o cliente do orçamento.",
  "document_type: \"invoice\" para nota fiscal/DANFE, \"quote\" para orçamento ou proposta, \"other\" para qualquer outro documento.",
  "document_number: número da nota (sem a série) ou do orçamento, só o número.",
  "client_name: razão social ou nome do cliente. client_document: CNPJ ou CPF do cliente como aparece.",
  "issue_date: data de emissão no formato AAAA-MM-DD.",
  "total_value: na nota, o VALOR TOTAL DA NOTA; no orçamento, o total geral com impostos e frete. Número com ponto decimal, sem R$.",
  "installments: parcelas/duplicatas da fatura (número, valor e vencimento AAAA-MM-DD). Lista vazia se não houver.",
  "Use null para o que não estiver no documento. Não invente valores.",
].join("\n");

export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["document_type", "document_number", "client_name", "client_document", "issue_date", "total_value", "installments"],
  properties: {
    document_type: { type: "string", enum: ["quote", "invoice", "other"] },
    document_number: { type: ["string", "null"] },
    client_name: { type: ["string", "null"] },
    client_document: { type: ["string", "null"] },
    issue_date: { type: ["string", "null"], description: "AAAA-MM-DD" },
    total_value: { type: ["number", "null"] },
    installments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["number", "value", "due_date"],
        properties: {
          number: { type: ["integer", "null"] },
          value: { type: "number" },
          due_date: { type: ["string", "null"], description: "AAAA-MM-DD" },
        },
      },
    },
  },
} as const;

/** "12.500,50", "R$ 1.234", 1234.5 → número; null se não der para ler. */
export function toAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** "2026-11-05" ou "05/11/2026" → "2026-11-05"; null se não for uma data real. */
export function toIsoDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const clean = (v: unknown, max = 200): string | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

/** Valida e normaliza o JSON da IA; nunca confia no formato. */
export function normalizeExtraction(raw: unknown): ExtractedDocument {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const type = o.document_type === "quote" || o.document_type === "invoice" ? o.document_type : "other";
  const clientName = clean(o.client_name);
  const installments = (Array.isArray(o.installments) ? o.installments : [])
    .map((it) => {
      const r = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
      const value = toAmount(r.value);
      const number = typeof r.number === "number" && Number.isInteger(r.number) ? r.number : null;
      return value === null ? null : { number, value, due_date: toIsoDate(r.due_date) };
    })
    .filter((x): x is Installment => x !== null)
    .slice(0, 60);
  return {
    document_type: type,
    document_number: clean(o.document_number, 60),
    client_name: clientName && /taeco/i.test(clientName) ? null : clientName,
    client_document: clean(o.client_document, 30),
    issue_date: toIsoDate(o.issue_date),
    total_value: toAmount(o.total_value),
    installments,
  };
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class ExtractionError extends Error {}

export function buildExtractionBody(o: { model: string; kind: DocumentKind; base64: string; fileName: string; strict: boolean }) {
  return {
    model: o.model,
    temperature: 0,
    response_format: o.strict
      ? { type: "json_schema", json_schema: { name: "documento_comercial", strict: true, schema: EXTRACTION_SCHEMA } }
      : { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_PROMPT + (o.strict ? "" : `\nResponda só com um objeto JSON com as chaves: ${EXTRACTION_SCHEMA.required.join(", ")}.`) },
      {
        role: "user",
        content: [
          { type: "file", file: { filename: o.fileName || "documento.pdf", file_data: `data:application/pdf;base64,${o.base64}` } },
          { type: "text", text: `Documento enviado como ${KIND_LABEL[o.kind]}. Extraia os dados.` },
        ],
      },
    ],
  };
}

/**
 * Manda o PDF para a OpenAI e devolve os campos já validados. Tenta os modelos
 * em ordem; se a saída estruturada (json_schema) for recusada, tenta JSON simples.
 */
export async function extractDocument(
  fetchFn: FetchFn,
  o: { apiKey: string; models: string[]; kind: DocumentKind; base64: string; fileName: string },
): Promise<{ data: ExtractedDocument; model: string }> {
  let lastError = "sem resposta";
  for (const model of o.models) {
    for (const strict of [true, false]) {
      const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${o.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildExtractionBody({ model, kind: o.kind, base64: o.base64, fileName: o.fileName, strict })),
      });
      const payload = await res.json().catch(() => ({})) as {
        choices?: { message?: { content?: string; refusal?: string } }[];
        error?: { message?: string };
      };
      if (!res.ok) {
        lastError = payload.error?.message || `OpenAI respondeu ${res.status}`;
        if (res.status === 401 || res.status === 429) throw new ExtractionError(lastError);
        // 400 com json_schema: tenta de novo sem a saída estruturada; senão, próximo modelo.
        if (res.status === 400 && strict) continue;
        break;
      }
      const message = payload.choices?.[0]?.message;
      if (message?.refusal) {
        lastError = message.refusal;
        break;
      }
      try {
        return { data: normalizeExtraction(JSON.parse(message?.content ?? "")), model };
      } catch {
        lastError = "A IA não devolveu um JSON válido";
      }
    }
  }
  throw new ExtractionError(lastError);
}

/** PDF (bytes) → base64, em blocos para não estourar a pilha com arquivos grandes. */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Campos do documento que a leitura preenche, sem apagar o que a pessoa já digitou. */
export function fillMissingFields(
  current: { document_number: string | null; client_name: string | null; client_document: string | null; total_value: number | null; issue_date: string | null; installments: unknown },
  data: ExtractedDocument,
) {
  const patch: Record<string, unknown> = {};
  if (!current.document_number && data.document_number) patch.document_number = data.document_number;
  if (!current.client_name && data.client_name) patch.client_name = data.client_name;
  if (!current.client_document && data.client_document) patch.client_document = data.client_document;
  if (current.total_value === null && data.total_value !== null) patch.total_value = data.total_value;
  if (!current.issue_date && data.issue_date) patch.issue_date = data.issue_date;
  const hasInstallments = Array.isArray(current.installments) && current.installments.length > 0;
  if (!hasInstallments && data.installments.length) patch.installments = data.installments;
  return patch;
}
