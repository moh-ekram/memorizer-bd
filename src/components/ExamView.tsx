import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  Clock, 
  Award, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCcw, 
  Trophy, 
  ChevronRight, 
  ChevronLeft, 
  HelpCircle, 
  BarChart3, 
  ListFilter, 
  Sparkles, 
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users
} from 'lucide-react';
import { db, collection, getDocs, doc, setDoc } from '../lib/db';
import { Exam, ExamQuestion, ExamResult, Course } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from '../lib/storage';

interface ExamViewProps {
  courses: Course[];
  activeCourseId: string;
  userEmail?: string;
  userDisplayName?: string;
  userId?: string;
}

export function ExamView({ courses, activeCourseId, userEmail, userDisplayName, userId }: ExamViewProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>(activeCourseId || 'all');

  // Exam taking state
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [flaggedQs, setFlaggedQs] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds
  const [isExamCompleted, setIsExamCompleted] = useState<boolean>(false);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);

  // Merit List state
  const [meritListExam, setMeritListExam] = useState<Exam | null>(null);
  const [meritResults, setMeritResults] = useState<ExamResult[]>([]);
  const [loadingMerit, setLoadingMerit] = useState<boolean>(false);

  // Fetch Exams from Firestore & Local Cache
  useEffect(() => {
    let isMounted = true;
    const fetchExams = async () => {
      setLoading(true);
      const examMap = new Map<string, Exam>();

      // Load from local storage first
      try {
        const localData = safeGetLocalStorage('local_exams', '[]');
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed)) {
          parsed.forEach((e: Exam) => { if (e && e.id) examMap.set(e.id, e); });
        }
      } catch (_) {}

      try {
        const snap = await getDocs(collection(db, 'exams'));
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (docSnap.id) examMap.set(docSnap.id, { id: docSnap.id, ...d } as Exam);
        });
      } catch (err) {
        console.warn('Notice loading cloud exams:', err);
      } finally {
        const combined = Array.from(examMap.values());
        if (isMounted) {
          setExams(combined);
          setLoading(false);
        }
      }
    };

    fetchExams();
    return () => { isMounted = false; };
  }, [activeCourseId]);

  // Exam Timer Countdown
  useEffect(() => {
    if (!activeExam || isExamCompleted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam(true); // Auto-submit when time expires
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeExam, isExamCompleted, timeLeft]);

  // Start an Exam
  const handleStartExam = (exam: Exam) => {
    setActiveExam(exam);
    setCurrentQIndex(0);
    setUserAnswers({});
    setFlaggedQs({});
    setTimeLeft(exam.durationMinutes * 60);
    setIsExamCompleted(false);
    setExamResult(null);
  };

  // Submit Exam & Calculate Merit Score
  const handleSubmitExam = async (isAutoSubmit = false) => {
    if (!activeExam) return;

    setShowSubmitConfirm(false);

    const questions = activeExam.questions || [];
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    questions.forEach(q => {
      const selected = userAnswers[q.id];
      if (!selected) {
        unansweredCount++;
      } else if (selected.trim().toLowerCase() === q.answer.trim().toLowerCase()) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    const marksPerQ = activeExam.marksPerQuestion || 1;
    const negRate = activeExam.negativeMarking || 0;
    const positiveMarks = correctCount * marksPerQ;
    const negativeDeduction = wrongCount * negRate;
    const finalScore = Math.max(0, parseFloat((positiveMarks - negativeDeduction).toFixed(2)));
    const totalMarks = questions.length * marksPerQ;
    const totalTimeSec = activeExam.durationMinutes * 60;
    const timeTakenSeconds = Math.max(1, totalTimeSec - timeLeft);

    const resultObj: ExamResult = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      examId: activeExam.id,
      examTitle: activeExam.title,
      userId: userId || `user_${Date.now()}`,
      userEmail: userEmail || 'guest@user.com',
      userDisplayName: userDisplayName || userEmail?.split('@')[0] || 'শিক্ষার্থী',
      score: finalScore,
      totalMarks,
      correctCount,
      wrongCount,
      unansweredCount,
      negativeDeduction: parseFloat(negativeDeduction.toFixed(2)),
      timeTakenSeconds,
      submittedAt: new Date().toISOString(),
      userAnswers
    };

    setExamResult(resultObj);
    setIsExamCompleted(true);

    // Upload Result to Firestore for Merit List
    try {
      await setDoc(doc(db, 'exam_results', resultObj.id), resultObj, { merge: true });
    } catch (e) {
      console.warn('Failed to save exam result to cloud:', e);
    }
  };

  // Load Merit List for an Exam
  const handleViewMeritList = async (exam: Exam) => {
    setMeritListExam(exam);
    setLoadingMerit(true);
    try {
      const snap = await getDocs(collection(db, 'exam_results'));
      const results: ExamResult[] = [];
      snap.forEach(d => {
        const data = d.data() as ExamResult;
        if (data.examId === exam.id) {
          results.push({ id: d.id, ...data });
        }
      });

      // Sort by highest score, then fewest wrong answers, then fastest time
      results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.wrongCount !== b.wrongCount) return a.wrongCount - b.wrongCount;
        return a.timeTakenSeconds - b.timeTakenSeconds;
      });

      setMeritResults(results);
    } catch (e) {
      console.error('Failed to load merit list:', e);
    } finally {
      setLoadingMerit(false);
    }
  };

  const filteredExams = exams.filter(e => {
    if (selectedCourseFilter === 'all') return true;
    return e.courseId === selectedCourseFilter;
  });

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // ==========================================
  // RENDER: ACTIVE EXAM SCREEN
  // ==========================================
  if (activeExam && !isExamCompleted) {
    const questions = activeExam.questions || [];
    const answeredCount = Object.keys(userAnswers).length;

    const scrollToQuestion = (idx: number) => {
      const el = document.getElementById(`exam-q-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    return (
      <div className="w-full max-w-7xl mx-auto px-1 sm:px-3 md:px-6 py-2 md:py-6">
        {/* Sticky Header Bar with Countdown Timer & Jump Buttons */}
        <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 md:p-4 rounded-2xl md:rounded-3xl shadow-xl mb-4 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-indigo-400 text-[11px] md:text-xs font-bold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>অনলাইন পরীক্ষা চলছে</span>
              </div>
              <h2 className="text-base md:text-xl font-black text-white truncate max-w-xs sm:max-w-md">{activeExam.title}</h2>
              <p className="text-slate-400 text-[11px] hidden sm:block">
                মোট প্রশ্ন: {questions.length} টি | উত্তর দেওয়া হয়েছে: <span className="text-emerald-400 font-bold">{answeredCount}</span>/{questions.length}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Timer Badge */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl border font-mono font-bold text-sm md:text-lg shadow-inner ${
                timeLeft < 180 ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse' : 'bg-slate-800 text-amber-300 border-slate-700'
              }`}>
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{formatTime(timeLeft)}</span>
              </div>

              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 md:px-5 md:py-2 rounded-xl md:rounded-2xl font-extrabold text-xs md:text-sm transition shadow-lg flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>জমা দিন</span>
              </button>
            </div>
          </div>

          {/* Quick Jump Question Buttons Horizontal Scroll Bar */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              প্রশ্ন লাফান:
            </span>
            {questions.map((q, idx) => {
              const isAns = !!userAnswers[q.id];
              const isFlag = !!flaggedQs[q.id];

              let pillStyle = 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700';
              if (isFlag) pillStyle = 'bg-amber-500 text-slate-950 font-black border-amber-400';
              else if (isAns) pillStyle = 'bg-emerald-600 text-white font-bold border-emerald-500';

              return (
                <button
                  key={q.id || idx}
                  onClick={() => scrollToQuestion(idx)}
                  className={`min-w-[28px] h-7 px-1.5 rounded-lg border text-[11px] font-mono flex items-center justify-center transition cursor-pointer shrink-0 ${pillStyle}`}
                  title={`প্রশ্ন ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Serial Stacked Questions List */}
        <div className="space-y-3 md:space-y-4">
          {questions.map((q, idx) => {
            const isAnswered = !!userAnswers[q.id];
            const isFlagged = !!flaggedQs[q.id];

            return (
              <div
                key={q.id || idx}
                id={`exam-q-${idx}`}
                className={`bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl md:rounded-3xl border transition-all scroll-mt-24 ${
                  isAnswered
                    ? 'border-emerald-200/90 shadow-2xs bg-white'
                    : isFlagged
                    ? 'border-amber-300 shadow-2xs bg-amber-50/10'
                    : 'border-slate-200/90 shadow-2xs'
                }`}
              >
                {/* Header Row: Question Number, Actions */}
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50/90 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1">
                      <span className="font-mono text-[11px]">#{idx + 1}</span>
                      <span>প্রশ্ন {idx + 1}</span>
                    </span>
                    {isAnswered && (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        উত্তর দেওয়া হয়েছে
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isAnswered && (
                      <button
                        onClick={() => {
                          const next = { ...userAnswers };
                          delete next[q.id];
                          setUserAnswers(next);
                        }}
                        className="text-[11px] text-rose-600 hover:text-rose-700 font-bold px-2 py-0.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      >
                        উত্তর রিসেট
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setFlaggedQs(prev => ({ ...prev, [q.id]: !prev[q.id] }));
                      }}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                        isFlagged
                          ? 'bg-amber-50 text-amber-700 border-amber-300 font-bold'
                          : 'text-slate-400 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>{isFlagged ? 'ফ্ল্যাগড' : 'রিভিউ'}</span>
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <h3 className="text-sm sm:text-base md:text-lg font-extrabold text-slate-850 mb-3 leading-snug">
                  <span className="text-indigo-600 font-mono mr-1.5">{idx + 1}.</span>
                  {q.question}
                </h3>

                {/* Compact Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => {
                    const isSelected = userAnswers[q.id] === opt;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => {
                          setUserAnswers(prev => ({ ...prev, [q.id]: opt }));
                        }}
                        className={`w-full text-left py-2 px-2.5 sm:px-3 rounded-xl border text-xs sm:text-sm transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-bold ring-2 ring-indigo-300'
                            : 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/90 text-slate-700 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span className={`w-5 h-5 rounded-lg text-[11px] font-mono font-black flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white text-indigo-700' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="truncate leading-tight">{opt}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Submit Banner */}
        <div className="mt-6 bg-slate-900 text-white p-4 rounded-2xl md:rounded-3xl shadow-xl flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-300 font-medium">
              সবগুলো প্রশ্নের উত্তর দেওয়া হয়ে থাকলে নিচের বাটনে ক্লিক করে পরীক্ষা সম্পন্ন করুন।
            </p>
            <p className="text-xs font-bold text-emerald-400 mt-0.5">
              মোট উত্তর: {answeredCount} / {questions.length}
            </p>
          </div>
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl md:rounded-2xl font-extrabold text-sm transition shadow-lg flex items-center gap-2 cursor-pointer shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>পরীক্ষা জমা দিন</span>
          </button>
        </div>

        {/* Submit Confirmation Modal */}
        <AnimatePresence>
          {showSubmitConfirm && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-200 shadow-2xl text-center"
              >
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">পরীক্ষা জমা নিশ্চিতকরণ</h3>
                <p className="text-slate-600 text-sm mb-6">
                  আপনি <strong className="text-emerald-600 font-bold">{answeredCount}</strong> টি প্রশ্নের উত্তর দিয়েছেন। বাকি <strong className="text-rose-500 font-bold">{questions.length - answeredCount}</strong> টি প্রশ্ন খালি রয়েছে।
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600 text-sm hover:bg-slate-50 cursor-pointer"
                  >
                    ফিরে যান
                  </button>
                  <button
                    onClick={() => handleSubmitExam(false)}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md cursor-pointer"
                  >
                    জমা দিন
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ==========================================
  // RENDER: EXAM RESULT SCORECARD
  // ==========================================
  if (isExamCompleted && examResult && activeExam) {
    const questions = activeExam.questions || [];
    const percent = Math.min(100, Math.round((examResult.score / examResult.totalMarks) * 100));

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mb-8">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 text-center relative overflow-hidden">
            <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-400/30">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold mb-1">পরীক্ষার ফলাফল</h2>
            <p className="text-indigo-200 text-sm">{activeExam.title}</p>

            <div className="mt-6 inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
              <span className="text-3xl font-black text-amber-300 font-mono">{examResult.score}</span>
              <span className="text-slate-300 font-medium text-sm">/ {examResult.totalMarks} পয়েন্ট ({percent}%)</span>
            </div>
          </div>

          {/* Detailed Statistics Cards */}
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <span className="text-2xl font-bold text-emerald-700">{examResult.correctCount}</span>
                <p className="text-xs text-emerald-600 font-medium">সঠিক উত্তর</p>
              </div>

              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 text-center">
                <XCircle className="w-6 h-6 text-rose-600 mx-auto mb-1" />
                <span className="text-2xl font-bold text-rose-700">{examResult.wrongCount}</span>
                <p className="text-xs text-rose-600 font-medium">ভুল উত্তর (-{examResult.negativeDeduction})</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <HelpCircle className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                <span className="text-2xl font-bold text-slate-700">{examResult.unansweredCount}</span>
                <p className="text-xs text-slate-500 font-medium">উত্তর দেওয়া হয়নি</p>
              </div>

              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-center">
                <Clock className="w-6 h-6 text-indigo-600 mx-auto mb-1" />
                <span className="text-xl font-bold text-indigo-700 font-mono">{formatTime(examResult.timeTakenSeconds)}</span>
                <p className="text-xs text-indigo-600 font-medium">মোট সময় লেগেছে</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-100">
              <button
                onClick={() => {
                  setActiveExam(null);
                  setIsExamCompleted(false);
                }}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                ← পরীক্ষার তালিকায় ফিরুন
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const targetExam = activeExam;
                    if (targetExam) {
                      setIsExamCompleted(false);
                      handleStartExam(targetExam);
                    }
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retake Exam (পুনরায় পরীক্ষা দিন)</span>
                </button>

                <button
                  onClick={() => handleViewMeritList(activeExam)}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Award className="w-4 h-4" />
                  <span>মেরিট লিস্ট দেখুন</span>
                </button>
              </div>
            </div>

            {/* Detailed Question by Question Review */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                <span>প্রশ্নোত্তর ও ব্যাখ্যা বিশ্লেষণ</span>
              </h3>

              <div className="space-y-6">
                {questions.map((q, idx) => {
                  const userAns = examResult.userAnswers?.[q.id];
                  const isCorrect = userAns && userAns.trim().toLowerCase() === q.answer.trim().toLowerCase();
                  const isSkipped = !userAns;

                  return (
                    <div
                      key={q.id}
                      className={`p-6 rounded-2xl border transition ${
                        isCorrect
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : isSkipped
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border text-slate-700 shadow-xs">
                          প্রশ্ন {idx + 1}
                        </span>

                        <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                          isCorrect
                            ? 'bg-emerald-100 text-emerald-800'
                            : isSkipped
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : isSkipped ? <HelpCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          <span>{isCorrect ? 'সঠিক' : isSkipped ? 'এড়িয়ে যাওয়া হয়েছে' : 'ভুল উত্তর'}</span>
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-800 mb-4">{q.question}</h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        {q.options.map((opt, oIdx) => {
                          const isUserSelected = userAns === opt;
                          const isRightOption = opt.trim().toLowerCase() === q.answer.trim().toLowerCase();

                          let optStyle = 'bg-white border-slate-200 text-slate-600';
                          if (isRightOption) optStyle = 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold';
                          else if (isUserSelected && !isRightOption) optStyle = 'bg-rose-100 border-rose-400 text-rose-900 font-bold';

                          return (
                            <div key={oIdx} className={`p-3 rounded-xl border text-xs flex items-center justify-between ${optStyle}`}>
                              <span>{opt}</span>
                              {isRightOption && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                              {isUserSelected && !isRightOption && <XCircle className="w-4 h-4 text-rose-600" />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600">
                          <strong className="text-indigo-600 block mb-1">ব্যাখ্যা:</strong>
                          <p>{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MERIT LIST MODAL / VIEW
  // ==========================================
  if (meritListExam) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wide mb-1">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>অফিসিয়াল মেরিট লিস্ট</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">{meritListExam.title}</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const targetExam = meritListExam;
                  setMeritListExam(null);
                  if (targetExam) {
                    handleStartExam(targetExam);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake Exam (পুনরায় পরীক্ষা দিন)</span>
              </button>

              <button
                onClick={() => setMeritListExam(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                ← পরীক্ষার তালিকায় ফিরুন
              </button>
            </div>
          </div>

          {loadingMerit ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              মেরিট লিস্ট লোড হচ্ছে...
            </div>
          ) : meritResults.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-sm">এখনও কেউ এই পরীক্ষায় অংশগ্রহণ করেনি।</p>
              <p className="text-xs text-slate-400 mt-1">প্রথম অংশ নিয়ে মেধা তালিকার শীর্ষে চলে আসুন!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs">
                    <th className="p-3">র‍্যাংক</th>
                    <th className="p-3">শিক্ষার্থী / ইমেইল</th>
                    <th className="p-3 text-center">স্কোর</th>
                    <th className="p-3 text-center">সঠিক / ভুল</th>
                    <th className="p-3 text-center">সময়</th>
                    <th className="p-3 text-right">তারিখ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {meritResults.map((res, index) => {
                    const isTop1 = index === 0;
                    const isTop2 = index === 1;
                    const isTop3 = index === 2;

                    return (
                      <tr key={res.id} className={isTop1 ? 'bg-amber-50/50 font-medium' : 'hover:bg-slate-50/80'}>
                        <td className="p-3">
                          <div className="flex items-center gap-2 font-bold">
                            {isTop1 && <span className="w-6 h-6 rounded-full bg-amber-400 text-white flex items-center justify-center text-xs shadow-xs">1</span>}
                            {isTop2 && <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs">2</span>}
                            {isTop3 && <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">3</span>}
                            {!isTop1 && !isTop2 && !isTop3 && <span className="text-slate-400 text-xs pl-2">#{index + 1}</span>}
                          </div>
                        </td>

                        <td className="p-3">
                          <div>
                            <span className="font-bold text-slate-800 block">{res.userDisplayName || 'শিক্ষার্থী'}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{res.userEmail}</span>
                          </div>
                        </td>

                        <td className="p-3 text-center font-bold text-indigo-600 font-mono text-base">
                          {res.score} / {res.totalMarks}
                        </td>

                        <td className="p-3 text-center text-xs">
                          <span className="text-emerald-600 font-bold">{res.correctCount}টি</span> / <span className="text-rose-500 font-semibold">{res.wrongCount}টি</span>
                        </td>

                        <td className="p-3 text-center text-xs font-mono text-slate-600">
                          {formatTime(res.timeTakenSeconds)}
                        </td>

                        <td className="p-3 text-right text-[11px] text-slate-400">
                          {new Date(res.submittedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN EXAM CATALOG LIST
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>লাইভ মডেল টেস্ট ও পরীক্ষা হল</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">অনলাইন এক্সাম সেকশন</h1>
          <p className="text-slate-600 text-sm mt-1">
            টাইমার, নেগেটিভ মার্কিং ও তাৎক্ষণিক মেরিট লিস্টের সাথে নিজেকে প্রস্তুত করুন
          </p>
        </div>

        {/* Filter by Course */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500 pl-2">কোর্স নির্বাচন:</span>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">সকল কোর্স</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Exam Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm font-medium">
          পরীক্ষার তালিকা লোড হচ্ছে...
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm">
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">কোন পরীক্ষা পাওয়া যায়নি</h3>
          <p className="text-slate-500 text-xs mt-1">
            এডমিন প্যানেল থেকে নতুন পরীক্ষা আপলোড করা হলে এখানে প্রদর্শিত হবে।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam) => {
            const qCount = exam.questions?.length || 0;
            const marksPerQ = exam.marksPerQuestion || 1;
            const totalMarks = qCount * marksPerQ;

            return (
              <div
                key={exam.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                      {courses.find(c => c.id === exam.courseId)?.title || 'সাধারণ পরীক্ষা'}
                    </span>

                    <span className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{exam.durationMinutes} মিনিট</span>
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition">
                    {exam.title}
                  </h3>

                  {exam.description && (
                    <p className="text-slate-600 text-xs mb-4 line-clamp-2">{exam.description}</p>
                  )}

                  {/* Exam Specs */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600 mb-6">
                    <div>
                      <span className="text-slate-400 block text-[10px]">মোট প্রশ্ন</span>
                      <strong className="text-slate-800 font-bold">{qCount} টি</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">মোট নম্বর</span>
                      <strong className="text-slate-800 font-bold">{totalMarks}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">প্রতি প্রশ্নে নম্বর</span>
                      <strong className="text-slate-800 font-bold">+{marksPerQ}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">নেগেটিভ মার্জিন</span>
                      <strong className="text-rose-600 font-bold">-{exam.negativeMarking || 0}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartExam(exam)}
                    className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <span>পরীক্ষা শুরু করুন</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleViewMeritList(exam)}
                    title="মেরিট লিস্ট দেখুন"
                    className="p-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-amber-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
