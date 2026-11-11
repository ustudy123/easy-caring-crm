import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { SupabaseMockState } from "@/test/supabaseMock";

const state = vi.hoisted(() => ({ db: {}, calls: [], storage: [] }) as SupabaseMockState);
const role = vi.hoisted(() => ({ sellerId: "ana" as string | null, isAdmin: false, isGerente: false, storeId: "ext" as string | null }));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: createSupabaseMock(state) };
});
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/media/ProtectedPdfViewer", () => ({ ProtectedPdfViewer: ({ path }: { path: string }) => <div data-testid="pdf">{path}</div> }));
vi.mock("@/components/media/AudioRecorder", () => ({
  AudioRecorder: ({ onChange }: { onChange: (b: Blob) => void }) => <button type="button" onClick={() => onChange(new Blob(["x"], { type: "audio/webm" }))}>Gravar áudio</button>,
}));
vi.mock("@/components/media/StoredAudio", () => ({ StoredAudio: ({ path }: { path: string }) => <p>áudio {path}</p>, audioExtension: () => "webm" }));
vi.mock("@/contexts/RoleContext", () => ({ useRole: () => role }));
vi.mock("@/contexts/CrmContext", () => ({
  useCrm: () => ({ sellers: [
    { id: "ana", name: "Ana", store_id: "ext", role: "vendedor", leadsCount: 0, conversions: 0 },
    { id: "ger", name: "Gestor", store_id: "ext", role: "gerente", leadsCount: 0, conversions: 0 },
  ] }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import Feedback from "./Feedback";

const fb = (o: Record<string, unknown> = {}) => ({
  id: "f1", seller_id: "ana", period_label: "1º semestre de 2026", storage_path: "ana/feedback/f1.pdf", file_name: "f.pdf",
  created_at: "2026-07-10T12:00:00Z", viewed_at: null, response_text: null, response_audio_path: null, responded_at: null, ...o,
});
const renderPage = (url = "/feedback") => render(<MemoryRouter initialEntries={[url]}><Feedback /></MemoryRouter>);

beforeEach(() => {
  state.calls = []; state.storage = [];
  state.db = { seller_feedbacks: [fb()] };
  Object.assign(role, { sellerId: "ana", isAdmin: false, isGerente: false, storeId: "ext" });
});
afterEach(cleanup);

describe("Feedback — operador", () => {
  it("abre o feedback, marca como lido e responde por texto", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("1º semestre de 2026"));
    expect(screen.getByTestId("pdf")).toHaveTextContent("ana/feedback/f1.pdf");
    await waitFor(() => expect(state.calls[0]).toMatchObject({ op: "update", filters: ["id=f1"] }));
    expect(Object.keys(state.calls[0].values as object)).toEqual(["viewed_at"]);
    const send = screen.getByRole("button", { name: /Enviar resposta/ });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Sua resposta ao feedback"), { target: { value: "Vou melhorar o follow-up." } });
    fireEvent.click(send);
    await waitFor(() => expect(state.calls.at(-1)).toMatchObject({ op: "update", values: { response_text: "Vou melhorar o follow-up.", response_audio_path: null } }));
  });

  it("responde só com áudio, gravado na pasta de respostas do operador", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("1º semestre de 2026"));
    fireEvent.click(screen.getByRole("button", { name: "Gravar áudio" }));
    fireEvent.click(screen.getByRole("button", { name: /Enviar resposta/ }));
    await waitFor(() => expect(state.storage).toHaveLength(1));
    expect(state.storage![0].path).toMatch(/^ana\/respostas\/f1-\d+\.webm$/);
    await waitFor(() => expect(state.calls.at(-1)).toMatchObject({ values: { response_text: null, response_audio_path: state.storage![0].path } }));
  });

  it("mostra a resposta gravada sem permitir outra", async () => {
    state.db.seller_feedbacks = [fb({ viewed_at: "2026-07-11", responded_at: "2026-07-12T12:00:00Z", response_text: "Combinado." })];
    renderPage();
    fireEvent.click(await screen.findByText("1º semestre de 2026"));
    expect(screen.getByText("Combinado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enviar resposta/ })).not.toBeInTheDocument();
  });
});

describe("Feedback — gestor", () => {
  it("envia o PDF ao operador e exclui", async () => {
    Object.assign(role, { sellerId: null, isAdmin: true, isGerente: false, storeId: null });
    renderPage("/feedback?vendedor=ana");
    expect(await screen.findByText("1º semestre de 2026")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Período da análise"), { target: { value: "2º semestre de 2026" } });
    fireEvent.change(screen.getByLabelText("PDF do feedback"), { target: { files: [new File(["%PDF"], "fb.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar ao operador/ }));
    await waitFor(() => expect(state.calls.some((c) => c.op === "insert")).toBe(true));
    const ins = state.calls.find((c) => c.op === "insert")!.values as { id: string; storage_path: string };
    expect(ins).toMatchObject({ seller_id: "ana", period_label: "2º semestre de 2026", file_name: "fb.pdf" });
    expect(ins.storage_path).toBe(`ana/feedback/${ins.id}.pdf`);
    expect(state.storage![0]).toEqual({ op: "upload", bucket: "seller-files", path: ins.storage_path });

    fireEvent.click(screen.getByRole("button", { name: "Excluir 1º semestre de 2026" }));
    fireEvent.click(await screen.findByRole("button", { name: /Excluir|Confirmar/ }));
    await waitFor(() => expect(state.calls.some((c) => c.op === "delete")).toBe(true));
  });
});
