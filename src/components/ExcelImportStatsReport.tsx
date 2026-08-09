import React, { useState } from 'react';
import { 
  BarChart3, 
  CheckCircle2, 
  FileSpreadsheet, 
  PlusCircle, 
  RefreshCw, 
  Sparkles, 
  Gamepad2, 
  Copy, 
  Check, 
  Download, 
  Layers, 
  X,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';

export interface ImportStatsReport {
  timestamp: string;
  filename?: string;
  totalRowsProcessed: number;
  newWordsCount: number;
  updatedWordsCount: number;
  unchangedWordsCount: number;
  totalWordsNow: number;
  placeChanges: {
    place1: number; // Front Main Display (word)
    place2: number; // Back Main Display (meaning)
    place3: number; // Back Secondary Display (example)
    place4: number; // Front Sub-Header (extraWord)
    place5: number; // Back Extra Section (synonyms/extraMeaning)
    place6: number; // Mnemonic / Notes
    group: number;  // Group / Level
  };
  gameStats: {
    blankQuestions: { added: number; updated: number; total: number };
    oddOneOut: { added: number; updated: number; total: number };
    wordAnalogy: { added: number; updated: number; total: number };
    mcqQuiz: { added: number; updated: number; total: number };
    newGamesAddedList: string[]; // e.g. ["Blank Filling Practice", "Odd One Out Game"]
    totalGamesModifiedCount: number;
  };
  placeLabels?: Record<string, string>;
}

interface ExcelImportStatsReportProps {
  stats: ImportStatsReport;
  onClose?: () => void;
}

export const ExcelImportStatsReport: React.FC<ExcelImportStatsReportProps> = ({ stats, onClose }) => {
  const [copied, setCopied] = useState(false);

  const placeInfo = [
    {
      key: 'place1',
      code: 'place1',
      defaultLabel: 'Main Word',
      customLabel: stats.placeLabels?.place1 || 'Main Word',
      location: 'Front Main Display',
      count: stats.placeChanges.place1,
      bgColor: 'bg-indigo-50/70',
      textColor: 'text-indigo-700',
      borderColor: 'border-indigo-100'
    },
    {
      key: 'place2',
      code: 'place2',
      defaultLabel: 'Bengali Meaning',
      customLabel: stats.placeLabels?.place2 || 'Bengali Meaning',
      location: 'Back Main Display',
      count: stats.placeChanges.place2,
      bgColor: 'bg-emerald-50/70',
      textColor: 'text-emerald-700',
      borderColor: 'border-emerald-100'
    },
    {
      key: 'place3',
      code: 'place3',
      defaultLabel: 'Example Sentence',
      customLabel: stats.placeLabels?.place3 || 'Example Sentence',
      location: 'Back Secondary Display',
      count: stats.placeChanges.place3,
      bgColor: 'bg-sky-50/70',
      textColor: 'text-sky-700',
      borderColor: 'border-sky-100'
    },
    {
      key: 'place4',
      code: 'place4',
      defaultLabel: 'Derivative / Sub-Header',
      customLabel: stats.placeLabels?.place4 || 'Derivative / Sub-Header',
      location: 'Front Sub-Header Display',
      count: stats.placeChanges.place4,
      bgColor: 'bg-amber-50/70',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-100'
    },
    {
      key: 'place5',
      code: 'place5',
      defaultLabel: 'Synonyms & Extra',
      customLabel: stats.placeLabels?.place5 || 'Synonyms & Extra Section',
      location: 'Back Extra Section 1',
      count: stats.placeChanges.place5,
      bgColor: 'bg-purple-50/70',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-100'
    },
    {
      key: 'place6',
      code: 'place6',
      defaultLabel: 'Mnemonic / Memory Notes',
      customLabel: stats.placeLabels?.place6 || 'Mnemonic / Notes',
      location: 'Back Notes / Memory Trick',
      count: stats.placeChanges.place6,
      bgColor: 'bg-rose-50/70',
      textColor: 'text-rose-700',
      borderColor: 'border-rose-100'
    },
    {
      key: 'group',
      code: 'group',
      defaultLabel: 'Group / Level',
      customLabel: 'Group / Level Number',
      location: 'Course Grouping & Leveling',
      count: stats.placeChanges.group,
      bgColor: 'bg-slate-100/70',
      textColor: 'text-slate-800',
      borderColor: 'border-slate-200'
    }
  ];

  const gamesInfo = [
    {
      name: 'Blank Filling Practice',
      banglaName: 'শূন্যস্থান পূরণ প্র্যাকটিস',
      icon: '🎯',
      stats: stats.gameStats.blankQuestions,
      isNew: stats.gameStats.newGamesAddedList.includes('Blank Filling Practice')
    },
    {
      name: 'Odd One Out Game',
      banglaName: 'অড ওয়ান আউট গেম',
      icon: '🔍',
      stats: stats.gameStats.oddOneOut,
      isNew: stats.gameStats.newGamesAddedList.includes('Odd One Out Game')
    },
    {
      name: 'Word Analogy Game',
      banglaName: 'ওয়ার্ড এনালজি গেম',
      icon: '🧩',
      stats: stats.gameStats.wordAnalogy,
      isNew: stats.gameStats.newGamesAddedList.includes('Word Analogy Game')
    },
    {
      name: 'MCQ Quiz Questions',
      banglaName: 'এমসিকিউ কুইজ প্রশ্নাবলি',
      icon: '📝',
      stats: stats.gameStats.mcqQuiz,
      isNew: stats.gameStats.newGamesAddedList.includes('MCQ Quiz Questions')
    }
  ];

  const handleCopySummary = () => {
    let summaryText = `📊 Excel Import Statistics Report (${stats.filename || 'Spreadsheet'})\n`;
    summaryText += `--------------------------------------------------\n`;
    summaryText += `• Total Processed Rows: ${stats.totalRowsProcessed}\n`;
    summaryText += `• New Words Added: ${stats.newWordsCount}\n`;
    summaryText += `• Existing Words Modified: ${stats.updatedWordsCount}\n`;
    summaryText += `• Words Unchanged: ${stats.unchangedWordsCount}\n`;
    summaryText += `• Total Words in Course Now: ${stats.totalWordsNow}\n\n`;

    summaryText += `📍 WORD FIELD CHANGES (place# breakdown):\n`;
    placeInfo.forEach(p => {
      summaryText += `  - ${p.code} (${p.customLabel}): ${p.count} words changed\n`;
    });

    summaryText += `\n🎮 GAME DATA & UPDATES:\n`;
    gamesInfo.forEach(g => {
      summaryText += `  - ${g.name}: ${g.stats.added} added, ${g.stats.updated} updated (Total: ${g.stats.total})\n`;
    });
    if (stats.gameStats.newGamesAddedList.length > 0) {
      summaryText += `  - 🎉 New Games Activated: ${stats.gameStats.newGamesAddedList.join(', ')}\n`;
    }

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    const rows = [
      ['Category', 'Field / Code', 'Description', 'Value'],
      ['Summary', 'Total Rows', 'Processed Rows in Excel', stats.totalRowsProcessed],
      ['Summary', 'New Words', 'Newly Created Words', stats.newWordsCount],
      ['Summary', 'Modified Words', 'Updated Existing Words', stats.updatedWordsCount],
      ['Summary', 'Unchanged Words', 'Preserved Identical Words', stats.unchangedWordsCount],
      ['Summary', 'Total Words Now', 'Total Vocabulary in Course', stats.totalWordsNow],
      ...placeInfo.map(p => ['Place Field', p.code, p.customLabel, p.count]),
      ...gamesInfo.map(g => ['Game Module', g.name, `Added: ${g.stats.added}, Updated: ${g.stats.updated}`, `Total: ${g.stats.total}`])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Excel_Import_Stats_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl border border-emerald-200 shadow-xl overflow-hidden my-4 animate-fadeIn">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-white tracking-tight">
                Spreadsheet Import & Update Statistics
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                স্ট্যাটিস্টিক্স টেবিল
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 font-medium flex items-center gap-2">
              {stats.filename && <span>📄 {stats.filename}</span>}
              <span>• Processed at {stats.timestamp}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6 bg-slate-50/50">
        {/* KPI Grid Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* New Words */}
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-extrabold text-emerald-600">
              <span>নতুন শব্দ যুক্ত হয়েছে</span>
              <PlusCircle className="w-4 h-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">+{stats.newWordsCount}</span>
              <span className="text-[10px] text-slate-400 font-medium">New words</span>
            </div>
            <p className="text-[10px] text-emerald-600/80 mt-1 font-semibold">Newly created in course</p>
          </div>

          {/* Changed Words */}
          <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-extrabold text-indigo-600">
              <span>ওয়ার্ড চেঞ্জ হয়েছে</span>
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{stats.updatedWordsCount}</span>
              <span className="text-[10px] text-slate-400 font-medium">Modified</span>
            </div>
            <p className="text-[10px] text-indigo-600/80 mt-1 font-semibold">Existing words updated</p>
          </div>

          {/* Unchanged Words */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-600">
              <span>একদম আগের মতো রয়ে গেছে</span>
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-700">{stats.unchangedWordsCount}</span>
              <span className="text-[10px] text-slate-400 font-medium">Unchanged</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">Preserved exact state</p>
          </div>

          {/* Total Words Now */}
          <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-extrabold text-purple-600">
              <span>মোট শব্দ (Course Roster)</span>
              <Layers className="w-4 h-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{stats.totalWordsNow}</span>
              <span className="text-[10px] text-slate-400 font-medium">Total words</span>
            </div>
            <p className="text-[10px] text-purple-600/80 mt-1 font-semibold">Active course vocabulary</p>
          </div>
        </div>

        {/* SECTION 1: WORD FIELD CHANGES BREAKDOWN TABLE (place#) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                1. Field-wise Word Changes Breakdown (কোন Place# এ কতগুলো শব্দ চেঞ্জ হয়েছে)
              </h4>
            </div>
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              Total Word Changes: {stats.updatedWordsCount}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200 text-[10px]">
                  <th className="py-2.5 px-4">Place Code</th>
                  <th className="py-2.5 px-4">Field Label & Name</th>
                  <th className="py-2.5 px-4">Display Location on Flashcard</th>
                  <th className="py-2.5 px-4 text-right">Words Changed (পরিবর্তিত শব্দ)</th>
                  <th className="py-2.5 px-4 text-right">Ratio (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {placeInfo.map((p) => {
                  const percentage = stats.updatedWordsCount > 0 
                    ? Math.round((p.count / stats.updatedWordsCount) * 100) 
                    : 0;

                  return (
                    <tr key={p.key} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${p.bgColor} ${p.textColor} ${p.borderColor}`}>
                          {p.code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-extrabold text-slate-900 block">{p.customLabel}</span>
                        {p.customLabel !== p.defaultLabel && (
                          <span className="text-[10px] text-slate-400 block">Default: {p.defaultLabel}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {p.location}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {p.count > 0 ? (
                          <span className="text-indigo-600 font-black text-sm">
                            {p.count}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${Math.min(100, percentage)}%` }} 
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 w-8 text-right">
                            {percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: NEW GAMES DETECTED & GAME DATA CHANGES SUMMARY */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-purple-600" />
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                2. Game Data & Module Changes (নতুন গেম এড হয়েছে কিনা ও গেমের ডেটা পরিবর্তন)
              </h4>
            </div>
            {stats.gameStats.newGamesAddedList.length > 0 ? (
              <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 animate-pulse">
                <Sparkles className="w-3 h-3" />
                <span>{stats.gameStats.newGamesAddedList.length} New Game(s) Activated!</span>
              </span>
            ) : (
              <span className="text-[11px] font-bold text-slate-500 bg-slate-200/60 px-2.5 py-0.5 rounded-full">
                All Games Processed
              </span>
            )}
          </div>

          {/* New Games Notification Banner */}
          {stats.gameStats.newGamesAddedList.length > 0 && (
            <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-indigo-500/10 border-b border-emerald-100 flex items-center gap-3">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-black text-emerald-950">
                  🎉 নতুন গেম মডিউল স্প্রেডশীট থেকে যুক্ত হয়েছে!
                </h5>
                <p className="text-[11px] font-semibold text-emerald-800 mt-0.5">
                  The following games were newly populated and activated in this course:{' '}
                  <strong className="text-emerald-900 underline">
                    {stats.gameStats.newGamesAddedList.join(', ')}
                  </strong>
                </p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200 text-[10px]">
                  <th className="py-2.5 px-4">Game Module</th>
                  <th className="py-2.5 px-4">Status & Activity</th>
                  <th className="py-2.5 px-4 text-center">New Qs Added (নতুন যুক্ত)</th>
                  <th className="py-2.5 px-4 text-center">Qs Updated (পরিবর্তিত)</th>
                  <th className="py-2.5 px-4 text-right">Total Course Qs Now (মোট)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {gamesInfo.map((game, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{game.icon}</span>
                        <div>
                          <span className="font-extrabold text-slate-900 block">{game.name}</span>
                          <span className="text-[10px] text-slate-500">{game.banglaName}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {game.isNew ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Sparkles className="w-3 h-3" />
                          New Game Added!
                        </span>
                      ) : game.stats.added > 0 || game.stats.updated > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Updated ({game.stats.added + game.stats.updated} changes)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                          Unchanged
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-bold">
                      {game.stats.added > 0 ? (
                        <span className="text-emerald-600 font-black text-sm">+{game.stats.added}</span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-bold">
                      {game.stats.updated > 0 ? (
                        <span className="text-indigo-600 font-black text-sm">{game.stats.updated}</span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                      {game.stats.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Informational Footer Tip */}
        <div className="p-3.5 bg-amber-50/80 border border-amber-200/70 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-extrabold">মনে রাখবেন:</span> এই স্ট্যাটিস্টিক্স রিপোর্টটি স্প্রেডশীটের প্রতিটি পরিবর্তন সঠিকভাবে গণনা করেছে। নতুন অথবা পরিবর্তিত সমস্ত শব্দ স্থায়ীভাবে ডাটাবেসে সংরক্ষণ করতে নিচে থাকা <strong>"Update Settings"</strong> বাটনে ক্লিক করে সেভ করুন।
          </div>
        </div>
      </div>
    </div>
  );
};
