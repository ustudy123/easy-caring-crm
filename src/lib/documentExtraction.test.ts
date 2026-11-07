import { describe, expect, it, vi } from "vitest";
import {
  buildExtractionBody, bytesToBase64, extractDocument, fillMissingFields, normalizeExtraction, toAmount, toIsoDate,
} from "../../supabase/functions/_shared/documentExtraction";

describe("valores e datas", () => {
  it("lê valores em reais nos formatos comuns", () => {
    expect(toAmount(12500.5)).toBe(12500.5);
    expect(toAmount("12.500,50")).toBe(12500.5);
    expect(toAmount("R$ 1.234")).toBe(1234);
    expect(toAmount("980.75")).toBe(980.75);
    expect(toAmount("-3")).toBeNull();
    expect(toAmount("abc")).toBeNull();
    expect(toAmount(null)).toBeNull();
  });

  it("aceita só datas reais", () => {
    expect(toIsoDate("2026-11-05")).toBe("2026-11-05");
    expect(toIsoDate("05/11/2026")).toBe("2026-11-05");
    expect(toIsoDate("2026-02-31")).toBeNull();
    expect(toIsoDate("31/02/2026")).toBeNull();
    expect(toIsoDate("1999-01-01")).toBeNull();
    expect(toIsoDate("ontem")).toBeNull();
  });
});

describe("normalizeExtraction", () => {
  it("limpa a saída da IA e nunca usa a Taeco como cliente", () => {
    expect(normalizeExtraction({
      document_type: "invoice", document_number: " 001.234 ", client_name: "Taeco Tintas Ltda", client_document: "12.345.678/0001-90",
      issue_date: "2026-11-04", total_value: "4.300,50",
      installments: [{ number: 1, value: 2150.25, due_date: "2026-12-04" }, { number: 2, value: "x" }, "lixo"],
    })).toEqual({
      document_type: "invoice", document_number: "001.234", client_name: null, client_document: "12.345.678/0001-90",
      issue_date: "2026-11-04", total_value: 4300.5, installments: [{ number: 1, value: 2150.25, due_date: "2026-12-04" }],
    });
    expect(normalizeExtraction("nada")).toEqual({
      document_type: "other", document_number: null, client_name: null, client_document: null, issue_date: null, total_value: null, installments: [],
    });
  });

  it("não sobrescreve o que a pessoa já preencheu", () => {
    const data = normalizeExtraction({ document_type: "quote", document_number: "77", client_name: "SERCON", total_value: 900, issue_date: "2026-11-03", installments: [] });
    expect(fillMissingFields(
      { document_number: null, client_name: "Cliente digitado", client_document: null, total_value: null, issue_date: null, installments: [] },
      data,
    )).toEqual({ document_number: "77", total_value: 900, issue_date: "2026-11-03" });
  });
});

describe("extractDocument", () => {
  const ok = (content: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
  const err = (status: number, message: string) => new Response(JSON.stringify({ error: { message } }), { status });
  const answer = { document_type: "quote", document_number: "123", client_name: "SERCON", client_document: null, issue_date: "2026-10-28", total_value: 1000000, installments: [] };
  const args = { apiKey: "sk-test", models: ["gpt-4o", "gpt-4o-mini"], kind: "quote" as const, base64: "JVBERi0=", fileName: "orc.pdf" };

  it("manda o PDF como arquivo e pede a saída estruturada", async () => {
    const fetchFn = vi.fn(async () => ok(answer));
    const r = await extractDocument(fetchFn, args);
    expect(r).toEqual({ data: { ...answer }, model: "gpt-4o" });
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.messages[1].content[0]).toEqual({ type: "file", file: { filename: "orc.pdf", file_data: "data:application/pdf;base64,JVBERi0=" } });
    expect(body.messages[1].content[1].text).toMatch(/orçamento/);
  });

  it("cai para JSON simples e depois para o outro modelo", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(err(400, "json_schema não suportado"))
      .mockResolvedValueOnce(err(500, "falhou"))
      .mockResolvedValueOnce(ok(answer));
    const r = await extractDocument(fetchFn, args);
    expect(r.model).toBe("gpt-4o-mini");
    const formats = fetchFn.mock.calls.map((c) => JSON.parse((c as [string, RequestInit])[1].body as string))
      .map((b) => `${b.model}:${b.response_format.type}`);
    expect(formats).toEqual(["gpt-4o:json_schema", "gpt-4o:json_object", "gpt-4o-mini:json_schema"]);
  });

  it("para na hora com chave inválida ou limite de uso", async () => {
    const fetchFn = vi.fn(async () => err(401, "Incorrect API key"));
    await expect(extractDocument(fetchFn, args)).rejects.toThrow("Incorrect API key");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("monta o pedido sem saída estruturada quando pedido", () => {
    const body = buildExtractionBody({ model: "m", kind: "invoice", base64: "AA", fileName: "", strict: false });
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toMatch(/Responda só com um objeto JSON/);
    expect(body.messages[1].content[0]).toMatchObject({ file: { filename: "documento.pdf" } });
  });
});

describe("bytesToBase64", () => {
  it("converte arquivos grandes sem estourar", () => {
    const bytes = new Uint8Array(200_000).fill(65);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});
