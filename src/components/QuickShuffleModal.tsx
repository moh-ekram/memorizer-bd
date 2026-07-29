import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shuffle, 
  X, 
  CheckCircle2, 
  XCircle, 
  Volume2, 
  Sparkles, 
  RotateCcw, 
  Award, 
  AlertCircle,
  ChevronRight,
  HelpCircle,
  Check,
  Brain
} from 'lucide-react';
import { VocabularyWord, UserProgress, WordStatus } from '../types';

interface QuickShuffleModalProps {
  isOpen: boolean;
  onClose: () => void;
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  onRateWord?: (wordId: string, status: WordStatus) => void;
  onQuizComplete?: (score: number, totalQuestions: number) => void;
  placeLabels?: {
    place1?: string;
    place2?: string;
    place3?: string;
    place4?: string;
    place5?: string;
    place6?: string;
  };
}

interface Question {
  word: VocabularyWord;
  options: string[];
  correctAnswer: string;
}

export default function QuickShuffleModal({
  isOpen,
  onClose,
  words,
  progress,
  onRateWord,
  onQuizComplete,
  placeLabels
}: QuickShuffleModalProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Array<{ question: Question; selected: string; isCorrect: boolean }>>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [usingFallbackWords, setUsingFallbackWords] = useState(false);
  const [ratedInQuiz, setRatedInQuiz] = useState<Record<string, WordStatus>>({});

  // Audio speech
  const playAudio = (text: string) => {
    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Helper to shuffle an array
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Generate 5 questions when modal opens or "Shuffle Again" is clicked
  const initQuiz = () => {
    if (!words || words.length === 0) return;

    // Filter words marked as 'confusion'
    const confusionList = words.filter(w => progress[w.id]?.status === 'confusion');
    
    let targetWords: VocabularyWord[] = [];
    let isFallback = false;

    if (confusionList.length > 0) {
      // Shuffle confusion words
      const shuffledConfusion = shuffleArray(confusionList);
      targetWords = shuffledConfusion.slice(0, 5);

      // If less than 5 confusion words, pad with random words from rest of words
      if (targetWords.length < 5) {
        const remaining = words.filter(w => !targetWords.some(tw => tw.id === w.id));
        const extraNeeded = 5 - targetWords.length;
        const shuffledRemaining = shuffleArray(remaining);
        targetWords = [...targetWords, ...shuffledRemaining.slice(0, extraNeeded)];
      }
    } else {
      // Fallback: pick 5 random words if no confusion words exist
      isFallback = true;
      const shuffledAll = shuffleArray(words);
      targetWords = shuffledAll.slice(0, 5);
    }

    setUsingFallbackWords(isFallback);

    // Build MCQ questions
    const generatedQuestions: Question[] = targetWords.map(targetWord => {
      const correctAnswer = targetWord.meaning || targetWord.word;

      // Pick 3 random distractor meanings from other words
      const otherWords = words.filter(w => w.id !== targetWord.id && w.meaning && w.meaning.trim() !== correctAnswer.trim());
      const shuffledOthers = shuffleArray(otherWords);
      const distractors = shuffledOthers.slice(0, 3).map(w => w.meaning);

      const options = shuffleArray([correctAnswer, ...distractors]);

      return {
        word: targetWord,
        options,
        correctAnswer
      };
    });

    setQuestions(generatedQuestions);
    setCurrentIdx(0);
    setSelectedOption(null);
    setIsSubmitted(false);
    setScore(0);
    setUserAnswers([]);
    setIsFinished(false);
    setRatedInQuiz({});
  };

  useEffect(() => {
    if (isOpen) {
      initQuiz();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentQ = questions[currentIdx];
  const totalQs = questions.length;

  const handleSelectOption = (opt: string) => {
    if (isSubmitted) return;
    setSelectedOption(opt);
    setIsSubmitted(true);

    const isCorrect = opt.trim() === currentQ.correctAnswer.trim();
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setUserAnswers(prev => [
      ...prev,
      {
        question: currentQ,
        selected: opt,
        isCorrect
      }
    ]);
  };

  const handleNextQuestion = () => {
    if (currentIdx + 1 < totalQs) {
      setCurrentIdx(prev => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    } else {
      setIsFinished(true);
      if (onQuizComplete) {
        onQuizComplete(score, totalQs);
      }
    }
  };

  const handleRateCurrentWord = (newStatus: WordStatus) => {
    if (!currentQ) return;
    if (onRateWord) {
      onRateWord(currentQ.word.id, newStatus);
      setRatedInQuiz(prev => ({ ...prev, [currentQ.word.id]: newStatus }));
    }
  };

  const currentWordStatus = currentQ 
    ? (ratedInQuiz[currentQ.word.id] || progress[currentQ.word.id]?.status || 'unrated')
    : 'unrated';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden my-auto relative"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white p-4 sm:p-5 flex items-center justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-xl -z-0" />
            
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Shuffle className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg tracking-tight leading-none text-slate-950">
                    Quick Shuffle
                  </h3>
                  <span className="px-2 py-0.5 bg-slate-950/80 text-amber-300 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                    5 Questions
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-900/90 mt-1">
                  {usingFallbackWords 
                    ? '5 Questions Practice Quiz'
                    : 'Confusion Words Quiz'
                  }
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-slate-950/20 hover:bg-slate-950/40 text-slate-950 flex items-center justify-center transition cursor-pointer border border-slate-950/20 relative z-10"
              title="Close Quiz"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quiz Body */}
          <div className="p-4 sm:p-6 space-y-5">
            {!isFinished && currentQ ? (
              <>
                {/* Progress Indicator */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-amber-500" />
                      <span>Question {currentIdx + 1} of {totalQs}</span>
                    </span>
                    <span className="text-amber-600 font-mono font-bold">
                      Score: {score}/{currentIdx + (isSubmitted ? 1 : 0)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${((currentIdx + 1) / totalQs) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {/* Question Card */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 text-center relative space-y-2 shadow-2xs">
                  {placeLabels?.place1 && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 tracking-wider uppercase block">
                      {placeLabels.place1}
                    </span>
                  )}

                  <div className="flex items-center justify-center gap-2.5">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                      {currentQ.word.word}
                    </h2>
                    <button
                      onClick={() => playAudio(currentQ.word.word)}
                      className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition cursor-pointer"
                      title="Pronounce word"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  {currentQ.word.synonyms && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium italic">
                      Synonyms: {currentQ.word.synonyms}
                    </p>
                  )}
                </div>

                {/* Multiple Choice Options */}
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Select correct meaning:
                  </p>

                  <div className="grid grid-cols-1 gap-2.5">
                    {currentQ.options.map((optionText, oIdx) => {
                      const optionLetter = String.fromCharCode(65 + oIdx);
                      const isSelected = selectedOption === optionText;
                      const isCorrectAnswer = optionText.trim() === currentQ.correctAnswer.trim();

                      let btnStyle = "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/20";
                      let badgeStyle = "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300";

                      if (isSubmitted) {
                        if (isCorrectAnswer) {
                          btnStyle = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-500 ring-2 ring-emerald-500/20";
                          badgeStyle = "bg-emerald-600 text-white";
                        } else if (isSelected && !isCorrectAnswer) {
                          btnStyle = "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-500 ring-2 ring-rose-500/20";
                          badgeStyle = "bg-rose-600 text-white";
                        } else {
                          btnStyle = "bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 opacity-60";
                        }
                      }

                      return (
                        <button
                          key={oIdx}
                          disabled={isSubmitted}
                          onClick={() => handleSelectOption(optionText)}
                          className={`w-full p-3.5 sm:p-4 rounded-2xl border-2 font-semibold text-sm transition-all flex items-center justify-between text-left cursor-pointer ${btnStyle}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${badgeStyle}`}>
                              {optionLetter}
                            </span>
                            <span className="leading-snug">{optionText}</span>
                          </div>

                          {isSubmitted && isCorrectAnswer && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          )}
                          {isSubmitted && isSelected && !isCorrectAnswer && (
                            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback & Action Bar */}
                {isSubmitted && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {selectedOption?.trim() === currentQ.correctAnswer.trim() ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-sm">
                            <CheckCircle2 className="w-5 h-5" />
                            <span>Correct Answer!</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-black text-sm">
                            <XCircle className="w-5 h-5" />
                            <span>Incorrect!</span>
                          </div>
                        )}
                      </div>

                      {/* Rating quick updates */}
                      {onRateWord && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRateCurrentWord('know')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                              currentWordStatus === 'know' 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-100'
                            }`}
                            title="Mark as Learned"
                          >
                            <Check className="w-3 h-3" />
                            <span>Learned</span>
                          </button>
                          <button
                            onClick={() => handleRateCurrentWord('confusion')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                              currentWordStatus === 'confusion' 
                                ? 'bg-amber-500 text-white' 
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-100'
                            }`}
                            title="Keep in Confusion"
                          >
                            <HelpCircle className="w-3 h-3" />
                            <span>Confused</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {currentQ.word.example && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <strong className="text-amber-600 dark:text-amber-400 not-italic font-bold">Example: </strong>
                        {currentQ.word.example}
                      </p>
                    )}

                    <button
                      onClick={handleNextQuestion}
                      className="w-full py-3 rounded-xl bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-extrabold text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>{currentIdx + 1 < totalQs ? 'Next Question' : 'View Results'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </>
            ) : isFinished ? (
              /* Quiz Summary View */
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-6"
              >
                <div className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-yellow-500 text-slate-950 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Award className="w-10 h-10" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                    Quick Shuffle Complete!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {score === totalQs ? '🎉 Outstanding! You answered all questions correctly.' : 'Great effort! Regular practice keeps words fresh in memory.'}
                  </p>
                </div>

                {/* Score Banner */}
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl max-w-sm mx-auto flex items-center justify-around">
                  <div>
                    <span className="text-xs font-bold text-slate-400 block uppercase">Score</span>
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{score} / {totalQs}</span>
                  </div>
                  <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                  <div>
                    <span className="text-xs font-bold text-slate-400 block uppercase">Accuracy</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {Math.round((score / totalQs) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Answers Breakdown List */}
                <div className="space-y-2 text-left max-h-52 overflow-y-auto pr-1">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Question Review:
                  </h4>
                  {userAnswers.map((ans, i) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        ans.isCorrect 
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-200' 
                          : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-950 dark:text-rose-200'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-extrabold flex items-center gap-1.5">
                          <span>{i + 1}. {ans.question.word.word}</span>
                        </div>
                        <div className="text-[11px] opacity-80">
                          Meaning: {ans.question.correctAnswer}
                        </div>
                      </div>

                      <div>
                        {ans.isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={initQuiz}
                    className="flex-1 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Shuffle Next 5 Questions</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="py-3 px-5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
