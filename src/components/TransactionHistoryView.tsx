import React, { useState, useMemo } from 'react';
import { AccessRequest } from '../types';
import { 
  Search, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Wallet, 
  BookOpen, 
  Copy, 
  RefreshCw, 
  Check,
  ShieldCheck,
  ArrowUpDown,
  Filter
} from 'lucide-react';

interface TransactionHistoryViewProps {
  requests: AccessRequest[];
  onRefresh: () => void;
  onApprove?: (req: AccessRequest) => void;
  onReject?: (reqId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function TransactionHistoryView({
  requests,
  onRefresh,
  onApprove,
  onReject,
  showToast
}: TransactionHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'recharge' | 'course'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    showToast(`Copied ${label} to clipboard!`, 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch = 
        req.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.bkashNumber && req.bkashNumber.includes(searchQuery)) ||
        (req.trxId && req.trxId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (req.courseTitle && req.courseTitle.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;

      const isRecharge = req.courseId === 'wallet_recharge' || 
                         req.courseTitle?.toLowerCase().includes('recharge') ||
                         req.courseTitle?.toLowerCase().includes('wallet');

      const matchesType = typeFilter === 'all' || 
                         (typeFilter === 'recharge' && isRecharge) || 
                         (typeFilter === 'course' && !isRecharge);

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [requests, searchQuery, statusFilter, typeFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    const totalRecharges = requests.filter(r => 
      r.courseId === 'wallet_recharge' || r.courseTitle?.toLowerCase().includes('recharge')
    );
    const approvedRechargeAmount = totalRecharges
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (r.price || r.totalPrice || 0), 0);

    return { total, pending, approved, rejected, approvedRechargeAmount };
  }, [requests]);

  return (
    <div className="space-y-6">
      {/* Transaction Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Transactions</span>
          <p className="text-2xl font-black text-slate-800 font-mono">{stats.total}</p>
          <span className="text-[10px] text-slate-400">All submitted requests</span>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/60 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Approved Volume</span>
          <p className="text-2xl font-black text-emerald-900 font-mono">৳{stats.approvedRechargeAmount}</p>
          <span className="text-[10px] text-emerald-600 font-semibold">{stats.approved} approved requests</span>
        </div>

        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Pending Action</span>
          <p className="text-2xl font-black text-amber-900 font-mono">{stats.pending}</p>
          <span className="text-[10px] text-amber-600 font-semibold">Needs review</span>
        </div>

        <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200/60 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wide">Rejected Requests</span>
          <p className="text-2xl font-black text-rose-900 font-mono">{stats.rejected}</p>
          <span className="text-[10px] text-rose-600 font-semibold">Cancelled/Declined</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Email, bKash No, TrxID, or Course..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shrink-0">
            <span className="px-2 text-[10px] font-extrabold text-slate-400 uppercase">Status:</span>
            {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition cursor-pointer text-xs ${
                  statusFilter === st
                    ? 'bg-white text-indigo-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shrink-0">
            <span className="px-2 text-[10px] font-extrabold text-slate-400 uppercase">Type:</span>
            {(['all', 'recharge', 'course'] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => setTypeFilter(tp)}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition cursor-pointer text-xs ${
                  typeFilter === tp
                    ? 'bg-white text-indigo-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tp === 'recharge' ? 'Recharge' : tp === 'course' ? 'Courses' : 'All'}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer shrink-0"
            title="Refresh Transactions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">User / Email</th>
                <th className="py-3.5 px-4">Type & Item</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">bKash Phone & TrxID</th>
                <th className="py-3.5 px-4">Date / Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-sm">No transaction records match your filters.</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isRecharge = req.courseId === 'wallet_recharge' || 
                                     req.courseTitle?.toLowerCase().includes('recharge') ||
                                     req.courseTitle?.toLowerCase().includes('wallet');

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition">
                      {/* User Email */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        <span className="block truncate max-w-[200px]" title={req.email}>
                          {req.email}
                        </span>
                      </td>

                      {/* Type & Item */}
                      <td className="py-3.5 px-4">
                        {isRecharge ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold">
                            <Wallet className="w-3.5 h-3.5" /> Wallet Recharge
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold">
                              <BookOpen className="w-3 h-3" /> Course Access
                            </span>
                            <span className="block text-[11px] text-slate-600 font-semibold truncate max-w-[180px]">
                              {req.courseTitle || req.courseId}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-black font-mono text-slate-900 text-sm">
                        ৳{req.price || req.totalPrice || 0}
                      </td>

                      {/* bKash & TrxID */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-slate-800 font-semibold">{req.bkashNumber || 'N/A'}</span>
                          {req.bkashNumber && (
                            <button
                              onClick={() => copyToClipboard(req.bkashNumber, 'bKash Number')}
                              className="text-slate-400 hover:text-indigo-600 transition"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-indigo-600 font-black bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {req.trxId || 'No TrxID'}
                          </span>
                          {req.trxId && (
                            <button
                              onClick={() => copyToClipboard(req.trxId, 'Transaction ID')}
                              className="text-slate-400 hover:text-indigo-600 transition"
                            >
                              {copiedId === req.trxId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono">
                        {req.createdAt ? new Date(req.createdAt).toLocaleString() : 'N/A'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[11px] font-black">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Approved
                          </span>
                        )}
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[11px] font-black">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-[11px] font-black">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {req.status === 'pending' && onApprove && onReject ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onApprove(req)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1"
                            >
                              <ShieldCheck className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => onReject(req.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-bold text-[11px] rounded-lg transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono italic">Synced to Server</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
