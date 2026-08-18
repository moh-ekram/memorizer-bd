import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Sparkles, 
  Trophy, 
  RotateCw, 
  Timer, 
  Flame, 
  CheckCircle2, 
  ArrowLeft, 
  Volume2, 
  Lightbulb, 
  HelpCircle,
  Eye,
  Check,
  ChevronRight,
  Filter,
  Play
} from 'lucide-react';
import { VocabularyWord, AppSettings } from '../types';

interface WordSearchGameProps {
  words: VocabularyWord[];
  activeGroup?: number | string | null;
  settings?: AppSettings;
  onBack: () => void;
  placeLabels?: {
    place1?: string;
    place2?: string;
    place3?: string;
    place4?: string;
    place5?: string;
    place6?: string;
  };
}

interface GridCell {
  row: number;
  col: number;
  letter: string;
  wordId?: string; // which word this belongs to
  foundColor?: string; // color highlight if found
}

interface TargetWord {
  id: string;
  word: string;
  meaning: string;
  synonyms?: string;
  example?: string;
  isFound: boolean;
  color: string;
  startPos?: { row: number; col: number };
  endPos?: { row: number; col: number };
  cells?: { row: number; col: number }[];
}

const PALETTE = [
  'bg-emerald-500 text-white border-emerald-600',
  'bg-indigo-500 text-white border-indigo-600',
  'bg-rose-500 text-white border-rose-600',
  'bg-amber-500 text-white border-amber-600',
  'bg-cyan-500 text-white border-cyan-600',
  'bg-purple-500 text-white border-purple-600',
  'bg-teal-500 text-white border-teal-600',
  'bg-orange-500 text-white border-orange-600',
];

const PALETTE_BG_LIGHT = [
  'bg-emerald-50 text-emerald-800 border-emerald-300',
  'bg-indigo-50 text-indigo-800 border-indigo-300',
  'bg-rose-50 text-rose-800 border-rose-300',
  'bg-amber-50 text-amber-800 border-amber-300',
  'bg-cyan-50 text-cyan-800 border-cyan-300',
  'bg-purple-50 text-purple-800 border-purple-300',
  'bg-teal-50 text-teal-800 border-teal-300',
  'bg-orange-50 text-orange-800 border-orange-300',
];

// Directions: [dRow, dCol]
const DIRECTIONS: [number, number][] = [
  [0, 1],   // Horizontal right
  [1, 0],   // Vertical down
  [1, 1],   // Diagonal down-right
  [-1, 1],  // Diagonal up-right
  [0, -1],  // Horizontal left
  [1, -1],  // Diagonal down-left
];

export default function WordSearchGame({
  words,
  activeGroup,
  settings,
  onBack,
  placeLabels
}: WordSearchGameProps) {
  // Game Settings & Setup
  const [gridSize, setGridSize] = useState<number>(10);
  const [wordCount, setWordCount] = useState<number>(6);
  const [selectedGroup, setSelectedGroup] = useState<number | string | 'all'>(
    activeGroup !== undefined && activeGroup !== null ? activeGroup : 'all'
  );

  // Gameplay State
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [targetWords, setTargetWords] = useState<TargetWord[]>([]);
  const [selectedCells, setSelectedCells] = useState<{ row: number; col: number }[]>([]);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [startCell, setStartCell] = useState<{ row: number; col: number } | null>(null);

  // Score & Timing
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [inspectedWord, setInspectedWord] = useState<TargetWord | null>(null);
  const [hintActiveCell, setHintActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [audioFeedback, setAudioFeedback] = useState<boolean>(true);

  // Subtle Found Animation State: map of "r-c" -> { index: number; color: string }
  const [justFoundCells, setJustFoundCells] = useState<Record<string, { index: number; color: string }>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Distinct groups list
  const availableGroups = React.useMemo(() => {
    const grps = new Set<string | number>();
    words.forEach(w => {
      if (w.group !== undefined && w.group !== null && w.group !== '') {
        grps.add(w.group);
      }
    });
    return Array.from(grps).sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a).localeCompare(String(b));
    });
  }, [words]);

  // Audio synthesizer tone for fun feedback
  const playSound = useCallback((type: 'select' | 'match' | 'win' | 'hint') => {
    if (!audioFeedback && !settings?.soundEffectsEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'select') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'match') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      } else if (type === 'win') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'hint') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      // AudioContext unavailable or blocked by browser
    }
  }, [audioFeedback, settings]);

  // Voice Pronunciation
  const speakWord = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Generate the Word Search Grid
  const generateGame = useCallback(() => {
    if (!words || words.length === 0) return;

    // 1. Filter words
    let pool = words.filter(w => {
      const clean = w.word.replace(/[^a-zA-Z]/g, '').toUpperCase();
      return clean.length >= 3 && clean.length <= gridSize;
    });

    if (selectedGroup !== 'all') {
      const groupFiltered = pool.filter(w => String(w.group) === String(selectedGroup));
      if (groupFiltered.length >= 3) {
        pool = groupFiltered;
      }
    }

    if (pool.length === 0) {
      pool = words.filter(w => w.word.replace(/[^a-zA-Z]/g, '').length >= 3);
    }

    // Shuffle pool
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);

    // Initialize blank grid
    const newGrid: GridCell[][] = Array.from({ length: gridSize }, (_, r) =>
      Array.from({ length: gridSize }, (_, c) => ({
        row: r,
        col: c,
        letter: ''
      }))
    );

    const placedTargetWords: TargetWord[] = [];
    const usedWords = new Set<string>();

    // Attempt to place words
    for (const wordObj of shuffledPool) {
      if (placedTargetWords.length >= wordCount) break;

      const cleanWord = wordObj.word.replace(/[^a-zA-Z]/g, '').toUpperCase();
      if (usedWords.has(cleanWord) || cleanWord.length > gridSize) continue;

      // Try placing in random positions and directions
      let placed = false;
      const shuffledDirs = [...DIRECTIONS].sort(() => Math.random() - 0.5);

      // Try up to 80 random placement attempts per word
      for (let attempt = 0; attempt < 80 && !placed; attempt++) {
        const [dRow, dCol] = shuffledDirs[Math.floor(Math.random() * shuffledDirs.length)];
        
        // Calculate max bounds
        const minRow = dRow < 0 ? cleanWord.length - 1 : 0;
        const maxRow = dRow > 0 ? gridSize - cleanWord.length : gridSize - 1;
        const minCol = dCol < 0 ? cleanWord.length - 1 : 0;
        const maxCol = dCol > 0 ? gridSize - cleanWord.length : gridSize - 1;

        if (maxRow < minRow || maxCol < minCol) continue;

        const startR = minRow + Math.floor(Math.random() * (maxRow - minRow + 1));
        const startC = minCol + Math.floor(Math.random() * (maxCol - minCol + 1));

        // Check if fits without collision
        let canFit = true;
        const cellsToOccupy: { row: number; col: number }[] = [];

        for (let i = 0; i < cleanWord.length; i++) {
          const r = startR + i * dRow;
          const c = startC + i * dCol;

          if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
            canFit = false;
            break;
          }

          const existingLetter = newGrid[r][c].letter;
          if (existingLetter !== '' && existingLetter !== cleanWord[i]) {
            canFit = false;
            break;
          }

          cellsToOccupy.push({ row: r, col: c });
        }

        if (canFit) {
          const colorIdx = placedTargetWords.length % PALETTE.length;
          const color = PALETTE[colorIdx];

          // Place letters
          for (let i = 0; i < cleanWord.length; i++) {
            const { row: r, col: c } = cellsToOccupy[i];
            newGrid[r][c].letter = cleanWord[i];
            newGrid[r][c].wordId = wordObj.id;
          }

          placedTargetWords.push({
            id: wordObj.id,
            word: cleanWord,
            meaning: wordObj.meaning,
            synonyms: wordObj.synonyms,
            example: wordObj.example,
            isFound: false,
            color,
            startPos: cellsToOccupy[0],
            endPos: cellsToOccupy[cellsToOccupy.length - 1],
            cells: cellsToOccupy
          });

          usedWords.add(cleanWord);
          placed = true;
        }
      }
    }

    // Fill remaining empty cells with random letters
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (newGrid[r][c].letter === '') {
          newGrid[r][c].letter = alphabet[Math.floor(Math.random() * alphabet.length)];
        }
      }
    }

    setGrid(newGrid);
    setTargetWords(placedTargetWords);
    setSelectedCells([]);
    setStartCell(null);
    setIsSelecting(false);
    setIsGameOver(false);
    setTimeElapsed(0);
    setHintsUsed(0);
    setScore(0);
    setInspectedWord(null);
    setHintActiveCell(null);

    // Reset Timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
  }, [words, gridSize, wordCount, selectedGroup]);

  // Initial Load
  useEffect(() => {
    generateGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [generateGame]);

  // Check Game Over
  useEffect(() => {
    if (targetWords.length > 0 && targetWords.every(w => w.isFound)) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsGameOver(true);
      playSound('win');
    }
  }, [targetWords, playSound]);

  // Helper: Get straight line cells between (r1, c1) and (r2, c2)
  const getLineCells = (
    r1: number,
    c1: number,
    r2: number,
    c2: number
  ): { row: number; col: number }[] => {
    const dR = r2 - r1;
    const dC = c2 - c1;

    const stepR = dR === 0 ? 0 : dR > 0 ? 1 : -1;
    const stepC = dC === 0 ? 0 : dC > 0 ? 1 : -1;

    // Must be straight horizontal, vertical, or 45-degree diagonal
    const isHorizontal = dR === 0;
    const isVertical = dC === 0;
    const isDiagonal = Math.abs(dR) === Math.abs(dC);

    if (!isHorizontal && !isVertical && !isDiagonal) {
      return [{ row: r1, col: c1 }];
    }

    const steps = Math.max(Math.abs(dR), Math.abs(dC));
    const cells: { row: number; col: number }[] = [];

    for (let i = 0; i <= steps; i++) {
      cells.push({
        row: r1 + i * stepR,
        col: c1 + i * stepC
      });
    }

    return cells;
  };

  // Validate current selection against target words
  const validateSelection = (cells: { row: number; col: number }[]) => {
    if (cells.length < 2) {
      setSelectedCells([]);
      setStartCell(null);
      return;
    }

    const selectedLetters = cells.map(c => grid[c.row][c.col].letter).join('');
    const reverseLetters = selectedLetters.split('').reverse().join('');

    // Check if matches any unfound word
    const matchedWordIndex = targetWords.findIndex(
      tw => !tw.isFound && (tw.word === selectedLetters || tw.word === reverseLetters)
    );

    if (matchedWordIndex !== -1) {
      const matched = targetWords[matchedWordIndex];
      playSound('match');

      // Populate subtle found animation map with staggered indices
      const foundMap: Record<string, { index: number; color: string }> = {};
      cells.forEach(({ row, col }, i) => {
        foundMap[`${row}-${col}`] = { index: i, color: matched.color };
      });
      setJustFoundCells(prev => ({ ...prev, ...foundMap }));

      // Clear animation effect state after 1.4s
      setTimeout(() => {
        setJustFoundCells(prev => {
          const next = { ...prev };
          cells.forEach(({ row, col }) => {
            delete next[`${row}-${col}`];
          });
          return next;
        });
      }, 1400);

      // Mark word as found
      setTargetWords(prev =>
        prev.map((w, idx) => (idx === matchedWordIndex ? { ...w, isFound: true } : w))
      );

      // Color the grid cells permanently
      setGrid(prev => {
        const nextGrid = prev.map(row => row.map(cell => ({ ...cell })));
        cells.forEach(({ row, col }) => {
          nextGrid[row][col].foundColor = matched.color;
        });
        return nextGrid;
      });

      // Update Score
      const wordScore = Math.max(10, matched.word.length * 10 - hintsUsed * 5);
      setScore(prev => prev + wordScore);

      // Auto inspect found word for vocabulary study
      setInspectedWord(matched);
      speakWord(matched.word);
    }

    setSelectedCells([]);
    setStartCell(null);
  };

  // Handle Cell Interaction (Mouse / Touch)
  const handleCellDown = (row: number, col: number) => {
    setIsSelecting(true);
    setStartCell({ row, col });
    setSelectedCells([{ row, col }]);
    playSound('select');
  };

  const handleCellOver = (row: number, col: number) => {
    if (!isSelecting || !startCell) return;
    const line = getLineCells(startCell.row, startCell.col, row, col);
    setSelectedCells(line);
  };

  const handleCellUp = () => {
    if (isSelecting) {
      setIsSelecting(false);
      validateSelection(selectedCells);
    }
  };

  // Touch handlers on the grid container for smooth swipe drag on mobile
  const handleTouchStart = (e: React.TouchEvent, row: number, col: number) => {
    handleCellDown(row, col);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSelecting || !startCell) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (targetEl && targetEl.hasAttribute('data-cell-pos')) {
      const posAttr = targetEl.getAttribute('data-cell-pos');
      if (posAttr) {
        const [r, c] = posAttr.split('-').map(Number);
        if (!isNaN(r) && !isNaN(c)) {
          const line = getLineCells(startCell.row, startCell.col, r, c);
          setSelectedCells(line);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    handleCellUp();
  };

  // Provide a Hint: Highlight the first letter of an unfound word
  const triggerHint = () => {
    const unfound = targetWords.filter(w => !w.isFound);
    if (unfound.length === 0) return;

    const randomUnfound = unfound[Math.floor(Math.random() * unfound.length)];
    if (randomUnfound.cells && randomUnfound.cells.length > 0) {
      const firstCell = randomUnfound.cells[0];
      setHintActiveCell(firstCell);
      setHintsUsed(prev => prev + 1);
      playSound('hint');

      setTimeout(() => {
        setHintActiveCell(null);
      }, 2500);
    }
  };

  // Format Time (MM:SS)
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const foundCount = targetWords.filter(w => w.isFound).length;
  const totalCount = targetWords.length;
  const progressPercent = totalCount > 0 ? Math.round((foundCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4 max-w-4xl mx-auto font-sans" id="word-search-game-page">
      {/* Top Header Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
            title="Back to Games Hub"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                <Search className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Word Search Puzzle
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Find hidden vocabulary words horizontally, vertically, or diagonally.
            </p>
          </div>
        </div>

        {/* Action Controls: Group, Hint, New Game */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Group Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedGroup}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedGroup(val === 'all' ? 'all' : isNaN(Number(val)) ? val : Number(val));
              }}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Groups ({words.length} words)</option>
              {availableGroups.map(grp => (
                <option key={grp} value={grp}>
                  Group {grp}
                </option>
              ))}
            </select>
          </div>

          {/* Hint Button */}
          <button
            type="button"
            onClick={triggerHint}
            disabled={isGameOver || foundCount === totalCount}
            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Reveal the first letter of an unfound word"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>Hint</span>
          </button>

          {/* New Game Button */}
          <button
            type="button"
            onClick={generateGame}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>New Grid</span>
          </button>
        </div>
      </div>

      {/* Game Status Metrics Ribbon */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Words Found */}
        <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-2xs flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Found
            </span>
            <span className="text-sm sm:text-base font-black text-slate-800 font-mono">
              {foundCount} / {totalCount}
            </span>
          </div>
        </div>

        {/* Timer */}
        <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-2xs flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-black shrink-0">
            <Timer className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Timer
            </span>
            <span className="text-sm sm:text-base font-black text-slate-800 font-mono">
              {formatTime(timeElapsed)}
            </span>
          </div>
        </div>

        {/* Score */}
        <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-2xs flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black shrink-0">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Score
            </span>
            <span className="text-sm sm:text-base font-black text-purple-700 font-mono">
              {score} pts
            </span>
          </div>
        </div>
      </div>

      {/* Main Game Stage: Grid on Left/Center + Target Words on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* WORD SEARCH GRID CONTAINER */}
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-xs flex flex-col items-center">
          {/* Instructions bar */}
          <div className="w-full flex items-center justify-between mb-3 px-1 text-[11px] font-bold text-slate-400">
            <span>Drag or tap start & end letters to select words</span>
            <span>{gridSize}x{gridSize} Matrix</span>
          </div>

          {/* Interactive Letter Grid */}
          <div
            ref={gridContainerRef}
            onMouseLeave={handleCellUp}
            onMouseUp={handleCellUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="select-none touch-none inline-grid gap-1 sm:gap-1.5 p-2 sm:p-3 bg-slate-900 rounded-2xl sm:rounded-3xl shadow-inner border-2 border-slate-800"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`
            }}
          >
            {grid.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const cellKey = `${rIdx}-${cIdx}`;
                const isCurrentSelected = selectedCells.some(
                  sc => sc.row === rIdx && sc.col === cIdx
                );
                const isHinted = hintActiveCell?.row === rIdx && hintActiveCell?.col === cIdx;
                const isFound = !!cell.foundColor;
                const justFound = justFoundCells[cellKey];

                let cellStyle = 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700';

                if (isFound) {
                  cellStyle = `${cell.foundColor} font-black shadow-sm`;
                } else if (isCurrentSelected) {
                  cellStyle = 'bg-purple-500 text-white font-black scale-105 border-purple-300 shadow-md ring-2 ring-purple-300';
                } else if (isHinted) {
                  cellStyle = 'bg-amber-400 text-slate-950 font-black animate-bounce ring-2 ring-amber-300';
                }

                return (
                  <motion.button
                    key={cellKey}
                    type="button"
                    data-cell-pos={cellKey}
                    onMouseDown={() => handleCellDown(rIdx, cIdx)}
                    onMouseEnter={() => handleCellOver(rIdx, cIdx)}
                    onTouchStart={(e) => handleTouchStart(e, rIdx, cIdx)}
                    animate={
                      justFound
                        ? {
                            scale: [1, 1.25, 1.05, 1],
                            rotate: [0, -3, 3, 0]
                          }
                        : isCurrentSelected
                        ? { scale: 1.08 }
                        : { scale: 1 }
                    }
                    transition={
                      justFound
                        ? {
                            duration: 0.5,
                            delay: (justFound.index || 0) * 0.05,
                            ease: 'easeOut'
                          }
                        : { duration: 0.15 }
                    }
                    className={`relative w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl text-xs sm:text-base font-extrabold flex items-center justify-center transition-colors duration-150 cursor-pointer border select-none ${cellStyle}`}
                  >
                    {/* Flash Light Ripple on Found */}
                    {justFound && (
                      <motion.span
                        initial={{ opacity: 0.9, scale: 0.7 }}
                        animate={{ opacity: 0, scale: 1.6 }}
                        transition={{
                          duration: 0.6,
                          delay: (justFound.index || 0) * 0.05,
                          ease: 'easeOut'
                        }}
                        className="absolute inset-0 rounded-lg sm:rounded-xl bg-white pointer-events-none ring-2 ring-white/90 z-10"
                      />
                    )}

                    {/* Subtle Mini Checkmark Pop on Found */}
                    {justFound && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0, y: 3 }}
                        animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0.9], y: 0 }}
                        transition={{
                          duration: 0.35,
                          delay: (justFound.index || 0) * 0.05 + 0.05,
                          ease: 'backOut'
                        }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-400 text-slate-950 rounded-full flex items-center justify-center shadow-xs text-[8px] sm:text-[9px] font-black z-20 pointer-events-none ring-1 ring-white"
                      >
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                      </motion.span>
                    )}

                    <span className="relative z-0">{cell.letter}</span>
                  </motion.button>
                );
              })
            )}
          </div>

          {/* Current Selection Live Word Preview */}
          <div className="mt-4 flex items-center gap-2 h-8">
            {selectedCells.length > 0 ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-4 py-1 rounded-full bg-purple-100 text-purple-900 border border-purple-200 text-xs font-black tracking-widest uppercase flex items-center gap-1.5 shadow-2xs"
              >
                <span>Selecting:</span>
                <span className="text-purple-700 font-mono">
                  {selectedCells.map(c => grid[c.row][c.col].letter).join('')}
                </span>
              </motion.div>
            ) : (
              <span className="text-xs font-semibold text-slate-400">
                Tap and drag across letters to form words
              </span>
            )}
          </div>
        </div>

        {/* TARGET WORDS LIST & WORD INSPECTION CARD */}
        <div className="lg:col-span-4 space-y-3.5">
          {/* Target Words Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Target Words ({foundCount}/{totalCount})</span>
              </h3>
              <span className="text-[10px] font-black font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                {progressPercent}% Complete
              </span>
            </div>

            {/* Word Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {targetWords.map((tw, idx) => {
                const lightBg = PALETTE_BG_LIGHT[idx % PALETTE_BG_LIGHT.length];

                return (
                  <motion.div
                    key={tw.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => {
                      setInspectedWord(tw);
                      speakWord(tw.word);
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      tw.isFound
                        ? `${lightBg} shadow-2xs`
                        : 'bg-slate-50 border-slate-200/70 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${
                          tw.isFound ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {tw.isFound ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <span
                          className={`text-xs font-black block truncate tracking-wide ${
                            tw.isFound ? 'line-through opacity-80' : 'text-slate-800'
                          }`}
                        >
                          {tw.word}
                        </span>
                        {tw.isFound && (
                          <span className="text-[10px] font-medium text-slate-600 truncate block">
                            {tw.meaning}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakWord(tw.word);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-indigo-600 transition"
                      title="Pronounce Word"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Inspected Word Vocabulary Details Card */}
          <AnimatePresence mode="wait">
            {inspectedWord && (
              <motion.div
                key={inspectedWord.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border border-indigo-700/40 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-bold uppercase">
                      Vocabulary Card
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakWord(inspectedWord.word)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1 text-[11px] font-bold"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Listen</span>
                  </button>
                </div>

                <div>
                  <h4 className="text-lg font-black text-amber-300 tracking-wide">
                    {inspectedWord.word}
                  </h4>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">
                    {inspectedWord.meaning}
                  </p>
                </div>

                {inspectedWord.synonyms && (
                  <div className="text-xs text-indigo-200 font-medium bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="font-bold text-indigo-300">Synonyms: </span>
                    <span>{inspectedWord.synonyms}</span>
                  </div>
                )}

                {inspectedWord.example && (
                  <div className="text-xs text-slate-300 italic">
                    "{inspectedWord.example}"
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Victory Celebration Modal */}
      <AnimatePresence>
        {isGameOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-5"
            >
              <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-md shadow-amber-200">
                <Trophy className="w-9 h-9" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Puzzle Solved! 🎉
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                  You found all {totalCount} vocabulary words in {formatTime(timeElapsed)}!
                </p>
              </div>

              {/* Game Stats Summary */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-150">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Words</span>
                  <span className="text-base font-black text-slate-800">{totalCount}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Time</span>
                  <span className="text-base font-black text-slate-800 font-mono">{formatTime(timeElapsed)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Score</span>
                  <span className="text-base font-black text-purple-600 font-mono">{score} pts</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition cursor-pointer"
                >
                  Games Hub
                </button>
                <button
                  type="button"
                  onClick={generateGame}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition cursor-pointer shadow-md shadow-purple-200 flex items-center justify-center gap-2"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Next Puzzle</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
