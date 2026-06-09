import fs from 'fs';

const csvPath = "gabarito_full.csv";
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n');

const questions = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const parts = line.split(',');
  if (parts.length < 6) continue;

  const code = parts[0];
  const subject = parts[1];
  const difficulty = parts[2];
  const questionText = parts[3];
  
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

// Group into chunks to avoid SQL query size limits
const CHUNK_SIZE = 50;
const sqlChunks = [];

for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
  const chunk = questions.slice(i, i + CHUNK_SIZE);
  const values = chunk.map(q => {
    const optionsJson = JSON.stringify(q.options).replace(/'/g, "''");
    const questionEscaped = q.question.replace(/'/g, "''");
    const subjectEscaped = q.subject ? q.subject.replace(/'/g, "''") : '';
    const codeEscaped = q.code ? q.code.replace(/'/g, "''") : '';
    const difficultyEscaped = q.difficulty ? q.difficulty.replace(/'/g, "''") : '';
    
    return `('${codeEscaped}', '${subjectEscaped}', '${difficultyEscaped}', '${questionEscaped}', '${optionsJson}'::jsonb, ${q.correct_option_index})`;
  }).join(',\n');
  
  sqlChunks.push(`INSERT INTO public.quiz_questions (code, subject, difficulty, question, options, correct_option_index) VALUES \n${values};`);
}

const fullSql = `DELETE FROM public.quiz_questions;\n` + sqlChunks.join('\n');

fs.writeFileSync('import_all_questions.sql', fullSql);
console.log(`Generated SQL for ${questions.length} questions in ${sqlChunks.length} chunks.`);
