import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Sparkles, GraduationCap, Trophy, ShieldCheck, 
  CheckCircle2, LogIn, UserPlus, Mail, Lock, ArrowRight, 
  Flame, Zap, Check, Layers, Globe, Star, Volume2, 
  BookMarked, CreditCard, Smartphone, Search, AlertCircle,
  BarChart3, FileText, HelpCircle, Edit3, GitMerge, Clock,
  Play, ChevronRight, Award, Bookmark, X, SkipForward
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
    name: 'Flashcards',
    title: 'Smart 3D Flashcards & Audio Pronunciation',
    description: 'Master vocabulary faster with 3D card flips, clear TTS audio pronunciation, detailed definitions, example sentences, synonyms, and antonyms.',
    icon: Layers,
    color: 'from-indigo-500 to-purple-600',
    badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    preview: (
      <div className="bg-white text-slate-900 rounded-2xl p-3.5 sm:p-5 shadow-xl border border-slate-100 flex flex-col justify-between min-h-[210px] sm:min-h-[220px]">
        {/* Top Row: Google Search, Speaker Icon & Bookmark Meta */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1 text-[9px] sm:text-[11px] text-slate-500 font-medium">
            <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
            <span>Bookmark</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="p-1.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200" title="Search on Google">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-full" title="Speak Word">
              <Volume2 className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Center Content: Front Face */}
        <div className="my-auto text-center space-y-1 py-1 sm:py-2">
          <span className="block font-sans uppercase text-[8px] sm:text-[10px] text-indigo-400 font-semibold tracking-wider">
            WORD 12 OF 150 • GRE VOCABULARY
          </span>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight font-sans text-slate-900">
            BENEVOLENT
          </h1>
          <p className="text-[9px] sm:text-[11px] text-indigo-400 font-medium animate-pulse font-sans">
            Tap card to reveal definition ↺
          </p>
        </div>

        {/* Card Footer Response Controls */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-around w-full">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <X className="w-4 h-4 stroke-[3]" />
            </div>
            <span className="text-[8px] sm:text-[10px] font-medium text-slate-400 tracking-tight">don't know</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-[8px] sm:text-[10px] font-medium text-slate-400 tracking-tight">confusion</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center">
              <SkipForward className="w-3.5 h-3.5" />
            </div>
            <span className="text-[8px] sm:text-[10px] font-medium text-slate-400 tracking-tight">skip</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <span className="text-[8px] sm:text-[10px] font-medium text-slate-400 tracking-tight">know</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'progress',
    name: 'Progress Statistics',
    title: 'Real-Time Progress & Analytics',
    description: 'Track known words, review intervals, daily streak, and performance breakdown with real-time radial charts.',
    icon: BarChart3,
    color: 'from-emerald-500 to-teal-600',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    preview: (
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-xl">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 items-center text-center">
          {/* Ring 1 - Known */}
          <div className="flex flex-col items-center space-y-1">
            <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-full border-4 border-slate-100 flex flex-col items-center justify-center">
              <div className="absolute top-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full shadow-sm" />
              <span className="text-lg sm:text-2xl font-black text-emerald-600 font-mono">4</span>
              <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold -mt-1">57%</span>
            </div>
            <p className="text-[10px] sm:text-xs font-extrabold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Known
            </p>
          </div>

          {/* Ring 2 - Confused */}
          <div className="flex flex-col items-center space-y-1">
            <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-full border-4 border-slate-100 flex flex-col items-center justify-center">
              <div className="absolute top-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-amber-500 rounded-full shadow-sm" />
              <span className="text-lg sm:text-2xl font-black text-amber-500 font-mono">0</span>
              <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold -mt-1">0%</span>
            </div>
            <p className="text-[10px] sm:text-xs font-extrabold text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Confused
            </p>
          </div>

          {/* Ring 3 - Don't Know */}
          <div className="flex flex-col items-center space-y-1">
            <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-full border-4 border-slate-100 flex flex-col items-center justify-center">
              <div className="absolute top-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-rose-500 rounded-full shadow-sm" />
              <span className="text-lg sm:text-2xl font-black text-rose-500 font-mono">3</span>
              <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold -mt-1">43%</span>
            </div>
            <p className="text-[10px] sm:text-xs font-extrabold text-rose-600 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Don't Know
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'story',
    name: 'Story Mode',
    title: 'Contextual Story Mode - Vocabulary in Context',
    description: 'Read engaging stories with embedded vocabulary, inline definitions, audio reading, font scaling, and instant word detection.',
    icon: FileText,
    color: 'from-amber-500 to-orange-600',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    preview: (
      <div className="bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-2 shadow-xl text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-full border border-indigo-200 text-[9px] sm:text-[11px]">
            Story 1 / 26
          </span>
          <h4 className="font-black text-slate-900 text-[10px] sm:text-xs">Fall of the Shadow King</h4>
          <span className="p-0.5 bg-slate-200 text-slate-600 rounded hover:text-slate-900 text-[9px]">✕</span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-1 bg-white p-1.5 rounded-xl border border-slate-200 text-[8px] sm:text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-bold">Color:</span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-500 inline-block" />
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-pink-400 inline-block" />
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 inline-block" />
          </div>
          <div className="flex items-center gap-1 font-bold text-slate-700">
            <button className="px-1 bg-slate-100 rounded border border-slate-200">A-</button>
            <button className="px-1 bg-indigo-600 text-white rounded">A</button>
            <button className="px-1 bg-slate-100 rounded border border-slate-200">A+</button>
          </div>
          <div className="flex items-center gap-1 text-emerald-600 font-bold">
            <Volume2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Listen
          </div>
        </div>

        {/* Story Text */}
        <p className="text-[9px] sm:text-xs text-slate-700 leading-relaxed font-sans">
          In the ancient kingdom of Valoria, natural resources did{' '}
          <span className="px-1 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded border border-indigo-200 underline">
            abound
          </span>
          , making it a wealthy land. The ruler, King Alaric, lived in a giant fortress that was not an{' '}
          <span className="px-1 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded border border-indigo-200 underline">
            amorphous
          </span>{' '}
          structure...
        </p>

        {/* Nav Buttons */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[8px] sm:text-[10px]">
          <button className="px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded-lg font-bold">Previous</button>
          <button className="px-2.5 py-0.5 bg-indigo-600 text-white rounded-lg font-bold">Next (Story) →</button>
        </div>
      </div>
    )
  },
  {
    id: 'quiz',
    name: 'Quiz (MCQ)',
    title: 'Interactive MCQ & Speed Test Quizzes',
    description: 'Test your speed and memory with timed multiple-choice questions, instant score calculation, and progress tracking.',
    icon: HelpCircle,
    color: 'from-purple-500 to-indigo-600',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    preview: (
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 space-y-2.5 shadow-xl text-slate-900">
        <div className="flex justify-between items-center text-[9px] sm:text-xs">
          <span className="text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
            Question 3 of 10 • Speed Test
          </span>
          <span className="text-amber-600 font-mono font-bold flex items-center gap-1 text-[9px] sm:text-[11px]">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" /> 15s remaining
          </span>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider">Select the correct synonym:</p>
          <h4 className="text-base sm:text-lg font-black text-slate-900">"EPHEMERAL"</h4>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold pt-0.5">
          <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 flex items-center justify-between">
            <span>A. Short-lived</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
            <span>B. Eternal</span>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
            <span>C. Ancient</span>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
            <span>D. Massive</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'blank',
    name: 'Sentence Completion',
    title: 'Fill in the Blanks & Contextual Sense',
    description: 'Enhance contextual retention by selecting the correct vocabulary word to complete real-world sentences.',
    icon: Edit3,
    color: 'from-blue-500 to-cyan-600',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    preview: (
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xl text-center space-y-3">
        <p className="text-xs sm:text-sm font-black text-slate-800 leading-relaxed max-w-lg mx-auto">
          The weather in this region is so{' '}
          <span className="border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg inline-block mx-1 font-extrabold">
            ____
          </span>
          , one minute it's sunny and next it pours.
        </p>
        <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs font-black">
          <div className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
            Homogeneous
          </div>
          <div className="py-2 px-3 bg-indigo-50 border-2 border-indigo-500 text-indigo-700 rounded-xl flex items-center justify-center gap-1">
            Capricious ✓
          </div>
          <div className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
            Humdrum
          </div>
          <div className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
            Didactic
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'analogy',
    name: 'Analogy',
    title: 'Analogy & Logical Reasoning Pairs',
    description: 'Practice logical word associations and pairing relationships for competitive exam preparation (GRE, BCS, IELTS).',
    icon: GitMerge,
    color: 'from-rose-500 to-pink-600',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    preview: (
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xl text-center space-y-3">
        <div>
          <div className="bg-indigo-50/60 border border-indigo-100 text-indigo-900 px-4 py-2 rounded-2xl inline-block text-xs sm:text-sm font-black font-mono shadow-xs">
            Benevolent : Kindness
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs font-extrabold">
          <div className="py-2.5 px-2 bg-indigo-50 border-2 border-indigo-500 text-indigo-800 rounded-xl font-mono flex items-center justify-between">
            <span>Malevolent : Spite</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="py-2.5 px-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-mono">
            Magnanimous : Greed
          </div>
          <div className="py-2.5 px-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-mono">
            Honest : Deceit
          </div>
          <div className="py-2.5 px-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-mono">
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

export default function LandingHomePage({ onAuthSuccess, courses, onImportCourse, settings }: LandingHomePageProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Course Displayer 2-Second Rotation logic
  const displayerCoursesList = (settings?.landingDisplayCourses && settings.landingDisplayCourses.length > 0)
    ? settings.landingDisplayCourses
    : ['BCS', 'GRE', 'IELTS', 'Bank Job', 'Primary Teacher', 'Basic Vocab'];

  const [currentCourseIdx, setCurrentCourseIdx] = useState(0);

  useEffect(() => {
    if (displayerCoursesList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentCourseIdx((prev) => (prev + 1) % displayerCoursesList.length);
    }, 2000); // 2 seconds per course display switch

    return () => clearInterval(interval);
  }, [displayerCoursesList]);

  const activeCourseName = displayerCoursesList[currentCourseIdx % displayerCoursesList.length] || '';

  // Feature Showcase Auto-rotation logic (2s rotation)
  const [activeFeatureIdx, setActiveFeatureIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeatureIdx((prev) => (prev + 1) % FEATURES_LIST.length);
    }, 2000); // 2 seconds per feature
    return () => clearInterval(interval);
  }, []);

  const currentFeature = FEATURES_LIST[activeFeatureIdx];


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
      let errMsg = 'An error occurred. Please try again.';
      if (err.code === 'auth/wrong-password') {
        errMsg = 'Incorrect password! Please try again.';
      } else if (err.code === 'auth/user-not-found') {
        errMsg = 'No account found with this email address.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'An account already exists with this email address.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Please provide a valid email address.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'Email/password login is temporarily disabled. Please use Google Sign-In.';
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

      // If popup is blocked in mobile WebView, attempt redirect fallback
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
        const currentDomain = window.location.hostname;
        errMsg = `এই ডোমেইনটি (${currentDomain}) ফায়ারবেসে অনুমোদিত নয় (Unauthorized Domain)।`;
      } else if (
        err.message?.includes('missing initial state') ||
        err.code === 'auth/web-storage-unsupported' ||
        err.message?.includes('sessionStorage')
      ) {
        errMsg = 'মোবাইল অ্যাপ/ইন-অ্যাপ ব্রাউজারে (WebView) স্টোরেজ নিরাপত্তার কারণে Google Sign-In বাধাগ্রস্ত হতে পারে। সমাধান: ১) নিচে ইমেইল ও পাসওয়ার্ড দিয়ে সাইন-ইন/রেজিস্টার করুন, অথবা ২) ব্রাউজারের ৩-ডট মেনু থেকে "Open in Chrome" সিলেক্ট করুন।';
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase font-sans">
              Memorizer
            </h1>
            <p className="text-[10px] text-emerald-600 font-bold -mt-0.5">
              Vocabulary & Language Hub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAuthMode('login');
              scrollToAuth();
            }}
            className="px-3.5 py-1.5 text-xs font-extrabold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            Log In
          </button>
          <button
            onClick={() => {
              setAuthMode('register');
              scrollToAuth();
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            Register
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-10 pb-20 px-4 md:px-8 max-w-7xl mx-auto">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-72 h-72 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Hero Content Left */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div 
              onClick={() => {
                setAuthMode('login');
                scrollToAuth();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span className="tracking-wide">log in to start</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 text-indigo-100" />
            </div>

            {/* Animated Feature Showcase Card (Fixed Height Container with 3D Perspective) */}
            <div className="relative h-[275px] sm:h-[255px] w-full overflow-hidden [perspective:1000px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentFeature.id}
                  initial={{ opacity: 0, rotateX: -18, rotateY: 5, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, rotateX: 0, rotateY: 0, scale: 1, y: 0 }}
                  exit={{ opacity: 0, rotateX: 18, rotateY: -5, scale: 0.96, y: -12 }}
                  transition={{
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                  className="absolute inset-x-0 top-0 space-y-3 origin-center transform-gpu"
                >
                  {/* Feature Title & Badge */}
                  <motion.div
                    initial={{ opacity: 0, rotateX: -10, y: 6 }}
                    animate={{ opacity: 1, rotateX: 0, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
                    className="flex flex-wrap items-center justify-between gap-2 text-left"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className={`p-1 sm:p-1.5 rounded-lg bg-gradient-to-tr ${currentFeature.color} text-white shadow-md`}>
                        <currentFeature.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <h3 className="text-xs sm:text-base font-black text-slate-900">
                        {currentFeature.name}
                      </h3>
                    </div>
                  </motion.div>

                  {/* Feature Mockup Preview */}
                  <div className="pt-1">
                    {currentFeature.preview}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Hero Right: Embedded Login / Register Form */}
          <div className="lg:col-span-5" id="landing-auth-section">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl relative"
            >
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    {authMode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      {authMode === 'login' ? 'Log In to Account' : 'Create Free Account'}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {authMode === 'login' ? 'Sign in to access your dashboard & courses' : 'Create an account to start tracking your progress'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Auth Mode Toggle Pills */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center mb-6 border border-slate-200 font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError('');
                  }}
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-indigo-600 text-white shadow-sm'
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
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Register
                </button>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold mb-4">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white font-mono transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white font-mono transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Please wait...</span>
                  ) : authMode === 'login' ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Log In</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
                  <span className="bg-white px-3">OR</span>
                </div>
              </div>

              {/* Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition cursor-pointer flex items-center justify-center gap-2.5 shadow-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <p className="text-[10px] text-center text-slate-400 mt-4 font-medium">
                By logging in, you agree to our Terms of Service & Privacy Policy.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Features Section */}
      <section className="py-16 px-4 md:px-8 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">
              Powerful Learning Features
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Master vocabulary faster with smart flashcards, interactive quizzes, audio pronunciation, and live tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-3 hover:bg-white hover:border-indigo-300 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">3D Animated Flashcards</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Flip interactive cards with definitions, synonyms, antonyms, example sentences, and audio pronunciation.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-3 hover:bg-white hover:border-emerald-300 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">6+ Interactive Games</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Test your memory with Word Match, Sentence Completion, Synonym Check, Odd One Out, and Analogy games.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-3 hover:bg-white hover:border-amber-300 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Volume2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Voice Pronunciation</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Listen to clear native audio pronunciations powered by advanced text-to-speech engine.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-3 hover:bg-white hover:border-indigo-300 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Trophy className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Live Global Leaderboard</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Compete with learners worldwide, earn streak badges, and track your global rank in real time.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-3 hover:bg-white hover:border-emerald-300 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <BookMarked className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Course Catalog & Enrollment</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Browse curated vocabulary packages for GRE, BCS, IELTS, Bank Exams, and general English fluency.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-3 hover:bg-white hover:border-purple-300 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Offline-Friendly Mobile App</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Install as a PWA on your phone for offline study, instant notifications, and smooth user experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Course Showcase & Direct Buy System (MyCoursesView) */}
      <section className="py-12 px-4 md:px-8 max-w-7xl mx-auto space-y-6" id="landing-courses-catalog">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>Available Course Catalog</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">
              Explore & Unlock Specialized Courses
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Start practicing right away or enroll in curated premium vocabulary sets for competitive exams.
            </p>
          </div>

          <button
            onClick={scrollToAuth}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition cursor-pointer self-start sm:self-auto flex items-center gap-2 shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>Log In / Register</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-3 sm:p-6 shadow-xl">
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
      <footer className="py-8 px-4 border-t border-slate-200 text-center text-xs text-slate-500 space-y-1 bg-slate-50">
        <p className="font-bold text-slate-700">
          Memorizer &copy; {new Date().getFullYear()} — Smart Vocabulary & Flashcard Platform
        </p>
        <p className="text-[11px] text-slate-500">
          Designed for GRE, BCS, Bank Job & Language Aspirants. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
