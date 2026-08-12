import { read, utils, writeFile } from 'xlsx';
import { BlankQuestion, OddOneOutQuestion, WordAnalogyQuestion, CustomMcqQuestion, ExamQuestion } from '../types';

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
