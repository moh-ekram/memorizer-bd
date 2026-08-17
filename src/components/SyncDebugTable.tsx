import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VocabularyWord, UserProgress, WordStatus } from '../types';
import { 
  Database, 
  RefreshCw, 
  UploadCloud, 
  DownloadCloud, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  ArrowRightLeft,
  Info,
  CheckCircle,
  HelpCircle,
  Circle,
  ExternalLink,
  Flame,
  Activity
} from 'lucide-react';
import { mergeProgressRecords } from '../utils/syncUtils';
import { safeSetLocalStorage } from '../lib/storage';

interface SyncDebugTableProps {
  localProgress: Record<string, UserProgress>;
  onUpdateLocalProgress?: (newProgress: Record<string, UserProgress>) => void;
  words: VocabularyWord[];
  userEmail?: string | null;
  userId?: string | null;
  onTriggerSync?: () => Promise<void> | void;
}

export default function SyncDebugTable({
  localProgress = {},
  onUpdateLocalProgress,
  words = [],
  userEmail,
  userId,
  onTriggerSync
}: SyncDebugTableProps) {
  const [cloudProgress, setCloudProgress] = useState<Record<string, UserProgress> | null>(null);
  const [cloudRawDoc, setCloudRawDoc] = useState<any>(null);
  const [cloudEmailDoc, setCloudEmailDoc] = useState<any>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'mismatch' | 'local_newer' | 'cloud_newer' | 'studied' | 'unrated'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isTestingLatency, setIsTestingLatency] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  const cleanEmail = (userEmail || '').trim().toLowerCase();
  const effectiveUid = userId || '';

  // Listen to Cloud progress in real-time
  useEffect(() => {
    if (!effectiveUid && !cleanEmail) return;

    setLoadingCloud(true);
    const targetUid = effectiveUid || cleanEmail;
    const userDocRef = doc(db, 'users', targetUid);

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      setLoadingCloud(false);
      setLastFetchedAt(new Date());
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCloudRawDoc(data);
        if (data.progress && typeof data.progress === 'object') {
          setCloudProgress(data.progress);
        } else {
          setCloudProgress({});
        }
      } else {
        setCloudRawDoc(null);
        setCloudProgress({});
      }
    }, (err) => {
      console.warn('[SyncDebugTable] Firestore snapshot error:', err);
      setLoadingCloud(false);
    });

    // Also fetch secondary email doc if different
    if (cleanEmail && cleanEmail !== targetUid) {
      getDoc(doc(db, 'users', cleanEmail)).then(eSnap => {
        if (eSnap.exists()) {
          setCloudEmailDoc(eSnap.data());
        }
      }).catch(console.warn);
    }

    return () => {
      unsubscribe();
    };
  }, [effectiveUid, cleanEmail]);

  // Manual Refresh Cloud Data
  const handleRefreshCloud = async () => {
    setLoadingCloud(true);
    setActionMessage(null);
    try {
      const targetUid = effectiveUid || cleanEmail;
      if (!targetUid) return;

      const snap = await getDoc(doc(db, 'users', targetUid));
      setLastFetchedAt(new Date());
      if (snap.exists()) {
        const data = snap.data();
        setCloudRawDoc(data);
        setCloudProgress(data.progress || {});
      } else {
        setCloudRawDoc(null);
        setCloudProgress({});
      }

      if (cleanEmail && cleanEmail !== targetUid) {
        const eSnap = await getDoc(doc(db, 'users', cleanEmail));
        if (eSnap.exists()) {
          setCloudEmailDoc(eSnap.data());
        }
      }

      setActionMessage({ text: 'Cloud snapshot refreshed successfully!', type: 'success' });
    } catch (e: any) {
      console.error('Error refreshing cloud snapshot:', e);
      setActionMessage({ text: `Failed to refresh: ${e.message}`, type: 'error' });
    } finally {
      setLoadingCloud(false);
    }
  };

  // Test Round-trip Latency to Firestore
  const handleTestLatency = async () => {
    if (!effectiveUid && !cleanEmail) return;
    setIsTestingLatency(true);
    const start = performance.now();
    try {
      const targetUid = effectiveUid || cleanEmail;
      await getDoc(doc(db, 'users', targetUid));
      const end = performance.now();
      const diff = Math.round(end - start);
      setLatencyMs(diff);
      setActionMessage({ text: `Firestore latency test completed: ${diff}ms round-trip`, type: 'info' });
    } catch (e: any) {
      setActionMessage({ text: `Latency test failed: ${e.message}`, type: 'error' });
    } finally {
      setIsTestingLatency(false);
    }
  };

  // Push Local Progress to Cloud
  const handleForcePushLocalToCloud = async () => {
    if (!effectiveUid && !cleanEmail) return;
    setActionMessage({ text: 'Pushing local state to Cloud...', type: 'info' });
    try {
      const targetUid = effectiveUid || cleanEmail;
      const payload = {
        progress: localProgress,
        email: cleanEmail,
        updatedAt: new Date().toISOString(),
        lastDebugPushAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', targetUid), payload, { merge: true });
      if (cleanEmail && cleanEmail !== targetUid) {
        await setDoc(doc(db, 'users', cleanEmail), payload, { merge: true });
      }
      setCloudProgress(localProgress);
      setActionMessage({ text: `Successfully pushed ${Object.keys(localProgress).length} items from Local to Cloud!`, type: 'success' });
      if (onTriggerSync) onTriggerSync();
    } catch (e: any) {
      setActionMessage({ text: `Push failed: ${e.message}`, type: 'error' });
    }
  };

  // Pull Cloud Progress into Local State
  const handleForcePullCloudToLocal = () => {
    if (!cloudProgress) {
      setActionMessage({ text: 'No cloud progress available to pull.', type: 'error' });
      return;
    }
    try {
      if (onUpdateLocalProgress) {
        onUpdateLocalProgress(cloudProgress);
      }
      safeSetLocalStorage('vocab_memorizer_progress_v2', JSON.stringify(cloudProgress));
      setActionMessage({ text: `Successfully loaded ${Object.keys(cloudProgress).length} items from Cloud to Local!`, type: 'success' });
    } catch (e: any) {
      setActionMessage({ text: `Pull failed: ${e.message}`, type: 'error' });
    }
  };

  // Smart Reconcile (Merge by Timestamp)
  const handleSmartReconcile = async () => {
    if (!effectiveUid && !cleanEmail) return;
    setActionMessage({ text: 'Reconciling Local & Cloud by timestamps...', type: 'info' });
    try {
      const merged = mergeProgressRecords(localProgress, cloudProgress || {});
      if (onUpdateLocalProgress) {
        onUpdateLocalProgress(merged);
      }
      safeSetLocalStorage('vocab_memorizer_progress_v2', JSON.stringify(merged));

      const targetUid = effectiveUid || cleanEmail;
      const payload = {
        progress: merged,
        email: cleanEmail,
        updatedAt: new Date().toISOString(),
        reconciledAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', targetUid), payload, { merge: true });
      if (cleanEmail && cleanEmail !== targetUid) {
        await setDoc(doc(db, 'users', cleanEmail), payload, { merge: true });
      }
      setCloudProgress(merged);
      setActionMessage({ text: `Reconciled & synchronized ${Object.keys(merged).length} items across Local and Cloud!`, type: 'success' });
    } catch (e: any) {
      setActionMessage({ text: `Reconciliation failed: ${e.message}`, type: 'error' });
    }
  };

  // Push single word to cloud
  const handlePushSingleWord = async (wordId: string) => {
    const localItem = localProgress[wordId];
    if (!localItem) return;
    const targetUid = effectiveUid || cleanEmail;
    if (!targetUid) return;
    try {
      const updatedCloud = { ...(cloudProgress || {}), [wordId]: localItem };
      await setDoc(doc(db, 'users', targetUid), { progress: { [wordId]: localItem }, updatedAt: new Date().toISOString() }, { merge: true });
      setCloudProgress(updatedCloud);
      setActionMessage({ text: `Word ${wordId} pushed to Cloud!`, type: 'success' });
    } catch (e: any) {
      setActionMessage({ text: `Failed to push word: ${e.message}`, type: 'error' });
    }
  };

  // Pull single word from cloud
  const handlePullSingleWord = (wordId: string) => {
    const cloudItem = cloudProgress?.[wordId];
    if (!cloudItem) return;
    const updatedLocal = { ...localProgress, [wordId]: cloudItem };
    if (onUpdateLocalProgress) {
      onUpdateLocalProgress(updatedLocal);
    }
    safeSetLocalStorage('vocab_memorizer_progress_v2', JSON.stringify(updatedLocal));
    setActionMessage({ text: `Word ${wordId} pulled from Cloud to Local!`, type: 'success' });
  };

  // Format dates cleanly
  const formatTimeAgo = (iso?: string) => {
    if (!iso) return 'Never / None';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const diffSecs = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSecs < 10) return 'Just now';
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch (e) {
      return iso;
    }
  };

  const formatExact = (iso?: string) => {
    if (!iso) return 'Not available';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return iso;
    }
  };

  // Compute all unique word items to compare
  const comparisonItems = useMemo(() => {
    const wordMap = new Map<string, VocabularyWord>();
    words.forEach(w => wordMap.set(w.id, w));

    // Gather all IDs from words array, localProgress, and cloudProgress
    const allIds = Array.from(new Set([
      ...words.map(w => w.id),
      ...Object.keys(localProgress || {}),
      ...Object.keys(cloudProgress || {})
    ]));

    return allIds.map(id => {
      const wordObj = wordMap.get(id);
      const local = localProgress?.[id] || null;
      const cloud = cloudProgress?.[id] || null;

      const localStatus: WordStatus = local?.status || 'unrated';
      const cloudStatus: WordStatus = cloud?.status || 'unrated';

      const localTime = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const cloudTime = cloud?.updatedAt ? new Date(cloud.updatedAt).getTime() : 0;

      const timeDeltaMs = localTime - cloudTime;
      const isStatusEqual = localStatus === cloudStatus;
      const hasLocalData = !!local;
      const hasCloudData = !!cloud;

      let matchType: 'in_sync' | 'local_newer' | 'cloud_newer' | 'mismatch' | 'missing_cloud' | 'missing_local' = 'in_sync';

      if (!hasCloudData && hasLocalData && localStatus !== 'unrated') {
        matchType = 'missing_cloud';
      } else if (!hasLocalData && hasCloudData && cloudStatus !== 'unrated') {
        matchType = 'missing_local';
      } else if (!isStatusEqual) {
        matchType = 'mismatch';
      } else if (Math.abs(timeDeltaMs) > 2000) {
        if (localTime > cloudTime) {
          matchType = 'local_newer';
        } else {
          matchType = 'cloud_newer';
        }
      } else {
        matchType = 'in_sync';
      }

      const isStudied = localStatus !== 'unrated' || cloudStatus !== 'unrated';

      return {
        id,
        word: wordObj?.word || id,
        meaning: wordObj?.meaning || '',
        group: wordObj?.group || 'Custom',
        local,
        cloud,
        localStatus,
        cloudStatus,
        localTime,
        cloudTime,
        timeDeltaMs,
        isStatusEqual,
        matchType,
        isStudied
      };
    });
  }, [words, localProgress, cloudProgress]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let localStudied = 0;
    let cloudStudied = 0;
    let localUnrated = 0;
    let cloudUnrated = 0;
    let inSync = 0;
    let mismatches = 0;
    let localNewer = 0;
    let cloudNewer = 0;

    comparisonItems.forEach(item => {
      if (item.localStatus !== 'unrated') localStudied++;
      else localUnrated++;

      if (item.cloudStatus !== 'unrated') cloudStudied++;
      else cloudUnrated++;

      if (item.matchType === 'in_sync') inSync++;
      else if (item.matchType === 'mismatch' || item.matchType === 'missing_cloud' || item.matchType === 'missing_local') mismatches++;
      else if (item.matchType === 'local_newer') localNewer++;
      else if (item.matchType === 'cloud_newer') cloudNewer++;
    });

    return {
      totalItems: comparisonItems.length,
      localStudied,
      cloudStudied,
      localUnrated,
      cloudUnrated,
      inSync,
      mismatches,
      localNewer,
      cloudNewer
    };
  }, [comparisonItems]);

  // Filtered and Paginated Items
  const filteredItems = useMemo(() => {
    return comparisonItems.filter(item => {
      // Group filter
      if (selectedGroup !== 'all' && String(item.group) !== selectedGroup) {
        return false;
      }

      // Status Filter
      if (statusFilter === 'mismatch' && (item.matchType !== 'mismatch' && item.matchType !== 'missing_cloud' && item.matchType !== 'missing_local')) {
        return false;
      }
      if (statusFilter === 'local_newer' && item.matchType !== 'local_newer' && item.matchType !== 'missing_cloud') {
        return false;
      }
      if (statusFilter === 'cloud_newer' && item.matchType !== 'cloud_newer' && item.matchType !== 'missing_local') {
        return false;
      }
      if (statusFilter === 'studied' && !item.isStudied) {
        return false;
      }
      if (statusFilter === 'unrated' && (item.localStatus !== 'unrated' || item.cloudStatus !== 'unrated')) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesWord = item.word.toLowerCase().includes(q);
        const matchesMeaning = item.meaning.toLowerCase().includes(q);
        const matchesId = item.id.toLowerCase().includes(q);
        return matchesWord || matchesMeaning || matchesId;
      }

      return true;
    });
  }, [comparisonItems, selectedGroup, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Unique groups list
  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    words.forEach(w => {
      if (w.group !== undefined) groups.add(String(w.group));
    });
    return Array.from(groups).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [words]);

  // Copy Debug Diagnostics Report to Clipboard
  const handleCopyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      user: {
        email: cleanEmail,
        uid: effectiveUid
      },
      diagnostics: {
        latencyMs,
        totalWords: words.length,
        localTotalKeys: Object.keys(localProgress || {}).length,
        cloudTotalKeys: Object.keys(cloudProgress || {}).length,
        localStudiedCount: summaryMetrics.localStudied,
        cloudStudiedCount: summaryMetrics.cloudStudied,
        localUnratedCount: summaryMetrics.localUnrated,
        cloudUnratedCount: summaryMetrics.cloudUnrated,
        inSyncCount: summaryMetrics.inSync,
        mismatchesCount: summaryMetrics.mismatches,
        localNewerCount: summaryMetrics.localNewer,
        cloudNewerCount: summaryMetrics.cloudNewer,
        cloudDocUpdatedAt: cloudRawDoc?.updatedAt || 'none',
        hasCloudDoc: !!cloudRawDoc,
        hasCloudEmailDoc: !!cloudEmailDoc
      },
      sampleMismatches: comparisonItems
        .filter(item => item.matchType !== 'in_sync')
        .slice(0, 30)
        .map(item => ({
          id: item.id,
          word: item.word,
          localStatus: item.localStatus,
          localUpdatedAt: item.local?.updatedAt,
          cloudStatus: item.cloudStatus,
          cloudUpdatedAt: item.cloud?.updatedAt,
          matchType: item.matchType,
          deltaSec: Math.round(item.timeDeltaMs / 1000)
        }))
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const getStatusBadge = (status: WordStatus) => {
    switch (status) {
      case 'know':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Learned
          </span>
        );
      case 'dont_know':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-600" />
            Not Learned
          </span>
        );
      case 'confusion':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <HelpCircle className="w-3 h-3 text-amber-600" />
            Confused
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-250">
            <Circle className="w-2.5 h-2.5 text-slate-400" />
            Unrated
          </span>
        );
    }
  };

  const getSyncDiffBadge = (matchType: string, deltaMs: number) => {
    switch (matchType) {
      case 'in_sync':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            In Sync
          </span>
        );
      case 'local_newer':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title={`Local is ${Math.round(deltaMs / 1000)}s newer`}>
            <Clock className="w-3 h-3 text-amber-500" />
            Local Ahead
          </span>
        );
      case 'cloud_newer':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200" title={`Cloud is ${Math.round(-deltaMs / 1000)}s newer`}>
            <DownloadCloud className="w-3 h-3 text-sky-500" />
            Cloud Ahead
          </span>
        );
      case 'missing_cloud':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <AlertTriangle className="w-3 h-3 text-orange-500" />
            Missing in Cloud
          </span>
        );
      case 'missing_local':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <DownloadCloud className="w-3 h-3 text-purple-500" />
            Missing Locally
          </span>
        );
      case 'mismatch':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Mismatch
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-5 shadow-xs font-sans text-slate-800" id="sync-debug-panel">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-200 flex items-center justify-center text-violet-600 shrink-0 mt-0.5">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">Real-Time Sync Debugger</h2>
              <span className="px-2 py-0.5 bg-violet-100 text-violet-800 text-[10px] font-extrabold uppercase tracking-wider rounded-md border border-violet-200">
                Live Inspector
              </span>
              {loadingCloud && (
                <span className="inline-flex items-center gap-1 text-[11px] text-violet-600 font-semibold animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Streaming Cloud...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect live word-by-word state differences between your current browser and Cloud Firestore database with microsecond timestamps.
            </p>
          </div>
        </div>

        {/* Global Diagnostic Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTestLatency}
            disabled={isTestingLatency}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-250 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Measure network ping to Firestore"
          >
            <Zap className={`w-3.5 h-3.5 ${latencyMs !== null ? 'text-amber-500' : 'text-slate-500'} ${isTestingLatency ? 'animate-spin' : ''}`} />
            <span>{latencyMs !== null ? `${latencyMs}ms Ping` : 'Test Ping'}</span>
          </button>

          <button
            onClick={handleRefreshCloud}
            disabled={loadingCloud}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-250 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loadingCloud ? 'animate-spin' : ''}`} />
            <span>Refresh Cloud</span>
          </button>

          <button
            onClick={handleCopyReport}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedReport ? 'Report Copied!' : 'Copy Debug Report'}</span>
          </button>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-all ${
          actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
          actionMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
          'bg-indigo-50 text-indigo-800 border border-indigo-200'
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
             actionMessage.type === 'error' ? <XCircle className="w-4 h-4 text-rose-600" /> :
             <Info className="w-4 h-4 text-indigo-600" />}
            <span>{actionMessage.text}</span>
          </div>
          <button 
            onClick={() => setActionMessage(null)}
            className="text-[10px] text-slate-400 hover:text-slate-700 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Target Cloud Account Metadata Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Inspected User Account</span>
          <p className="text-xs font-bold text-slate-800 truncate" title={cleanEmail || 'No user logged in'}>
            {cleanEmail || 'Offline Guest Mode'}
          </p>
          <span className="text-[10px] text-slate-500 font-mono block truncate">
            UID: {effectiveUid ? effectiveUid.slice(0, 16) + '...' : 'none'}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Cloud Snapshot Status</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cloudRawDoc ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-xs font-bold text-slate-800">
              {cloudRawDoc ? `Document Found (${Object.keys(cloudProgress || {}).length} items)` : 'No Cloud Doc'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            Cloud Updated: {cloudRawDoc?.updatedAt ? formatTimeAgo(cloudRawDoc.updatedAt) : 'Never'}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Sync Health</span>
          <div className="flex items-center gap-2">
            {summaryMetrics.mismatches === 0 ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% In Sync
              </span>
            ) : (
              <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {summaryMetrics.mismatches} Mismatches Detected
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            Last Checked: {lastFetchedAt ? formatExact(lastFetchedAt.toISOString()) : 'Pending'}
          </span>
        </div>
      </div>

      {/* Visual KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Local Studied vs Unrated */}
        <div className="bg-emerald-50/60 border border-emerald-200/80 p-3.5 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Local Device</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-emerald-700">{summaryMetrics.localStudied}</span>
            <span className="text-[11px] font-bold text-emerald-600">Studied</span>
          </div>
          <div className="text-[10px] text-emerald-700/80 font-medium">
            Not Studied: <strong>{summaryMetrics.localUnrated}</strong>
          </div>
        </div>

        {/* Cloud Studied vs Unrated */}
        <div className="bg-sky-50/60 border border-sky-200/80 p-3.5 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block">Cloud Database</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-sky-700">{summaryMetrics.cloudStudied}</span>
            <span className="text-[11px] font-bold text-sky-600">Studied</span>
          </div>
          <div className="text-[10px] text-sky-700/80 font-medium">
            Not Studied: <strong>{summaryMetrics.cloudUnrated}</strong>
          </div>
        </div>

        {/* In-Sync count */}
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Matching Items</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-800">{summaryMetrics.inSync}</span>
            <span className="text-[11px] font-bold text-emerald-600">Synced</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            Identical state & status
          </div>
        </div>

        {/* Discrepancies count */}
        <div className={`p-3.5 rounded-xl space-y-1 border ${
          summaryMetrics.mismatches > 0 
            ? 'bg-rose-50/80 border-rose-200' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${
            summaryMetrics.mismatches > 0 ? 'text-rose-800' : 'text-slate-500'
          }`}>
            Discrepancies
          </span>
          <div className="flex items-baseline justify-between">
            <span className={`text-xl font-black ${
              summaryMetrics.mismatches > 0 ? 'text-rose-700' : 'text-slate-700'
            }`}>
              {summaryMetrics.mismatches}
            </span>
            <button
              onClick={() => setStatusFilter(statusFilter === 'mismatch' ? 'all' : 'mismatch')}
              className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              {statusFilter === 'mismatch' ? 'Show All' : 'Filter'}
            </button>
          </div>
          <div className={`text-[10px] font-medium ${
            summaryMetrics.mismatches > 0 ? 'text-rose-600' : 'text-slate-500'
          }`}>
            Local ahead: <strong>{summaryMetrics.localNewer}</strong> | Cloud ahead: <strong>{summaryMetrics.cloudNewer}</strong>
          </div>
        </div>
      </div>

      {/* Manual Bulk Recovery Controls */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-indigo-600 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-slate-800">Direct Sync Operations</h4>
            <p className="text-[11px] text-slate-500">Resolve any mismatch by forcing a push, pull, or timestamp merge.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSmartReconcile}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
            title="Merge latest changes from both local and cloud based on timestamps"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Smart 2-Way Merge</span>
          </button>

          <button
            onClick={handleForcePushLocalToCloud}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
            title="Overwrite Cloud with this device's progress"
          >
            <UploadCloud className="w-3 h-3" />
            <span>Push Local → Cloud</span>
          </button>

          <button
            onClick={handleForcePullCloudToLocal}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
            title="Overwrite this device's local memory with Cloud progress"
          >
            <DownloadCloud className="w-3 h-3" />
            <span>Pull Cloud → Local</span>
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="space-y-2.5 pt-1">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by word, meaning, or ID (e.g. g1-w1, abate)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-800 text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* Group Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-500">Group:</span>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-250 text-xs font-semibold rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-800 cursor-pointer"
            >
              <option value="all">All Groups ({words.length})</option>
              {availableGroups.map(g => (
                <option key={g} value={g}>Group {g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all' as const, label: `All Words (${comparisonItems.length})` },
            { id: 'mismatch' as const, label: `Discrepancies (${summaryMetrics.mismatches})`, alert: summaryMetrics.mismatches > 0 },
            { id: 'local_newer' as const, label: `Local Newer (${summaryMetrics.localNewer})` },
            { id: 'cloud_newer' as const, label: `Cloud Newer (${summaryMetrics.cloudNewer})` },
            { id: 'studied' as const, label: `Studied Only (${summaryMetrics.localStudied})` },
            { id: 'unrated' as const, label: `Unrated (${summaryMetrics.localUnrated})` },
          ].map(f => {
            const isActive = statusFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => {
                  setStatusFilter(f.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : f.alert
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                }`}
              >
                {f.alert && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 pl-4">Word / Meaning</th>
                <th className="p-3">Local Device Status</th>
                <th className="p-3">Cloud Status</th>
                <th className="p-3">Sync State & Delta</th>
                <th className="p-3 text-right pr-4">Quick Fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 text-xs font-medium">
                    No items match the current search query and filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedItems.map(item => {
                  const isExpanded = expandedWordId === item.id;
                  const isMismatch = item.matchType === 'mismatch' || item.matchType === 'missing_cloud' || item.matchType === 'missing_local';

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`hover:bg-slate-50/90 transition-colors ${
                        isMismatch ? 'bg-rose-50/30' : ''
                      }`}>
                        {/* Word column */}
                        <td className="p-3 pl-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-sm">{item.word}</span>
                                <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.2 bg-slate-100 rounded border border-slate-200">
                                  G{item.group}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                                {item.meaning || item.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Local Device Status */}
                        <td className="p-3">
                          <div className="space-y-1">
                            <div>{getStatusBadge(item.localStatus)}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span title={formatExact(item.local?.updatedAt)}>
                                {formatTimeAgo(item.local?.updatedAt)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Cloud Status */}
                        <td className="p-3">
                          <div className="space-y-1">
                            <div>{getStatusBadge(item.cloudStatus)}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span title={formatExact(item.cloud?.updatedAt)}>
                                {formatTimeAgo(item.cloud?.updatedAt)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Diff / Match State */}
                        <td className="p-3">
                          <div className="space-y-1">
                            <div>{getSyncDiffBadge(item.matchType, item.timeDeltaMs)}</div>
                            {item.timeDeltaMs !== 0 && (
                              <span className="text-[9px] font-mono text-slate-400 block">
                                Δ {Math.abs(Math.round(item.timeDeltaMs / 1000))}s {item.timeDeltaMs > 0 ? 'local lead' : 'cloud lead'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handlePushSingleWord(item.id)}
                              title="Push this word from Local to Cloud"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 border border-slate-200 transition cursor-pointer"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handlePullSingleWord(item.id)}
                              title="Pull this word from Cloud to Local"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 border border-slate-200 transition cursor-pointer"
                            >
                              <DownloadCloud className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setExpandedWordId(isExpanded ? null : item.id)}
                              title="Inspect raw JSON"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded JSON Inspector Row */}
                      {isExpanded && (
                        <tr className="bg-slate-900 text-slate-100 text-xs">
                          <td colSpan={5} className="p-4 space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                              <span className="font-mono font-bold text-violet-400">Raw Metadata: {item.id} ({item.word})</span>
                              <span>Timestamp comparison & custom attributes</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                                <span className="text-emerald-400 font-bold block">Local Object:</span>
                                <pre className="overflow-x-auto text-[10px] text-slate-300">
                                  {JSON.stringify(item.local || { status: 'unrated (not set)' }, null, 2)}
                                </pre>
                              </div>
                              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                                <span className="text-sky-400 font-bold block">Cloud Object:</span>
                                <pre className="overflow-x-auto text-[10px] text-slate-300">
                                  {JSON.stringify(item.cloud || { status: 'unrated (not set)' }, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="bg-slate-50 border-t border-slate-250 px-4 py-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{((currentPage - 1) * pageSize) + 1}</strong> to <strong className="text-slate-800">{Math.min(currentPage * pageSize, filteredItems.length)}</strong> of <strong className="text-slate-800">{filteredItems.length}</strong> items
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Prev
              </button>
              <span className="px-2 font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sync Diagnostic Explanations */}
      <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-3.5 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-violet-900 font-bold">
          <Info className="w-4 h-4 text-violet-600" />
          <span>Why does syncing sometimes show a count difference across devices?</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
          When one device (e.g., 186 unstudied) has rated more words than another device (e.g., 276 unstudied), the real-time sync engine merges items by the highest <code className="font-mono bg-violet-100/80 px-1 py-0.5 rounded text-violet-800 text-[10px]">updatedAt</code> timestamp. If a device has been offline or had cached state, click <strong>"Smart 2-Way Merge"</strong> or <strong>"Refresh Cloud"</strong> to immediately align all records.
        </p>
      </div>
    </div>
  );
}
