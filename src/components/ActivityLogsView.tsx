import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, Search, RefreshCw, Download, Filter, 
  FileSpreadsheet, Wallet, ShieldCheck, Sliders, ChevronDown, ChevronRight, Clock, UserCheck 
} from 'lucide-react';
import { ActivityLog, fetchActivityLogs } from '../lib/activityLogger';

interface ActivityLogsViewProps {
  currentAdminEmail?: string;
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = ({ currentAdminEmail }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchActivityLogs();
      setLogs(data);
    } catch (e) {
      console.error('Error fetching activity logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (selectedCategory !== 'all' && log.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAdmin = log.adminEmail?.toLowerCase().includes(q);
        const matchAction = log.action?.toLowerCase().includes(q);
        const matchDesc = log.description?.toLowerCase().includes(q);
        const matchTarget = log.targetId?.toLowerCase().includes(q);
        return matchAdmin || matchAction || matchDesc || matchTarget;
      }
      return true;
    });
  }, [logs, selectedCategory, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const courseMod = logs.filter(l => l.category === 'course_modification').length;
    const wallet = logs.filter(l => l.category === 'wallet_transaction').length;
    const permissions = logs.filter(l => l.category === 'student_permissions').length;
    return { total, courseMod, wallet, permissions };
  }, [logs]);

  const exportLogsAsCsv = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'Admin Email', 'Category', 'Action', 'Description', 'Target ID'];
    const csvRows = [headers.join(',')];
    filteredLogs.forEach(log => {
      const row = [
        `"${log.timestamp}"`,
        `"${log.adminEmail || ''}"`,
        `"${log.category || ''}"`,
        `"${log.action || ''}"`,
        `"${(log.description || '').replace(/"/g, '""')}"`,
        `"${log.targetId || ''}"`
      ];
      csvRows.push(row.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'course_modification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            <FileSpreadsheet className="w-3 h-3 text-indigo-500" />
            Course Mod
          </span>
        );
      case 'wallet_transaction':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <Wallet className="w-3 h-3 text-emerald-500" />
            Wallet & Payment
          </span>
        );
      case 'student_permissions':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
            <ShieldCheck className="w-3 h-3 text-amber-500" />
            Permissions
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Sliders className="w-3 h-3 text-slate-500" />
            System
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* Top Banner & Stats Overview */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100/90 shadow-2xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <span>System Activity Logs</span>
            </h3>
            <p className="text-xs text-slate-400 font-normal">
              Audit trail recording all course data modifications, student access permissions, and wallet transactions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200/80 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh Logs</span>
            </button>

            <button
              type="button"
              onClick={exportLogsAsCsv}
              disabled={filteredLogs.length === 0}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Recorded</span>
            <span className="text-xl font-bold text-slate-900 mt-0.5 block">{stats.total}</span>
          </div>
          <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100/70">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block">Course Modifications</span>
            <span className="text-xl font-bold text-indigo-900 mt-0.5 block">{stats.courseMod}</span>
          </div>
          <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100/70">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider block">Wallet Transactions</span>
            <span className="text-xl font-bold text-emerald-900 mt-0.5 block">{stats.wallet}</span>
          </div>
          <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-100/70">
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider block">Student Permissions</span>
            <span className="text-xl font-bold text-amber-900 mt-0.5 block">{stats.permissions}</span>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Logs' },
              { id: 'course_modification', label: 'Course Mods' },
              { id: 'wallet_transaction', label: 'Wallet Trxs' },
              { id: 'student_permissions', label: 'Permissions' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search email, action, details..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Activity Logs Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4 w-44">Date & Time</th>
                <th className="py-3 px-4 w-36">Category</th>
                <th className="py-3 px-4 w-48">Admin Account</th>
                <th className="py-3 px-4">Action & Details</th>
                <th className="py-3 px-4 text-center w-16">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLogs.map(log => {
                const isExpanded = expandedLogId === log.id;
                const dateFormatted = log.timestamp
                  ? new Date(log.timestamp).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'N/A';

                return (
                  <React.Fragment key={log.id}>
                    <tr 
                      className="hover:bg-slate-50/70 transition cursor-pointer"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{dateFormatted}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        {getCategoryBadge(log.category)}
                      </td>

                      {/* Admin Email */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 text-[11px] truncate max-w-[180px]">
                        {log.adminEmail || 'Admin'}
                      </td>

                      {/* Action & Description */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 leading-snug">
                          {log.action}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                          {log.description}
                        </div>
                      </td>

                      {/* Expand Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-b border-slate-100">
                        <td colSpan={5} className="p-4">
                          <div className="bg-white p-4 rounded-2xl border border-slate-200/70 space-y-2">
                            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                              <span>Full Activity Detail</span>
                              <span className="font-mono text-[10px] text-slate-400">ID: {log.id}</span>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                              {log.description}
                            </p>
                            {log.details && (
                              <div className="pt-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                                  Context Payload (JSON)
                                </span>
                                <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl text-[10px] font-mono overflow-x-auto max-h-40">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium space-y-2">
                    <History className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs">
                      {searchQuery ? `No activity logs matching "${searchQuery}".` : 'No activity log entries recorded yet.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
