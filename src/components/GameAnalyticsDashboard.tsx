import React, { useState, useMemo } from 'react';
import { VocabularyWord, UserProgress, BlankQuestion, OddOneOutQuestion, WordAnalogyQuestion, CustomMcqQuestion, Course } from '../types';
import { 
  GraduationCap, 
  Gamepad2, 
  Sparkles, 
  BookOpen, 
  HelpCircle, 
  Shuffle, 
  Target, 
  CheckCircle2, 
  XCircle, 
  BarChart3, 
  Award, 
  Zap, 
  AlertCircle,
  Play,
  Layers,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Flame,
  Calendar,
  BarChart2,
  Clock,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';

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
  size = 110,
  strokeWidth = 9,
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

  // Percentages relative to total
  const correctRatio = correct / safeTotal;
  const wrongRatio = wrong / safeTotal;

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
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 filter drop-shadow-xs">
        {/* Background Track Circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Wronged Arc (Rose Red) */}
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

        {/* Corrected Arc (Emerald Green) */}
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
          <span className="text-sm font-black text-slate-900 font-mono tracking-tight">
            {attempted > 0 ? `${accuracyPct}%` : '0%'}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
            {attempted > 0 ? 'Accuracy' : 'New'}
          </span>
        </div>
      )}
    </div>
  );
}

// Custom Tooltip for Recharts Consistency Chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-xl text-xs space-y-1 font-sans">
        <div className="font-extrabold text-indigo-300 text-[11px] font-mono">{label}</div>
        <div className="flex items-center gap-2 text-slate-200">
          <Target className="w-3.5 h-3.5 text-cyan-400" />
          <span>Total Solved: <strong className="font-mono text-white">{data.count}</strong> Qs</span>
        </div>
        {data.count > 0 && (
          <div className="flex items-center gap-2 text-emerald-300 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Correct: {data.correct} | Wrong: {data.wrong}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

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
  const [chartViewMode, setChartViewMode] = useState<'area' | 'bar' | 'heatmap'>('area');
  const [displayLayout, setDisplayLayout] = useState<'table' | 'cards'>('table');

  // Compute 30-Day Daily Study Consistency Trend
  const dailyConsistencyData = useMemo(() => {
    const daysMap: Record<string, { dateStr: string; label: string; count: number; correct: number; wrong: number }> = {};
    const today = new Date();

    // Pre-fill last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const isoKey = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daysMap[isoKey] = { dateStr: isoKey, label, count: 0, correct: 0, wrong: 0 };
    }

    const processTimestamp = (updatedAtStr?: string, isCorrect?: boolean) => {
      if (!updatedAtStr) return;
      try {
        const d = new Date(updatedAtStr);
        if (isNaN(d.getTime())) return;
        const key = d.toISOString().split('T')[0];
        if (daysMap[key]) {
          daysMap[key].count += 1;
          if (isCorrect !== undefined) {
            if (isCorrect) daysMap[key].correct += 1;
            else daysMap[key].wrong += 1;
          } else {
            daysMap[key].correct += 1;
          }
        }
      } catch (_) {}
    };

    // Parse progress maps
    Object.values(synonymProgress || {}).forEach(p => processTimestamp(p.updatedAt, p.correct));
    Object.values(blankProgress || {}).forEach(p => processTimestamp(p.updatedAt, p.correct));
    Object.values(oooProgress || {}).forEach(p => processTimestamp(p.updatedAt, p.correct));
    Object.values(analogyProgress || {}).forEach(p => processTimestamp(p.updatedAt, p.correct));
    Object.values(progress || {}).forEach(p => {
      processTimestamp((p as any).lastReviewed || p.updatedAt, p.status === 'know');
    });

    const dataList = Object.values(daysMap);
    const activeDaysCount = dataList.filter(d => d.count > 0).length;
    const maxDailyCount = Math.max(1, ...dataList.map(d => d.count));
    const total30DayQuestions = dataList.reduce((acc, d) => acc + d.count, 0);

    // Calculate current streak
    let currentStreak = 0;
    for (let i = dataList.length - 1; i >= 0; i--) {
      if (dataList[i].count > 0) currentStreak++;
      else if (i === dataList.length - 1) continue;
      else break;
    }

    return {
      chartData: dataList,
      activeDaysCount,
      consistencyPct: Math.round((activeDaysCount / 30) * 100),
      maxDailyCount,
      total30DayQuestions,
      currentStreak
    };
  }, [synonymProgress, blankProgress, oooProgress, analogyProgress, progress]);

  // Compute Metrics for each of the 6 Games
  const gameMetrics = useMemo<GameMetric[]>(() => {
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
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
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
        badgeBg: 'bg-pink-50 text-pink-700 border-pink-200/80',
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
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200/80',
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
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
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
        badgeBg: 'bg-sky-50 text-sky-700 border-sky-200/80',
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
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-200/80',
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
  }, [words, progress, synonymProgress, blankProgress, oooProgress, analogyProgress, blankQs, oooQs, analogyQs, mcqQs, activeCourseId]);

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
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto py-2" id="game-analytics-dashboard">
      {/* Dashboard Top Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-xl border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-3 max-w-xl relative z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full border border-indigo-500/30 backdrop-blur-md">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Real-Time Practice Tracking</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-black rounded-full border border-emerald-500/30 backdrop-blur-md">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>Overall Accuracy: {overallAggregate.accuracyPct}%</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
            <span>Games Performance Tracking</span>
            <Activity className="w-6 h-6 text-indigo-400 hidden sm:inline" />
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
            Real-time practice analytics — Track correct vs wrong answers, accuracy donut gauges, and performance metrics for all games.
          </p>
        </div>

        {onBackToHub && (
          <button
            onClick={onBackToHub}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-2xl border border-white/15 transition flex items-center gap-2 shrink-0 self-start md:self-center cursor-pointer shadow-md backdrop-blur-sm group whitespace-nowrap"
          >
            <Gamepad2 className="w-4 h-4 text-indigo-300 group-hover:scale-110 transition-transform" />
            <span>Return to Games Hub</span>
          </button>
        )}
      </div>

      {/* Aggregate KPI Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Questions KPI */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block whitespace-nowrap">Attempted / Total</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900 font-mono">{overallAggregate.attemptedQs}</span>
              <span className="text-xs text-slate-400 font-bold font-mono">/ {overallAggregate.totalQs}</span>
            </div>
            <p className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">Total Solved Questions</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <Target className="w-5 h-5" />
          </div>
        </div>

        {/* Corrected KPI */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-200 transition-all flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block whitespace-nowrap">Total Correct</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-600 font-mono">{overallAggregate.correctQs}</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full font-mono border border-emerald-100">
                {overallAggregate.accuracyPct}%
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">Accuracy Rate</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Wronged KPI */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-200 transition-all flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block whitespace-nowrap">Total Wrong</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-rose-600 font-mono">{overallAggregate.wrongQs}</span>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded-full font-mono border border-rose-100">
                {overallAggregate.wrongPct}%
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">Needs Review</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Overall Accuracy Gauge Card */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-2xl border border-indigo-800/60 shadow-xs flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider block whitespace-nowrap">Mastery Score</span>
            <div className="text-xl font-black font-mono text-white">
              {overallAggregate.accuracyPct}%
            </div>
            <p className="text-[10px] text-indigo-200 font-semibold whitespace-nowrap">Overall Mastery</p>
          </div>
          <CorrectWrongRing
            correct={overallAggregate.correctQs}
            wrong={overallAggregate.wrongQs}
            total={Math.max(1, overallAggregate.attemptedQs)}
            size={52}
            strokeWidth={6}
            showLabel={false}
          />
        </div>
      </div>

      {/* 30-DAY STUDY CONSISTENCY (RECHARTS VISUAL & HEATMAP) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base whitespace-nowrap">30-Day Study Consistency</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/80 whitespace-nowrap">
                  Daily Heatmap
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Daily practice consistency and activity trends over the last 30 days
              </p>
            </div>
          </div>

          {/* Stat Badges + View Mode Switch */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-black">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>{dailyConsistencyData.currentStreak}d Streak</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-800 border border-cyan-200/80 rounded-xl text-xs font-black">
              <Zap className="w-4 h-4 text-cyan-600" />
              <span>{dailyConsistencyData.consistencyPct}% Consistency</span>
            </div>

            {/* Toggle View Mode */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setChartViewMode('area')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  chartViewMode === 'area' ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Line</span>
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('bar')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  chartViewMode === 'bar' ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Bar</span>
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('heatmap')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  chartViewMode === 'heatmap' ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chart Body */}
        {chartViewMode === 'heatmap' ? (
          /* 30-Day Activity Tile Heatmap */
          <div className="space-y-3">
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 p-3 bg-slate-50/80 border border-slate-200/70 rounded-2xl">
              {dailyConsistencyData.chartData.map((d) => {
                const intensity = d.count === 0 ? 0 : d.count <= 3 ? 1 : d.count <= 8 ? 2 : d.count <= 15 ? 3 : 4;
                const bgClasses = [
                  'bg-slate-100/90 border-slate-200/80 text-slate-400',
                  'bg-indigo-100/90 border-indigo-200 text-indigo-800 font-extrabold',
                  'bg-cyan-200 border-cyan-300 text-cyan-900 font-extrabold',
                  'bg-indigo-600 border-indigo-700 text-white font-extrabold',
                  'bg-emerald-500 border-emerald-600 text-white font-extrabold shadow-2xs'
                ][intensity];

                return (
                  <div
                    key={d.dateStr}
                    title={`${d.label}: ${d.count} questions solved (${d.correct} correct)`}
                    className={`p-2 rounded-xl border text-center flex flex-col items-center justify-between min-h-[50px] transition hover:scale-105 cursor-default ${bgClasses}`}
                  >
                    <span className="text-[9px] uppercase tracking-wider opacity-80">{d.label}</span>
                    <span className="text-xs font-mono font-black mt-0.5">{d.count}</span>
                  </div>
                );
              })}
            </div>
            {/* Heatmap Legend */}
            <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-slate-500 pt-1">
              <span>Less</span>
              <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block" />
              <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200 inline-block" />
              <span className="w-3 h-3 rounded bg-cyan-200 border border-cyan-300 inline-block" />
              <span className="w-3 h-3 rounded bg-indigo-600 border border-indigo-700 inline-block" />
              <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-600 inline-block" />
              <span>More</span>
            </div>
          </div>
        ) : (
          /* Recharts Area / Bar Chart */
          <div className="w-full h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chartViewMode === 'area' ? (
                <AreaChart data={dailyConsistencyData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorConsistency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <RechartsTooltip content={CustomTooltip} />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorConsistency)" 
                  />
                </AreaChart>
              ) : (
                <BarChart data={dailyConsistencyData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <RechartsTooltip content={CustomTooltip} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {dailyConsistencyData.chartData.map((entry) => (
                      <Cell 
                        key={entry.dateStr} 
                        fill={entry.count === 0 ? '#e2e8f0' : entry.count >= dailyConsistencyData.maxDailyCount * 0.7 ? '#10b981' : '#6366f1'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filter & Layout Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-extrabold text-slate-900 whitespace-nowrap">Game Performance Analytics</h3>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Layout Toggle (Table vs Cards) */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/80 shrink-0">
            <button
              type="button"
              onClick={() => setDisplayLayout('table')}
              className={`px-2 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 cursor-pointer ${
                displayLayout === 'table' ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3 h-3" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayLayout('cards')}
              className={`px-2 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 cursor-pointer ${
                displayLayout === 'cards' ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Cards</span>
            </button>
          </div>

          {/* Minimal Pill Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
            <button
              onClick={() => setFilterGrade('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer shrink-0 flex items-center gap-1.5 whitespace-nowrap ${
                filterGrade === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>All ({gameMetrics.length})</span>
            </button>
            <button
              onClick={() => setFilterGrade('mastery')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer shrink-0 flex items-center gap-1.5 whitespace-nowrap ${
                filterGrade === 'mastery'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200/60 font-semibold'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Mastery</span>
            </button>
            <button
              onClick={() => setFilterGrade('proficient')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer shrink-0 flex items-center gap-1.5 whitespace-nowrap ${
                filterGrade === 'proficient'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-amber-50/80 hover:bg-amber-100/80 text-amber-800 border border-amber-200/60 font-semibold'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Proficient</span>
            </button>
            <button
              onClick={() => setFilterGrade('developing')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer shrink-0 flex items-center gap-1.5 whitespace-nowrap ${
                filterGrade === 'developing'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50/80 hover:bg-rose-100/80 text-rose-800 border border-rose-200/60 font-semibold'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              <span>Needs Practice</span>
            </button>
            <button
              onClick={() => setFilterGrade('unplayed')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer shrink-0 flex items-center gap-1.5 whitespace-nowrap ${
                filterGrade === 'unplayed'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold'
              }`}
            >
              <Target className="w-3 h-3" />
              <span>Unplayed</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Modern Table vs Cards */}
      {displayLayout === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="px-3.5 py-2.5 whitespace-nowrap">Game & Category</th>
                  <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Accuracy & Donut</th>
                  <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Correct</th>
                  <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Wrong</th>
                  <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Remaining</th>
                  <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Status</th>
                  <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredMetrics.map((game) => {
                  const isUnplayed = game.attempted === 0;

                  return (
                    <motion.tr
                      key={game.key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      className="hover:bg-indigo-50/30 transition-colors group"
                    >
                      {/* Cell 1: Game Icon, Title, Subtitle & Badge */}
                      <td className="px-3.5 py-2.5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-indigo-50/90 border border-indigo-100 text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                            {game.icon}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-extrabold text-slate-900 text-xs sm:text-[13px] group-hover:text-indigo-600 transition-colors whitespace-nowrap">
                                {game.title}
                              </h4>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200/70 whitespace-nowrap">
                                {game.badgeText}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{game.subtitle}</p>
                          </div>
                        </div>
                      </td>

                      {/* Cell 2: Accuracy & Donut Ring */}
                      <td className="px-3.5 py-2.5 align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <CorrectWrongRing
                            correct={game.correct}
                            wrong={game.wrong}
                            total={game.total}
                            size={40}
                            strokeWidth={4.5}
                          />
                          <div className="space-y-0.5 w-20">
                            <div className="flex items-center justify-between text-[10px] font-black font-mono text-indigo-700">
                              <span>{isUnplayed ? '0%' : `${game.accuracyPct}%`}</span>
                              <span className="text-[8px] text-slate-400 uppercase font-semibold">Acc</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-150 rounded-full overflow-hidden flex">
                              {game.correct > 0 && (
                                <div
                                  style={{ width: `${(game.correct / game.total) * 100}%` }}
                                  className="bg-emerald-500 h-full"
                                  title={`Correct: ${game.correct}`}
                                />
                              )}
                              {game.wrong > 0 && (
                                <div
                                  style={{ width: `${(game.wrong / game.total) * 100}%` }}
                                  className="bg-rose-500 h-full"
                                  title={`Wrong: ${game.wrong}`}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cell 3: Correct */}
                      <td className="px-3.5 py-2.5 align-middle text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-mono text-[11px] whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="font-extrabold">{game.correct}</span>
                          <span className="text-[9px] text-emerald-700 font-extrabold bg-emerald-100/90 px-1 py-0.2 rounded">
                            {game.correctPctOfTotal}%
                          </span>
                        </div>
                      </td>

                      {/* Cell 4: Wrong */}
                      <td className="px-3.5 py-2.5 align-middle text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200/70 font-mono text-[11px] whitespace-nowrap">
                          <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span className="font-extrabold">{game.wrong}</span>
                          <span className="text-[9px] text-rose-700 font-extrabold bg-rose-100/90 px-1 py-0.2 rounded">
                            {game.wrongPctOfTotal}%
                          </span>
                        </div>
                      </td>

                      {/* Cell 5: Remaining */}
                      <td className="px-3.5 py-2.5 align-middle text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/70 font-mono text-[11px] whitespace-nowrap">
                          <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-extrabold">{game.remaining}</span>
                        </div>
                      </td>

                      {/* Cell 6: Status */}
                      <td className="px-3.5 py-2.5 align-middle text-center whitespace-nowrap">
                        {game.statusGrade === 'mastery' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200 whitespace-nowrap">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>Mastery</span>
                          </span>
                        )}
                        {game.statusGrade === 'proficient' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-extrabold border border-amber-200 whitespace-nowrap">
                            <Zap className="w-3 h-3 text-amber-600" />
                            <span>Proficient</span>
                          </span>
                        )}
                        {game.statusGrade === 'developing' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-extrabold border border-rose-200 whitespace-nowrap">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Needs Practice</span>
                          </span>
                        )}
                        {game.statusGrade === 'unplayed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-extrabold border border-slate-200 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>Not Played</span>
                          </span>
                        )}
                      </td>

                      {/* Cell 7: Action */}
                      <td className="px-3.5 py-2.5 align-middle text-right whitespace-nowrap">
                        <button
                          onClick={() => onPlayGame(game.key)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white font-extrabold text-[11px] rounded-lg shadow-2xs hover:shadow-xs transition-all inline-flex items-center gap-1 cursor-pointer group/btn whitespace-nowrap"
                        >
                          <Play className="w-3 h-3 fill-cyan-400 text-cyan-400 group-hover/btn:fill-white group-hover/btn:text-white transition-colors" />
                          <span>{isUnplayed ? 'Start' : 'Practice'}</span>
                          <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover/btn:text-white transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 6 Games Grid - Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMetrics.map((game) => {
            const isUnplayed = game.attempted === 0;

            return (
              <motion.div
                key={game.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="group bg-gradient-to-b from-white to-slate-50/70 rounded-3xl border border-slate-200/90 hover:border-indigo-300/90 shadow-2xs hover:shadow-lg hover:shadow-indigo-500/5 transition-all p-5 space-y-4 flex flex-col justify-between"
              >
                {/* Card Top Row */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-indigo-50/90 border border-indigo-100 text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                        {game.icon}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base leading-tight group-hover:text-indigo-600 transition-colors">
                          {game.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">{game.subtitle}</p>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200/80 shrink-0">
                      {game.badgeText}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {game.statusGrade === 'mastery' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-black border border-emerald-200/80">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mastery</span>
                      </span>
                    )}
                    {game.statusGrade === 'proficient' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-black border border-amber-200/80">
                        <Zap className="w-3.5 h-3.5 text-amber-600" />
                        <span>Proficient</span>
                      </span>
                    )}
                    {game.statusGrade === 'developing' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-black border border-rose-200/80">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Needs Practice</span>
                      </span>
                    )}
                    {game.statusGrade === 'unplayed' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black border border-slate-200/80">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Not Played</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-100/70 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-4">
                  <div className="shrink-0">
                    <CorrectWrongRing
                      correct={game.correct}
                      wrong={game.wrong}
                      total={game.total}
                      size={76}
                      strokeWidth={7}
                    />
                  </div>

                  <div className="space-y-1.5 flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Correct</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="font-extrabold text-emerald-600">{game.correct}</span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1 py-0.2 rounded font-black">
                          {game.correctPctOfTotal}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                        <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>Wrong</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="font-extrabold text-rose-600">{game.wrong}</span>
                        <span className="text-[10px] text-rose-700 bg-rose-100/80 px-1 py-0.2 rounded font-black">
                          {game.wrongPctOfTotal}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Remaining</span>
                      </div>
                      <span className="font-extrabold font-mono text-slate-600">
                        {game.remaining}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                    <span className="flex items-center gap-1 text-slate-600">
                      <Target className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Accuracy Rate</span>
                    </span>
                    <span className="font-mono text-indigo-700 font-black">{isUnplayed ? '0%' : `${game.accuracyPct}%`}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-150 rounded-full overflow-hidden flex">
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

                <button
                  onClick={() => onPlayGame(game.key)}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md hover:shadow-indigo-500/20 transition-all flex items-center justify-between cursor-pointer group/btn"
                >
                  <div className="flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 fill-cyan-400 text-cyan-400 group-hover/btn:fill-white group-hover/btn:text-white transition-colors" />
                    <span>{isUnplayed ? 'Start Game' : 'Practice Game'}</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-white group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-all" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
