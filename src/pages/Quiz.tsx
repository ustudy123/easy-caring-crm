import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy, Star, RotateCcw, PaintBucket, Sparkles, ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { QuizLeaderboard } from "@/components/QuizLeaderboard";

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_option_index: number;
  difficulty: string;
  subject?: string;
  code?: string;
}

const QUESTIONS_PER_ROUND = 10;

// Sorteia um lote de perguntas (rotatividade a cada partida)
function selectRound(pool: Question[]): Question[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, QUESTIONS_PER_ROUND);
}

export default function Quiz() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("*");

    if (!error && data && data.length > 0) {
      const formatted = data.map(q => ({
        ...q,
        options: q.options as string[]
      }));
      setAllQuestions(formatted);
      setQuestions(selectRound(formatted));
    } else {
      const fallback = [
        {
          id: "1",
          question: "Qual dessas cores é primária?",
          options: ["Verde", "Laranja", "Azul", "Roxo"],
          correct_option_index: 2,
          difficulty: "Fácil"
        },
        {
          id: "2",
          question: "Qual o acabamento mais indicado para disfarçar imperfeições na parede?",
          options: ["Brilhante", "Acetinado", "Fosco", "Semibrilho"],
          correct_option_index: 2,
          difficulty: "Fácil"
        },
        {
          id: "3",
          question: "O que deve ser aplicado antes da pintura em paredes novas de reboco?",
          options: ["Verniz", "Selador Acrílico", "Massa Corrida", "Tinner"],
          correct_option_index: 1,
          difficulty: "Fácil"
        }
      ];
      setAllQuestions(fallback);
      setQuestions(fallback);
    }
    setLoading(false);
  };

  // Inicia uma nova partida sorteando 25 perguntas do pool
  const startRound = () => {
    setQuestions(selectRound(allQuestions));
    setCurrentQuestionIndex(0);
    setScore(0);
    setShowResult(false);
    setSelectedOption(null);
    setIsCorrect(null);
    setStarted(true);
  };

  const handleOptionClick = (index: number) => {
    if (selectedOption !== null) return;

    const activeQuestion = questions[currentQuestionIndex];
    if (!activeQuestion) return;
    
    setSelectedOption(index);
    const correct = index === activeQuestion.correct_option_index;
    setIsCorrect(correct);
    
    // 5 pontos por resposta correta (modelo definido na reunião)
    const POINTS_PER_CORRECT = 5;
    const nextScore = correct ? score + POINTS_PER_CORRECT : score;
    
    if (correct) {
      setScore(nextScore);
      toast.success("Resposta correta! +5 pontos 🎨", { duration: 1500 });
    } else {
      toast.error("Ops! Não foi dessa vez. 🖌️", { duration: 1500 });
    }

    setTimeout(() => {
      if (currentQuestionIndex + 1 < questions.length) {
        setCurrentQuestionIndex(i => i + 1);
        setSelectedOption(null);
        setIsCorrect(null);
      } else {
        setShowResult(true);
        saveAttempt(nextScore);
      }
    }, 2000);
  };

  const saveAttempt = async (finalScore: number) => {
    if (!user) return;
    await supabase.from("quiz_attempts").insert({
      user_id: user.id,
      score: finalScore,
      total_questions: questions.length,
      correct_answers: Math.round(finalScore / 5)
    });
  };

  const restartQuiz = () => {
    startRound();
  };

  const backToLanding = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setShowResult(false);
    setSelectedOption(null);
    setIsCorrect(null);
    setStarted(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PaintBucket className="h-12 w-12 text-brand-500 animate-bounce" />
      </div>
    );
  }

  if (!showResult && questions.length === 0) {
    return (
      <AppLayout title="Show das Tintas">
        <div className="max-w-md mx-auto py-20 text-center space-y-4">
          <PaintBucket className="h-12 w-12 text-brand-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Nenhuma pergunta disponível</h2>
          <p className="text-muted-foreground">
            Ainda não há perguntas cadastradas no Show das Tintas. Volte em breve!
          </p>
        </div>
      </AppLayout>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const shouldShowResult = showResult || !currentQuestion;
  const showLanding = !started && !showResult;

  return (
    <AppLayout title="Show das Tintas">
      <div className="relative -m-4 sm:-m-6 min-h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0e2e]">
        {/* Spotlights do estúdio */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,184,46,0.18),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(108,99,255,0.16),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0e2e]/40 to-[#070920]" />

        <div className="relative max-w-3xl mx-auto py-8 px-4 sm:px-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-2 text-white/60 hover:text-amber-300 hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar ao Hub
          </Button>
          <AnimatePresence mode="wait">
          {showLanding ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-8 text-center pt-2"
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12 }}
                  className="relative mx-auto w-fit"
                >
                  <div className="absolute inset-0 rounded-3xl bg-amber-400/40 blur-2xl" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 mx-auto shadow-[0_0_40px_rgba(245,184,46,0.5)]">
                    <Trophy className="h-12 w-12 text-[#3a2800]" />
                  </div>
                </motion.div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-400 mb-1">O grande desafio das tintas</p>
                  <h2 className="text-4xl font-black text-white drop-shadow-[0_2px_10px_rgba(245,184,46,0.3)]">
                    Show das <span className="text-amber-400">Tintas</span>
                  </h2>
                </div>
                <p className="text-white/60 max-w-sm mx-auto">
                  Responda, acumule prêmios e prove que você é o maior mestre das cores no ranking dos especialistas.
                </p>
              </div>

              <QuizLeaderboard currentUserId={user?.id} />

              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
                <Button
                  onClick={startRound}
                  disabled={questions.length === 0}
                  className="h-16 px-12 rounded-2xl font-black text-xl text-[#3a2800] bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 shadow-[0_0_30px_rgba(245,184,46,0.5)] gap-2 uppercase tracking-wide"
                >
                  <Sparkles className="h-6 w-6" /> Iniciar Desafio
                </Button>
              </motion.div>
              <p className="text-white/40 text-xs">10 perguntas · 5 pontos por acerto · ranking ao vivo</p>
            </motion.div>
          ) : !shouldShowResult ? (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Cabeçalho: prêmio em destaque */}
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-400">
                    Pergunta {currentQuestionIndex + 1} de {questions.length}
                    {currentQuestion.difficulty ? ` · ${currentQuestion.difficulty}` : ""}
                  </p>
                </div>
                <motion.div
                  key={score}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  className="relative shrink-0"
                >
                  <div className="absolute inset-0 rounded-2xl bg-amber-400/40 blur-lg" />
                  <div className="relative bg-gradient-to-r from-amber-300 to-amber-500 text-[#3a2800] px-5 py-2 rounded-2xl font-black text-lg shadow-[0_0_20px_rgba(245,184,46,0.4)] tabular-nums">
                    {score.toLocaleString("pt-BR")} pts
                  </div>
                </motion.div>
              </div>

              {/* Pergunta */}
              <div className="rounded-3xl bg-white/[0.06] border border-white/10 backdrop-blur-sm p-6 text-center">
                <h2 className="text-2xl font-black text-white leading-snug">
                  {currentQuestion.question}
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {currentQuestion.options.map((option, idx) => {
                  let status = "default";
                  if (selectedOption !== null) {
                    if (idx === currentQuestion.correct_option_index) status = "correct";
                    else if (idx === selectedOption) status = "wrong";
                  }
                  const letter = String.fromCharCode(65 + idx);

                  return (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: selectedOption === null ? 1.02 : 1 }}
                      whileTap={{ scale: selectedOption === null ? 0.98 : 1 }}
                      onClick={() => handleOptionClick(idx)}
                      disabled={selectedOption !== null}
                      className={`
                        group p-4 sm:p-5 text-left rounded-2xl border-2 transition-all duration-300 font-bold text-lg flex items-center gap-4
                        ${status === "default" ? "bg-white/[0.04] border-white/10 text-white hover:border-amber-400/70 hover:bg-amber-400/10" : ""}
                        ${status === "correct" ? "bg-emerald-500/20 border-emerald-400 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.4)]" : ""}
                        ${status === "wrong" ? "bg-red-500/20 border-red-400 text-red-100" : ""}
                      `}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-base
                        ${status === "default" ? "bg-amber-400/20 text-amber-300 group-hover:bg-amber-400 group-hover:text-[#3a2800]" : ""}
                        ${status === "correct" ? "bg-emerald-400 text-emerald-900" : ""}
                        ${status === "wrong" ? "bg-red-400 text-red-900" : ""}
                      `}>
                        {letter}
                      </span>
                      <span className="flex-1">{option}</span>
                      {status === "correct" && <Star className="h-6 w-6 fill-emerald-300 text-emerald-300" />}
                    </motion.button>
                  );
                })}
              </div>

              {/* Barra de progresso dourada */}
              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-amber-300 to-amber-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <div className="relative inline-block">
                <div className="absolute inset-0 rounded-full bg-amber-400/30 blur-3xl" />
                <Trophy className="relative h-28 w-28 text-amber-400 mx-auto animate-bounce drop-shadow-[0_0_25px_rgba(245,184,46,0.6)]" />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 -z-10"
                >
                  <Sparkles className="h-28 w-28 text-amber-200/40" />
                </motion.div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-400">Você conquistou</p>
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.15 }}
                  className="text-6xl font-black text-amber-400 tabular-nums drop-shadow-[0_2px_15px_rgba(245,184,46,0.4)]"
                >
                  {score.toLocaleString("pt-BR")} pts
                </motion.div>
                <p className="text-white/60">
                  Pontuação salva no ranking. Continue treinando para virar o mestre das cores!
                </p>
              </div>

              <QuizLeaderboard currentUserId={user?.id} />

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <Button 
                  onClick={restartQuiz} 
                  className="h-14 px-8 rounded-2xl font-black text-[#3a2800] bg-gradient-to-r from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 shadow-[0_0_25px_rgba(245,184,46,0.4)] gap-2 uppercase tracking-wide"
                >
                  <RotateCcw className="h-5 w-5" /> Jogar de Novo
                </Button>
                <Button 
                  variant="outline"
                  onClick={backToLanding}
                  className="h-14 px-8 rounded-2xl font-bold border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white gap-2"
                >
                  <Trophy className="h-5 w-5" /> Ver Ranking
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
