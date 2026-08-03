import React, { useState, useMemo } from 'react';
import { VocabularyWord, UserProgress, CustomFolder, AppSettings, WordStatus } from '../types';
import FlashcardViewer from './FlashcardViewer';
import { 
  RotateCcw, Clock, CheckCircle2, CalendarCheck, Sparkles, Play, 
  ArrowLeft, Layers, BookOpen, Volume2, Search, SlidersHorizontal, ShieldCheck, Zap
} from 'lucide-react';

interface RevisionCenterProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  folders: CustomFolder[];
  streak: number;
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
  settings: AppSettings;
  onUpdateSettings?: (settings: AppSettings) => void;
  placeLabels?: any;
  googleSearchQuery?: string;
  isRestrictedLocked?: boolean;
  freeFlashcardsCount?: number;
  coursePrice?: number;
  courseTitle?: string;
  onUnlockCourse?: () => void;
}

export default function RevisionCenter({
  words,
  progress,
  folders,
  streak,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark,
  settings,
  onUpdateSettings,
  placeLabels,
  googleSearchQuery,
  isRestrictedLocked,
  freeFlashcardsCount,
  coursePrice,
  courseTitle,
  onUnlockCourse
}: RevisionCenterProps) {
  // Session active state & active words for flashcard revision
  const [activeRevisionWords, setActiveRevisionWords] = useState<VocabularyWord[] | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>('Revision Session');
  const [selectedStageFilter, setSelectedStageFilter] = useState<'all_due' | '1day' | '3days' | '7days' | '15days' | 'long_term' | 'all_know'>('all_due');
  const [searchTerm, setSearchTerm] = useState('');

  const now = Date.now();

  // Filter all words marked as 'know'
  const knowWords = useMemo(() => {
    return words.filter(w => progress[w.id]?.status === 'know');
  }, [words, progress]);

  // Categorize know words by interval since last updated
  const { due1Day, due3Days, due7Days, due15Days, dueLongTerm, allDueWords } = useMemo(() => {
    const d1: VocabularyWord[] = [];
    const d3: VocabularyWord[] = [];
    const d7: VocabularyWord[] = [];
    const d15: VocabularyWord[] = [];
    const dLong: VocabularyWord[] = [];
    const due: VocabularyWord[] = [];

    knowWords.forEach(w => {
      const updatedAtStr = progress[w.id]?.updatedAt;
      if (!updatedAtStr) {
        // If no updatedAt, consider due after 1 day
        d1.push(w);
        due.push(w);
        return;
      }

      const updatedAtMs = new Date(updatedAtStr).getTime();
      const diffHours = (now - updatedAtMs) / (1000 * 60 * 60);
      const diffDays = diffHours / 24;

      if (diffDays >= 1) {
        d1.push(w);
        due.push(w);
      }
      if (diffDays >= 3) {
        d3.push(w);
      }
      if (diffDays >= 7) {
        d7.push(w);
        dLong.push(w);
      }
      if (diffDays >= 15) {
        d15.push(w);
      }
    });

    return {
      due1Day: d1,
      due3Days: d3,
      due7Days: d7,
      due15Days: d15,
      dueLongTerm: dLong,
      allDueWords: due
    };
  }, [knowWords, progress, now]);

  // Start Revision Session with selected subset
  const startRevisionSession = (subset: VocabularyWord[], title: string) => {
    if (subset.length === 0) return;
    setActiveRevisionWords(subset);
    setSessionTitle(title);
  };

  // Speak word
  const speakWord = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // Filtered list for search display
  const currentStageWords = useMemo(() => {
    let list: VocabularyWord[] = [];
    if (selectedStageFilter === 'all_due') list = allDueWords;
    else if (selectedStageFilter === '1day') list = due1Day;
    else if (selectedStageFilter === '3days') list = due3Days;
    else if (selectedStageFilter === '7days') list = due7Days;
    else if (selectedStageFilter === '15days') list = due15Days;
    else if (selectedStageFilter === 'long_term') list = dueLongTerm;
    else if (selectedStageFilter === 'all_know') list = knowWords;

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(w => 
      w.word.toLowerCase().includes(q) || 
      w.meaning.toLowerCase().includes(q) ||
      (w.synonyms && w.synonyms.toLowerCase().includes(q))
    );
  }, [selectedStageFilter, allDueWords, due1Day, due3Days, due7Days, due15Days, dueLongTerm, knowWords, searchTerm]);

  // Format relative time helper
  const getRelativeTimeText = (updatedAtStr?: string) => {
    if (!updatedAtStr) return 'Not reviewed';
    const updatedAtMs = new Date(updatedAtStr).getTime();
    const diffMin = Math.floor((now - updatedAtMs) / (1000 * 60));
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays >= 1) return `${diffDays}d ago`;
    if (diffHours >= 1) return `${diffHours}h ago`;
    if (diffMin >= 1) return `${diffMin}m ago`;
    return 'Just now';
  };

  // If revision session is active, render FlashcardViewer with activeRevisionWords
  if (activeRevisionWords && activeRevisionWords.length > 0) {
    return (
      <div className="space-y-3 max-w-5xl mx-auto px-1.5 sm:px-4 py-2 sm:py-3" style={{ fontFamily: "'Poppins', sans-serif" }}>
        {/* Session Top Bar */}
        <div className="flex items-center justify-between bg-white border border-slate-200 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setActiveRevisionWords(null)}
              className="p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg sm:rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] sm:text-xs font-black border border-slate-200 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-black text-slate-900 flex items-center gap-1.5 truncate">
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                <span className="truncate">{sessionTitle}</span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                {activeRevisionWords.length} words auto-revision active
              </p>
            </div>
          </div>

          <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 sm:px-3 sm:py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full shrink-0">
            {activeRevisionWords.length} Cards
          </span>
        </div>

        {/* Embedded FlashcardViewer */}
        <FlashcardViewer
          words={activeRevisionWords}
          progress={progress}
          folders={folders}
          streak={streak}
          onRateWord={onRateWord}
          onUpdateNotes={onUpdateNotes}
          onToggleBookmark={onToggleBookmark}
          initialGroup={null}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          placeLabels={placeLabels}
          googleSearchQuery={googleSearchQuery}
          isRestrictedLocked={isRestrictedLocked}
          freeFlashcardsCount={freeFlashcardsCount}
          coursePrice={coursePrice}
          courseTitle={courseTitle}
          onUnlockCourse={onUnlockCourse}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6 max-w-5xl mx-auto px-1.5 sm:px-4 py-2 sm:py-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* Top Banner Header - Compact for Mobile */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-7 shadow-lg relative overflow-hidden border border-emerald-500/20">
        <div className="relative z-10 space-y-2 sm:space-y-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-extrabold text-[9px] sm:text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1 backdrop-blur-md">
              <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" /> Spaced Repetition
            </span>
            <span className="text-[10px] sm:text-xs font-mono text-emerald-200/80">• Know Words Review</span>
          </div>

          <div className="space-y-0.5 sm:space-y-1 max-w-2xl">
            <h1 className="text-base sm:text-3xl font-black text-white tracking-tight">
              Smart Revision Center
            </h1>
            <p className="text-[11px] sm:text-sm text-emerald-100 font-medium leading-tight sm:leading-relaxed">
              Automated reviews for <strong className="text-emerald-300">"Know"</strong> words at 1, 3, 7, and 15-day intervals.
            </p>
          </div>

          {/* Quick Start Buttons */}
          <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled={allDueWords.length === 0}
              onClick={() => startRevisionSession(allDueWords, 'All Due Words Revision')}
              className={`px-3 py-1.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black transition flex items-center gap-1.5 shadow-md ${
                allDueWords.length > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-emerald-500/25 active:scale-95'
                  : 'bg-white/10 text-slate-400 cursor-not-allowed border border-white/10'
              }`}
            >
              <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-current text-slate-950" />
              <span>Start All Due ({allDueWords.length})</span>
            </button>

            <button
              type="button"
              disabled={knowWords.length === 0}
              onClick={() => startRevisionSession(knowWords, 'All Know Words Revision')}
              className="px-2.5 py-1.5 sm:px-4 sm:py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-bold transition cursor-pointer border border-white/20 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>All Know ({knowWords.length})</span>
            </button>
          </div>
        </div>

        {/* Background Decorative Accent */}
        <div className="absolute right-[-10px] bottom-[-10px] sm:right-[-20px] sm:bottom-[-20px] opacity-10 pointer-events-none">
          <RotateCcw className="w-32 h-32 sm:w-64 sm:h-64 text-white" />
        </div>
      </div>

      {/* Overview Metric Cards - 2x2 Grid on Mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {/* Total Know Words */}
        <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs space-y-0.5 sm:space-y-1">
          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block truncate">
            Total Known
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-lg sm:text-2xl font-black text-slate-900">{knowWords.length}</p>
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0" />
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium truncate">Tagged as Know</p>
        </div>

        {/* Due Today */}
        <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs space-y-0.5 sm:space-y-1">
          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-amber-600 tracking-wider block truncate">
            Due Review
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-lg sm:text-2xl font-black text-amber-600">{allDueWords.length}</p>
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium truncate">≥ 1 day elapsed</p>
        </div>

        {/* 7 Days Stage */}
        <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs space-y-0.5 sm:space-y-1">
          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider block truncate">
            7-Day Stage
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-lg sm:text-2xl font-black text-indigo-600">{due7Days.length}</p>
            <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 shrink-0" />
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium truncate">≥ 7 days elapsed</p>
        </div>

        {/* 15 Days Stage */}
        <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs space-y-0.5 sm:space-y-1">
          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-purple-600 tracking-wider block truncate">
            15-Day Stage
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-lg sm:text-2xl font-black text-purple-600">{due15Days.length}</p>
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 shrink-0" />
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium truncate">≥ 15 days elapsed</p>
        </div>
      </div>

      {/* FOCUS INTERVAL FILTER TOGGLE BAR - Compact Mobile Bar */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-md border border-slate-800 space-y-2 sm:space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-indigo-500/20 text-indigo-400 rounded-lg sm:rounded-xl border border-indigo-500/30 shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
                Focus Mode
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium hidden sm:block">
                Isolate study time specifically for immediate 1-day items or long-term retention
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto bg-slate-950/70 p-1 rounded-lg sm:rounded-xl border border-slate-800 text-[10px] sm:text-xs">
            <button
              type="button"
              onClick={() => setSelectedStageFilter('1day')}
              className={`flex-1 sm:flex-initial px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                selectedStageFilter === '1day'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>1-Day ({due1Day.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('long_term')}
              className={`flex-1 sm:flex-initial px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                selectedStageFilter === 'long_term'
                  ? 'bg-indigo-500 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Long-Term ({dueLongTerm.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('all_due')}
              className={`flex-1 sm:flex-initial px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                selectedStageFilter === 'all_due'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>All ({allDueWords.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 STAGE CARDS GRID - 2 Columns on Mobile for Single Screen View */}
      <div className="space-y-2 sm:space-y-3">
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
          <span>Revision Stages & Intervals</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {/* Stage 1: 1 Day */}
          <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 space-y-1.5 sm:space-y-3 shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1 sm:pb-2">
              <span className="text-[11px] sm:text-xs font-black text-slate-800">1-Day</span>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                {due1Day.length} Words
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-slate-500 leading-relaxed font-medium">
              Review words marked as "Know" that have passed 1 day since last review.
            </p>
            <button
              type="button"
              disabled={due1Day.length === 0}
              onClick={() => startRevisionSession(due1Day, '1-Day Revision Session')}
              className={`w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-extrabold transition flex items-center justify-center gap-1 ${
                due1Day.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-95'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              <span>Review ({due1Day.length})</span>
            </button>
          </div>

          {/* Stage 2: 3 Days */}
          <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 space-y-1.5 sm:space-y-3 shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1 sm:pb-2">
              <span className="text-[11px] sm:text-xs font-black text-slate-800">3-Day</span>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                {due3Days.length} Words
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-slate-500 leading-relaxed font-medium">
              Reinforce words studied 3 days ago for second-stage memory retention.
            </p>
            <button
              type="button"
              disabled={due3Days.length === 0}
              onClick={() => startRevisionSession(due3Days, '3-Days Revision Session')}
              className={`w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-extrabold transition flex items-center justify-center gap-1 ${
                due3Days.length > 0
                  ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs active:scale-95'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              <span>Review ({due3Days.length})</span>
            </button>
          </div>

          {/* Stage 3: 7 Days */}
          <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 space-y-1.5 sm:space-y-3 shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1 sm:pb-2">
              <span className="text-[11px] sm:text-xs font-black text-slate-800">7-Day</span>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                {due7Days.length} Words
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-slate-500 leading-relaxed font-medium">
              Consolidate words into long-term memory after 1 week.
            </p>
            <button
              type="button"
              disabled={due7Days.length === 0}
              onClick={() => startRevisionSession(due7Days, '7-Days Revision Session')}
              className={`w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-extrabold transition flex items-center justify-center gap-1 ${
                due7Days.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs active:scale-95'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              <span>Review ({due7Days.length})</span>
            </button>
          </div>

          {/* Stage 4: 15 Days */}
          <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 space-y-1.5 sm:space-y-3 shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1 sm:pb-2">
              <span className="text-[11px] sm:text-xs font-black text-slate-800">15-Day</span>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                {due15Days.length} Words
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-slate-500 leading-relaxed font-medium">
              Final mastery review for words after 15 days of retention.
            </p>
            <button
              type="button"
              disabled={due15Days.length === 0}
              onClick={() => startRevisionSession(due15Days, '15-Days Revision Session')}
              className={`w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-extrabold transition flex items-center justify-center gap-1 ${
                due15Days.length > 0
                  ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs active:scale-95'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              <span>Review ({due15Days.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & WORD LIST TABLE / CARDS - Compact Rows */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-3 sm:p-6 space-y-2.5 sm:space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 sm:pb-4">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              Revision List ({currentStageWords.length})
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px] sm:text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedStageFilter('all_due')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === 'all_due'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Due ({allDueWords.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('1day')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === '1day'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              1 Day ({due1Day.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('long_term')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === 'long_term'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Long-Term ({dueLongTerm.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('3days')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === '3days'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              3 Days ({due3Days.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('7days')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === '7days'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              7 Days ({due7Days.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('15days')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === '15days'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              15 Days ({due15Days.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('all_know')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === 'all_know'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Know ({knowWords.length})
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search word or meaning..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Word List Items */}
        {currentStageWords.length === 0 ? (
          <div className="py-8 text-center space-y-1 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500 mx-auto opacity-80" />
            <p className="text-xs font-bold text-slate-700">
              {knowWords.length === 0 
                ? 'No words marked as "Know" yet.'
                : 'No pending revisions under this filter!'}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
              Mark words as "Know" during study to include them in revision.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2.5">
            {currentStageWords.map((word) => {
              const p = progress[word.id];

              return (
                <div
                  key={word.id}
                  className="p-2 sm:p-3 bg-slate-50/80 hover:bg-slate-100 border border-slate-200/80 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2 transition"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 font-sans truncate">
                        {word.word}
                      </h4>
                      <button
                        type="button"
                        onClick={(e) => speakWord(word.word, e)}
                        className="text-indigo-600 hover:text-indigo-800 transition shrink-0"
                      >
                        <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] sm:text-xs font-semibold text-emerald-700 truncate">
                      {word.meaning}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono">
                      {getRelativeTimeText(p?.updatedAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => startRevisionSession([word], `Revision: ${word.word}`)}
                    className="p-1.5 sm:p-2 bg-white hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-200 hover:border-indigo-600 rounded-lg sm:rounded-xl transition cursor-pointer shrink-0 shadow-2xs"
                    title="Start single word flashcard review"
                  >
                    <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
