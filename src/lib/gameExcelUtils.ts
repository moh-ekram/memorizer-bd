import { read, utils, writeFile } from 'xlsx';
import { BlankQuestion, OddOneOutQuestion, WordAnalogyQuestion, CustomMcqQuestion, ExamQuestion, QuestionBankItem, VocabularyWord } from '../types';

/**
 * Normalizes text for matching (lowercase, trims whitespace, removes hidden unicode)
 */
export function cleanText(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ');
}

export const DEFAULT_EXPLANATION = 'সঠিক উত্তরের ব্যাখ্যা শীঘ্রই সংযুক্ত করা হবে।';

export interface ParsedQuestionRow {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

/**
 * Flexible Question Row Parser
 * Handles:
 * - Col 0: ID (optional) or Question
 * - Col 1-4: Options
 * - Answer: Col 5 OR marked with `#` in option
 * - Explanation: Col 6 OR default text
 */
export function parseGenericQuestionRow(row: any[], rowIdx: number, hasHeader: boolean, prefix = 'q'): ParsedQuestionRow | null {
  if (!row || row.length < 2) return null;

  let id = cleanText(row[0]);
  let question = cleanText(row[1]);

  // If row[0] is long text and row[1] is option/empty, row[0] is question
  if (!question && id && id.length > 5) {
    question = id;
    id = '';
  }

  if (!question) return null;

  if (!id) {
    id = `${prefix}-${Date.now()}-${rowIdx + 1}-${Math.random().toString(36).substr(2, 4)}`;
  }

  const options: string[] = [];
  let hashAnswer = '';

  // Determine start column for options
  const startCol = (row[0] === id && question === cleanText(row[1])) ? 2 : 1;

  for (let col = startCol; col < startCol + 4; col++) {
    const val = cleanText(row[col]);
    if (val) {
      if (val.includes('#')) {
        const cleaned = val.replace(/#/g, '').trim();
        options.push(cleaned);
        hashAnswer = cleaned;
      } else {
        options.push(val);
      }
    }
  }

  if (options.length < 2) return null;

  const colAnsVal = cleanText(row[startCol + 4]);
  let answer = hashAnswer;

  if (!answer && colAnsVal) {
    const numIdx = parseInt(colAnsVal, 10);
    if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= options.length) {
      answer = options[numIdx - 1];
    } else if (/^[a-eA-E]$/.test(colAnsVal)) {
      const idx = colAnsVal.toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && idx < options.length) answer = options[idx];
    } else {
      const matched = options.find(o => cleanText(o).toLowerCase() === colAnsVal.toLowerCase());
      if (matched) answer = matched;
      else {
        const partial = options.find(o => o.toLowerCase().includes(colAnsVal.toLowerCase()));
        answer = partial || options[0];
      }
    }
  }

  if (!answer) {
    answer = options[0]; // Fallback to first option if no answer specified
  }

  const explanationColVal = cleanText(row[startCol + 5]);
  const explanation = explanationColVal || DEFAULT_EXPLANATION;

  return {
    id,
    question,
    options,
    answer,
    explanation
  };
}

// ==========================================
// 1. BLANK FILLING GAME EXCEL UTILS
// ==========================================

export function downloadBlankExcelTemplate() {
  const sampleData = [
    [
      'Unique ID',
      'Sentence / Question (প্রশ্ন)',
      'Option 1 (অপশন ১)',
      'Option 2 (অপশন ২)',
      'Option 3 (অপশন ৩)',
      'Option 4 (অপশন ৪)',
      'Answer (উত্তর - ঐচ্ছিক যদি # থাকে)',
      'Explanation (ব্যাখ্যা - ঐচ্ছিক)'
    ],
    [
      'blank_001',
      'The professor\'s lecture was so _____ that many students fell asleep.',
      'engaging',
      'soporific',
      'dynamic',
      'vivid',
      'soporific',
      'Soporific means causing or tending to induce sleep.'
    ],
    [
      'blank_002',
      'তার আচরণে প্রকাশ পেল এক ধরনের _____ ভাব।',
      'কঠোর',
      'কোমল#',
      'উগ্র',
      'চঞ্চল',
      '', // Answer column left blank because # marks Option 2
      ''  // Explanation left blank to use default
    ]
  ];

  const ws = utils.aoa_to_sheet(sampleData);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Blank_Filling_Questions');
  writeFile(wb, 'Blank_Filling_Questions_Template.xlsx');
}

export async function parseBlankExcel(file: File, courseId: string): Promise<{ questions: BlankQuestion[]; notices: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!rawRows || rawRows.length === 0) {
          return resolve({ questions: [], notices: ['Selected Excel sheet is completely empty.'] });
        }

        const questions: BlankQuestion[] = [];
        const notices: string[] = [];

        const row0 = rawRows[0] || [];
        const r0Str = row0.map(c => cleanText(c).toLowerCase()).join(' ');
        const hasHeader = r0Str.includes('sentence') || r0Str.includes('question') || r0Str.includes('option') || r0Str.includes('প্রশ্ন') || r0Str.includes('id');
        const startIdx = hasHeader ? 1 : 0;

        for (let i = startIdx; i < rawRows.length; i++) {
          const parsed = parseGenericQuestionRow(rawRows[i], i, hasHeader, 'blank');
          if (!parsed) {
            if (rawRows[i] && rawRows[i].length > 1) {
              notices.push(`Row ${i + 1}: Could not parse question or missing options.`);
            }
            continue;
          }

          questions.push({
            id: parsed.id,
            sentence: parsed.question,
            options: parsed.options,
            answer: parsed.answer,
            explanation: parsed.explanation,
            courseId,
            createdAt: new Date().toISOString()
          });
        }

        resolve({ questions, notices });
      } catch (err: any) {
        resolve({ questions: [], notices: [`Excel parsing error: ${err?.message || 'Invalid file format'}`] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ==========================================
// 2. ODD ONE OUT GAME EXCEL UTILS
// ==========================================

export function downloadOooExcelTemplate() {
  const sampleData = [
    [
      'Unique ID',
      'Word 1 (শব্দ ১)',
      'Word 2 (শব্দ ২)',
      'Word 3 (শব্দ ৩)',
      'Word 4 (শব্দ ৪)',
      'Odd Word / Answer (উত্তর - ঐচ্ছিক যদি # থাকে)',
      'Explanation (ব্যাখ্যা - ঐচ্ছিক)'
    ],
    [
      'ooo_001',
      'Apple',
      'Banana',
      'Carrot#',
      'Mango',
      '',
      'Carrot is a vegetable, while the others are fruits.'
    ],
    [
      'ooo_002',
      'Dog',
      'Cat',
      'Elephant',
      'Eagle',
      'Eagle',
      'Eagle is a bird, while the rest are mammals.'
    ]
  ];

  const ws = utils.aoa_to_sheet(sampleData);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Odd_One_Out_Questions');
  writeFile(wb, 'Odd_One_Out_Questions_Template.xlsx');
}

export async function parseOooExcel(file: File, courseId: string): Promise<{ questions: OddOneOutQuestion[]; notices: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!rawRows || rawRows.length === 0) {
          return resolve({ questions: [], notices: ['Selected Excel sheet is completely empty.'] });
        }

        const questions: OddOneOutQuestion[] = [];
        const notices: string[] = [];

        const row0 = rawRows[0] || [];
        const r0Str = row0.map(c => cleanText(c).toLowerCase()).join(' ');
        const hasHeader = r0Str.includes('word') || r0Str.includes('option') || r0Str.includes('odd') || r0Str.includes('শব্দ') || r0Str.includes('id');
        const startIdx = hasHeader ? 1 : 0;

        for (let i = startIdx; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length < 4) continue;

          let id = cleanText(row[0]);
          const wordsList: string[] = [];
          let hashAnswer = '';

          let startCol = 1;
          if (!id && row.length >= 4) {
            startCol = 0;
          } else if (id && id.length >= 15 && !id.toLowerCase().includes('ooo')) {
            wordsList.push(id.replace(/#/g, '').trim());
            if (id.includes('#')) hashAnswer = id.replace(/#/g, '').trim();
            id = '';
            startCol = 1;
          }

          for (let col = startCol; col < startCol + 4; col++) {
            const val = cleanText(row[col]);
            if (val) {
              if (val.includes('#')) {
                const cleaned = val.replace(/#/g, '').trim();
                wordsList.push(cleaned);
                hashAnswer = cleaned;
              } else {
                wordsList.push(val);
              }
            }
          }

          if (wordsList.length < 4) {
            notices.push(`Row ${i + 1}: Required exactly 4 words, found ${wordsList.length}.`);
            continue;
          }

          if (!id) {
            id = `ooo-${Date.now()}-${i + 1}-${Math.random().toString(36).substr(2, 4)}`;
          }

          let answer = hashAnswer;
          const ansCol = cleanText(row[startCol + 4]);

          if (!answer && ansCol) {
            const numIdx = parseInt(ansCol, 10);
            if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= wordsList.length) {
              answer = wordsList[numIdx - 1];
            } else {
              const matched = wordsList.find(w => cleanText(w).toLowerCase() === ansCol.toLowerCase());
              answer = matched || wordsList[3];
            }
          }

          if (!answer) {
            answer = wordsList[3];
          }

          const reason = cleanText(row[startCol + 5]) || DEFAULT_EXPLANATION;

          questions.push({
            id,
            words: wordsList.slice(0, 4),
            answer,
            reason,
            courseId,
            createdAt: new Date().toISOString()
          });
        }

        resolve({ questions, notices });
      } catch (err: any) {
        resolve({ questions: [], notices: [`Excel parsing error: ${err?.message || 'Invalid file format'}`] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ==========================================
// 3. WORD ANALOGY GAME EXCEL UTILS
// ==========================================

export function downloadAnalogyExcelTemplate() {
  const sampleData = [
    [
      'Unique ID',
      'Target Pair / Question (প্রশ্ন)',
      'Option 1 Pair (অপশন ১)',
      'Option 2 Pair (অপশন ২)',
      'Option 3 Pair (অপশন ৩)',
      'Option 4 Pair (অপশন ৪)',
      'Answer (উত্তর - ঐচ্ছিক যদি # থাকে)',
      'Explanation (ব্যাখ্যা - ঐচ্ছিক)'
    ],
    [
      'ana_001',
      'LIGHT : BLIND',
      'speech : deaf#',
      'tongue : sound',
      'language : dumb',
      'hearing : inaudible',
      '',
      'Light cannot be perceived by the blind; speech cannot be perceived by the deaf.'
    ],
    [
      'ana_002',
      'ARCHITECT : BUILDING',
      'sculptor : statue',
      'poet : pen',
      'composer : music',
      'teacher : student',
      '1',
      'An architect designs a building; a sculptor creates a statue.'
    ]
  ];

  const ws = utils.aoa_to_sheet(sampleData);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Word_Analogy_Questions');
  writeFile(wb, 'Word_Analogy_Questions_Template.xlsx');
}

export async function parseAnalogyExcel(file: File, courseId: string): Promise<{ questions: WordAnalogyQuestion[]; notices: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!rawRows || rawRows.length === 0) {
          return resolve({ questions: [], notices: ['Selected Excel sheet is completely empty.'] });
        }

        const questions: WordAnalogyQuestion[] = [];
        const notices: string[] = [];

        const row0 = rawRows[0] || [];
        const r0Str = row0.map(c => cleanText(c).toLowerCase()).join(' ');
        const hasHeader = r0Str.includes('analogy') || r0Str.includes('stem') || r0Str.includes('pair') || r0Str.includes('question') || r0Str.includes('প্রশ্ন');
        const startIdx = hasHeader ? 1 : 0;

        for (let i = startIdx; i < rawRows.length; i++) {
          const parsed = parseGenericQuestionRow(rawRows[i], i, hasHeader, 'ana');
          if (!parsed) continue;

          questions.push({
            id: parsed.id,
            analogy: parsed.question,
            options: parsed.options,
            answer: parsed.answer,
            explanation: parsed.explanation,
            courseId,
            createdAt: new Date().toISOString()
          });
        }

        resolve({ questions, notices });
      } catch (err: any) {
        resolve({ questions: [], notices: [`Excel parsing error: ${err?.message || 'Invalid file format'}`] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function downloadExamExcelTemplate() {
  const sampleData = [
    [
      'Unique ID',
      'Question Text (প্রশ্ন)',
      'Option 1 (অপশন ১)',
      'Option 2 (অপশন ২)',
      'Option 3 (অপশন ৩)',
      'Option 4 (অপশন ৪)',
      'Answer (উত্তর - ঐচ্ছিক যদি # থাকে)',
      'Explanation (ব্যাখ্যা - ঐচ্ছিক)'
    ],
    [
      'exam_001',
      'An explicit order was given to the team.',
      'Clear#',
      'Vague',
      'Hidden',
      'Implicit',
      '',
      'Explicit means clearly stated and easy to understand.'
    ],
    [
      'exam_002',
      'What is the antonym of "Artificial"?',
      'Natural',
      'Fake',
      'Synthetic',
      'Man-made',
      'Natural',
      'Natural is the direct antonym of artificial.'
    ]
  ];

  const ws = utils.aoa_to_sheet(sampleData);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Exam_Questions');
  writeFile(wb, 'Online_Exam_Template.xlsx');
}

export async function parseExamExcel(file: File, courseId?: string): Promise<{ questions: ExamQuestion[]; notices: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!rawRows || rawRows.length === 0) {
          return resolve({ questions: [], notices: ['Selected Excel sheet is completely empty.'] });
        }

        const questions: ExamQuestion[] = [];
        const notices: string[] = [];

        const row0 = rawRows[0] || [];
        const r0Str = row0.map(c => cleanText(c).toLowerCase()).join(' ');
        const hasHeader = r0Str.includes('question') || r0Str.includes('option') || r0Str.includes('id') || r0Str.includes('প্রশ্ন');
        const startIdx = hasHeader ? 1 : 0;

        for (let i = startIdx; i < rawRows.length; i++) {
          const parsed = parseGenericQuestionRow(rawRows[i], i, hasHeader, 'exam');
          if (!parsed) continue;

          questions.push({
            id: parsed.id,
            question: parsed.question,
            options: parsed.options,
            answer: parsed.answer,
            explanation: parsed.explanation
          });
        }

        resolve({ questions, notices });
      } catch (err: any) {
        resolve({ questions: [], notices: [`Excel parsing error: ${err?.message || 'Invalid file format'}`] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ==========================================
// 4. MCQ QUIZ EXCEL UTILS
// ==========================================

export function downloadMcqExcelTemplate() {
  const sampleData = [
    [
      'Unique ID',
      'Question Text (প্রশ্ন)',
      'Option 1 (অপশন ১)',
      'Option 2 (অপশন ২)',
      'Option 3 (অপশন ৩)',
      'Option 4 (অপশন ৪)',
      'Answer (উত্তর - ঐচ্ছিক যদি # থাকে)',
      'Explanation (ব্যাখ্যা - ঐচ্ছিক)'
    ],
    [
      'mcq_001',
      'What is the synonym of "Ubiquitous"?',
      'Rare',
      'Omnipresent',
      'Hidden',
      'Temporary',
      'Omnipresent',
      'Ubiquitous means present, appearing, or found everywhere.'
    ],
    [
      'mcq_002',
      'কোনটি কাজী নজরুল ইসলামের রচনা?',
      'অগ্নিবীণা#',
      'গীতাঞ্জলি',
      'সোনার তরী',
      'রক্তকরবী',
      '',
      'অগ্নিবীণা কাজী নজরুল ইসলামের বিখ্যাত কাব্যগ্রন্থ।'
    ]
  ];

  const ws = utils.aoa_to_sheet(sampleData);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'MCQ_Questions');
  writeFile(wb, 'MCQ_Questions_Template.xlsx');
}

export async function parseMcqExcel(file: File, courseId: string): Promise<{ questions: CustomMcqQuestion[]; notices: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!rawRows || rawRows.length === 0) {
          return resolve({ questions: [], notices: ['Selected Excel sheet is completely empty.'] });
        }

        const questions: CustomMcqQuestion[] = [];
        const notices: string[] = [];

        const row0 = rawRows[0] || [];
        const r0Str = row0.map(c => cleanText(c).toLowerCase()).join(' ');
        const hasHeader = r0Str.includes('question') || r0Str.includes('option') || r0Str.includes('id') || r0Str.includes('প্রশ্ন');
        const startIdx = hasHeader ? 1 : 0;

        for (let i = startIdx; i < rawRows.length; i++) {
          const parsed = parseGenericQuestionRow(rawRows[i], i, hasHeader, 'mcq');
          if (!parsed) continue;

          questions.push({
            id: parsed.id,
            question: parsed.question,
            options: parsed.options,
            answer: parsed.answer,
            explanation: parsed.explanation,
            courseId,
            createdAt: new Date().toISOString()
          });
        }

        resolve({ questions, notices });
      } catch (err: any) {
        resolve({ questions: [], notices: [`Excel parsing error: ${err?.message || 'Invalid file format'}`] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ==========================================
// 5. MULTI-SHEET EXCEL UPLOADER FOR ALL GAMES & EXAMS
// ==========================================

export function downloadAllGamesMultiSheetTemplate() {
  const wb = utils.book_new();

  // 1. Blank Filling Sheet
  const blankSheetData = [
    ['Unique ID', 'Sentence / Question', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Answer (Optional if # used)', 'Explanation (Optional)'],
    ['blank_01', 'He is _____ in English grammar.', 'proficient#', 'weak', 'ignorant', 'foolish', '', 'Proficient means highly competent.'],
    ['blank_02', 'The sun _____ in the east.', 'rises', 'sets', 'shines', 'moves', 'rises', 'Universal truth in present simple.']
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(blankSheetData), 'Blank Filling');

  // 2. Odd One Out Sheet
  const oooSheetData = [
    ['Unique ID', 'Word 1', 'Word 2', 'Word 3', 'Word 4', 'Odd Word / Answer (Optional if # used)', 'Explanation (Optional)'],
    ['ooo_01', 'Apple', 'Banana', 'Carrot#', 'Mango', '', 'Carrot is a vegetable.'],
    ['ooo_02', 'Dog', 'Cat', 'Eagle', 'Cow', 'Eagle', 'Eagle is a bird.']
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(oooSheetData), 'Odd One Out');

  // 3. Word Analogy Sheet
  const analogySheetData = [
    ['Unique ID', 'Target Pair (Question)', 'Option 1 Pair', 'Option 2 Pair', 'Option 3 Pair', 'Option 4 Pair', 'Correct Pair (Optional if # used)', 'Explanation (Optional)'],
    ['ana_01', 'LIGHT : BLIND', 'speech : deaf#', 'tongue : sound', 'language : dumb', 'hearing : inaudible', '', 'Deaf cannot perceive speech.'],
    ['ana_02', 'DOCTOR : HOSPITAL', 'teacher : school', 'lawyer : court', 'pilot : plane', 'chef : kitchen', 'teacher : school', 'Workplace relationship.']
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(analogySheetData), 'Word Analogy');

  // 4. MCQ Quiz Sheet
  const mcqSheetData = [
    ['Unique ID', 'Question Text', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Answer (Optional if # used)', 'Explanation (Optional)'],
    ['mcq_01', 'Capital of Bangladesh?', 'Dhaka#', 'Chittagong', 'Sylhet', 'Rajshahi', '', 'Dhaka is the capital city.'],
    ['mcq_02', 'Synonym of Enormous?', 'Gigantic', 'Tiny', 'Small', 'Slight', 'Gigantic', 'Enormous means extremely large.']
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(mcqSheetData), 'MCQ Quiz');

  // 5. Exam Sheet
  const examSheetData = [
    ['Unique ID', 'Question Text', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Answer (Optional if # used)', 'Explanation (Optional)'],
    ['exam_01', 'An explicit order was given to the team.', 'Clear#', 'Vague', 'Hidden', 'Implicit', '', 'Explicit means clearly stated.'],
    ['exam_02', 'Antonym of Artificial?', 'Natural', 'Fake', 'Synthetic', 'Man-made', 'Natural', 'Natural is the opposite of artificial.']
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(examSheetData), 'Exam');

  writeFile(wb, 'Multi_Game_And_Exam_Upload_Template.xlsx');
}

export interface MultiSheetParseResult {
  blankQs: BlankQuestion[];
  oooQs: OddOneOutQuestion[];
  analogyQs: WordAnalogyQuestion[];
  mcqQs: CustomMcqQuestion[];
  examQs: ExamQuestion[];
  notices: string[];
  sheetSummary: Record<string, number>;
}

export async function parseMultiSheetGamesExcel(file: File, courseId: string): Promise<MultiSheetParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = read(data, { type: 'array' });

        const result: MultiSheetParseResult = {
          blankQs: [],
          oooQs: [],
          analogyQs: [],
          mcqQs: [],
          examQs: [],
          notices: [],
          sheetSummary: {}
        };

        wb.SheetNames.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          if (!ws) return;

          const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];
          if (!rawRows || rawRows.length === 0) return;

          const cleanSheetName = sheetName.toLowerCase().trim();

          const row0 = rawRows[0] || [];
          const r0Str = row0.map(c => cleanText(c).toLowerCase()).join(' ');
          const hasHeader = r0Str.includes('sentence') || r0Str.includes('question') || r0Str.includes('option') || r0Str.includes('word') || r0Str.includes('প্রশ্ন') || r0Str.includes('pair');
          const startIdx = hasHeader ? 1 : 0;

          let count = 0;

          // 1. Check if Blank Filling sheet
          if (cleanSheetName.includes('blank') || cleanSheetName.includes('filling') || cleanSheetName.includes('শূন্যস্থান')) {
            for (let i = startIdx; i < rawRows.length; i++) {
              const parsed = parseGenericQuestionRow(rawRows[i], i, hasHeader, 'blank');
              if (parsed) {
                result.blankQs.push({
                  id: parsed.id,
                  sentence: parsed.question,
                  options: parsed.options,
                  answer: parsed.answer,
                  explanation: parsed.explanation,
                  courseId,
                  createdAt: new Date().toISOString()
                });
                count++;
              }
            }
            result.sheetSummary[`Sheet '${sheetName}' (Blank Filling)`] = count;
          }
          // 2. Check if Odd One Out sheet
          else if (cleanSheetName.includes('odd') || cleanSheetName.includes('out') || cleanSheetName.includes('ভিন্ন')) {
            for (let i = startIdx; i < rawRows.length; i++) {
              const row = rawRows[i];
              if (!row || row.length < 4) continue;
              let id = cleanText(row[0]);
              const wordsList: string[] = [];
              let hashAnswer = '';
              let startCol = (!id || id.length > 12) ? 0 : 1;

              for (let c = startCol; c < startCol + 4; c++) {
                const val = cleanText(row[c]);
                if (val) {
                  if (val.includes('#')) {
                    const cleaned = val.replace(/#/g, '').trim();
                    wordsList.push(cleaned);
                    hashAnswer = cleaned;
                  } else {
                    wordsList.push(val);
                  }
                }
              }

              if (wordsList.length >= 4) {
                const ansCol = cleanText(row[startCol + 4]);
                let answer = hashAnswer || ansCol || wordsList[3];
                const reason = cleanText(row[startCol + 5]) || DEFAULT_EXPLANATION;
                result.oooQs.push({
                  id: id || `ooo-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
                  words: wordsList.slice(0, 4),
                  answer,
                  reason,
                  courseId,
                  createdAt: new Date().toISOString()
                });
                count++;
              }
            }
            result.sheetSummary[`Sheet '${sheetName}' (Odd One Out)`] = count;
          }
          // 3. Check if Word Analogy sheet
          else if (cleanSheetName.includes('analogy') || cleanSheetName.includes('pair') || cleanSheetName.includes('এনালজি')) {
            for (let i = startIdx; i < rawRows.length; i++) {
              const parsed = parseGenericQuestionRow(rawRows[i], i, hasHeader, 'ana');
              if (parsed) {
                result.analogyQs.push({
                  id: parsed.id,
                  analogy: parsed.question,
                  options: parsed.options,
                  answer: parsed.answer,
                  explanation: parsed.explanation,
                  courseId,
                  createdAt: new Date().toISOString()
                });
                count++;
              }
            }
            result.sheetSummary[`Sheet '${sheetName}' (Word Analogy)`] = count;
          }
          // 4. Check if Exam sheet
          else if (cleanSheetName.includes('exam') || cleanSheetName.includes('test') || cleanSheetName.includes('পরীক্ষা')) {
            for (let i = startIdx; i < rawRows.length; i++) {
              const parsed = parseGenericQuestionRow(rawRows[i], i, hasHeader, 'exam');
              if (parsed) {
                result.examQs.push({
                  id: parsed.id,
                  question: parsed.question,
                  options: parsed.options,
                  answer: parsed.answer,
                  explanation: parsed.explanation
                });
                count++;
              }
            }
            result.sheetSummary[`Sheet '${sheetName}' (Exam)`] = count;
          }
          // 5. Default/MCQ Quiz sheet
          else {
            for (let i = startIdx; i < rawRows.length; i++) {
              const parsed = parseGenericQuestionRow(rawRows[i], i, hasHeader, 'mcq');
              if (parsed) {
                result.mcqQs.push({
                  id: parsed.id,
                  question: parsed.question,
                  options: parsed.options,
                  answer: parsed.answer,
                  explanation: parsed.explanation,
                  courseId,
                  createdAt: new Date().toISOString()
                });
                count++;
              }
            }
            result.sheetSummary[`Sheet '${sheetName}' (MCQ Quiz)`] = count;
          }
        });

        resolve(result);
      } catch (err: any) {
        resolve({
          blankQs: [],
          oooQs: [],
          analogyQs: [],
          mcqQs: [],
          examQs: [],
          notices: [`Multi-sheet Excel parsing error: ${err?.message || 'Invalid file format'}`],
          sheetSummary: {}
        });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ==========================================
// QUESTION BANK EXCEL UTILS
// ==========================================

export interface QuestionBankDynamicFilterLabels {
  filter1?: string;
  filter2?: string;
  filter3?: string;
}

export interface QuestionBankParseResultArray extends Array<QuestionBankItem> {
  filterLabels?: QuestionBankDynamicFilterLabels;
  notices?: string[];
}

export function downloadQuestionBankExcelTemplate(customLabels?: QuestionBankDynamicFilterLabels) {
  const f1Label = customLabels?.filter1?.trim() || 'Suitable Course';
  const f2Label = customLabels?.filter2?.trim() || 'Q.Type';
  const f3Label = customLabels?.filter3?.trim() || 'Others';

  const sampleData = [
    [
      'Id',
      'Question',
      'Opt1',
      'Opt2',
      'Opt3',
      'Opt4',
      'Ans (Optional if # used in option)',
      'Explanation (Optional)',
      `Filter1: ${f1Label}`,
      `Filter2: ${f2Label}`,
      `Filter3: ${f3Label}`
    ],
    [
      'qb-101',
      'An explicit order was given to the team. What does "explicit" mean?',
      'Clear and direct#',
      'Vague and hidden',
      'Complicated',
      'Optional',
      '', // Answer left blank because # is placed in Option 1
      'Explicit means clear, precise, and leaving no room for doubt.',
      'BCS English',
      'Vocabulary',
      '2026'
    ],
    [
      'qb-102',
      'কোনটি কাজী নজরুল ইসলামের প্রথম কাব্যগ্রন্থ?',
      'অগ্নিবীণা',
      'সোনার তরী',
      'গীতাঞ্জলি',
      'কবর',
      'A', // Or option text 'অগ্নিবীণা'
      'অগ্নিবীণা কাজী নজরুল ইসলামের প্রথম প্রকাশিত কাব্যগ্রন্থ (১৯২২)।',
      'বাংলা সাহিত্য',
      'কাব্যগ্রন্থ',
      'বিসিএস প্রিলিমিনারি'
    ],
    [
      'qb-103',
      'Analogy: LIGHT : BLIND :: SOUND : ?',
      'Deaf#',
      'Silence',
      'Quiet',
      'Noise',
      '',
      'Deaf lacks hearing sound, just as blind lacks seeing light.',
      'IELTS',
      'Analogy',
      'Important'
    ],
    [
      'qb-104',
      'কোন বানানটি সঠিক?',
      'স্বায়ত্তশাসন#',
      'স্বায়ত্বশাসন',
      'সায়ত্বশাসন',
      'স্বায়ত্ব শাসন',
      '',
      'সঠিক বানান হলো "স্বায়ত্তশাসন"।',
      'বাংলা ব্যাকরণ',
      'শুদ্ধ বানান',
      'সাধারণ'
    ]
  ];

  const ws = utils.aoa_to_sheet(sampleData);
  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Id
    { wch: 50 }, // Question
    { wch: 22 }, // Opt1
    { wch: 22 }, // Opt2
    { wch: 22 }, // Opt3
    { wch: 22 }, // Opt4
    { wch: 28 }, // Ans
    { wch: 45 }, // Explanation
    { wch: 24 }, // Filter1
    { wch: 24 }, // Filter2
    { wch: 24 }  // Filter3
  ];

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Question Bank");
  writeFile(wb, "Question_Bank_Template.xlsx");
}

export function exportQuestionBankToExcel(
  questions: QuestionBankItem[], 
  fileName = 'Question_Bank_Export.xlsx',
  customLabels?: QuestionBankDynamicFilterLabels
) {
  const f1Label = customLabels?.filter1?.trim() || 'Suitable Course';
  const f2Label = customLabels?.filter2?.trim() || 'Q.Type';
  const f3Label = customLabels?.filter3?.trim() || 'Others';

  const headers = [
    'Id',
    'Question',
    'Opt1',
    'Opt2',
    'Opt3',
    'Opt4',
    'Ans',
    'Explanation',
    `Filter1: ${f1Label}`,
    `Filter2: ${f2Label}`,
    `Filter3: ${f3Label}`
  ];

  const rows = questions.map((q, idx) => {
    const optA = (q as any).options?.[0] ?? q.optionA ?? '';
    const optB = (q as any).options?.[1] ?? q.optionB ?? '';
    const optC = (q as any).options?.[2] ?? q.optionC ?? '';
    const optD = (q as any).options?.[3] ?? q.optionD ?? '';
    
    let ans = q.correctAnswer || 'A';

    return [
      q.id || `qb-${idx + 101}`,
      q.question || '',
      optA,
      optB,
      optC,
      optD,
      ans,
      q.explanation || '',
      q.group1 || 'General',
      q.group2 || 'General',
      q.group3 || 'General'
    ];
  });

  const exportData = [headers, ...rows];
  const ws = utils.aoa_to_sheet(exportData);

  // Set column widths
  ws['!cols'] = [
    { wch: 14 },
    { wch: 50 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 45 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 }
  ];

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Question Bank");
  writeFile(wb, fileName);
}

export async function parseQuestionBankExcel(file: File): Promise<QuestionBankParseResultArray> {
  const data = await file.arrayBuffer();
  const workbook = read(data);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = utils.sheet_to_json(sheet, { header: 1 });

  if (!rows || rows.length < 2) {
    const emptyResult: QuestionBankParseResultArray = [];
    return emptyResult;
  }

  const questions: QuestionBankItem[] = [];
  const rawHeaders = rows[0].map(c => cleanText(c));
  const lowerHeaders = rawHeaders.map(c => c.toLowerCase());

  // Precise column match helper
  const findColExact = (keywords: string[]) => {
    return lowerHeaders.findIndex(h => keywords.some(k => {
      const cleanK = k.toLowerCase().trim();
      return h === cleanK || h.includes(cleanK);
    }));
  };

  // 1. Check for dynamic Filter1:label, Filter2:label, Filter3:label
  const detectedFilterLabels: QuestionBankDynamicFilterLabels = {};
  let g1Col = -1;
  let g2Col = -1;
  let g3Col = -1;

  rawHeaders.forEach((rawH, idx) => {
    const f1Match = rawH.match(/^filter\s*#?\s*1\s*[:=\-]\s*(.*)$/i) || rawH.match(/^filter\s*1$/i);
    if (f1Match) {
      g1Col = idx;
      if (f1Match[1]?.trim()) detectedFilterLabels.filter1 = f1Match[1].trim();
    }
    const f2Match = rawH.match(/^filter\s*#?\s*2\s*[:=\-]\s*(.*)$/i) || rawH.match(/^filter\s*2$/i);
    if (f2Match) {
      g2Col = idx;
      if (f2Match[1]?.trim()) detectedFilterLabels.filter2 = f2Match[1].trim();
    }
    const f3Match = rawH.match(/^filter\s*#?\s*3\s*[:=\-]\s*(.*)$/i) || rawH.match(/^filter\s*3$/i);
    if (f3Match) {
      g3Col = idx;
      if (f3Match[1]?.trim()) detectedFilterLabels.filter3 = f3Match[1].trim();
    }
  });

  if (g1Col < 0) g1Col = findColExact(['suitable course', 'suitable_course', 'suitablecourse', 'suitable', 'course', 'group 1', 'group1', 'subject', 'বিষয়', 'গ্রুপ ১', 'গ্রুপ১']);
  if (g2Col < 0) g2Col = findColExact(['q.type', 'q type', 'qtype', 'q_type', 'question type', 'q-type', 'type', 'group 2', 'group2', 'topic', 'অধ্যায়', 'টপিক', 'গ্রুপ ২', 'গ্রুপ২']);
  if (g3Col < 0) g3Col = findColExact(['others', 'other', 'group 3', 'group3', 'difficulty', 'category', 'tag', 'ক্যাটাগরি', 'গ্রুপ ৩', 'গ্রুপ৩', 'সাল', 'year']);

  // 2. Identify ID column (e.g. "Id", "Question ID", "SL")
  let idCol = findColExact(['id', 'question id', 'question_id', 'q_id', 'qid', 'serial', 'sl']);

  // 3. Identify Question Text column
  let questionCol = lowerHeaders.findIndex((h, idx) => {
    if (idx === idCol) return false;
    return h.includes('question') || h.includes('প্রশ্ন') || h.includes('sentence') || h.includes('title');
  });

  if (questionCol < 0) {
    if (idCol === 0 && lowerHeaders.length > 1) {
      questionCol = 1;
    } else {
      questionCol = findColExact(['question', 'প্রশ্ন']);
      if (questionCol === idCol) questionCol = idCol === 0 ? 1 : 0;
    }
  }

  // 4. Option columns
  let optACol = findColExact(['opt1', 'opt 1', 'option a', 'option 1', 'অপশন ক', 'অপশন ১', 'opt a', 'option_a', 'option1']);
  let optBCol = findColExact(['opt2', 'opt 2', 'option b', 'option 2', 'অপশন খ', 'অপশন ২', 'opt b', 'option_b', 'option2']);
  let optCCol = findColExact(['opt3', 'opt 3', 'option c', 'option 3', 'অপশন গ', 'অপশন ৩', 'opt c', 'option_c', 'option3']);
  let optDCol = findColExact(['opt4', 'opt 4', 'option d', 'option 4', 'অপশন ঘ', 'অপশন ৪', 'opt d', 'option_d', 'option4']);

  if (optACol < 0) optACol = lowerHeaders.findIndex(h => /^opt(ion)?\s*(1|a)$/i.test(h) || /^a$/i.test(h) || h === 'ক');
  if (optBCol < 0) optBCol = lowerHeaders.findIndex(h => /^opt(ion)?\s*(2|b)$/i.test(h) || /^b$/i.test(h) || h === 'খ');
  if (optCCol < 0) optCCol = lowerHeaders.findIndex(h => /^opt(ion)?\s*(3|c)$/i.test(h) || /^c$/i.test(h) || h === 'গ');
  if (optDCol < 0) optDCol = lowerHeaders.findIndex(h => /^opt(ion)?\s*(4|d)$/i.test(h) || /^d$/i.test(h) || h === 'ঘ');

  if (optACol < 0) optACol = Math.max(idCol, questionCol) + 1;
  if (optBCol < 0) optBCol = optACol + 1;
  if (optCCol < 0) optCCol = optBCol + 1;
  if (optDCol < 0) optDCol = optCCol + 1;

  const ansCol = findColExact(['ans', 'correct answer', 'correct_answer', 'correct', 'answer', 'সঠিক উত্তর', 'সঠিক', 'উত্তর']);
  const expCol = findColExact(['explanation', 'ব্যাখ্যা', 'exp']);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    let qText = questionCol >= 0 ? cleanText(row[questionCol]) : '';
    if (!qText && idCol >= 0 && idCol !== 0) {
      qText = cleanText(row[0]);
    }
    if (!qText) continue;

    let rawOptA = optACol >= 0 ? cleanText(row[optACol]) : '';
    let rawOptB = optBCol >= 0 ? cleanText(row[optBCol]) : '';
    let rawOptC = optCCol >= 0 ? cleanText(row[optCCol]) : '';
    let rawOptD = optDCol >= 0 ? cleanText(row[optDCol]) : '';

    // Support # in options to designate correct answer automatically
    let hashAns = '';
    const cleanOpt = (opt: string) => {
      if (opt.includes('#')) {
        const cleaned = opt.replace(/#/g, '').trim();
        hashAns = cleaned;
        return cleaned;
      }
      return opt;
    };

    const optA = cleanOpt(rawOptA);
    const optB = cleanOpt(rawOptB);
    const optC = cleanOpt(rawOptC);
    const optD = cleanOpt(rawOptD);

    if (!optA || !optB) continue;

    let idVal = idCol >= 0 ? cleanText(row[idCol]) : '';
    if (!idVal || idVal === qText) {
      idVal = `qb-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`;
    }

    let rawAns = ansCol >= 0 ? cleanText(row[ansCol]) : '';
    let finalAns = hashAns || rawAns || optA;

    if (!hashAns && rawAns) {
      if (/^[a-dA-D]$/.test(rawAns)) {
        const idx = rawAns.toUpperCase().charCodeAt(0) - 65;
        const optionsArr = [optA, optB, optC, optD];
        if (optionsArr[idx]) {
          finalAns = optionsArr[idx];
        }
      } else if (/^[1-4]$/.test(rawAns)) {
        const idx = parseInt(rawAns, 10) - 1;
        const optionsArr = [optA, optB, optC, optD];
        if (optionsArr[idx]) {
          finalAns = optionsArr[idx];
        }
      }
    }

    const expText = expCol >= 0 ? cleanText(row[expCol]) : DEFAULT_EXPLANATION;
    const group1 = g1Col >= 0 ? cleanText(row[g1Col]) : 'General';
    const group2 = g2Col >= 0 ? cleanText(row[g2Col]) : 'General';
    const group3 = g3Col >= 0 ? cleanText(row[g3Col]) : 'General';

    questions.push({
      id: idVal,
      question: qText,
      optionA: optA,
      optionB: optB,
      optionC: optC || 'N/A',
      optionD: optD || 'N/A',
      options: [optA, optB, optC || 'N/A', optD || 'N/A'],
      correctAnswer: finalAns,
      explanation: expText || DEFAULT_EXPLANATION,
      group1: group1 || 'General',
      group2: group2 || 'General',
      group3: group3 || 'General',
      createdAt: new Date().toISOString()
    });
  }

  const result: QuestionBankParseResultArray = questions;
  result.filterLabels = detectedFilterLabels;
  return result;
}

// ==========================================
// COURSE VOCABULARY EXCEL UTILS (Place#: label, id, group)
// ==========================================

export interface CourseExcelParseResult {
  words: VocabularyWord[];
  placeLabels: Record<string, string>;
  totalGroups: number;
  groupsList: (string | number)[];
  notices: string[];
  sheetSummary: Record<string, number>;
  suggestedTitle?: string;
  gameData?: {
    blankQs?: BlankQuestion[];
    oooQs?: OddOneOutQuestion[];
    analogyQs?: WordAnalogyQuestion[];
    mcqQs?: CustomMcqQuestion[];
    examQs?: ExamQuestion[];
  };
}

export function downloadCourseExcelTemplate(customLabels?: Record<string, string>) {
  const p1 = customLabels?.place1?.trim() || 'Word';
  const p2 = customLabels?.place2?.trim() || 'Meaning';
  const p3 = customLabels?.place3?.trim() || 'Example Sentence';
  const p4 = customLabels?.place4?.trim() || 'Derivatives';
  const p5 = customLabels?.place5?.trim() || 'Synonyms';
  const p6 = customLabels?.place6?.trim() || 'Mnemonic / Notes';

  const wb = utils.book_new();

  // 1. Vocabulary Words Sheet
  const wordsData = [
    [
      'id',
      'group',
      `Place1: ${p1}`,
      `Place2: ${p2}`,
      `Place3: ${p3}`,
      `Place4: ${p4}`,
      `Place5: ${p5}`,
      `Place6: ${p6}`
    ],
    [
      'w-101',
      1,
      'Benevolent',
      'দয়ালু / হিতৈষী',
      'He was a benevolent gentleman who donated his wealth to charity.',
      'Benevolence (noun)',
      'kind, generous, philanthropic, compassionate',
      'Bene = Good, Volent = Wish'
    ],
    [
      'w-102',
      1,
      'Pragmatic',
      'বাস্তবধর্মী / প্রয়োগিক',
      'She took a pragmatic approach to resolve the complex dilemma.',
      'Pragmatism (noun)',
      'practical, realistic, sensible, down-to-earth',
      'Pragmatic = Practical'
    ],
    [
      'w-103',
      1,
      'Lucid',
      'স্পষ্ট / সহজে বোধগম্য',
      'The teacher gave a lucid explanation that cleared all confusion.',
      'Lucidity (noun)',
      'clear, articulate, crystal-clear, intelligible',
      'Lucid = Light / Clarity'
    ],
    [
      'w-201',
      2,
      'Ephemeral',
      'ক্ষণস্থায়ী',
      'Fame in modern digital culture is often ephemeral.',
      'Ephemerality (noun)',
      'transient, fleeting, brief, short-lived',
      'E-phenomenon lasts only a moment'
    ],
    [
      'w-202',
      2,
      'Meticulous',
      'খুঁতখুঁতে / অত্যন্ত সতর্ক',
      'He conducted a meticulous audit of all financial records.',
      'Meticulously (adverb)',
      'diligent, scrupulous, thorough, precise',
      'Met-tic = pays attention to every tick'
    ]
  ];

  const wsWords = utils.aoa_to_sheet(wordsData);
  wsWords['!cols'] = [
    { wch: 10 }, // id
    { wch: 8 },  // group
    { wch: 22 }, // Place1
    { wch: 28 }, // Place2
    { wch: 45 }, // Place3
    { wch: 24 }, // Place4
    { wch: 35 }, // Place5
    { wch: 30 }  // Place6
  ];
  utils.book_append_sheet(wb, wsWords, 'Vocabulary Words');

  // 2. Blank Filling Sheet
  const blankSheetData = [
    ['Id', 'Sentence / Question', 'Opt1', 'Opt2', 'Opt3', 'Opt4', 'Ans (Optional if # used)', 'Explanation (Optional)'],
    ['bq-101', 'He is _____ in conversational English.', 'proficient#', 'weak', 'ignorant', 'foolish', '', 'Proficient means highly skilled.']
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(blankSheetData), 'Blank Filling');

  // 3. Odd One Out Sheet
  const oooSheetData = [
    ['Id', 'Opt1', 'Opt2', 'Opt3', 'Opt4', 'Ans (Optional if # used)', 'Explanation (Optional)'],
    ['ooo-101', 'Apple', 'Banana', 'Carrot#', 'Mango', '', 'Carrot is a vegetable, while others are fruits.']
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(oooSheetData), 'Odd One Out');

  // 4. Word Analogy Sheet
  const analogySheetData = [
    ['Id', 'Question / Pair', 'Opt1', 'Opt2', 'Opt3', 'Opt4', 'Ans (Optional if # used)', 'Explanation (Optional)'],
    ['ana-101', 'LIGHT : BLIND', 'speech : deaf#', 'tongue : sound', 'language : mute', 'hearing : loud', '', 'Deaf lacks perception of speech.']
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(analogySheetData), 'Word Analogy');

  // 5. MCQ Quiz Sheet
  const mcqSheetData = [
    ['Id', 'Question', 'Opt1', 'Opt2', 'Opt3', 'Opt4', 'Ans (Optional if # used)', 'Explanation (Optional)'],
    ['mcq-101', 'What is the synonym of Pragmatic?', 'Practical#', 'Idealistic', 'Impractical', 'Theoretical', '', 'Pragmatic means practical.']
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(mcqSheetData), 'MCQ Quiz');

  writeFile(wb, 'Course_Upload_Template.xlsx');
}

export async function parseCourseExcel(
  file: File | ArrayBuffer, 
  fallbackCourseId?: string,
  fileName = ''
): Promise<CourseExcelParseResult> {
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const workbook = read(data, { type: 'array' });

  const result: CourseExcelParseResult = {
    words: [],
    placeLabels: {},
    totalGroups: 1,
    groupsList: [],
    notices: [],
    sheetSummary: {},
    gameData: {
      blankQs: [],
      oooQs: [],
      analogyQs: [],
      mcqQs: [],
      examQs: []
    }
  };

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    result.notices.push('The Excel workbook contains no sheets.');
    return result;
  }

  // Derive suggested title from file name or first sheet name
  if (fileName) {
    result.suggestedTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[_\\-]+/g, ' ').trim();
  }

  // Find wordlist sheet: Look for "Words", "Vocabulary", "Course", or first sheet
  let wordSheetName = workbook.SheetNames.find(s => /word|vocab|course|শব্দ/i.test(s)) || workbook.SheetNames[0];
  const ws = workbook.Sheets[wordSheetName];
  if (!ws) {
    result.notices.push('Could not read words sheet.');
    return result;
  }

  const rawRows = utils.sheet_to_json(ws) as any[];
  if (!rawRows || rawRows.length === 0) {
    result.notices.push('The words sheet is empty.');
    return result;
  }

  // 1. Detect Place#: label and columns from header row
  const detectedPlaceLabels: Record<string, string> = {};
  const firstRowKeys = Object.keys(rawRows[0] || {});

  firstRowKeys.forEach(k => {
    const match = k.match(/^place\s*#?\s*([1-9][0-9]?)\s*[:=\-]\s*(.*)$/i) || k.match(/^place\s*#?\s*([1-9][0-9]?)$/i);
    if (match) {
      const num = match[1];
      const label = match[2]?.trim() || '';
      detectedPlaceLabels[`place${num}`] = label;
    }
  });

  // Assign defaults if label was blank
  if (!detectedPlaceLabels.place1) detectedPlaceLabels.place1 = 'Word';
  if (!detectedPlaceLabels.place2) detectedPlaceLabels.place2 = 'Meaning';
  if (!detectedPlaceLabels.place3) detectedPlaceLabels.place3 = 'Example Sentence';
  if (!detectedPlaceLabels.place4) detectedPlaceLabels.place4 = 'Derivatives';
  if (!detectedPlaceLabels.place5) detectedPlaceLabels.place5 = 'Synonyms';
  if (!detectedPlaceLabels.place6) detectedPlaceLabels.place6 = 'Mnemonic / Notes';

  result.placeLabels = detectedPlaceLabels;

  // Helper to find column keys
  const findRowKey = (rowKeys: string[], candidates: string[], placeNum?: number) => {
    if (placeNum) {
      const placeMatch = rowKeys.find(k => {
        return new RegExp(`^place\\s*#?\\s*${placeNum}(\\s*[:=\\-]|$|\\s)`, 'i').test(k);
      });
      if (placeMatch) return placeMatch;
    }
    return rowKeys.find(k => {
      const cleanK = cleanText(k).toLowerCase();
      return candidates.some(c => cleanK === c || cleanK.includes(c));
    });
  };

  const wordsList: VocabularyWord[] = [];
  const groupsSet = new Set<string | number>();

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    if (!row) continue;
    const rowKeys = Object.keys(row);

    const idKey = findRowKey(rowKeys, ['id', 'unique id', 'word id', 'sl', 'serial']);
    const groupKey = findRowKey(rowKeys, ['group', 'level', 'grp']);

    const wordKey = findRowKey(rowKeys, ['word', 'main word', 'english word', 'term'], 1);
    const meaningKey = findRowKey(rowKeys, ['meaning', 'bangla meaning', 'bengali meaning', 'definition'], 2);
    const exampleKey = findRowKey(rowKeys, ['example', 'example sentence', 'sentence'], 3);
    const extraWordKey = findRowKey(rowKeys, ['derivative', 'extra word', 'sub-header', 'derivatives'], 4);
    const synonymsKey = findRowKey(rowKeys, ['synonyms', 'synonym', 'similar words'], 5);
    const mnemonicKey = findRowKey(rowKeys, ['mnemonic', 'mnemonics', 'notes', 'note', 'personal note', 'trick'], 6);

    const baseWord = wordKey ? cleanText(row[wordKey]) : '';
    const meaning = meaningKey ? cleanText(row[meaningKey]) : '';

    if (!baseWord) continue;

    // Parse group: identify each row with its group number
    let group: string | number = 1;
    if (groupKey && row[groupKey] !== undefined && row[groupKey] !== null) {
      const rawGrp = cleanText(row[groupKey]);
      if (rawGrp) {
        const num = parseInt(rawGrp, 10);
        if (!isNaN(num) && String(num) === rawGrp) {
          group = num;
        } else {
          group = rawGrp;
        }
      }
    }

    groupsSet.add(group);

    let rawId = idKey ? cleanText(row[idKey]) : '';
    if (!rawId) {
      rawId = `w-${group}-${idx + 1}`;
    }

    wordsList.push({
      id: rawId,
      group,
      word: baseWord,
      meaning: meaning || 'N/A',
      example: exampleKey ? cleanText(row[exampleKey]) : '',
      extraWord: extraWordKey ? cleanText(row[extraWordKey]) : '',
      extraMeaning: '',
      synonyms: synonymsKey ? cleanText(row[synonymsKey]) : '',
      mnemonic: mnemonicKey ? cleanText(row[mnemonicKey]) : ''
    });
  }

  result.words = wordsList;
  result.totalGroups = Math.max(1, groupsSet.size);
  result.groupsList = Array.from(groupsSet);
  result.sheetSummary[`Words ('${wordSheetName}')`] = wordsList.length;

  // 2. Also parse any game sheets if present
  const cId = fallbackCourseId || 'course';
  workbook.SheetNames.forEach(sheetName => {
    if (sheetName === wordSheetName) return;
    const gws = workbook.Sheets[sheetName];
    if (!gws) return;
    const gRows = utils.sheet_to_json(gws, { header: 1 }) as any[][];
    if (!gRows || gRows.length === 0) return;

    const lowerName = sheetName.toLowerCase().trim();
    const hasHeader = gRows.length > 1;
    const startIdx = hasHeader ? 1 : 0;
    let count = 0;

    if (/blank|fill|শূন্যস্থান/i.test(lowerName)) {
      for (let i = startIdx; i < gRows.length; i++) {
        const parsed = parseGenericQuestionRow(gRows[i], i, hasHeader, 'blank');
        if (parsed) {
          result.gameData?.blankQs?.push({
            id: parsed.id,
            sentence: parsed.question,
            options: parsed.options,
            answer: parsed.answer,
            explanation: parsed.explanation,
            courseId: cId,
            createdAt: new Date().toISOString()
          });
          count++;
        }
      }
      result.sheetSummary[`${sheetName} (Blank)`] = count;
    } else if (/odd|ooo|ভিন্ন/i.test(lowerName)) {
      for (let i = startIdx; i < gRows.length; i++) {
        const r = gRows[i];
        if (!r || r.length < 4) continue;
        const wordsArr: string[] = [];
        let hashAns = '';
        let startCol = cleanText(r[0]).length > 15 ? 0 : 1;
        for (let c = startCol; c < startCol + 4; c++) {
          const v = cleanText(r[c]);
          if (v) {
            if (v.includes('#')) {
              const cl = v.replace(/#/g, '').trim();
              wordsArr.push(cl);
              hashAns = cl;
            } else {
              wordsArr.push(v);
            }
          }
        }
        if (wordsArr.length >= 4) {
          const ansCol = cleanText(r[startCol + 4]);
          result.gameData?.oooQs?.push({
            id: cleanText(r[0]) || `ooo-${Date.now()}-${i}`,
            words: wordsArr.slice(0, 4),
            answer: hashAns || ansCol || wordsArr[0],
            reason: cleanText(r[startCol + 5]) || DEFAULT_EXPLANATION,
            courseId: cId,
            createdAt: new Date().toISOString()
          });
          count++;
        }
      }
      result.sheetSummary[`${sheetName} (Odd One Out)`] = count;
    } else if (/analogy|analogies|এনালজি/i.test(lowerName)) {
      for (let i = startIdx; i < gRows.length; i++) {
        const parsed = parseGenericQuestionRow(gRows[i], i, hasHeader, 'analogy');
        if (parsed) {
          result.gameData?.analogyQs?.push({
            id: parsed.id,
            analogy: parsed.question,
            options: parsed.options,
            answer: parsed.answer,
            explanation: parsed.explanation,
            courseId: cId,
            createdAt: new Date().toISOString()
          });
          count++;
        }
      }
      result.sheetSummary[`${sheetName} (Analogy)`] = count;
    } else if (/mcq|quiz|প্রশ্ন/i.test(lowerName)) {
      for (let i = startIdx; i < gRows.length; i++) {
        const parsed = parseGenericQuestionRow(gRows[i], i, hasHeader, 'mcq');
        if (parsed) {
          result.gameData?.mcqQs?.push({
            id: parsed.id,
            question: parsed.question,
            options: parsed.options,
            answer: parsed.answer,
            explanation: parsed.explanation,
            courseId: cId,
            createdAt: new Date().toISOString()
          });
          count++;
        }
      }
      result.sheetSummary[`${sheetName} (MCQ)`] = count;
    }
  });

  return result;
}

