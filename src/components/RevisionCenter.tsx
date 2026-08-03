import React, { useState, useMemo } from 'react';
import { VocabularyWord, UserProgress, CustomFolder, AppSettings, WordStatus } from '../types';
import FlashcardViewer from './FlashcardViewer';
import { 
  RotateCcw, Clock, CheckCircle2, CalendarCheck, Sparkles, Play, 
  ArrowLeft, Layers, BookOpen, Volume2, Search
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
  const [selectedStageFilter, setSelectedStageFilter] = useState<'all_due' | '1day' | '3days' | '7days' | '15days' | 'all_know'>('all_due');
  const [searchTerm, setSearchTerm] = useState('');

  const now = Date.now();

  // Filter all words marked as 'know'
  const knowWords = useMemo(() => {
    return words.filter(w => progress[w.id]?.status === 'know');
  }, [words, progress]);

  // Categorize know words by interval since last updated
  const { due1Day, due3Days, due7Days, due15Days, allDueWords } = useMemo(() => {
    const d1: VocabularyWord[] = [];
    const d3: VocabularyWord[] = [];
    const d7: VocabularyWord[] = [];
    const d15: VocabularyWord[] = [];
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
    else if (selectedStageFilter === 'all_know') list = knowWords;

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(w => 
      w.word.toLowerCase().includes(q) || 
      w.meaning.toLowerCase().includes(q) ||
      (w.synonyms && w.synonyms.toLowerCase().includes(q))
    );
  }, [selectedStageFilter, allDueWords, due1Day, due3Days, due7Days, due15Days, knowWords, searchTerm]);

  // Format relative time helper
  const getRelativeTimeText = (updatedAtStr?: string) => {
    if (!updatedAtStr) return 'Not reviewed yet';
    const updatedAtMs = new Date(updatedAtStr).getTime();
    const diffMin = Math.floor((now - updatedAtMs) / (1000 * 60));
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays >= 1) return `${diffDays} দিন আগে (Know marked)`;
    if (diffHours >= 1) return `${diffHours} ঘণ্টা আগে`;
    if (diffMin >= 1) return `${diffMin} মিনিট আগে`;
    return 'এইমাত্র';
  };

  // If revision session is active, render FlashcardViewer with activeRevisionWords
  if (activeRevisionWords && activeRevisionWords.length > 0) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto px-2 sm:px-4 py-3">
        {/* Session Top Bar */}
        <div className="flex items-center justify-between bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveRevisionWords(null)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-black border border-slate-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Revision Hub</span>
            </button>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-600" />
                <span>{sessionTitle}</span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {activeRevisionWords.length}টি শব্দের অটো রিভিশন সেশন চলছে
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-bold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
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
    <div className="space-y-6 max-w-5xl mx-auto px-2 sm:px-4 py-4" style={{ fontFamily: "'Poppins', 'Hind Siliguri', sans-serif" }}>
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-extrabold text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" /> Auto Spaced Repetition
            </span>
            <span className="text-xs font-mono text-emerald-200/80">• Know Words Review</span>
          </div>

          <div className="space-y-1 max-w-2xl">
            <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
              স্মার্ট রিভিশন সেন্টার (Spaced Repetition)
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
              আপনার চিহ্নিত <strong className="text-emerald-300">"Know"</strong> শব্দের দীর্ঘমেয়াদী মেমরি নিশ্চিত করতে ১ দিন, ৩ দিন, ৭ দিন ও ১৫ দিন পর পর রিভিশন নিন।
            </p>
          </div>

          {/* Quick Start All Due Button */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={allDueWords.length === 0}
              onClick={() => startRevisionSession(allDueWords, 'All Due Words Revision')}
              className={`px-5 py-3 rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-lg ${
                allDueWords.length > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-emerald-500/25 active:scale-95'
                  : 'bg-white/10 text-slate-400 cursor-not-allowed border border-white/10'
              }`}
            >
              <Play className="w-4 h-4 fill-current text-slate-950" />
              <span>আজকের সকল রিভিশন শুরু করুন ({allDueWords.length}টি)</span>
            </button>

            <button
              type="button"
              disabled={knowWords.length === 0}
              onClick={() => startRevisionSession(knowWords, 'All Know Words Revision')}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition cursor-pointer border border-white/20 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>সকল Know ওয়ার্ড রিভিশন ({knowWords.length}টি)</span>
            </button>
          </div>
        </div>

        {/* Background Decorative Accent */}
        <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
          <RotateCcw className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Know Words */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
            মোট জানা শব্দ
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-slate-900">{knowWords.length}</p>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-[10px] text-slate-500 font-medium">Tagged as Know</p>
        </div>

        {/* Due Today */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-amber-600 tracking-wider">
            আজকে রিভিশন দেওয়া লাগবে
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-amber-600">{allDueWords.length}</p>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-[10px] text-slate-500 font-medium">≥ 1 day since last review</p>
        </div>

        {/* 7 Days Stage */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider">
            ৭ দিন পর রিভিশন
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-indigo-600">{due7Days.length}</p>
            <CalendarCheck className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-[10px] text-slate-500 font-medium">≥ 7 days elapsed</p>
        </div>

        {/* 15 Days Stage */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-purple-600 tracking-wider">
            ১৫ দিন পর রিভিশন
          </span>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-purple-600">{due15Days.length}</p>
            <Sparkles className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-[10px] text-slate-500 font-medium">≥ 15 days elapsed</p>
        </div>
      </div>

      {/* 4 STAGE CARDS GRID */}
      <div className="space-y-3">
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>রিভিশন ইন্টারভাল ধাপসমূহ (Revision Stages)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stage 1: 1 Day */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800">১ দিন পর রিভিশন</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                {due1Day.length} Words
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              শব্দগুলো Know মার্ক করার ১ দিন পার হওয়া কার্ডগুলো রিভিশন দিন।
            </p>
            <button
              type="button"
              disabled={due1Day.length === 0}
              onClick={() => startRevisionSession(due1Day, '1-Day Revision Session')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                due1Day.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-95'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>১ দিনের রিভিশন ({due1Day.length})</span>
            </button>
          </div>

          {/* Stage 2: 3 Days */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800">৩ দিন পর রিভিশন</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                {due3Days.length} Words
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              ৩ দিন আগে পড়া শব্দগুলো দ্বিতীয় রাউন্ডে স্মৃতিতে পাকা করুন।
            </p>
            <button
              type="button"
              disabled={due3Days.length === 0}
              onClick={() => startRevisionSession(due3Days, '3-Days Revision Session')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                due3Days.length > 0
                  ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs active:scale-95'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>৩ দিনের রিভিশন ({due3Days.length})</span>
            </button>
          </div>

          {/* Stage 3: 7 Days */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800">৭ দিন পর রিভিশন</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                {due7Days.length} Words
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              ১ সপ্তাহ পর ৩য় রাউন্ডের মাধ্যমে লং-টার্ম মেমরিতে স্থায়ী করুন।
            </p>
            <button
              type="button"
              disabled={due7Days.length === 0}
              onClick={() => startRevisionSession(due7Days, '7-Days Revision Session')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                due7Days.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs active:scale-95'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>৭ দিনের রিভিশন ({due7Days.length})</span>
            </button>
          </div>

          {/* Stage 4: 15 Days */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800">১৫ দিন পর রিভিশন</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                {due15Days.length} Words
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              ১৫ দিন পরের চূড়ান্ত রিভিশন দিয়ে মাস্টার লেভেলে নিশ্চিত করুন।
            </p>
            <button
              type="button"
              disabled={due15Days.length === 0}
              onClick={() => startRevisionSession(due15Days, '15-Days Revision Session')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                due15Days.length > 0
                  ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs active:scale-95'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>১৫ দিনের রিভিশন ({due15Days.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & WORD LIST TABLE / CARDS */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              রিভিশন তালিকা ({currentStageWords.length} Words)
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedStageFilter('all_due')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === 'all_due'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              আজকে Due ({allDueWords.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('1day')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === '1day'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ১ দিন ({due1Day.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('3days')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === '3days'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ৩ দিন ({due3Days.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('7days')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === '7days'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ৭ দিন ({due7Days.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('15days')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === '15days'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ১৫ দিন ({due15Days.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStageFilter('all_know')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedStageFilter === 'all_know'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              সকল Know ({knowWords.length})
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="খুঁজুন (Word or Meaning)..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Word List Items */}
        {currentStageWords.length === 0 ? (
          <div className="py-12 text-center space-y-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
            <p className="text-xs font-bold text-slate-700">
              {knowWords.length === 0 
                ? 'এখনো কোন শব্দকে "Know" ট্যাগ করা হয়নি।'
                : 'এই ফিল্টারে বর্তমানে কোন রিভিশন বাকি নেই!'}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              ফ্ল্যাশকার্ডে রিভিশন দেওয়ার সময় শব্দগুলোকে "Know" ট্যাগ দিন।
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {currentStageWords.map((word) => {
              const p = progress[word.id];

              return (
                <div
                  key={word.id}
                  className="p-3 bg-slate-50/80 hover:bg-slate-100 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 transition"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900 font-sans">
                        {word.word}
                      </h4>
                      <button
                        type="button"
                        onClick={(e) => speakWord(word.word, e)}
                        className="text-indigo-600 hover:text-indigo-800 transition"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-emerald-700 truncate">
                      {word.meaning}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {getRelativeTimeText(p?.updatedAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => startRevisionSession([word], `Revision: ${word.word}`)}
                    className="p-2 bg-white hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-200 hover:border-indigo-600 rounded-xl transition cursor-pointer shrink-0 shadow-2xs"
                    title="Start single word flashcard review"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
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
