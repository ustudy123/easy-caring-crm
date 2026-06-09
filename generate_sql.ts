import fs from 'fs';

const csvPath = "Gabarito Embaralhado para Show do Milhão - Gabarito Embaralhado para Show do Milhão.csv";
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n');

const questions = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // The format is: Código,Assunto,Dificuldade,Pergunta,Alternativas,Gabarito
  // Example: T001,Tipos de Tinta,Fácil,Qual a principal indicação da tinta Látex PVA?,A) Fachadas / B) Pisos / C) Paredes internas secas / D) Metais,C
  
  // Use a more robust split for the alternatives field which might contain commas
  // But looking at the preview, the alternatives field is separated by "/"
  // We can try to match the last part as Gabarito (A, B, C, D)
  
  const parts = line.split(',');
  if (parts.length < 6) continue;

  const code = parts[0];
  const subject = parts[1];
  const difficulty = parts[2];
  const questionText = parts[3];
  
  // The alternatives might have been split if they contained commas. 
  // Let's re-join everything between the question and the last part (gabarito)
  const gabarito = parts[parts.length - 1].trim();
  const alternativesPart = parts.slice(4, parts.length - 1).join(',');

  const options = alternativesPart.split('/').map(opt => opt.replace(/^[A-D]\)\s*/, '').trim());
  
  const correctOptionIndex = ['A', 'B', 'C', 'D'].indexOf(gabarito);

  questions.push({
    code,
    subject,
    difficulty,
    question: questionText,
    options,
    correct_option_index: correctOptionIndex === -1 ? 0 : correctOptionIndex
  });
}

// Generate SQL INSERTs
const sqlLines = questions.map(q => {
  const optionsJson = JSON.stringify(q.options).replace(/'/g, "''");
  const questionEscaped = q.question.replace(/'/g, "''");
  const subjectEscaped = q.subject ? q.subject.replace(/'/g, "''") : '';
  const codeEscaped = q.code ? q.code.replace(/'/g, "''") : '';
  
  return `('${codeEscaped}', '${subjectEscaped}', '${q.difficulty}', '${questionEscaped}', '${optionsJson}'::jsonb, ${q.correct_option_index})`;
});

const fullSql = `DELETE FROM public.quiz_questions;
INSERT INTO public.quiz_questions (code, subject, difficulty, question, options, correct_option_index)
VALUES 
${sqlLines.join(',\n')};`;

fs.writeFileSync('import_questions.sql', fullSql);
console.log(`Generated SQL for ${questions.length} questions.`);
