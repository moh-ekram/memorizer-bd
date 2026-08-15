import React, { useState } from 'react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithRedirect
} from '../lib/db';
import { Mail, Lock, X, AlertCircle, LogIn, UserPlus, Sparkles, CheckCircle2 } from 'lucide-react';
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
          throw new Error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      if (onAuthSuccess) onAuthSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      let errMsg = 'লগইনে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = 'ভুল পাসওয়ার্ড অথবা ইমেইল। সঠিক তথ্য দিয়ে চেষ্টা করুন।';
      } else if (err.code === 'auth/user-not-found') {
        errMsg = 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'এই ইমেইলটি ইতিমধ্যে ব্যবহৃত হয়েছে। লগইন করুন।';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'সঠিক ইমেইল ঠিকানা প্রদান করুন।';
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
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(auth, provider);
      if (onAuthSuccess) onAuthSuccess();
      onClose();
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
        errMsg = `এই ডোমেইনটি ফায়ারবেসে অনুমোদিত নয় (${window.location.hostname})।`;
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-sans">
        {/* Backdrop overlay */}
        <div 
          onClick={onClose}
          className="absolute inset-0 cursor-pointer"
        />

        {/* Modal content box */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-5 overflow-hidden text-white"
        >
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider border border-indigo-500/30">
                ক্লাউড ব্যাকআপ ও সিঙ্ক
              </span>
              <h3 className="text-xl font-black text-white">
                {isSignUp ? 'নতুন অ্যাকাউন্ট তৈরি করুন' : 'লগইন করুন'}
              </h3>
              <p className="text-xs text-slate-400">
                আপনার লাইব্রেরি সিট বুকিং ও স্টাডি প্রগ্রেস নিরাপদে ক্লাউডে সেভ থাকবে।
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-950/50 border border-rose-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 🌟 1-CLICK GOOGLE SIGN IN BUTTON (TOP & PROMINENT) */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 bg-white hover:bg-slate-100 text-slate-950 rounded-2xl font-black text-sm transition flex items-center justify-center gap-3 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-slate-200"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Google দিয়ে ১-ক্লিকে লগইন করুন</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <span className="relative px-3 bg-slate-900 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              অথবা ইমেইল ও পাসওয়ার্ড
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">ইমেইল ঠিকানা (Email)</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="yourname@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">পাসওয়ার্ড (Password)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              {isSignUp ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              <span>{loading ? 'অনুগ্রহ করে অপেক্ষা করুন...' : isSignUp ? 'অ্যাকাউন্ট তৈরি সম্পন্ন করুন' : 'ইমেইল দিয়ে লগইন'}</span>
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
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition hover:underline cursor-pointer"
            >
              {isSignUp ? 'ইতিমধ্যে অ্যাকাউন্ট আছে? লগইন করুন' : 'নতুন শিক্ষার্থী? নতুন অ্যাকাউন্ট তৈরি করুন'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
