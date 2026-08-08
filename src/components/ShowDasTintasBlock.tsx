import { QuizLeaderboard } from "@/components/QuizLeaderboard";
import { useAuth } from "@/contexts/AuthContext";
import { Paintbrush } from "lucide-react";

// Bloco do HUB Taeco Tintas (ranking/pontos) para exibir no fim dos dashboards.
// Reaproveita o QuizLeaderboard (tema escuro) dentro de um card do game-show.
export function ShowDasTintasBlock() {
  const { user } = useAuth();
  return (
    <div className="rounded-3xl overflow-hidden bg-[#0a0e2e] border border-white/10 shadow-lg">
      <div className="flex items-center gap-2 px-5 pt-5 pb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
          <Paintbrush className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Gamificação</p>
          <h3 className="text-lg font-black text-white">HUB Taeco Tintas</h3>
        </div>
      </div>
      <div className="p-5 pt-2">
        <QuizLeaderboard currentUserId={user?.id} />
      </div>
    </div>
  );
}
