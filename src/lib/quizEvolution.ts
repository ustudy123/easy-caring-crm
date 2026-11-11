import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Tentativa do Show das Tintas (o que a evolução precisa). */
export interface QuizAttemptLite {
  completed_at: string;
  total_questions: number;
  correct_answers: number;
  score: number;
  is_penalty: boolean;
  skipped_inactive: boolean;
}

export interface MonthEvolution {
  key: string; // "2026-08"
  label: string; // "ago/26"
  quizzes: number; // partidas jogadas
  questions: number;
  correct: number;
  accuracy: number | null; // 0–100
  points: number; // soma dos pontos, com as faltas descontadas
  missed: number; // dias de quiz sem jogar (penalidade)
}

const monthKey = (d: Date) => format(d, "yyyy-MM");

/**
 * Evolução mês a mês do vendedor (Fase 10): partidas, perguntas, acertos,
 * % de acerto, pontos e faltas. Meses sem nada aparecem zerados, para a
 * sequência ficar contínua desde o primeiro registro.
 */
export function quizEvolution(attempts: QuizAttemptLite[], now: Date = new Date(), maxMonths = 12): MonthEvolution[] {
  if (!attempts.length) return [];
  const first = startOfMonth(new Date(Math.min(...attempts.map((a) => new Date(a.completed_at).getTime()))));
  const end = startOfMonth(now);
  const months: MonthEvolution[] = [];
  for (let cur = first; cur <= end; cur = addMonths(cur, 1)) {
    const label = format(cur, "MMM/yy", { locale: ptBR }).replace(".", "");
    months.push({ key: monthKey(cur), label, quizzes: 0, questions: 0, correct: 0, accuracy: null, points: 0, missed: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const a of attempts) {
    const m = byKey.get(monthKey(new Date(a.completed_at)));
    if (!m) continue;
    m.points += a.score;
    if (a.is_penalty) { m.missed++; continue; }
    if (a.skipped_inactive) continue;
    m.quizzes++;
    m.questions += a.total_questions;
    m.correct += a.correct_answers;
  }
  for (const m of months) m.accuracy = m.questions ? Math.round((m.correct / m.questions) * 100) : null;
  return months.slice(-maxMonths);
}

/** Variação de acerto em relação ao mês anterior com perguntas (pontos percentuais). */
export function accuracyTrend(months: MonthEvolution[], key: string): number | null {
  const i = months.findIndex((m) => m.key === key);
  if (i < 0 || months[i].accuracy === null) return null;
  for (let j = i - 1; j >= 0; j--) {
    if (months[j].accuracy !== null) return months[i].accuracy! - months[j].accuracy!;
  }
  return null;
}
