import React from 'react';
import { 
  Building2, 
  GraduationCap, 
  LogIn, 
  ArrowRight,
  BookOpen
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
    <div className="min-h-screen bg-[#0a0e17] text-white flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <BookOpen className="w-4 h-4" />
          </div>
          <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
            হোমপেজ
          </h1>
        </div>

        {/* User Auth Info */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <span className="hidden sm:inline text-xs font-bold text-slate-200">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <button
                onClick={onLogOut}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold ml-1 cursor-pointer"
              >
                লগআউট
              </button>
            </div>
          ) : (
            <button
              onClick={onRequireAuth}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>লগইন করুন</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Clean Table/Matrix Container (Exact Replication of User Diagram) */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        
        <div className="border-2 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl bg-slate-900/90 divide-y-2 divide-slate-700/80">
          
          {/* Row 1: হোমপেজ Header */}
          <div className="py-4 text-center bg-slate-950 font-black text-lg sm:text-xl text-slate-100 tracking-wider">
            হোমপেজ
          </div>

          {/* Row 2: লাইব্রেরি | স্টাডি রুম */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-slate-700/80 text-center font-black text-base bg-slate-950/60">
            <div className="py-3.5 text-cyan-300 flex items-center justify-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>লাইব্রেরি</span>
            </div>
            <div className="py-3.5 text-purple-300 flex items-center justify-center gap-2">
              <GraduationCap className="w-4 h-4" />
              <span>স্টাডি রুম</span>
            </div>
          </div>

          {/* Row 3: Action Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-slate-700/80">
            
            {/* Left Half: সাইন্স লাইব্রেরি ও সেন্ট্রাল লাইব্রেরি */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-slate-700/80">
              
              {/* সাইন্স লাইব্রেরি */}
              <button
                onClick={() => onSelectLibrary('science')}
                className="p-6 flex flex-col justify-between items-center text-center gap-4 hover:bg-slate-800/80 transition group cursor-pointer"
              >
                <div className="space-y-2 w-full">
                  <div className="text-2xl mb-1">🧪</div>
                  <h3 className="text-base font-black text-white group-hover:text-cyan-300 transition">
                    সাইন্স লাইব্রেরি
                  </h3>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    লগ ইন করলে সাইন্স লাইব্রেরির সিট বিন্যাস দেখাবে।
                  </p>
                </div>
                <div className="w-full py-2 bg-cyan-600/20 group-hover:bg-cyan-600 text-cyan-300 group-hover:text-white border border-cyan-500/40 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition">
                  <span>প্রবেশ করুন</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>

              {/* সেন্ট্রাল লাইব্রেরি */}
              <button
                onClick={() => onSelectLibrary('central')}
                className="p-6 flex flex-col justify-between items-center text-center gap-4 hover:bg-slate-800/80 transition group cursor-pointer"
              >
                <div className="space-y-2 w-full">
                  <div className="text-2xl mb-1">🏛️</div>
                  <h3 className="text-base font-black text-white group-hover:text-amber-300 transition">
                    সেন্ট্রাল লাইব্রেরি
                  </h3>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    লগ ইন করলে সেন্ট্রাল লাইব্রেরির সিট বিন্যাস দেখাবে।
                  </p>
                </div>
                <div className="w-full py-2 bg-amber-600/20 group-hover:bg-amber-600 text-amber-300 group-hover:text-white border border-amber-500/40 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition">
                  <span>প্রবেশ করুন</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>

            </div>

            {/* Right Half: স্টাডি রুম */}
            <button
              onClick={onOpenStudyRoom}
              className="p-8 flex flex-col justify-between items-center text-center gap-6 hover:bg-purple-950/30 transition group cursor-pointer"
            >
              <div className="space-y-3 max-w-xs">
                <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mx-auto text-xl group-hover:scale-105 transition">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white group-hover:text-purple-300 transition">
                  স্টাডি রুম
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                  লগ ইন করলে আমাদের বর্তমান মেমোরাইজার সিস্টেমে নিয়ে যাবে।
                </p>
              </div>

              <div className="w-full max-w-xs py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition">
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
