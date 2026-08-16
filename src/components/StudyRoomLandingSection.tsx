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
  Newspaper
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
  const [selectedMcqOption, setSelectedMcqOption] = useState<string | null>(null);
  const [selectedTableTab, setSelectedTableTab] = useState<'style1' | 'style2'>('style1');

  // Sample data from PDF
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

  const coursesList = [
    { title: 'বাংলা বাগধারা', count: '৩৯৮ Words', tag: 'ফ্রি এক্সেস', color: 'emerald' },
    { title: 'Bank-BCS-GRE Vocab', count: '১১০৮ Words', tag: 'পপুলার', color: 'indigo' },
    { title: 'Barron 333 High-Freq', count: '৩২৮ Words', tag: 'GRE স্পেশাল', color: 'purple' },
    { title: 'বাংলা বানান শুদ্ধিকরণ', count: '৭৫৮ Words', tag: 'বিসিএস প্রিলি', color: 'emerald' },
    { title: 'One Word Substitution', count: '২০৫ Words', tag: 'জব এক্সাম', color: 'amber' },
    { title: 'BCS Question Bank', count: '৭৫৯ Words', tag: 'সল্যুশন', color: 'rose' },
    { title: 'Idioms and Phrases', count: '৮২৬ Words', tag: 'গ্রামার', color: 'indigo' },
    { title: 'ণ-ত্ব ও ষ-ত্ব বিধান', count: '৩৫৪ Words', tag: 'বাংলা ব্যাকরণ', color: 'emerald' },
    { title: 'সকল সমাস নির্ণয়', count: '৫১৪ Words', tag: 'বাংলা ব্যাকরণ', color: 'purple' },
    { title: 'IELTS Core Vocab', count: '১৩৮৮ Words', tag: 'প্রিমিয়াম', color: 'blue' },
    { title: 'Previous Year Vocabulary', count: '৩০৯ Words', tag: 'বিগত সাল', color: 'amber' }
  ];

  const practiceMethods = [
    { title: 'MCQ Quiz', count: '১৪৪/১১০৮ Qs', badge: 'স্পিড টেস্ট', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { title: 'Word Match', count: '১৪৪/১১০৮ Qs', badge: 'ম্যাচিং গেম', icon: Zap, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { title: 'Synonym Check', count: '১১০৮ Qs', badge: 'সমার্থক শব্দ', icon: Layers, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { title: 'Blank Filling', count: 'শূন্যস্থান পূরণ', badge: 'কনটেক্সট প্র্যাকটিস', icon: FileText, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { title: 'Word Analogy', count: 'অ্যানালজি টেস্ট', badge: 'লজিক্যাল স্কিল', icon: Brain, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    { title: 'Odd One Out', count: 'ভিন্ন শব্দটি খুঁজুন', badge: 'ব্রেইন গেম', icon: Target, color: 'text-teal-600 bg-teal-50 border-teal-200' }
  ];

  return (
    <section className="w-full max-w-2xl mx-auto mt-8 sm:mt-12 space-y-8 sm:space-y-12 pb-10 text-slate-800">
      
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
          SECTION 1: স্টোরি ও পিডিএফ এ শব্দ পড়ার সুবিধা (PDF Page 1)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              ০১
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                অ্যাপ ও পিডিএফে স্টোরি থেকে শব্দ পড়ার সুবিধা
              </h3>
              <p className="text-[11px] text-slate-500">কনটেক্সট ও গল্পের ছলে কঠিন শব্দ মুখস্থের সহজ কৌশল</p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 bg-slate-100/90 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveStoryTab('english')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              activeStoryTab === 'english'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English Text
          </button>
          <button
            type="button"
            onClick={() => setActiveStoryTab('bengali')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              activeStoryTab === 'bengali'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bengali Translation
          </button>
          <button
            type="button"
            onClick={() => setActiveStoryTab('vocab')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              activeStoryTab === 'vocab'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Word Meaning
          </button>
        </div>

        {/* Segment Content */}
        {activeStoryTab === 'english' && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 text-xs sm:text-[13px] leading-relaxed text-slate-800 space-y-2.5 font-serif">
            <h4 className="font-sans font-bold text-xs text-indigo-900 border-b border-slate-200 pb-1">
              Story: The Explorer's Tale
            </h4>
            <p>
              The explorer found himself caught in a <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">maelstrom</span> of emotions as he reached the <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">nadir</span> of his journey. He felt a deep <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">nostalgia</span> for home. He had seen <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">myriad</span> wonders. He carried an old <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">writ</span> from the king.
            </p>
            <p>
              His provisions included dried <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">cereal</span> and various <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">condiments</span>. He often recalled the wise <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">sermons</span> of his youth. Each meager <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">repast</span> was a blessing. He peered into a dark <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">abyss</span>.
            </p>
            <p>
              He discovered ancient ruins made of gleaming <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">alabaster</span>. A dense <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">hedge</span> blocked his path. He used a makeshift <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">derrick</span> to lift heavy stones. He unwound a long rope from a wooden <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">spool</span>. He realized that even an <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">iota</span> of hope was enough to continue.
            </p>
          </div>
        )}

        {activeStoryTab === 'bengali' && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 text-xs sm:text-[13px] leading-relaxed text-slate-800 space-y-2.5">
            <h4 className="font-bold text-xs text-indigo-900 border-b border-slate-200 pb-1">
              গল্পের বাংলা অনুবাদ (ওয়ার্ড ইনসার্ট সহ)
            </h4>
            <p>
              অভিযাত্রী নিজেকে আবেগের এক <strong className="text-rose-600 bg-rose-50 px-1 rounded">maelstrom-এ</strong> আটকে পড়া অবস্থায় দেখতে পেলেন যখন তিনি তাঁর ভ্রমণের <strong className="text-rose-600 bg-rose-50 px-1 rounded">nadir-এ</strong> পৌঁছালেন। তিনি বাড়ির জন্য গভীর <strong className="text-rose-600 bg-rose-50 px-1 rounded">nostalgia</strong> অনুভব করছিলেন। তিনি <strong className="text-rose-600 bg-rose-50 px-1 rounded">myriad</strong> বিস্ময়কর জিনিস দেখেছিলেন। তাঁর কাছে রাজার দেওয়া একটি পুরোনো <strong className="text-rose-600 bg-rose-50 px-1 rounded">writ</strong> ছিল।
            </p>
            <p>
              তাঁর রসদের মধ্যে ছিল শুকনো <strong className="text-rose-600 bg-rose-50 px-1 rounded">cereal</strong> এবং বিভিন্ন ধরনের <strong className="text-rose-600 bg-rose-50 px-1 rounded">condiments</strong>। তিনি প্রায়ই তাঁর যৌবনের সেই জ্ঞানী ব্যক্তিদের <strong className="text-rose-600 bg-rose-50 px-1 rounded">sermons-এর</strong> কথা মনে করতেন। প্রতিটি সামান্য <strong className="text-rose-600 bg-rose-50 px-1 rounded">repast</strong> ছিল তাঁর কাছে এক একটি আশীর্বাদ। তিনি এক অন্ধকার <strong className="text-rose-600 bg-rose-50 px-1 rounded">abyss-এর</strong> দিকে তাকালে চকচকে <strong className="text-rose-600 bg-rose-50 px-1 rounded">alabaster</strong> দিয়ে তৈরি প্রাচীন ধ্বংসাবশেষ আবিষ্কার করলেন।
            </p>
            <p>
              একটি ঘন <strong className="text-rose-600 bg-rose-50 px-1 rounded">hedge</strong> তাঁর পথ আটকে দিয়েছিল। ভারী পাথর তোলার জন্য তিনি একটি অস্থায়ী <strong className="text-rose-600 bg-rose-50 px-1 rounded">derrick</strong> ব্যবহার করেছিলেন। তিনি একটি কাঠের <strong className="text-rose-600 bg-rose-50 px-1 rounded">spool</strong> থেকে লম্বা দড়ি খুলেছিলেন। তিনি উপলব্ধি করতে পেরেছিলেন যে, যাত্রায় টিকে থাকার জন্য সামান্যতম <strong className="text-rose-600 bg-rose-50 px-1 rounded">iota</strong> পরিমাণ আশাই যথেষ্ট।
            </p>
          </div>
        )}

        {activeStoryTab === 'vocab' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {vocabList.map((item, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 flex flex-col justify-between">
                <span className="text-xs font-bold text-indigo-900">{item.word}</span>
                <span className="text-[11px] text-slate-600 mt-0.5">{item.meaning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 2: সম্পাদকীয়তে ওয়ার্ড ইনক্লুশন (PDF Page 3)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
              ০২
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  সম্পাদকীয়তে ওয়ার্ড ইনক্লুশন (এক ঢিলে দুই পাখি)
                </h3>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                  Editorial
                </span>
              </div>
              <p className="text-[11px] text-slate-500">চলতি সংবাদ ও সম্পাদকীয় পাঠের সাথে ইংরেজি ভোকেব শেখা</p>
            </div>
          </div>
        </div>

        {/* Editorial Lang Switch */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Newspaper className="w-3.5 h-3.5 text-amber-600" />
            <span>অর্থনীতির সাম্প্রতিক ঝুঁকি মোকাবিলার পথ কী</span>
          </span>
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveEditorialLang('bengali')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                activeEditorialLang === 'bengali'
                  ? 'bg-amber-500 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              বাংলা সম্পাদকীয়
            </button>
            <button
              type="button"
              onClick={() => setActiveEditorialLang('english')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                activeEditorialLang === 'english'
                  ? 'bg-amber-500 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English Version
            </button>
          </div>
        </div>

        {/* Editorial Box */}
        {activeEditorialLang === 'bengali' ? (
          <div className="bg-amber-50/40 border border-amber-200/70 rounded-xl p-3.5 sm:p-4 text-xs sm:text-[13px] leading-relaxed text-slate-800 space-y-2">
            <p>
              সম্প্রতি প্রকাশিত অর্থ মন্ত্রণালয়ের 'মধ্যমেয়াদি সামষ্টিক অর্থনৈতিক নীতি বিবৃতি' কেবল একটি সাধারণ নীতিগত দলিল নয়, এটি দেশের অর্থনীতির বর্তমান বাস্তবতারও একটি গুরুত্বপূর্ণ <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded">veracity</strong>। কারণ, এটি প্রথমবারের মতো অর্থনীতির ঝুঁকিগুলোকে স্পষ্টভাবে শুধু স্বীকারই করেনি, বরং সরকারি নথিতেই স্পষ্টভাবে তুলে ধরেছে যে উচ্চ মূল্যস্ফীতি, <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded">sluggish</strong> প্রবৃদ্ধি, দুর্বল রাজস্ব আহরণ, বৈদেশিক খাতের চাপ ও রাষ্ট্রায়ত্ত প্রতিষ্ঠানের বিপুল দায় পুরো অর্থনীতিকে চাপে ফেলতে পারে।
            </p>
            <p>
              এই উদ্বেগজনক সামষ্টিক অর্থনৈতিক সূচকগুলো আমাদের অতীতের সব আশাবাদী দাবিকে <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded">belie</strong> করে। এই সময়ে সবচেয়ে বড় প্রয়োজন সঠিক রোগনির্ণয়ের পাশাপাশি <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded">efficacious</strong> ও <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded">remedial</strong> সমাধান। অর্থনীতি এখন অত্যন্ত <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded">volatile</strong> পরিস্থিতিতে রয়েছে, যা দীর্ঘস্থায়ী হলে কর্মসংস্থান ও বিনিয়োগের ক্ষেত্রে <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded">debilitating</strong> ও <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded">inimical</strong> প্রভাব ফেলবে।
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4 text-xs sm:text-[13px] leading-relaxed text-slate-800 space-y-2 font-serif">
            <p>
              The recently published 'Medium-Term Macroeconomic Policy Statement' by the Ministry of Finance is not merely a routine policy document; it is a vital reflection of the <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded font-sans">veracity</strong> of our current economic reality. For the first time, it has acknowledged economic risks and highlighted official files that high inflation, <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded font-sans">sluggish</strong> growth, and weak revenue mobilization pressure the economy.
            </p>
            <p>
              These alarming macroeconomic indicators heavily <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded font-sans">belie</strong> any superficial claims of a smooth recovery. What is needed now is an <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded font-sans">efficacious</strong> diagnosis along with a <strong className="text-rose-600 bg-white border border-rose-200 px-1 rounded font-sans">remedial</strong> solution.
            </p>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 3: ইন্টারেক্টিভ ফ্ল্যাশকার্ড ও গ্লোবাল মেমোরি (PDF Page 2 & 4)
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

        {/* 🌟 1. Real Statistics Donut Chart Card (from FlashcardViewer) */}
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

        {/* 🌟 2. Real Flashcard Canvas Container (Direct FlashcardViewer Design) */}
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
              className={`relative w-full h-[400px] sm:h-[430px] z-10 cursor-pointer transform-style-3d anim-flip-h ${
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
                    <p className="text-xl sm:text-2xl font-black text-emerald-600 font-bengali leading-snug">
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
          SECTION 4: সকল কোর্স ও এনরোলমেন্ট (PDF Page 5)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
              ০৪
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  চাকরিপ্রার্থীদের বিশেষ সুবিধা
                </h3>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  All Courses
                </span>
              </div>
              <p className="text-[11px] text-slate-500">ইংরেজি ও বাংলা ব্যাকরণের সকল কোর্স এক প্ল্যাটফর্মে</p>
            </div>
          </div>
        </div>

        {/* Grid of Courses */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {coursesList.map((course, idx) => (
            <div 
              key={idx} 
              className="bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/90 rounded-xl p-2.5 flex flex-col justify-between transition cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white text-indigo-700 border border-slate-200">
                    {course.tag}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {course.count}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition leading-snug line-clamp-1">
                  {course.title}
                </h4>
              </div>
              <div className="mt-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-bold text-indigo-600">
                <span>প্র্যাকটিস শুরু</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 5: PDF-এ থাকছে বিশেষ ২ স্টাইলের ভোকাবুলারি টেবিল (PDF Page 6)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-xs">
              ০৫
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                পিডিএফে থাকছে ২ ভিন্ন স্টাইলের ভোকাবুলারি টেবিল
              </h3>
              <p className="text-[11px] text-slate-500">Synonyms, Antonyms, Word Trap ও Example Sentence সহ</p>
            </div>
          </div>
        </div>

        {/* Table Switcher */}
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSelectedTableTab('style1')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              selectedTableTab === 'style1'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            স্টাইল ১: Sentence & Meaning
          </button>
          <button
            type="button"
            onClick={() => setSelectedTableTab('style2')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              selectedTableTab === 'style2'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            স্টাইল ২: Word Trap Analysis
          </button>
        </div>

        {/* Responsive Table Display */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse min-w-[340px]">
            <thead>
              {selectedTableTab === 'style1' ? (
                <tr className="bg-indigo-600 text-white">
                  <th className="p-2 font-bold">Base Word</th>
                  <th className="p-2 font-bold">Synonyms</th>
                  <th className="p-2 font-bold">Bengali Meaning</th>
                  <th className="p-2 font-bold hidden sm:table-cell">Example</th>
                </tr>
              ) : (
                <tr className="bg-sky-700 text-white">
                  <th className="p-2 font-bold">Base Word</th>
                  <th className="p-2 font-bold">Meaning</th>
                  <th className="p-2 font-bold">Synonyms</th>
                  <th className="p-2 font-bold text-amber-200">Word Trap</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {selectedTableTab === 'style1' ? (
                vocabTableStyle1.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="p-2 font-bold text-slate-900">{row.base}</td>
                    <td className="p-2 text-slate-600">{row.syn}</td>
                    <td className="p-2 font-medium text-slate-800">{row.meaning}</td>
                    <td className="p-2 text-slate-500 italic hidden sm:table-cell">{row.ex}</td>
                  </tr>
                ))
              ) : (
                vocabTableStyle2.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="p-2 font-bold text-slate-900">{row.base}</td>
                    <td className="p-2 font-medium text-slate-800">{row.meaning}</td>
                    <td className="p-2 text-slate-600">{row.syn}</td>
                    <td className="p-2 text-rose-600 font-medium">{row.trap}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 6: ৬+ অনলাইন আনলিমিটেড প্র্যাকটিস ও এক্সাম মেথড (PDF Page 8 & 9)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              ০৬
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  ৬+ অনলাইন আনলিমিটেড প্র্যাকটিস মেথড
                </h3>
                <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-bold">
                  Interactive
                </span>
              </div>
              <p className="text-[11px] text-slate-500">গেম ও কুইজের মাধ্যমে দ্রুত শব্দ আয়ত্ত করার সিস্টেম</p>
            </div>
          </div>
        </div>

        {/* 6 Methods Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {practiceMethods.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className={`p-1 rounded-lg border ${m.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">{m.badge}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900">{m.title}</h4>
                <span className="text-[10px] text-slate-500 mt-0.5">{m.count}</span>
              </div>
            );
          })}
        </div>

        {/* Interactive Live Demo: Odd One Out with Explanation */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-indigo-600" />
              <span>লাইভ ডেমো: নিচের কোনটি অন্যদের থেকে আলাদা? (Odd One Out)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Demo Q1</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'A', text: 'Congenial', isCorrect: true },
              { id: 'B', text: 'Austere', isCorrect: false },
              { id: 'C', text: 'Stern', isCorrect: false },
              { id: 'D', text: 'Spartan', isCorrect: false },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSelectedOddOption(opt.id);
                  setShowOddReason(true);
                }}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                  selectedOddOption === opt.id
                    ? opt.isCorrect
                      ? 'bg-emerald-500 text-white border-emerald-600'
                      : 'bg-rose-500 text-white border-rose-600'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <span>{opt.id}. {opt.text}</span>
                {selectedOddOption === opt.id && (
                  opt.isCorrect ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />
                )}
              </button>
            ))}
          </div>

          {showOddReason && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1 text-emerald-950">
              <p className="font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>সঠিক উত্তর: A. Congenial (বন্ধুভাবাপন্ন/অনুকূল)</span>
              </p>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                <strong>ব্যাখ্যা:</strong> Austere, Stern এবং Spartan তিনটি শব্দই 'কঠোর / কঠোর নীতিপরায়ণ' অর্থ প্রকাশ করে। শুধুমাত্র Congenial শব্দটি 'অনুকূল বা বন্ধুত্বসুলভ' যা অন্যদের চেয়ে আলাদা।
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          BOTTOM CALL TO ACTION (Takes User to Study Room Directly)
      ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 rounded-3xl p-5 sm:p-7 text-white text-center space-y-3 shadow-lg shadow-indigo-600/25">
        <GraduationCap className="w-10 h-10 mx-auto text-indigo-200" />
        <h3 className="text-lg sm:text-xl font-black">
          আজই স্টাডি রুমে জয়েন করে শুরু করুন প্রস্তুতি!
        </h3>
        <p className="text-xs sm:text-sm text-indigo-100 max-w-md mx-auto leading-relaxed">
          ফ্ল্যাশকার্ড, লাইভ প্র্যাকটিস ও বিগত সালের পরীক্ষার প্রশ্নসমূহ সমাধান করতে স্টাডি রুমে প্রবেশ করুন।
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenStudyRoom}
            className="px-6 py-3 bg-white hover:bg-slate-100 text-indigo-700 font-extrabold text-sm rounded-full shadow-md transition active:scale-95 cursor-pointer inline-flex items-center gap-2"
          >
            <span>স্টাডি রুমে প্রবেশ করুন (Memorizer-bd)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </section>
  );
};
