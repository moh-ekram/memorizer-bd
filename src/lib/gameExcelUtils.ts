import { read, utils, writeFile } from 'xlsx';
import { BlankQuestion, OddOneOutQuestion, WordAnalogyQuestion, CustomMcqQuestion, VocabularyWord } from '../types';

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

          const rawOpts: string[] = [];
          let hashAnswer = '';

          // Read options from col 2 to 6
          for (let col = 2; col <= 6; col++) {
            const val = cleanText(row[col]);
            if (val) {
              if (val.includes('#')) {
                const cleaned = val.replace(/#/g, '').trim();
                rawOpts.push(cleaned);
                hashAnswer = cleaned;
              } else {
                rawOpts.push(val);
              }
            }
          }

          if (rawOpts.length < 2) {
            notices.push(`Row ${i + 1}: Skipped due to having fewer than 2 options.`);
            continue;
          }

          let answer = hashAnswer;

          // Check col 6 or 7 for explicit Answer column
          if (!answer) {
            const colAns = cleanText(row[6]) || cleanText(row[7]);
            if (colAns) {
              // 1. Is it numeric index 1, 2, 3, 4?
              const numIdx = parseInt(colAns, 10);
              if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= rawOpts.length) {
                answer = rawOpts[numIdx - 1];
              }
              // 2. Is it A, B, C, D?
              else if (/^[a-eA-E]$/.test(colAns)) {
                const charCode = colAns.toUpperCase().charCodeAt(0) - 65;
                if (charCode >= 0 && charCode < rawOpts.length) {
                  answer = rawOpts[charCode];
                }
              }
              // 3. Match text against options
              else {
                const matched = rawOpts.find(o => cleanText(o).toLowerCase() === colAns.toLowerCase());
                if (matched) {
                  answer = matched;
                } else {
                  // Partial match fallback
                  const partial = rawOpts.find(o => o.toLowerCase().includes(colAns.toLowerCase()) || colAns.toLowerCase().includes(o.toLowerCase()));
                  answer = partial || rawOpts[0];
                }
              }
            }
          }

          if (!answer) {
            answer = rawOpts[0]; // Fallback to first option if no answer specified
          }

          const explanation = cleanText(row[7]) || cleanText(row[8]) || '';

          questions.push({
            id,
            sentence,
            options: rawOpts,
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

          const rawOpts: string[] = [];
          let hashAnswer = '';

          for (let col = 2; col <= 6; col++) {
            const val = cleanText(row[col]);
            if (val) {
              if (val.includes('#')) {
                const cleaned = val.replace(/#/g, '').trim();
                rawOpts.push(cleaned);
                hashAnswer = cleaned;
              } else {
                rawOpts.push(val);
              }
            }
          }

          if (rawOpts.length < 2) {
            notices.push(`Row ${i + 1}: Skipped due to having fewer than 2 analogy option pairs.`);
            continue;
          }

          let answer = hashAnswer;
          const colAns = cleanText(row[6]) || cleanText(row[7]);

          if (!answer && colAns) {
            const numIdx = parseInt(colAns, 10);
            if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= rawOpts.length) {
              answer = rawOpts[numIdx - 1];
            } else {
              const matched = rawOpts.find(o => cleanText(o).toLowerCase() === colAns.toLowerCase());
              answer = matched || rawOpts[0];
            }
          }

          if (!answer) {
            answer = rawOpts[0];
          }

          const explanation = cleanText(row[7]) || cleanText(row[8]) || '';

          questions.push({
            id,
            analogy,
            options: rawOpts,
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

          const rawOpts: string[] = [];
          let hashAnswer = '';

          for (let col = 2; col <= 6; col++) {
            const val = cleanText(row[col]);
            if (val) {
              if (val.includes('#')) {
                const cleaned = val.replace(/#/g, '').trim();
                rawOpts.push(cleaned);
                hashAnswer = cleaned;
              } else {
                rawOpts.push(val);
              }
            }
          }

          if (rawOpts.length < 2) {
            notices.push(`Row ${i + 1}: Skipped due to having fewer than 2 options.`);
            continue;
          }

          let answer = hashAnswer;
          const colAns = cleanText(row[6]) || cleanText(row[7]);

          if (!answer && colAns) {
            const numIdx = parseInt(colAns, 10);
            if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= rawOpts.length) {
              answer = rawOpts[numIdx - 1];
            } else {
              const matched = rawOpts.find(o => cleanText(o).toLowerCase() === colAns.toLowerCase());
              answer = matched || rawOpts[0];
            }
          }

          if (!answer) {
            answer = rawOpts[0];
          }

          const explanation = cleanText(row[7]) || cleanText(row[8]) || '';

          questions.push({
            id,
            question: questionText,
            options: rawOpts,
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
// 5. MULTI-SHEET COMPLETE COURSE WORKBOOK PARSER & TEMPLATE
// ==========================================

export interface MultiSheetCourseParseResult {
  words: VocabularyWord[];
  placeLabels?: Record<string, string>;
  blankQuestions: BlankQuestion[];
  oddOneOutQuestions: OddOneOutQuestion[];
  wordAnalogyQuestions: WordAnalogyQuestion[];
  mcqQuestions: CustomMcqQuestion[];
  notices: string[];
  suggestedCourseTitle?: string;
  sheetsFound: {
    wordsSheet?: string;
    blankSheet?: string;
    oooSheet?: string;
    analogySheet?: string;
    mcqSheet?: string;
  };
}

export function parseWordsSheet(sheet: any): { words: VocabularyWord[]; placeLabels: Record<string, string>; notices: string[] } {
  const rawRows = utils.sheet_to_json(sheet) as any[];
  if (!rawRows || rawRows.length === 0) {
    return { words: [], placeLabels: {}, notices: ['Words sheet is empty.'] };
  }

  let detectedLabels: Record<string, string> = {};
  const firstRowKeys = Object.keys(rawRows[0] || {});
  firstRowKeys.forEach(k => {
    const match = k.match(/^place(1|2|3|4|5|6)[#:_\\-\s]*(.*)$/i);
    if (match) {
      const num = match[1];
      const lbl = match[2] ? match[2].trim() : '';
      if (lbl) {
        detectedLabels[`place${num}`] = lbl;
      }
    }
  });

  // Ensure default place labels are populated so flashcards and games always have place field definitions
  const defaultPlaceLabels: Record<string, string> = {
    place1: 'Main Word',
    place2: 'Bangla Meaning',
    place3: 'Example Sentence',
    place4: 'Extra Word',
    place5: 'Synonyms',
    place6: 'Mnemonic Note'
  };

  for (let i = 1; i <= 6; i++) {
    const pKey = `place${i}`;
    if (!detectedLabels[pKey]) {
      detectedLabels[pKey] = defaultPlaceLabels[pKey];
    }
  }

  const wordsList: VocabularyWord[] = [];
  const notices: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowKeys = Object.keys(row);
    const usedKeys = new Set<string>();

    const findKey = (candidates: string[], placePrefix?: string) => {
      if (placePrefix) {
        const placeKey = rowKeys.find(k => {
          if (usedKeys.has(k)) return false;
          const cleanK = k.toLowerCase().trim();
          return new RegExp(`^${placePrefix.toLowerCase()}([#:_\\-\\s]|$)`, 'i').test(cleanK);
        });
        if (placeKey) {
          usedKeys.add(placeKey);
          return placeKey;
        }
      }
      const key = rowKeys.find(k => {
        if (usedKeys.has(k)) return false;
        const cleanK = k.toLowerCase().trim();
        if (/^place[1-6]([#:_\\-\\s]|$)/i.test(cleanK)) return false;
        if (candidates.some(c => cleanK === c)) return true;
        const normK = cleanK.replace(/[^a-z0-9\u0980-\u09FF]/g, '');
        if (candidates.some(c => normK === c.replace(/[^a-z0-9\u0980-\u09FF]/g, ''))) return true;
        return candidates.some(c => c.length >= 3 && (cleanK.includes(c) || c.includes(cleanK)));
      });
      if (key) usedKeys.add(key);
      return key;
    };

    const idKey = findKey(['id', 'unique id', 'word id', 'uid', 'sl', 'serial', 'আইডি']);
    let rawId = idKey && row[idKey] ? String(row[idKey]).trim() : '';

    const wordKey = findKey(['word', 'main word', 'english word', 'শব্দ', '🔍 word'], 'place1');
    const meaningKey = findKey(['meaning', 'bangla meaning', 'bengali meaning', 'অর্থ', 'বাংলা অর্থ'], 'place2');
    const groupKey = findKey(['group', 'level', 'গ্ৰুপ', 'গ্রুপ']);
    const synonym1Key = findKey(['synonym1', 'synonm1', 'syn1'], 'place5');
    const synonym2Key = findKey(['synonym2', 'synonm2', 'syn2']);
    const synonymsKey = findKey(['synonyms', 'synonym', 'সমার্থক শব্দ']);
    const extraWordKey = findKey(['extra word', 'derivative', 'মূল শব্দ/উত্পন্ন শব্দ'], 'place4');
    const extraMeaningKey = findKey(['extra meaning', 'উত্পন্ন শব্দের অর্থ']);
    const exampleKey = findKey(['example', 'example sentence', 'উদাহরণ'], 'place3');
    const mnemonicKey = findKey(['mnemonic', 'mnemonics', 'personal notes', 'notes', 'note', 'নেমোনিক'], 'place6');

    const baseWord = wordKey ? String(row[wordKey]).trim() : '';
    const banglaMeaning = meaningKey ? String(row[meaningKey]).trim() : '';

    if (!baseWord || !banglaMeaning) continue;

    if (!rawId) {
      rawId = `w-${i + 1}`;
    }

    let group: string | number = 1;
    if (groupKey && row[groupKey] !== undefined && row[groupKey] !== null) {
      const rawGrp = String(row[groupKey]).trim();
      if (rawGrp) {
        const num = parseInt(rawGrp, 10);
        if (!isNaN(num) && String(num) === rawGrp) {
          group = num;
        } else {
          group = rawGrp;
        }
      }
    }

    let synonyms = '';
    const synParts = [];
    if (synonym1Key && row[synonym1Key]) synParts.push(String(row[synonym1Key]).trim());
    if (synonym2Key && row[synonym2Key]) synParts.push(String(row[synonym2Key]).trim());

    if (synParts.length > 0) {
      synonyms = synParts.join(', ');
    } else if (synonymsKey && row[synonymsKey]) {
      synonyms = String(row[synonymsKey]).trim();
    }

    wordsList.push({
      id: rawId,
      group,
      word: baseWord,
      meaning: banglaMeaning,
      synonyms,
      extraWord: extraWordKey ? String(row[extraWordKey]).trim() : '',
      extraMeaning: extraMeaningKey ? String(row[extraMeaningKey]).trim() : '',
      example: exampleKey ? String(row[exampleKey]).trim() : '',
      mnemonic: mnemonicKey ? String(row[mnemonicKey]).trim() : ''
    });
  }

  return { words: wordsList, placeLabels: detectedLabels, notices };
}

export function parseBlankFromSheet(ws: any, courseId: string): { questions: BlankQuestion[]; notices: string[] } {
  const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];
  if (!rawRows || rawRows.length === 0) {
    return { questions: [], notices: ['Blank questions sheet is empty.'] };
  }

  const questions: BlankQuestion[] = [];
  const notices: string[] = [];

  const row0 = rawRows[0] || [];
  const r0Str = row0.map(c => cleanText(c).toLowerCase()).join(' ');
  const hasHeader = r0Str.includes('sentence') || r0Str.includes('question') || r0Str.includes('option') || r0Str.includes('প্রশ্ন') || r0Str.includes('id');
  const startIdx = hasHeader ? 1 : 0;

  for (let i = startIdx; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length < 2) continue;

    let id = cleanText(row[0]);
    let sentence = cleanText(row[1]);

    if (!sentence && id && id.length > 10) {
      sentence = id;
      id = '';
    }

    if (!sentence) continue;

    if (!id) {
      id = `blank-${Date.now()}-${i + 1}-${Math.random().toString(36).substr(2, 4)}`;
    }

    const rawOpts: string[] = [];
    let hashAnswer = '';

    for (let col = 2; col <= 6; col++) {
      const val = cleanText(row[col]);
      if (val) {
        if (val.includes('#')) {
          const cleaned = val.replace(/#/g, '').trim();
          rawOpts.push(cleaned);
          hashAnswer = cleaned;
        } else {
          rawOpts.push(val);
        }
      }
    }

    if (rawOpts.length < 2) {
      notices.push(`Row ${i + 1}: Skipped due to having fewer than 2 options.`);
      continue;
    }

    let answer = hashAnswer;

    if (!answer) {
      const colAns = cleanText(row[6]) || cleanText(row[7]);
      if (colAns) {
        const numIdx = parseInt(colAns, 10);
        if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= rawOpts.length) {
          answer = rawOpts[numIdx - 1];
        } else if (/^[a-eA-E]$/.test(colAns)) {
          const charCode = colAns.toUpperCase().charCodeAt(0) - 65;
          if (charCode >= 0 && charCode < rawOpts.length) {
            answer = rawOpts[charCode];
          }
        } else {
          const matched = rawOpts.find(o => cleanText(o).toLowerCase() === colAns.toLowerCase());
          if (matched) {
            answer = matched;
          } else {
            const partial = rawOpts.find(o => o.toLowerCase().includes(colAns.toLowerCase()) || colAns.toLowerCase().includes(o.toLowerCase()));
            answer = partial || rawOpts[0];
          }
        }
      }
    }

    if (!answer) {
      answer = rawOpts[0];
    }

    const explanation = cleanText(row[7]) || cleanText(row[8]) || '';

    questions.push({
      id,
      sentence,
      options: rawOpts,
      answer,
      explanation,
      courseId,
      createdAt: new Date().toISOString()
    });
  }

  return { questions, notices };
}

export function parseOooFromSheet(ws: any, courseId: string): { questions: OddOneOutQuestion[]; notices: string[] } {
  const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];
  if (!rawRows || rawRows.length === 0) {
    return { questions: [], notices: ['Odd One Out sheet is empty.'] };
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
    } else if (id && (id.toLowerCase().includes('ooo') || id.length < 15)) {
      startCol = 1;
    } else if (id && id.length >= 15) {
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

  return { questions, notices };
}

export function parseAnalogyFromSheet(ws: any, courseId: string): { questions: WordAnalogyQuestion[]; notices: string[] } {
  const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];
  if (!rawRows || rawRows.length === 0) {
    return { questions: [], notices: ['Analogy sheet is empty.'] };
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

    const rawOpts: string[] = [];
    let hashAnswer = '';

    for (let col = 2; col <= 6; col++) {
      const val = cleanText(row[col]);
      if (val) {
        if (val.includes('#')) {
          const cleaned = val.replace(/#/g, '').trim();
          rawOpts.push(cleaned);
          hashAnswer = cleaned;
        } else {
          rawOpts.push(val);
        }
      }
    }

    if (rawOpts.length < 2) {
      notices.push(`Row ${i + 1}: Skipped due to having fewer than 2 analogy option pairs.`);
      continue;
    }

    let answer = hashAnswer;
    const colAns = cleanText(row[6]) || cleanText(row[7]);

    if (!answer && colAns) {
      const numIdx = parseInt(colAns, 10);
      if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= rawOpts.length) {
        answer = rawOpts[numIdx - 1];
      } else {
        const matched = rawOpts.find(o => cleanText(o).toLowerCase() === colAns.toLowerCase());
        answer = matched || rawOpts[0];
      }
    }

    if (!answer) {
      answer = rawOpts[0];
    }

    const explanation = cleanText(row[7]) || cleanText(row[8]) || '';

    questions.push({
      id,
      analogy,
      options: rawOpts,
      answer,
      explanation,
      courseId,
      createdAt: new Date().toISOString()
    });
  }

  return { questions, notices };
}

export function parseMcqFromSheet(ws: any, courseId: string): { questions: CustomMcqQuestion[]; notices: string[] } {
  const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][];
  if (!rawRows || rawRows.length === 0) {
    return { questions: [], notices: ['MCQ sheet is empty.'] };
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

    const rawOpts: string[] = [];
    let hashAnswer = '';

    for (let col = 2; col <= 6; col++) {
      const val = cleanText(row[col]);
      if (val) {
        if (val.includes('#')) {
          const cleaned = val.replace(/#/g, '').trim();
          rawOpts.push(cleaned);
          hashAnswer = cleaned;
        } else {
          rawOpts.push(val);
        }
      }
    }

    if (rawOpts.length < 2) {
      notices.push(`Row ${i + 1}: Skipped due to having fewer than 2 options.`);
      continue;
    }

    let answer = hashAnswer;
    const colAns = cleanText(row[6]) || cleanText(row[7]);

    if (!answer && colAns) {
      const numIdx = parseInt(colAns, 10);
      if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= rawOpts.length) {
        answer = rawOpts[numIdx - 1];
      } else {
        const matched = rawOpts.find(o => cleanText(o).toLowerCase() === colAns.toLowerCase());
        answer = matched || rawOpts[0];
      }
    }

    if (!answer) {
      answer = rawOpts[0];
    }

    const explanation = cleanText(row[7]) || cleanText(row[8]) || '';

    questions.push({
      id,
      question: questionText,
      options: rawOpts,
      answer,
      explanation,
      courseId,
      createdAt: new Date().toISOString()
    });
  }

  return { questions, notices };
}

export async function parseMultiSheetCourseWorkbook(
  file: File,
  courseId: string
): Promise<MultiSheetCourseParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = read(data, { type: 'array' });

        const result: MultiSheetCourseParseResult = {
          words: [],
          placeLabels: {},
          blankQuestions: [],
          oddOneOutQuestions: [],
          wordAnalogyQuestions: [],
          mcqQuestions: [],
          notices: [],
          sheetsFound: {}
        };

        if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
          result.notices.push('The uploaded Excel file contains no worksheets.');
          return resolve(result);
        }

        const sheetNames = wb.SheetNames;
        let wordsSheetName: string | undefined;
        let blankSheetName: string | undefined;
        let oooSheetName: string | undefined;
        let analogySheetName: string | undefined;
        let mcqSheetName: string | undefined;

        sheetNames.forEach((sName) => {
          const lower = sName.trim().toLowerCase();
          if (/blank|fill|শূন্যস্থান|sentence/i.test(lower)) {
            blankSheetName = sName;
          } else if (/odd|ooo|ব্যতিক্রম|বেমানান/i.test(lower)) {
            oooSheetName = sName;
          } else if (/analogy|sadrishya|সাদৃশ্য/i.test(lower)) {
            analogySheetName = sName;
          } else if (/mcq|quiz|কুইজ|এমসিকিউ/i.test(lower)) {
            mcqSheetName = sName;
          } else if (/words?|vocab(ulary)?|wordlist|শব্দ|main words|course/i.test(lower)) {
            wordsSheetName = sName;
          }
        });

        // Fallback: If words sheet not explicitly matched, grab first unassigned sheet
        if (!wordsSheetName) {
          const unassigned = sheetNames.find(s => s !== blankSheetName && s !== oooSheetName && s !== analogySheetName && s !== mcqSheetName);
          wordsSheetName = unassigned || sheetNames[0];
        }

        result.sheetsFound = {
          wordsSheet: wordsSheetName,
          blankSheet: blankSheetName,
          oooSheet: oooSheetName,
          analogySheet: analogySheetName,
          mcqSheet: mcqSheetName
        };

        if (wordsSheetName && wb.Sheets[wordsSheetName]) {
          const { words, placeLabels, notices } = parseWordsSheet(wb.Sheets[wordsSheetName]);
          result.words = words;
          result.placeLabels = placeLabels;
          result.notices.push(...notices);
        }

        if (blankSheetName && wb.Sheets[blankSheetName]) {
          const { questions, notices } = parseBlankFromSheet(wb.Sheets[blankSheetName], courseId);
          result.blankQuestions = questions;
          result.notices.push(...notices.map(n => `[Blank Sheet] ${n}`));
        }

        if (oooSheetName && wb.Sheets[oooSheetName]) {
          const { questions, notices } = parseOooFromSheet(wb.Sheets[oooSheetName], courseId);
          result.oddOneOutQuestions = questions;
          result.notices.push(...notices.map(n => `[Odd One Out Sheet] ${n}`));
        }

        if (analogySheetName && wb.Sheets[analogySheetName]) {
          const { questions, notices } = parseAnalogyFromSheet(wb.Sheets[analogySheetName], courseId);
          result.wordAnalogyQuestions = questions;
          result.notices.push(...notices.map(n => `[Analogy Sheet] ${n}`));
        }

        if (mcqSheetName && wb.Sheets[mcqSheetName]) {
          const { questions, notices } = parseMcqFromSheet(wb.Sheets[mcqSheetName], courseId);
          result.mcqQuestions = questions;
          result.notices.push(...notices.map(n => `[MCQ Sheet] ${n}`));
        }

        // Determine suggested course title from sheet name or file name
        let autoTitle = file.name ? file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ").trim() : '';
        if (wordsSheetName && !/^(sheet|sheet\s*1|data|table|workbook)$/i.test(wordsSheetName.trim())) {
          autoTitle = wordsSheetName.replace(/_/g, " ").trim();
        }
        result.suggestedCourseTitle = autoTitle;

        resolve(result);
      } catch (err: any) {
        resolve({
          words: [],
          blankQuestions: [],
          oddOneOutQuestions: [],
          wordAnalogyQuestions: [],
          mcqQuestions: [],
          notices: [`Workbook parsing error: ${err?.message || 'Invalid Excel file'}`],
          sheetsFound: {}
        });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function downloadMultiSheetCourseTemplate() {
  const wb = utils.book_new();

  // 1. Vocabulary Words Sheet
  const wordsData = [
    ['id', 'word', 'meaning', 'group', 'synonyms', 'extra word', 'extra meaning', 'example', 'mnemonic'],
    ['g1-w1', 'soporific', 'ঘুমপাড়ানি / তন্দ্রাচ্ছন্নকারী', '1', 'somnolent, hypnotic', 'soporifically', 'ঘুমপাড়ানিভাবে', 'The professor\'s lecture was so soporific that students slept.', 'Soporific sounds like "So-Poor-Pacific" - bore into sleep.'],
    ['g1-w2', 'ubiquitous', 'সর্বব্যাপী / সর্বত্র বিদ্যমান', '1', 'omnipresent, pervasive', 'ubiquity', 'সর্বব্যাপিতা', 'Smartphones have become ubiquitous in modern life.', 'Ubi (everywhere) + quitous.'],
    ['g1-w3', 'benevolent', 'দয়ালু / হিতৈষী', '1', 'kind, charitable, generous', 'benevolence', 'দয়া', 'A benevolent smile warmed the room.', 'Bene = Good. Benevolent = wishing good.']
  ];
  const wsWords = utils.aoa_to_sheet(wordsData);
  utils.book_append_sheet(wb, wsWords, 'Vocabulary_Words');

  // 2. Blank Filling Sheet
  const blankData = [
    ['Unique ID', 'Sentence / Question', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Answer / Correct Option', 'Explanation'],
    ['blank_001', 'The professor\'s lecture was so _____ that many students fell asleep.', 'engaging', 'soporific', 'dynamic', 'vivid', 'soporific', 'Soporific means causing or tending to induce sleep.'],
    ['blank_002', 'Smartphones have become _____ in modern human communication.', 'rare', 'ubiquitous', 'hidden', 'obsolete', 'ubiquitous', 'Ubiquitous means found everywhere.']
  ];
  const wsBlank = utils.aoa_to_sheet(blankData);
  utils.book_append_sheet(wb, wsBlank, 'Blank_Filling_Questions');

  // 3. Odd One Out Sheet
  const oooData = [
    ['Unique ID', 'Word 1', 'Word 2', 'Word 3', 'Word 4', 'Odd Word / Answer', 'Explanation'],
    ['ooo_001', 'Benevolent', 'Generous', 'Charitable', 'Malevolent', 'Malevolent', 'Malevolent means evil, while the other 3 mean kind/charitable.'],
    ['ooo_002', 'Soporific', 'Somnolent', 'Drowsy', 'Energetic', 'Energetic', 'Energetic is an antonym, others mean sleepy.']
  ];
  const wsOoo = utils.aoa_to_sheet(oooData);
  utils.book_append_sheet(wb, wsOoo, 'Odd_One_Out_Questions');

  // 4. Word Analogy Sheet
  const analogyData = [
    ['Unique ID', 'Target Pair (Stem)', 'Option 1 Pair', 'Option 2 Pair', 'Option 3 Pair', 'Option 4 Pair', 'Correct Answer Pair', 'Explanation'],
    ['ana_001', 'LIGHT : BLIND', 'speech : deaf', 'tongue : sound', 'language : dumb', 'hearing : inaudible', 'speech : deaf', 'Light cannot be perceived by the blind; speech cannot be perceived by the deaf.'],
    ['ana_002', 'ARCHITECT : BUILDING', 'sculptor : statue', 'poet : pen', 'composer : music', 'teacher : student', 'sculptor : statue', 'An architect creates a building; a sculptor creates a statue.']
  ];
  const wsAnalogy = utils.aoa_to_sheet(analogyData);
  utils.book_append_sheet(wb, wsAnalogy, 'Word_Analogy_Questions');

  // 5. MCQ Questions Sheet
  const mcqData = [
    ['Unique ID', 'Question Text', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Correct Answer', 'Explanation'],
    ['mcq_001', 'What is the closest synonym of "Ubiquitous"?', 'Rare', 'Omnipresent', 'Hidden', 'Temporary', 'Omnipresent', 'Ubiquitous means existing or present everywhere.'],
    ['mcq_002', 'What is the antonym of "Benevolent"?', 'Kind', 'Charitable', 'Malevolent', 'Generous', 'Malevolent', 'Benevolent means good/kind, Malevolent means wishing evil.']
  ];
  const wsMcq = utils.aoa_to_sheet(mcqData);
  utils.book_append_sheet(wb, wsMcq, 'MCQ_Questions');

  writeFile(wb, 'Complete_Course_With_Games_Template.xlsx');
}

