export class ErpSearchError extends Error {
  constructor(message: string, public status: number, public details: string) {
    super(message);
    this.name = "ErpSearchError";
  }
}

// A busca por pedaço do nome é a consulta mais pesada do Citel e pode passar de
// 8s mesmo com o ERP no ar; esperar pouco fazia o CRM acusar "ERP indisponível".
export const ERP_REQUEST_TIMEOUT_MS = 25_000;
export const ERP_SEARCH_DEADLINE_MS = 60_000;

export function createErpFetcher(headers: Record<string, string>, fetcher: typeof fetch = fetch) {
  const deadline = Date.now() + ERP_SEARCH_DEADLINE_MS;
  return async (url: string): Promise<{ status: number; data: unknown }> => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new ErpSearchError("O ERP não respondeu a tempo. Tente novamente em instantes.", 504, "Search deadline exceeded");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(ERP_REQUEST_TIMEOUT_MS, remaining));
    try {
      const response = await fetcher(url, { headers, signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        // Only an unsupported path/parameter may advance to another candidate.
        if ([400, 404, 405, 422].includes(response.status)) return { status: response.status, data: text };
        if (response.status === 401 || response.status === 403) {
          throw new ErpSearchError("O ERP recusou o usuário/senha da integração. Avise o administrador.", response.status, text || "ERP credentials rejected");
        }
        throw new ErpSearchError("Não foi possível consultar o ERP. Tente novamente em instantes.", response.status, text);
      }
      if (!text && response.status === 204) return { status: response.status, data: [] };
      try {
        return { status: response.status, data: JSON.parse(text) as unknown };
      } catch {
        throw new ErpSearchError("O ERP retornou uma resposta inválida para a busca.", 502, text);
      }
    } catch (error) {
      if (error instanceof ErpSearchError) throw error;
      if (controller.signal.aborted) {
        throw new ErpSearchError("O ERP não respondeu a tempo. Tente novamente em instantes.", 504, "ERP request timed out");
      }
      throw new ErpSearchError("O ERP está indisponível. Tente novamente em instantes.", 503,
        error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  };
}