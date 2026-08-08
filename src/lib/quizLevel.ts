// Níveis do HUB Taeco Tintas com progressão automática.
// Todos começam no "Básico" e evoluem conforme o desempenho (volume de
// perguntas respondidas + percentual de acerto). Nada é definido manualmente:
// o nível é sempre derivado das estatísticas do vendedor.
//
// Os limiares abaixo são facilmente ajustáveis caso o André queira outros números.

export interface QuizLevelDef {
  key: "basico" | "intermediario" | "avancado" | "especialista";
  label: string;
  // Requisitos mínimos para ALCANÇAR este nível:
  minAnswered: number;   // total de perguntas respondidas
  minAccuracy: number;   // percentual de acerto (0 a 1)
}

export const QUIZ_LEVELS: QuizLevelDef[] = [
  { key: "basico",        label: "Básico",        minAnswered: 0,   minAccuracy: 0 },
  { key: "intermediario", label: "Intermediário", minAnswered: 30,  minAccuracy: 0.70 },
  { key: "avancado",      label: "Avançado",      minAnswered: 80,  minAccuracy: 0.85 },
  { key: "especialista",  label: "Especialista",  minAnswered: 150, minAccuracy: 0.95 },
];

export interface QuizLevelResult {
  current: QuizLevelDef;
  next: QuizLevelDef | null;
  answered: number;
  correct: number;
  accuracy: number;      // 0 a 1
  progressToNext: number; // 0 a 1 (quanto falta para o próximo nível)
}

export function computeQuizLevel(answered: number, correct: number): QuizLevelResult {
  const accuracy = answered > 0 ? correct / answered : 0;

  // O nível atual é o mais alto cujos requisitos (volume E acerto) são atendidos.
  let currentIndex = 0;
  for (let i = 0; i < QUIZ_LEVELS.length; i++) {
    const lvl = QUIZ_LEVELS[i];
    if (answered >= lvl.minAnswered && accuracy >= lvl.minAccuracy) {
      currentIndex = i;
    }
  }

  const current = QUIZ_LEVELS[currentIndex];
  const next = QUIZ_LEVELS[currentIndex + 1] ?? null;

  // Progresso até o próximo nível: o "pior" dos dois critérios (volume e acerto),
  // para refletir o que ainda está faltando.
  let progressToNext = 1;
  if (next) {
    const volRatio = next.minAnswered > 0 ? Math.min(answered / next.minAnswered, 1) : 1;
    const accRatio = next.minAccuracy > 0 ? Math.min(accuracy / next.minAccuracy, 1) : 1;
    progressToNext = Math.min(volRatio, accRatio);
  }

  return { current, next, answered, correct, accuracy, progressToNext };
}
