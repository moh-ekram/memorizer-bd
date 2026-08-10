import React, { useState } from 'react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithRedirect
} from '../lib/db';
import { Mail, Lock, X, AlertCircle, LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
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
      onAuthSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      let errMsg = 'An error occurred. Please try again.';
      if (err.code === 'auth/wrong-password') {
        errMsg = 'Incorrect password. Please try again.';
      } else if (err.code === 'auth/user-not-found') {
        errMsg = 'No account found with this email.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email is already in use by another account.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'Email/password sign-in is not enabled. Please use the Google Sign-In button below.';
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
      onClose();
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans">
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal content box */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xl z-10 space-y-4 overflow-hidden"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {/* Subtle top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600"></div>

          {/* Header */}
          <div className="flex justify-between items-start pt-1">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSignUp ? 'Sign up to sync your study progress.' : 'Log in to access your saved vocabulary.'}
              </p>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-lg flex items-start gap-2 text-xs text-rose-700 leading-snug">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-slate-600 mb-1 block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition font-normal"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 mb-1 block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition font-normal"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60 text-white font-medium text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              {isSignUp ? <UserPlus className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Log In'}</span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <span className="relative px-2 bg-white text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              OR
            </span>
          </div>

          {/* Google Sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2 sm:py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 text-slate-700 font-medium text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Toggle account mode */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setError('');
                setIsSignUp(!isSignUp);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition hover:underline cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
