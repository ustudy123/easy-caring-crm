import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseMockState } from "@/test/supabaseMock";

const state = vi.hoisted(() => ({ db: {}, calls: [] }) as SupabaseMockState);
const rpcArgs: Record<string, unknown>[] = [];
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: createSupabaseMock(state) };
});

import { QuizEvolution } from "./QuizEvolution";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 11, 12));
  rpcArgs.length = 0;
  state.db = { quiz_attempts: [
    { user_id: "me", completed_at: "2026-09-08T15:00:00-03:00", total_questions: 10, correct_answers: 6, score: 60, is_penalty: false, skipped_inactive: false },
    { user_id: "me", completed_at: "2026-10-06T15:00:00-03:00", total_questions: 10, correct_answers: 9, score: 90, is_penalty: false, skipped_inactive: false },
    { user_id: "me", completed_at: "2026-10-08T15:00:00-03:00", total_questions: 0, correct_answers: 0, score: -100, is_penalty: true, skipped_inactive: false },
  ] };
  state.rpc = { get_quiz_leaderboard: (args) => { rpcArgs.push(args); return [{ user_id: "outro" }, { user_id: "me" }, { user_id: "x" }]; } };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("QuizEvolution", () => {
  it("mostra o mês escolhido com acerto, variação, faltas e posição no ranking do mês", async () => {
    render(<QuizEvolution userId="me" />);
    expect(await screen.findByText("Sua evolução")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Mês da evolução"), { target: { value: "2026-10" } });
    expect(screen.getByText("90%", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("+30 pontos vs. mês anterior")).toBeInTheDocument();
    expect(screen.getByText("-100 pontos")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("2º de 3 no ranking do mês")).toBeInTheDocument());
    const last = rpcArgs.at(-1)!;
    expect(new Date(last.p_since as string)).toEqual(new Date(2026, 9, 1));
    expect(new Date(last.p_until as string)).toEqual(new Date(2026, 10, 1));
  });
});
