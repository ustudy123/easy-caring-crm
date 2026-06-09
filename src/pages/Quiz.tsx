import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy, Star, ArrowRight, RotateCcw, PaintBucket, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_option_index: number;
  difficulty: number;
}

export default function Quiz() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("*")
      .order("difficulty", { ascending: true });

    if (!error && data) {
      // Shuffle options for each question
      const formatted = data.map(q => ({
        ...q,
        options: q.options as string[]
      }));
      setQuestions(formatted);
    } else {
      // Fallback questions if none in DB yet
      setQuestions([
        {
          id: "1",
          question: "Qual dessas cores é primária?",
          options: ["Verde", "Laranja", "Azul", "Roxo"],
          correct_option_index: 2,
          difficulty: 1
        },
        {
          id: "2",
          question: "Qual o acabamento mais indicado para disfarçar imperfeições na parede?",
          options: ["Brilhante", "Acetinado", "Fosco", "Semibrilho"],
          correct_option_index: 2,
          difficulty: 2
        },
        {
          id: "3",
          question: "O que deve ser aplicado antes da pintura em paredes novas de reboco?",
          options: ["Verniz", "Selador Acrílico", "Massa Corrida", "Tinner"],
          correct_option_index: 1,
          difficulty: 2
        }
      ]);
    }
    setLoading(false);
  };

  const handleOptionClick = (index: number) => {
    if (selectedOption !== null) return;
    
    setSelectedOption(index);
    const correct = index === questions[currentQuestionIndex].correct_option_index;
    setIsCorrect(correct);
    
    if (correct) {
      setScore(s => s + (questions[currentQuestionIndex].difficulty * 100));
      toast.success("Resposta correta! 🎨", { duration: 1500 });
    } else {
      toast.error("Ops! Não foi dessa vez. 🖌️", { duration: 1500 });
    }

    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(i => i + 1);
        setSelectedOption(null);
        setIsCorrect(null);
      } else {
        setShowResult(true);
        saveAttempt();
      }
    }, 2000);
  };

  const saveAttempt = async () => {
    if (!user) return;
    await supabase.from("quiz_attempts").insert({
      user_id: user.id,
      score: score,
      total_questions: questions.length,
      correct_answers: Math.round(score / 100) // Simplistic mapping
    });
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setShowResult(false);
    setSelectedOption(null);
    setIsCorrect(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PaintBucket className="h-12 w-12 text-brand-500 animate-bounce" />
      </div>
    );
  }

  return (
    <AppLayout title="Show das Tintas">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-500">
                    Pergunta {currentQuestionIndex + 1} de {questions.length}
                  </p>
                  <h2 className="text-2xl font-black text-foreground">
                    {questions[currentQuestionIndex].question}
                  </h2>
                </div>
                <div className="bg-brand-500 text-white px-4 py-2 rounded-2xl font-black shadow-lg shadow-brand-500/20">
                  R$ {score.toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {questions[currentQuestionIndex].options.map((option, idx) => {
                  let status = "default";
                  if (selectedOption !== null) {
                    if (idx === questions[currentQuestionIndex].correct_option_index) status = "correct";
                    else if (idx === selectedOption) status = "wrong";
                  }

                  return (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: selectedOption === null ? 1.02 : 1 }}
                      whileTap={{ scale: selectedOption === null ? 0.98 : 1 }}
                      onClick={() => handleOptionClick(idx)}
                      disabled={selectedOption !== null}
                      className={`
                        p-6 text-left rounded-3xl border-4 transition-all duration-300 font-bold text-lg flex items-center justify-between
                        ${status === "default" ? "bg-white border-black/5 hover:border-brand-500/50 hover:bg-brand-50/30" : ""}
                        ${status === "correct" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : ""}
                        ${status === "wrong" ? "bg-red-50 border-red-500 text-red-700" : ""}
                      `}
                    >
                      <span>{option}</span>
                      {status === "correct" && <Star className="h-6 w-6 fill-emerald-500" />}
                    </motion.button>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-black/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-brand-500"
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
              className="text-center space-y-8"
            >
              <div className="relative inline-block">
                <Trophy className="h-32 w-32 text-yellow-400 mx-auto animate-bounce" />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 -z-10"
                >
                  <Sparkles className="h-32 w-32 text-yellow-200/50" />
                </motion.div>
              </div>

              <div className="space-y-2">
                <h2 className="text-4xl font-black text-foreground">
                  Parabéns!
                </h2>
                <p className="text-muted-foreground text-lg">
                  Você completou o Show das Tintas e acumulou:
                </p>
                <div className="text-6xl font-black text-brand-500 mt-4 tabular-nums">
                  R$ {score.toLocaleString()}
                </div>
              </div>

              <Card className="bg-brand-50 border-brand-200 rounded-3xl p-8 max-w-md mx-auto">
                <p className="text-brand-800 font-bold">
                  Sua pontuação foi salva no ranking. Continue treinando para se tornar um mestre das cores!
                </p>
              </Card>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button 
                  onClick={restartQuiz} 
                  className="h-14 px-8 rounded-2xl font-bold bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/25 gap-2"
                >
                  <RotateCcw className="h-5 w-5" /> Tentar Novamente
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="h-14 px-8 rounded-2xl font-bold border-2 gap-2"
                >
                  Voltar ao Hub <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
