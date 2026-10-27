import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Medal, Crown, Loader2, RefreshCw, List } from "lucide-react";
import { startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  best_score: number;
  attempts: number;
}

type Period = "today" | "week" | "month" | "year" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
  { key: "all", label: "Geral" },
];

function sinceForPeriod(period: Period): string | null {
  const now = new Date();
  switch (period) {
    case "today": return startOfDay(now).toISOString();
    case "week": return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    case "month": return startOfMonth(now).toISOString();
    case "year": return startOfYear(now).toISOString();
    default: return null;
  }
}

function initials(name?: string | null) {
  if (!name) return "U";
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const medalColor = (pos: number) =>
  pos === 0 ? "text-amber-400" : pos === 1 ? "text-slate-300" : pos === 2 ? "text-amber-600" : "text-white/50";

function Rank({ row, pos, isMe }: { row: LeaderboardRow; pos: number; isMe?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${isMe ? "bg-amber-400/15 border border-amber-400/40" : "bg-white/[0.04] border border-white/5"}`}>
      <div className="flex h-8 w-8 items-center justify-center shrink-0">
        {pos < 3 ? <Medal className={`h-6 w-6 ${medalColor(pos)}`} /> : <span className="text-sm font-bold text-white/50">{pos + 1}</span>}
      </div>
      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
        {row.avatar_url && <AvatarImage src={row.avatar_url} alt={row.display_name} />}
        <AvatarFallback className="bg-amber-500 text-[#3a2800] text-xs font-bold">{initials(row.display_name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">
          {row.display_name}
          {isMe && <span className="ml-1.5 text-[10px] font-semibold text-amber-400">(você)</span>}
        </p>
        <p className="text-[11px] text-white/40">{row.attempts} {row.attempts === 1 ? "tentativa" : "tentativas"}</p>
      </div>
      <div className="text-sm font-black text-amber-400 tabular-nums shrink-0">{row.best_score.toLocaleString("pt-BR")} pts</div>
    </div>
  );
}

function PodiumSpot({ row, pos, isMe }: { row: LeaderboardRow; pos: number; isMe?: boolean }) {
  const sizes = ["h-20 w-20", "h-16 w-16", "h-16 w-16"];
  const ring = ["ring-4 ring-amber-400", "ring-4 ring-slate-300", "ring-4 ring-amber-600"];
  const order = pos === 0 ? "order-2" : pos === 1 ? "order-1" : "order-3";
  const lift = pos === 0 ? "-mt-2" : "mt-5";
  return (
    <div className={`flex flex-col items-center gap-1.5 flex-1 ${order} ${lift}`}>
      <div className="relative">
        {pos === 0 && <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 h-6 w-6 text-amber-400 drop-shadow-[0_0_8px_rgba(245,184,46,0.7)]" />}
        {pos === 0 && <div className="absolute inset-0 rounded-full bg-amber-400/40 blur-xl" />}
        <Avatar className={`relative ${sizes[pos]} ${ring[pos]}`}>
          {row.avatar_url && <AvatarImage src={row.avatar_url} alt={row.display_name} />}
          <AvatarFallback className="bg-amber-500 text-[#3a2800] font-bold">{initials(row.display_name)}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-[#0a0e2e] border border-white/10">
          <Medal className={`h-4 w-4 ${medalColor(pos)}`} />
        </div>
      </div>
      <p className="text-xs font-bold text-white text-center truncate max-w-[90px] mt-1">
        {row.display_name}
        {isMe && <span className="block text-[9px] text-amber-400">(você)</span>}
      </p>
      <p className="text-sm font-black text-amber-400 tabular-nums">{row.best_score.toLocaleString("pt-BR")} pts</p>
    </div>
  );
}

export function QuizLeaderboard({ currentUserId, limit = 100 }: { currentUserId?: string; limit?: number }) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");
  const [showFull, setShowFull] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_quiz_leaderboard", { limit_count: limit, p_since: sinceForPeriod(period) });
    if (!error && data) setRows(data as LeaderboardRow[]);
    setLoading(false);
  }, [limit, period]);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
    const channel = supabase
      .channel("quiz-ranking")
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts" }, () => fetchLeaderboard())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeaderboard]);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3, 5);

  return (
    <div className="bg-white/[0.06] border border-white/10 backdrop-blur-sm rounded-3xl p-6 max-w-md mx-auto text-left shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-white flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" /> Ranking dos Especialistas
        </h3>
        <button onClick={() => fetchLeaderboard()} className="text-white/50 hover:text-amber-400 transition-colors" title="Atualizar">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Filtros de período */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${period === p.key ? "bg-amber-400 text-[#3a2800]" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/50 text-center py-6">
          {period === "all" ? "Ainda não há campeões. Seja o primeiro a jogar!" : "Nenhuma pontuação neste período ainda."}
        </p>
      ) : (
        <>
          <div className="flex items-end justify-center gap-2 mb-4 px-2 pt-4">
            {top3.map((r, i) => (
              <PodiumSpot key={r.user_id} row={r} pos={i} isMe={!!currentUserId && r.user_id === currentUserId} />
            ))}
          </div>

          {rest.length > 0 && (
            <div className="space-y-2">
              {rest.map((r, i) => (
                <Rank key={r.user_id} row={r} pos={i + 3} isMe={!!currentUserId && r.user_id === currentUserId} />
              ))}
            </div>
          )}

          {rows.length > 0 && (
            <Button variant="outline" className="w-full mt-4 rounded-2xl font-bold gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setShowFull(true)}>
              <List className="h-4 w-4" /> Ver ranking completo
            </Button>
          )}
        </>
      )}

      <Dialog open={showFull} onOpenChange={setShowFull}>
        <DialogContent className="max-w-md rounded-3xl bg-[#0a0e2e] border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Trophy className="h-5 w-5 text-amber-400" /> Ranking completo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {rows.map((r, i) => (
              <Rank key={r.user_id} row={r} pos={i} isMe={!!currentUserId && r.user_id === currentUserId} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
