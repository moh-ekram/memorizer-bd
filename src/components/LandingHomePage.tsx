import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, LogIn, UserPlus, Mail, Lock, AlertCircle, Sparkles
} from 'lucide-react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithGoogle
} from '../lib/db';
import { Course, AppSettings } from '../types';

interface LandingHomePageProps {
  onAuthSuccess: () => void;
  courses?: Course[];
  onImportCourse?: (course: Course) => void;
  settings?: AppSettings;
}

export default function LandingHomePage({ onAuthSuccess, settings }: LandingHomePageProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const appTitle = 'Vocabulary Master';

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
      let errMsg = 'লগইন সম্পন্ন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।';
      if (
        err.code === 'auth/wrong-password' || 
        err.code === 'auth/invalid-credential' || 
        err.message?.includes('invalid-credential') || 
        err.message?.includes('Invalid login credentials')
      ) {
        errMsg = 'ভুল ইমেইল অথবা পাসওয়ার্ড! দয়া করে যাচাই করে পুনরায় চেষ্টা করুন।';
      } else if (err.code === 'auth/user-not-found') {
        errMsg = 'এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। Create Account বাটনে ক্লিক করে নতুন অ্যাকাউন্ট খুলুন।';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি আছে। অনুগ্রহ করে Log In করুন।';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'অনুগ্রহ করে একটি সঠিক ইমেইল এড্রেস প্রদান করুন।';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।';
      } else if (err.code === 'auth/too-many-requests') {
        errMsg = 'অতিরিক্ত ভুল চেষ্টার কারণে সাময়িকভাবে ব্লক করা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।';
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
      const userRes = await signInWithGoogle();
      if (userRes) {
        onAuthSuccess();
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      let errMsg = 'গুগল সাইন-ইন সম্পন্ন করা যায়নি। পুনরায় চেষ্টা করুন।';
      if (err.code === 'auth/popup-closed-by-user') {
        errMsg = 'গুগল সাইন-ইন উইন্ডো বন্ধ করা হয়েছে। পুনরায় চেষ্টা করুন।';
      } else if (err.code === 'auth/popup-blocked') {
        errMsg = 'ব্রাউজারে পপ-আপ ব্লক করা আছে। অনুগ্রহ করে পপ-আপ অ্যালাউ করুন।';
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 antialiased font-sans selection:bg-indigo-500 selection:text-white">
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50"
      >
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-3.5">
            <BookOpen className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
            <span>{appTitle}</span>
            <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {authMode === 'login' 
              ? 'আপনার অ্যাকাউন্টে লগইন করে পড়া শুরু করুন' 
              : 'নতুন অ্যাকাউন্ট তৈরি করে পড়া শুরু করুন'}
          </p>
        </div>

        {/* Auth Mode Toggle */}
        <div className="bg-slate-100 p-1 rounded-2xl flex items-center mb-5 border border-slate-200/70">
          <button
            type="button"
            id="auth-toggle-login"
            onClick={() => {
              setAuthMode('login');
              setError('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              authMode === 'login'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
          <button
            type="button"
            id="auth-toggle-register"
            onClick={() => {
              setAuthMode('register');
              setError('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              authMode === 'register'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200/90 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs font-semibold mb-4 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          type="button"
          id="btn-google-auth"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl border border-slate-300 transition cursor-pointer flex items-center justify-center gap-2.5 shadow-xs mb-4 active:scale-[0.99]"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold text-slate-400">
            <span className="bg-white px-3">অথবা ইমেইল দিয়ে</span>
          </div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ইমেইল এড্রেস (Email Address)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                id="landing-input-email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              পাসওয়ার্ড (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                id="landing-input-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            id="landing-btn-submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-indigo-600/25 transition cursor-pointer flex items-center justify-center gap-2 mt-2 active:scale-[0.99]"
          >
            {loading ? (
              <span>অপেক্ষা করুন...</span>
            ) : authMode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>লগ ইন করুন (Log In)</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>নতুন অ্যাকাউন্ট খুলুন (Create Account)</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
          <span>আপনার সকল স্টাডি প্রগ্রেস স্বয়ংক্রিয়ভাবে ক্লাউডে সংরক্ষিত থাকবে।</span>
        </div>
      </motion.div>
    </div>
  );
}
