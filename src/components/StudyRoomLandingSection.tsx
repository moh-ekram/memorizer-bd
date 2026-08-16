import React, { useState } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  GraduationCap, 
  Layers, 
  CheckCircle2, 
  FileText, 
  TrendingUp, 
  HelpCircle, 
  Award, 
  ArrowRight, 
  Check, 
  X, 
  RotateCw, 
  Zap, 
  ChevronRight, 
  Download,
  ExternalLink,
  Target,
  Clock,
  Flame,
  Volume2,
  Table,
  Gamepad2,
  Brain,
  Library,
  Newspaper,
  ShoppingBag,
  Wallet,
  PlusCircle,
  Eye,
  Search,
  BookMarked,
  Shuffle,
  BarChart3
} from 'lucide-react';

interface StudyRoomLandingSectionProps {
  onOpenStudyRoom: () => void;
}

export const StudyRoomLandingSection: React.FC<StudyRoomLandingSectionProps> = ({ onOpenStudyRoom }) => {
  // Interactive mini-states for live demo widgets
  const [activeStoryTab, setActiveStoryTab] = useState<'english' | 'bengali' | 'vocab'>('english');
  const [activeEditorialLang, setActiveEditorialLang] = useState<'bengali' | 'english'>('bengali');
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [selectedOddOption, setSelectedOddOption] = useState<string | null>(null);
  const [showOddReason, setShowOddReason] = useState(false);
  const [selectedTableTab, setSelectedTableTab] = useState<'style1' | 'style2'>('style1');
  const [courseTabFilter, setCourseTabFilter] = useState<'all' | 'enrolled' | 'locked'>('all');
  const [practiceSubTab, setPracticeSubTab] = useState<'hub' | 'exam' | 'analytics'>('hub');
  const [storyHighlightColor, setStoryHighlightColor] = useState<'blue' | 'red' | 'green' | 'black'>('blue');
  const [selectedWordPopup, setSelectedWordPopup] = useState<{ word: string; meaning: string; syn: string; mnemonic: string } | null>(null);

  // Sample vocabulary data from PDF
  const vocabList = [
    { word: 'Maelstrom', meaning: 'ঘূর্ণাবর্ত', pos: 'noun' },
    { word: 'Nadir', meaning: 'সর্বনিম্ন বিন্দু', pos: 'noun' },
    { word: 'Nostalgia', meaning: 'অতীতস্মৃতি', pos: 'noun' },
    { word: 'Myriad', meaning: 'অসংখ্য', pos: 'adj' },
    { word: 'Writ', meaning: 'কোর্টের লিখিত আদেশ', pos: 'noun' },
    { word: 'Cereal', meaning: 'খাদ্যশস্য', pos: 'noun' },
    { word: 'Condiments', meaning: 'মশলাপাতি', pos: 'noun' },
    { word: 'Sermons', meaning: 'নৈতিক বক্তৃতা', pos: 'noun' },
    { word: 'Repast', meaning: 'আহার/খাবার', pos: 'noun' },
    { word: 'Abyss', meaning: 'অতল গহ্বর', pos: 'noun' },
    { word: 'Alabaster', meaning: 'সাদা পাথর', pos: 'noun' },
    { word: 'Hedge', meaning: 'প্রতিবন্ধক/বেষ্টনী', pos: 'noun' },
    { word: 'Derrick', meaning: 'ভার উত্তোলন যন্ত্র', pos: 'noun' },
    { word: 'Spool', meaning: 'নলী/রিল', pos: 'noun' },
    { word: 'Iota', meaning: 'সামান্যতম অংশ', pos: 'noun' }
  ];

  const vocabTableStyle1 = [
    { base: 'Affinity', syn: 'Predilection, proclivity', meaning: 'আকর্ষণ, সখ্যতা', ex: 'She had an affinity for spicy food.' },
    { base: 'Baroque', syn: 'Ornate, elaborate', meaning: 'অত্যলঙ্কৃত, জমকালো', ex: 'The baroque palace was filled with gold and marble.' },
    { base: 'Byzantine', syn: 'Convoluted, labyrinthine', meaning: 'অত্যন্ত জটিল, গোলকধাঁধাপূর্ণ', ex: 'The company\'s approval process took months.' },
    { base: 'Conciliatory', syn: 'Appeasing, placatory', meaning: 'মৈত্রীপূর্ণ, শান্ত করতে ইচ্ছুক', ex: 'Her conciliatory tone helped calm the customer.' },
    { base: 'Countenance', syn: 'Visage, demeanour', meaning: 'মুখাবয়ব, সমর্থন করা', ex: 'His grim countenance revealed displeasure.' },
    { base: 'Exhaustive', syn: 'Comprehensive, thorough', meaning: 'সম্পূর্ণ, পুঙ্খানুপুঙ্খ', ex: 'The exhaustive investigation left no stone unturned.' }
  ];

  const vocabTableStyle2 = [
    { base: 'Affinity', meaning: 'আসক্তি, মিল', syn: 'Empathy, Rapport', trap: 'Infinity (অসীমতা), Affirm (নিশ্চিত করা)' },
    { base: 'Baroque', meaning: 'অলঙ্কৃত, জাঁকালো', syn: 'Ornate, Extravagant', trap: 'Broke (দেউলিয়া), Bark (কুকুর/ঘেউ ঘেউ)' },
    { base: 'Byzantine', meaning: 'অত্যন্ত জটিল', syn: 'Complicated, Labyrinthine', trap: 'Bizarre (অদ্ভুত), Business (ব্যবসা)' },
    { base: 'Conciliatory', meaning: 'আপোষমূলক', syn: 'Appeasing, Pacifying', trap: 'Council (পরিষদ), Conceal (লুকানো)' },
    { base: 'Countenance', meaning: 'মুখাবয়ব, সমর্থন', syn: 'Face, Approval', trap: 'Maintenance (রক্ষণাবেক্ষণ), Continuance' },
    { base: 'Exhaustive', meaning: 'সর্বাঙ্গীন, পূর্ণাঙ্গ', syn: 'Comprehensive, Thorough', trap: 'Exhausting (ক্লান্তিকর), Exhaust' }
  ];

  // Exact Representation of Real Courses matching MyCoursesView.tsx
  const realCourses = [
    {
      id: 'bank_bcs_gre',
      title: 'Bank-BCS-GRE Vocab',
      wordsCount: 1108,
      price: 30,
      status: 'active', // Active Course -> Green Gradient
      tag: 'Flashcard-PDF-Story-Games',
      btnText: 'STUDY NOW'
    },
    {
      id: 'bangla_bagdhara',
      title: 'বাংলা বাগধারা',
      wordsCount: 398,
      price: 30,
      status: 'enrolled', // Enrolled Course -> Purple Gradient
      tag: 'Flashcard-PDF-Story-Games',
      btnText: 'SET ACTIVE'
    },
    {
      id: 'bangla_banan',
      title: 'বাংলা বানান শুদ্ধিকরণ',
      wordsCount: 758,
      price: 30,
      status: 'locked', // Locked Course -> Orange Gradient
      tag: 'Flashcard-PDF-Story-Games',
      btnText: 'BUY NOW'
    },
    {
      id: 'barron_333',
      title: 'Barron 333 High-Freq GRE',
      wordsCount: 328,
      price: 30,
      status: 'locked',
      tag: 'Flashcard-PDF-Story-Games',
      btnText: 'BUY NOW'
    },
    {
      id: 'one_word_sub',
      title: 'One Word Substitution',
      wordsCount: 205,
      price: 30,
      status: 'locked',
      tag: 'Flashcard-PDF-Story-Games',
      btnText: 'BUY NOW'
    },
    {
      id: 'natwa_satwa',
      title: 'ণ-ত্ব ও ষ-ত্ব বিধান (বাংলা ব্যাকরণ)',
      wordsCount: 354,
      price: 30,
      status: 'locked',
      tag: 'Flashcard-PDF-Story-Games',
      btnText: 'BUY NOW'
    }
  ];

  // Real representation of Practice Games matching PracticeCenter.tsx
  const realPracticeGames = [
    {
      key: 'quiz',
      title: 'MCQ Quiz',
      tag: 'Test Recall',
      btnText: 'Start Now',
      completed: 144,
      total: 1108,
      percent: 13,
      icon: <GraduationCap className="w-4 h-4" />
    },
    {
      key: 'match',
      title: 'Word Match',
      tag: 'Play Game',
      btnText: 'Start Play',
      completed: 88,
      total: 1108,
      percent: 8,
      icon: <Gamepad2 className="w-4 h-4" />
    },
    {
      key: 'blank',
      title: 'Blank Filling',
      tag: 'Sentence Quiz',
      btnText: 'Practice Now',
      completed: 42,
      total: 1108,
      percent: 4,
      icon: <BookOpen className="w-4 h-4" />
    },
    {
      key: 'odd_one_out',
      title: 'Odd One Out',
      tag: 'Word Selection',
      btnText: 'Play Now',
      completed: 65,
      total: 1108,
      percent: 6,
      icon: <HelpCircle className="w-4 h-4" />
    },
    {
      key: 'analogy',
      title: 'Word Analogy',
      tag: 'Logic Challenge',
      btnText: 'Solve Now',
      completed: 30,
      total: 1108,
      percent: 3,
      icon: <Shuffle className="w-4 h-4" />
    }
  ];

  const filteredCourses = realCourses.filter(c => {
    if (courseTabFilter === 'enrolled') return c.status === 'active' || c.status === 'enrolled';
    if (courseTabFilter === 'locked') return c.status === 'locked';
    return true;
  });

  return (
    <section className="w-full max-w-2xl mx-auto mt-8 sm:mt-12 space-y-8 sm:space-y-12 pb-10 text-slate-800 font-sans">
      
      {/* 🌟 HERO INTRO BANNER */}
      <div className="text-center px-3 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-bold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>মেমোরাইজার লার্নিং ইকোসিস্টেম</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
          স্মার্ট স্টাডি মেথডোলজি ও পূর্ণাঙ্গ প্র্যাকটিস
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
          গল্প, আন্তর্জাতিক সম্পাদকীয়, ফ্ল্যাশকার্ড ও ৬+ গেম প্র্যাকটিসের মাধ্যমে ভোকাবুলারি মনে রাখার আধুনিক সমাধান।
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 1: স্টোরি ও পিডিএফ এ শব্দ পড়ার সুবিধা (Exact ReadStoryView Design)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs shadow-2xs">
              ০১
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  অ্যাপ ও পিডিএফে স্টোরি থেকে শব্দ পড়ার সুবিধা
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  Contextual Learning
                </span>
              </div>
              <p className="text-[11px] text-slate-500">কনটেক্সট ও গল্পের ছলে কঠিন শব্দ মুখস্থের সহজ কৌশল</p>
            </div>
          </div>
        </div>

        {/* Story Modal-Style Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Reader Top Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[10px] font-mono font-black px-2 py-0.5 bg-indigo-500/20 text-indigo-200 rounded-full border border-indigo-400/30 shrink-0">
                Story 1 / 12
              </span>
              <h4 className="text-xs sm:text-sm font-black text-white truncate">
                The Explorer's Tale (অভিযাত্রীর উপাখ্যান)
              </h4>
            </div>

            <button
              type="button"
              onClick={() => {
                if ('speechSynthesis' in window) {
                  const utterance = new SpeechSynthesisUtterance("The explorer found himself caught in a maelstrom of emotions as he reached the nadir of his journey.");
                  utterance.lang = 'en-US';
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(utterance);
                }
              }}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer shrink-0"
              title="Voice Narration"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          {/* Reader Controls Toolbar */}
          <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500">Highlight:</span>
              {(['blue', 'red', 'green', 'black'] as const).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setStoryHighlightColor(color)}
                  className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
                    storyHighlightColor === color 
                      ? `${color === 'blue' ? 'bg-blue-600 ring-2 ring-blue-400' : color === 'red' ? 'bg-red-600 ring-2 ring-red-400' : color === 'green' ? 'bg-emerald-600 ring-2 ring-emerald-400' : 'bg-slate-900 ring-2 ring-slate-400'} scale-110` 
                      : `${color === 'blue' ? 'bg-blue-400' : color === 'red' ? 'bg-red-400' : color === 'green' ? 'bg-emerald-400' : 'bg-slate-700'} opacity-50`
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setActiveStoryTab('english')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  activeStoryTab === 'english' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setActiveStoryTab('bengali')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  activeStoryTab === 'bengali' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                বাংলা অনুবাদ
              </button>
              <button
                type="button"
                onClick={() => setActiveStoryTab('vocab')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  activeStoryTab === 'vocab' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                শব্দার্থ তালিকা
              </button>
            </div>
          </div>

          {/* Reader Content Body */}
          <div className="p-4 text-xs sm:text-[13px] leading-relaxed text-slate-800">
            {activeStoryTab === 'english' && (
              <div className="space-y-3 font-serif">
                <p>
                  The explorer found himself caught in a{' '}
                  <span 
                    onClick={() => setSelectedWordPopup({ word: 'Maelstrom', meaning: 'ঘূর্ণাবর্ত বা বিশৃঙ্খলা', syn: 'Vortex, Whirlpool, Turbulence', mnemonic: 'Mael (ঘূর্ণি) + strom (ঝড়) = উত্তাল ঘূর্ণাবর্ত।' })}
                    className={`font-bold cursor-pointer underline decoration-dotted decoration-2 ${storyHighlightColor === 'red' ? 'text-rose-600 bg-rose-50' : storyHighlightColor === 'green' ? 'text-emerald-700 bg-emerald-50' : storyHighlightColor === 'black' ? 'text-slate-900 bg-slate-100' : 'text-blue-600 bg-blue-50'} px-1 py-0.5 rounded`}
                  >
                    maelstrom
                  </span>{' '}
                  of emotions as he reached the{' '}
                  <span 
                    onClick={() => setSelectedWordPopup({ word: 'Nadir', meaning: 'সর্বনিম্ন বিন্দু বা চরম অবনতি', syn: 'Lowest point, Bottom, Rock-bottom', mnemonic: 'Nadir মানে তলদেশ (Zenith এর বিপরীত)।' })}
                    className={`font-bold cursor-pointer underline decoration-dotted decoration-2 ${storyHighlightColor === 'red' ? 'text-rose-600 bg-rose-50' : storyHighlightColor === 'green' ? 'text-emerald-700 bg-emerald-50' : storyHighlightColor === 'black' ? 'text-slate-900 bg-slate-100' : 'text-blue-600 bg-blue-50'} px-1 py-0.5 rounded`}
                  >
                    nadir
                  </span>{' '}
                  of his journey. He felt a deep{' '}
                  <span 
                    onClick={() => setSelectedWordPopup({ word: 'Nostalgia', meaning: 'অতীতস্মৃতি বা গৃহকাতরতা', syn: 'Reminiscence, Wistfulness', mnemonic: 'Nostos (বাড়ি ফেরা) + algos (বেদনা)।' })}
                    className={`font-bold cursor-pointer underline decoration-dotted decoration-2 ${storyHighlightColor === 'red' ? 'text-rose-600 bg-rose-50' : storyHighlightColor === 'green' ? 'text-emerald-700 bg-emerald-50' : storyHighlightColor === 'black' ? 'text-slate-900 bg-slate-100' : 'text-blue-600 bg-blue-50'} px-1 py-0.5 rounded`}
                  >
                    nostalgia
                  </span>{' '}
                  for home. He had seen{' '}
                  <span 
                    onClick={() => setSelectedWordPopup({ word: 'Myriad', meaning: 'অসংখ্য বা অগনিত', syn: 'Countless, Innumerable, Multitude', mnemonic: 'Myriad তারা বা অসংখ্য সৃষ্টি।' })}
                    className={`font-bold cursor-pointer underline decoration-dotted decoration-2 ${storyHighlightColor === 'red' ? 'text-rose-600 bg-rose-50' : storyHighlightColor === 'green' ? 'text-emerald-700 bg-emerald-50' : storyHighlightColor === 'black' ? 'text-slate-900 bg-slate-100' : 'text-blue-600 bg-blue-50'} px-1 py-0.5 rounded`}
                  >
                    myriad
                  </span>{' '}
                  wonders. He carried an old{' '}
                  <span 
                    onClick={() => setSelectedWordPopup({ word: 'Writ', meaning: 'আদালতের লিখিত পরোয়ানা', syn: 'Legal document, Court order, Summons', mnemonic: 'Write থেকে Writ = লিখিত আদালতের আদেশ।' })}
                    className={`font-bold cursor-pointer underline decoration-dotted decoration-2 ${storyHighlightColor === 'red' ? 'text-rose-600 bg-rose-50' : storyHighlightColor === 'green' ? 'text-emerald-700 bg-emerald-50' : storyHighlightColor === 'black' ? 'text-slate-900 bg-slate-100' : 'text-blue-600 bg-blue-50'} px-1 py-0.5 rounded`}
                  >
                    writ
                  </span>{' '}
                  from the king.
                </p>
                <p>
                  His meager provisions included dried cereal and various condiments. Each meal was a blessing as he peered into a dark abyss, knowing that even an iota of hope would sustain him through the peril.
                </p>
                <div className="text-[10px] text-slate-400 font-sans italic pt-1">
                  💡 যেকোনো হাইলাইটেড শব্দে ক্লিক করলে তাৎক্ষণিক নিমোনিক ও অর্থ পপআপ প্রদর্শিত হবে।
                </div>
              </div>
            )}

            {activeStoryTab === 'bengali' && (
              <div className="space-y-2.5 font-sans leading-relaxed text-slate-700">
                <p>
                  অভিযাত্রী নিজেকে এক মানসিক <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded">ঘূর্ণাবর্তে (Maelstrom)</span> দেখতে পেল যখন সে তার সফরের <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded">সর্বনিম্ন বিন্দুতে (Nadir)</span> পৌঁছাল। বাড়ির প্রতি তার গভীর <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded">অতীতস্মৃতি (Nostalgia)</span> কাজ করছিল। সে <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded">অসংখ্য (Myriad)</span> বিস্ময় প্রত্যক্ষ করেছে এবং রাজার কাছ থেকে পাওয়া এক প্রাচীন <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded">লিখিত আদেশ (Writ)</span> বহন করছিল।
                </p>
                <p>
                  তার সামান্য খাবারে ছিল শুকনো খাদ্যশস্য ও নানা মশলাপাতি। এক অন্ধকার অতল গহ্বরের কিনারায় দাঁড়িয়ে সে উপলব্ধি করল—এমনকি এক সামান্যতম অংশ আশাও তাকে বাঁচিয়ে রাখতে যথেষ্ট।
                </p>
              </div>
            )}

            {activeStoryTab === 'vocab' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {vocabList.slice(0, 9).map((v, i) => (
                  <div key={i} className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold text-indigo-600 block">{v.pos}</span>
                    <h5 className="font-extrabold text-xs text-slate-900">{v.word}</h5>
                    <p className="text-[11px] text-slate-600 font-medium">{v.meaning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Word Detail Mini-Popup */}
          {selectedWordPopup && (
            <div className="p-3.5 bg-indigo-950 text-white border-t border-indigo-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-amber-300 font-sans">{selectedWordPopup.word}</span>
                  <span className="text-xs text-emerald-400 font-bold">({selectedWordPopup.meaning})</span>
                </div>
                <div className="text-[11px] text-indigo-200">
                  Synonyms: <span className="text-white font-medium">{selectedWordPopup.syn}</span>
                </div>
                <div className="text-[11px] text-indigo-300 italic">
                  💡 {selectedWordPopup.mnemonic}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWordPopup(null)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0 cursor-pointer self-end sm:self-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 2: সম্পাদকীয়তে ওয়ার্ড ইনক্লুশন (Exact ReadArticleView Design)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-xs shadow-2xs">
              ০২
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  সম্পাদকীয়তে ওয়ার্ড ইনক্লুশন (এক ঢিলে দুই পাখি)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  Editorial Reader
                </span>
              </div>
              <p className="text-[11px] text-slate-500">বাংলা ও ইংরেজি সম্পাদকীয় পড়ার মাধ্যমে পরীক্ষার প্রস্তুতি</p>
            </div>
          </div>
        </div>

        {/* Editorial Article Card */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-4">
            <div className="flex items-center justify-between text-[10px] text-amber-100 font-bold uppercase tracking-wider mb-1">
              <span>National Economy & Policy</span>
              <span>5 Min Read • The Daily Star & Prothom Alo Style</span>
            </div>
            <h4 className="text-sm sm:text-base font-extrabold text-white leading-snug">
              অর্থনীতির সাম্প্রতিক ঝুঁকি মোকাবিলার পথ কী? (Navigating Macroeconomic Vulnerabilities)
            </h4>
          </div>

          {/* Lang Toggle & Controls */}
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Version:</span>
              <button
                type="button"
                onClick={() => setActiveEditorialLang('bengali')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  activeEditorialLang === 'bengali' ? 'bg-amber-500 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                বাংলা সম্পাদকীয়
              </button>
              <button
                type="button"
                onClick={() => setActiveEditorialLang('english')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  activeEditorialLang === 'english' ? 'bg-amber-500 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                English Editorial
              </button>
            </div>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              ১০+ ভোকেব অন্তর্ভুক্ত
            </span>
          </div>

          {/* Article Body */}
          <div className="p-4 text-xs sm:text-[13px] leading-relaxed text-slate-800 space-y-3">
            {activeEditorialLang === 'bengali' ? (
              <>
                <p>
                  সাম্প্রতিক বৈশ্বিক অর্থনৈতিক অনিশ্চয়তার প্রভাবে স্থানীয় বাজারে তীব্র <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">অস্থিরতা (Turbulence)</span> তৈরি হয়েছে। বিশেষজ্ঞদের মতে, নীতি প্রণয়নে দৃঢ়তা না থাকলে প্রবৃদ্ধি <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">সর্বনিম্ন বিন্দুতে (Nadir)</span> পৌঁছাতে পারে।
                </p>
                <p>
                  মুদ্রাস্ফীতির লাগাম টেনে ধরতে কেন্দ্রীয় ব্যাংককে সুনির্দিষ্ট ও কঠোর <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">নির্দেশনা (Writ)</span> জারি করতে হবে। বৈদেশিক মুদ্রার মজুদে যে <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">ঘাটতি বা অতল গহ্বর (Abyss)</span> তৈরি হয়েছে, তা পুনরুদ্ধারে রফতানি খাতে <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">অসংখ্য (Myriad)</span> সুবিধা প্রদান জরুরি।
                </p>
              </>
            ) : (
              <>
                <p>
                  The modern macroeconomic landscape is grappling with severe <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">turbulence</span> and structural bottlenecks. Without pragmatic reforms, revenue growth could plummet to its historic <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">nadir</span>.
                </p>
                <p>
                  Regulatory authorities must enforce a decisive <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">writ</span> to curb speculative forex volatility. Addressing the trade <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">abyss</span> requires unlocking <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">myriad</span> incentives for manufacturing corridors.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 3: ফ্ল্যাশকার্ড ও গ্লোবাল মেমোরি (Exact FlashcardViewer Design)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs shadow-2xs">
              ০৩
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  ফ্ল্যাশকার্ড প্র্যাকটিস ও মেমোরি রেকর্ড
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  Interactive Live Demo
                </span>
              </div>
              <p className="text-[11px] text-slate-500">স্মার্ট মেমোরি রিকল, নিমোনিক ও অ্যাক্টিভ রিভিশন সিস্টেম</p>
            </div>
          </div>
        </div>

        {/* Real Statistics Donut Gauge Card */}
        <div className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 text-center space-y-3.5 shadow-2xs">
          {/* Top Row: Total Words & Not Studied */}
          <div className="flex items-center justify-center gap-4 text-center">
            <div className="inline-flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total words
              </span>
              <span className="text-2xl font-black text-blue-600 leading-tight font-sans">
                1108
              </span>
            </div>

            <span className="text-slate-300 font-light text-xl">|</span>

            <div className="inline-flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Not studied
              </span>
              <span className="text-2xl font-black text-blue-600 leading-tight font-sans">
                0
              </span>
            </div>
          </div>

          {/* Bottom Row: 3 Donut Gauge Charts */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70">
            {/* Know Donut Chart */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="38" className="stroke-slate-200" strokeWidth="12" fill="transparent" />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="38" 
                    className="text-teal-600" 
                    strokeWidth="12" 
                    strokeDasharray="238.76" 
                    strokeDashoffset={238.76 - (238.76 * 63) / 100}
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-sans">
                    63%
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-800 mt-1 font-sans">
                Know
              </span>
            </div>

            {/* Confused Donut Chart */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="38" className="stroke-slate-200" strokeWidth="12" fill="transparent" />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="38" 
                    className="text-amber-500" 
                    strokeWidth="12" 
                    strokeDasharray="238.76" 
                    strokeDashoffset={238.76 - (238.76 * 12) / 100}
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-sans">
                    12%
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-800 mt-1 font-sans">
                Confused
              </span>
            </div>

            {/* Don't Know Donut Chart */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="38" className="stroke-slate-200" strokeWidth="12" fill="transparent" />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="38" 
                    className="text-rose-500" 
                    strokeWidth="12" 
                    strokeDasharray="238.76" 
                    strokeDashoffset={238.76 - (238.76 * 25) / 100}
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-sans">
                    25%
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-800 mt-1 font-sans">
                Don't Know
              </span>
            </div>
          </div>
        </div>

        {/* Real Flashcard Canvas Container (FlashcardViewer Design) */}
        <div className="w-full bg-slate-900 text-white rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col items-center select-none font-sans">
          
          {/* Progress Header Line */}
          <div className="w-full space-y-1 mb-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 px-0.5">
              <span>Card 1 of 964</span>
              <span className="text-emerald-400 font-bold">12% Learned <span className="text-slate-400 font-normal">(119/1108)</span></span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full w-[12%]" />
              <div className="bg-amber-400 h-full w-[5%]" />
              <div className="bg-rose-500 h-full w-[8%]" />
              <div className="bg-slate-500/50 h-full w-[75%]" />
            </div>
          </div>

          {/* 3D Flashcard Stage */}
          <div className="w-full relative perspective overflow-hidden p-0.5">
            <div
              onClick={() => setFlashcardFlipped(prev => !prev)}
              className={`relative w-full h-[390px] sm:h-[420px] z-10 cursor-pointer transform-style-3d anim-flip-h ${
                flashcardFlipped ? 'is-flipped' : ''
              }`}
            >
              {/* FRONT FACE */}
              <div className={`absolute inset-0 w-full h-full bg-white text-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 flex flex-col justify-between backface-hidden ${
                flashcardFlipped ? 'pointer-events-none' : 'pointer-events-auto'
              }`}>
                {/* Top Row: Google Search, Speaker Icon */}
                <div className="flex items-center justify-between w-full">
                  <div />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open('https://www.google.com/search?q=Abjure+meaning', '_blank');
                      }}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition shadow-xs cursor-pointer active:scale-90 flex items-center justify-center border border-slate-200"
                      title="Search on Google"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if ('speechSynthesis' in window) {
                          const utterance = new SpeechSynthesisUtterance('Abjure');
                          utterance.lang = 'en-US';
                          utterance.rate = 0.85;
                          window.speechSynthesis.cancel();
                          window.speechSynthesis.speak(utterance);
                        }
                      }}
                      className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full transition shadow-xs cursor-pointer active:scale-90"
                      title="Speak word"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Center Content: Front Face */}
                <div className="my-auto text-center space-y-2 py-4">
                  <span className="block text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                    WORD
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
                    Abjure
                  </h1>
                  {!flashcardFlipped && (
                    <div className="pt-2 flex items-center justify-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/80 shadow-2xs animate-pulse">
                        <RotateCw className="w-3 h-3 text-indigo-600" />
                        <span className="text-[11px] font-semibold tracking-tight">
                          Click to Flip
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer Response Controls */}
                <div 
                  className="pt-3 border-t border-slate-100 flex items-center justify-around w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFlashcardFlipped(true)}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition cursor-pointer select-none border bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200 active:scale-95"
                      title="Don't know"
                    >
                      <X className="w-5 h-5 stroke-[3]" />
                    </button>
                    <span className="text-[9px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                      don't know
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFlashcardFlipped(true)}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition cursor-pointer select-none border bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200 active:scale-95"
                      title="Confused"
                    >
                      <HelpCircle className="w-5 h-5 stroke-[2.5]" />
                    </button>
                    <span className="text-[9px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                      confusion
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFlashcardFlipped(prev => !prev)}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition cursor-pointer select-none active:scale-95"
                      title="Flip / Skip"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <span className="text-[9px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                      flip
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFlashcardFlipped(true)}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition cursor-pointer select-none border bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200 active:scale-95"
                      title="Learned"
                    >
                      <Check className="w-5 h-5 stroke-[3]" />
                    </button>
                    <span className="text-[9px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                      know
                    </span>
                  </div>
                </div>
              </div>

              {/* BACK FACE */}
              <div className={`absolute inset-0 w-full h-full bg-white text-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 flex flex-col justify-between backface-hidden backface-flip-h ${
                flashcardFlipped ? 'pointer-events-auto' : 'pointer-events-none'
              }`}>
                {/* Top Row: Group Badge & Tools */}
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    GROUP 3
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open('https://www.google.com/search?q=Abjure+meaning', '_blank');
                      }}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition shadow-xs cursor-pointer active:scale-90 flex items-center justify-center border border-slate-200"
                      title="Search on Google"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if ('speechSynthesis' in window) {
                          const utterance = new SpeechSynthesisUtterance('Abjure');
                          utterance.lang = 'en-US';
                          utterance.rate = 0.85;
                          window.speechSynthesis.cancel();
                          window.speechSynthesis.speak(utterance);
                        }
                      }}
                      className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full transition shadow-xs cursor-pointer active:scale-90"
                      title="Speak word"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Center Content: Back Face */}
                <div className="my-auto text-center space-y-2 py-2">
                  {/* Meaning */}
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 pb-0.5">
                      MEANING
                    </span>
                    <p className="text-xl sm:text-2xl font-black text-emerald-600 leading-snug">
                      প্রত্যাখ্যান করা বা ত্যাগ করা
                    </p>
                  </div>

                  {/* Synonyms */}
                  <div className="pt-1">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 pb-0.5">
                      SYNONYMS
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-800">
                      Renounce, Relinquish
                    </p>
                  </div>

                  {/* Example Sentence */}
                  <div className="pt-1">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 pb-0.5">
                      EXAMPLE
                    </span>
                    <p className="text-[11px] sm:text-xs text-slate-600 italic leading-relaxed">
                      The conquered ruler was forced to <span className="text-rose-600 font-bold not-italic">abjure</span> his claim to the throne.
                    </p>
                  </div>

                  {/* Mnemonic */}
                  <div className="pt-1">
                    <div className="p-2 bg-purple-50 border border-purple-100 rounded-xl text-[11px] text-purple-900 leading-snug">
                      💡 <strong>Mnemonic:</strong> Ab (বাদ) + jury (বিচারক) = বিচারকের সামনে কাজ বাদ দেওয়া।
                    </div>
                  </div>
                </div>

                {/* Card Footer Response Controls */}
                <div 
                  className="pt-3 border-t border-slate-100 flex items-center justify-around w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFlashcardFlipped(false)}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition cursor-pointer select-none border bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200 active:scale-95"
                      title="Don't know"
                    >
                      <X className="w-5 h-5 stroke-[3]" />
                    </button>
                    <span className="text-[9px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                      don't know
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFlashcardFlipped(false)}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition cursor-pointer select-none border bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200 active:scale-95"
                      title="Confused"
                    >
                      <HelpCircle className="w-5 h-5 stroke-[2.5]" />
                    </button>
                    <span className="text-[9px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                      confusion
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFlashcardFlipped(prev => !prev)}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition cursor-pointer select-none active:scale-95"
                      title="Flip"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <span className="text-[9px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                      flip
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFlashcardFlipped(false)}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition cursor-pointer select-none border bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200 active:scale-95"
                      title="Learned"
                    >
                      <Check className="w-5 h-5 stroke-[3]" />
                    </button>
                    <span className="text-[9px] font-medium text-slate-400 tracking-tight leading-none whitespace-nowrap">
                      know
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 4: সকল কোর্স ও এনরোলমেন্ট (Exact MyCoursesView Design & Codes)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xs shadow-2xs">
              ০৪
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  সকল কোর্স ও মেম্বারশিপ তালিকা
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  All Courses
                </span>
              </div>
              <p className="text-[11px] text-slate-500">ইংরেজি ও বাংলা ব্যাকরণের সম্পূর্ণ কোর্স হাব</p>
            </div>
          </div>
        </div>

        {/* 1. Exact Account Balance Wallet Card from MyCoursesView */}
        <div className="w-full bg-gradient-to-r from-[#5C53E4] via-[#675DE8] to-[#7B71F3] rounded-[24px] p-5 sm:p-6 text-white shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs sm:text-sm font-semibold text-white/95">
              Account Balance
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black italic tracking-tight text-white">
                ৳ 0
              </span>
              <span className="text-xs font-bold text-white/80 uppercase">
                BDT
              </span>
            </div>
            <p className="text-[10px] text-indigo-100">
              ওয়ালেট রিচার্জ করে যেকোনো কোর্স দ্রুত আনলক করুন
            </p>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenStudyRoom}
              className="px-3.5 py-2 rounded-xl bg-white text-[#5C53E4] hover:bg-white/90 font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#5C53E4]" />
              <span>Recharge +</span>
            </button>
            <span className="text-[9px] text-white/80 text-center font-mono">
              bKash Auto Verified
            </span>
          </div>
        </div>

        {/* 2. Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold w-fit">
          <button
            type="button"
            onClick={() => setCourseTabFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              courseTabFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Courses ({realCourses.length})
          </button>
          <button
            type="button"
            onClick={() => setCourseTabFilter('enrolled')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              courseTabFilter === 'enrolled' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Enrolled (2)
          </button>
          <button
            type="button"
            onClick={() => setCourseTabFilter('locked')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              courseTabFilter === 'locked' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Available to Buy (4)
          </button>
        </div>

        {/* 3. Real Course Cards rendered in Exact Colors and Typography from MyCoursesView */}
        <div className="space-y-2.5">
          {filteredCourses.map((course) => {
            const isActive = course.status === 'active';
            const isEnrolled = course.status === 'enrolled';

            return (
              <div
                key={course.id}
                onClick={onOpenStudyRoom}
                className={`group relative transition-all duration-300 flex flex-row items-center justify-between p-2.5 sm:p-3 px-3 sm:px-4 rounded-2xl sm:rounded-3xl gap-2.5 sm:gap-4 overflow-hidden cursor-pointer ${
                  isActive 
                    ? 'bg-gradient-to-r from-[#3C7B58] via-[#32694a] to-[#28573d] text-white shadow-md shadow-[#3C7B58]/15 hover:brightness-105' 
                    : isEnrolled
                    ? 'bg-gradient-to-r from-[#704261] via-[#603551] to-[#502942] text-white shadow-md shadow-[#704261]/15 hover:brightness-105'
                    : 'bg-gradient-to-r from-[#EF5426] via-[#e24415] to-[#ce3508] text-white shadow-md shadow-[#EF5426]/15 hover:brightness-105 ring-2 ring-orange-400/30'
                }`}
              >
                {/* Left Side: Badge Box (30 Tk) */}
                <div className={`w-11 sm:w-14 h-11 sm:h-14 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-xs text-center px-1 ${
                  isActive 
                    ? 'bg-[#E3F297] text-[#24422A]' 
                    : isEnrolled 
                    ? 'bg-[#F7C6D7] text-[#542B47]' 
                    : 'bg-[#F8F299] text-[#7E2809]'
                }`}>
                  <div className="flex items-baseline justify-center gap-0.5 leading-none">
                    <span className="text-lg sm:text-xl font-black tracking-tight leading-none">
                      {course.price}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase leading-none">
                      TK
                    </span>
                  </div>
                </div>

                {/* Middle Side: Course Info & Title */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <h3 
                    className="text-xs sm:text-sm font-extrabold text-white leading-tight truncate" 
                    title={course.title}
                  >
                    <span>{course.title}</span>
                    {!isActive && !isEnrolled && (
                      <Eye className="w-3 h-3 text-amber-200 shrink-0 inline ml-1 opacity-90" />
                    )}
                  </h3>

                  <div className="text-[10px] sm:text-[11px] font-bold text-white/95 leading-none">
                    Total {course.wordsCount} Words
                  </div>

                  <div className="text-[9px] sm:text-[10px] font-medium text-white/80 tracking-tight truncate flex items-center gap-1.5">
                    <span>{course.tag}</span>
                    {!isActive && !isEnrolled && (
                      <span className="bg-amber-300/30 text-amber-100 px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-wider shrink-0 border border-amber-300/30">
                        Preview
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Side: Divider Line & Action Button */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 self-center">
                  <div className="h-7 sm:h-9 w-[1.5px] bg-white/25 shrink-0" />

                  {isActive ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStudyRoom();
                      }}
                      className="font-black italic text-[10px] sm:text-xs text-white tracking-wider hover:scale-105 active:scale-95 transition cursor-pointer shrink-0 uppercase px-0.5 py-1"
                    >
                      STUDY NOW
                    </button>
                  ) : isEnrolled ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStudyRoom();
                      }}
                      className="font-black italic text-[10px] sm:text-xs text-white tracking-wider hover:scale-105 active:scale-95 transition cursor-pointer shrink-0 uppercase px-0.5 py-1"
                    >
                      SET ACTIVE
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenStudyRoom();
                        }}
                        className="font-black italic text-[10px] sm:text-xs text-white tracking-wider hover:scale-105 active:scale-95 transition cursor-pointer shrink-0 uppercase px-0.5 py-1"
                      >
                        BUY NOW
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenStudyRoom();
                        }}
                        className="p-1 rounded-md text-xs font-bold transition bg-white/15 text-white hover:bg-white/25"
                        title="Add to Cart"
                      >
                        <ShoppingBag className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 5: PDF-এ থাকছে বিশেষ ২ স্টাইলের ভোকাবুলারি টেবিল (PDF Page 6)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black text-xs shadow-2xs">
              ০৫
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  পিডিএফে থাকছে ২ ভিন্ন স্টাইলের ভোকাবুলারি টেবিল
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                  PDF Layouts
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Synonyms, Antonyms, Word Trap ও Example Sentence সহ</p>
            </div>
          </div>
        </div>

        {/* Table Switcher */}
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold w-fit">
          <button
            type="button"
            onClick={() => setSelectedTableTab('style1')}
            className={`px-3 py-1.5 rounded-lg transition text-center cursor-pointer ${
              selectedTableTab === 'style1'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            স্টাইল ১: Sentence & Meaning
          </button>
          <button
            type="button"
            onClick={() => setSelectedTableTab('style2')}
            className={`px-3 py-1.5 rounded-lg transition text-center cursor-pointer ${
              selectedTableTab === 'style2'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            স্টাইল ২: Word Trap Analysis
          </button>
        </div>

        {/* Responsive Table Display */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse min-w-[340px]">
            <thead>
              {selectedTableTab === 'style1' ? (
                <tr className="bg-indigo-600 text-white">
                  <th className="p-2.5 font-bold">Base Word</th>
                  <th className="p-2.5 font-bold">Synonyms</th>
                  <th className="p-2.5 font-bold">Bengali Meaning</th>
                  <th className="p-2.5 font-bold hidden sm:table-cell">Example</th>
                </tr>
              ) : (
                <tr className="bg-sky-700 text-white">
                  <th className="p-2.5 font-bold">Base Word</th>
                  <th className="p-2.5 font-bold">Meaning</th>
                  <th className="p-2.5 font-bold">Synonyms</th>
                  <th className="p-2.5 font-bold text-amber-200">Word Trap</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {selectedTableTab === 'style1' ? (
                vocabTableStyle1.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="p-2.5 font-bold text-slate-900">{row.base}</td>
                    <td className="p-2.5 text-slate-600">{row.syn}</td>
                    <td className="p-2.5 font-medium text-slate-800">{row.meaning}</td>
                    <td className="p-2.5 text-slate-500 italic hidden sm:table-cell">{row.ex}</td>
                  </tr>
                ))
              ) : (
                vocabTableStyle2.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="p-2.5 font-bold text-slate-900">{row.base}</td>
                    <td className="p-2.5 font-medium text-slate-800">{row.meaning}</td>
                    <td className="p-2.5 text-slate-600">{row.syn}</td>
                    <td className="p-2.5 text-rose-600 font-medium">{row.trap}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 6: ৬+ অনলাইন আনলিমিটেড প্র্যাকটিস ও এক্সাম মেথড (Exact PracticeCenter Design)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black text-xs shadow-2xs">
              ০৬
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  ৬+ অনলাইন আনলিমিটেড প্র্যাকটিস মেথড
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                  Practice Center
                </span>
              </div>
              <p className="text-[11px] text-slate-500">গেম ও কুইজের মাধ্যমে দ্রুত শব্দ আয়ত্ত করার সিস্টেম</p>
            </div>
          </div>
        </div>

        {/* 1. Practice Center View Mode Switcher Header from PracticeCenter.tsx */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl w-fit border border-slate-200/80">
          <button
            type="button"
            onClick={() => setPracticeSubTab('hub')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              practiceSubTab === 'hub' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Games Hub</span>
          </button>
          <button
            type="button"
            onClick={() => setPracticeSubTab('exam')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              practiceSubTab === 'exam' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Exam Hall</span>
          </button>
          <button
            type="button"
            onClick={() => setPracticeSubTab('analytics')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              practiceSubTab === 'analytics' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Tracking Dashboard</span>
          </button>
        </div>

        {/* 2. Exact PINNED FEATURED EXAM SECTION from PracticeCenter.tsx */}
        <div 
          onClick={onOpenStudyRoom}
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400/80 shadow-xl shadow-indigo-950/20 cursor-pointer group transition-all duration-300"
        >
          {/* Background ambient light effects */}
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-indigo-500/25 rounded-full blur-2xl pointer-events-none" />

          {/* Top Bar: Pinned Badge & Tag */}
          <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-full text-[10px] font-black uppercase tracking-wider shadow-2xs backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>📌 PINNED FEATURED SECTION</span>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 rounded-md border border-indigo-400/30 font-mono uppercase">
              Model Test & Exam
            </span>
          </div>

          {/* Main Content */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform duration-300">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors flex items-center gap-2">
                  <span>Online Model Test & Live Exams</span>
                </h4>
                <p className="text-xs text-slate-300 font-medium mt-0.5 leading-relaxed">
                  Course-based timed exams, negative marking, detailed results, and global merit lists.
                </p>
              </div>
            </div>

            <div className="shrink-0 pt-1 sm:pt-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenStudyRoom();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer border border-amber-300"
              >
                <span>Enter Exam Hall</span>
                <ChevronRight className="w-4 h-4 text-slate-950" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Section Divider for Regular Interactive Games */}
        <div className="flex items-center gap-3 pt-1 pb-0.5">
          <div className="h-px bg-slate-200 flex-1" />
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Gamepad2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Interactive Games & Practice</span>
          </span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        {/* 4. Real Games Cards matching exact green gradient from PracticeCenter.tsx */}
        <div className="space-y-2">
          {realPracticeGames.map((item) => (
            <div
              key={item.key}
              onClick={onOpenStudyRoom}
              className="group relative transition-all duration-300 flex flex-row items-center justify-between p-2 sm:p-2.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl gap-2.5 overflow-hidden cursor-pointer bg-gradient-to-r from-[#477B4D] to-[#5A9E60] text-white shadow-md shadow-[#477B4D]/20 hover:brightness-105 border border-white/20"
            >
              {/* Left Side: Icon Container */}
              <div className="w-8 h-8 rounded-lg sm:rounded-xl bg-white/15 border border-white/20 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-white/25 transition-all [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-white">
                {item.icon}
              </div>

              {/* Middle Side: Game Title & Progress */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <h4 className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                  {item.title}
                </h4>
                <div className="text-[10px] sm:text-[11px] font-normal text-emerald-100/90 font-mono tracking-tight">
                  {item.completed}/{item.total} Qs ({item.percent}%)
                </div>

                {/* Progress Bar Track */}
                <div className="w-full h-1 bg-black/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-300 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>

              {/* Right Side: Action Button */}
              <div className="shrink-0 ml-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenStudyRoom();
                  }}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/20 hover:bg-white text-white hover:text-[#38663D] font-extrabold text-[10px] sm:text-xs transition flex items-center gap-0.5 cursor-pointer border border-white/30 shadow-2xs"
                >
                  <span>{item.btnText}</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 5. Live Interactive Game Demo: Odd One Out with instant Bengali Reason */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-indigo-600" />
              <span>লাইভ গেম ডেমো: নিচের কোনটি অন্যদের থেকে আলাদা? (Odd One Out)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-bold">Demo Q1</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'A', text: 'Congenial', isCorrect: true, bengaliMeaning: 'বন্ধুভাবাপন্ন / আনন্দদায়ক' },
              { id: 'B', text: 'Austere', isCorrect: false, bengaliMeaning: 'কঠোর / অনারম্বর' },
              { id: 'C', text: 'Stern', isCorrect: false, bengaliMeaning: 'কঠিন / গম্ভীর' },
              { id: 'D', text: 'Spartan', isCorrect: false, bengaliMeaning: 'অত্যন্ত সাদামাটা ও কঠোর' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSelectedOddOption(opt.id);
                  setShowOddReason(true);
                }}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                  selectedOddOption === opt.id
                    ? opt.isCorrect
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'bg-rose-50 border-rose-400 text-rose-800'
                    : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300'
                }`}
              >
                <div>
                  <span className="text-slate-400 mr-1.5 font-mono">({opt.id})</span>
                  <span>{opt.text}</span>
                  <span className="block text-[10px] text-slate-500 font-normal">{opt.bengaliMeaning}</span>
                </div>
                {selectedOddOption === opt.id && (
                  opt.isCorrect ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <X className="w-4 h-4 text-rose-600 shrink-0" />
                )}
              </button>
            ))}
          </div>

          {showOddReason && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1 animate-fadeIn">
              <div className="font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>সঠিক উত্তর: (A) Congenial</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                <strong>ব্যাখ্যা:</strong> Austere, Stern এবং Spartan—এই তিনটি শব্দের অর্থই ‘কঠোর, অনারম্বর বা গুরুগম্ভীর’। পক্ষান্তরে Congenial শব্দের অর্থ ‘বন্ধুভাবাপন্ন বা মনোরম’, যা বাকি তিনটি শব্দের বিপরীত ভাব প্রকাশ করে।
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          BOTTOM CALL TO ACTION (CTA)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="text-center p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white rounded-3xl shadow-xl space-y-3">
        <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
          এখনই শুরু করুন স্মার্ট মেমোরাইজার স্টাডি রুম
        </h3>
        <p className="text-xs sm:text-sm text-emerald-100 max-w-md mx-auto leading-relaxed">
          ফ্ল্যাশকার্ড, কুইজ, ব্যাকরণ ও সম্পাদকীয় পড়ার মাধ্যমে ভোকাবুলারি আয়ত্তে এনে জব পরীক্ষায় এগিয়ে থাকুন।
        </p>
        <button
          type="button"
          onClick={onOpenStudyRoom}
          className="mt-2 px-6 py-3 rounded-full bg-white text-emerald-800 font-black text-xs sm:text-sm shadow-lg hover:bg-emerald-50 transition active:scale-95 inline-flex items-center gap-2 cursor-pointer"
        >
          <span>স্টাডি রুমে প্রবেশ করুন</span>
          <ArrowRight className="w-4 h-4 text-emerald-700" />
        </button>
      </div>

    </section>
  );
};

export default StudyRoomLandingSection;
