const fs = require('fs');

const raw = fs.readFileSync('./src/lib/raw_user_data.txt', 'utf8');
const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// Top-level known fields in user document:
const TOP_KEYS = new Set([
  'activeCourseId', 'analogyProgress', 'blankProgress', 'createdAt', 'email',
  'enrolledCourseIds', 'folders', 'goal', 'history', 'oooProgress', 'progress',
  'quizScore', 'quizTaken', 'settings', 'synonymProgress', 'updatedAt'
]);

let data = {
  activeCourseId: "course-tf9cew",
  createdAt: "2026-07-22T19:28:55.124Z",
  email: "mohammad.001ekram@gmail.com",
  enrolledCourseIds: [
    "idioms", "is", "idiom-phrase-1", "idiom-phrase-2", "gre", "ex", 
    "bangla-sondhi", "sondhi", "word-rootsource", "ielts-words", 
    "ielts-1400-words", "course-3wcqsj", "course-tf9cew", "course-iyp607", 
    "j", "barrons-333", "course-47k1wl"
  ],
  folders: [
    { color: "#ef4444", id: "1", name: "গুরুত্বপূর্ণ শব্দ (High Priority)" },
    { color: "#f59e0b", id: "2", name: "কঠিন সিনোনিম (Hard Synonyms)" }
  ],
  goal: { dailyTarget: 50 },
  history: {
    "2026-07-09": 3,
    "2026-07-10": 314,
    "2026-07-11": 792,
    "2026-07-12": 13,
    "2026-07-13": 6,
    "2026-07-18": 1,
    "2026-07-19": 51,
    "2026-07-21": 85,
    "2026-07-22": 16,
    "2026-07-23": 14,
    lastStudyDate: "2026-07-23",
    streak: 10
  },
  quizScore: 0,
  quizTaken: 0,
  settings: {
    autoPlayAudio: false,
    colorizeMainWord: true,
    defaultFlashcardOrder: "random",
    defaultFlashcardTags: ["confusion", "dont_know", "unrated", "know"],
    defaultMatchSize: 8,
    defaultQuizType: "mcq_en_bn",
    defaultSynonymOrder: "random",
    defaultSynonymTags: ["know", "dont_know", "unrated"],
    flashcardAnimation: "shuffle",
    quizLength: 10,
    shortcuts: {
      ArrowDown: "flip",
      ArrowLeft: "dont_know",
      ArrowRight: "know",
      ArrowUp: "confusion",
      Digit1: "google",
      Enter: "audio",
      KeyA: "google",
      Space: "flip"
    }
  },
  updatedAt: "2026-07-22T19:28:55.124Z",
  analogyProgress: {},
  blankProgress: {},
  oooProgress: {},
  progress: {},
  synonymProgress: {}
};

// Now parse the tokens line by line to build analogyProgress, blankProgress, oooProgress, progress, synonymProgress
let currentSection = null;
let currentSubKey = null;
let currentProp = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line === 'analogyProgress' && lines[i+1] === '(map)') {
    currentSection = 'analogyProgress';
  } else if (line === 'blankProgress' && lines[i+1] === '(map)') {
    currentSection = 'blankProgress';
  } else if (line === 'oooProgress' && lines[i+1] === '(map)') {
    currentSection = 'oooProgress';
  } else if (line === 'progress' && lines[i+1] === '(map)') {
    currentSection = 'progress';
  } else if (line === 'synonymProgress' && lines[i+1] === '(map)') {
    currentSection = 'synonymProgress';
  } else if (TOP_KEYS.has(line) && line !== currentSection) {
    if (line === 'createdAt' || line === 'email' || line === 'enrolledCourseIds' || line === 'folders' || line === 'goal' || line === 'history' || line === 'quizScore' || line === 'quizTaken' || line === 'settings') {
      currentSection = null;
    }
  }

  if (currentSection && ['analogyProgress', 'blankProgress', 'oooProgress', 'synonymProgress'].includes(currentSection)) {
    if (lines[i+1] === '(map)' && line !== currentSection) {
      currentSubKey = line;
      if (!data[currentSection][currentSubKey]) {
        data[currentSection][currentSubKey] = {};
      }
    } else if (line === '(boolean)' || line === '(string)') {
      const valStr = lines[i-1];
      const propName = lines[i-2];
      if (currentSubKey && data[currentSection][currentSubKey]) {
        let val = valStr;
        if (line === '(boolean)') val = valStr === 'true';
        else if (valStr.startsWith('"') && valStr.endsWith('"')) val = valStr.slice(1, -1);
        data[currentSection][currentSubKey][propName] = val;
      }
    }
  }

  if (currentSection === 'progress') {
    if (lines[i+1] === '(map)' && line !== 'progress') {
      currentSubKey = line;
      if (!data.progress[currentSubKey]) {
        data.progress[currentSubKey] = { id: currentSubKey, status: 'unrated', bookmarks: [], notes: '' };
      }
    } else if (line === '(string)' || line === '(boolean)') {
      const valStr = lines[i-1];
      const propName = lines[i-2];
      if (currentSubKey && data.progress[currentSubKey]) {
        let val = valStr;
        if (line === '(boolean)') val = valStr === 'true';
        else if (valStr.startsWith('"') && valStr.endsWith('"')) val = valStr.slice(1, -1);
        if (['status', 'notes', 'updatedAt', 'id'].includes(propName)) {
          data.progress[currentSubKey][propName] = val;
        }
      }
    }
  }
}

console.log('Parsed analogyProgress keys count:', Object.keys(data.analogyProgress).length);
console.log('Parsed blankProgress keys count:', Object.keys(data.blankProgress).length);
console.log('Parsed oooProgress keys count:', Object.keys(data.oooProgress).length);
console.log('Parsed progress keys count:', Object.keys(data.progress).length);

const outputTS = `export const RECOVERED_USER_DATA: any = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync('./src/lib/importedUserData.ts', outputTS);
console.log('Wrote ./src/lib/importedUserData.ts successfully');
