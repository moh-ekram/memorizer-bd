import React, { useState, useMemo } from 'react';
import { Users, FileText, CheckCircle2, AlertCircle, Calendar, Plus, Trash2, X, RefreshCw, Layers } from 'lucide-react';
import { Course } from '../types';

interface BulkCsvStudentModalProps {
  isOpen: boolean;
  course: Course | null;
  onClose: () => void;
  onApply: (
    courseId: string, 
    updatedAllowedUsers: string[], 
    updatedExpiries: Record<string, string>, 
    mode: 'append' | 'replace'
  ) => void;
}

export const BulkCsvStudentModal: React.FC<BulkCsvStudentModalProps> = ({
  isOpen,
  course,
  onClose,
  onApply
}) => {
  if (!isOpen || !course) return null;

  const [csvText, setCsvText] = useState('');
  const [defaultExpiry, setDefaultExpiry] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  const existingAllowed = course.allowedUsers || [];
  const existingExpiries = course.allowedUsersExpiry || {};

  // Parse CSV text dynamically
  const parsedResults = useMemo(() => {
    if (!csvText.trim()) return { items: [], totalLines: 0, validCount: 0, duplicatesCount: 0 };

    const lines = csvText.split('\n');
    const items: Array<{
      identifier: string;
      expiry: string;
      isDuplicate: boolean;
      sourceLine: string;
    }> = [];

    const existingSet = new Set(existingAllowed.map(u => u.trim().toLowerCase()));
    const seenInImport = new Set<string>();

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Split by comma, tab, or semi-colon
      const parts = trimmedLine.split(/[,;\t]+/).map(p => p.trim());
      
      let identifier = '';
      let expiry = defaultExpiry;

      parts.forEach(part => {
        if (!part) return;
        // Check if part is a date (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
          expiry = part;
        } else if (/\S+@\S+\.\S+/.test(part) || /^\+?\d{7,15}$/.test(part)) {
          // Email or phone number
          identifier = part.toLowerCase();
        } else if (!identifier && part.length >= 3) {
          identifier = part.toLowerCase();
        }
      });

      if (identifier) {
        const isAlreadyAllowed = importMode === 'append' && existingSet.has(identifier);
        const isRepeatedInCsv = seenInImport.has(identifier);
        
        items.push({
          identifier,
          expiry,
          isDuplicate: isAlreadyAllowed || isRepeatedInCsv,
          sourceLine: trimmedLine
        });

        seenInImport.add(identifier);
      }
    });

    const validCount = items.filter(i => !i.isDuplicate).length;
    const duplicatesCount = items.filter(i => i.isDuplicate).length;

    return {
      items,
      totalLines: lines.length,
      validCount,
      duplicatesCount
    };
  }, [csvText, defaultExpiry, existingAllowed, importMode]);

  const handleSave = () => {
    if (parsedResults.items.length === 0) return;

    let finalAllowedUsers: string[] = importMode === 'append' ? [...existingAllowed] : [];
    let finalExpiries: Record<string, string> = importMode === 'append' ? { ...existingExpiries } : {};

    const existingLowerSet = new Set(finalAllowedUsers.map(u => u.toLowerCase()));

    parsedResults.items.forEach(item => {
      if (!existingLowerSet.has(item.identifier)) {
        finalAllowedUsers.push(item.identifier);
        existingLowerSet.add(item.identifier);
      }
      if (item.expiry) {
        finalExpiries[item.identifier] = item.expiry;
      }
    });

    onApply(course.id, finalAllowedUsers, finalExpiries, importMode);
    setCsvText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 sm:p-7 space-y-5 max-h-[90vh] flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-150">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Bulk Add Students via CSV</span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-mono">
                  {course.id}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-normal">
                {course.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Container */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          
          {/* Mode & Default Expiry Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60">
            {/* Import Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Import Mode</label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setImportMode('append')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                    importMode === 'append' ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Append to List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                    importMode === 'replace' ? 'bg-rose-600 text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Replace List</span>
                </button>
              </div>
            </div>

            {/* Default Expiry Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Default Expiration (Optional)</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={defaultExpiry}
                  onChange={(e) => setDefaultExpiry(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition cursor-pointer"
                />
                {defaultExpiry && (
                  <button
                    type="button"
                    onClick={() => setDefaultExpiry('')}
                    className="text-[10px] text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>
              {/* Presets */}
              <div className="flex items-center gap-1 pt-0.5">
                {[
                  { label: '+1M', months: 1 },
                  { label: '+3M', months: 3 },
                  { label: '+6M', months: 6 },
                  { label: '+1Y', months: 12 },
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + p.months);
                      setDefaultExpiry(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                    }}
                    className="px-2 py-0.5 bg-slate-200/80 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded text-[9px] font-extrabold transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CSV Textarea Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Paste CSV or List (Email / Phone, Optional Expiry Date)
              </label>
              <span className="text-[10px] font-semibold text-slate-400">Format: email, YYYY-MM-DD</span>
            </div>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Example lines:\nstudent1@gmail.com\nstudent2@gmail.com, 2026-12-31\n01712345678, 2027-06-30\nstudent3@gmail.com, 01800000000, 2026-11-15`}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono text-slate-800 placeholder-slate-400 transition resize-none leading-relaxed"
            />
          </div>

          {/* Parsed Live Summary & Table */}
          {parsedResults.items.length > 0 && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Parsed Student Summary ({parsedResults.items.length})</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold rounded-full border border-emerald-150">
                    {parsedResults.validCount} New Valid
                  </span>
                  {parsedResults.duplicatesCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-extrabold rounded-full border border-amber-150">
                      {parsedResults.duplicatesCount} Duplicates
                    </span>
                  )}
                </div>
              </div>

              {/* Mini Preview Table */}
              <div className="max-h-48 overflow-y-auto border border-slate-200/80 rounded-xl bg-white divide-y divide-slate-100">
                {parsedResults.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3.5 py-2 items-center text-xs">
                    <div className="col-span-6 font-mono font-semibold text-slate-800 truncate" title={item.identifier}>
                      {item.identifier}
                    </div>
                    <div className="col-span-4 text-slate-500 font-mono text-[11px] flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{item.expiry || 'Permanent'}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      {item.isDuplicate ? (
                        <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                          Exists
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          New
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={parsedResults.items.length === 0}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
              parsedResults.items.length > 0
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-md'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Apply {parsedResults.items.length} Student{parsedResults.items.length === 1 ? '' : 's'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
