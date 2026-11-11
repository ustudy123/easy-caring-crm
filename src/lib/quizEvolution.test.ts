import { describe, expect, it } from "vitest";
import { accuracyTrend, quizEvolution, type QuizAttemptLite } from "./quizEvolution";

const a = (date: string, o: Partial<QuizAttemptLite> = {}): QuizAttemptLite => ({
  completed_at: `${date}T15:00:00-03:00`, total_questions: 10, correct_answers: 7, score: 70, is_penalty: false, skipped_inactive: false, ...o,
});

describe("quizEvolution", () => {
  const attempts = [
    a("2026-08-04"), a("2026-08-06", { correct_answers: 5, score: 50 }),
    a("2026-08-11", { is_penalty: true, score: -100, total_questions: 0, correct_answers: 0 }),
    a("2026-10-01", { correct_answers: 9, score: 90 }),
    a("2026-10-02", { skipped_inactive: true, score: 0, total_questions: 0, correct_answers: 0 }),
  ];

  it("soma por mês e deixa os meses vazios na sequência", () => {
    const m = quizEvolution(attempts, new Date(2026, 10, 11));
    expect(m.map((x) => x.key)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(m[0]).toMatchObject({ label: "ago/26", quizzes: 2, questions: 20, correct: 12, accuracy: 60, points: 20, missed: 1 });
    expect(m[1]).toMatchObject({ quizzes: 0, questions: 0, accuracy: null, points: 0 });
    expect(m[2]).toMatchObject({ quizzes: 1, questions: 10, correct: 9, accuracy: 90, points: 90, missed: 0 });
  });

  it("compara o acerto com o último mês que teve perguntas", () => {
    const m = quizEvolution(attempts, new Date(2026, 10, 11));
    expect(accuracyTrend(m, "2026-10")).toBe(30);
    expect(accuracyTrend(m, "2026-08")).toBeNull();
    expect(accuracyTrend(m, "2026-09")).toBeNull();
  });

  it("sem tentativas não mostra meses", () => {
    expect(quizEvolution([], new Date())).toEqual([]);
  });
});
