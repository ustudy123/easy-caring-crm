import { useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp, LineChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { accuracyTrend, quizEvolution, type QuizAttemptLite } from "@/lib/quizEvolution";
import { reportPeriodRange } from "@/lib/reportPeriod";

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">{label}</p>
      <p className={cn("text-xl font-black tabular-nums", tone === "bad" ? "text-red-300" : "text-white")}>{value}</p>
      {hint && <div className="text-[11px] text-white/50 mt-0.5">{hint}</div>}
    </div>
  );
}

/**
 * Evolução do vendedor no Show das Tintas (Fase 10): escolhe o mês e vê
 * partidas, perguntas, % de acerto (com a variação do mês anterior), pontos,
 * faltas e a posição no ranking daquele mês, além das barras dos últimos meses.
 */
export function QuizEvolution({ userId }: { userId: string }) {
  const [attempts, setAttempts] = useState<QuizAttemptLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [position, setPosition] = useState<{ pos: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from("quiz_attempts")
      .select("completed_at, total_questions, correct_answers, score, is_penalty, skipped_inactive")
      .eq("user_id", userId)
      .order("completed_at")
      .then(({ data }) => {
        if (cancelled) return;
        setAttempts((data ?? []) as QuizAttemptLite[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const months = useMemo(() => quizEvolution(attempts), [attempts]);
  const selected = months.find((m) => m.key === monthKey) ?? months[months.length - 1];

  // Posição no ranking do mês escolhido (mesma conta do ranking: soma de pontos).
  useEffect(() => {
    if (!selected) return;
    const { since, until } = reportPeriodRange("month", { monthKey: selected.key });
    let cancelled = false;
    supabase.rpc("get_quiz_leaderboard", { limit_count: 1000, p_since: since!.toISOString(), p_until: until!.toISOString() })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as { user_id: string }[];
        const i = rows.findIndex((r) => r.user_id === userId);
        setPosition(i >= 0 ? { pos: i + 1, total: rows.length } : null);
      });
    return () => { cancelled = true; };
  }, [selected?.key, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;
  if (!selected) {
    return (
      <div className="rounded-3xl bg-white/[0.06] border border-white/10 p-6 max-w-md mx-auto text-left">
        <p className="text-sm text-white/60">Sua evolução aparece aqui depois do primeiro desafio.</p>
      </div>
    );
  }

  const trend = accuracyTrend(months, selected.key);
  const maxQuestions = Math.max(1, ...months.map((m) => m.questions));

  return (
    <div className="rounded-3xl bg-white/[0.06] border border-white/10 backdrop-blur-sm p-6 max-w-md mx-auto text-left space-y-5 shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-black text-white flex items-center gap-2">
          <LineChart className="h-5 w-5 text-amber-400" /> Sua evolução
        </h3>
        <select
          aria-label="Mês da evolução"
          value={selected.key}
          onChange={(e) => setMonthKey(e.target.value)}
          className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white border border-white/10"
        >
          {[...months].reverse().map((m) => (
            <option key={m.key} value={m.key} className="text-black">{m.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Perguntas" value={selected.questions.toLocaleString("pt-BR")} hint={`${selected.quizzes} desafio${selected.quizzes === 1 ? "" : "s"} jogado${selected.quizzes === 1 ? "" : "s"}`} />
        <Stat
          label="Acerto"
          value={selected.accuracy === null ? "—" : `${selected.accuracy}%`}
          hint={trend === null ? `${selected.correct} acertos` : (
            <span className={cn("inline-flex items-center gap-1 font-bold", trend >= 0 ? "text-emerald-300" : "text-red-300")}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend >= 0 ? "+" : ""}{trend} pontos vs. mês anterior
            </span>
          )}
        />
        <Stat label="Pontos no mês" value={selected.points.toLocaleString("pt-BR")} hint={position ? `${position.pos}º de ${position.total} no ranking do mês` : "Fora do ranking do mês"} />
        <Stat label="Faltas" value={String(selected.missed)} tone={selected.missed > 0 ? "bad" : undefined} hint={selected.missed > 0 ? `-${selected.missed * 100} pontos` : "Nenhum dia de quiz perdido"} />
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Perguntas e acerto por mês</p>
        <div className="flex items-end gap-1.5 h-28" role="list" aria-label="Evolução por mês">
          {months.map((m) => (
            <button
              key={m.key}
              type="button"
              role="listitem"
              onClick={() => setMonthKey(m.key)}
              title={`${m.label}: ${m.questions} perguntas, ${m.accuracy ?? 0}% de acerto`}
              className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1 h-full"
            >
              <span className="text-[9px] font-bold text-amber-300 tabular-nums">{m.accuracy === null ? "" : `${m.accuracy}%`}</span>
              <span
                className={cn("w-full rounded-t-md", m.key === selected.key ? "bg-amber-400" : "bg-white/25")}
                style={{ height: `${Math.max(4, Math.round((m.questions / maxQuestions) * 72))}px` }}
              />
              <span className={cn("text-[9px] truncate max-w-full", m.key === selected.key ? "text-white font-bold" : "text-white/40")}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
