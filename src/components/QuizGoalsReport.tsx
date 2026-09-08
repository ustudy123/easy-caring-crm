import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { computeQuizLevel } from "@/lib/quizLevel";
import { exportToCsv } from "@/lib/exportCsv";
import { Target, Download, Loader2 } from "lucide-react";

interface SellerRow { id: string; name: string; user_id: string | null; quiz_monthly_goal: number | null; store_id: string | null; is_active: boolean | null; }
interface AttemptRow { user_id: string; total_questions: number | null; correct_answers: number | null; score: number | null; completed_at: string | null; is_penalty: boolean | null; skipped_inactive: boolean | null; }

interface GoalRow {
  name: string;
  levelLabel: string;
  notaAcumulada: number | null; // % de acerto acumulado (all-time)
  answeredTotal: number;
  goal: number | null;
  answeredMonth: number;
  pctGoal: number | null;
  status: "sem_meta" | "atingiu" | "andamento";
  lastPlayed: string | null;
}

const LEVEL_BADGE: Record<string, string> = {
  basico: "bg-slate-100 text-slate-600",
  intermediario: "bg-blue-100 text-blue-700",
  avancado: "bg-purple-100 text-purple-700",
  especialista: "bg-amber-100 text-amber-700",
};

// Meta geral padrão (perguntas respondidas por mês) para quem não tem meta
// individual configurada no cadastro. Conta respondidas, independe de acerto.
const DEFAULT_GOAL = 50;

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function QuizGoalsReport() {
  const { isAdmin, isGerente, storeId } = useRole();
  const restrictToStore = isGerente && !isAdmin && !!storeId;
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sRes, aRes] = await Promise.all([
        supabase.from("sellers").select("id, name, user_id, quiz_monthly_goal, store_id, is_active"),
        supabase.from("quiz_attempts").select("user_id, total_questions, correct_answers, score, completed_at, is_penalty, skipped_inactive"),
      ]);
      setSellers((sRes.data as any) || []);
      setAttempts((aRes.data as any) || []);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo<GoalRow[]>(() => {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthMs = monthStart.getTime();

    const byUser = new Map<string, AttemptRow[]>();
    for (const a of attempts) {
      if (!a.user_id) continue;
      const arr = byUser.get(a.user_id) || [];
      arr.push(a); byUser.set(a.user_id, arr);
    }

    return sellers
      .filter((s) => s.user_id && s.is_active !== false)
      .filter((s) => !restrictToStore || s.store_id === storeId)
      .map((s) => {
        const list = byUser.get(s.user_id!) || [];
        const real = list.filter((a) => !a.is_penalty && !a.skipped_inactive);
        const answeredTotal = real.reduce((t, a) => t + (a.total_questions || 0), 0);
        const correctTotal = real.reduce((t, a) => t + (a.correct_answers || 0), 0);
        const notaAcumulada = answeredTotal > 0 ? Math.round((correctTotal / answeredTotal) * 1000) / 10 : null;
        const level = computeQuizLevel(answeredTotal, correctTotal);

        const monthReal = real.filter((a) => a.completed_at && new Date(a.completed_at).getTime() >= monthMs);
        const answeredMonth = monthReal.reduce((t, a) => t + (a.total_questions || 0), 0);
        const lastPlayed = real.reduce<string | null>((m, a) => (a.completed_at && (!m || a.completed_at > m) ? a.completed_at : m), null);

        const rawGoal = s.quiz_monthly_goal;
        const goal = rawGoal ?? DEFAULT_GOAL;      // meta geral padrão quando não configurada
        const isDefaultGoal = rawGoal == null;
        const pctGoal = goal > 0 ? Math.round((answeredMonth / goal) * 100) : null;
        const status: GoalRow["status"] = goal <= 0 ? "sem_meta" : (answeredMonth >= goal ? "atingiu" : "andamento");

        return { name: s.name, levelLabel: level.current.label, levelKey: level.current.key, notaAcumulada, answeredTotal, goal, isDefaultGoal, answeredMonth, pctGoal, status, lastPlayed } as any;
      })
      .sort((a, b) => (b.pctGoal ?? -1) - (a.pctGoal ?? -1) || b.answeredMonth - a.answeredMonth);
  }, [sellers, attempts, restrictToStore, storeId]);

  const handleExport = () => {
    const mes = new Date().toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
    exportToCsv(
      rows,
      [
        { key: "usuario", label: "Usuário", format: (r) => r.name },
        { key: "nivel", label: "Nível", format: (r) => r.levelLabel },
        { key: "nota", label: "Nota acumulada (% acerto)", format: (r) => (r.notaAcumulada != null ? `${r.notaAcumulada}%` : "—") },
        { key: "resp_total", label: "Respondidas (total)", format: (r) => String(r.answeredTotal) },
        { key: "meta", label: "Meta/mês", format: (r) => (r.goal > 0 ? `${r.goal}${r.isDefaultGoal ? " (padrão)" : ""}` : "sem meta") },
        { key: "resp_mes", label: "Respondidas no mês", format: (r) => String(r.answeredMonth) },
        { key: "pct_meta", label: "% Meta atingida", format: (r) => (r.pctGoal != null ? `${r.pctGoal}%` : "—") },
        { key: "status", label: "Status", format: (r) => (r.status === "atingiu" ? "Atingiu" : r.status === "andamento" ? "Em andamento" : "Sem meta") },
        { key: "ultima", label: "Última rodada", format: (r) => fmtDate(r.lastPlayed) },
      ],
      `metas_quiz_${mes.replace("/", "-")}`,
    );
  };

  const nowLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="rounded-3xl overflow-hidden bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">Metas do quiz</p>
            <h3 className="text-lg font-black text-foreground">Acompanhamento de metas — {nowLabel}</h3>
          </div>
        </div>
        <button onClick={handleExport} disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40">
          <Download className="h-3.5 w-3.5" /> Exportar Excel (CSV)
        </button>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…</div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                  <th className="py-2 font-semibold">Usuário</th>
                  <th className="py-2 font-semibold">Nível</th>
                  <th className="py-2 font-semibold text-right">Nota acumulada</th>
                  <th className="py-2 font-semibold text-right">Meta/mês</th>
                  <th className="py-2 font-semibold text-right">No mês</th>
                  <th className="py-2 font-semibold text-right">% Meta</th>
                  <th className="py-2 font-semibold text-right">Status</th>
                  <th className="py-2 font-semibold text-right">Última</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Nenhum vendedor encontrado.</td></tr>
                )}
                {rows.map((r: any) => (
                  <tr key={r.name} className="border-b border-border/30">
                    <td className="py-2.5 font-medium text-foreground">{r.name}</td>
                    <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${LEVEL_BADGE[r.levelKey] || LEVEL_BADGE.basico}`}>{r.levelLabel}</span></td>
                    <td className="py-2.5 text-right tabular-nums font-semibold">{r.notaAcumulada != null ? `${r.notaAcumulada}%` : "—"}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {r.goal > 0
                        ? (<>{r.goal}{r.isDefaultGoal && <span className="ml-1 text-[10px] text-muted-foreground">(padrão)</span>}</>)
                        : <span className="text-muted-foreground italic text-xs">sem meta</span>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{r.answeredMonth}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold">
                      {r.pctGoal != null ? (
                        <span className={r.pctGoal >= 100 ? "text-emerald-600" : r.pctGoal >= 50 ? "text-amber-600" : "text-red-600"}>{r.pctGoal}%</span>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      {r.status === "atingiu" && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">Atingiu</span>}
                      {r.status === "andamento" && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">Em andamento</span>}
                      {r.status === "sem_meta" && <span className="text-[11px] text-muted-foreground italic">sem meta</span>}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground tabular-nums">{fmtDate(r.lastPlayed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
