import React, { useState, useMemo } from 'react';
import { AlertTriangle, HardDrive, Cloud, ArrowRight, RefreshCw, Search, Layers, Check, Clock } from 'lucide-react';
import { WordStatus, UserProgress } from '../types';

export interface SyncConflictData {
  localSummary: {
    wordsCount: number;
    knowCount?: number;
    foldersCount: number;
    lastUpdated: string;
    quizScore?: number;
  };
  cloudSummary: {
    wordsCount: number;
    knowCount?: number;
    foldersCount: number;
    lastUpdated: string;
    quizScore?: number;
  };
  cloudRawData: any;
  localRawData: any;
  discrepancies?: Array<{
    wordId: string;
    localStatus?: string;
    localUpdatedAt?: string;
    cloudStatus?: string;
    cloudUpdatedAt?: string;
    issue: 'local_only' | 'cloud_only' | 'status_mismatch' | 'timestamp_mismatch';
  }>;
}

export interface WordConflictDetail {
  wordId: string;
  wordTitle: string;
  localStatus: WordStatus;
  localUpdatedAt?: string;
  cloudStatus: WordStatus;
  cloudUpdatedAt?: string;
  issue: 'local_only' | 'cloud_only' | 'status_mismatch' | 'timestamp_mismatch';
}

interface SyncConflictModalProps {
  isOpen: boolean;
  conflictData: SyncConflictData | null;
  words?: any[];
  onKeepLocal: () => void;
  onUseServer: () => void;
  onMergeBoth: (customMergedProgress?: Record<string, UserProgress>) => void;
  onClose: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  isOpen,
  conflictData,
  words = [],
  onKeepLocal,
  onUseServer,
  onMergeBoth,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'status_mismatch' | 'local_only' | 'cloud_only'>('all');
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(true);
  
  // Custom user choices for specific word resolutions: wordId -> 'local' | 'cloud'
  const [customWordDecisions, setCustomWordDecisions] = useState<Record<string, 'local' | 'cloud'>>({});

  // Parse local and cloud progress objects
  const { localProgress, cloudProgress, wordConflicts } = useMemo(() => {
    if (!conflictData) {
      return { localProgress: {}, cloudProgress: {}, wordConflicts: [] };
    }

    const locProg: Record<string, UserProgress> = 
      conflictData.localRawData?.progress || 
      (typeof conflictData.localRawData === 'object' && !conflictData.localRawData?.progress && !conflictData.localRawData?.cloudRawData ? conflictData.localRawData : {}) || {};

    const cldProg: Record<string, UserProgress> = 
      conflictData.cloudRawData?.progress || {};

    const wordsMap = new Map<string, string>();
    if (Array.isArray(words)) {
      words.forEach(w => {
        if (w && w.id) {
          wordsMap.set(w.id, w.word || w.title || w.term || w.id);
        }
      });
    }

    const allWordIds = Array.from(new Set([...Object.keys(locProg), ...Object.keys(cldProg)]));
    const conflictsList: WordConflictDetail[] = [];

    allWordIds.forEach(wordId => {
      const locItem = locProg[wordId];
      const cldItem = cldProg[wordId];

      const locStatus = (locItem?.status || 'unrated') as WordStatus;
      const cldStatus = (cldItem?.status || 'unrated') as WordStatus;

      const locIsRated = locStatus !== 'unrated';
      const cldIsRated = cldStatus !== 'unrated';

      let issue: WordConflictDetail['issue'] | null = null;

      if (locIsRated && !cldIsRated) {
        issue = 'local_only';
      } else if (!locIsRated && cldIsRated) {
        issue = 'cloud_only';
      } else if (locIsRated && cldIsRated) {
        if (locStatus !== cldStatus) {
          issue = 'status_mismatch';
        } else if (locItem?.updatedAt && cldItem?.updatedAt && locItem.updatedAt !== cldItem.updatedAt) {
          issue = 'timestamp_mismatch';
        }
      }

      if (issue) {
        conflictsList.push({
          wordId,
          wordTitle: wordsMap.get(wordId) || wordId,
          localStatus: locStatus,
          localUpdatedAt: locItem?.updatedAt,
          cloudStatus: cldStatus,
          cloudUpdatedAt: cldItem?.updatedAt,
          issue
        });
      }
    });

    return { localProgress: locProg, cloudProgress: cldProg, wordConflicts: conflictsList };
  }, [conflictData, words]);

  if (!isOpen || !conflictData) return null;

  const { localSummary, cloudSummary } = conflictData;

  // Filter word conflicts for display
  const filteredConflicts = wordConflicts.filter(item => {
    const matchesSearch = item.wordTitle.toLowerCase().includes(searchTerm.toLowerCase()) || item.wordId.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType === 'all') return true;
    if (filterType === 'status_mismatch') return item.issue === 'status_mismatch';
    if (filterType === 'local_only') return item.issue === 'local_only';
    if (filterType === 'cloud_only') return item.issue === 'cloud_only';
    return true;
  });

  const getDecisionForWord = (item: WordConflictDetail): 'local' | 'cloud' => {
    if (customWordDecisions[item.wordId]) {
      return customWordDecisions[item.wordId];
    }
    // Default smart merge decision based on newest timestamp or rated status
    if (item.issue === 'local_only') return 'local';
    if (item.issue === 'cloud_only') return 'cloud';

    const localTime = new Date(item.localUpdatedAt || 0).getTime();
    const cloudTime = new Date(item.cloudUpdatedAt || 0).getTime();
    return localTime >= cloudTime ? 'local' : 'cloud';
  };

  const handleToggleDecision = (wordId: string, choice: 'local' | 'cloud') => {
    setCustomWordDecisions(prev => ({
      ...prev,
      [wordId]: choice
    }));
  };

  const handleApplySmartMerge = () => {
    // Generate merged progress map using custom choices or smart fallback
    const mergedProg: Record<string, UserProgress> = { ...cloudProgress };

    // First add all local progress
    Object.keys(localProgress).forEach(wId => {
      if (!mergedProg[wId]) {
        mergedProg[wId] = localProgress[wId];
      }
    });

    // Apply choices for conflicting words
    wordConflicts.forEach(item => {
      const decision = getDecisionForWord(item);
      if (decision === 'local' && localProgress[item.wordId]) {
        mergedProg[item.wordId] = localProgress[item.wordId];
      } else if (decision === 'cloud' && cloudProgress[item.wordId]) {
        mergedProg[item.wordId] = cloudProgress[item.wordId];
      }
    });

    onMergeBoth(mergedProg);
  };

  const renderStatusPill = (status: WordStatus) => {
    switch (status) {
      case 'know':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/80">Know</span>;
      case 'confusion':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200/80">Confused</span>;
      case 'dont_know':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200/80">Don't Know</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">Unrated</span>;
    }
  };

  const formatTime = (ts?: string) => {
    if (!ts) return 'No timestamp';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
      return ts;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-3xl w-full p-5 sm:p-7 space-y-5 font-sans my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-start gap-3.5 pb-3.5 border-b border-slate-100 shrink-0">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200/60 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Granular Sync Conflict Resolution</h3>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                {wordConflicts.length} Mismatched Word{wordConflicts.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
              Specific vocabulary word statuses differ between your local device and cloud backup. Review the side-by-side comparison below to resolve discrepancies smoothly.
            </p>
          </div>
        </div>

        {/* Side-by-Side Comparison Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          {/* Local Device Box */}
          <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-150">
                <HardDrive className="w-3.5 h-3.5" />
                Local Device
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Current Device</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-0.5">
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Progressed Words</span>
                <span className="font-bold text-slate-900 text-sm">{localSummary.wordsCount} items</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Last Modified</span>
                <span className="font-semibold text-slate-700 text-[11px] block truncate">{localSummary.lastUpdated}</span>
              </div>
            </div>
          </div>

          {/* Cloud Server Box */}
          <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-150">
                <Cloud className="w-3.5 h-3.5" />
                Cloud Backup
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Server Snapshot</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-0.5">
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Progressed Words</span>
                <span className="font-bold text-slate-900 text-sm">{cloudSummary.wordsCount} items</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Last Modified</span>
                <span className="font-semibold text-slate-700 text-[11px] block truncate">{cloudSummary.lastUpdated}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Side-by-Side Word Progress Comparison Section */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-3 min-h-0 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Side-by-Side Word Progress Comparison</span>
            </div>
            <button
              type="button"
              onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
            >
              {showDetailedBreakdown ? 'Collapse Table' : 'Expand Word Details'}
            </button>
          </div>

          {showDetailedBreakdown && (
            <>
              {/* Filter controls & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search conflicting words..."
                    className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0">
                  {[
                    { id: 'all', label: `All (${wordConflicts.length})` },
                    { id: 'status_mismatch', label: 'Status Differences' },
                    { id: 'local_only', label: 'Local Only' },
                    { id: 'cloud_only', label: 'Cloud Only' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterType(tab.id as any)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition whitespace-nowrap cursor-pointer ${
                        filterType === tab.id
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Words Side-by-Side Comparison List */}
              <div className="flex-1 overflow-y-auto border border-slate-200/80 rounded-xl bg-white space-y-1.5 p-2 max-h-56 scrollbar-thin">
                {filteredConflicts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-medium">
                    No word discrepancies match the search/filter.
                  </div>
                ) : (
                  filteredConflicts.map(item => {
                    const currentDecision = getDecisionForWord(item);

                    return (
                      <div
                        key={item.wordId}
                        className="p-2.5 bg-slate-50/70 hover:bg-slate-100/70 rounded-xl border border-slate-150 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        {/* Word Info */}
                        <div className="min-w-0 sm:w-1/3">
                          <div className="font-bold text-slate-900 truncate capitalize text-xs">{item.wordTitle}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {item.wordId}</div>
                        </div>

                        {/* Side by Side States */}
                        <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
                          {/* Local state */}
                          <div className={`p-1.5 rounded-lg border text-left transition ${
                            currentDecision === 'local' ? 'bg-indigo-50/80 border-indigo-200' : 'bg-white border-slate-200'
                          }`}>
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700">Local</span>
                              {renderStatusPill(item.localStatus)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{formatTime(item.localUpdatedAt)}</span>
                            </div>
                          </div>

                          {/* Cloud state */}
                          <div className={`p-1.5 rounded-lg border text-left transition ${
                            currentDecision === 'cloud' ? 'bg-emerald-50/80 border-emerald-200' : 'bg-white border-slate-200'
                          }`}>
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Cloud</span>
                              {renderStatusPill(item.cloudStatus)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{formatTime(item.cloudUpdatedAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Granular Selector Button Pair */}
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleToggleDecision(item.wordId, 'local')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                              currentDecision === 'local'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                            title="Keep Local rating for this word"
                          >
                            {currentDecision === 'local' && <Check className="w-3 h-3" />}
                            <span>Use Local</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleDecision(item.wordId, 'cloud')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                              currentDecision === 'cloud'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                            title="Keep Cloud rating for this word"
                          >
                            {currentDecision === 'cloud' && <Check className="w-3 h-3" />}
                            <span>Use Cloud</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Action Strategy Choices */}
        <div className="space-y-2 shrink-0 pt-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Bulk Resolution Actions:</label>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleApplySmartMerge}
              className="p-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl flex items-center justify-between group transition cursor-pointer text-left shadow-xs"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-200" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1">
                    <span>Smart Merge</span>
                    <span className="text-[8px] font-black bg-indigo-500 text-white px-1 py-0.2 rounded">Recommended</span>
                  </div>
                  <div className="text-[10px] text-indigo-200 font-medium">Keep newest for each word</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-200 group-hover:translate-x-0.5 transition" />
            </button>

            <button
              type="button"
              onClick={onKeepLocal}
              className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between group transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-slate-600" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Keep All Local</div>
                  <div className="text-[10px] text-slate-500">Overwrite Cloud backup</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
            </button>

            <button
              type="button"
              onClick={onUseServer}
              className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between group transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Use All Cloud</div>
                  <div className="text-[10px] text-slate-500">Overwrite Local state</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0 text-xs">
          <span className="text-[11px] text-slate-400 font-medium">Automatic verification & resolution active</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer rounded-lg hover:bg-slate-100"
          >
            Dismiss
          </button>
        </div>

      </div>
    </div>
  );
};
