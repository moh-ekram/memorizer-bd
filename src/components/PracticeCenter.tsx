import React, { useState, useEffect } from 'react';
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
  Zap,
  CheckCircle2,
  CheckCircle,
  BarChart3
} from 'lucide-react';
import { db, collection, getDocs } from '../lib/db';
import SynonymCheck from './SynonymCheck';
import PracticeQuiz from './PracticeQuiz';
import WordMatchGame from './WordMatchGame';
import BlankFillingPractice from './BlankFillingPractice';
import OddOneOutGame from './OddOneOutGame';
import WordAnalogyGame from './WordAnalogyGame';
import GameAnalyticsDashboard from './GameAnalyticsDashboard';
import QuickShuffleModal from './QuickShuffleModal';
import { 
  VocabularyWord, 
  WordStatus, 
  CustomFolder, 
  AppSettings, 
  UserProgress,
  BlankQuestion,
  OddOneOutQuestion,
  WordAnalogyQuestion,
  CustomMcqQuestion,
  Course
} from '../types';

// Circular SVG Progress Ring Component
function ProgressRing({ 
  percent, 
  size = 42, 
  strokeWidth = 3.5, 
  colorClass = "text-indigo-600" 
}: { 
  percent: number; 
  size?: number; 
  strokeWidth?: number; 
  colorClass?: string; 
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercent = Math.min(100, Math.max(0, isNaN(percent) ? 0 : percent));
  const offset = circumference - (safePercent / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="text-slate-100"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
        />
        {/* Progress fill circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${colorClass} transition-all duration-700 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
        />
      </svg>
      <span className="absolute text-[10px] font-black text-slate-800 font-mono">
        {safePercent}%
      </span>
    </div>
  );
}

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
  mcqProgress?: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateMcqProgress?: (questionId: string, correct: boolean) => void;
  activeGroup: number | string | null;
  settings: AppSettings;
  onQuizComplete: (score: number, totalQuestions: number) => void;
  activeCourseId: string;
  allCourses?: Course[];
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
  mcqProgress,
  onUpdateMcqProgress,
  activeGroup,
  settings,
  onQuizComplete,
  activeCourseId,
  allCourses,
  enabledGames,
  placeLabels,
  googleSearchQuery
}: PracticeCenterProps) {
  const [subTab, setSubTab] = useState<'hub' | 'quiz' | 'match' | 'synonym' | 'blank' | 'odd_one_out' | 'analogy' | 'analytics'>('hub');
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

  // Fetch custom admin uploaded questions for games
  const [blankQs, setBlankQs] = useState<BlankQuestion[]>([]);
  const [oooQs, setOooQs] = useState<OddOneOutQuestion[]>([]);
  const [analogyQs, setAnalogyQs] = useState<WordAnalogyQuestion[]>([]);
  const [mcqQs, setMcqQs] = useState<CustomMcqQuestion[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchAllCourseQuestions = async () => {
      try {
        const matchesCourse = (qCourseId?: string, targetCourseId?: string) => {
          if (!targetCourseId || targetCourseId.trim() === '' || targetCourseId === 'all') return true;
          if (!qCourseId || qCourseId.trim() === '') return true;
          const cleanTarget = targetCourseId.trim().toLowerCase();
          const cleanQ = qCourseId.trim().toLowerCase();
          if (cleanQ === cleanTarget || cleanTarget.includes(cleanQ) || cleanQ.includes(cleanTarget)) return true;
          const normTarget = cleanTarget.replace(/[^a-z0-9]/g, '');
          const normQ = cleanQ.replace(/[^a-z0-9]/g, '');
          if (normQ === normTarget || normTarget.includes(normQ) || normQ.includes(normTarget)) return true;
          return false;
        };

        // 1. Blank questions
        const blankSnap = await getDocs(collection(db, 'blank_questions'));
        const loadedBlank: BlankQuestion[] = [];
        blankSnap.forEach(docSnap => {
          const data = docSnap.data();
          const qObj = { id: docSnap.id, ...data } as BlankQuestion;
          if (matchesCourse(data.courseId, activeCourseId)) {
            loadedBlank.push(qObj);
          }
        });

        // 2. OOO questions
        const oooSnap = await getDocs(collection(db, 'odd_one_out_questions'));
        const loadedOoo: OddOneOutQuestion[] = [];
        oooSnap.forEach(docSnap => {
          const data = docSnap.data();
          const qObj = { id: docSnap.id, ...data } as OddOneOutQuestion;
          if (matchesCourse(data.courseId, activeCourseId)) {
            loadedOoo.push(qObj);
          }
        });

        // 3. Analogy questions
        const analogySnap = await getDocs(collection(db, 'word_analogy_questions'));
        const loadedAnalogy: WordAnalogyQuestion[] = [];
        analogySnap.forEach(docSnap => {
          const data = docSnap.data();
          const qObj = { id: docSnap.id, ...data } as WordAnalogyQuestion;
          if (matchesCourse(data.courseId, activeCourseId)) {
            loadedAnalogy.push(qObj);
          }
        });

        // 4. MCQ questions
        const mcqSnap = await getDocs(collection(db, 'mcq_questions'));
        const loadedMcq: CustomMcqQuestion[] = [];
        mcqSnap.forEach(docSnap => {
          const data = docSnap.data();
          const qObj = { id: docSnap.id, ...data } as CustomMcqQuestion;
          if (matchesCourse(data.courseId, activeCourseId)) {
            loadedMcq.push(qObj);
          }
        });

        if (isMounted) {
          setBlankQs(loadedBlank);
          setOooQs(loadedOoo);
          setAnalogyQs(loadedAnalogy);
          setMcqQs(loadedMcq);
        }
      } catch (err) {
        console.error('Error fetching game questions for course:', err);
      }
    };

    fetchAllCourseQuestions();
    return () => { isMounted = false; };
  }, [activeCourseId]);

  // Compute Game Progress Stats based on admin uploaded questions and course words
  const gameStats = React.useMemo(() => {
    const isGre = (activeCourseId || 'gre').trim().toLowerCase() === 'gre';

    // 1. Quiz Stats
    const quizTotal = mcqQs.length > 0 ? mcqQs.length : words.length;
    const quizCompleted = words.filter(w => {
      const p = progress[w.id];
      return p && (p.status === 'know' || p.status === 'dont_know' || p.status === 'confusion');
    }).length;
    const quizPercent = quizTotal > 0 ? Math.min(100, Math.round((quizCompleted / quizTotal) * 100)) : 0;

    // 2. Word Match Stats
    const matchTotal = words.length;
    const matchCompleted = words.filter(w => {
      const p = progress[w.id];
      return p && (p.status === 'know' || p.status === 'dont_know' || p.status === 'confusion');
    }).length;
    const matchPercent = matchTotal > 0 ? Math.min(100, Math.round((matchCompleted / matchTotal) * 100)) : 0;

    // 3. Synonym Check Stats
    const synonymTotal = words.length;
    const synonymCompleted = words.filter(w => synonymProgress[w.id] !== undefined).length;
    const synonymPercent = synonymTotal > 0 ? Math.min(100, Math.round((synonymCompleted / synonymTotal) * 100)) : 0;

    // 4. Blank Filling Stats
    const blankTotal = blankQs.length;
    const blankCompleted = blankTotal > 0 ? blankQs.filter(q => blankProgress[q.id] !== undefined).length : 0;
    const blankPercent = blankTotal > 0 ? Math.min(100, Math.round((blankCompleted / blankTotal) * 100)) : 0;

    // 5. Odd One Out Stats
    const oooTotal = oooQs.length;
    const oooCompleted = oooTotal > 0 ? oooQs.filter(q => oooProgress[q.id] !== undefined).length : 0;
    const oooPercent = oooTotal > 0 ? Math.min(100, Math.round((oooCompleted / oooTotal) * 100)) : 0;

    // 6. Word Analogy Stats
    const analogyTotal = analogyQs.length;
    const analogyCompleted = analogyTotal > 0 ? analogyQs.filter(q => analogyProgress[q.id] !== undefined).length : 0;
    const analogyPercent = analogyTotal > 0 ? Math.min(100, Math.round((analogyCompleted / analogyTotal) * 100)) : 0;

    // Overall across all games
    const totalQsAcrossGames = quizTotal + matchTotal + synonymTotal + blankTotal + oooTotal + analogyTotal;
    const completedQsAcrossGames = quizCompleted + matchCompleted + synonymCompleted + blankCompleted + oooCompleted + analogyCompleted;
    const overallPercent = totalQsAcrossGames > 0 ? Math.round((completedQsAcrossGames / totalQsAcrossGames) * 100) : 0;

    return {
      quiz: { completed: quizCompleted, total: quizTotal, percent: quizPercent },
      match: { completed: matchCompleted, total: matchTotal, percent: matchPercent },
      synonym: { completed: synonymCompleted, total: synonymTotal, percent: synonymPercent },
      blank: { completed: blankCompleted, total: blankTotal, percent: blankPercent, isUploaded: blankQs.length > 0 },
      odd_one_out: { completed: oooCompleted, total: oooTotal, percent: oooPercent, isUploaded: oooQs.length > 0 },
      analogy: { completed: analogyCompleted, total: analogyTotal, percent: analogyPercent, isUploaded: analogyQs.length > 0 },
      overall: { completed: completedQsAcrossGames, total: totalQsAcrossGames, percent: overallPercent }
    };
  }, [words, progress, synonymProgress, blankProgress, oooProgress, analogyProgress, blankQs, oooQs, analogyQs, activeCourseId]);

  // Configuration for practice items
  const practiceItemsConfig = [
    {
      key: 'quiz',
      title: 'MCQ Quiz',
      tag: 'Test Recall',
      btnText: 'Start Now',
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      ringColorClass: 'text-indigo-600',
      barColorClass: 'bg-indigo-600',
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
      tag: 'Play Game',
      btnText: 'Start Play',
      iconBg: 'bg-pink-50 text-pink-600 border-pink-100',
      ringColorClass: 'text-pink-600',
      barColorClass: 'bg-pink-600',
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
      tag: 'AI Verification',
      btnText: 'Verify Now',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      ringColorClass: 'text-amber-500',
      barColorClass: 'bg-amber-500',
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
      tag: 'Sentence Quiz',
      btnText: 'Practice Now',
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      ringColorClass: 'text-emerald-500',
      barColorClass: 'bg-emerald-500',
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
      tag: 'Word Selection',
      btnText: 'Play Now',
      iconBg: 'bg-sky-50 text-sky-600 border-sky-100',
      ringColorClass: 'text-sky-500',
      barColorClass: 'bg-sky-500',
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
      tag: 'Logic Challenge',
      btnText: 'Solve Now',
      iconBg: 'bg-purple-50 text-purple-650 border-purple-100',
      ringColorClass: 'text-purple-600',
      barColorClass: 'bg-purple-600',
      borderHover: 'hover:border-purple-200',
      tagColor: 'text-purple-600',
      hoverText: 'hover:text-purple-600',
      enabled: isAnalogyEnabled,
      icon: <Shuffle className="w-6 h-6 text-purple-500" />,
      action: () => setSubTab('analogy')
    }
  ];

  // Sort items according to settings.practiceItemsOrder
  const practiceOrder = Array.isArray(settings?.practiceItemsOrder) && settings.practiceItemsOrder.length > 0
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
      {/* Practice Center View Mode Switcher Header */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200/80">
        <button
          type="button"
          onClick={() => setSubTab('hub')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            subTab === 'hub' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Gamepad2 className="w-4 h-4 text-indigo-600" />
          <span>Games Hub</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('analytics')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            subTab === 'analytics' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <span>Tracking Dashboard</span>
          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase">
            Correct %
          </span>
        </button>
      </div>

      {/* RENDER ACTIVE MODE */}
      {subTab === 'analytics' && (
        <GameAnalyticsDashboard
          words={words}
          progress={progress}
          synonymProgress={synonymProgress}
          blankProgress={blankProgress}
          oooProgress={oooProgress}
          analogyProgress={analogyProgress}
          blankQs={blankQs}
          oooQs={oooQs}
          analogyQs={analogyQs}
          mcqQs={mcqQs}
          activeCourseId={activeCourseId}
          allCourses={allCourses}
          onPlayGame={(gameKey) => setSubTab(gameKey)}
          onBackToHub={() => setSubTab('hub')}
        />
      )}

      {subTab === 'hub' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
            <div className="max-w-xl space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/20 text-indigo-200 text-[10px] font-bold rounded-full uppercase tracking-wider border border-indigo-500/30">
                  Games Hub
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-200 text-[10px] font-extrabold rounded-full border border-emerald-500/30 font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                  <span>Overall Games Progress: {gameStats.overall.completed}/{gameStats.overall.total} Qs ({gameStats.overall.percent}%)</span>
                </span>
                {confusionCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-extrabold rounded-full border border-amber-500/30">
                    <HelpCircle className="w-3 h-3 text-amber-400" />
                    <span>{confusionCount} Confusion Words</span>
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Games</h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setSubTab('analytics')}
                className="px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 rounded-2xl font-bold text-xs border border-emerald-500/40 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Tracking Dashboard</span>
              </button>

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
          </div>

          {/* Mobile Collapse / Expand Control Header */}
          <div className="sm:hidden flex items-center justify-between p-3.5 bg-slate-100/90 rounded-2xl border border-slate-200">
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-indigo-600" />
              <span>Practice Items ({orderedItems.filter(i => i.enabled).length})</span>
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
            className="grid grid-cols-1 gap-4 sm:gap-5 max-w-2xl mx-auto"
          >
            {orderedItems.filter(item => item.enabled).map((item) => {
              const isCollapsedMobile = !!mobileCollapsedState[item.key];
              const stats = gameStats[item.key as keyof typeof gameStats] || { completed: 0, total: 0, percent: 0 };

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
                      setMobileCollapsedState(prev => ({ ...prev, [item.key]: !prev[item.key] }));
                    }}
                    className="p-5 flex items-center justify-between cursor-pointer sm:cursor-default"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${item.iconBg}`}>
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-800 text-base leading-tight truncate">{item.title}</h3>
                      </div>
                    </div>

                    {/* Top-Right Progress Ring & Mobile Collapse Toggle */}
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <ProgressRing 
                        percent={stats.percent} 
                        colorClass={item.ringColorClass}
                        size={42}
                        strokeWidth={3.5}
                      />

                      <div className="sm:hidden text-slate-400 p-1">
                        {isCollapsedMobile ? (
                          <ChevronDown className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Body & Footer */}
                  <div className={`${isCollapsedMobile ? 'hidden sm:block' : 'block'} px-5 pb-5 space-y-3 pt-0 border-t border-slate-100/60 sm:border-t-0`}>
                    {/* Game Progress Bar & Question Counter */}
                    <div className="space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-700 font-mono flex items-center gap-1.5 truncate">
                          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${item.ringColorClass}`} />
                          {stats.total > 0 ? (
                            <span>{stats.completed} / {stats.total} Qs Solved</span>
                          ) : (
                            <span className="text-slate-400 font-sans italic">0 Questions Uploaded</span>
                          )}
                        </span>
                        <span className={`font-mono font-black ${item.tagColor} shrink-0 ml-1`}>
                          {stats.percent}%
                        </span>
                      </div>

                      {/* Progress Bar Track */}
                      <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden p-0.5">
                        <div 
                          className={`h-full ${item.barColorClass} rounded-full transition-all duration-700 ease-out`}
                          style={{ width: `${stats.percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer Tag and Action Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
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
          customMcqQuestions={mcqQs}
          mcqProgress={mcqProgress}
          onUpdateMcqProgress={onUpdateMcqProgress}
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
