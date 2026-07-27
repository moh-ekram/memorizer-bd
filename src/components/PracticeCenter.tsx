import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  GraduationCap, 
  Sparkles, 
  Sparkle, 
  ArrowLeft,
  Gamepad2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookOpen,
  HelpCircle,
  Shuffle,
  Zap
} from 'lucide-react';
import SynonymCheck from './SynonymCheck';
import PracticeQuiz from './PracticeQuiz';
import WordMatchGame from './WordMatchGame';
import BlankFillingPractice from './BlankFillingPractice';
import OddOneOutGame from './OddOneOutGame';
import WordAnalogyGame from './WordAnalogyGame';
import QuickShuffleModal from './QuickShuffleModal';
import { VocabularyWord, WordStatus, CustomFolder, AppSettings, UserProgress } from '../types';

interface PracticeCenterProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
  folders: CustomFolder[];
  synonymProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateSynonymProgress: (wordId: string, correct: boolean) => void;
  blankProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateBlankProgress: (questionId: string, correct: boolean) => void;
  oooProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateOooProgress: (questionId: string, correct: boolean) => void;
  analogyProgress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateAnalogyProgress: (questionId: string, correct: boolean) => void;
  activeGroup: number | string | null;
  settings: AppSettings;
  onQuizComplete: (score: number, totalQuestions: number) => void;
  activeCourseId: string;
  enabledGames?: Record<string, boolean>;
  placeLabels?: {
    place1?: string;
    place2?: string;
    place3?: string;
    place4?: string;
    place5?: string;
    place6?: string;
  };
  googleSearchQuery?: string;
}

export default function PracticeCenter({
  words,
  progress,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark,
  folders,
  synonymProgress,
  onUpdateSynonymProgress,
  blankProgress,
  onUpdateBlankProgress,
  oooProgress,
  onUpdateOooProgress,
  analogyProgress,
  onUpdateAnalogyProgress,
  activeGroup,
  settings,
  onQuizComplete,
  activeCourseId,
  enabledGames,
  placeLabels,
  googleSearchQuery
}: PracticeCenterProps) {
  const [subTab, setSubTab] = useState<'hub' | 'quiz' | 'match' | 'synonym' | 'blank' | 'odd_one_out' | 'analogy'>('hub');
  const [isQuickShuffleOpen, setIsQuickShuffleOpen] = useState<boolean>(false);

  const [mobileCollapsedState, setMobileCollapsedState] = useState<Record<string, boolean>>({});
  const [allCollapsedMobile, setAllCollapsedMobile] = useState<boolean>(false);

  const confusionCount = words.filter(w => progress[w.id]?.status === 'confusion').length;

  const isQuizEnabled = !enabledGames || enabledGames.quiz !== false;
  const isMatchEnabled = !enabledGames || enabledGames.match !== false;
  const isSynonymEnabled = !enabledGames || enabledGames.synonym !== false;
  const isBlankEnabled = !enabledGames || enabledGames.blank !== false;
  const isOddOneOutEnabled = !enabledGames || enabledGames.odd_one_out !== false;
  const isAnalogyEnabled = !enabledGames || enabledGames.analogy !== false;

  // Configuration for practice items
  const practiceItemsConfig = [
    {
      key: 'quiz',
      title: 'MCQ Quiz',
      banglaTitle: 'এমসিকিউ কুইজ',
      desc: 'মক টেস্ট ও ৪ বিকল্প কুইজ দিয়ে স্মৃতি শক্তি যাচাই করুন',
      tag: 'Test Recall',
      btnText: 'Start Now',
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      borderHover: 'hover:border-indigo-200',
      tagColor: 'text-indigo-600',
      hoverText: 'hover:text-indigo-600',
      enabled: isQuizEnabled,
      icon: <GraduationCap className="w-6 h-6" />,
      action: () => setSubTab('quiz')
    },
    {
      key: 'match',
      title: 'Word Match',
      banglaTitle: 'ওয়ার্ড ম্যাচ গেম',
      desc: 'শব্দ ও অর্থের দ্রুত মিলকরণ চ্যালেঞ্জ খেলুন',
      tag: 'Play Game',
      btnText: 'Start Play',
      iconBg: 'bg-pink-50 text-pink-600 border-pink-100',
      borderHover: 'hover:border-pink-200',
      tagColor: 'text-pink-600',
      hoverText: 'hover:text-pink-600',
      enabled: isMatchEnabled,
      icon: <Gamepad2 className="w-6 h-6 text-pink-650" />,
      action: () => setSubTab('match')
    },
    {
      key: 'synonym',
      title: 'Synonym Check',
      banglaTitle: 'সমার্থক শব্দ চেক',
      desc: 'শব্দের সমার্থক রূপ যাচাই ও অনুশীলন করুন',
      tag: 'AI Verification',
      btnText: 'Verify Now',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      borderHover: 'hover:border-amber-200',
      tagColor: 'text-amber-600',
      hoverText: 'hover:text-amber-600',
      enabled: isSynonymEnabled,
      icon: <Sparkle className="w-6 h-6 text-amber-500" />,
      action: () => setSubTab('synonym')
    },
    {
      key: 'blank',
      title: 'Blank Filling',
      banglaTitle: 'শূন্যস্থান পূরণ',
      desc: 'বাক্যে সঠিক শব্দ বসিয়ে ব্যাকরণ ও অর্থ ঝালাই করুন',
      tag: 'Sentence Quiz',
      btnText: 'Practice Now',
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      borderHover: 'hover:border-emerald-200',
      tagColor: 'text-emerald-600',
      hoverText: 'hover:text-emerald-600',
      enabled: isBlankEnabled,
      icon: <BookOpen className="w-6 h-6 text-emerald-500" />,
      action: () => setSubTab('blank')
    },
    {
      key: 'odd_one_out',
      title: 'Odd One Out',
      banglaTitle: 'ব্যতিক্রমী শব্দ সনাক্তকরণ',
      desc: 'চারটি শব্দের মধ্যে বেমানান শব্দটি খুঁজে বের করুন',
      tag: 'Word Selection',
      btnText: 'Play Now',
      iconBg: 'bg-sky-50 text-sky-600 border-sky-100',
      borderHover: 'hover:border-sky-200',
      tagColor: 'text-sky-600',
      hoverText: 'hover:text-sky-600',
      enabled: isOddOneOutEnabled,
      icon: <HelpCircle className="w-6 h-6 text-sky-500" />,
      action: () => setSubTab('odd_one_out')
    },
    {
      key: 'analogy',
      title: 'Word Analogy',
      banglaTitle: 'শব্দের এনালজি',
      desc: 'শব্দের পারস্পরিক যৌক্তিক সম্পর্ক সমাধান করুন',
      tag: 'Logic Challenge',
      btnText: 'Solve Now',
      iconBg: 'bg-purple-50 text-purple-650 border-purple-100',
      borderHover: 'hover:border-purple-200',
      tagColor: 'text-purple-600',
      hoverText: 'hover:text-purple-600',
      enabled: isAnalogyEnabled,
      icon: <Shuffle className="w-6 h-6 text-purple-500" />,
      action: () => setSubTab('analogy')
    }
  ];

  // Sort items according to settings.practiceItemsOrder
  const practiceOrder = settings?.practiceItemsOrder && settings.practiceItemsOrder.length > 0
    ? settings.practiceItemsOrder
    : ['quiz', 'match', 'synonym', 'blank', 'odd_one_out', 'analogy'];

  const orderedItems = [...practiceItemsConfig].sort((a, b) => {
    const idxA = practiceOrder.indexOf(a.key);
    const idxB = practiceOrder.indexOf(b.key);
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });

  // Stagger animation variants for cards
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-6" id="practice-center-wrapper">
      {/* RENDER ACTIVE MODE */}
      {subTab === 'hub' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
            <div className="max-w-xl space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/20 text-indigo-200 text-[10px] font-bold rounded-full uppercase tracking-wider border border-indigo-500/30">
                  Practice Hub
                </span>
                {confusionCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-extrabold rounded-full border border-amber-500/30">
                    <HelpCircle className="w-3 h-3 text-amber-400" />
                    <span>{confusionCount} Confusion Words</span>
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Practice & Games</h2>
              <p className="text-xs text-indigo-200/80 font-medium">
                মক টেস্ট, গেম ও অটো কুইজ দিয়ে ভোকাবুলারি দ্রুত রিভিশন দিন
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsQuickShuffleOpen(true)}
              className="px-5 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 rounded-2xl font-black text-sm shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-3 shrink-0 cursor-pointer active:scale-95 group border border-amber-300/40"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-950/10 flex items-center justify-center text-slate-950 group-hover:rotate-180 transition-transform duration-500">
                <Shuffle className="w-4 h-4" />
              </div>
              <div className="text-left leading-tight">
                <div className="text-xs font-black tracking-wide uppercase">Quick Shuffle</div>
                <div className="text-[10px] font-bold opacity-80 flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-slate-950" />
                  <span>5 Qs Confusion Quiz</span>
                </div>
              </div>
            </button>
          </div>

          {/* Mobile Collapse / Expand Control Header */}
          <div className="sm:hidden flex items-center justify-between p-3.5 bg-slate-100/90 rounded-2xl border border-slate-200">
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-indigo-600" />
              <span>প্র্যাকটিস আইটেমস ({orderedItems.filter(i => i.enabled).length})</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const nextState = !allCollapsedMobile;
                setAllCollapsedMobile(nextState);
                const newState: Record<string, boolean> = {};
                orderedItems.forEach(item => { newState[item.key] = nextState; });
                setMobileCollapsedState(newState);
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              {allCollapsedMobile ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Expand All</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Collapse All</span>
                </>
              )}
            </button>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {orderedItems.filter(item => item.enabled).map((item) => {
              const isCollapsedMobile = !!mobileCollapsedState[item.key];

              return (
                <motion.div
                  key={item.key}
                  variants={itemVariants}
                  whileHover={{ y: -3, scale: 1.005 }}
                  className={`bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md ${item.borderHover} transition duration-300 flex flex-col justify-between overflow-hidden`}
                >
                  {/* Card Header (Collapsible on Mobile) */}
                  <div 
                    onClick={() => {
                      // On mobile, toggle collapse if clicked on header
                      setMobileCollapsedState(prev => ({ ...prev, [item.key]: !prev[item.key] }));
                    }}
                    className="p-5 flex items-center justify-between cursor-pointer sm:cursor-default"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${item.iconBg}`}>
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-base leading-tight">{item.title}</h3>
                        <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">{item.banglaTitle}</span>
                      </div>
                    </div>

                    {/* Mobile Collapse Chevron Toggle */}
                    <div className="sm:hidden text-slate-400 p-1">
                      {isCollapsedMobile ? (
                        <ChevronDown className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Card Body & Footer (Hidden when collapsed on mobile) */}
                  <div className={`${isCollapsedMobile ? 'hidden sm:block' : 'block'} px-5 pb-5 space-y-4 pt-0 border-t border-slate-100/60 sm:border-t-0`}>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed pt-2">
                      {item.desc}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className={`text-[10px] font-bold tracking-wider uppercase font-mono ${item.tagColor}`}>
                        {item.tag}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          item.action();
                        }}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold transition shadow-2xs cursor-pointer`}
                      >
                        <span>{item.btnText}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Empty State when no games are enabled */}
            {orderedItems.filter(item => item.enabled).length === 0 && (
              <div className="col-span-full py-12 text-center bg-white border border-slate-150 rounded-3xl p-8 space-y-3">
                <Gamepad2 className="w-12 h-12 text-slate-350 mx-auto" />
                <h3 className="font-extrabold text-slate-700 text-base">No practices or games available</h3>
                <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto leading-relaxed">
                  The admin has not enabled any practice or game options for this course.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {subTab === 'quiz' && (
        <PracticeQuiz
          words={words}
          progress={progress}
          onRateWord={onRateWord}
          activeGroup={activeGroup}
          settings={settings}
          onQuizComplete={onQuizComplete}
          onBack={() => setSubTab('hub')}
          placeLabels={placeLabels}
        />
      )}

      {subTab === 'match' && (
        <WordMatchGame
          words={words}
          activeGroup={typeof activeGroup === 'number' ? activeGroup : (typeof activeGroup === 'string' ? parseInt(activeGroup, 10) || null : null)}
          settings={settings}
          onBack={() => setSubTab('hub')}
          placeLabels={placeLabels}
        />
      )}

      {subTab === 'synonym' && (
        <SynonymCheck
          words={words}
          synonymProgress={synonymProgress}
          onUpdateSynonymProgress={onUpdateSynonymProgress}
          activeGroup={activeGroup}
          progress={progress}
          folders={folders}
          onRateWord={onRateWord}
          onUpdateNotes={onUpdateNotes}
          onToggleBookmark={onToggleBookmark}
          settings={settings}
          onBack={() => setSubTab('hub')}
          googleSearchQuery={googleSearchQuery}
        />
      )}

      {subTab === 'blank' && (
        <BlankFillingPractice
          blankProgress={blankProgress}
          onUpdateBlankProgress={onUpdateBlankProgress}
          activeCourseId={activeCourseId}
          words={words}
          onBack={() => setSubTab('hub')}
          placeLabels={placeLabels}
        />
      )}

      {subTab === 'odd_one_out' && (
        <OddOneOutGame
          progress={oooProgress}
          onUpdateProgress={onUpdateOooProgress}
          activeCourseId={activeCourseId}
          words={words}
          onBack={() => setSubTab('hub')}
        />
      )}

      {subTab === 'analogy' && (
        <WordAnalogyGame
          progress={analogyProgress}
          onUpdateProgress={onUpdateAnalogyProgress}
          activeCourseId={activeCourseId}
          words={words}
          onBack={() => setSubTab('hub')}
        />
      )}

      {/* Quick Shuffle Pop-up Quiz Modal */}
      <QuickShuffleModal
        isOpen={isQuickShuffleOpen}
        onClose={() => setIsQuickShuffleOpen(false)}
        words={words}
        progress={progress}
        onRateWord={onRateWord}
        onQuizComplete={onQuizComplete}
        placeLabels={placeLabels}
      />
    </div>
  );
}
