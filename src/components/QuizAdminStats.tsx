import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { computeQuizLevel } from "@/lib/quizLevel";
import { startOfWeek, startOfMonth } from "date-fns";
import { Paintbrush, Trophy, Target, ListChecks, AlertTriangle, Loader2 } from "lucide-react";

interface Attempt {
  user_id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  completed_at: string;
  is_penalty: boolean;
  skipped_inactive: boolean;
}

interface SellerStat {
  userId: string;
  name: string;
  points: number;
  answered: number;
  correct: number;
  accuracy: number;
  plays: number;
  penalties: number;
  levelLabel: string;
  levelKey: string;
  lastPlayed: string | null;
}

const PERIODS = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "all", label: "Tudo" },
];

const LEVEL_BADGE: Record<string, string> = {
  basico: "bg-slate-100 text-slate-600",
  intermediario: "bg-sky-100 text-sky-700",
  avancado: "bg-violet-100 text-violet-700",
  especialista: "bg-amber-100 text-amber-700",
};

function sinceISO(period: string): string | null {
  const now = new Date();
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  if (period === "month") return startOfMonth(now).toISOString();
  return null;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function QuizAdminStats() {
  const [period, setPeriod] = useState("week");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SellerStat[]>([]);
  const [summary, setSummary] = useState({ participants: 0, totalActive: 0, avgAccuracy: 0, totalQuestions: 0, totalPenalties: 0 });

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const since = sinceISO(period);
        let q = supabase.from("quiz_attempts").select("user_id, score, total_questions, correct_answers, completed_at, is_penalty, skipped_inactive");
        if (since) q = q.gte("completed_at", since);
        const [sellersRes, attemptsRes] = await Promise.all([
          supabase.from("sellers").select("name, user_id, is_active"),
          q,
        ]);
        if (cancel) return;

        const sellers = (sellersRes.data || []).filter((s: any) => s.user_id && s.is_active !== false);
        const attempts: Attempt[] = (attemptsRes.data as any) || [];
        const byUser = new Map<string, Attempt[]>();
        for (const a of attempts) {
          if (!a.user_id) continue;
          const arr = byUser.get(a.user_id) || [];
          arr.push(a);
          byUser.set(a.user_id, arr);
        }

        const stats: SellerStat[] = sellers.map((s: any) => {
          const list = byUser.get(s.user_id) || [];
          const real = list.filter((a) => !a.is_penalty && !a.skipped_inactive);
          const answered = real.reduce((t, a) => t + (a.total_questions || 0), 0);
          const correct = real.reduce((t, a) => t + (a.correct_answers || 0), 0);
          const points = list.reduce((t, a) => t + (a.score || 0), 0);
          const penalties = list.filter((a) => a.is_penalty).length;
          const lvl = computeQuizLevel(answered, correct);
          const lastPlayed = real.length
            ? real.reduce((m, a) => (a.completed_at > m ? a.completed_at : m), real[0].completed_at)
            : null;
          return {
            userId: s.user_id, name: s.name, points, answered, correct,
            accuracy: answered > 0 ? correct / answered : 0,
            plays: real.length, penalties,
            levelLabel: lvl.current.label, levelKey: lvl.current.key, lastPlayed,
          };
        }).sort((a, b) => b.points - a.points || b.answered - a.answered);

        const totalAnswered = stats.reduce((t, s) => t + s.answered, 0);
        const totalCorrect = stats.reduce((t, s) => t + s.correct, 0);
        setSummary({
          participants: stats.filter((s) => s.plays > 0).length,
          totalActive: sellers.length,
          avgAccuracy: totalAnswered > 0 ? totalCorrect / totalAnswered : 0,
          totalQuestions: totalAnswered,
          totalPenalties: stats.reduce((t, s) => t + s.penalties, 0),
        });
        setRows(stats);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [period]);

  return (
    <div className="rounded-3xl overflow-hidden bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <Paintbrush className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">Show das Tintas</p>
            <h3 className="text-lg font-black text-foreground">Desempenho da equipe</h3>
          </div>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${period === p.key ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard icon={<Trophy className="h-4 w-4" />} label="Participação" value={`${summary.participants}/${summary.totalActive}`} hint="vendedores jogaram" />
              <SummaryCard icon={<Target className="h-4 w-4" />} label="Precisão média" value={`${Math.round(summary.avgAccuracy * 100)}%`} hint="acertos da equipe" />
              <SummaryCard icon={<ListChecks className="h-4 w-4" />} label="Perguntas" value={String(summary.totalQuestions)} hint="respondidas no período" />
              <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Faltas" value={String(summary.totalPenalties)} hint="dias de quiz pulados" warn={summary.totalPenalties > 0} />
            </div>

            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                    <th className="py-2 font-semibold">Vendedor</th>
                    <th className="py-2 font-semibold">Nível</th>
                    <th className="py-2 font-semibold text-right">Pontos</th>
                    <th className="py-2 font-semibold text-right">Precisão</th>
                    <th className="py-2 font-semibold text-right">Rodadas</th>
                    <th className="py-2 font-semibold text-right">Faltas</th>
                    <th className="py-2 font-semibold text-right">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum vendedor ativo encontrado.</td></tr>
                  )}
                  {rows.map((s) => {
                    const didntPlay = s.plays === 0;
                    return (
                      <tr key={s.userId} className={`border-b border-border/30 ${didntPlay ? "opacity-50" : ""}`}>
                        <td className="py-2.5 font-medium text-foreground">{s.name}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${LEVEL_BADGE[s.levelKey] || LEVEL_BADGE.basico}`}>{s.levelLabel}</span>
                        </td>
                        <td className="py-2.5 text-right font-black tabular-nums">{s.points.toLocaleString("pt-BR")}</td>
                        <td className="py-2.5 text-right tabular-nums">{didntPlay ? "—" : `${Math.round(s.accuracy * 100)}%`}</td>
                        <td className="py-2.5 text-right tabular-nums">{didntPlay ? <span className="text-xs">não jogou</span> : s.plays}</td>
                        <td className={`py-2.5 text-right tabular-nums ${s.penalties > 0 ? "text-red-600 font-semibold" : ""}`}>{s.penalties || "—"}</td>
                        <td className="py-2.5 text-right text-muted-foreground tabular-nums">{fmtDate(s.lastPlayed)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, hint, warn }: { icon: React.ReactNode; label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          <span className={warn ? "text-red-500" : "text-brand-500"}>{icon}</span>
          <span className="text-xs font-semibold">{label}</span>
        </div>
        <p className={`text-2xl font-black ${warn ? "text-red-600" : "text-foreground"}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      </CardContent>
    </Card>
  );
}
