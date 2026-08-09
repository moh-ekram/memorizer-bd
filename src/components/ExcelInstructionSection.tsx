import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Sparkles,
  Layers,
  HelpCircle
} from 'lucide-react';
import { downloadMultiSheetCourseTemplate } from '../lib/gameExcelUtils';

interface ExcelInstructionSectionProps {
  className?: string;
  defaultExpanded?: boolean;
}

export const ExcelInstructionSection: React.FC<ExcelInstructionSectionProps> = ({
  className = '',
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'words' | 'blank' | 'ooo' | 'analogy' | 'mcq'>('words');

  return (
    <div className={`bg-gradient-to-b from-indigo-50/70 to-slate-50 border border-indigo-200/80 rounded-2xl overflow-hidden shadow-2xs font-sans ${className}`}>
      {/* Accordion Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-indigo-100/50 transition bg-indigo-50/50 select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-tight">
                একই এক্সেল ফাইলে কোর্স ও গেমস এড নির্দেশিকা (Sheet & Column Guide)
              </h4>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-full uppercase tracking-wider hidden sm:inline-flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Multi-Sheet Supported
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              আলাদা আলাদা শিটে শব্দাবলী ও গেমের প্রশ্ন একসাথে আপলোড করতে পারবেন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              downloadMultiSheetCourseTemplate();
            }}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Download full multi-sheet template file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">মাস্টার এক্সেল ডেমো ডাউনলোড</span>
            <span className="md:hidden">স্যাম্পল .xlsx</span>
          </button>

          <button 
            type="button"
            className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-500 transition"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 border-t border-indigo-100/80 space-y-4 animate-fade-in text-slate-700 text-xs">
          {/* Overview Note */}
          <div className="p-3 bg-white border border-indigo-100 rounded-xl flex items-start gap-2.5 text-slate-600 shadow-2xs">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold leading-relaxed">
                আপনার ওয়ার্কবুক/এক্সেল ফাইলে নিচের শিটের নামগুলো (Sheet Names) ব্যবহার করে একাধিক শিট রাখতে পারেন। সিস্টেম স্বয়ংক্রিয়ভাবে প্রতি শিট শনাক্ত করে ডাটাবেজে সংরক্ষণ করে নেবে।
              </p>
              <p className="text-[10px] text-indigo-700 font-mono">
                💡 টিপস: আপনি শুধু ১টি শিটে শব্দ বা গেমও আপলোড করতে পারেন, আবার ১টি ফাইলেই ৫টি শিট যুক্ত করতে পারেন।
              </p>
            </div>
          </div>

          {/* Tab Navigation for Sheets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('words')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'words'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>১. শব্দাবলী (Words)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('blank')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'blank'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>২. শূন্যস্থান পূরণ (Blank)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ooo')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'ooo'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>৩. বেমানান শব্দ (Odd One Out)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analogy')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'analogy'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>৪. শব্দ সাদৃশ্য (Analogy)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('mcq')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'mcq'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>৫. এমসিকিউ কুইজ (MCQ)</span>
            </button>
          </div>

          {/* Tab Content 1: Vocabulary Words */}
          {activeTab === 'words' && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">
                    ১. শব্দাবলী শিট (Vocabulary Words Sheet)
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    গ্রহণযোগ্য শিট নাম (Sheet Names): <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono">Words</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono">Vocabulary</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono">Wordlist</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono">শব্দাবলি</code> (অথবা ১ম শিট)
                  </p>
                </div>
              </div>

              <div>
                <p className="font-extrabold text-slate-800 text-[11px] mb-1.5">
                  সমর্থিত কলাম হেডার (Column Formats - একাধিক ফরম্যাট সমর্থন করে):
                </p>
                <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside pl-1 font-medium leading-relaxed">
                  <li>
                    <strong className="text-slate-900">Unique ID (আইডি):</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">id</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">unique id</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">uid</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">sl</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">serial</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">word id</code> (আবশ্যিক ইউনিক কোড)
                  </li>
                  <li>
                    <strong className="text-slate-900">Main Word (মূল শব্দ):</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">word</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">main word</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">english word</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">শব্দ</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">🔍 word</code>
                  </li>
                  <li>
                    <strong className="text-slate-900">Bangla Meaning (বাংলা অর্থ):</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">meaning</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">bangla meaning</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">bengali meaning</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">অর্থ</code>
                  </li>
                  <li>
                    <strong className="text-slate-900">Group / Level (গ্রুপ):</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">group</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">level</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">গ্ৰুপ</code> (যেমন: 1, 2, 3...)
                  </li>
                  <li>
                    <strong className="text-slate-900">Synonyms (সমার্থক শব্দ):</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">synonyms</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">synonym</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">synonym1</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">synonym2</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">সমার্থক শব্দ</code>
                  </li>
                  <li>
                    <strong className="text-slate-900">Extra Word & Meaning:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">extra word</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">extra meaning</code>
                  </li>
                  <li>
                    <strong className="text-slate-900">Example Sentence (উদাহরণ বাক্য):</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">example</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">example sentence</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">উদাহরণ</code>
                  </li>
                  <li>
                    <strong className="text-slate-900">Mnemonic Note (নেমোনিক নোট):</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">mnemonic</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">note</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">personal notes</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">নেমোনিক</code>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab Content 2: Blank Filling */}
          {activeTab === 'blank' && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">
                    ২. শূন্যস্থান পূরণ গেম শিট (Blank Filling Questions)
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    গ্রহণযোগ্য শিট নাম (Sheet Names): <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-700 font-mono">Blank_Questions</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-700 font-mono">Fill Blanks</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-700 font-mono">Blank</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-700 font-mono">শূন্যস্থান</code>
                  </p>
                </div>
              </div>

              <div>
                <p className="font-extrabold text-slate-800 text-[11px] mb-1.5">
                  সমর্থিত কলাম হেডার (Column Formats):
                </p>
                <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside pl-1 font-medium leading-relaxed">
                  <li>
                    <strong className="text-slate-900">Unique ID:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Unique ID</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">id</code> (ঐচ্ছিক - না দিলে অটো আইডি জেনারেট হবে)
                  </li>
                  <li>
                    <strong className="text-slate-900">Sentence / Question:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Sentence</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Question</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Sentence / Question</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">বাক্য</code>
                  </li>
                  <li>
                    <strong className="text-slate-900">Option Columns:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Option 1</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Option 2</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Option 3</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Option 4</code> (কমপক্ষে ২টি বা ৪টি অপশন)
                  </li>
                  <li>
                    <strong className="text-slate-900">Correct Answer:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Answer</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Correct Option</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">উত্তর</code> (সঠিক অপশনের মূল লেখা, অথবা অপশন নম্বর 1,2,3,4, অথবা অপশন লেখার পাশে `#` হ্যাশ চিহ্ন দেওয়া, যেমন: <code className="text-emerald-700 font-mono">soporific#</code>)
                  </li>
                  <li>
                    <strong className="text-slate-900">Explanation:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Explanation</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Reason</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">ব্যাখ্যা</code> (ঐচ্ছিক)
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab Content 3: Odd One Out */}
          {activeTab === 'ooo' && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">
                    ৩. বেমানান শব্দ গেম শিট (Odd One Out Questions)
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    গ্রহণযোগ্য শিট নাম (Sheet Names): <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sky-700 font-mono">Odd_One_Out</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sky-700 font-mono">OOO</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sky-700 font-mono">Odd Word</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sky-700 font-mono">ব্যতিক্রমী শব্দ</code>
                  </p>
                </div>
              </div>

              <div>
                <p className="font-extrabold text-slate-800 text-[11px] mb-1.5">
                  সমর্থিত কলাম হেডার (Column Formats):
                </p>
                <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside pl-1 font-medium leading-relaxed">
                  <li>
                    <strong className="text-slate-900">Unique ID:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Unique ID</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">id</code> (ঐচ্ছিক)
                  </li>
                  <li>
                    <strong className="text-slate-900">4 Words Columns:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Word 1</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Word 2</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Word 3</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Word 4</code> (ঠিক ৪টি শব্দ প্রদান করতে হবে)
                  </li>
                  <li>
                    <strong className="text-slate-900">Odd Word / Answer:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Odd Word / Answer</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Answer</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">উত্তর</code> (বেমানান শব্দটির নাম অথবা অপশন নম্বর 1-4)
                  </li>
                  <li>
                    <strong className="text-slate-900">Explanation:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Explanation</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Reason</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">ব্যাখ্যা</code> (ঐচ্ছিক)
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab Content 4: Word Analogy */}
          {activeTab === 'analogy' && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">
                    ৪. শব্দ সাদৃশ্য গেম শিট (Word Analogy Questions)
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    গ্রহণযোগ্য শিট নাম (Sheet Names): <code className="bg-slate-100 px-1.5 py-0.5 rounded text-purple-700 font-mono">Word_Analogy</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-purple-700 font-mono">Analogy</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-purple-700 font-mono">সাদৃশ্য</code>
                  </p>
                </div>
              </div>

              <div>
                <p className="font-extrabold text-slate-800 text-[11px] mb-1.5">
                  সমর্থিত কলাম হেডার (Column Formats):
                </p>
                <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside pl-1 font-medium leading-relaxed">
                  <li>
                    <strong className="text-slate-900">Unique ID:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Unique ID</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">id</code> (ঐচ্ছিক)
                  </li>
                  <li>
                    <strong className="text-slate-900">Target Pair (Stem):</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Target Pair (Stem)</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Analogy</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">সাদৃশ্য জোড়</code> (যেমন: <code className="text-purple-700 font-mono">LIGHT : BLIND</code>)
                  </li>
                  <li>
                    <strong className="text-slate-900">Option Pairs:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Option 1 Pair</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Option 2 Pair</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Option 3 Pair</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Option 4 Pair</code> (যেমন: <code className="text-purple-700 font-mono">speech : deaf</code>)
                  </li>
                  <li>
                    <strong className="text-slate-900">Correct Answer:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Correct Answer Pair</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Answer</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">উত্তর</code>
                  </li>
                  <li>
                    <strong className="text-slate-900">Explanation:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Explanation</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Reason</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">ব্যাখ্যা</code>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab Content 5: MCQ Questions */}
          {activeTab === 'mcq' && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">
                    ৫. এমসিকিউ কুইজ গেম শিট (MCQ Quiz Questions)
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    গ্রহণযোগ্য শিট নাম (Sheet Names): <code className="bg-slate-100 px-1.5 py-0.5 rounded text-amber-700 font-mono">MCQ_Questions</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-amber-700 font-mono">MCQ</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-amber-700 font-mono">Quiz</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-amber-700 font-mono">এমসিকিউ</code>
                  </p>
                </div>
              </div>

              <div>
                <p className="font-extrabold text-slate-800 text-[11px] mb-1.5">
                  সমর্থিত কলাম হেডার (Column Formats):
                </p>
                <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside pl-1 font-medium leading-relaxed">
                  <li>
                    <strong className="text-slate-900">Unique ID:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Unique ID</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">id</code> (ঐচ্ছিক)
                  </li>
                  <li>
                    <strong className="text-slate-900">Question Text:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Question Text</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Question</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">প্রশ্ন</code>
                  </li>
                  <li>
                    <strong className="text-slate-900">Options:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Option 1</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Option 2</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Option 3</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">Option 4</code>
                  </li>
                  <li>
                    <strong className="text-slate-900">Correct Answer:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Correct Answer</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Answer</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">উত্তর</code>
                  </li>
                  <li>
                    <strong className="text-slate-900">Explanation:</strong> <code className="bg-slate-100 px-1 rounded text-slate-800">Explanation</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">Reason</code> / <code className="bg-slate-100 px-1 rounded text-slate-800">ব্যাখ্যা</code>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExcelInstructionSection;
