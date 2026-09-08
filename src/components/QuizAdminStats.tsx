import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { computeQuizLevel } from "@/lib/quizLevel";
import { startOfWeek, startOfMonth } from "date-fns";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Paintbrush, Trophy, Target, ListChecks, AlertTriangle, Loader2, TrendingUp, BookOpen } from "lucide-react";

interface Attempt {
  user_id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  completed_at: string;
  is_penalty: boolean;
  skipped_inactive: boolean;
  subject_breakdown: Record<string, { answered: number; correct: number }> | null;
}

interface SubjectStat { subject: string; answered: number; correct: number; accuracy: number; }
interface DailyPoint { date: string; points: number; }

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

function fmtDay(d: string): string {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function barColor(acc: number): string {
  if (acc < 0.5) return "bg-red-500";
  if (acc < 0.75) return "bg-amber-500";
  return "bg-emerald-500";
}

export function QuizAdminStats() {
  const [period, setPeriod] = useState("week");
  // Filtros da lista de vendedores (aplicados só à tabela, não aos cards de resumo).
  const [levelFilter, setLevelFilter] = useState("all");        // all | basico | intermediario | avancado | especialista
  const [pointsFilter, setPointsFilter] = useState(0);          // pontos mínimos (0 = qualquer)
  const [accuracyFilter, setAccuracyFilter] = useState(0);      // precisão mínima em % (0 = qualquer)
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SellerStat[]>([]);
  const [summary, setSummary] = useState({ participants: 0, totalActive: 0, avgAccuracy: 0, totalQuestions: 0, totalPenalties: 0 });
  const [subjects, setSubjects] = useState<SubjectStat[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const since = sinceISO(period);
        let q = supabase.from("quiz_attempts").select("user_id, score, total_questions, correct_answers, completed_at, is_penalty, skipped_inactive, subject_breakdown");
        if (since) q = q.gte("completed_at", since);
        // O NÍVEL é acumulado (all-time) e NÃO muda com o filtro de período; por isso
        // uma busca separada, sem filtro de data. As métricas do período (pontos,
        // precisão, rodadas, participação) seguem vindo da query filtrada acima.
        const lifetimeQ = supabase.from("quiz_attempts").select("user_id, total_questions, correct_answers, is_penalty, skipped_inactive");
        const [sellersRes, attemptsRes, lifetimeRes] = await Promise.all([
          supabase.from("sellers").select("name, user_id, is_active"),
          q,
          lifetimeQ,
        ]);
        if (cancel) return;
        // Respondidas/acertos de TODO o histórico por usuário → base do nível.
        const lifeByUser = new Map<string, { answered: number; correct: number }>();
        for (const a of ((lifetimeRes.data as any[]) || [])) {
          if (!a.user_id || a.is_penalty || a.skipped_inactive) continue;
          const cur = lifeByUser.get(a.user_id) || { answered: 0, correct: 0 };
          cur.answered += a.total_questions || 0;
          cur.correct += a.correct_answers || 0;
          lifeByUser.set(a.user_id, cur);
        }

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
          // Nível sempre pelo acumulado (all-time), independente do período filtrado.
          const life = lifeByUser.get(s.user_id) || { answered: 0, correct: 0 };
          const lvl = computeQuizLevel(life.answered, life.correct);
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

        // Desempenho por assunto (apenas tentativas reais com breakdown).
        const subjAgg = new Map<string, { answered: number; correct: number }>();
        for (const a of attempts) {
          if (a.is_penalty || a.skipped_inactive || !a.subject_breakdown) continue;
          for (const [subj, v] of Object.entries(a.subject_breakdown)) {
            const cur = subjAgg.get(subj) || { answered: 0, correct: 0 };
            cur.answered += (v as any)?.answered || 0;
            cur.correct += (v as any)?.correct || 0;
            subjAgg.set(subj, cur);
          }
        }
        setSubjects(
          [...subjAgg.entries()]
            .map(([subject, v]) => ({ subject, answered: v.answered, correct: v.correct, accuracy: v.answered > 0 ? v.correct / v.answered : 0 }))
            .filter((s) => s.answered > 0)
            .sort((a, b) => a.accuracy - b.accuracy)
        );

        // Evolução: pontos por dia (tentativas reais).
        const dayAgg = new Map<string, number>();
        for (const a of attempts) {
          if (a.is_penalty || a.skipped_inactive || !a.completed_at) continue;
          const day = a.completed_at.slice(0, 10);
          dayAgg.set(day, (dayAgg.get(day) || 0) + (a.score || 0));
        }
        setDaily([...dayAgg.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, points]) => ({ date, points })));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [period]);

  // Lista filtrada por nível / pontos mínimos / precisão mínima.
  const filteredRows = rows.filter((s) => {
    if (levelFilter !== "all" && s.levelKey !== levelFilter) return false;
    if (pointsFilter > 0 && s.points < pointsFilter) return false;
    // Precisão só faz sentido para quem jogou no período.
    if (accuracyFilter > 0 && (s.plays === 0 || s.accuracy * 100 < accuracyFilter)) return false;
    return true;
  });
  const hasActiveFilter = levelFilter !== "all" || pointsFilter > 0 || accuracyFilter > 0;

  return (
    <div className="rounded-3xl overflow-hidden bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <Paintbrush className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">HUB Taeco Tintas</p>
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

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Filtrar:</span>
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
                className="h-8 rounded-lg border border-border/60 bg-card px-2 text-xs">
                <option value="all">Todos os níveis</option>
                <option value="basico">Básico</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
                <option value="especialista">Especialista</option>
              </select>
              <select value={String(pointsFilter)} onChange={(e) => setPointsFilter(Number(e.target.value))}
                className="h-8 rounded-lg border border-border/60 bg-card px-2 text-xs">
                <option value="0">Qualquer pontuação</option>
                <option value="100">Acima de 100 pts</option>
                <option value="300">Acima de 300 pts</option>
                <option value="500">Acima de 500 pts</option>
              </select>
              <select value={String(accuracyFilter)} onChange={(e) => setAccuracyFilter(Number(e.target.value))}
                className="h-8 rounded-lg border border-border/60 bg-card px-2 text-xs">
                <option value="0">Qualquer precisão</option>
                <option value="70">Acima de 70%</option>
                <option value="85">Acima de 85%</option>
                <option value="95">Acima de 95%</option>
              </select>
              {hasActiveFilter && (
                <button onClick={() => { setLevelFilter("all"); setPointsFilter(0); setAccuracyFilter(0); }}
                  className="h-8 px-2 text-xs font-semibold text-brand-500 hover:underline">
                  Limpar filtros
                </button>
              )}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{filteredRows.length} de {rows.length}</span>
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
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">{hasActiveFilter ? "Nenhum vendedor bate com os filtros." : "Nenhum vendedor ativo encontrado."}</td></tr>
                  )}
                  {filteredRows.map((s) => {
                    const didntPlay = s.plays === 0;
                    // Só as métricas do período ficam apagadas para quem não jogou;
                    // nome e NÍVEL (que é acumulado) seguem sempre nítidos.
                    const dim = didntPlay ? "opacity-40" : "";
                    return (
                      <tr key={s.userId} className="border-b border-border/30">
                        <td className="py-2.5 font-medium text-foreground">{s.name}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${LEVEL_BADGE[s.levelKey] || LEVEL_BADGE.basico}`}>{s.levelLabel}</span>
                        </td>
                        <td className={`py-2.5 text-right font-black tabular-nums ${dim}`}>{s.points.toLocaleString("pt-BR")}</td>
                        <td className={`py-2.5 text-right tabular-nums ${dim}`}>{didntPlay ? "—" : `${Math.round(s.accuracy * 100)}%`}</td>
                        <td className={`py-2.5 text-right tabular-nums ${dim}`}>{didntPlay ? <span className="text-xs">não jogou</span> : s.plays}</td>
                        <td className={`py-2.5 text-right tabular-nums ${s.penalties > 0 ? "text-red-600 font-semibold" : dim}`}>{s.penalties || "—"}</td>
                        <td className={`py-2.5 text-right text-muted-foreground tabular-nums ${dim}`}>{fmtDate(s.lastPlayed)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {daily.length > 1 && (
              <div className="pt-1">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-brand-500" /> Evolução de pontos da equipe
                </p>
                <ResponsiveContainer width="100%" height={130}>
                  <AreaChart data={daily} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="quizPts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F37021" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#F37021" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      labelFormatter={(d) => fmtDay(String(d))}
                      formatter={(v: any) => [`${v} pts`, "Pontos"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                    />
                    <Area type="monotone" dataKey="points" stroke="#F37021" strokeWidth={2} fill="url(#quizPts)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="pt-1">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-brand-500" /> Desempenho por assunto
                <span className="font-normal text-[11px]">(do mais fraco ao mais forte — onde treinar)</span>
              </p>
              {subjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Os dados por assunto aparecem conforme a equipe joga novas rodadas.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {subjects.map((s) => (
                    <div key={s.subject}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium capitalize text-foreground">{s.subject}</span>
                        <span className="tabular-nums text-muted-foreground">{Math.round(s.accuracy * 100)}% · {s.answered} resp.</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${barColor(s.accuracy)}`} style={{ width: `${Math.max(Math.round(s.accuracy * 100), 3)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
