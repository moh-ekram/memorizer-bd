import React from 'react';
import { AlertTriangle, HardDrive, Cloud, ArrowRight, RefreshCw } from 'lucide-react';

export interface SyncConflictData {
  localSummary: {
    wordsCount: number;
    foldersCount: number;
    lastUpdated: string;
    quizScore?: number;
  };
  cloudSummary: {
    wordsCount: number;
    foldersCount: number;
    lastUpdated: string;
    quizScore?: number;
  };
  cloudRawData: any;
  localRawData: any;
}

interface SyncConflictModalProps {
  isOpen: boolean;
  conflictData: SyncConflictData | null;
  onKeepLocal: () => void;
  onUseServer: () => void;
  onMergeBoth: () => void;
  onClose: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  isOpen,
  conflictData,
  onKeepLocal,
  onUseServer,
  onMergeBoth,
  onClose
}) => {
  if (!isOpen || !conflictData) return null;

  const { localSummary, cloudSummary } = conflictData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-xl w-full p-6 sm:p-7 space-y-6 font-sans">
        {/* Modal Header */}
        <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200/60 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Data Conflict Detected During Sync</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
              Your local device data differs from your cloud backup. Please select how you want to resolve this conflict to prevent data loss.
            </p>
          </div>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Local Device Box */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-150">
                <HardDrive className="w-3.5 h-3.5" />
                Local Device
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Current</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Progressed Words:</span>
                <span className="font-bold text-slate-900">{localSummary.wordsCount} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Saved Folders:</span>
                <span className="font-bold text-slate-900">{localSummary.foldersCount} folders</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Last Modified:</span>
                <span className="font-semibold text-slate-700 text-[11px]">{localSummary.lastUpdated}</span>
              </div>
            </div>
          </div>

          {/* Cloud Server Box */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-150">
                <Cloud className="w-3.5 h-3.5" />
                Cloud Backup
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Server</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Progressed Words:</span>
                <span className="font-bold text-slate-900">{cloudSummary.wordsCount} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Saved Folders:</span>
                <span className="font-bold text-slate-900">{cloudSummary.foldersCount} folders</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Last Modified:</span>
                <span className="font-semibold text-slate-700 text-[11px]">{cloudSummary.lastUpdated}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resolution Options */}
        <div className="space-y-2 pt-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Choose Resolution Strategy:</label>
          
          <button
            type="button"
            onClick={onMergeBoth}
            className="w-full p-3 bg-gradient-to-r from-indigo-50 to-indigo-100/60 hover:from-indigo-100 hover:to-indigo-150 border border-indigo-200 rounded-2xl flex items-center justify-between group transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span>Smart Merge Both (Recommended)</span>
                  <span className="text-[9px] font-black bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded">Safest</span>
                </div>
                <div className="text-[11px] text-indigo-700 font-medium">
                  Combine both sets, keeping newest ratings for each word.
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-1 transition" />
          </button>

          <button
            type="button"
            onClick={onKeepLocal}
            className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between group transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Keep Local Device Data</div>
                <div className="text-[11px] text-slate-500">
                  Overwrite cloud server with your local device state.
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
          </button>

          <button
            type="button"
            onClick={onUseServer}
            className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between group transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Use Cloud Server Data</div>
                <div className="text-[11px] text-slate-500">
                  Overwrite local state with data stored on the server.
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-medium">Automatic cloud backup active</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
