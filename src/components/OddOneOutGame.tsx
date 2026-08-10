import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Trophy,
  Activity,
  Check,
  X,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { db, collection, getDocs, matchesCourseId, clearQuestionsCache } from '../lib/db';
import { OddOneOutQuestion, VocabularyWord } from '../types';

interface OddOneOutGameProps {
  progress: Record<string, { correct: boolean; updatedAt: string }>;
  onUpdateProgress: (questionId: string, correct: boolean) => void;
  activeCourseId: string;
  words?: VocabularyWord[];
  onBack: () => void;
}

export default function OddOneOutGame({
  progress,
  onUpdateProgress,
  activeCourseId,
  words,
  onBack
}: OddOneOutGameProps) {
  const [allQuestions, setAllQuestions] = useState<OddOneOutQuestion[]>([]);
  const [questions, setQuestions] = useState<OddOneOutQuestion[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'yet_to_try' | 'incorrect' | 'done'>('yet_to_try');
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, { selectedOption: string; isCorrect: boolean }>>({});

  // Compute counts for filtering tabs
  const counts = React.useMemo(() => {
    let yetToTry = 0;
    let incorrect = 0;
    let done = 0;
    allQuestions.forEach(q => {
      const prog = progress[q.id];
      if (!prog) {
        yetToTry++;
      } else if (!prog.correct) {
        incorrect++;
      } else {
        done++;
      }
    });
    return { all: allQuestions.length, yet_to_try: yetToTry, incorrect, done };
  }, [allQuestions, progress]);

  // Fetch from Firestore/Supabase DB or auto-generate on course/words change
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const qSnap = await getDocs(collection(db, 'odd_one_out_questions'));
        const loaded: OddOneOutQuestion[] = [];
        qSnap.forEach(docSnap => {
          const data = docSnap.data();
          const qObj = { id: docSnap.id, ...data } as OddOneOutQuestion;
          if (matchesCourseId(data.courseId, activeCourseId)) {
            loaded.push(qObj);
          }
        });

        if (loaded.length > 0) {
          setAllQuestions(loaded);
        } else {
          clearQuestionsCache('odd_one_out_questions', activeCourseId);
          setAllQuestions([]);
        }
      } catch (err) {
        console.error('Error loading OOO questions:', err);
        clearQuestionsCache('odd_one_out_questions', activeCourseId);
        setAllQuestions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [activeCourseId]);

  const applyFilter = (filterType: 'all' | 'yet_to_try' | 'incorrect' | 'done', pool = allQuestions) => {
    setActiveFilter(filterType);
    const filtered = pool.filter(q => {
      const prog = progress[q.id];
      if (filterType === 'all') {
        return true;
      } else if (filterType === 'yet_to_try') {
        return !prog;
      } else if (filterType === 'incorrect') {
        return prog && !prog.correct;
      } else {
        return prog && prog.correct;
      }
    });
    setQuestions(filtered);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setUserAnswers({});
    setScore(0);
    setSessionCompleted(false);
  };

  useEffect(() => {
    if (allQuestions.length === 0) {
      setQuestions([]);
      return;
    }

    let yetToTryCount = 0;
    let incorrectCount = 0;

    allQuestions.forEach(q => {
      const prog = progress[q.id];
      if (!prog) {
        yetToTryCount++;
      } else if (!prog.correct) {
        incorrectCount++;
      }
    });

    let targetFilter: 'yet_to_try' | 'incorrect' | 'done' = 'yet_to_try';
    if (yetToTryCount > 0) {
      targetFilter = 'yet_to_try';
    } else if (incorrectCount > 0) {
      targetFilter = 'incorrect';
    } else {
      targetFilter = 'done';
    }

    applyFilter(targetFilter, allQuestions);
  }, [allQuestions]);

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200/60 shadow-xs flex flex-col items-center justify-center space-y-4 min-h-[350px]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500 font-mono">Loading game...</p>
      </div>
    );
  }

  if (allQuestions.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200/60 shadow-xs text-center space-y-4">
        <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
        <div>
          <p className="text-sm font-bold text-slate-700">No questions found</p>
          <p className="text-xs text-slate-400 mt-1">No Odd One Out questions are loaded yet.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalCorrectInHistory = Object.values(progress).filter(p => p.correct).length;
  const totalQuestionsInDatabase = allQuestions.length;

  const handleSelectOptionForQuestion = (q: OddOneOutQuestion, option: string) => {
    if (userAnswers[q.id]) return;

    const isCorrect = option === q.answer;
    setUserAnswers(prev => ({
      ...prev,
      [q.id]: { selectedOption: option, isCorrect }
    }));

    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    onUpdateProgress(q.id, isCorrect);
  };

  const handleSelectOption = (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
    setIsAnswered(true);

    const isCorrect = option === currentQuestion.answer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    onUpdateProgress(currentQuestion.id, isCorrect);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setSessionCompleted(true);
    }
  };

  const handleRestart = () => {
    applyFilter(activeFilter);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4" id="ooo-game-container">
      {/* Unified Compact Header */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-850 transition cursor-pointer flex items-center justify-center"
            title="Back to Hub"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-4 w-[1px] bg-slate-200" />
          <div>
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <span>Odd One Out</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-sky-55 text-sky-600 rounded-md font-mono font-bold">
                {questions.length > 0 ? `${currentIndex + 1} / ${questions.length}` : '0 / 0'}
              </span>
            </h4>
          </div>
        </div>

        {/* Slim Segmented Filter Row */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/55 flex-wrap">
          <button
            onClick={() => applyFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>All ({counts.all})</span>
          </button>

          <button
            onClick={() => applyFilter('yet_to_try')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'yet_to_try'
                ? 'bg-white text-indigo-600 shadow-xs border border-indigo-100/30'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <HelpCircle className="w-3 h-3" />
            <span>Unattempted ({counts.yet_to_try})</span>
          </button>

          <button
            onClick={() => applyFilter('incorrect')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'incorrect'
                ? 'bg-white text-rose-600 shadow-xs border border-rose-100/30'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>Incorrect ({counts.incorrect})</span>
          </button>

          <button
            onClick={() => applyFilter('done')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'done'
                ? 'bg-white text-emerald-600 shadow-xs border border-emerald-100/30'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            <span>Correct ({counts.done})</span>
          </button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/60 shadow-xs text-center space-y-4">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <h4 className="text-sm font-extrabold text-slate-700">No questions found in this category</h4>
            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              {activeFilter === 'yet_to_try' && "You have tried all the Odd One Out questions! Great job!"}
              {activeFilter === 'incorrect' && "Excellent accuracy! You have no incorrect Odd One Out questions!"}
              {activeFilter === 'done' && "Answer questions correctly to see them here!"}
            </p>
          </div>
        </div>
      ) : sessionCompleted ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/60 shadow-md text-center space-y-8 max-w-lg mx-auto"
        >
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-sm">
            <Trophy className="w-10 h-10 text-indigo-500" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Game Completed!</h3>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider font-mono">Session Summary</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <span className="text-2xl font-black text-slate-800">{score} / {questions.length}</span>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Correct Choices</p>
            </div>
            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <span className="text-2xl font-black text-indigo-600">{Math.round((score / questions.length) * 100)}%</span>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Accuracy Level</p>
            </div>
          </div>

          <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 flex items-center gap-3 justify-center text-left">
            <Activity className="w-5 h-5 text-indigo-500" />
            <div>
              <p className="text-xs font-black text-slate-800">Total Progress</p>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                You have solved {totalCorrectInHistory} of {totalQuestionsInDatabase} total questions.
              </p>
            </div>
          </div>

          <button
            onClick={handleRestart}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm rounded-xl transition cursor-pointer shadow-sm shadow-indigo-500/10 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Restart Session</span>
          </button>
        </motion.div>
      ) : (
        /* Vertical List of Odd One Out Questions */
        <div className="space-y-6">
          {/* Header Stats Bar */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 font-sans sticky top-2 z-10">
            <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
              <span className="bg-white px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-2xs">
                Answered: <strong className="text-indigo-600">{Object.keys(userAnswers).length}</strong> / {questions.length}
              </span>
              <span className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200/60 font-black">
                Score: {score}
              </span>
            </div>
            <button
              onClick={() => setSessionCompleted(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1"
            >
              <span>Finish Session</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-6">
            {questions.map((q, qIdx) => {
              const qAns = userAnswers[q.id];
              const isAnswered = !!qAns;
              const wordsList = (Array.from(new Set((q.words || []).map(w => w.trim()))) as string[]).filter(Boolean);

              return (
                <div key={q.id || qIdx} className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/70 shadow-2xs space-y-4 font-sans text-left relative">
                  {/* Question Title & Number */}
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 bg-indigo-50 text-indigo-700 text-xs font-black rounded-lg flex items-center justify-center border border-indigo-100/80 mt-0.5 font-mono">
                      {qIdx + 1}
                    </span>
                    <div>
                      {q.question ? (
                        <h3 className="text-sm font-bold text-slate-800 leading-snug pt-0.5">
                          {q.question}
                        </h3>
                      ) : null}
                    </div>
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pl-0 sm:pl-10">
                    {wordsList.map((option, optIdx) => {
                      const isSelected = qAns?.selectedOption === option;
                      const isCorrect = option === q.answer;

                      let btnStyle = 'border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/20 text-slate-700 bg-slate-50/50';
                      if (isAnswered) {
                        if (isCorrect) {
                          btnStyle = 'border-emerald-500 bg-emerald-100 text-emerald-950 font-black';
                        } else if (isSelected) {
                          btnStyle = 'border-rose-400 bg-rose-50 text-rose-800 font-bold';
                        } else {
                          btnStyle = 'border-slate-100 bg-slate-50/30 text-slate-400 opacity-60';
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isAnswered}
                          onClick={() => handleSelectOptionForQuestion(q, option)}
                          className={`p-3 text-center rounded-xl border text-xs sm:text-sm font-bold transition flex flex-col items-center justify-center cursor-pointer min-h-[52px] ${btnStyle}`}
                        >
                          <span>{option}</span>
                          {isAnswered && isCorrect && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mt-1" />}
                          {isAnswered && isSelected && !isCorrect && <XCircle className="w-3.5 h-3.5 text-rose-500 mt-1" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Inline Explanation Box */}
                  {isAnswered && (
                    <div className="ml-0 sm:ml-10 p-4 bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs rounded-xl space-y-1 animate-fadeIn">
                      <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-800 block">ব্যাখ্যা / Reason:</span>
                      <p className="font-medium leading-relaxed">
                        {q.reason || `সঠিক উত্তর (Odd One): "${q.answer}"`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
