import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Course, VocabularyWord, UserProgress 
} from '../types';
import { 
  X, Sparkles, Volume2, BookOpen, CheckCircle, HelpCircle, 
  Gamepad2, Shuffle, GraduationCap, Play, ShoppingBag, 
  RotateCcw, Check, Lock, ChevronLeft, ChevronRight,
  Layers, Quote
} from 'lucide-react';
import FlashcardExactPreview from './FlashcardExactPreview';

interface CoursePreviewModalProps {
  key?: string;
  course: Course | null;
  isOpen: boolean;
  onClose: () => void;
  isEnrolled: boolean;
  isUserAllowed: boolean;
  isActive: boolean;
  onStartFlashcards: () => void;
  onBuyCourse: () => void;
  onFreeEnroll: () => void;
  onOpenFreeSample: () => void;
  sampleUsed: boolean;
  progress?: Record<string, UserProgress>;
  onSetActive?: () => void;
}

export default function CoursePreviewModal({
  course,
  isOpen,
  onClose,
  isEnrolled,
  isUserAllowed,
  isActive,
  onStartFlashcards,
  onBuyCourse,
  onFreeEnroll,
  onOpenFreeSample,
  sampleUsed,
  progress = {},
  onSetActive
}: CoursePreviewModalProps) {
  // Mobile Flashcard active index (0, 1, or 2)
  const [mobileCardIndex, setMobileCardIndex] = useState(0);

  // Flipped state for the 3 top flashcards [card0, card1, card2]
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  // Interactive Glimpse States
  // 1. Blank Filling State
  const [blankSelectedOption, setBlankSelectedOption] = useState<string | null>(null);

  // 2. Word Match State
  const [matchSelectedLeft, setMatchSelectedLeft] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [matchFeedback, setMatchFeedback] = useState<string | null>(null);

  // 3. Odd One Out State
  const [oddSelectedOption, setOddSelectedOption] = useState<string | null>(null);

  // 4. MCQ Quiz State
  const [mcqSelectedOption, setMcqSelectedOption] = useState<string | null>(null);

  // Reset interactive states when course changes
  useEffect(() => {
    setMobileCardIndex(0);
    setFlippedCards({});
    setBlankSelectedOption(null);
    setMatchSelectedLeft(null);
    setMatchedPairs({});
    setMatchFeedback(null);
    setOddSelectedOption(null);
    setMcqSelectedOption(null);
  }, [course?.id]);

  if (!isOpen || !course) return null;

  const words = course.words || [];
  const wordsCount = words.length || 0;

  // Extract up to 3 flashcards
  const fallbackWords: VocabularyWord[] = [
    {
      id: 'preview-1',
      word: 'Abundant',
      meaning: 'প্রচুর, সমৃদ্ধশালী',
      pronunciation: '/əˈbʌn.dənt/',
      synonyms: 'Plentiful, Ample, Copious',
      extraWord: 'Abundance',
      extraMeaning: 'প্রাচুর্য',
      example: 'The region is blessed with abundant natural resources.',
      group: 1
    },
    {
      id: 'preview-2',
      word: 'Benevolent',
      meaning: 'দয়ালু, পরোপকারী',
      pronunciation: '/bəˈnev.əl.ənt/',
      synonyms: 'Kind, Generous, Compassionate',
      extraWord: 'Benevolence',
      extraMeaning: 'দয়ালুতা',
      example: 'The benevolent donor helped hundreds of students.',
      group: 1
    },
    {
      id: 'preview-3',
      word: 'Candid',
      meaning: 'সরাসরি, স্পষ্টভাষী, অকপট',
      pronunciation: '/ˈkæn.dɪd/',
      synonyms: 'Frank, Honest, Straightforward',
      extraWord: 'Candor',
      extraMeaning: 'অকপটতা',
      example: 'She gave a candid opinion about the new proposal.',
      group: 1
    }
  ];

  const previewWords: VocabularyWord[] = words.slice(0, 3).map((w, idx) => ({
    id: w.id || `word-${idx}`,
    word: w.word || `Word ${idx + 1}`,
    meaning: w.meaning || (w as any).place2 || fallbackWords[idx % 3].meaning,
    pronunciation: w.pronunciation || fallbackWords[idx % 3].pronunciation,
    synonyms: w.synonyms || (w as any).place5 || fallbackWords[idx % 3].synonyms,
    example: w.example || (w as any).place3 || fallbackWords[idx % 3].example,
    extraWord: w.extraWord || (w as any).place4 || fallbackWords[idx % 3].extraWord,
    extraMeaning: w.extraMeaning || (w as any).place6 || fallbackWords[idx % 3].extraMeaning,
    group: w.group || 1
  }));

  // Ensure 3 preview words
  while (previewWords.length < 3) {
    const padIdx = previewWords.length;
    previewWords.push(fallbackWords[padIdx]);
  }

  // Audio Pronunciation Helper
  const speakWord = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const toggleCardFlip = (idx: number) => {
    setFlippedCards(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // --- GLIMPSE DATA BUILDERS ---

  // A. Blank Filling Data
  const sampleBlankWord = previewWords[0];
  const blankQuestion = {
    sentence: `The speaker made an exceptionally _____ address that moved the entire audience.`,
    correctWord: sampleBlankWord.word,
    options: [
      sampleBlankWord.word,
      previewWords[1]?.word || 'Fragile',
      previewWords[2]?.word || 'Lethargic',
      'Obsolete'
    ].sort(() => 0.5 - Math.random())
  };

  // B. Word Match Data (3 Rows)
  const matchLeftItems = [
    { id: 'm1', text: previewWords[0].word, targetId: 'b1' },
    { id: 'm2', text: previewWords[1].word, targetId: 'b2' },
    { id: 'm3', text: previewWords[2].word, targetId: 'b3' }
  ];

  const matchRightItems = [
    { id: 'b2', text: previewWords[1].meaning, matchId: 'm2' },
    { id: 'b1', text: previewWords[0].meaning, matchId: 'm1' },
    { id: 'b3', text: previewWords[2].meaning, matchId: 'm3' }
  ];

  const handleMatchLeftClick = (leftId: string) => {
    setMatchSelectedLeft(leftId);
    setMatchFeedback(null);
  };

  const handleMatchRightClick = (rightItem: { id: string; text: string; matchId: string }) => {
    if (!matchSelectedLeft) return;
    if (matchSelectedLeft === rightItem.matchId) {
      setMatchedPairs(prev => ({ ...prev, [matchSelectedLeft]: rightItem.id }));
      setMatchFeedback('✓ সঠিক জোড়া মিলেছে!');
      setMatchSelectedLeft(null);
    } else {
      setMatchFeedback('✗ ভুল জোড়া! আবার চেষ্টা করুন।');
    }
  };

  // C. Odd One Out Data
  const oddQuestion = {
    word: previewWords[0].word,
    prompt: `নিচের চারটি শব্দের মধ্যে কোন শব্দটি অমিল (Odd One Out)?`,
    options: [
      { text: previewWords[0].synonyms?.split(',')[0] || 'Plentiful', isOdd: false },
      { text: previewWords[0].synonyms?.split(',')[1] || 'Ample', isOdd: false },
      { text: 'Scarcity (স্বল্পতা)', isOdd: true },
      { text: 'Copious', isOdd: false }
    ]
  };

  // D. MCQ Quiz Data
  const mcqTarget = previewWords[1];
  const mcqQuestion = {
    question: `What is the meaning of "${mcqTarget.word}"?`,
    options: [
      { text: mcqTarget.meaning, isCorrect: true },
      { text: 'কঠিন বা দুর্গম এলাকা', isCorrect: false },
      { text: 'সাময়িক অথবা অস্থায়ী', isCorrect: false },
      { text: 'অহংকারী ও উদ্ধত আচরণ', isCorrect: false }
    ].sort(() => 0.5 - Math.random())
  };

  // E. Story Data Preview
  const storyPreview = (course.stories && course.stories.length > 0) ? course.stories[0] : {
    title: `${course.title} Vocabulary Narrative`,
    content: `Mastering English vocabulary requires active contextual learning. Words like "${previewWords[0].word}" (${previewWords[0].meaning}) and "${previewWords[1].word}" (${previewWords[1].meaning}) open up new avenues for communication. When practiced with "${previewWords[2].word}" (${previewWords[2].meaning}), students build lasting memory hooks.`
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4" id="course-preview-large-modal">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-white text-slate-900 rounded-3xl w-full max-w-4xl lg:max-w-5xl overflow-hidden shadow-2xl relative max-h-[92vh] flex flex-col border border-slate-200"
        style={{ fontFamily: "'Poppins', 'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}
      >
        {/* Sticky Light Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isActive ? (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                  <Check className="w-3 h-3 text-emerald-600" /> Active Course
                </span>
              ) : !isUserAllowed ? (
                <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Lock className="w-3 h-3 text-rose-500" /> Premium Course (৳{(course.price && course.price > 0) ? course.price : 30})
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold text-[10px] rounded-full uppercase tracking-wider">
                  Enrolled
                </span>
              )}
              <span className="text-[10px] text-slate-500 font-mono font-bold">Code: {course.id}</span>
              <span className="text-[10px] text-emerald-600 font-mono font-bold">{wordsCount} Words</span>
            </div>
            
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              {course.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Action Buttons in Header for desktop */}
            {!isUserAllowed ? (
              <button
                type="button"
                onClick={onBuyCourse}
                className="px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-pink-600/20 active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">Buy Course (৳{(course.price && course.price > 0) ? course.price : 30})</span>
                <span className="sm:hidden">Buy</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartFlashcards}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span className="hidden sm:inline">Start Flashcards</span>
                <span className="sm:hidden">Start</span>
              </button>
            )}

            <button 
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition cursor-pointer border border-slate-200/60"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content Body in Light Theme */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-8 flex-1 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-300">
          
          {/* SECTION 1: TOP 3 INTERACTIVE FLASHCARDS (EXACT MAIN FLASHCARD DESIGN & LOGIC) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-indigo-900">
                    ইন্টারেক্টিভ ফ্ল্যাশকার্ড ট্রায়াল (Interactive Flashcard Engine)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    কার্ড উল্টে অর্থ, উচ্চারণ, উদাহরণ ও সমার্থক শব্দ দেখুন এবং রেটিং টেস্ট করুন
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full">
              <FlashcardExactPreview 
                words={course?.words && course.words.length > 0 ? course.words : previewWords}
                courseTitle={course?.title || 'Preview Course'}
                showControls={true}
              />
            </div>
          </section>

          {/* SECTION 2: PRACTICE & GAMES + STUDY TOOLS GLIMPSES */}
          <section className="space-y-5 pt-4 border-t border-slate-200/80">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-900">
                  প্র্যাকটিস, গেমস এবং স্টাডি টুলস গ্লিম্পস (Glimpse of Active Modules)
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  এই কোর্সের অধীনে সচল থাকা বিভিন্ন ইন্টারঅ্যাক্টিভ গেম ও টুলসের একটি নমুনা ট্রায়াল নিন
                </p>
              </div>
            </div>

            {/* A. Read Story Preview */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    ১. গল্পের মাধ্যমে পড়া (Vocabulary Story Preview)
                  </h4>
                </div>
                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  Read Story
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                <h5 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                  <Quote className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{storyPreview.title}</span>
                </h5>
                <p className="text-xs text-slate-700 leading-relaxed font-light italic">
                  "{storyPreview.content.slice(0, 220)}..."
                </p>
              </div>
            </div>

            {/* B. Fill-in-the-Blank Interactive Glimpse */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    ২. শূন্যস্থান পূরণ গেম (Fill in the Blank Glimpse)
                  </h4>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                  Blank Filling
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
                <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
                  {blankQuestion.sentence.replace('_____', '______')}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {blankQuestion.options.map((opt) => {
                    const isSelected = blankSelectedOption === opt;
                    const isCorrect = opt === blankQuestion.correctWord;

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setBlankSelectedOption(opt)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          isSelected
                            ? isCorrect
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-2xs'
                              : 'bg-rose-600 border-rose-500 text-white shadow-2xs'
                            : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {blankSelectedOption && (
                  <div className={`p-2.5 rounded-lg text-xs font-bold flex items-center gap-2 ${
                    blankSelectedOption === blankQuestion.correctWord
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}>
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>
                      {blankSelectedOption === blankQuestion.correctWord
                        ? '✓ চমৎকার! সঠিক উত্তর দিয়েছেন।'
                        : `✗ ভুল উত্তর! সঠিক উত্তর হলো: "${blankQuestion.correctWord}"`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* C. 3-Row Word Match Interactive Glimpse */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-teal-600" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    ৩. ৩-রো শব্দ মেলানো (3-Row Word Match Glimpse)
                  </h4>
                </div>
                <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">
                  Word Match
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
                <p className="text-[11px] text-slate-500 font-medium">
                  বামের ইংরেজি শব্দের সাথে ডানের সঠিক বাংলা অর্থ ক্লিক করে মিলান:
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Left Column */}
                  <div className="space-y-2">
                    {matchLeftItems.map((item) => {
                      const isSelected = matchSelectedLeft === item.id;
                      const isMatched = Boolean(matchedPairs[item.id]);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleMatchLeftClick(item.id)}
                          disabled={isMatched}
                          className={`w-full p-2.5 rounded-xl font-black text-left transition cursor-pointer border ${
                            isMatched
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800 line-through'
                              : isSelected
                              ? 'bg-indigo-600 border-indigo-500 text-white ring-2 ring-indigo-300'
                              : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-900'
                          }`}
                        >
                          {item.text}
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-2">
                    {matchRightItems.map((item) => {
                      const isMatched = Object.values(matchedPairs).includes(item.id);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleMatchRightClick(item)}
                          disabled={isMatched}
                          className={`w-full p-2.5 rounded-xl font-bold text-left transition cursor-pointer border ${
                            isMatched
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800 line-through'
                              : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                          }`}
                        >
                          {item.text}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {matchFeedback && (
                  <p className={`text-xs font-bold pt-1 ${
                    matchFeedback.startsWith('✓') ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {matchFeedback}
                  </p>
                )}
              </div>
            </div>

            {/* D. Odd One Out Interactive Glimpse */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    ৪. অমিল শব্দ নির্বাচন (Odd One Out Glimpse)
                  </h4>
                </div>
                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                  Odd One Out
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
                <p className="text-xs font-semibold text-slate-800">
                  {oddQuestion.prompt} ({oddQuestion.word})
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {oddQuestion.options.map((opt) => {
                    const isSelected = oddSelectedOption === opt.text;

                    return (
                      <button
                        key={opt.text}
                        type="button"
                        onClick={() => setOddSelectedOption(opt.text)}
                        className={`p-2 rounded-xl text-xs font-bold transition cursor-pointer border text-left ${
                          isSelected
                            ? opt.isOdd
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-rose-600 border-rose-500 text-white'
                            : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                        }`}
                      >
                        {opt.text}
                      </button>
                    );
                  })}
                </div>

                {oddSelectedOption && (
                  <p className="text-xs font-bold pt-1 text-indigo-700">
                    {oddSelectedOption === 'Scarcity (স্বল্পতা)'
                      ? '✓ সঠিক! Scarcity হলো বিপরীতার্থক (Odd One Out)।'
                      : '✗ ভুল! সঠিক অমিল শব্দটি হলো: "Scarcity (স্বল্পতা)"।'}
                  </p>
                )}
              </div>
            </div>

            {/* E. Practice Quiz MCQ Interactive Glimpse */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-pink-600" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    ৫. এমসিকিউ প্র্যাকটিস কুইজ (Practice Quiz Glimpse)
                  </h4>
                </div>
                <span className="text-[10px] font-extrabold text-pink-700 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-100">
                  MCQ Quiz
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
                <p className="text-xs sm:text-sm font-black text-slate-900">
                  {mcqQuestion.question}
                </p>

                <div className="space-y-2">
                  {mcqQuestion.options.map((opt, i) => {
                    const isSelected = mcqSelectedOption === opt.text;

                    return (
                      <button
                        key={opt.text}
                        type="button"
                        onClick={() => setMcqSelectedOption(opt.text)}
                        className={`w-full p-2.5 rounded-xl text-xs font-bold transition cursor-pointer border text-left flex items-center justify-between ${
                          isSelected
                            ? opt.isCorrect
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-rose-600 border-rose-500 text-white'
                            : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                        }`}
                      >
                        <span>{String.fromCharCode(65 + i)}. {opt.text}</span>
                        {isSelected && (
                          <span>{opt.isCorrect ? '✓' : '✗'}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </section>

        </div>

        {/* Modal Bottom Light Footer Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-white/95 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 space-y-0.5 text-center sm:text-left">
            <p className="font-bold text-slate-900">
              কোর্স মাস্টার করার জন্য সম্পূর্ণ ফ্ল্যাশকার্ড ও গেমসমূহ শুরু করুন
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              মোট ভোকাবুলারি: {wordsCount} টি | কোর্স প্রাইস: ৳{(course.price && course.price > 0) ? course.price : 30} BDT
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isUserAllowed ? (
              <>
                <button
                  type="button"
                  disabled={sampleUsed}
                  onClick={onOpenFreeSample}
                  className={`px-4 py-2.5 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 ${
                    sampleUsed
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${sampleUsed ? 'text-slate-400' : 'text-amber-300'}`} />
                  <span>{sampleUsed ? 'Free Sample Used' : 'ফ্রি কার্ডস দেখুন (5টি)'}</span>
                </button>

                <button
                  type="button"
                  onClick={onBuyCourse}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>কোর্সটি কিনুন (৳{(course.price && course.price > 0) ? course.price : 30})</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStartFlashcards}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>ফ্ল্যাশকার্ড শুরু করুন</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
