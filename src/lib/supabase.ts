import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default project fallback
const DEFAULT_SUPABASE_URL = 'https://haaxqfhkucuimyvyksrj.supabase.co';

export function getStoredSupabaseUrl(): string {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('vocab_supabase_url') || localStorage.getItem('supabase_url');
    if (local && local.trim()) return local.trim();
  }
  const env = (import.meta as any).env || {};
  return (env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
}

export function getStoredSupabaseKey(): string {
  if (typeof window !== 'undefined') {
    const serviceKey = localStorage.getItem('vocab_supabase_service_key');
    if (serviceKey && serviceKey.trim()) return serviceKey.trim();

    const anonKey = localStorage.getItem('vocab_supabase_anon_key') || localStorage.getItem('supabase_anon_key') || localStorage.getItem('supabase_key');
    if (anonKey && anonKey.trim()) return anonKey.trim();
  }
  const env = (import.meta as any).env || {};
  return (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
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
    
    // If no key is set yet, initialize with dummy key to prevent crash before user configures
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

export interface SupabaseDiagnosticResult {
  success: boolean;
  message: string;
  url: string;
  latencyMs: number;
  dataSample?: any;
  error?: any;
}

/**
 * Diagnostic utility function to test Supabase connection and read permissions
 */
export async function testSupabaseConnection(tableName: string = 'users'): Promise<SupabaseDiagnosticResult> {
  const startTime = performance.now();
  const url = getStoredSupabaseUrl();
  const key = getStoredSupabaseKey();

  if (!key) {
    return {
      success: false,
      message: 'Supabase API Key (Anon/Service Role) is missing. Please configure it in Admin Panel > Supabase Sync.',
      url,
      latencyMs: 0,
    };
  }

  try {
    const client = getSupabase();

    // Query 1: users table
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .limit(1);

    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      // Fallback query to courses table
      if (tableName !== 'courses') {
        const fallback = await client.from('courses').select('*').limit(1);
        if (!fallback.error) {
          return {
            success: true,
            message: `Supabase connection verified via 'courses' table (${latencyMs}ms).`,
            url,
            latencyMs,
            dataSample: fallback.data,
          };
        }
      }

      return {
        success: false,
        message: `Supabase query on '${tableName}' failed: ${error.message || JSON.stringify(error)}`,
        url,
        latencyMs,
        error,
      };
    }

    return {
      success: true,
      message: `Supabase connected successfully. Query on '${tableName}' returned in ${latencyMs}ms.`,
      url,
      latencyMs,
      dataSample: data,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      message: `Supabase connection error: ${err?.message || String(err)}`,
      url,
      latencyMs,
      error: err,
    };
  }
}

// Expose diagnostic tool globally in window for easy testing in DevTools console
if (typeof window !== 'undefined') {
  (window as any).testSupabaseConnection = testSupabaseConnection;
  (window as any).getSupabase = getSupabase;
}
