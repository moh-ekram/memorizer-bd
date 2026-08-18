import React, { useState, useEffect } from 'react';
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
  ShieldCheck,
  FileText,
  ExternalLink,
  HelpCircle,
  Globe
} from 'lucide-react';
import { db, doc, onSnapshot } from '../lib/db';
import { LibraryType, DEFAULT_LIBRARY_CONFIG } from '../types/library';
import { StudyRoomLandingSection } from './StudyRoomLandingSection';

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
  const [showGuidelinesModal, setShowGuidelinesModal] = useState<boolean>(false);
  const [guidelines, setGuidelines] = useState<string>(
    localStorage.getItem('library_portal_guidelines') || DEFAULT_LIBRARY_CONFIG.guidelines || ''
  );
  const [facebookUrl, setFacebookUrl] = useState<string>(
    localStorage.getItem('library_portal_facebook_url') || DEFAULT_LIBRARY_CONFIG.facebookPageUrl || 'https://facebook.com'
  );

  // Sync guidelines & facebook URL in real time
  useEffect(() => {
    try {
      const globalConfigRef = doc(db, 'library_settings', 'global_library_config');
      const unsubscribeGlobal = onSnapshot(globalConfigRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data?.guidelines) {
            setGuidelines(data.guidelines);
            localStorage.setItem('library_portal_guidelines', data.guidelines);
          }
          if (data?.facebookPageUrl) {
            setFacebookUrl(data.facebookPageUrl);
            localStorage.setItem('library_portal_facebook_url', data.facebookPageUrl);
          }
        }
      });

      const scienceConfigRef = doc(db, 'library_settings', 'library_config_science');
      const unsubscribeScience = onSnapshot(scienceConfigRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data?.guidelines && !localStorage.getItem('library_portal_guidelines')) {
            setGuidelines(data.guidelines);
          }
          if (data?.facebookPageUrl && !localStorage.getItem('library_portal_facebook_url')) {
            setFacebookUrl(data.facebookPageUrl);
          }
        }
      });

      return () => {
        unsubscribeGlobal();
        unsubscribeScience();
      };
    } catch (_) {}
  }, []);

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

        <div className="flex items-center gap-2">
          {/* Quick Guidelines Header Button */}
          <button
            onClick={() => setShowGuidelinesModal(true)}
            className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shadow-2xs active:scale-95"
            title="নির্দেশনা দেখুন"
          >
            <FileText className="w-3.5 h-3.5 text-amber-700" />
            <span>নির্দেশনা</span>
          </button>

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
        </div>
      </header>

      {/* Main Centered Flow based on the layout diagram & Landing Sections */}
      <main className="flex-1 flex flex-col items-center justify-start px-3.5 sm:px-6 py-6 sm:py-10 max-w-xl w-full mx-auto">
        <div className="w-full max-w-md flex flex-col items-center gap-3.5 sm:gap-4">

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

          {/* 🌟 5. TWO REQUESTED ACTION BUTTONS: 'নির্দেশনা' AND 'Follow Facebook' */}
          <div className="w-full grid grid-cols-2 gap-3 pt-1">
            {/* Button 1: নির্দেশনা (Instructions) */}
            <button
              type="button"
              onClick={() => setShowGuidelinesModal(true)}
              className="py-3 px-4 rounded-2xl bg-amber-50 hover:bg-amber-100/90 border border-amber-300 text-amber-900 font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-amber-700 shrink-0" />
              <span>নির্দেশনা</span>
            </button>

            {/* Button 2: Follow Facebook */}
            <a
              href={facebookUrl || 'https://facebook.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-2xl bg-[#1877F2] hover:bg-[#166fe5] border border-blue-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer text-center"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Follow Facebook</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
            </a>
          </div>

        </div>

        {/* Generous Spacing Divider before Landing Page begins */}
        <div className="w-full max-w-md my-8 sm:my-12 flex items-center justify-center gap-3">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent flex-1" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">
            লার্নিং মেথডোলজি ও ডেমো
          </span>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent flex-1" />
        </div>

        {/* 🌟 SEQUENTIAL LANDING SECTIONS (Downwards Landing Page Layout) */}
        <StudyRoomLandingSection 
          onOpenStudyRoom={onOpenStudyRoom} 
          facebookUrl={facebookUrl}
        />

      </main>

      {/* Subtle Footer */}
      <footer className="text-center py-3 text-[11px] text-slate-400">
        স্মার্ট লাইব্রেরি সিস্টেম • Memorizer-bd
      </footer>

      {/* 🌟 GUIDELINES MODAL */}
      {showGuidelinesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl text-slate-900 max-h-[85vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    লাইব্রেরি ও পোর্টাল ব্যবহারের নির্দেশনাবলী
                  </h3>
                  <p className="text-xs text-slate-500">
                    সুশৃঙ্খল ও শান্তিপূর্ণ পড়ার পরিবেশ রক্ষার্থে নিয়মাবলী
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuidelinesModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs sm:text-[13px] leading-relaxed text-slate-700">
              <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2.5">
                {(guidelines || DEFAULT_LIBRARY_CONFIG.guidelines || '')
                  .split('\n')
                  .filter(line => line.trim().length > 0)
                  .map((line, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-amber-200/70 text-amber-900 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="flex-1 text-slate-800 font-medium">{line.replace(/^[০-৯0-9]+[.\-)]\s*/, '')}</p>
                    </div>
                  ))}
              </div>

              {/* Operating Hours Note */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>কার্যক্রমের সময়সূচী:</span>
                </div>
                <p>প্রতিদিন সকাল ৮:০০ টা হতে রাত ১০:০০ টা পর্যন্ত লাইব্রেরি খোলা থাকে। রাত ১০:০০ টায় সকল সিট স্বয়ংক্রিয়ভাবে উন্মুক্ত হয়।</p>
              </div>

              {/* Follow Facebook link inside modal */}
              {facebookUrl && (
                <div className="pt-2 flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#1877F2] text-white flex items-center justify-center">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-900">আমাদের ফেসবুক কমিউনিটি</p>
                      <p className="text-[10px] text-blue-700">নিয়মিত আপডেট ও স্টাডি মেটেরিয়ালের জন্য ফলো করুন</p>
                    </div>
                  </div>
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-xs shrink-0"
                  >
                    <span>Follow</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGuidelinesModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                ঠিক আছে, বুঝেছি
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default FreshPortalHomePage;
