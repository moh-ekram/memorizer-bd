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
import { ExamView } from './ExamView';
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
  userEmail?: string;
  userDisplayName?: string;
  userId?: string;
  enrolledCourseIds?: string[];
  onSelectTab?: (tab: string) => void;
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
  googleSearchQuery,
  userEmail,
  userDisplayName,
  userId,
  enrolledCourseIds,
  onSelectTab
}: PracticeCenterProps) {
  const [subTab, setSubTab] = useState<'hub' | 'quiz' | 'match' | 'exam' | 'blank' | 'odd_one_out' | 'analogy' | 'analytics'>('hub');
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
      key: 'exam',
      title: 'Exam Section',
      tag: 'Model Test',
      btnText: 'Start Exam',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      ringColorClass: 'text-amber-500',
      barColorClass: 'bg-amber-500',
      borderHover: 'hover:border-amber-200',
      tagColor: 'text-amber-600',
      hoverText: 'hover:text-amber-600',
      enabled: true,
      icon: <GraduationCap className="w-6 h-6 text-amber-500" />,
      action: () => setSubTab('exam')
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
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-slate-100 rounded-2xl w-full sm:w-fit border border-slate-200/80 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setSubTab('hub')}
          title="Games Hub"
          className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 flex-1 sm:flex-initial ${
            subTab === 'hub' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Gamepad2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">Games Hub</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('exam')}
          title="Exam Hall"
          className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 flex-1 sm:flex-initial ${
            subTab === 'exam' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">Exam Hall</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('analytics')}
          title="Tracking Dashboard"
          className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 flex-1 sm:flex-initial ${
            subTab === 'analytics' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">Tracking Dashboard</span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase">
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
        <div className="space-y-4">
          {/* Header area */}
          <div className="px-1 py-0.5 flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Practice & Games</h2>
          </div>

          {/* 1. PINNED EXAM SECTION (SPECIAL FEATURED HEADER CARD) */}
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              onClick={() => setSubTab('exam')}
              className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400/80 shadow-xl shadow-indigo-950/20 cursor-pointer group transition-all duration-300"
            >
              {/* Background ambient light effects */}
              <div className="absolute -top-12 -right-12 w-44 h-44 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-indigo-500/25 rounded-full blur-2xl pointer-events-none" />

              {/* Top Bar: Pinned Badge & Tag */}
              <div className="flex items-center justify-between gap-2 mb-4 relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-full text-[11px] font-black uppercase tracking-wider shadow-2xs backdrop-blur-md">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>📌 PINNED FEATURED SECTION</span>
                </div>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 rounded-md border border-indigo-400/30 font-mono uppercase">
                  Model Test & Exam
                </span>
              </div>

              {/* Main Content */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform duration-300">
                    <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-white group-hover:text-amber-300 transition-colors flex items-center gap-2">
                      <span>Online Model Test & Live Exams</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 leading-relaxed">
                      Course-based timed exams, negative marking, detailed results, and global merit lists.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSubTab('exam');
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition cursor-pointer border border-amber-300"
                  >
                    <span>Enter Exam Hall</span>
                    <ChevronRight className="w-4 h-4 text-slate-950" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 2. SECTION DIVIDER FOR REGULAR INTERACTIVE GAMES */}
          <div className="max-w-2xl mx-auto flex items-center gap-3 pt-3 pb-1">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Interactive Games & Practice</span>
            </span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          {/* 3. STANDARD GAMES LIST (EXCLUDING PINNED EXAM) */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-2.5 max-w-2xl mx-auto"
          >
            {orderedItems.filter(item => item.key !== 'exam' && item.enabled).map((item) => {
              const stats = gameStats[item.key as keyof typeof gameStats] || { completed: 0, total: 0, percent: 0 };

              return (
                <motion.div
                  key={item.key}
                  variants={itemVariants}
                  whileHover={{ scale: 1.008 }}
                  onClick={item.action}
                  className="group relative transition-all duration-300 flex flex-row items-center justify-between p-2 sm:p-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl gap-2.5 sm:gap-3.5 overflow-hidden cursor-pointer bg-gradient-to-r from-[#477B4D] to-[#5A9E60] text-white shadow-md shadow-[#477B4D]/20 hover:brightness-105 border border-white/20"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  {/* Left Side: Icon Container */}
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/15 border border-white/20 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-white/25 transition-all [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-white">
                    {item.icon}
                  </div>

                  {/* Middle Side: Game Title & Progress */}
                  <div className="flex-1 min-w-0 font-poppins space-y-0.5 sm:space-y-1">
                    <h3 className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                      {item.title}
                    </h3>
                    <div className="text-[10px] sm:text-[11px] font-normal text-emerald-100/90 font-mono tracking-tight">
                      {stats.completed}/{stats.total} Qs ({stats.percent}%)
                    </div>

                    {/* Progress Bar Track */}
                    <div className="w-full h-1 bg-black/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-300 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${stats.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Right Side: Action Button */}
                  <div className="shrink-0 ml-0.5 sm:ml-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        item.action();
                      }}
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/20 hover:bg-white text-white hover:text-[#38663D] font-extrabold text-[11px] sm:text-xs transition flex items-center gap-0.5 sm:gap-1 cursor-pointer border border-white/30 shadow-2xs"
                    >
                      <span>{item.btnText}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Empty State when no games are enabled */}
            {orderedItems.filter(item => item.key !== 'exam' && item.enabled).length === 0 && (
              <div className="col-span-full py-12 text-center bg-white border border-slate-150 rounded-3xl p-8 space-y-3">
                <Gamepad2 className="w-12 h-12 text-slate-350 mx-auto" />
                <h3 className="font-extrabold text-slate-700 text-base">No practice games available</h3>
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

      {subTab === 'exam' && (
        <ExamView
          courses={allCourses || []}
          activeCourseId={activeCourseId}
          userEmail={userEmail}
          userDisplayName={userDisplayName}
          userId={userId}
          enrolledCourseIds={enrolledCourseIds || []}
          onSelectTab={onSelectTab}
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
