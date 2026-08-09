import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc } from '../lib/db';
import { AccessRequest } from '../types';
import { TransactionLogItem } from './TransactionDebugger';
import { 
  Wallet, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Search, 
  Lock, 
  RefreshCw, 
  ArrowRight,
  Database,
  Filter,
  ShieldAlert,
  TerminalSquare
} from 'lucide-react';

export interface UsedTransactionDoc {
  id: string; // Trx ID
  trxId?: string;
  userEmail?: string;
  email?: string;
  spent?: boolean;
  status?: string;
  amount?: number;
  usedAt?: string;
  claimedAt?: string;
  courseId?: string;
  [key: string]: any;
}

export interface UserWalletDoc {
  id: string; // Email ID
  email?: string;
  balance?: number;
  walletBalance?: number;
  updatedAt?: string;
  [key: string]: any;
}

interface WalletDebuggerProps {
  accessRequests: AccessRequest[];
  transactionLogs: TransactionLogItem[];
  onRetryTransaction: (req: AccessRequest, action: 'approve' | 'reject') => Promise<boolean>;
  onRefreshRequests: () => void;
  isProcessing: boolean;
  adminUserEmail: string;
}

export const WalletDebugger: React.FC<WalletDebuggerProps> = ({
  accessRequests,
  transactionLogs,
  onRetryTransaction,
  onRefreshRequests,
  isProcessing,
  adminUserEmail
}) => {
  const [usedTransactions, setUsedTransactions] = useState<UsedTransactionDoc[]>([]);
  const [userWallets, setUserWallets] = useState<UserWalletDoc[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'pending-failed' | 'used-transactions' | 'user-wallets'>('pending-failed');
  const [searchTerm, setSearchTerm] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Real-time listener for used_transactions collection
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const colRef = collection(db, 'used_transactions');
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          if (snapshot && snapshot.docs) {
            const docs: UsedTransactionDoc[] = snapshot.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data()
            }));
            setUsedTransactions(docs);
          }
          setLoadingCollections(false);
        },
        (err) => {
          console.warn('WalletDebugger used_transactions listener notice:', err);
          setLoadingCollections(false);
        }
      );
    } catch (e) {
      console.warn('WalletDebugger used_transactions setup exception:', e);
      setLoadingCollections(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Real-time listener for user_wallets collection
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const colRef = collection(db, 'user_wallets');
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          if (snapshot && snapshot.docs) {
            const docs: UserWalletDoc[] = snapshot.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data()
            }));
            setUserWallets(docs);
          }
        },
        (err) => {
          console.warn('WalletDebugger user_wallets listener notice:', err);
        }
      );
    } catch (e) {
      console.warn('WalletDebugger user_wallets setup exception:', e);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Filter pending or failed transactions from accessRequests & transactionLogs
  const pendingRequests = accessRequests.filter(r => r.status === 'pending');
  const failedLogs = transactionLogs.filter(l => l.status === 'failed');

  const filteredPending = pendingRequests.filter(r => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      r.email?.toLowerCase().includes(q) ||
      r.trxId?.toLowerCase().includes(q) ||
      r.bkashNumber?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q)
    );
  });

  const filteredUsedTx = usedTransactions.filter(tx => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      tx.id?.toLowerCase().includes(q) ||
      tx.userEmail?.toLowerCase().includes(q) ||
      tx.email?.toLowerCase().includes(q) ||
      tx.trxId?.toLowerCase().includes(q)
    );
  });

  const filteredWallets = userWallets.filter(w => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      w.id?.toLowerCase().includes(q) ||
      w.email?.toLowerCase().includes(q)
    );
  });

  const handleRetry = async (req: AccessRequest) => {
    setRetryingId(req.id);
    try {
      await onRetryTransaction(req, 'approve');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Component Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>Wallet & Locked Transactions Real-time Inspector</span>
              {loadingCollections && (
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
              )}
            </h2>
          </div>
          <p className="text-xs text-slate-300 font-medium">
            Live database queries for <code className="text-emerald-400 font-mono">used_transactions</code> and <code className="text-emerald-400 font-mono">user_wallets</code> collections with manual Retry controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefreshRequests}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>Sync Firestore</span>
          </button>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('pending-failed')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'pending-failed'
                ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                : 'hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending & Failed ({pendingRequests.length + failedLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('used-transactions')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'used-transactions'
                ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                : 'hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-indigo-500" />
            <span>used_transactions ({usedTransactions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('user-wallets')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'user-wallets'
                ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                : 'hover:text-slate-900'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            <span>user_wallets ({userWallets.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search email, TrxID, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* TAB 1: Pending & Failed Transactions with Manual Retry Button */}
      {activeSubTab === 'pending-failed' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-indigo-600" />
                  Pending Access & Wallet Recharge Requests ({filteredPending.length})
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Trigger manual retry for requests that encountered write errors or remained in pending state.
                </p>
              </div>
            </div>

            {filteredPending.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No pending requests found</p>
                <p className="text-[11px] text-slate-400">All user transactions have been settled or verified.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase font-mono">
                      <th className="px-3.5 py-2.5">Request ID</th>
                      <th className="px-3.5 py-2.5">User Email</th>
                      <th className="px-3.5 py-2.5">Type / Course</th>
                      <th className="px-3.5 py-2.5">Trx ID / bKash</th>
                      <th className="px-3.5 py-2.5">Amount</th>
                      <th className="px-3.5 py-2.5 text-right">Retry Logic Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {filteredPending.map((req) => {
                      const isRetrying = retryingId === req.id || isProcessing;
                      const isRecharge = req.courseId === 'wallet_recharge' || req.courseTitle?.toLowerCase().includes('wallet');

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-3.5 py-3 font-mono text-[11px] font-bold text-slate-600">
                            {req.id}
                          </td>
                          <td className="px-3.5 py-3 font-mono font-bold text-slate-900">
                            {req.email}
                          </td>
                          <td className="px-3.5 py-3">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${isRecharge ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>
                              {isRecharge ? 'Wallet Recharge' : req.courseTitle || req.courseId}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 font-mono text-slate-600 text-[11px]">
                            <div className="font-bold text-pink-700">{req.trxId || 'No TrxID'}</div>
                            <div className="text-[10px] text-slate-400">{req.bkashNumber || 'No Phone'}</div>
                          </td>
                          <td className="px-3.5 py-3 font-mono font-extrabold text-emerald-700 text-sm">
                            ৳{req.totalPrice || req.price || 0}
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRetry(req)}
                              disabled={isRetrying}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5 ml-auto disabled:opacity-50"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                              <span>{isRetrying ? 'Processing...' : 'Retry Transaction'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Failed Audit Logs */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Failed Session Audit Errors ({failedLogs.length})
            </h3>
            {failedLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No failed transaction errors logged in current session.</p>
            ) : (
              <div className="space-y-2">
                {failedLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between font-mono text-[10px] text-rose-700 font-bold">
                      <span>Target: {log.userEmail}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-800 font-medium">{log.details}</p>
                    {log.error && (
                      <p className="text-[11px] text-rose-600 font-mono font-bold bg-white p-1.5 rounded border border-rose-200">
                        {log.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: used_transactions Collection Real-time Table */}
      {activeSubTab === 'used-transactions' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                used_transactions Collection Documents ({filteredUsedTx.length})
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Live locks preventing duplicate transaction reuse across the application.
              </p>
            </div>
          </div>

          {filteredUsedTx.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl space-y-1">
              <Lock className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">No used_transactions documents found</p>
              <p className="text-[11px] text-slate-400">Lock documents are created automatically when transactions are approved or claimed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase font-mono">
                    <th className="px-3.5 py-2.5">TrxID (Doc ID)</th>
                    <th className="px-3.5 py-2.5">User Email</th>
                    <th className="px-3.5 py-2.5">Spent / Locked</th>
                    <th className="px-3.5 py-2.5">Amount</th>
                    <th className="px-3.5 py-2.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {filteredUsedTx.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-3.5 py-3 font-mono font-extrabold text-pink-700 text-xs">
                        {tx.id}
                      </td>
                      <td className="px-3.5 py-3 font-mono font-bold text-slate-800">
                        {tx.userEmail || tx.email || 'System Locked'}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold text-[10px] rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          LOCKED (SPENT)
                        </span>
                      </td>
                      <td className="px-3.5 py-3 font-mono font-bold text-slate-800">
                        ৳{tx.amount || 0} BDT
                      </td>
                      <td className="px-3.5 py-3 font-mono text-[11px] text-slate-500">
                        {tx.usedAt || tx.claimedAt || tx.timestamp || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: user_wallets Collection Real-time Table */}
      {activeSubTab === 'user-wallets' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                user_wallets Collection Documents ({filteredWallets.length})
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Live balances stored in Firestore <code className="text-indigo-600 font-mono">user_wallets</code> collection.
              </p>
            </div>
          </div>

          {filteredWallets.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl space-y-1">
              <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">No user_wallets documents found</p>
              <p className="text-[11px] text-slate-400">Wallet documents are created on student login or first recharge.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase font-mono">
                    <th className="px-3.5 py-2.5">Email (Doc ID)</th>
                    <th className="px-3.5 py-2.5">Balance</th>
                    <th className="px-3.5 py-2.5">Wallet Balance Field</th>
                    <th className="px-3.5 py-2.5">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {filteredWallets.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-3.5 py-3 font-mono font-bold text-slate-900">
                        {w.id}
                      </td>
                      <td className="px-3.5 py-3 font-mono font-extrabold text-emerald-700 text-sm">
                        ৳{w.balance ?? 0} BDT
                      </td>
                      <td className="px-3.5 py-3 font-mono text-slate-600">
                        ৳{w.walletBalance ?? w.balance ?? 0} BDT
                      </td>
                      <td className="px-3.5 py-3 font-mono text-[11px] text-slate-500">
                        {w.updatedAt ? new Date(w.updatedAt).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
