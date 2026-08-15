import React from 'react';
import { 
  Building2, 
  GraduationCap, 
  LogIn, 
  ArrowRight,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Clock,
  FlaskConical,
  Library,
  ChevronRight,
  LogOut
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar - Ultra-compact & Sleek */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-50 px-3.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-2xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 leading-tight">
              স্মার্ট লাইব্রেরি ও স্টাডি পোর্টাল
            </h1>
            <p className="text-[10px] text-slate-500 font-normal hidden sm:block">
              সিট বুকিং ও মেমোরাইজার সিস্টেম
            </p>
          </div>
        </div>

        {/* User Auth Status */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/80 px-2.5 py-1 rounded-lg">
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <span className="text-xs font-medium text-slate-700 max-w-[80px] sm:max-w-[120px] truncate">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <button
                onClick={onLogOut}
                className="text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-1.5 py-0.5 rounded font-medium transition cursor-pointer ml-0.5"
                title="লগআউট"
              >
                লগআউট
              </button>
            </div>
          ) : (
            <button
              onClick={onRequireAuth}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>লগইন</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area - Fully visible within single screen viewport */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-5 flex flex-col justify-center gap-2.5 sm:gap-3.5">
        
        {/* Compact User / Auth Notice Banner */}
        {!user ? (
          <div className="w-full bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <p className="text-xs text-indigo-950 font-medium truncate">
                সিট ও পড়ার অগ্রগতি সেভ রাখতে সাইন ইন করুন
              </p>
            </div>
            <button
              type="button"
              onClick={onRequireAuth}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] rounded-lg transition shrink-0 cursor-pointer shadow-2xs active:scale-95"
            >
              লগইন করুন
            </button>
          </div>
        ) : (
          <div className="w-full bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-emerald-950 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-medium truncate">
                স্বাগতম, <strong className="font-bold text-emerald-950">{user.displayName || user.email?.split('@')[0]}</strong>! সিট ও ডাটা সুরক্ষিত।
              </p>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md font-medium shrink-0 hidden xs:inline-block">
              ৮:০০ AM - ১০:০০ PM
            </span>
          </div>
        )}

        {/* 🌟 UNIFIED COMPACT DASHBOARD CONTAINER (Both Libraries + Study Room Visible Together) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          
          {/* Card 1: সাইন্স লাইব্রেরি (Science Library) */}
          <div
            onClick={() => onSelectLibrary('science')}
            className="group relative bg-white hover:bg-indigo-50/40 border border-slate-200/90 hover:border-indigo-400 rounded-2xl p-3 sm:p-4.5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
          >
            <div>
              {/* Header with Icon + Category */}
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center text-base sm:text-lg group-hover:scale-105 transition shadow-2xs">
                  🧪
                </div>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50/80 px-1.5 py-0.5 rounded">
                  লাইব্রেরি
                </span>
              </div>

              {/* Title & Subtitle */}
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">
                সাইন্স লাইব্রেরি
              </h3>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5 line-clamp-2 leading-relaxed">
                রুম ও লাইভ সিট বিন্যাস দেখুন
              </p>
            </div>

            {/* Clickable Action Button / Bar */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-indigo-600 group-hover:text-indigo-700">
              <span className="text-[11px] font-bold">সিট বুকিং</span>
              <div className="w-5 h-5 rounded-full bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition">
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          </div>

          {/* Card 2: সেন্ট্রাল লাইব্রেরি (Central Library) */}
          <div
            onClick={() => onSelectLibrary('central')}
            className="group relative bg-white hover:bg-amber-50/40 border border-slate-200/90 hover:border-amber-400 rounded-2xl p-3 sm:p-4.5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
          >
            <div>
              {/* Header with Icon + Category */}
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center text-base sm:text-lg group-hover:scale-105 transition shadow-2xs">
                  🏛️
                </div>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50/80 px-1.5 py-0.5 rounded">
                  লাইব্রেরি
                </span>
              </div>

              {/* Title & Subtitle */}
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-amber-700 transition leading-snug">
                সেন্ট্রাল লাইব্রেরি
              </h3>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5 line-clamp-2 leading-relaxed">
                রুম ও লাইভ সিট বিন্যাস দেখুন
              </p>
            </div>

            {/* Clickable Action Button / Bar */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-amber-700 group-hover:text-amber-800">
              <span className="text-[11px] font-bold">সিট বুকিং</span>
              <div className="w-5 h-5 rounded-full bg-amber-50 group-hover:bg-amber-600 group-hover:text-white flex items-center justify-center transition">
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          </div>

          {/* Card 3: স্টাডি রুম (Study Room - Spans 2 cols on mobile, 1 col on desktop) */}
          <div
            onClick={onOpenStudyRoom}
            className="col-span-2 sm:col-span-1 group relative bg-gradient-to-br from-purple-50/80 via-white to-purple-50/30 hover:from-purple-100/80 hover:to-purple-50/60 border border-purple-200/90 hover:border-purple-400 rounded-2xl p-3 sm:p-4.5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
          >
            <div>
              {/* Header with Icon + Category */}
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center group-hover:scale-105 transition shadow-2xs">
                  <GraduationCap className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100/90 px-2 py-0.5 rounded-full">
                  পড়াশোনা ও প্র্যাকটিস
                </span>
              </div>

              {/* Title & Subtitle */}
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-700 transition leading-snug">
                স্টাডি রুম (মেমোরাইজার)
              </h3>
              <p className="text-[11px] text-slate-600 font-normal mt-0.5 line-clamp-2 leading-relaxed">
                ফ্ল্যাশকার্ড ও প্রশ্ন সমাধান সিস্টেম
              </p>
            </div>

            {/* Clickable Action Button */}
            <div className="mt-3 pt-2 border-t border-purple-100 flex items-center justify-between text-purple-700 group-hover:text-purple-800">
              <span className="text-[11px] font-bold">স্টাডি রুমে যান</span>
              <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center transition group-hover:scale-110 shadow-2xs">
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
};

export default FreshPortalHomePage;

