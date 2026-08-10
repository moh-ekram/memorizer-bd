import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, Sparkles, GraduationCap, Trophy, 
  CheckCircle2, LogIn, UserPlus, Mail, Lock, ArrowRight, 
  Zap, Layers, Volume2, 
  BookMarked, Smartphone, AlertCircle,
  BarChart3, FileText, HelpCircle, Edit3, GitMerge, Clock,
  Check, Bookmark, X, SkipForward
} from 'lucide-react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithRedirect
} from '../lib/db';
import { Course, AppSettings } from '../types';
import MyCoursesView from './MyCoursesView';

const FEATURES_LIST = [
  {
    id: 'flashcards',
    name: '3D Interactive Flashcards',
    description: 'Flip cards with audio pronunciation, example sentences, synonyms, and response buttons.',
    icon: Layers,
    preview: (
      <div className="bg-white text-slate-900 rounded-2xl p-4 shadow-md border border-slate-200 flex flex-col justify-between min-h-[210px]">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
            <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
            <span>Bookmark</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="p-1.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200" title="Google Search">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-full">
              <Volume2 className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        <div className="my-auto text-center space-y-1 py-2">
          <span className="block uppercase text-[10px] text-indigo-500 font-bold tracking-wider">
            WORD 12 OF 150 • GRE VOCABULARY
          </span>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            BENEVOLENT
          </h3>
          <p className="text-xs text-indigo-500 font-medium">
            Tap card to reveal definition
          </p>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-around w-full">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <X className="w-4 h-4 stroke-[3]" />
            </div>
            <span className="text-[10px] font-medium text-slate-500">don't know</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-medium text-slate-500">confused</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center">
              <SkipForward className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-medium text-slate-500">skip</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <span className="text-[10px] font-medium text-slate-500">know</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'progress',
    name: 'Real-Time Progress Stats',
    description: 'Track mastered words, confused terms, and learning ratios with radial charts.',
    icon: BarChart3,
    preview: (
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">TOTAL WORDS</span>
            <p className="text-xl font-black text-indigo-700">1108</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase">NOT STUDIED</span>
            <p className="text-xl font-black text-slate-600">0</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center space-y-1">
            <div className="w-14 h-14 rounded-full border-4 border-slate-100 border-t-emerald-500 flex flex-col items-center justify-center">
              <span className="text-sm font-black text-emerald-600">63%</span>
            </div>
            <p className="text-[11px] font-bold text-emerald-700">Known</p>
          </div>

          <div className="flex flex-col items-center space-y-1">
            <div className="w-14 h-14 rounded-full border-4 border-slate-100 border-t-amber-500 flex flex-col items-center justify-center">
              <span className="text-sm font-black text-amber-600">12%</span>
            </div>
            <p className="text-[11px] font-bold text-amber-700">Confused</p>
          </div>

          <div className="flex flex-col items-center space-y-1">
            <div className="w-14 h-14 rounded-full border-4 border-slate-100 border-t-rose-500 flex flex-col items-center justify-center">
              <span className="text-sm font-black text-rose-600">25%</span>
            </div>
            <p className="text-[11px] font-bold text-rose-700">Don't Know</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'story',
    name: 'Contextual Story Mode',
    description: 'Read stories with embedded vocabulary, inline definitions, and audio playback.',
    icon: FileText,
    preview: (
      <div className="bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-md text-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-full border border-indigo-200 text-[10px]">
            Story 1 / 26
          </span>
          <h4 className="font-extrabold text-slate-800 text-xs">Fall of the Shadow King</h4>
          <span className="text-slate-400">✕</span>
        </div>

        <div className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-slate-200 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-bold">Color:</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-pink-400 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
          </div>
          <div className="flex items-center gap-1 font-bold text-emerald-600">
            <Volume2 className="w-3 h-3" /> Listen
          </div>
        </div>

        <p className="text-xs text-slate-700 leading-relaxed font-sans">
          In the ancient kingdom of Valoria, natural resources did{' '}
          <span className="px-1 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded border border-indigo-200 underline">
            abound
          </span>
          , making it a wealthy land. The ruler lived in a fortress that was not an{' '}
          <span className="px-1 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded border border-indigo-200 underline">
            amorphous
          </span>{' '}
          structure...
        </p>

        <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10px]">
          <button className="px-2 py-1 bg-slate-200 text-slate-700 rounded font-bold">Previous</button>
          <button className="px-2.5 py-1 bg-indigo-600 text-white rounded font-bold">Next Story →</button>
        </div>
      </div>
    )
  },
  {
    id: 'quiz',
    name: 'Interactive MCQ Speed Quiz',
    description: 'Test recall speed with timed multiple-choice questions and instant score feedback.',
    icon: HelpCircle,
    preview: (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-md text-slate-900">
        <div className="flex justify-between items-center text-xs">
          <span className="text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
            Question 3 of 10
          </span>
          <span className="text-amber-600 font-mono font-bold flex items-center gap-1 text-[11px]">
            <Clock className="w-3.5 h-3.5 animate-spin" /> 15s remaining
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase">Select correct synonym:</span>
          <h4 className="text-base font-black text-slate-900">"EPHEMERAL"</h4>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs font-bold pt-0.5">
          <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 flex items-center justify-between">
            <span>A. Short-lived</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
            <span>B. Eternal</span>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
            <span>C. Ancient</span>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
            <span>D. Massive</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'blank',
    name: 'Sentence Completion',
    description: 'Master contextual word usage by filling blanks in real exam-style sentences.',
    icon: Edit3,
    preview: (
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-4 shadow-md text-center space-y-3">
        <p className="text-xs font-bold text-slate-800 leading-relaxed">
          The weather in this region is so{' '}
          <span className="border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md inline-block mx-1 font-extrabold">
            ____
          </span>
          , one minute it's sunny and next it pours.
        </p>
        <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
          <div className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
            Homogeneous
          </div>
          <div className="py-1.5 px-2 bg-indigo-50 border-2 border-indigo-500 text-indigo-700 rounded-lg">
            Capricious ✓
          </div>
          <div className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
            Humdrum
          </div>
          <div className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
            Didactic
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'analogy',
    name: 'Analogy & Logic Pairings',
    description: 'Solve logical word pair relationships designed for GRE and BCS competitive tests.',
    icon: GitMerge,
    preview: (
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-4 shadow-md text-center space-y-3">
        <div className="bg-indigo-50 border border-indigo-100 text-indigo-900 px-3 py-1.5 rounded-xl inline-block text-xs font-black font-mono">
          Benevolent : Kindness
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
          <div className="py-2 px-2 bg-indigo-50 border-2 border-indigo-500 text-indigo-800 rounded-lg font-mono flex items-center justify-between">
            <span>Malevolent : Spite</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="py-2 px-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg font-mono">
            Magnanimous : Greed
          </div>
          <div className="py-2 px-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg font-mono">
            Honest : Deceit
          </div>
          <div className="py-2 px-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg font-mono">
            Parsimonious : Charity
          </div>
        </div>
      </div>
    )
  }
];

interface LandingHomePageProps {
  onAuthSuccess: () => void;
  courses: Course[];
  onImportCourse?: (course: Course) => void;
  settings?: AppSettings;
}

export default function LandingHomePage({ onAuthSuccess, courses, onImportCourse }: LandingHomePageProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (authMode === 'register') {
        if (password.length < 6) {
          throw new Error('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।');
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      let errMsg = 'একটি ত্রুটি ঘটেছে। পুনরায় চেষ্টা করুন।';
      if (err.code === 'auth/wrong-password') {
        errMsg = 'ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।';
      } else if (err.code === 'auth/user-not-found') {
        errMsg = 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'এই ইমেইলে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে।';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'সঠিক ইমেইল ঠিকানা প্রদান করুন।';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'ইমেইল/পাসওয়ার্ড লগইন সাময়িকভাবে বন্ধ আছে। গুগল দিয়ে সাইন-ইন করুন।';
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onAuthSuccess();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setLoading(false);
        return;
      }

      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: any) {
          console.error('Google Redirect Error:', redirectErr);
        }
      }

      let errMsg = 'গুগল সাইন-ইন সম্পন্ন করা যায়নি।';
      if (err.code === 'auth/unauthorized-domain') {
        errMsg = 'এই ডোমেইনটি ফায়ারবেসে অনুমোদিত নয়।';
      } else if (
        err.message?.includes('missing initial state') ||
        err.code === 'auth/web-storage-unsupported' ||
        err.message?.includes('sessionStorage')
      ) {
        errMsg = 'মোবাইল অ্যাপ বা ইন-অ্যাপ ব্রাউজারে সাইন-ইন করতে ব্রাউজারের ৩-ডট মেনু থেকে "Open in Chrome" সিলেক্ট করুন অথবা ইমেইল ও পাসওয়ার্ড ব্যবহার করুন।';
      } else if (err.code) {
        errMsg = `${errMsg} (${err.code})`;
      } else if (err.message) {
        errMsg = `${errMsg} (${err.message})`;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const scrollToAuth = () => {
    const el = document.getElementById('landing-auth-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 uppercase">
              MEMORIZER
            </h1>
            <p className="text-[10px] text-indigo-600 font-medium -mt-1">
              Vocabulary Learning Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              scrollToAuth();
            }}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              scrollToAuth();
            }}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
          >
            Register
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-8 pb-12 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Hero Left Info */}
          <div className="lg:col-span-7 space-y-5 text-left pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Smart Vocabulary & Exam Preparation</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Master Vocabulary for GRE, BCS, Bank Jobs & IELTS
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl font-normal">
              Study smarter with 3D flashcards, audio pronunciations, contextual stories, MCQ quizzes, logic games, and real-time cloud synchronization.
            </p>

            {/* Feature Stat Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 shadow-2xs">
                1100+ Vocabulary Words
              </span>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 shadow-2xs">
                37 Group Sets
              </span>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 shadow-2xs">
                6 Practice Games
              </span>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 shadow-2xs">
                Live Cloud Sync
              </span>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  scrollToAuth();
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <span>Get Started Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Hero Right Auth Form */}
          <div className="lg:col-span-5" id="landing-auth-section">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-lg relative"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {authMode === 'login' ? 'Account Log In' : 'New Account Registration'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {authMode === 'login' ? 'Sign in to sync your dashboard and study logs' : 'Create an account to save your study progress'}
                  </p>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="bg-slate-100 p-1 rounded-lg flex items-center mb-4 border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setError('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Register
                </button>
              </div>

              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-700 text-xs mb-3">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : authMode === 'login' ? (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Log In</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </form>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-semibold text-slate-400">
                  <span className="bg-white px-2">OR</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm rounded-lg border border-slate-200 transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Real Course Features Grid */}
      <section className="py-10 px-4 md:px-8 bg-white border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-left space-y-1">
            <h3 className="text-xl font-bold text-slate-900">
              Course Features & Practice Modes
            </h3>
            <p className="text-xs text-slate-500">
              Interactive preview of all learning tools included in the platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES_LIST.map((feat) => {
              const IconComp = feat.icon;
              return (
                <div key={feat.id} className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">{feat.name}</h4>
                    </div>
                    <p className="text-xs text-slate-500 font-normal">{feat.description}</p>
                  </div>
                  <div className="pt-1">
                    {feat.preview}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Course Catalog Showcase */}
      <section className="py-10 px-4 md:px-8 max-w-7xl mx-auto space-y-5" id="landing-courses-catalog">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Available Courses
            </h3>
            <p className="text-xs text-slate-500">
              Browse curated vocabulary sets for competitive exams.
            </p>
          </div>

          <button
            type="button"
            onClick={scrollToAuth}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-5 shadow-xs">
          <MyCoursesView
            user={null}
            allCourses={courses}
            enrolledCourseIds={[]}
            activeCourseId={'gre'}
            setActiveCourseId={() => {}}
            setEnrolledCourseIds={() => {}}
            progress={{}}
            onImportCourse={onImportCourse || (() => {})}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-slate-200 text-center text-xs text-slate-500 bg-white">
        <p className="font-medium text-slate-700">
          Memorizer &copy; {new Date().getFullYear()} — Smart Vocabulary Platform
        </p>
      </footer>
    </div>
  );
}
