import { read, utils, writeFile } from 'xlsx';
import { BlankQuestion, OddOneOutQuestion, WordAnalogyQuestion, CustomMcqQuestion } from '../types';

/**
 * Normalizes text for matching (lowercase, trims whitespace, removes hidden unicode)
 */
function cleanText(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ');
}

// ==========================================
// 1. BLANK FILLING GAME EXCEL UTILS
// ==========================================

export function downloadBlankExcelTemplate() {
  const sampleData = [
    [
      'Unique ID',
      'Sentence / Question',
      'Option 1',
      'Option 2',
      'Option 3',
      'Option 4',
      'Answer / Correct Option',
      'Explanation'
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
      'কোমল',
      'ব বাক্যে কোমল ভাব প্রকাশ পেয়েছে।'
    ],
    [
      'blank_003',
      'The CEO was known for her _____ decision-making style during crisis.',
      'decisive',
      'hesitant',
      'vacillating',
      'careless',
      '1', // Option 1 index
      'Decisive means able to make decisions quickly and effectively.'
    ]
  ];

  const ws = utils.aoa_to_sheet(sampleData);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Blank_Filling_Questions');
  writeFile(wb, 'Blank_Filling_Questions_Template.xlsx');
}

export async function parseBlankExcel(file: File, courseId: string): Promise<{ questions: BlankQuestion[]; notices: string[] }> {
  return new Promise((resolve, reject) => {
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

        // Detect if row 0 is header
        const row0 = rawRows[0] || [];
        const r0Str = row0.map(c => cleanText(c).toLowerCase()).join(' ');
        const hasHeader = r0Str.includes('sentence') || r0Str.includes('question') || r0Str.includes('option') || r0Str.includes('প্রশ্ন') || r0Str.includes('id');
        const startIdx = hasHeader ? 1 : 0;

        for (let i = startIdx; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length < 2) continue;

          let id = cleanText(row[0]);
          let sentence = cleanText(row[1]);

          // If row[0] looks like sentence and row[1] is option
          if (!sentence && id && id.length > 10) {
            sentence = id;
            id = '';
          }

          if (!sentence) continue;

          if (!id) {
            id = `blank-${Date.now()}-${i + 1}-${Math.random().toString(36).substr(2, 4)}`;
          }

          const first4Opts: string[] = [];
          let hashAnswer = '';

          // Read options from col 2 to 5 (4 options)
          for (let col = 2; col <= 5; col++) {
            const val = cleanText(row[col]);
            if (val) {
              if (val.includes('#')) {
                const cleaned = val.replace(/#/g, '').trim();
                first4Opts.push(cleaned);
                hashAnswer = cleaned;
              } else {
                first4Opts.push(val);
              }
            }
          }

          const col6Val = cleanText(row[6]);
          const col7Val = cleanText(row[7]);

          // Check if col 6 is an Answer column or Option 5
          let col6IsAnswer = false;
          let col6IsOption5 = false;

          const headerCol6 = hasHeader ? cleanText(row0[6] || '').toLowerCase() : '';
          if (headerCol6.includes('answer') || headerCol6.includes('correct') || headerCol6.includes('uttor') || headerCol6.includes('উত্তর') || headerCol6.includes('ans')) {
            col6IsAnswer = true;
          }

          if (!col6IsAnswer && col6Val) {
            if (col6Val.includes('#')) {
              col6IsOption5 = true;
            } else if (first4Opts.some(o => o.toLowerCase() === col6Val.toLowerCase())) {
              col6IsAnswer = true;
            } else if (/^[1-5]$/.test(col6Val) || /^[a-eA-E]$/.test(col6Val)) {
              col6IsAnswer = true;
            } else {
              col6IsOption5 = true;
            }
          }

          const rawOpts = [...first4Opts];
          if (col6IsOption5 && col6Val) {
            const cleaned5 = col6Val.replace(/#/g, '').trim();
            rawOpts.push(cleaned5);
            if (col6Val.includes('#')) {
              hashAnswer = cleaned5;
            }
          }

          // Deduplicate options while preserving non-empty strings
          const cleanOpts = Array.from(new Set(rawOpts.map(o => cleanText(o)))).filter(Boolean);

          if (cleanOpts.length < 2) {
            notices.push(`Row ${i + 1}: Skipped due to having fewer than 2 options.`);
            continue;
          }

          let answer = hashAnswer;
          if (!answer) {
            const colAns = col6IsAnswer ? col6Val : (col7Val || col6Val);
            if (colAns) {
              const numIdx = parseInt(colAns, 10);
              if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= cleanOpts.length) {
                answer = cleanOpts[numIdx - 1];
              } else if (/^[a-eA-E]$/.test(colAns)) {
                const charCode = colAns.toUpperCase().charCodeAt(0) - 65;
                if (charCode >= 0 && charCode < cleanOpts.length) {
                  answer = cleanOpts[charCode];
                }
              } else {
                const matched = cleanOpts.find(o => cleanText(o).toLowerCase() === colAns.toLowerCase());
                if (matched) {
                  answer = matched;
                } else {
                  const partial = cleanOpts.find(o => o.toLowerCase().includes(colAns.toLowerCase()) || colAns.toLowerCase().includes(o.toLowerCase()));
                  answer = partial || cleanOpts[0];
                }
              }
            }
          }

          if (!answer) {
            answer = cleanOpts[0];
          }

          const explanation = col6IsAnswer ? col7Val : (cleanText(row[7]) || cleanText(row[8]) || '');

          questions.push({
            id,
            sentence,
            options: cleanOpts,
            answer,
            explanation,
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
      'Word 1',
      'Word 2',
      'Word 3',
      'Word 4',
      'Odd Word / Answer',
      'Explanation'
    ],
    [
      'ooo_001',
      'Apple',
      'Banana',
      'Carrot#',
      'Mango',
      'Carrot',
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
    ],
    [
      'ooo_003',
      'বই',
      'খাতা',
      'কলম',
      'চেয়ার',
      '4',
      'চেয়ার হলো আসবাবপত্র, বাকিগুলো পড়ার সামগ্রী।'
    ]
  ];

  const ws = utils.aoa_to_sheet(sampleData);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Odd_One_Out_Questions');
  writeFile(wb, 'Odd_One_Out_Questions_Template.xlsx');
}

export async function parseOooExcel(file: File, courseId: string): Promise<{ questions: OddOneOutQuestion[]; notices: string[] }> {
  return new Promise((resolve, reject) => {
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

          // Read 4 words from col 1 to 4 (or 0 to 3 if no ID)
          let startCol = 1;
          if (!id && row.length >= 4) {
            startCol = 0;
          } else if (id && (id.toLowerCase().includes('ooo') || id.length < 15)) {
            startCol = 1;
          } else if (id && id.length >= 15) {
            // Might be a word
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
              answer = matched || wordsList[3]; // Default to 4th word if unmatched
            }
          }

          if (!answer) {
            answer = wordsList[3]; // Fallback to 4th word
          }

          const reason = cleanText(row[startCol + 5]) || '';

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
      'Target Pair (Stem)',
      'Option 1 Pair',
      'Option 2 Pair',
      'Option 3 Pair',
      'Option 4 Pair',
      'Correct Answer Pair',
      'Explanation'
    ],
    [
      'ana_001',
      'LIGHT : BLIND',
      'speech : deaf#',
      'tongue : sound',
      'language : dumb',
      'hearing : inaudible',
      'speech : deaf',
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
  return new Promise((resolve, reject) => {
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
        const hasHeader = r0Str.includes('analogy') || r0Str.includes('stem') || r0Str.includes('pair') || r0Str.includes('target') || r0Str.includes('id');
        const startIdx = hasHeader ? 1 : 0;

        for (let i = startIdx; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length < 3) continue;

          let id = cleanText(row[0]);
          let analogy = cleanText(row[1]);

          if (!analogy && id && id.includes(':')) {
            analogy = id;
            id = '';
          }

          if (!analogy) continue;

          if (!id) {
            id = `ana-${Date.now()}-${i + 1}-${Math.random().toString(36).substr(2, 4)}`;
          }

          const first4Opts: string[] = [];
          let hashAnswer = '';

          for (let col = 2; col <= 5; col++) {
            const val = cleanText(row[col]);
            if (val) {
              if (val.includes('#')) {
                const cleaned = val.replace(/#/g, '').trim();
                first4Opts.push(cleaned);
                hashAnswer = cleaned;
              } else {
                first4Opts.push(val);
              }
            }
          }

          const col6Val = cleanText(row[6]);
          const col7Val = cleanText(row[7]);

          let col6IsAnswer = false;
          let col6IsOption5 = false;

          const headerCol6 = hasHeader ? cleanText(row0[6] || '').toLowerCase() : '';
          if (headerCol6.includes('answer') || headerCol6.includes('correct') || headerCol6.includes('uttor') || headerCol6.includes('উত্তর') || headerCol6.includes('ans')) {
            col6IsAnswer = true;
          }

          if (!col6IsAnswer && col6Val) {
            if (col6Val.includes('#')) {
              col6IsOption5 = true;
            } else if (first4Opts.some(o => o.toLowerCase() === col6Val.toLowerCase())) {
              col6IsAnswer = true;
            } else if (/^[1-5]$/.test(col6Val) || /^[a-eA-E]$/.test(col6Val)) {
              col6IsAnswer = true;
            } else {
              col6IsOption5 = true;
            }
          }

          const rawOpts = [...first4Opts];
          if (col6IsOption5 && col6Val) {
            const cleaned5 = col6Val.replace(/#/g, '').trim();
            rawOpts.push(cleaned5);
            if (col6Val.includes('#')) {
              hashAnswer = cleaned5;
            }
          }

          const cleanOpts = Array.from(new Set(rawOpts.map(o => cleanText(o)))).filter(Boolean);

          if (cleanOpts.length < 2) {
            notices.push(`Row ${i + 1}: Skipped due to having fewer than 2 analogy option pairs.`);
            continue;
          }

          let answer = hashAnswer;
          if (!answer) {
            const colAns = col6IsAnswer ? col6Val : (col7Val || col6Val);
            if (colAns) {
              const numIdx = parseInt(colAns, 10);
              if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= cleanOpts.length) {
                answer = cleanOpts[numIdx - 1];
              } else if (/^[a-eA-E]$/.test(colAns)) {
                const charCode = colAns.toUpperCase().charCodeAt(0) - 65;
                if (charCode >= 0 && charCode < cleanOpts.length) {
                  answer = cleanOpts[charCode];
                }
              } else {
                const matched = cleanOpts.find(o => cleanText(o).toLowerCase() === colAns.toLowerCase());
                if (matched) {
                  answer = matched;
                } else {
                  const partial = cleanOpts.find(o => o.toLowerCase().includes(colAns.toLowerCase()) || colAns.toLowerCase().includes(o.toLowerCase()));
                  answer = partial || cleanOpts[0];
                }
              }
            }
          }

          if (!answer) {
            answer = cleanOpts[0];
          }

          const explanation = col6IsAnswer ? col7Val : (cleanText(row[7]) || cleanText(row[8]) || '');

          questions.push({
            id,
            analogy,
            options: cleanOpts,
            answer,
            explanation,
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
      'Question Text',
      'Option 1',
      'Option 2',
      'Option 3',
      'Option 4',
      'Correct Answer',
      'Explanation'
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
      'অগ্নিবীণা',
      'অগ্নিবীণা কাজী নজরুল ইসলামের বিখ্যাত কাব্যগ্রন্থ।'
    ]
  ];

  const ws = utils.aoa_to_sheet(sampleData);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'MCQ_Questions');
  writeFile(wb, 'MCQ_Questions_Template.xlsx');
}

export async function parseMcqExcel(file: File, courseId: string): Promise<{ questions: CustomMcqQuestion[]; notices: string[] }> {
  return new Promise((resolve, reject) => {
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
          const row = rawRows[i];
          if (!row || row.length < 3) continue;

          let id = cleanText(row[0]);
          let questionText = cleanText(row[1]);

          if (!questionText && id && id.length > 8) {
            questionText = id;
            id = '';
          }

          if (!questionText) continue;

          if (!id) {
            id = `mcq-${Date.now()}-${i + 1}-${Math.random().toString(36).substr(2, 4)}`;
          }

          const first4Opts: string[] = [];
          let hashAnswer = '';

          for (let col = 2; col <= 5; col++) {
            const val = cleanText(row[col]);
            if (val) {
              if (val.includes('#')) {
                const cleaned = val.replace(/#/g, '').trim();
                first4Opts.push(cleaned);
                hashAnswer = cleaned;
              } else {
                first4Opts.push(val);
              }
            }
          }

          const col6Val = cleanText(row[6]);
          const col7Val = cleanText(row[7]);

          let col6IsAnswer = false;
          let col6IsOption5 = false;

          const headerCol6 = hasHeader ? cleanText(row0[6] || '').toLowerCase() : '';
          if (headerCol6.includes('answer') || headerCol6.includes('correct') || headerCol6.includes('uttor') || headerCol6.includes('উত্তর') || headerCol6.includes('ans')) {
            col6IsAnswer = true;
          }

          if (!col6IsAnswer && col6Val) {
            if (col6Val.includes('#')) {
              col6IsOption5 = true;
            } else if (first4Opts.some(o => o.toLowerCase() === col6Val.toLowerCase())) {
              col6IsAnswer = true;
            } else if (/^[1-5]$/.test(col6Val) || /^[a-eA-E]$/.test(col6Val)) {
              col6IsAnswer = true;
            } else {
              col6IsOption5 = true;
            }
          }

          const rawOpts = [...first4Opts];
          if (col6IsOption5 && col6Val) {
            const cleaned5 = col6Val.replace(/#/g, '').trim();
            rawOpts.push(cleaned5);
            if (col6Val.includes('#')) {
              hashAnswer = cleaned5;
            }
          }

          const cleanOpts = Array.from(new Set(rawOpts.map(o => cleanText(o)))).filter(Boolean);

          if (cleanOpts.length < 2) {
            notices.push(`Row ${i + 1}: Skipped due to having fewer than 2 options.`);
            continue;
          }

          let answer = hashAnswer;
          if (!answer) {
            const colAns = col6IsAnswer ? col6Val : (col7Val || col6Val);
            if (colAns) {
              const numIdx = parseInt(colAns, 10);
              if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= cleanOpts.length) {
                answer = cleanOpts[numIdx - 1];
              } else if (/^[a-eA-E]$/.test(colAns)) {
                const charCode = colAns.toUpperCase().charCodeAt(0) - 65;
                if (charCode >= 0 && charCode < cleanOpts.length) {
                  answer = cleanOpts[charCode];
                }
              } else {
                const matched = cleanOpts.find(o => cleanText(o).toLowerCase() === colAns.toLowerCase());
                if (matched) {
                  answer = matched;
                } else {
                  const partial = cleanOpts.find(o => o.toLowerCase().includes(colAns.toLowerCase()) || colAns.toLowerCase().includes(o.toLowerCase()));
                  answer = partial || cleanOpts[0];
                }
              }
            }
          }

          if (!answer) {
            answer = cleanOpts[0];
          }

          const explanation = col6IsAnswer ? col7Val : (cleanText(row[7]) || cleanText(row[8]) || '');

          questions.push({
            id,
            question: questionText,
            options: cleanOpts,
            answer,
            explanation,
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
