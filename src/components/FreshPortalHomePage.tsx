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
  LogOut,
  User,
  ShieldCheck
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-50 text-slate-800 flex flex-col justify-between font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 leading-tight">
              স্মার্ট লাইব্রেরি ও স্টাডি পোর্টাল
            </h1>
            <p className="text-[10px] text-slate-500">
              Memorizer-bd
            </p>
          </div>
        </div>

        {user && (
          <button
            onClick={onLogOut}
            className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
            title="লগআউট"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">লগআউট</span>
          </button>
        )}
      </header>

      {/* Main Centered Flow based on the layout diagram */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10 max-w-md w-full mx-auto">
        <div className="w-full flex flex-col items-center gap-3.5 sm:gap-4">

          {/* 1. TOP ELEMENT: LOG IN BUTTON / USER STATUS PILL */}
          {user ? (
            <div className="w-full py-2.5 px-4 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 border border-emerald-400/40 flex items-center justify-between gap-3 transition">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate leading-tight">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-emerald-100 leading-tight">
                    লগইন করা আছে (স্বাগতম)
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-white/25 px-2.5 py-0.5 rounded-full shrink-0">
                Active
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRequireAuth}
              className="w-full py-3 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base shadow-md shadow-emerald-600/20 border border-emerald-500 flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] cursor-pointer"
            >
              <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Log in button (লগইন করুন)</span>
            </button>
          )}

          {/* 2. MIDDLE ELEMENT 1: সাইন্স লাইব্রেরি (Science Library) */}
          <button
            type="button"
            onClick={() => onSelectLibrary('science')}
            className="w-full py-3.5 sm:py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm sm:text-base shadow-md shadow-amber-500/20 border border-amber-400 flex items-center justify-between gap-3 transition-all duration-150 active:scale-[0.98] cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition">
                <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="tracking-wide">সাইন্স লাইব্রেরি</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition">
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* 3. MIDDLE ELEMENT 2: সেন্ট্রাল লাইব্রেরি (Central Library) */}
          <button
            type="button"
            onClick={() => onSelectLibrary('central')}
            className="w-full py-3.5 sm:py-4 px-5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-sm sm:text-base shadow-md shadow-orange-500/20 border border-orange-400 flex items-center justify-between gap-3 transition-all duration-150 active:scale-[0.98] cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition">
                <Library className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="tracking-wide">সেন্ট্রাল লাইব্রেরি</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition">
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* 4. BOTTOM ELEMENT: Study Room / Memorizer-bd (Prominent Large Button) */}
          <button
            type="button"
            onClick={onOpenStudyRoom}
            className="w-full py-4 sm:py-5 px-5 sm:px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-600/25 border border-emerald-400/50 flex flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-[0.98] cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center gap-2 text-emerald-100 text-xs sm:text-sm font-semibold">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span>Study Room</span>
            </div>
            <div className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <span>Memorizer-bd</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition shrink-0" />
            </div>
            <span className="text-[11px] text-emerald-100/90 font-normal mt-0.5">
              স্মার্ট স্টাডি, ফ্ল্যাশকার্ড ও কুইজ প্র্যাকটিস
            </span>
          </button>

        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="text-center py-3 text-[11px] text-slate-400">
        স্মার্ট লাইব্রেরি সিস্টেম • Memorizer-bd
      </footer>
    </div>
  );
};

export default FreshPortalHomePage;

