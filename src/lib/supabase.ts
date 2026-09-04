import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default project fallback
const DEFAULT_SUPABASE_URL = 'https://haaxqfhkucuimyvyksrj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhYXhxZmhrdWN1aW15dnlrc3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMzM4NzksImV4cCI6MjEwMzgwOTg3OX0.CVwyDYh_XMwtSqG05KFjBIEXmo_m4r0SskOwpemOecs';

export interface DatabaseEndpointInfo {
  url: string;
  urlSource: 'localStorage' | 'import.meta.env' | 'process.env' | 'default';
  hasKey: boolean;
  keySource: 'localStorage' | 'import.meta.env' | 'process.env' | 'none';
  keyType: 'anon' | 'service_role' | 'placeholder' | 'none';
  keyPreview: string;
}

/**
 * Safely retrieve environment variable from either Vite's import.meta.env or Node's process.env
 */
function readEnvVar(name: string): string {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
      const val = (import.meta as any).env[name];
      if (val && typeof val === 'string' && val.trim()) return val.trim();
    }
  } catch (e) {}

  try {
    if (typeof process !== 'undefined' && process?.env) {
      const val = process.env[name];
      if (val && typeof val === 'string' && val.trim()) return val.trim();
    }
  } catch (e) {}

  return '';
}

export function getStoredSupabaseUrl(): string {
  // 1. Check LocalStorage (configured via Admin UI)
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('vocab_supabase_url') || localStorage.getItem('supabase_url');
    if (local && local.trim()) return local.trim();
  }

  // 2. Check Environment Variables (Vite & Process)
  const envUrl = 
    readEnvVar('VITE_SUPABASE_URL') || 
    readEnvVar('SUPABASE_URL') || 
    readEnvVar('VITE_SUPABASE_PROJECT_URL') ||
    readEnvVar('PUBLIC_SUPABASE_URL');

  if (envUrl) return envUrl;

  // 3. Fallback to default project URL
  return DEFAULT_SUPABASE_URL;
}

export function getStoredSupabaseKey(): string {
  // 1. Check LocalStorage
  if (typeof window !== 'undefined') {
    const serviceKey = localStorage.getItem('vocab_supabase_service_key');
    if (serviceKey && serviceKey.trim()) return serviceKey.trim();

    const anonKey = 
      localStorage.getItem('vocab_supabase_anon_key') || 
      localStorage.getItem('supabase_anon_key') || 
      localStorage.getItem('supabase_key');
    if (anonKey && anonKey.trim()) return anonKey.trim();
  }

  // 2. Check Environment Variables
  const envKey = 
    readEnvVar('VITE_SUPABASE_ANON_KEY') || 
    readEnvVar('SUPABASE_ANON_KEY') || 
    readEnvVar('VITE_SUPABASE_KEY') || 
    readEnvVar('SUPABASE_SERVICE_ROLE_KEY') ||
    readEnvVar('SUPABASE_KEY');

  if (envKey) return envKey;

  // 3. Fallback to default project anon key
  return DEFAULT_SUPABASE_ANON_KEY;
}

export function setStoredSupabaseCredentials(url?: string, key?: string): void {
  if (typeof window === 'undefined') return;
  if (url && url.trim()) {
    localStorage.setItem('vocab_supabase_url', url.trim());
  }
  if (key && key.trim()) {
    localStorage.setItem('vocab_supabase_anon_key', key.trim());
  }
  cachedClient = null;
  currentClientUrl = '';
  currentClientKey = '';
}

/**
 * Returns diagnostic metadata about the current Supabase connection configuration and source
 */
export function getDatabaseEndpointInfo(): DatabaseEndpointInfo {
  let url = DEFAULT_SUPABASE_URL;
  let urlSource: DatabaseEndpointInfo['urlSource'] = 'default';

  if (typeof window !== 'undefined' && (localStorage.getItem('vocab_supabase_url') || localStorage.getItem('supabase_url'))) {
    url = (localStorage.getItem('vocab_supabase_url') || localStorage.getItem('supabase_url'))!.trim();
    urlSource = 'localStorage';
  } else if (readEnvVar('VITE_SUPABASE_URL')) {
    url = readEnvVar('VITE_SUPABASE_URL');
    urlSource = 'import.meta.env';
  } else if (readEnvVar('SUPABASE_URL')) {
    url = readEnvVar('SUPABASE_URL');
    urlSource = 'process.env';
  }

  let key = '';
  let keySource: DatabaseEndpointInfo['keySource'] = 'none';

  if (typeof window !== 'undefined' && (localStorage.getItem('vocab_supabase_service_key') || localStorage.getItem('vocab_supabase_anon_key') || localStorage.getItem('supabase_anon_key'))) {
    key = (localStorage.getItem('vocab_supabase_service_key') || localStorage.getItem('vocab_supabase_anon_key') || localStorage.getItem('supabase_anon_key'))!.trim();
    keySource = 'localStorage';
  } else if (readEnvVar('VITE_SUPABASE_ANON_KEY') || readEnvVar('VITE_SUPABASE_KEY')) {
    key = readEnvVar('VITE_SUPABASE_ANON_KEY') || readEnvVar('VITE_SUPABASE_KEY');
    keySource = 'import.meta.env';
  } else if (readEnvVar('SUPABASE_ANON_KEY') || readEnvVar('SUPABASE_SERVICE_ROLE_KEY')) {
    key = readEnvVar('SUPABASE_ANON_KEY') || readEnvVar('SUPABASE_SERVICE_ROLE_KEY');
    keySource = 'process.env';
  } else if (DEFAULT_SUPABASE_ANON_KEY) {
    key = DEFAULT_SUPABASE_ANON_KEY;
    keySource = 'default' as any;
  }

  let keyType: DatabaseEndpointInfo['keyType'] = 'none';
  if (key) {
    if (key.startsWith('sb_publishable_placeholder')) keyType = 'placeholder';
    else if (key.includes('role":"service_role"') || key.length > 200) keyType = 'service_role';
    else keyType = 'anon';
  }

  const keyPreview = key ? `${key.substring(0, 10)}...${key.substring(key.length - 6)}` : '(not set)';

  return {
    url,
    urlSource,
    hasKey: !!key && keyType !== 'placeholder',
    keySource,
    keyType,
    keyPreview
  };
}

let cachedClient: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';

export function getSupabase(): SupabaseClient {
  const url = getStoredSupabaseUrl();
  const key = getStoredSupabaseKey();

  if (!cachedClient || currentClientUrl !== url || currentClientKey !== key) {
    currentClientUrl = url;
    currentClientKey = key;
    
    // If no key is set yet, initialize with placeholder to prevent immediate JS crash before configuration
    const validKey = key || 'sb_publishable_placeholder_configure_in_admin_panel';
    cachedClient = createClient(url, validKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });
  }

  return cachedClient;
}

// Transparent Proxy for legacy imports: `import { supabase } from './supabase'`
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export interface SupabasePingResult {
  isReachable: boolean;
  status: 'connected' | 'unauthorized' | 'network_error' | 'misconfigured';
  statusCode?: number;
  latencyMs: number;
  message: string;
  endpoint: string;
  source: 'localStorage' | 'import.meta.env' | 'process.env' | 'default';
  keyType: 'anon' | 'service_role' | 'placeholder' | 'none';
  timestamp: string;
  dataSample?: any;
  errorDetails?: any;
}

/**
 * Temporary Utility function: Performs a simple ping to the Supabase instance using the anon key
 * Tests HTTP reachability, authentication handshake, and latency in milliseconds.
 */
export async function pingSupabaseInstance(customKey?: string): Promise<SupabasePingResult> {
  const startTime = performance.now();
  const info = getDatabaseEndpointInfo();
  const url = info.url;
  const key = customKey || getStoredSupabaseKey() || readEnvVar('VITE_SUPABASE_ANON_KEY') || readEnvVar('SUPABASE_ANON_KEY');
  const timestamp = new Date().toISOString();

  if (!url) {
    return {
      isReachable: false,
      status: 'misconfigured',
      latencyMs: 0,
      message: 'Supabase URL is not configured.',
      endpoint: '',
      source: info.urlSource,
      keyType: info.keyType,
      timestamp
    };
  }

  if (!key) {
    return {
      isReachable: false,
      status: 'misconfigured',
      latencyMs: 0,
      message: 'Supabase Anon/Public API Key is missing. Please configure it in Admin Panel > Cloud Migration.',
      endpoint: url,
      source: info.urlSource,
      keyType: 'none',
      timestamp
    };
  }

  try {
    // 1. Direct REST ping test using anon key on PostgREST root endpoint
    const restEndpoint = `${url.replace(/\/$/, '')}/rest/v1/`;
    let restResponse: Response | null = null;
    try {
      restResponse = await fetch(`${restEndpoint}?limit=1`, {
        method: 'GET',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
    } catch (fetchErr: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        isReachable: false,
        status: 'network_error',
        latencyMs,
        message: `Network Handshake Failed: ${fetchErr?.message || 'Could not reach Supabase endpoint. Check internet connection or CORS.'}`,
        endpoint: url,
        source: info.urlSource,
        keyType: info.keyType,
        timestamp,
        errorDetails: fetchErr
      };
    }

    const latencyMs = Math.round(performance.now() - startTime);

    // 2. Evaluate status codes
    if (restResponse) {
      if (restResponse.status === 401 || restResponse.status === 403) {
        return {
          isReachable: true,
          status: 'unauthorized',
          statusCode: restResponse.status,
          latencyMs,
          message: `Credential Rejection: Supabase responded with HTTP ${restResponse.status}. The Anon API Key was rejected.`,
          endpoint: url,
          source: info.urlSource,
          keyType: info.keyType,
          timestamp
        };
      }

      // Also verify querying a real table
      const client = getSupabase();
      const { data, error } = await client.from('courses').select('id, title').limit(1);

      if (error) {
        if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('API key')) {
          return {
            isReachable: true,
            status: 'unauthorized',
            statusCode: 401,
            latencyMs,
            message: `Supabase reached (${latencyMs}ms), but API key was rejected: ${error.message}`,
            endpoint: url,
            source: info.urlSource,
            keyType: info.keyType,
            timestamp,
            errorDetails: error
          };
        }
      }

      return {
        isReachable: true,
        status: 'connected',
        statusCode: 200,
        latencyMs,
        message: `Supabase backend is online & reachable (${latencyMs}ms response time).`,
        endpoint: url,
        source: info.urlSource,
        keyType: info.keyType,
        timestamp,
        dataSample: data
      };
    }

    return {
      isReachable: true,
      status: 'connected',
      statusCode: 200,
      latencyMs,
      message: `Supabase reached in ${latencyMs}ms.`,
      endpoint: url,
      source: info.urlSource,
      keyType: info.keyType,
      timestamp
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      isReachable: false,
      status: 'network_error',
      latencyMs,
      message: `Ping failure: ${err?.message || String(err)}`,
      endpoint: url,
      source: info.urlSource,
      keyType: info.keyType,
      timestamp,
      errorDetails: err
    };
  }
}

// Expose diagnostic tools globally in window for easy manual testing
if (typeof window !== 'undefined') {
  (window as any).pingSupabaseInstance = pingSupabaseInstance;
  (window as any).getDatabaseEndpointInfo = getDatabaseEndpointInfo;
  (window as any).getSupabase = getSupabase;
}
