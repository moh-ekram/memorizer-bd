import React from 'react';
import { 
  Building2, 
  GraduationCap, 
  LogIn, 
  ArrowRight,
  BookOpen,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { LibraryType } from '../types/library';

interface FreshPortalHomePageProps {
  user: any;
  onSelectLibrary: (type: LibraryType) => void;
  onOpenStudyRoom: () => void;
  onRequireAuth: () => void;
  onLogOut: () => void;
}

export const FreshPortalHomePage: React.FC<FreshPortalHomePageProps> = ({
  user,
  onSelectLibrary,
  onOpenStudyRoom,
  onRequireAuth,
  onLogOut
}) => {
  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar - Clean Light Mode */}
      <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
              স্মার্ট লাইব্রেরি ও স্টাডি পোর্টাল
            </h1>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              সিট বরাদ্দ সকাল ৮:০০ টা – রাত ১০:০০ টা পর্যন্ত
            </p>
          </div>
        </div>

        {/* User Auth Status */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-xs">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-black text-slate-900 leading-tight">
                  {user.displayName || user.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {user.email}
                </p>
              </div>
              <button
                onClick={onLogOut}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold transition cursor-pointer ml-1"
              >
                লগআউট
              </button>
            </div>
          ) : (
            <button
              onClick={onRequireAuth}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/20 active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>লগইন করুন</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center gap-4">
        
        {/* 🌟 'সিটের তথ্য সেভ রাখতে লগ ইন করুন' BUTTON / BANNER ABOVE MATRIX DIV */}
        {!user ? (
          <div className="w-full bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border-2 border-indigo-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5 text-left">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-black text-slate-900">
                  সিটের তথ্য সেভ রাখতে লগ ইন করুন
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  লাইব্রেরি সিট বুকিং, বিরতির সময় এবং স্টাডি প্রগ্রেস নিরাপদ রাখতে এক ক্লিকে সাইন ইন করুন।
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onRequireAuth}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95 shrink-0 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>সিটের তথ্য সেভ রাখতে লগ ইন করুন</span>
            </button>
          </div>
        ) : (
          <div className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 px-4 flex items-center justify-between gap-3 text-emerald-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs sm:text-sm font-bold">
                স্বাগতম, <span className="font-black text-emerald-950">{user.displayName || user.email}</span>! আপনার সিট বরাদ্দ এবং পড়ার অগ্রগতি সুরক্ষিত রয়েছে।
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] bg-emerald-100/80 text-emerald-800 px-2.5 py-1 rounded-full font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>৮:০০ AM - ১০:০০ PM</span>
            </div>
          </div>
        )}

        {/* 🌟 SELECTED MAIN MATRIX CONTAINER (TARGET ELEMENT - LIGHT MODE) */}
        <div className="border-2 border-slate-300 rounded-2xl overflow-hidden shadow-lg bg-white divide-y-2 divide-slate-300">
          
          {/* Row 1: হোমপেজ Header */}
          <div className="py-4 text-center bg-slate-900 font-black text-lg sm:text-xl text-white tracking-wider shadow-inner">
            হোমপেজ
          </div>

          {/* Row 2: লাইব্রেরি | স্টাডি রুম */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-slate-300 text-center font-black text-base bg-slate-50 text-slate-800">
            <div className="py-3.5 text-indigo-700 flex items-center justify-center gap-2 bg-indigo-50/50">
              <Building2 className="w-5 h-5" />
              <span>লাইব্রেরি</span>
            </div>
            <div className="py-3.5 text-purple-700 flex items-center justify-center gap-2 bg-purple-50/50">
              <GraduationCap className="w-5 h-5" />
              <span>স্টাডি রুম</span>
            </div>
          </div>

          {/* Row 3: Action Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-slate-300 bg-white">
            
            {/* Left Half: সাইন্স লাইব্রেরি ও সেন্ট্রাল লাইব্রেরি */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-slate-300">
              
              {/* সাইন্স লাইব্রেরি */}
              <button
                type="button"
                onClick={() => onSelectLibrary('science')}
                className="p-6 flex flex-col justify-between items-center text-center gap-4 hover:bg-slate-50 transition group cursor-pointer"
              >
                <div className="space-y-2 w-full">
                  <div className="text-3xl mb-1 filter drop-shadow-xs">🧪</div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition">
                    সাইন্স লাইব্রেরি
                  </h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    লগ ইন করলে সাইন্স লাইব্রেরির সিট বিন্যাস দেখাবে।
                  </p>
                </div>
                <div className="w-full py-2.5 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white border border-indigo-200 group-hover:border-indigo-600 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition shadow-xs">
                  <span>প্রবেশ করুন</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>

              {/* সেন্ট্রাল লাইব্রেরি */}
              <button
                type="button"
                onClick={() => onSelectLibrary('central')}
                className="p-6 flex flex-col justify-between items-center text-center gap-4 hover:bg-slate-50 transition group cursor-pointer"
              >
                <div className="space-y-2 w-full">
                  <div className="text-3xl mb-1 filter drop-shadow-xs">🏛️</div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-amber-600 transition">
                    সেন্ট্রাল লাইব্রেরি
                  </h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    লগ ইন করলে সেন্ট্রাল লাইব্রেরির সিট বিন্যাস দেখাবে।
                  </p>
                </div>
                <div className="w-full py-2.5 bg-amber-50 group-hover:bg-amber-600 text-amber-800 group-hover:text-white border border-amber-200 group-hover:border-amber-600 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition shadow-xs">
                  <span>প্রবেশ করুন</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>

            </div>

            {/* Right Half: স্টাডি রুম */}
            <button
              type="button"
              onClick={onOpenStudyRoom}
              className="p-8 flex flex-col justify-between items-center text-center gap-6 hover:bg-purple-50/40 transition group cursor-pointer"
            >
              <div className="space-y-3 max-w-xs">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-2xl group-hover:scale-105 transition shadow-xs">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black text-slate-900 group-hover:text-purple-700 transition">
                  স্টাডি রুম
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  লগ ইন করলে আমাদের বর্তমান মেমোরাইজার সিস্টেমে নিয়ে যাবে।
                </p>
              </div>

              <div className="w-full max-w-xs py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-purple-600/20 transition active:scale-95">
                <span>স্টাডি রুমে প্রবেশ করুন</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition" />
              </div>
            </button>

          </div>

        </div>

      </main>
    </div>
  );
};

export default FreshPortalHomePage;
