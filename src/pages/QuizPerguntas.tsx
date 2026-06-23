import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Search, AlertTriangle } from "lucide-react";

const SUBJECTS = ["Imobiliária", "Industrial", "Automotiva", "Geral"];

interface Question { id: string; question: string; subject: string | null; }

export default function QuizPerguntas() {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState("");
  const [onlyUntagged, setOnlyUntagged] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("quiz_questions").select("id, question, subject").order("subject", { ascending: true });
      setQuestions((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const untaggedCount = useMemo(() => questions.filter((q) => !q.subject).length, [questions]);

  const filtered = useMemo(
    () =>
      questions.filter(
        (q) =>
          (!onlyUntagged || !q.subject) &&
          q.question.toLowerCase().includes(search.toLowerCase())
      ),
    [questions, search, onlyUntagged]
  );

  const setSubject = async (id: string, subject: string) => {
    setSavingId(id);
    const prev = questions;
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, subject } : q)));
    const { error } = await supabase.from("quiz_questions").update({ subject } as any).eq("id", id);
    if (error) {
      setQuestions(prev);
      toast.error(`Erro ao salvar: ${error.message}`);
    }
    setSavingId(null);
  };

  return (
    <AppLayout title="Assuntos das Perguntas">
      <div className="space-y-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classificar perguntas do quiz por tipo de tinta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Marque cada pergunta com o tipo de tinta (Imobiliária, Industrial, Automotiva). É isso que faz o filtro de assuntos por vendedor funcionar — um vendedor só recebe perguntas dos assuntos atribuídos a ele.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8 h-9" placeholder="Buscar pergunta..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button
                onClick={() => setOnlyUntagged((v) => !v)}
                className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors flex items-center gap-1.5 ${onlyUntagged ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Sem assunto ({untaggedCount})
              </button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {filtered.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma pergunta encontrada.</p>
              )}
              {filtered.map((q) => (
                <div key={q.id} className="flex items-center gap-4 p-4">
                  <p className="flex-1 text-sm text-foreground">{q.question}</p>
                  <div className="shrink-0 w-44 flex items-center gap-2">
                    {savingId === q.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    <Select value={q.subject || ""} onValueChange={(v) => setSubject(q.id, v)}>
                      <SelectTrigger className={`h-9 ${!q.subject ? "border-amber-400 text-amber-600" : ""}`}>
                        <SelectValue placeholder="Sem assunto" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
