import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Sparkles, GraduationCap, Trophy, ShieldCheck, 
  CheckCircle2, LogIn, UserPlus, Mail, Lock, ArrowRight, 
  Flame, Zap, Check, Layers, Globe, Star, Volume2, 
  BookMarked, CreditCard, Smartphone, Search, AlertCircle
} from 'lucide-react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from '../lib/firebase';
import { Course, AppSettings } from '../types';
import MyCoursesView from './MyCoursesView';

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
      let errMsg = 'একটি ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
      if (err.code === 'auth/wrong-password') {
        errMsg = 'ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।';
      } else if (err.code === 'auth/user-not-found') {
        errMsg = 'এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট তৈরি করা হয়েছে।';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'সঠিক ইমেইল ঠিকানা প্রদান করুন।';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'ইমেইল/পাসওয়ার্ড দিয়ে সাইন-ইন সাময়িকভাবে বন্ধ রয়েছে। গুগল সাইন-ইন ব্যবহার করুন।';
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
      let errMsg = 'গুগল দিয়ে সাইন ইন করতে ব্যর্থ হয়েছে।';
      if (err.code === 'auth/unauthorized-domain') {
        errMsg = 'এই ডোমেনটি ফায়ারবেস অথেনটিকেশনে অনুমোদিত নয়।';
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/25">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white uppercase font-sans">
              Memorizer
            </h1>
            <p className="text-[10px] text-emerald-400 font-bold -mt-0.5">
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
            className="px-3.5 py-1.5 text-xs font-extrabold text-slate-300 hover:text-white transition cursor-pointer"
          >
            লগইন
          </button>
          <button
            onClick={() => {
              setAuthMode('register');
              scrollToAuth();
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/30 transition cursor-pointer"
          >
            রেজিস্ট্রেশন
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 px-4 md:px-8 max-w-7xl mx-auto">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Hero Content Left */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>{settings?.landingBadgeText || "স্মার্ট ৩ডি ফ্ল্যাশকার্ড ও গেমিফাইড ভোকেবুলারি লার্নিং"}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
              {settings?.landingHeadlineMain || "সহজে শব্দ মনে রাখুন,"} <br />
              <span className="flex flex-wrap items-center gap-2">
                {activeCourseName && (
                  <span className="inline-block relative overflow-hidden bg-gradient-to-r from-indigo-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent transition-all duration-300">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={activeCourseName}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="inline-block"
                      >
                        {activeCourseName}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                )}
                <span className="bg-gradient-to-r from-indigo-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
                  {settings?.landingCourseSuffix || "কোর্স ইনরোল করে প্রস্তুতি নিন"}
                </span>
              </span>
            </h1>

            <p className="text-sm md:text-base text-slate-300 font-medium max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              {settings?.landingDescription || "GRE, BCS, IELTS, Bank Job কিংবা সাধারণ ইংরেজি শব্দভাণ্ডার সমৃদ্ধ করতে নিয়ে এলাম অল-ইন-ওয়ান মেমোরাইজার প্ল্যাটফর্ম। ফ্ল্যাশকার্ড, কুইজ, ভয়েস প্রোনাউনসিয়েশন এবং বিভিন্ন গেমের মাধ্যমে শব্দ শিখুন আনন্দ নিয়ে।"}
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={scrollToAuth}
                className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-600/25 flex items-center gap-2 transition cursor-pointer"
              >
                <span>{settings?.landingStartBtnText || "পড়াশোনা শুরু করুন"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4 text-xs font-bold text-slate-400 px-4 py-2 bg-slate-800/60 border border-slate-700/60 rounded-2xl">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{settings?.landingFeature1 || "অফলাইন সাপোর্ট"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Flame className="w-4 h-4" />
                  <span>{settings?.landingFeature2 || "লাইভ লিডারবোর্ড"}</span>
                </div>
              </div>
            </div>

            {/* Platform Stats Row */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/80">
              <div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">{settings?.landingStat1Num || "৩,০০০+"}</p>
                <p className="text-[11px] text-slate-400 font-bold">{settings?.landingStat1Label || "গুরুত্বপূর্ণ ভোকাব"}</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{settings?.landingStat2Num || "৬টি+"}</p>
                <p className="text-[11px] text-slate-400 font-bold">{settings?.landingStat2Label || "ইন্টারঅ্যাক্টিভ গেম"}</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-indigo-400 font-mono">{settings?.landingStat3Num || "১০০%"}</p>
                <p className="text-[11px] text-slate-400 font-bold">{settings?.landingStat3Label || "ক্লাউড সিঙ্ক"}</p>
              </div>
            </div>
          </div>

          {/* Hero Right: Embedded Login / Register Form */}
          <div className="lg:col-span-5" id="landing-auth-section">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 md:p-8 shadow-2xl relative backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                    {authMode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">
                      {authMode === 'login' ? 'অ্যাকাউন্টে লগইন করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {authMode === 'login' ? 'মেইন ড্যাশবোর্ডে প্রবেশ করতে লগইন করুন' : 'ফ্রি অ্যাকাউন্ট খুলে পড়া শুরু করুন'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Auth Mode Toggle Pills */}
              <div className="bg-slate-900 p-1 rounded-xl flex items-center mb-6 border border-slate-700/60 font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError('');
                  }}
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  লগইন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setError('');
                  }}
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  রেজিস্ট্রেশন
                </button>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs font-semibold mb-4">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-300 mb-1.5">
                    ইমেইল এড্রেস
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.name@example.com"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-300 mb-1.5">
                    পাসওয়ার্ড
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>অপেক্ষা করুন...</span>
                  ) : authMode === 'login' ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>লগইন করুন</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>অ্যাকাউন্ট খুলুন</span>
                    </>
                  )}
                </button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
                  <span className="bg-slate-800 px-3">অথবা</span>
                </div>
              </div>

              {/* Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2.5"
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
                লগইন করার মাধ্যমে আপনি আমাদের শর্তাবলী ও প্রাইভেসিতে সম্মতি দিচ্ছেন।
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Features Section */}
      <section className="py-16 px-4 md:px-8 bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl md:text-3xl font-black text-white">
              পড়াশোনার বিশেষ ফিচারসমূহ
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              শব্দ শেখা এবং মনে রাখা এখন আগের চেয়েও অনেক বেশি সহজ ও কার্যকর
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-indigo-500/50 transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">৩ডি অ্যানিমেটেড ফ্ল্যাশকার্ড</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                শব্দের অর্থ, সমার্থক শব্দ, উদাহরণ বাক্য এবং সঠিক উচ্চারণ সহ ৩ডি কার্ডে সহজ রিভিশন।
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-emerald-500/50 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">৬+ ইন্টারঅ্যাক্টিভ গেম</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Word Match, Fill in the Blanks, Synonym Check, Odd One Out এবং Analogy কুইজের মাধ্যমে নিজেকে টেস্ট করুন।
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-amber-500/50 transition">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">ভয়েস প্রোনাউনসিয়েশন</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                প্রতিটি শব্দের সঠিক ইংরেজি উচ্চারণ শুনুন সরাসরি AI স্পিচ সিলেকশনের মাধ্যমে।
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-indigo-500/50 transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">লাইভ গ্লোবাল লিডারবোর্ড</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                অন্যান্য সকল শিক্ষার্থীদের সাথে প্রতিযোগিতা করে এক্সেল-শীট ভিউয়ের সেরা র‍্যাংকিংয়ে জায়গা করে নিন।
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-emerald-500/50 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <BookMarked className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">কোর্স ক্যাটালগ ও ইনরোলমেন্ট</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                বিকাশ/নগদ পেমেন্টের মাধ্যমে সরাসরি পছন্দের কোর্সে ইনরোল করার আধুনিক সুযোগ।
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-purple-500/50 transition">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">অফলাইন মোবাইল ফ্রেন্ডলি PWA</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                ইন্টারনেট ছাড়াই পরবর্তীতে কন্টেন্ট রিভিশন করার সুবিধা এবং স্মুথ মোবাইল ড্যাশবোর্ড।
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Course Showcase & Direct Buy System (MyCoursesView) */}
      <section className="py-12 px-4 md:px-8 max-w-7xl mx-auto space-y-6" id="landing-courses-catalog">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>উপলব্ধ সকল কোর্স ক্যাটালগ</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              পছন্দের কোর্স আনলক ও ইনরোল করুন
            </h2>
            <p className="text-xs text-slate-300 font-medium">
              লগইন না করেও বিকাশ দিয়ে ওয়ালেট রিচার্জ কিংবা যেকোনো কোর্স কিনতে পারবেন। পেমেন্টের সাথে আপনার জিমেইল এড্রেস প্রদান করুন।
            </p>
          </div>

          <button
            onClick={scrollToAuth}
            className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-extrabold transition cursor-pointer self-start sm:self-auto flex items-center gap-2 border border-indigo-500/30"
          >
            <LogIn className="w-4 h-4" />
            <span>লগইন / একাউন্ট খুলুন</span>
          </button>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-3 sm:p-6 shadow-2xl">
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
      <footer className="py-8 px-4 border-t border-slate-800 text-center text-xs text-slate-500 space-y-2">
        <p className="font-bold text-slate-400">
          Memorizer &copy; {new Date().getFullYear()} — Smart Vocabulary & Flashcard Platform
        </p>
        <p className="text-[11px]">
          Designed for GRE, BCS, Bank Job & Language Aspirants. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
