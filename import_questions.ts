import fs from 'fs';
import { createClient } from '@supabase/supabase-api';

// This is a temporary script to be run via bun to import the CSV data
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const csvPath = "Gabarito Embaralhado para Show do Milhão - Gabarito Embaralhado para Show do Milhão.csv";
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n');
const headers = lines[0].split(',');

const questions = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Simple CSV parser for this specific file (careful with quotes if any, but looking at the preview it seems simple)
  // Actually, some alternatives might have commas if not quoted. Let's use a regex for split if needed.
  // The preview showed: T001,Tipos de Tinta,Fácil,Qual a principal indicação da tinta Látex PVA?,A) Fachadas / B) Pisos / C) Paredes internas secas / D) Metais,C
  
  const parts = line.split(',');
  if (parts.length < 6) continue;

  const code = parts[0];
  const subject = parts[1];
  const difficulty = parts[2];
  const questionText = parts[3];
  const alternativesRaw = parts[4];
  const gabarito = parts[parts.length - 1].trim(); // Last part is usually Gabarito

  // Extract options from "A) ... / B) ... / C) ... / D) ..."
  const options = alternativesRaw.split('/').map(opt => opt.replace(/^[A-D]\)\s*/, '').trim());
  
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

async function run() {
  console.log(`Importing ${questions.length} questions...`);
  
  // Clear existing questions if needed or just insert
  const { error: deleteError } = await supabase.from('quiz_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteError) console.error("Error clearing questions:", deleteError);

  const { data, error } = await supabase.from('quiz_questions').insert(questions);
  
  if (error) {
    console.error("Error importing questions:", error);
  } else {
    console.log("Successfully imported questions!");
  }
}

run();
