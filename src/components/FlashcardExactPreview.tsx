import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, Check, X, HelpCircle, SkipForward, 
  RotateCcw, Sparkles, MousePointerClick, ChevronLeft, ChevronRight
} from 'lucide-react';
import { VocabularyWord, WordStatus } from '../types';

interface FlashcardExactPreviewProps {
  words?: VocabularyWord[];
  activeAnimation?: 'flip-h' | 'flip-v' | 'diagonal' | 'shuffle';
  showControls?: boolean;
  className?: string;
  courseTitle?: string;
}

const DEFAULT_SAMPLE_WORDS: VocabularyWord[] = [
  {
    id: 'sample-1',
    word: 'Abundant',
    meaning: 'প্রচুর, পর্যাপ্ত, প্রাচুর্যপূর্ণ',
    group: 1,
    synonyms: 'Copious, Plentiful, Ample, Bountiful',
    extraWord: 'Abundance (noun) — প্রাচুর্য',
    extraMeaning: 'প্রাচুর্য',
    example: 'There was abundant evidence to support the scientific discovery.',
    mnemonic: 'A-bundant sounds like "A bunch" -> প্রচুর পরিমাণে থাকা'
  },
  {
    id: 'sample-2',
    word: 'Eloquent',
    meaning: 'বাকপটু, প্রাঞ্জল ও আকর্ষণীয় বক্তা',
    group: 1,
    synonyms: 'Articulate, Fluent, Expressive, Silver-tongued',
    extraWord: 'Eloquence (noun) — বাকপটুতা',
    extraMeaning: 'বাগ্মীতা',
    example: 'The speaker delivered an exceptionally eloquent address to the audience.',
    mnemonic: 'E-loquent -> e (out) + loqui (speak) -> আকর্ষণীয়ভাবে কথা বলা'
  },
  {
    id: 'sample-3',
    word: 'Resilient',
    meaning: 'স্থিতিস্থাপক, প্রতিকূলতায় টিকে থাকতে সক্ষম',
    group: 2,
    synonyms: 'Tenacious, Tough, Adaptable, Buoyant',
    extraWord: 'Resilience (noun) — প্রতিকূলতা জয় করার ক্ষমতা',
    extraMeaning: 'সহনশীলতা',
    example: 'The local community remained remarkably resilient despite the economic crisis.',
    mnemonic: 'Re-silent -> প্রতিকূলতার মধ্যেও নীরব ধৈর্য ধরে ঘুরে দাঁড়ায় যে'
  }
];

export default function FlashcardExactPreview({
  words = DEFAULT_SAMPLE_WORDS,
  activeAnimation = 'flip-h',
  showControls = true,
  className = '',
  courseTitle = 'Vocabulary Master'
}: FlashcardExactPreviewProps) {
  const activeWords = words && words.length > 0 ? words : DEFAULT_SAMPLE_WORDS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasFlippedCurrentCard, setHasFlippedCurrentCard] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, WordStatus>>({});

  const currentWord = activeWords[currentIndex % activeWords.length];
  const activeStatus = statuses[currentWord.id] || 'unrated';

  // Stats calculation
  const total = activeWords.length;
  const knowCount = Object.values(statuses).filter(s => s === 'know').length;
  const confusionCount = Object.values(statuses).filter(s => s === 'confusion').length;
  const dontKnowCount = Object.values(statuses).filter(s => s === 'dont_know').length;
  const unratedCount = total - (knowCount + confusionCount + dontKnowCount);

  const knowPct = total > 0 ? Math.round((knowCount / total) * 100) : 0;
  const confusionPct = total > 0 ? Math.round((confusionCount / total) * 100) : 0;
  const dontKnowPct = total > 0 ? Math.round((dontKnowCount / total) * 100) : 0;
  const unratedPct = total > 0 ? Math.max(0, 100 - (knowPct + confusionPct + dontKnowPct)) : 100;

  const handleNext = () => {
    setIsFlipped(false);
    setHasFlippedCurrentCard(false);
    setCurrentIndex(prev => (prev + 1) % activeWords.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setHasFlippedCurrentCard(false);
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : activeWords.length - 1));
  };

  const handleRate = (status: WordStatus) => {
    setStatuses(prev => ({
      ...prev,
      [currentWord.id]: status
    }));
    setTimeout(() => {
      handleNext();
    }, 280);
  };

  const speakWord = () => {
    if (!currentWord.word) return;
    try {
      const utterance = new SpeechSynthesisUtterance(currentWord.word);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  };

  const openGoogleSearch = () => {
    if (!currentWord.word) return;
    const url = `https://www.google.com/search?q=${encodeURIComponent(currentWord.word + ' meaning in bengali')}`;
    window.open(url, '_blank');
  };

  // Helper for highlighting the target word in example sentences
  const renderSentenceWithHighlight = (sentence: string, targetWord: string) => {
    if (!sentence || !targetWord) return <span>{sentence}</span>;
    const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = sentence.split(regex);
    return (
      <span className="text-slate-800">
        {parts.map((part, index) =>
          part.toLowerCase() === targetWord.toLowerCase() ? (
            <span key={index} className="text-rose-600 font-extrabold underline decoration-rose-300">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const getWordColorClass = (st: WordStatus) => {
    switch (st) {
      case 'know':
        return 'text-emerald-600';
      case 'dont_know':
        return 'text-rose-600';
      case 'confusion':
        return 'text-amber-500';
      default:
        return 'text-slate-900';
    }
  };

  return (
    <div className={`w-full flex flex-col items-center select-none ${className}`}>
      {/* Top Header / Progress Meter */}
      <div className="w-full max-w-md sm:max-w-lg mb-3 space-y-1.5 px-1">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider border border-indigo-100">
              Live Preview
            </span>
            <span className="text-slate-700 font-mono">
              Card {currentIndex + 1} of {activeWords.length}
            </span>
          </div>
          <span className="text-emerald-600 font-black flex items-center gap-1 text-[11px]">
            <Check className="w-3.5 h-3.5" />
            {knowPct}% Learned ({knowCount}/{total})
          </span>
        </div>

        {/* Multi-segmented Progress Bar */}
        <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden flex shadow-inner">
          {knowCount > 0 && (
            <div 
              style={{ width: `${(knowCount / total) * 100}%` }} 
              className="bg-emerald-500 h-full transition-all duration-300" 
              title={`Learned: ${knowCount}`}
            />
          )}
          {confusionCount > 0 && (
            <div 
              style={{ width: `${(confusionCount / total) * 100}%` }} 
              className="bg-amber-400 h-full transition-all duration-300" 
              title={`Confused: ${confusionCount}`}
            />
          )}
          {dontKnowCount > 0 && (
            <div 
              style={{ width: `${(dontKnowCount / total) * 100}%` }} 
              className="bg-rose-500 h-full transition-all duration-300" 
              title={`Not Learned: ${dontKnowCount}`}
            />
          )}
          {unratedCount > 0 && (
            <div 
              style={{ width: `${(unratedCount / total) * 100}%` }} 
              className="bg-slate-300/60 h-full transition-all duration-300" 
              title={`Unrated: ${unratedCount}`}
            />
          )}
        </div>
      </div>

      {/* 3D Flashcard Stage */}
      <div className="w-full max-w-md sm:max-w-lg relative perspective my-auto p-1">
        <div
          onClick={() => {
            setHasFlippedCurrentCard(true);
            setIsFlipped(prev => !prev);
          }}
          className={`relative w-full h-[430px] sm:h-[460px] cursor-pointer transform-style-3d anim-${activeAnimation} transition-transform duration-500 ${
            isFlipped ? 'is-flipped' : ''
          }`}
        >
          {/* FRONT FACE */}
          <div
            className={`absolute inset-0 w-full h-full bg-white text-slate-900 rounded-3xl p-5 sm:p-6 md:p-7 shadow-xl border border-slate-200/90 flex flex-col justify-between backface-hidden ${
              isFlipped ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            {/* Top Row: Word Meta & Action Buttons */}
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                Group {currentWord.group || 1} • {courseTitle}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openGoogleSearch();
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition shadow-2xs cursor-pointer flex items-center justify-center border border-slate-200"
                  title="Search on Google"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakWord();
                  }}
                  className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full transition shadow-2xs cursor-pointer border border-indigo-100"
                  title="Speak word"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Center Content: Front Face */}
            <div className="my-auto text-center space-y-2 py-4">
              <span className="block font-sans uppercase text-[10px] text-slate-400 font-semibold tracking-wider">
                English Word (Place 1)
              </span>
              <h2 className={`text-3xl sm:text-4xl md:text-5xl font-black ${getWordColorClass(activeStatus)} tracking-tight font-sans transition-colors duration-200`}>
                {currentWord.word}
              </h2>

              <AnimatePresence>
                {!isFlipped && !hasFlippedCurrentCard && (
                  <motion.div
                    key="click-indicator"
                    initial={{ opacity: 0, scale: 0.8, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.6, y: -8 }}
                    className="pt-3 flex items-center justify-center pointer-events-none select-none"
                  >
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/80 shadow-2xs animate-pulse">
                      <MousePointerClick className="w-3.5 h-3.5 text-indigo-600 animate-bounce" />
                      <span className="text-[11px] font-bold tracking-tight">
                        Click card to flip
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Row Controls */}
            {showControls && (
              <div 
                className="pt-3 border-t border-slate-100 flex items-center justify-around w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRate('dont_know')}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border active:scale-95 ${
                      activeStatus === 'dont_know'
                        ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-105'
                        : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200'
                    }`}
                    title="Not Learned / Hard"
                  >
                    <X className="w-6 h-6 stroke-[3]" />
                  </button>
                  <span className="text-[9px] font-bold text-slate-400">don't know</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRate('confusion')}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border active:scale-95 ${
                      activeStatus === 'confusion'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-105'
                        : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200'
                    }`}
                    title="Confused / Medium"
                  >
                    <HelpCircle className="w-6 h-6 stroke-[2.5]" />
                  </button>
                  <span className="text-[9px] font-bold text-slate-400">confusion</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition cursor-pointer active:scale-95"
                    title="Skip Card"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                  <span className="text-[9px] font-bold text-slate-400">skip</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRate('know')}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border active:scale-95 ${
                      activeStatus === 'know'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'
                    }`}
                    title="Learned / Easy"
                  >
                    <Check className="w-6 h-6 stroke-[3]" />
                  </button>
                  <span className="text-[9px] font-bold text-slate-400">know</span>
                </div>
              </div>
            )}
          </div>

          {/* BACK FACE */}
          <div
            className={`absolute inset-0 w-full h-full bg-white text-slate-900 rounded-3xl p-5 sm:p-6 md:p-7 shadow-xl border border-slate-200/90 flex flex-col justify-between backface-hidden backface-${activeAnimation} ${
              isFlipped ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            {/* Top Row */}
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                Group {currentWord.group || 1} • {currentWord.word}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openGoogleSearch();
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition shadow-2xs cursor-pointer flex items-center justify-center border border-slate-200"
                  title="Search on Google"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakWord();
                  }}
                  className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full transition shadow-2xs cursor-pointer border border-indigo-100"
                  title="Speak word"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Back Content Blocks */}
            <div className="my-auto space-y-3 py-2 text-center overflow-y-auto max-h-[250px] pr-1">
              {/* Place 2: Meaning */}
              {currentWord.meaning && (
                <div className="w-full">
                  <span className="block uppercase text-[10px] text-slate-400 font-semibold tracking-wider mb-0.5">
                    বাংলা অর্থ (Place 2)
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-emerald-600 font-bengali leading-snug">
                    {currentWord.meaning}
                  </p>
                </div>
              )}

              {/* Place 3: Example Sentence */}
              {currentWord.example && (
                <div className="w-full bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl">
                  <span className="block uppercase text-[9px] text-slate-400 font-bold tracking-wider mb-1">
                    Example Sentence (Place 3)
                  </span>
                  <p className="text-xs sm:text-sm italic font-medium leading-relaxed">
                    "{renderSentenceWithHighlight(currentWord.example, currentWord.word)}"
                  </p>
                </div>
              )}

              {/* Place 4 & 5: Derivative & Synonyms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {currentWord.extraWord && (
                  <div className="bg-indigo-50/70 border border-indigo-100 p-2 rounded-xl">
                    <span className="block uppercase text-[9px] text-indigo-700 font-bold tracking-wider mb-0.5">
                      Derivative (Place 4)
                    </span>
                    <p className="text-[11px] font-bold text-slate-800">
                      {currentWord.extraWord}
                    </p>
                  </div>
                )}
                {currentWord.synonyms && (
                  <div className="bg-amber-50/70 border border-amber-100 p-2 rounded-xl">
                    <span className="block uppercase text-[9px] text-amber-800 font-bold tracking-wider mb-0.5">
                      Synonyms (Place 5)
                    </span>
                    <p className="text-[11px] font-bold text-slate-800 truncate" title={currentWord.synonyms}>
                      {currentWord.synonyms}
                    </p>
                  </div>
                )}
              </div>

              {/* Place 6: Mnemonic */}
              {currentWord.mnemonic && (
                <div className="w-full bg-purple-50/70 border border-purple-100 p-2 rounded-xl text-left">
                  <span className="block uppercase text-[9px] text-purple-700 font-bold tracking-wider mb-0.5">
                    Mnemonic Memory Hook (Place 6)
                  </span>
                  <p className="text-[11px] font-medium text-slate-700">
                    💡 {currentWord.mnemonic}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Row Controls */}
            {showControls && (
              <div 
                className="pt-3 border-t border-slate-100 flex items-center justify-around w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRate('dont_know')}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border active:scale-95 ${
                      activeStatus === 'dont_know'
                        ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-105'
                        : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200'
                    }`}
                    title="Not Learned / Hard"
                  >
                    <X className="w-6 h-6 stroke-[3]" />
                  </button>
                  <span className="text-[9px] font-bold text-slate-400">don't know</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRate('confusion')}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border active:scale-95 ${
                      activeStatus === 'confusion'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-105'
                        : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200'
                    }`}
                    title="Confused / Medium"
                  >
                    <HelpCircle className="w-6 h-6 stroke-[2.5]" />
                  </button>
                  <span className="text-[9px] font-bold text-slate-400">confusion</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition cursor-pointer active:scale-95"
                    title="Skip Card"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                  <span className="text-[9px] font-bold text-slate-400">skip</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRate('know')}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition cursor-pointer border active:scale-95 ${
                      activeStatus === 'know'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'
                    }`}
                    title="Learned / Easy"
                  >
                    <Check className="w-6 h-6 stroke-[3]" />
                  </button>
                  <span className="text-[9px] font-bold text-slate-400">know</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Navigation Pill Switcher */}
      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={handlePrev}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs hover:bg-slate-50 cursor-pointer"
          title="Previous Word"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1">
          {activeWords.slice(0, 5).map((w, idx) => (
            <button
              key={w.id || idx}
              type="button"
              onClick={() => {
                setIsFlipped(false);
                setHasFlippedCurrentCard(false);
                setCurrentIndex(idx);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                idx === currentIndex % activeWords.length
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {w.word}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs hover:bg-slate-50 cursor-pointer"
          title="Next Word"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
