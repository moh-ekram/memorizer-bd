import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, Sparkles, GraduationCap, Trophy, 
  CheckCircle2, LogIn, UserPlus, Mail, Lock, ArrowRight, 
  Layers, Star, Volume2, 
  BookMarked, Smartphone, AlertCircle,
  BarChart3, FileText, HelpCircle, Edit3, GitMerge, Clock,
  ChevronRight, Compass, Library, Check, Play
} from 'lucide-react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithGoogle
} from '../lib/db';
import { Course, AppSettings } from '../types';
import MyCoursesView from './MyCoursesView';
import FlashcardExactPreview from './FlashcardExactPreview';

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

  // Dynamic Course Name Rotation for Hero Tag
  const displayerCoursesList = (settings?.landingDisplayCourses && settings.landingDisplayCourses.length > 0)
    ? settings.landingDisplayCourses
    : ['BCS', 'GRE', 'IELTS', 'Bank Job', 'Primary Teacher', 'General Vocabulary'];

  const [currentCourseIdx, setCurrentCourseIdx] = useState(0);

  useEffect(() => {
    if (displayerCoursesList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentCourseIdx((prev) => (prev + 1) % displayerCoursesList.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [displayerCoursesList]);

  const activeCourseName = displayerCoursesList[currentCourseIdx % displayerCoursesList.length] || 'GRE & BCS';

  // Configured or fallback content
  const badgeText = settings?.landingBadgeText || 'Tailored for Aspirants';
  const headlineMain = settings?.landingHeadlineMain || 'Master High-Yield Vocabulary with Smart Flashcards & Practice.';
  const courseSuffix = settings?.landingCourseSuffix || 'Candidates';
  const description = settings?.landingDescription || 'An intelligent, multi-dimensional vocabulary memorizer engineered for GRE, BCS, IELTS, Bank Job, and competitive exam aspirants. Boost retention with 3D Flashcards, Native Audio Pronunciation, Contextual Stories, and Speed Quizzes.';
  const startBtnText = settings?.landingStartBtnText || 'Get Started Free';
  const feature1 = settings?.landingFeature1 || '3D Smart Flashcards & TTS Audio';
  const feature2 = settings?.landingFeature2 || '6+ Interactive Practice Games';
  const stat1Num = settings?.landingStat1Num || '5,000+';
  const stat1Label = settings?.landingStat1Label || 'Curated Words';
  const stat2Num = settings?.landingStat2Num || '6+';
  const stat2Label = settings?.landingStat2Label || 'Learning Modes';
  const stat3Num = settings?.landingStat3Num || '100%';
  const stat3Label = settings?.landingStat3Label || 'Free to Start';

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
    try {
      await signInWithGoogle();
      onAuthSuccess();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      let errMsg = 'গুগল সাইন-ইন সম্পন্ন করা যায়নি।';
      if (err.message?.includes('provider is not enabled') || err.message?.includes('Unsupported provider')) {
        errMsg = 'Supabase-এ Google Provider চালু করতে Supabase Dashboard ➔ Authentication ➔ Providers ➔ Google এনাবল করুন।';
      } else if (err.message) {
        errMsg = err.message;
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

  const scrollToLibrary = () => {
    const el = document.getElementById('landing-courses-catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToPreview = () => {
    const el = document.getElementById('landing-interactive-preview');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-xl text-white shadow-md shadow-indigo-500/20">
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

        <div className="flex items-center gap-2.5">
          <button
            onClick={scrollToPreview}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer border border-indigo-100"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Interactive Demo</span>
          </button>
          <button
            onClick={scrollToLibrary}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl transition cursor-pointer"
          >
            <Library className="w-3.5 h-3.5 text-indigo-600" />
            <span>Course Library</span>
          </button>
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
            {startBtnText}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-20 px-4 md:px-8 max-w-7xl mx-auto">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-72 h-72 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
          {/* Hero Content Left */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Highlight Badge with animated rotating course name */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>{badgeText} • <strong className="text-indigo-900 font-extrabold">{activeCourseName}</strong> {courseSuffix}</span>
            </div>

            {/* Display Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
              {headlineMain}
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto lg:mx-0">
              {description}
            </p>

            {/* Feature Highlights List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left max-w-lg mx-auto lg:mx-0">
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700 bg-white/70 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
                  <Layers className="w-4 h-4" />
                </div>
                <span>{feature1}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700 bg-white/70 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
                  <Trophy className="w-4 h-4" />
                </div>
                <span>{feature2}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700 bg-white/70 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <div className="p-1 rounded-lg bg-amber-50 text-amber-600">
                  <FileText className="w-4 h-4" />
                </div>
                <span>Contextual Stories & Reading</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700 bg-white/70 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <div className="p-1 rounded-lg bg-purple-50 text-purple-600">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span>Live Analytics & Leaderboard</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-2">
              <button
                onClick={() => {
                  setAuthMode('register');
                  scrollToAuth();
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-2"
              >
                <span>{startBtnText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={scrollToPreview}
                className="px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-200 shadow-xs transition cursor-pointer flex items-center gap-2"
              >
                <Play className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                <span>Live Flashcard Demo</span>
              </button>
              <button
                onClick={scrollToLibrary}
                className="px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-200 shadow-xs transition cursor-pointer flex items-center gap-2"
              >
                <Library className="w-4 h-4 text-indigo-600" />
                <span>Explore Courses</span>
              </button>
            </div>

            {/* Trust Metrics / Stats Row */}
            <div className="flex items-center justify-center lg:justify-start gap-6 pt-4 border-t border-slate-200/80 text-left">
              <div>
                <span className="block text-xl font-black text-slate-900 font-mono">{stat1Num}</span>
                <span className="text-[11px] text-slate-500 font-bold uppercase">{stat1Label}</span>
              </div>
              <div className="w-px h-7 bg-slate-200" />
              <div>
                <span className="block text-xl font-black text-indigo-600 font-mono">{stat2Num}</span>
                <span className="text-[11px] text-slate-500 font-bold uppercase">{stat2Label}</span>
              </div>
              <div className="w-px h-7 bg-slate-200" />
              <div>
                <span className="block text-xl font-black text-emerald-600 font-mono">{stat3Num}</span>
                <span className="text-[11px] text-slate-500 font-bold uppercase">{stat3Label}</span>
              </div>
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
                <div className="flex items-center gap-2.5">
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
              <div className="bg-slate-100 p-1 rounded-xl flex items-center mb-5 border border-slate-200 font-sans">
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

              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
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
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2"
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

              <div className="relative my-4">
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

              <p className="text-[10px] text-center text-slate-400 mt-3.5 font-medium">
                By logging in, you agree to our Terms of Service & Privacy Policy.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* EXACT MAIN WEBSITE FLASHCARD & LEARNING SUITE INTERACTIVE PREVIEW */}
      <section className="py-12 md:py-16 px-4 md:px-8 bg-gradient-to-b from-white via-indigo-50/30 to-slate-50 border-y border-slate-200" id="landing-interactive-preview">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold shadow-2xs">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Exact Website Live Experience</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Interactive 3D Flashcard & Retention System
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Experience the exact learning engine: Flip cards to reveal Bengali definitions, contextual sentences with highlighted keywords, native audio pronunciation, and response buttons.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-xl max-w-2xl mx-auto">
            <FlashcardExactPreview activeAnimation={settings?.flashcardAnimation || 'flip-h'} />
          </div>
        </div>
      </section>

      {/* Course Showcase & Direct Catalog (MyCoursesView Library) */}
      <section className="py-12 px-4 md:px-8 max-w-7xl mx-auto space-y-6" id="landing-courses-catalog">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>Available Course Library</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">
              Explore Vocabulary Courses & Packages
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Browse curated premium vocabulary sets for competitive exams or enroll to start learning immediately.
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

      {/* Featured Features Section */}
      <section className="py-16 px-4 md:px-8 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">
              Powerful Learning Tools & Features
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Master vocabulary faster with 3D flashcards, brain-training games, speech pronunciation, and performance analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-3 hover:bg-white hover:border-indigo-300 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
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
              <h3 className="text-base font-extrabold text-slate-900">Course Catalog & Library</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Browse curated vocabulary packages for GRE, BCS, IELTS, Bank Exams, and general English fluency.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-3 hover:bg-white hover:border-purple-300 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Spaced Repetition & Daily Goals</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Set daily study goals, track review queues, and reinforce unrated words with spaced repetition.
              </p>
            </div>
          </div>
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
