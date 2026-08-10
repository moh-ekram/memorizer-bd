import React, { useState, useMemo } from 'react';
import { VocabularyWord, UserProgress, BlankQuestion, OddOneOutQuestion, WordAnalogyQuestion, CustomMcqQuestion, Course } from '../types';
import { 
  GraduationCap, 
  Gamepad2, 
  Sparkles, 
  BookOpen, 
  HelpCircle, 
  Shuffle, 
  Trophy, 
  Target, 
  CheckCircle2, 
  XCircle, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  RefreshCw, 
  Play, 
  Award, 
  Zap, 
  AlertCircle,
  Filter,
  Check,
  Layers
} from 'lucide-react';
import { motion } from 'motion/react';

interface GameAnalyticsDashboardProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  synonymProgress: Record<string, { correct: boolean; updatedAt: string }>;
  blankProgress: Record<string, { correct: boolean; updatedAt: string }>;
  oooProgress: Record<string, { correct: boolean; updatedAt: string }>;
  analogyProgress: Record<string, { correct: boolean; updatedAt: string }>;
  blankQs: BlankQuestion[];
  oooQs: OddOneOutQuestion[];
  analogyQs: WordAnalogyQuestion[];
  mcqQs: CustomMcqQuestion[];
  activeCourseId: string;
  allCourses?: Course[];
  onPlayGame: (gameKey: 'quiz' | 'match' | 'synonym' | 'blank' | 'odd_one_out' | 'analogy') => void;
  onBackToHub?: () => void;
}

export interface GameMetric {
  key: 'quiz' | 'match' | 'synonym' | 'blank' | 'odd_one_out' | 'analogy';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  badgeBg: string;
  badgeText: string;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  remaining: number;
  accuracyPct: number;
  correctPctOfTotal: number;
  wrongPctOfTotal: number;
  statusGrade: 'mastery' | 'proficient' | 'developing' | 'unplayed';
}

// Dual / Multi-Segment Circular Percentage Ring Component
export function CorrectWrongRing({
  correct,
  wrong,
  total,
  size = 120,
  strokeWidth = 10,
  showLabel = true
}: {
  correct: number;
  wrong: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}) {
  const safeTotal = Math.max(1, total);
  const attempted = correct + wrong;
  const remaining = Math.max(0, safeTotal - attempted);

  // Percentages relative to total
  const correctRatio = correct / safeTotal;
  const wrongRatio = wrong / safeTotal;
  const remainingRatio = remaining / safeTotal;

  // Accuracy %
  const accuracyPct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

  const center = size / 2;
  const radius = center - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;

  // Arc lengths
  const correctDash = correctRatio * circumference;
  const wrongDash = wrongRatio * circumference;

  // Offsets (starting from top -90deg)
  const correctOffset = 0;
  const wrongOffset = -correctDash;

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Track Circle (Unattempted / Remaining) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Wronged Arc (Red) */}
        {wrong > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#f43f5e"
            strokeWidth={strokeWidth}
            strokeDasharray={`${wrongDash} ${circumference - wrongDash}`}
            strokeDashoffset={wrongOffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        )}

        {/* Corrected Arc (Green) */}
        {correct > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#10b981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${correctDash} ${circumference - correctDash}`}
            strokeDashoffset={correctOffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        )}
      </svg>

      {/* Center Metrics Label */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none pointer-events-none">
          <span className="text-base font-black text-slate-900 font-mono tracking-tight">
            {attempted > 0 ? `${accuracyPct}%` : '0%'}
          </span>
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mt-0.5">
            {attempted > 0 ? 'Accuracy' : 'New'}
          </span>
        </div>
      )}
    </div>
  );
}

export default function GameAnalyticsDashboard({
  words,
  progress,
  synonymProgress,
  blankProgress,
  oooProgress,
  analogyProgress,
  blankQs,
  oooQs,
  analogyQs,
  mcqQs,
  activeCourseId,
  allCourses,
  onPlayGame,
  onBackToHub
}: GameAnalyticsDashboardProps) {
  const [filterGrade, setFilterGrade] = useState<'all' | 'mastery' | 'proficient' | 'developing' | 'unplayed'>('all');

  // Compute Metrics for each of the 6 Games
  const gameMetrics = useMemo<GameMetric[]>(() => {
    const activeCourseName = allCourses?.find(c => c.id.trim().toLowerCase() === activeCourseId.trim().toLowerCase())?.title || activeCourseId.toUpperCase();
    const isGre = activeCourseId.trim().toLowerCase() === 'gre';

    // 1. MCQ Quiz
    const quizTotal = mcqQs.length > 0 ? mcqQs.length : Math.max(1, words.length);
    let quizCorrect = 0;
    let quizWrong = 0;
    words.forEach(w => {
      const p = progress[w.id];
      if (p) {
        if (p.status === 'know') quizCorrect++;
        else if (p.status === 'dont_know' || p.status === 'confusion') quizWrong++;
      }
    });
    const quizAttempted = quizCorrect + quizWrong;
    const quizAccuracyPct = quizAttempted > 0 ? Math.round((quizCorrect / quizAttempted) * 100) : 0;

    // 2. Word Match
    const matchTotal = Math.max(1, words.length);
    let matchCorrect = 0;
    let matchWrong = 0;
    words.forEach(w => {
      const p = progress[w.id];
      if (p) {
        if (p.status === 'know') matchCorrect++;
        else if (p.status === 'dont_know' || p.status === 'confusion') matchWrong++;
      }
    });
    const matchAttempted = matchCorrect + matchWrong;
    const matchAccuracyPct = matchAttempted > 0 ? Math.round((matchCorrect / matchAttempted) * 100) : 0;

    // 3. Synonym Check
    const synonymTotal = Math.max(1, words.length);
    let synonymCorrect = 0;
    let synonymWrong = 0;
    Object.values(synonymProgress).forEach(item => {
      if (item.correct) synonymCorrect++;
      else synonymWrong++;
    });
    const synonymAttempted = synonymCorrect + synonymWrong;
    const synonymAccuracyPct = synonymAttempted > 0 ? Math.round((synonymCorrect / synonymAttempted) * 100) : 0;

    // 4. Blank Filling
    let blankTotal = blankQs.length;
    if (blankTotal === 0) blankTotal = isGre ? 5 : Math.max(1, words.length);
    let blankCorrect = 0;
    let blankWrong = 0;
    Object.values(blankProgress).forEach(item => {
      if (item.correct) blankCorrect++;
      else blankWrong++;
    });
    const blankAttempted = blankCorrect + blankWrong;
    const blankAccuracyPct = blankAttempted > 0 ? Math.round((blankCorrect / blankAttempted) * 100) : 0;

    // 5. Odd One Out
    let oooTotal = oooQs.length;
    if (oooTotal === 0) oooTotal = isGre ? 5 : Math.max(1, words.length);
    let oooCorrect = 0;
    let oooWrong = 0;
    Object.values(oooProgress).forEach(item => {
      if (item.correct) oooCorrect++;
      else oooWrong++;
    });
    const oooAttempted = oooCorrect + oooWrong;
    const oooAccuracyPct = oooAttempted > 0 ? Math.round((oooCorrect / oooAttempted) * 100) : 0;

    // 6. Word Analogy
    let analogyTotal = analogyQs.length;
    if (analogyTotal === 0) analogyTotal = isGre ? 5 : Math.max(1, words.length);
    let analogyCorrect = 0;
    let analogyWrong = 0;
    Object.values(analogyProgress).forEach(item => {
      if (item.correct) analogyCorrect++;
      else analogyWrong++;
    });
    const analogyAttempted = analogyCorrect + analogyWrong;
    const analogyAccuracyPct = analogyAttempted > 0 ? Math.round((analogyCorrect / analogyAttempted) * 100) : 0;

    const calcGrade = (attempted: number, accuracy: number): 'mastery' | 'proficient' | 'developing' | 'unplayed' => {
      if (attempted === 0) return 'unplayed';
      if (accuracy >= 85) return 'mastery';
      if (accuracy >= 70) return 'proficient';
      return 'developing';
    };

    const rawList: GameMetric[] = [
      {
        key: 'quiz',
        title: 'MCQ Quiz',
        subtitle: 'Vocabulary & Context MCQs',
        icon: <GraduationCap className="w-5 h-5 text-indigo-600" />,
        iconBg: 'bg-indigo-50 border-indigo-100',
        badgeBg: 'bg-indigo-100 text-indigo-800',
        badgeText: 'Multiple Choice',
        total: quizTotal,
        attempted: quizAttempted,
        correct: quizCorrect,
        wrong: quizWrong,
        remaining: Math.max(0, quizTotal - quizAttempted),
        accuracyPct: quizAccuracyPct,
        correctPctOfTotal: Math.round((quizCorrect / quizTotal) * 100),
        wrongPctOfTotal: Math.round((quizWrong / quizTotal) * 100),
        statusGrade: calcGrade(quizAttempted, quizAccuracyPct)
      },
      {
        key: 'match',
        title: 'Word Match',
        subtitle: 'Speed Matching Challenge',
        icon: <Gamepad2 className="w-5 h-5 text-pink-600" />,
        iconBg: 'bg-pink-50 border-pink-100',
        badgeBg: 'bg-pink-100 text-pink-800',
        badgeText: 'Pair Matching',
        total: matchTotal,
        attempted: matchAttempted,
        correct: matchCorrect,
        wrong: matchWrong,
        remaining: Math.max(0, matchTotal - matchAttempted),
        accuracyPct: matchAccuracyPct,
        correctPctOfTotal: Math.round((matchCorrect / matchTotal) * 100),
        wrongPctOfTotal: Math.round((matchWrong / matchTotal) * 100),
        statusGrade: calcGrade(matchAttempted, matchAccuracyPct)
      },
      {
        key: 'synonym',
        title: 'Synonym Check',
        subtitle: 'Word Relations & Verification',
        icon: <Sparkles className="w-5 h-5 text-amber-600" />,
        iconBg: 'bg-amber-50 border-amber-100',
        badgeBg: 'bg-amber-100 text-amber-800',
        badgeText: 'Synonyms',
        total: synonymTotal,
        attempted: synonymAttempted,
        correct: synonymCorrect,
        wrong: synonymWrong,
        remaining: Math.max(0, synonymTotal - synonymAttempted),
        accuracyPct: synonymAccuracyPct,
        correctPctOfTotal: Math.round((synonymCorrect / synonymTotal) * 100),
        wrongPctOfTotal: Math.round((synonymWrong / synonymTotal) * 100),
        statusGrade: calcGrade(synonymAttempted, synonymAccuracyPct)
      },
      {
        key: 'blank',
        title: 'Blank Filling',
        subtitle: 'Sentence Context & Cloze',
        icon: <BookOpen className="w-5 h-5 text-emerald-600" />,
        iconBg: 'bg-emerald-50 border-emerald-100',
        badgeBg: 'bg-emerald-100 text-emerald-800',
        badgeText: 'Fill Blanks',
        total: blankTotal,
        attempted: blankAttempted,
        correct: blankCorrect,
        wrong: blankWrong,
        remaining: Math.max(0, blankTotal - blankAttempted),
        accuracyPct: blankAccuracyPct,
        correctPctOfTotal: Math.round((blankCorrect / blankTotal) * 100),
        wrongPctOfTotal: Math.round((blankWrong / blankTotal) * 100),
        statusGrade: calcGrade(blankAttempted, blankAccuracyPct)
      },
      {
        key: 'odd_one_out',
        title: 'Odd One Out',
        subtitle: 'Semantic Group Discrimination',
        icon: <HelpCircle className="w-5 h-5 text-sky-600" />,
        iconBg: 'bg-sky-50 border-sky-100',
        badgeBg: 'bg-sky-100 text-sky-800',
        badgeText: 'Discrimination',
        total: oooTotal,
        attempted: oooAttempted,
        correct: oooCorrect,
        wrong: oooWrong,
        remaining: Math.max(0, oooTotal - oooAttempted),
        accuracyPct: oooAccuracyPct,
        correctPctOfTotal: Math.round((oooCorrect / oooTotal) * 100),
        wrongPctOfTotal: Math.round((oooWrong / oooTotal) * 100),
        statusGrade: calcGrade(oooAttempted, oooAccuracyPct)
      },
      {
        key: 'analogy',
        title: 'Word Analogy',
        subtitle: 'Logic & Relational Pairs',
        icon: <Shuffle className="w-5 h-5 text-purple-600" />,
        iconBg: 'bg-purple-50 border-purple-100',
        badgeBg: 'bg-purple-100 text-purple-800',
        badgeText: 'Logic Analogy',
        total: analogyTotal,
        attempted: analogyAttempted,
        correct: analogyCorrect,
        wrong: analogyWrong,
        remaining: Math.max(0, analogyTotal - analogyAttempted),
        accuracyPct: analogyAccuracyPct,
        correctPctOfTotal: Math.round((analogyCorrect / analogyTotal) * 100),
        wrongPctOfTotal: Math.round((analogyWrong / analogyTotal) * 100),
        statusGrade: calcGrade(analogyAttempted, analogyAccuracyPct)
      }
    ];

    return rawList;
  }, [words, progress, synonymProgress, blankProgress, oooProgress, analogyProgress, blankQs, oooQs, analogyQs, mcqQs, activeCourseId, allCourses]);

  // Overall Aggregate Stats across all 6 games
  const overallAggregate = useMemo(() => {
    let totalQs = 0;
    let attemptedQs = 0;
    let correctQs = 0;
    let wrongQs = 0;

    gameMetrics.forEach(m => {
      totalQs += m.total;
      attemptedQs += m.attempted;
      correctQs += m.correct;
      wrongQs += m.wrong;
    });

    const accuracyPct = attemptedQs > 0 ? Math.round((correctQs / attemptedQs) * 100) : 0;
    const wrongPct = attemptedQs > 0 ? Math.round((wrongQs / attemptedQs) * 100) : 0;
    const completionPct = totalQs > 0 ? Math.round((attemptedQs / totalQs) * 100) : 0;

    return {
      totalQs,
      attemptedQs,
      correctQs,
      wrongQs,
      remainingQs: Math.max(0, totalQs - attemptedQs),
      accuracyPct,
      wrongPct,
      completionPct
    };
  }, [gameMetrics]);

  const filteredMetrics = useMemo(() => {
    if (filterGrade === 'all') return gameMetrics;
    return gameMetrics.filter(m => m.statusGrade === filterGrade);
  }, [gameMetrics, filterGrade]);

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto" id="game-analytics-dashboard">
      {/* Dashboard Top Header Banner */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-3 max-w-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full border border-indigo-500/30">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Comprehensive Games Tracking</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-extrabold rounded-full border border-emerald-500/30">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>Overall Accuracy: {overallAggregate.accuracyPct}%</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Games Performance Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
            Real-time tracking system showing corrected vs. wronged statistics, accuracy percentages, and progress circles for all 6 practice games.
          </p>
        </div>

        {onBackToHub && (
          <button
            onClick={onBackToHub}
            className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold rounded-2xl border border-white/15 transition flex items-center gap-2 shrink-0 self-start md:self-center cursor-pointer shadow-sm"
          >
            <Gamepad2 className="w-4 h-4 text-indigo-300" />
            <span>Back to Games Hub</span>
          </button>
        )}
      </div>

      {/* Aggregate KPI Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Questions KPI */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Questions</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-mono">{overallAggregate.attemptedQs}</span>
              <span className="text-xs text-slate-400 font-bold font-mono">/ {overallAggregate.totalQs}</span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Attempted across games</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <Target className="w-6 h-6" />
          </div>
        </div>

        {/* Corrected KPI */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Corrected</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 font-mono">{overallAggregate.correctQs}</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-mono">
                {overallAggregate.accuracyPct}%
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Right answers rate</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Wronged KPI */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Wronged</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-600 font-mono">{overallAggregate.wrongQs}</span>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-mono">
                {overallAggregate.wrongPct}%
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Needs practice review</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Overall Accuracy Gauge Card */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-2xl border border-indigo-800/50 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider block">Mastery Score</span>
            <div className="text-2xl font-black font-mono text-white">
              {overallAggregate.accuracyPct}%
            </div>
            <p className="text-[10px] text-slate-300 font-medium">Overall Games Accuracy</p>
          </div>
          <CorrectWrongRing
            correct={overallAggregate.correctQs}
            wrong={overallAggregate.wrongQs}
            total={Math.max(1, overallAggregate.attemptedQs)}
            size={64}
            strokeWidth={7}
            showLabel={false}
          />
        </div>
      </div>

      {/* Filter Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-1 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <Layers className="w-4.5 h-4.5 text-indigo-600" />
          <h3 className="text-base font-extrabold text-slate-900">Per-Game Corrected & Wronged Circles</h3>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterGrade('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              filterGrade === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            All Games ({gameMetrics.length})
          </button>
          <button
            onClick={() => setFilterGrade('mastery')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              filterGrade === 'mastery'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
            }`}
          >
            Mastery (≥85%)
          </button>
          <button
            onClick={() => setFilterGrade('proficient')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              filterGrade === 'proficient'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
            }`}
          >
            Proficient (70-84%)
          </button>
          <button
            onClick={() => setFilterGrade('developing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              filterGrade === 'developing'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
            }`}
          >
            Needs Practice (&lt;70%)
          </button>
          <button
            onClick={() => setFilterGrade('unplayed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              filterGrade === 'unplayed'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Unplayed
          </button>
        </div>
      </div>

      {/* 6 Games Grid with Percentage Circles & Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMetrics.map((game) => {
          const isUnplayed = game.attempted === 0;

          return (
            <motion.div
              key={game.key}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-6 space-y-5 flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl border ${game.iconBg}`}>
                      {game.icon}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base leading-tight">{game.title}</h4>
                      <p className="text-[11px] text-slate-400 font-medium">{game.subtitle}</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold font-mono uppercase tracking-wider ${game.badgeBg}`}>
                    {game.badgeText}
                  </span>
                </div>

                {/* Status Grade Tag */}
                <div className="flex items-center gap-2">
                  {game.statusGrade === 'mastery' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mastery Achieved</span>
                    </span>
                  )}
                  {game.statusGrade === 'proficient' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>Proficient</span>
                    </span>
                  )}
                  {game.statusGrade === 'developing' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Needs Practice</span>
                    </span>
                  )}
                  {game.statusGrade === 'unplayed' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold border border-slate-200">
                      <Target className="w-3.5 h-3.5 text-slate-500" />
                      <span>Not Played Yet</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Main Visual Section: Percentage Circle Ring & Metric Legend */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                {/* SVG Donut Circle Ring */}
                <CorrectWrongRing
                  correct={game.correct}
                  wrong={game.wrong}
                  total={game.total}
                  size={92}
                  strokeWidth={9}
                />

                {/* Legend List */}
                <div className="space-y-2 text-xs flex-1">
                  {/* Corrected */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span>Corrected:</span>
                    </div>
                    <span className="font-extrabold font-mono text-emerald-600">
                      {game.correct} <span className="text-[10px] text-slate-400 font-normal">({game.correctPctOfTotal}%)</span>
                    </span>
                  </div>

                  {/* Wronged */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                      <span>Wronged:</span>
                    </div>
                    <span className="font-extrabold font-mono text-rose-600">
                      {game.wrong} <span className="text-[10px] text-slate-400 font-normal">({game.wrongPctOfTotal}%)</span>
                    </span>
                  </div>

                  {/* Remaining */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                      <span>Unattempted:</span>
                    </div>
                    <span className="font-extrabold font-mono text-slate-500">
                      {game.remaining}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stacked Percentage Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                  <span>Accuracy Rate</span>
                  <span className="font-mono text-slate-900 font-extrabold">{isUnplayed ? '0%' : `${game.accuracyPct}%`}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                  {game.correct > 0 && (
                    <div
                      style={{ width: `${(game.correct / game.total) * 100}%` }}
                      className="bg-emerald-500 h-full transition-all duration-500"
                      title={`Correct: ${game.correct}`}
                    />
                  )}
                  {game.wrong > 0 && (
                    <div
                      style={{ width: `${(game.wrong / game.total) * 100}%` }}
                      className="bg-rose-500 h-full transition-all duration-500"
                      title={`Wrong: ${game.wrong}`}
                    />
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onPlayGame(game.key)}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer group"
              >
                <Play className="w-3.5 h-3.5 fill-white group-hover:scale-110 transition-transform" />
                <span>{isUnplayed ? 'Start Playing' : 'Practice Game Now'}</span>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
