import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseMockState } from "@/test/supabaseMock";

const state = vi.hoisted(() => ({ db: {}, calls: [] }) as SupabaseMockState);
const rpcArgs: Record<string, unknown>[] = [];
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  const base = createSupabaseMock(state);
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: { ...base, channel: () => channel, removeChannel: () => undefined } };
});

import { QuizLeaderboard } from "./QuizLeaderboard";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 11, 12));
  rpcArgs.length = 0;
  state.db = { quiz_attempts: [{ completed_at: "2026-08-05T12:00:00Z" }] };
  state.rpc = { get_quiz_leaderboard: (args) => {
    rpcArgs.push(args);
    return [{ user_id: "u1", display_name: "Ana Paula", avatar_url: "https://x/storage/v1/object/public/avatars/a.jpg", best_score: 900, attempts: 9 }];
  } };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("QuizLeaderboard", () => {
  it("deixa escolher um mês passado e mostra a foto do operador", async () => {
    render(<QuizLeaderboard currentUserId="u1" />);
    await waitFor(() => expect(screen.getAllByText("Ana Paula").length).toBeGreaterThan(0));
    const select = screen.getByLabelText("Escolher mês do ranking");
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.textContent)).toEqual([
      "Escolher mês", "Novembro de 2026", "Outubro de 2026", "Setembro de 2026", "Agosto de 2026",
    ]);
    fireEvent.change(select, { target: { value: "2026-08" } });
    await waitFor(() => expect(rpcArgs.at(-1)!.p_until).toBeDefined());
    expect(new Date(rpcArgs.at(-1)!.p_since as string)).toEqual(new Date(2026, 7, 1));
    expect(new Date(rpcArgs.at(-1)!.p_until as string)).toEqual(new Date(2026, 8, 1));
  });
});
