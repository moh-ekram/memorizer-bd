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

  // Fetch Exams from Firestore
  useEffect(() => {
    let isMounted = true;
    const fetchExams = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'exams'));
        const loaded: Exam[] = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          loaded.push({ id: docSnap.id, ...d } as Exam);
        });
        if (isMounted) setExams(loaded);
      } catch (err) {
        console.error('Failed to load exams:', err);
      } finally {
        if (isMounted) setLoading(false);
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
    const currentQ = questions[currentQIndex];
    const answeredCount = Object.keys(userAnswers).length;

    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header Bar with Countdown Timer */}
        <div className="bg-slate-900 text-white p-4 md:p-6 rounded-3xl shadow-xl mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Zap className="w-4 h-4" />
              <span>লাইভ পরীক্ষা চলছে</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold">{activeExam.title}</h2>
            <p className="text-slate-400 text-xs mt-1">
              মোট প্রশ্ন: {questions.length} টি | সঠিক উত্তর: +{activeExam.marksPerQuestion || 1} | ভুল উত্তর: -{activeExam.negativeMarking || 0}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Timer Badge */}
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border font-mono font-bold text-lg md:text-xl shadow-inner ${
              timeLeft < 180 ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse' : 'bg-slate-800 text-amber-300 border-slate-700'
            }`}>
              <Clock className="w-5 h-5 text-amber-400" />
              <span>{formatTime(timeLeft)}</span>
            </div>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm transition shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>জমা দিন</span>
            </button>
          </div>
        </div>

        {/* Question Palette & Navigation Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Question Card */}
          <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            {currentQ ? (
              <div>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                    প্রশ্ন {currentQIndex + 1} / {questions.length}
                  </span>

                  <button
                    onClick={() => {
                      setFlaggedQs(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
                    }}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
                      flaggedQs[currentQ.id]
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'text-slate-500 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{flaggedQs[currentQ.id] ? 'রিভিউ চিহ্নিত' : 'রিভিউর জন্য রাখুন'}</span>
                  </button>
                </div>

                <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-6 leading-relaxed">
                  {currentQ.question}
                </h3>

                {/* Options List */}
                <div className="space-y-3 mb-8">
                  {currentQ.options.map((opt, oIdx) => {
                    const isSelected = userAnswers[currentQ.id] === opt;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => {
                          setUserAnswers(prev => ({ ...prev, [currentQ.id]: opt }));
                        }}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm font-semibold'
                            : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="text-sm">{opt}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {userAnswers[currentQ.id] && (
                  <button
                    onClick={() => {
                      const next = { ...userAnswers };
                      delete next[currentQ.id];
                      setUserAnswers(next);
                    }}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold mb-4 inline-block cursor-pointer"
                  >
                    উত্তর বাতিল করুন (Clear Selection)
                  </button>
                )}
              </div>
            ) : null}

            {/* Bottom Question Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>পূর্ববর্তী</span>
              </button>

              <span className="text-xs text-slate-400 font-mono">
                {answeredCount} টি উত্তর দেওয়া হয়েছে
              </span>

              <button
                disabled={currentQIndex === questions.length - 1}
                onClick={() => setCurrentQIndex(prev => Math.min(questions.length - 1, prev + 1))}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <span>পরবর্তী</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Question Grid Palette */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-indigo-600" />
              <span>প্রশ্ন নেভিগেশন</span>
            </h4>

            <div className="grid grid-cols-5 gap-2 max-h-80 overflow-y-auto p-1 scrollbar-thin">
              {questions.map((q, idx) => {
                const isAns = !!userAnswers[q.id];
                const isFlag = !!flaggedQs[q.id];
                const isCurr = idx === currentQIndex;

                let btnStyle = 'bg-slate-100 text-slate-600 border-slate-200';
                if (isCurr) btnStyle = 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-400';
                else if (isFlag) btnStyle = 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
                else if (isAns) btnStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold';

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQIndex(idx)}
                    className={`h-9 rounded-xl border text-xs flex items-center justify-center transition cursor-pointer ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Color Legend */}
            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span>উত্তর দেওয়া হয়েছে ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                <span>উত্তর দেওয়া হয়নি ({questions.length - answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <span>রিভিউর জন্য ফ্ল্যাগড</span>
              </div>
            </div>
          </div>
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
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <button
                onClick={() => {
                  setActiveExam(null);
                  setIsExamCompleted(false);
                }}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 cursor-pointer"
              >
                ← পরীক্ষার তালিকায় ফিরুন
              </button>

              <button
                onClick={() => handleViewMeritList(activeExam)}
                className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>মেরিট লিস্ট দেখুন</span>
              </button>
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

            <button
              onClick={() => setMeritListExam(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
            >
              ← পরীক্ষার তালিকায় ফিরুন
            </button>
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
