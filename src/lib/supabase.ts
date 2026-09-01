import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://haaxqfhkucuimyvyksrj.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_abgr_qMdFxAOn8IhHpm_PA_GamaQUgF';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SupabaseDiagnosticResult {
  success: boolean;
  message: string;
  url: string;
  latencyMs: number;
  dataSample?: any;
  error?: any;
}

/**
 * Diagnostic utility function to verify Supabase client initialization
 * and perform a simple 'read' operation on the database to verify active connection.
 */
export async function testSupabaseConnection(tableName: string = 'users'): Promise<SupabaseDiagnosticResult> {
  const startTime = performance.now();
  try {
    if (!supabase) {
      return {
        success: false,
        message: 'Supabase client is not initialized.',
        url: supabaseUrl,
        latencyMs: 0,
      };
    }

    // Perform a simple 'read' query with limit 1
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      // Attempt fallback table read if primary table fails
      if (tableName !== 'courses') {
        const fallback = await supabase.from('courses').select('*').limit(1);
        if (!fallback.error) {
          return {
            success: true,
            message: `Supabase connection verified via fallback table 'courses' in ${Math.round(performance.now() - startTime)}ms.`,
            url: supabaseUrl,
            latencyMs: Math.round(performance.now() - startTime),
            dataSample: fallback.data,
          };
        }
      }

      return {
        success: false,
        message: `Supabase query on table '${tableName}' failed: ${error.message || JSON.stringify(error)}`,
        url: supabaseUrl,
        latencyMs,
        error,
      };
    }

    return {
      success: true,
      message: `Supabase connection active and verified. Read test on '${tableName}' completed in ${latencyMs}ms.`,
      url: supabaseUrl,
      latencyMs,
      dataSample: data,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      message: `Unexpected exception testing Supabase connection: ${err?.message || String(err)}`,
      url: supabaseUrl,
      latencyMs,
      error: err,
    };
  }
}

// Attach to window object in browser environment for quick console diagnostics
if (typeof window !== 'undefined') {
  (window as any).testSupabaseConnection = testSupabaseConnection;
}

