import React, { useState } from 'react';
import { AccessRequest } from '../types';
import { WalletDebugger } from './WalletDebugger';
import { 
  Bug, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Trash2, 
  Search, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Wallet, 
  TerminalSquare,
  ChevronRight,
  Info,
  Lock,
  RotateCcw
} from 'lucide-react';

export interface TransactionLogItem {
  id: string;
  timestamp: string;
  type: 'wallet' | 'access_request' | 'auto_verify' | 'test_write';
  userEmail: string;
  details: string;
  status: 'success' | 'failed' | 'pending';
  error?: string;
}

interface TransactionDebuggerProps {
  accessRequests: AccessRequest[];
  transactionLogs: TransactionLogItem[];
  onClearLogs: () => void;
  onTestTransaction: () => Promise<void>;
  onProcessRequest: (req: AccessRequest, action: 'approve' | 'reject') => Promise<boolean>;
  onRefreshRequests: () => void;
  isProcessing: boolean;
  adminUserEmail: string;
}

export const TransactionDebugger: React.FC<TransactionDebuggerProps> = ({
  accessRequests,
  transactionLogs,
  onClearLogs,
  onTestTransaction,
  onProcessRequest,
  onRefreshRequests,
  isProcessing,
  adminUserEmail
}) => {
  const [debuggerMode, setDebuggerMode] = useState<'diagnostics' | 'wallet-inspector'>('diagnostics');
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [requestSearch, setRequestSearch] = useState('');

  // Identify recharge requests
  const rechargeRequests = accessRequests.filter(r => 
    r.courseId === 'wallet_recharge' || 
    r.courseTitle?.toLowerCase().includes('recharge') ||
    r.courseTitle?.toLowerCase().includes('wallet')
  );

  const pendingRecharges = rechargeRequests.filter(r => r.status === 'pending');
  const approvedRecharges = rechargeRequests.filter(r => r.status === 'approved');

  const filteredPending = pendingRecharges.filter(r => {
    if (!requestSearch.trim()) return true;
    const q = requestSearch.toLowerCase().trim();
    return (
      r.email?.toLowerCase().includes(q) ||
      r.trxId?.toLowerCase().includes(q) ||
      r.bkashNumber?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q)
    );
  });

  const filteredLogs = transactionLogs.filter(log => {
    if (logFilter === 'success') return log.status === 'success';
    if (logFilter === 'failed') return log.status === 'failed';
    return true;
  });

  const totalPendingValue = pendingRecharges.reduce((sum, r) => sum + (r.totalPrice || r.price || 0), 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Debugger Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-4 text-white border border-slate-800 shadow-md flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/20 border border-indigo-400/30 rounded-lg text-indigo-300">
            <Bug className="w-4 h-4" />
          </div>
          <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
            Tx Debugger
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTestTransaction}
            disabled={isProcessing}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            <TerminalSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Test Write</span>
          </button>

          <button
            type="button"
            onClick={onRefreshRequests}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={() => setDebuggerMode('diagnostics')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 ${
            debuggerMode === 'diagnostics'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bug className="w-4 h-4 text-amber-300" />
          <span>Transaction Diagnostics & Logs</span>
        </button>

        <button
          type="button"
          onClick={() => setDebuggerMode('wallet-inspector')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 ${
            debuggerMode === 'wallet-inspector'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span>Real-time Wallet & Locks Inspector (WalletDebugger)</span>
        </button>
      </div>

      {debuggerMode === 'wallet-inspector' ? (
        <WalletDebugger
          accessRequests={accessRequests}
          transactionLogs={transactionLogs}
          onRetryTransaction={onProcessRequest}
          onRefreshRequests={onRefreshRequests}
          isProcessing={isProcessing}
          adminUserEmail={adminUserEmail}
        />
      ) : (
        <>
          {/* Admin Auth Status Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-extrabold text-slate-700">Logged in Admin:</span>
          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200/60">
            {adminUserEmail || 'Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-500 font-semibold">
          <span>Pending Recharges: <strong className="text-amber-600 font-bold">{pendingRecharges.length}</strong></span>
          <span>Approved Recharges: <strong className="text-emerald-600 font-bold">{approvedRecharges.length}</strong></span>
          <span>Total Logged Tx: <strong className="text-slate-800 font-bold">{transactionLogs.length}</strong></span>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-tight">Pending Value</span>
            <Wallet className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900 font-mono">৳{totalPendingValue}</p>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-tight">Total Claims</span>
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900 font-mono">{rechargeRequests.length}</p>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-tight">Success Tx</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-700 font-mono">
            {transactionLogs.filter(l => l.status === 'success').length}
          </p>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-tight">Failed Tx</span>
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-rose-600 font-mono">
            {transactionLogs.filter(l => l.status === 'failed').length}
          </p>
        </div>
      </div>

      {/* Section 1: Pending Recharge Requests Diagnostic Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              Pending Recharge Requests Diagnostic & Analysis
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Diagnostic summary to quickly troubleshoot why specific recharge claims might fail or not reflect on user accounts.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by email, trxId, bKash..."
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {filteredPending.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl space-y-1.5">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No pending recharge requests</p>
            <p className="text-[11px] text-slate-400">All student wallet recharge claims have been processed or approved.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full border border-slate-200/80 rounded-2xl">
            <table className="w-full text-left border-collapse min-w-[700px] text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase font-mono">
                  <th className="px-3.5 py-2.5">Request ID</th>
                  <th className="px-3.5 py-2.5">Student Email</th>
                  <th className="px-3.5 py-2.5">bKash / TrxID</th>
                  <th className="px-3.5 py-2.5">Amount</th>
                  <th className="px-3.5 py-2.5">Field Diagnostics</th>
                  <th className="px-3.5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {filteredPending.map((req) => {
                  const hasEmail = Boolean(req.email && req.email.includes('@'));
                  const hasTrx = Boolean(req.trxId && req.trxId.trim().length >= 4);
                  const hasPhone = Boolean(req.bkashNumber && req.bkashNumber.trim().length >= 8);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3.5 py-3 font-mono font-bold text-slate-600 text-[11px]">
                        {req.id}
                      </td>
                      <td className="px-3.5 py-3 font-bold text-slate-900 font-mono">
                        {req.email || <span className="text-rose-500 font-normal">Missing Email</span>}
                      </td>
                      <td className="px-3.5 py-3 space-y-0.5">
                        <div className="font-mono text-pink-700 font-bold">{req.bkashNumber || 'N/A'}</div>
                        <div className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-max">
                          Trx: {req.trxId || 'N/A'}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 font-mono font-extrabold text-emerald-700 text-sm">
                        ৳{req.totalPrice || req.price || 50}
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                          <span className={`px-2 py-0.5 rounded-full font-bold border ${hasEmail ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {hasEmail ? 'Email Valid' : 'Email Invalid'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-bold border ${hasTrx ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {hasTrx ? 'TrxID OK' : 'Missing TrxID'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-bold border ${hasPhone ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {hasPhone ? 'Phone OK' : 'No Phone'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onProcessRequest(req, 'approve')}
                            disabled={isProcessing}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-lg transition shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onProcessRequest(req, 'reject')}
                            disabled={isProcessing}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg border border-rose-200 transition cursor-pointer disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Firestore Transactions Log */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <TerminalSquare className="w-4 h-4 text-indigo-600" />
              Recent Firestore Transaction Logs ({filteredLogs.length})
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Detailed audit trail of all atomic write transactions executed in this session.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-[11px] font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setLogFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition ${logFilter === 'all' ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'hover:text-slate-900'}`}
              >
                All ({transactionLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('success')}
                className={`px-2.5 py-1 rounded-lg transition ${logFilter === 'success' ? 'bg-white text-emerald-700 shadow-2xs font-extrabold' : 'hover:text-slate-900'}`}
              >
                Success
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('failed')}
                className={`px-2.5 py-1 rounded-lg transition ${logFilter === 'failed' ? 'bg-white text-rose-700 shadow-2xs font-extrabold' : 'hover:text-slate-900'}`}
              >
                Failed
              </button>
            </div>

            <button
              type="button"
              onClick={onClearLogs}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
              title="Clear log history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl space-y-1">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">No transaction logs recorded</p>
            <p className="text-[11px] text-slate-400">Perform a transaction or click 'Test Firestore Write' to record logs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full border border-slate-200/80 rounded-2xl">
            <table className="w-full text-left border-collapse min-w-[700px] text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase font-mono">
                  <th className="px-3.5 py-2.5">Time</th>
                  <th className="px-3.5 py-2.5">Type</th>
                  <th className="px-3.5 py-2.5">Target Email</th>
                  <th className="px-3.5 py-2.5">Details</th>
                  <th className="px-3.5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-3.5 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold text-[10px] rounded uppercase border border-slate-200">
                        {log.type}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-mono font-bold text-slate-800">
                      {log.userEmail || 'system'}
                    </td>
                    <td className="px-3.5 py-3 font-medium text-slate-700 max-w-[300px] truncate" title={log.details}>
                      {log.details}
                      {log.error && (
                        <div className="text-[10px] text-rose-600 font-mono font-bold mt-0.5 bg-rose-50 p-1 rounded border border-rose-100">
                          Error: {log.error}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold text-[10px] rounded-md border border-emerald-200/80">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          SUCCESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 font-extrabold text-[10px] rounded-md border border-rose-200/80">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          FAILED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}
</div>
);
};
