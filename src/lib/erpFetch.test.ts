import { afterEach, describe, expect, it, vi } from "vitest";
import { createErpFetcher, ERP_REQUEST_TIMEOUT_MS, ERP_SEARCH_DEADLINE_MS, ErpSearchError } from "../../supabase/functions/citel-search-name/erpFetch";

afterEach(() => vi.useRealTimers());

describe("ERP search failures", () => {
  it("keeps a genuine successful empty result", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]"));
    expect(await createErpFetcher({}, fetcher)("https://erp.test/cliente")).toEqual({ status: 200, data: [] });
  });

  it("preserves the ERP failure status and body instead of a no-match", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("ERP maintenance", { status: 503 }));
    await expect(createErpFetcher({}, fetcher)("https://erp.test/cliente"))
      .rejects.toMatchObject({ status: 503, details: "ERP maintenance" });
  });

  it("rejects connection failures instead of returning an empty result", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Connection refused"));
    await expect(createErpFetcher({}, fetcher)("https://erp.test/cliente"))
      .rejects.toMatchObject({ status: 503, details: "Connection refused" });
  });

  it("stops a hanging ERP request after the per-request timeout", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const request = createErpFetcher({}, fetcher)("https://erp.test/cliente");
    const assertion = expect(request).rejects.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(ERP_REQUEST_TIMEOUT_MS - 1);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not send more requests after the overall deadline", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>();
    const request = createErpFetcher({}, fetcher);
    await vi.advanceTimersByTimeAsync(ERP_SEARCH_DEADLINE_MS);
    await expect(request("https://erp.test/cliente")).rejects.toBeInstanceOf(ErpSearchError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects successful HTML/error pages as invalid ERP responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("<html>Unavailable</html>"));
    await expect(createErpFetcher({}, fetcher)("https://erp.test/cliente"))
      .rejects.toMatchObject({ status: 502 });
  });
});