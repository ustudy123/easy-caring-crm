import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Trophy, Medal, Loader2, RefreshCw } from "lucide-react";

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  best_score: number;
  attempts: number;
}

const medalColor = (pos: number) =>
  pos === 0 ? "text-yellow-500" : pos === 1 ? "text-slate-400" : pos === 2 ? "text-amber-700" : "text-muted-foreground";

export function QuizLeaderboard({ currentUserId, limit = 10 }: { currentUserId?: string; limit?: number }) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_quiz_leaderboard", { limit_count: limit });
    if (!error && data) setRows(data as LeaderboardRow[]);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchLeaderboard();

    // Atualização em tempo real: quando qualquer um conclui o quiz, rebusca
    const channel = supabase
      .channel("quiz-ranking")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_attempts" },
        () => fetchLeaderboard(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaderboard]);

  return (
    <Card className="bg-white border-brand-100 rounded-3xl p-6 max-w-md mx-auto text-left">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-foreground flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" /> Ranking dos Especialistas
        </h3>
        <button
          onClick={() => fetchLeaderboard()}
          className="text-muted-foreground hover:text-brand-500 transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Ainda não há pontuações. Seja o primeiro a jogar!
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const isMe = currentUserId && r.user_id === currentUserId;
            return (
              <div
                key={r.user_id}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                  isMe ? "bg-brand-50 border border-brand-200" : "bg-muted/40"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center shrink-0">
                  {i < 3 ? (
                    <Medal className={`h-6 w-6 ${medalColor(i)}`} />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {r.display_name}
                    {isMe && <span className="ml-1.5 text-[10px] font-semibold text-brand-500">(você)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.attempts} {r.attempts === 1 ? "tentativa" : "tentativas"}
                  </p>
                </div>
                <div className="text-sm font-black text-brand-500 tabular-nums shrink-0">
                  R$ {r.best_score.toLocaleString("pt-BR")}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
