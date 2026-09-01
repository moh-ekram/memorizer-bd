import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Zap, 
  ExternalLink, 
  Key, 
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { pingSupabaseInstance, getDatabaseEndpointInfo, SupabasePingResult, DatabaseEndpointInfo } from '../lib/supabase';
import { DetailedSyncError } from '../lib/syncErrorHandler';

interface SupabaseStatusBannerProps {
  lastSyncError?: DetailedSyncError | null;
  onClearSyncError?: () => void;
  compact?: boolean;
  className?: string;
  showDetailsDefault?: boolean;
}

export default function SupabaseStatusBanner({
  lastSyncError,
  onClearSyncError,
  compact = false,
  className = '',
  showDetailsDefault = false
}: SupabaseStatusBannerProps) {
  const [pingResult, setPingResult] = useState<SupabasePingResult | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [endpointInfo, setEndpointInfo] = useState<DatabaseEndpointInfo>(() => getDatabaseEndpointInfo());
  const [showDetails, setShowDetails] = useState(showDetailsDefault);

  const performPing = async () => {
    setIsPinging(true);
    try {
      const result = await pingSupabaseInstance();
      setPingResult(result);
      setEndpointInfo(getDatabaseEndpointInfo());
    } catch (err: any) {
      setPingResult({
        isReachable: false,
        status: 'network_error',
        latencyMs: 0,
        message: err?.message || 'Ping failed',
        endpoint: endpointInfo.url,
        source: endpointInfo.urlSource,
        keyType: endpointInfo.keyType,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    performPing();
  }, []);

  // Format status badge styles
  const isConnected = pingResult?.status === 'connected';
  const isUnauthorized = pingResult?.status === 'unauthorized';
  const isNetworkError = pingResult?.status === 'network_error';
  const isMisconfigured = pingResult?.status === 'misconfigured';

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
        isConnected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
        isUnauthorized ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
        isNetworkError ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' :
        'bg-slate-500/10 border-slate-500/30 text-slate-300'
      } ${className}`}>
        <div className={`w-2 h-2 rounded-full ${
          isPinging ? 'bg-indigo-400 animate-ping' :
          isConnected ? 'bg-emerald-400' :
          isUnauthorized ? 'bg-amber-400 animate-pulse' :
          'bg-rose-400'
        }`} />
        <span>
          {isPinging ? 'Testing Supabase...' :
           isConnected ? `Supabase Online (${pingResult?.latencyMs}ms)` :
           isUnauthorized ? 'Supabase Auth Failed' :
           isNetworkError ? 'Supabase Unreachable' : 'Supabase Checking'}
        </span>
        <button
          onClick={performPing}
          disabled={isPinging}
          className="ml-1 hover:opacity-75 text-[10px] underline cursor-pointer"
          title="Re-test connection"
        >
          {isPinging ? '...' : 'Ping'}
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border transition-all duration-200 ${
      lastSyncError ? 'bg-rose-950/20 border-rose-500/30' :
      isConnected ? 'bg-emerald-950/20 border-emerald-500/25' :
      isUnauthorized ? 'bg-amber-950/20 border-amber-500/30' :
      'bg-slate-900/60 border-slate-800'
    } p-3.5 sm:p-4 ${className}`} id="supabase-status-banner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${
            isConnected ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
            isUnauthorized ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' :
            isNetworkError ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' :
            'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
          }`}>
            {isPinging ? (
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            ) : isConnected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : isUnauthorized ? (
              <Key className="w-4 h-4 text-amber-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>Supabase Cloud Database</span>
              </h4>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                isConnected ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' :
                isUnauthorized ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' :
                isNetworkError ? 'bg-rose-500/15 border-rose-500/40 text-rose-300' :
                'bg-slate-700 border-slate-600 text-slate-300'
              }`}>
                {isPinging ? 'Pinging...' :
                 isConnected ? `🟢 Connected (${pingResult?.latencyMs}ms)` :
                 isUnauthorized ? '🟡 Credential Rejected' :
                 isNetworkError ? '🔴 Network Unreachable' :
                 isMisconfigured ? '⚙️ Configuration Needed' : 'Checking'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-md sm:max-w-xl">
              {pingResult?.message || 'Testing reachability to database instance...'}
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={performPing}
            disabled={isPinging}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm shadow-indigo-900/30"
            id="ping-supabase-btn"
          >
            <Zap className={`w-3 h-3 ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Testing...' : 'Ping Instance'}</span>
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg text-xs transition cursor-pointer border border-slate-700"
            title="Toggle endpoint details"
          >
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Diagnostic Details */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-[11px]">
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
            <span className="text-slate-500 font-semibold block text-[10px]">Target Supabase URL</span>
            <span className="text-slate-200 font-mono font-medium truncate block" title={endpointInfo.url}>
              {endpointInfo.url}
            </span>
            <span className="text-[9px] text-indigo-400 block mt-0.5">Source: {endpointInfo.urlSource}</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
            <span className="text-slate-500 font-semibold block text-[10px]">API Key Status</span>
            <span className="text-slate-200 font-mono font-medium truncate block">
              {endpointInfo.hasKey ? `${endpointInfo.keyType.toUpperCase()} (${endpointInfo.keyPreview})` : '⚠️ Missing / Not Configured'}
            </span>
            <span className="text-[9px] text-indigo-400 block mt-0.5">Source: {endpointInfo.keySource}</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 sm:col-span-2 md:col-span-1">
            <span className="text-slate-500 font-semibold block text-[10px]">Last Handshake Ping</span>
            <span className="text-slate-200 font-medium">
              {pingResult?.timestamp ? new Date(pingResult.timestamp).toLocaleTimeString() : 'Never'} ({pingResult?.latencyMs ?? 0}ms roundtrip)
            </span>
            <span className="text-[9px] text-emerald-400 block mt-0.5">Status: {pingResult?.statusCode ? `HTTP ${pingResult.statusCode}` : (isConnected ? 'HTTP 200' : 'Offline')}</span>
          </div>
        </div>
      )}

      {/* Sync Error / Credential Rejection Diagnostic Warning */}
      {lastSyncError && (
        <div className="mt-3 p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg flex items-start gap-2.5 text-xs text-rose-200">
          <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-300">
                [{lastSyncError.category}] {lastSyncError.title}
              </span>
              {onClearSyncError && (
                <button
                  onClick={onClearSyncError}
                  className="text-[10px] text-rose-400 hover:text-rose-200 underline cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
            <p className="text-[11px] text-rose-200/90 mt-0.5">{lastSyncError.description}</p>
            <div className="mt-1 text-[10px] bg-rose-950/80 p-1.5 rounded border border-rose-500/20 text-rose-300 font-medium">
              💡 <strong>Remedy:</strong> {lastSyncError.remedy}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
