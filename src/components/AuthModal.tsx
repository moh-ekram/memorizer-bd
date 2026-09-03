import React, { useState } from 'react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithGoogle
} from '../lib/db';
import { Mail, Lock, X, AlertCircle, LogIn, UserPlus, Sparkles, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      if (onAuthSuccess) onAuthSuccess();
      onClose();
    } catch (err: any) {
      console.error('Auth Error:', err);
      let errMsg = 'Authentication failed. Please try again.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.message?.includes('Invalid login credentials') || err.message?.includes('invalid-credential')) {
        errMsg = 'ভুল ইমেইল অথবা পাসওয়ার্ড। অনুগ্রহ করে যাচাই করে পুনরায় চেষ্টা করুন।';
      } else if (err.code === 'auth/user-not-found' || err.message?.includes('User not found')) {
        errMsg = 'এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।';
      } else if (err.code === 'auth/email-already-in-use' || err.message?.includes('already registered') || err.message?.includes('User already registered')) {
        errMsg = 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট তৈরি করা আছে। অনুগ্রহ করে লগইন করুন।';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'অনুগ্রহ করে একটি সঠিক ইমেইল এড্রেস প্রদান করুন।';
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
        if (onAuthSuccess) onAuthSuccess();
        onClose();
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
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm font-sans">
        {/* Backdrop overlay */}
        <div 
          onClick={onClose}
          className="absolute inset-0 cursor-pointer"
        />

        {/* Modal content card */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-5 overflow-hidden text-slate-900"
        >
          {/* Top Decorative Color Accent */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600" />

          {/* Header */}
          <div className="flex justify-between items-start pt-1">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-100 uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3" />
                <span>Secure Cloud Sync</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Log in to securely save your seat bookings, timer status, and study progress.
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 leading-relaxed font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 🌟 1-CLICK GOOGLE SIGN IN BUTTON (ENGLISH) */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-3 shadow-sm hover:shadow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-slate-200"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <span className="relative px-3 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Or with email and password
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer active:scale-[0.99]"
            >
              {isSignUp ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              <span>{loading ? 'Please wait...' : isSignUp ? 'Create My Account' : 'Sign In with Email'}</span>
            </button>
          </form>

          {/* Toggle account mode */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setError('');
                setIsSignUp(!isSignUp);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition hover:underline cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account yet? Create one"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
