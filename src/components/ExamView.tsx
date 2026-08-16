import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  Lock,
  Search,
  Check,
  ShoppingCart,
  Eye,
  Layers,
  X
} from 'lucide-react';
import { db, collection, getDocs, doc, setDoc } from '../lib/db';
import { Exam, ExamQuestion, ExamResult, Course } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage, getLargeStorage, setLargeStorage } from '../lib/storage';
import { isCourseAccessible, isCourseEnrolled } from '../lib/courseAccess';

interface ExamViewProps {
  courses: Course[];
  activeCourseId: string;
  userEmail?: string;
  userDisplayName?: string;
  userId?: string;
  enrolledCourseIds?: string[];
  onSelectTab?: (tab: string) => void;
}

export function ExamView({ 
  courses, 
  activeCourseId, 
  userEmail, 
  userDisplayName, 
  userId,
  enrolledCourseIds = [],
  onSelectTab
}: ExamViewProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>(activeCourseId || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [accessFilterTab, setAccessFilterTab] = useState<'all' | 'accessible' | 'participated' | 'locked'>('all');
  const [lockedExamModal, setLockedExamModal] = useState<{ exam: Exam; course?: Course } | null>(null);

  // Track local enrolled course IDs for offline/cached responsiveness
  const [localEnrolledIds, setLocalEnrolledIds] = useState<string[]>(() => {
    try {
      const saved = safeGetLocalStorage('user_enrolled_courses', '[]');
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  });

  const effectiveEnrolledIds = useMemo(() => {
    return Array.from(new Set([
      ...(enrolledCourseIds || []),
      ...localEnrolledIds
    ]));
  }, [enrolledCourseIds, localEnrolledIds]);

  // Helper to check if an exam is accessible to the current user
  const checkIsExamAccessible = (exam: Exam): boolean => {
    const cleanEmail = userEmail?.trim().toLowerCase() || '';
    // Admin email always has full access
    if (cleanEmail === 'mohammad.001ekram@gmail.com') return true;

    // If unassigned or general exam, accessible to all
    if (!exam.courseId || exam.courseId.trim().toLowerCase() === 'all' || exam.courseId.trim().toLowerCase() === 'general') {
      return true;
    }

    const matchedCourse = courses.find(
      c => c.id.trim().toLowerCase() === exam.courseId?.trim().toLowerCase()
    );

    if (!matchedCourse) {
      return isCourseEnrolled(exam.courseId, effectiveEnrolledIds);
    }

    return isCourseAccessible(matchedCourse, effectiveEnrolledIds, userEmail);
  };

  // Helper to get course of exam
  const getExamCourse = (exam: Exam): Course | undefined => {
    if (!exam.courseId || exam.courseId === 'all' || exam.courseId === 'general') {
      return undefined;
    }
    return courses.find(c => c.id.trim().toLowerCase() === exam.courseId?.trim().toLowerCase());
  };

  // Track user results map (key: examId -> ExamResult)
  const [userResultsMap, setUserResultsMap] = useState<Record<string, ExamResult>>({});

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

  // Fetch User Previous Exam Results
  useEffect(() => {
    let isMounted = true;
    const fetchUserResults = async () => {
      const map: Record<string, ExamResult> = {};

      // 1. Local Storage cache (0ms instant)
      try {
        const localData = safeGetLocalStorage('local_exam_results', '[]');
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed)) {
          parsed.forEach((r: ExamResult) => {
            if (r && r.examId) {
              if (!map[r.examId] || r.score > map[r.examId].score) {
                map[r.examId] = r;
              }
            }
          });
          if (isMounted && Object.keys(map).length > 0) {
            setUserResultsMap({ ...map });
          }
        }
      } catch (_) {}

      // 2. Cloud Firestore results with 3.5s timeout guard
      try {
        const cloudPromise = getDocs(collection(db, 'exam_results'));
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Results timeout')), 3500)
        );

        const snap = (await Promise.race([cloudPromise, timeoutPromise])) as any;
        if (snap && snap.forEach) {
          snap.forEach((docSnap: any) => {
            const data = docSnap.data() as ExamResult;
            const matchEmail = userEmail && data.userEmail && data.userEmail.toLowerCase() === userEmail.toLowerCase();
            const matchUserId = userId && data.userId && data.userId === userId;

            if (matchEmail || matchUserId || (!userEmail && !userId)) {
              if (data && data.examId) {
                if (!map[data.examId] || data.score > map[data.examId].score) {
                  map[data.examId] = { id: docSnap.id, ...data };
                }
              }
            }
          });
        }
      } catch (err) {
        console.warn('Notice loading user exam results in background:', err);
      }

      if (isMounted) {
        setUserResultsMap({ ...map });
      }
    };

    fetchUserResults();
    return () => { isMounted = false; };
  }, [userEmail, userId]);

  // Fetch Exams from Firestore & Local Cache
  useEffect(() => {
    let isMounted = true;
    const fetchExams = async () => {
      const examMap = new Map<string, Exam>();

      // 1. Instant local render (0ms)
      let hasLocal = false;
      try {
        const localData = await getLargeStorage<Exam[]>('local_exams', []);
        if (Array.isArray(localData) && localData.length > 0) {
          localData.forEach((e: Exam) => { if (e && e.id) examMap.set(e.id, e); });
          if (isMounted) {
            setExams(Array.from(examMap.values()));
            setLoading(false);
            hasLocal = true;
          }
        }
      } catch (_) {}

      if (!hasLocal && isMounted) {
        setLoading(true);
      }

      // 2. Cloud Firestore with 3.5s timeout guard
      try {
        const cloudPromise = getDocs(collection(db, 'exams'));
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Exams timeout')), 3500)
        );

        const snap = (await Promise.race([cloudPromise, timeoutPromise])) as any;
        if (snap && snap.forEach) {
          snap.forEach((docSnap: any) => {
            const d = docSnap.data();
            if (docSnap.id) examMap.set(docSnap.id, { id: docSnap.id, ...d } as Exam);
          });
        }
      } catch (err) {
        console.warn('Notice loading cloud exams in background:', err);
      } finally {
        const combined = Array.from(examMap.values());
        if (isMounted) {
          setExams(combined);
          setLoading(false);
        }
        setLargeStorage('local_exams', combined);
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

  // Start an Exam (with strict access control check)
  const handleStartExam = (exam: Exam) => {
    // 1. Strict access check
    if (!checkIsExamAccessible(exam)) {
      const course = getExamCourse(exam);
      setLockedExamModal({ exam, course });
      return;
    }

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
      userDisplayName: userDisplayName || userEmail?.split('@')[0] || 'Student',
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

    // Save result to local storage cache
    try {
      const existingResStr = safeGetLocalStorage('local_exam_results', '[]');
      let localRes: ExamResult[] = [];
      try {
        localRes = JSON.parse(existingResStr);
        if (!Array.isArray(localRes)) localRes = [];
      } catch (_) { localRes = []; }

      const updatedLocalRes = [resultObj, ...localRes.filter(r => r.id !== resultObj.id)];
      safeSetLocalStorage('local_exam_results', JSON.stringify(updatedLocalRes));
    } catch (lErr) {
      console.warn('Notice saving local exam result:', lErr);
    }

    // Update state userResultsMap
    setUserResultsMap(prev => ({
      ...prev,
      [activeExam.id]: resultObj
    }));

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
    const resultMap = new Map<string, ExamResult>();

    // 1. Instant local render (0ms)
    let hasLocal = false;
    try {
      const localData = safeGetLocalStorage('local_exam_results', '[]');
      const parsed = JSON.parse(localData);
      if (Array.isArray(parsed)) {
        parsed.forEach((r: ExamResult) => {
          if (r && r.examId === exam.id && r.id) {
            resultMap.set(r.id, r);
          }
        });
        if (resultMap.size > 0) {
          const initialResults = Array.from(resultMap.values());
          initialResults.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.wrongCount !== b.wrongCount) return a.wrongCount - b.wrongCount;
            return a.timeTakenSeconds - b.timeTakenSeconds;
          });
          setMeritResults(initialResults);
          setLoadingMerit(false);
          hasLocal = true;
        }
      }
    } catch (_) {}

    if (!hasLocal) {
      setLoadingMerit(true);
    }

    // 2. Background Firestore fetch with 3.5s timeout guard
    try {
      const cloudPromise = getDocs(collection(db, 'exam_results'));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Merit timeout')), 3500)
      );

      const snap = (await Promise.race([cloudPromise, timeoutPromise])) as any;
      if (snap && snap.forEach) {
        snap.forEach((d: any) => {
          const data = d.data() as ExamResult;
          if (data.examId === exam.id && d.id) {
            resultMap.set(d.id, { id: d.id, ...data });
          }
        });
      }
    } catch (e) {
      console.warn('Notice loading merit list from cloud:', e);
    }

    const results = Array.from(resultMap.values());
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.wrongCount !== b.wrongCount) return a.wrongCount - b.wrongCount;
      return a.timeTakenSeconds - b.timeTakenSeconds;
    });

    setMeritResults(results);
    setLoadingMerit(false);
  };

  const searchFilteredExams = useMemo(() => {
    return exams.filter(e => {
      // 1. Course Filter
      if (selectedCourseFilter !== 'all' && e.courseId !== selectedCourseFilter) {
        return false;
      }
      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const courseTitle = courses.find(c => c.id === e.courseId)?.title?.toLowerCase() || '';
        const titleMatch = e.title.toLowerCase().includes(q);
        const descMatch = (e.description || '').toLowerCase().includes(q);
        const courseMatch = courseTitle.includes(q);
        if (!titleMatch && !descMatch && !courseMatch) return false;
      }
      return true;
    });
  }, [exams, selectedCourseFilter, searchQuery, courses]);

  // Compute sub-categorized list for tabs
  const { allList, accessibleList, participatedList, lockedList } = useMemo(() => {
    const accessible: Exam[] = [];
    const participated: Exam[] = [];
    const locked: Exam[] = [];

    searchFilteredExams.forEach(e => {
      const isAllowed = checkIsExamAccessible(e);
      const isPart = !!userResultsMap[e.id];

      if (isPart) {
        participated.push(e);
      }
      if (isAllowed) {
        accessible.push(e);
      } else {
        locked.push(e);
      }
    });

    return {
      allList: searchFilteredExams,
      accessibleList: accessible,
      participatedList: participated,
      lockedList: locked
    };
  }, [searchFilteredExams, effectiveEnrolledIds, userEmail, userResultsMap]);

  const displayedExams = useMemo(() => {
    switch (accessFilterTab) {
      case 'accessible':
        return accessibleList;
      case 'participated':
        return participatedList;
      case 'locked':
        return lockedList;
      case 'all':
      default:
        return allList;
    }
  }, [accessFilterTab, accessibleList, participatedList, lockedList, allList]);

  // Helper to check if an option is the correct answer
  const checkIsRightOption = (opt: string, optIndex: number, questionAnswer: string, allOptions: string[] = []): boolean => {
    if (!questionAnswer || !opt) return false;
    const cleanAns = questionAnswer.trim().toLowerCase();
    const cleanOpt = opt.trim().toLowerCase();

    // 1. Direct equality
    if (cleanOpt === cleanAns) return true;

    // 2. Single letter matching (a, b, c, d)
    const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
    if (cleanAns.length === 1 && letters[optIndex] === cleanAns) return true;

    // 3. Index matching (0, 1, 2, 3 or 1, 2, 3, 4)
    if (cleanAns === String(optIndex) || cleanAns === String(optIndex + 1)) return true;

    // 4. Prefix removal matching e.g. "A. Antedate" vs "Antedate"
    const stripPrefix = (str: string) => str.replace(/^[a-f0-9][\.\)\:\-]\s*/i, '').trim().toLowerCase();
    if (stripPrefix(cleanOpt) === stripPrefix(cleanAns)) return true;

    return false;
  };

  // Helper to check if an option was selected by the user
  const checkIsUserSelected = (opt: string, optIndex: number, userAns?: string): boolean => {
    if (!userAns || !opt) return false;
    const cleanUser = userAns.trim().toLowerCase();
    const cleanOpt = opt.trim().toLowerCase();

    if (cleanOpt === cleanUser) return true;
    const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
    if (cleanUser.length === 1 && letters[optIndex] === cleanUser) return true;
    if (cleanUser === String(optIndex) || cleanUser === String(optIndex + 1)) return true;

    const stripPrefix = (str: string) => str.replace(/^[a-f0-9][\.\)\:\-]\s*/i, '').trim().toLowerCase();
    if (stripPrefix(cleanOpt) === stripPrefix(cleanUser)) return true;

    return false;
  };

  // Format time in MM:SS
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
                <span>Online Exam in Progress</span>
              </div>
              <h2 className="text-base md:text-xl font-black text-white truncate max-w-xs sm:max-w-md">{activeExam.title}</h2>
              <p className="text-slate-400 text-[11px] hidden sm:block">
                Total Questions: {questions.length} | Answered: <span className="text-emerald-400 font-bold">{answeredCount}</span>/{questions.length}
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
                <span>Submit</span>
              </button>
            </div>
          </div>

          {/* Quick Jump Question Buttons Horizontal Scroll Bar */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Jump to:
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
                  title={`Question ${idx + 1}`}
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
                      <span>Question {idx + 1}</span>
                    </span>
                    {isAnswered && (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Answered
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
                        Reset Answer
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
                      <span>{isFlagged ? 'Flagged' : 'Review'}</span>
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
              Once you have answered all questions, click the button below to submit your exam.
            </p>
            <p className="text-xs font-bold text-emerald-400 mt-0.5">
              Total Answered: {answeredCount} / {questions.length}
            </p>
          </div>
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl md:rounded-2xl font-extrabold text-sm transition shadow-lg flex items-center gap-2 cursor-pointer shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit Exam</span>
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
                <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Exam Submission</h3>
                <p className="text-slate-600 text-sm mb-6">
                  You have answered <strong className="text-emerald-600 font-bold">{answeredCount}</strong> questions. <strong className="text-rose-500 font-bold">{questions.length - answeredCount}</strong> questions remain unanswered.
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600 text-sm hover:bg-slate-50 cursor-pointer"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={() => handleSubmitExam(false)}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md cursor-pointer"
                  >
                    Submit
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
      <div className="w-full max-w-full px-1 sm:px-3 py-2 sm:py-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md p-2.5 sm:p-4 mb-4">
          {/* Top Compact Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 sm:p-4 rounded-xl flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs sm:text-sm font-extrabold text-white leading-tight">Exam Results</h2>
                  <span className="text-[10px] bg-amber-400/20 text-amber-300 font-extrabold px-1.5 py-0.2 rounded border border-amber-400/30">Completed</span>
                </div>
                <p className="text-[11px] text-indigo-200 truncate max-w-[200px] sm:max-w-md font-medium">{activeExam.title}</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-3 py-1.5 rounded-xl text-xs font-black text-amber-300 font-mono flex items-center gap-1.5 shrink-0">
              <span>Score:</span>
              <span className="text-amber-200 text-sm">{examResult.score}</span>
              <span className="text-slate-300 font-medium text-[11px]">/ {examResult.totalMarks} Marks ({percent}%)</span>
            </div>
          </div>

          {/* Compact 4-Stat Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 mb-2.5">
            <div className="bg-emerald-50/90 border border-emerald-200/80 p-2 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-extrabold text-emerald-900">Correct</span>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-mono">{examResult.correctCount}</span>
            </div>

            <div className="bg-rose-50/90 border border-rose-200/80 p-2 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="text-xs font-extrabold text-rose-900">Wrong (-{examResult.negativeDeduction})</span>
              </div>
              <span className="text-xs font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md font-mono">{examResult.wrongCount}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 p-2 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-xs font-extrabold text-slate-800">Skipped</span>
              </div>
              <span className="text-xs font-black text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md font-mono">{examResult.unansweredCount}</span>
            </div>

            <div className="bg-indigo-50/90 border border-indigo-200/80 p-2 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-extrabold text-indigo-900">Time</span>
              </div>
              <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md font-mono">{formatTime(examResult.timeTakenSeconds)}</span>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setActiveExam(null);
                setIsExamCompleted(false);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              ← Back to Exams List
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
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Exam</span>
              </button>

              <button
                onClick={() => handleViewMeritList(activeExam)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <Award className="w-3.5 h-3.5" />
                <span>View Merit List</span>
              </button>
            </div>
          </div>

          {/* Detailed Question Review & Explanations Section */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <span>Question Review & Explanations (উত্তর ও ব্যাখ্যা)</span>
            </h3>

            <div className="space-y-3">
              {questions.map((q, idx) => {
                const userAns = examResult.userAnswers?.[q.id];
                const isSkipped = !userAns;

                // Check if user answered correctly
                let isUserCorrect = false;
                if (!isSkipped) {
                  q.options.forEach((opt, oIdx) => {
                    const isRight = checkIsRightOption(opt, oIdx, q.answer, q.options);
                    const isUserSel = checkIsUserSelected(opt, oIdx, userAns);
                    if (isRight && isUserSel) {
                      isUserCorrect = true;
                    }
                  });
                }

                return (
                  <div
                    key={q.id || idx}
                    className={`p-3 sm:p-4 rounded-xl border transition ${
                      isUserCorrect
                        ? 'bg-emerald-50/30 border-emerald-200/90'
                        : isSkipped
                        ? 'bg-slate-50/60 border-slate-200/90'
                        : 'bg-rose-50/30 border-rose-200/90'
                    }`}
                  >
                    {/* Question Header */}
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                        Q.{idx + 1}
                      </span>

                      <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        isUserCorrect
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : isSkipped
                          ? 'bg-slate-200 text-slate-700 border border-slate-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {isUserCorrect ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : isSkipped ? <HelpCircle className="w-3.5 h-3.5 text-slate-500" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                        <span>{isUserCorrect ? 'Correct (সঠিক)' : isSkipped ? 'Skipped (উত্তর দেওয়া হয়নি)' : 'Incorrect (ভুল)'}</span>
                      </span>
                    </div>

                    {/* Question Text */}
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-3 leading-relaxed">
                      {q.question}
                    </h4>

                    {/* Options Grid with Dual Highlight */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      {q.options.map((opt, oIdx) => {
                        const isRightOption = checkIsRightOption(opt, oIdx, q.answer, q.options);
                        const isUserSelected = checkIsUserSelected(opt, oIdx, userAns);

                        let optCardStyle = 'bg-slate-50/80 border-slate-200 text-slate-700 font-medium';
                        let badgeContent = null;

                        if (isRightOption && isUserSelected) {
                          // User picked correct answer
                          optCardStyle = 'bg-emerald-100/90 border-2 border-emerald-500 text-emerald-950 font-black shadow-2xs';
                          badgeContent = (
                            <span className="text-[10px] bg-emerald-700 text-white font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                              <span>আপনার উত্তর (সঠিক)</span>
                            </span>
                          );
                        } else if (isRightOption) {
                          // Correct option (which user missed or skipped)
                          optCardStyle = 'bg-emerald-50 border-2 border-emerald-400 text-emerald-900 font-bold';
                          badgeContent = (
                            <span className="text-[10px] bg-emerald-700 text-white font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                              <span>সঠিক উত্তর (Correct)</span>
                            </span>
                          );
                        } else if (isUserSelected) {
                          // User's incorrect choice
                          optCardStyle = 'bg-rose-100/90 border-2 border-rose-500 text-rose-950 font-black shadow-2xs';
                          badgeContent = (
                            <span className="text-[10px] bg-rose-600 text-white font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                              <XCircle className="w-3 h-3 text-rose-200" />
                              <span>আপনার উত্তর (ভুল)</span>
                            </span>
                          );
                        }

                        return (
                          <div
                            key={oIdx}
                            className={`p-2.5 sm:p-3 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${optCardStyle}`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-1">
                              <span className="w-5 h-5 rounded-md text-[10px] font-mono font-bold flex items-center justify-center shrink-0 bg-white/80 border border-slate-300/80 text-slate-700">
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="truncate leading-snug">{opt}</span>
                            </div>
                            {badgeContent}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation Box */}
                    {q.explanation && (
                      <div className="p-2.5 sm:p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-slate-800 leading-relaxed">
                        <strong className="text-indigo-900 font-extrabold block mb-1">💡 সমাধান ও ব্যাখ্যা (Explanation):</strong>
                        <p className="text-slate-700 font-medium">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
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
                <span>Official Merit List</span>
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
                <span>Retake Exam</span>
              </button>

              <button
                onClick={() => setMeritListExam(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                ← Back to Exams List
              </button>
            </div>
          </div>

          {loadingMerit ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Loading merit list...
            </div>
          ) : meritResults.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-sm">No students have taken this exam yet.</p>
              <p className="text-xs text-slate-400 mt-1">Be the first to take this exam and top the merit list!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs">
                    <th className="p-3">Rank</th>
                    <th className="p-3">Student / Email</th>
                    <th className="p-3 text-center">Score</th>
                    <th className="p-3 text-center">Correct / Wrong</th>
                    <th className="p-3 text-center">Time</th>
                    <th className="p-3 text-right">Date</th>
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
                            <span className="font-bold text-slate-800 block">{res.userDisplayName || 'Student'}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{res.userEmail}</span>
                          </div>
                        </td>

                        <td className="p-3 text-center font-bold text-indigo-600 font-mono text-base">
                          {res.score} / {res.totalMarks}
                        </td>

                        <td className="p-3 text-center text-xs">
                          <span className="text-emerald-600 font-bold">{res.correctCount}</span> / <span className="text-rose-500 font-semibold">{res.wrongCount}</span>
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
  const renderExamCard = (exam: Exam) => {
    const qCount = exam.questions?.length || 0;
    const marksPerQ = exam.marksPerQuestion || 1;
    const totalMarks = qCount * marksPerQ;
    const userResult = userResultsMap[exam.id];
    const isParticipated = !!userResult;
    const isAccessible = checkIsExamAccessible(exam);
    const examCourse = getExamCourse(exam);
    const courseTitle = examCourse?.title || 'General Exam';

    return (
      <motion.div
        key={exam.id}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => {
          if (!isAccessible) {
            setLockedExamModal({ exam, course: examCourse });
          } else {
            handleStartExam(exam);
          }
        }}
        className={`group relative transition-all duration-200 flex flex-row items-center justify-between p-2 sm:p-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl gap-2.5 sm:gap-3.5 overflow-hidden cursor-pointer ${
          isParticipated
            ? 'bg-white hover:bg-emerald-50/30 border border-emerald-200/90 shadow-2xs hover:shadow-xs'
            : isAccessible
            ? 'bg-white hover:bg-indigo-50/20 border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-indigo-300'
            : 'bg-white hover:bg-amber-50/30 border border-amber-200/80 shadow-2xs hover:shadow-xs hover:border-amber-300'
        }`}
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {/* Left Side: Minimal Icon & Badge Box */}
        <div className={`w-10 sm:w-12 h-10 sm:h-12 rounded-xl flex flex-col items-center justify-center shrink-0 text-center font-poppins px-0.5 ${
          isParticipated
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
            : isAccessible
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/80'
            : 'bg-amber-50 text-amber-700 border border-amber-200/70'
        }`}>
          {isParticipated ? (
            <div className="flex flex-col items-center leading-none">
              <span className="text-xs sm:text-sm font-black tracking-tight leading-none text-emerald-800">
                {userResult.score}
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold uppercase opacity-75 leading-none mt-0.5 text-emerald-700">
                /{userResult.totalMarks}
              </span>
            </div>
          ) : isAccessible ? (
            <div className="flex flex-col items-center leading-none">
              <span className="text-xs sm:text-sm font-black tracking-tight leading-none text-indigo-800">
                {exam.durationMinutes}
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold uppercase opacity-75 leading-none mt-0.5 text-indigo-600">
                MIN
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center leading-none text-amber-700">
              <Lock className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="text-[7.5px] font-extrabold uppercase leading-none mt-0.5">
                LOCK
              </span>
            </div>
          )}
        </div>

        {/* Middle Side: Prominent Title & Iconized Extra Info */}
        <div className="flex-1 min-w-0 space-y-1 font-poppins">
          {/* Main Title */}
          <h3 
            className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug group-hover:text-indigo-600 transition truncate max-w-[190px] sm:max-w-md"
            title={exam.title}
          >
            {exam.title}
          </h3>

          {/* Minimal Iconized Meta Info Row */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-slate-500 font-medium">
            {/* Course Tag */}
            <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 truncate max-w-[110px] sm:max-w-[160px]">
              <BookOpen className="w-2.5 h-2.5 text-slate-400 shrink-0" />
              <span className="truncate">{courseTitle}</span>
            </span>

            {/* Question Count */}
            <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] text-slate-600" title="Total Questions">
              <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{qCount}Q</span>
            </span>

            {/* Marks */}
            <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] text-slate-600" title="Total Marks">
              <Award className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{totalMarks}m</span>
            </span>

            {/* Negative Marking */}
            {exam.negativeMarking ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] text-rose-600 font-semibold" title={`Negative margin: -${exam.negativeMarking}`}>
                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                <span>-{exam.negativeMarking}</span>
              </span>
            ) : null}

            {/* Status / Score Tag */}
            {isParticipated ? (
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/70">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                <span>{Math.round((userResult.score / userResult.totalMarks) * 100)}%</span>
              </span>
            ) : !isAccessible ? (
              <span className="inline-flex items-center gap-0.5 text-[8.5px] sm:text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                <Lock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                <span>লকড</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Right Side: Divider & Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-center">
          <div className="h-6 sm:h-8 w-[1px] bg-slate-200 shrink-0" />

          {isAccessible ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartExam(exam);
                }}
                className={`font-bold text-[11px] sm:text-xs px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-xl transition cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1 text-white ${
                  isParticipated
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                <span>{isParticipated ? 'Retake' : 'Start'}</span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              </button>

              {isParticipated && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveExam(exam);
                    setExamResult(userResult);
                    setIsExamCompleted(true);
                  }}
                  title="View Marksheet & Answers"
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 p-1.5 sm:p-2 rounded-xl transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewMeritList(exam);
                }}
                title="View Merit List / Leaderboard"
                className="bg-slate-50 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 text-slate-600 border border-slate-200 p-1.5 sm:p-2 rounded-xl transition cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLockedExamModal({ exam, course: examCourse });
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] sm:text-xs px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-xl transition cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1"
            >
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>Unlock</span>
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6 font-poppins">
      {/* Top Title & Search Bar */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-0.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Live Model Tests & Exam Hall</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              Online Exam Section
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              স্মার্ট টাইমার, নেগেটিভ মার্কিং এবং ইনস্ট্যান্ট মেরিট লিস্ট
            </p>
          </div>

          {/* Filter by Course Dropdown */}
          <div className="bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-slate-500 pl-1.5 shrink-0">Course:</span>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Courses ({exams.length})</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar & Category Filter Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exam by title or course..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          {/* Access Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
            <button
              onClick={() => setAccessFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                accessFilterTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({allList.length})
            </button>

            <button
              onClick={() => setAccessFilterTab('accessible')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                accessFilterTab === 'accessible'
                  ? 'bg-[#704261] text-white shadow-xs'
                  : 'bg-purple-50 text-[#704261] hover:bg-purple-100 border border-purple-200'
              }`}
            >
              Available ({accessibleList.length})
            </button>

            <button
              onClick={() => setAccessFilterTab('participated')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                accessFilterTab === 'participated'
                  ? 'bg-[#3C7B58] text-white shadow-xs'
                  : 'bg-emerald-50 text-[#3C7B58] hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Done ({participatedList.length})
            </button>

            <button
              onClick={() => setAccessFilterTab('locked')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                accessFilterTab === 'locked'
                  ? 'bg-[#EF5426] text-white shadow-xs'
                  : 'bg-orange-50 text-[#EF5426] hover:bg-orange-100 border border-orange-200'
              }`}
            >
              Locked ({lockedList.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main List Section: Mobile-First High Density Stack */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm font-medium">
          Loading exam list...
        </div>
      ) : displayedExams.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-md mx-auto shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800">No Exams Found</h3>
            <p className="text-slate-500 text-xs mt-1">
              Try adjusting your search keywords, course filter, or access category.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {displayedExams.map((exam) => renderExamCard(exam))}
        </div>
      )}

      {/* Locked Exam Access Required Modal */}
      <AnimatePresence>
        {lockedExamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 overflow-hidden relative font-poppins"
            >
              {/* Close Button */}
              <button
                onClick={() => setLockedExamModal(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Icon & Warning Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-[#EF5426] shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    Course Access Required
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5 leading-tight">
                    কোর্স আনলক প্রয়োজন
                  </h3>
                </div>
              </div>

              {/* Exam & Course Details Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 mb-4 space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selected Exam:</span>
                  <span className="text-xs font-black text-slate-800 block">{lockedExamModal.exam.title}</span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Course:</span>
                    <span className="text-xs font-black text-indigo-900 block">
                      {lockedExamModal.course?.title || 'Restricted Course'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Price:</span>
                    <span className="text-sm font-black text-[#EF5426]">
                      {lockedExamModal.course?.price !== undefined ? `${lockedExamModal.course.price} TK` : '30 TK'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                এই পরীক্ষাটিতে অংশগ্রহণ করতে আপনাকে প্রথমে <strong>{lockedExamModal.course?.title || 'এই কোর্সটি'}</strong> আনলক বা এনরোল করতে হবে। কোর্সটিতে এনরোল করলে আপনি সকল ফ্ল্যাশকার্ড, শব্দভাণ্ডার এবং মডেল টেস্টে সম্পূর্ণ এক্সেস পাবেন।
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setLockedExamModal(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-extrabold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  ফিরে যান
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLockedExamModal(null);
                    if (onSelectTab) {
                      onSelectTab('my_courses');
                    }
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-[#EF5426] to-[#ce3508] text-white font-extrabold text-xs shadow-md hover:brightness-105 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>কোর্স কিনুন / আনলক</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
