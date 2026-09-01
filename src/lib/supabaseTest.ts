import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://haaxqfhkucuimyvyksrj.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_abgr_qMdFxAOn8IhHpm_PA_GamaQUgF';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface VerificationResult {
  connected: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * Attempts to fetch a dummy record from a 'test_connection' table
 * to confirm the database link is operational.
 */
export async function verifyConnection(): Promise<VerificationResult> {
  try {
    const { data, error } = await supabase
      .from('test_connection')
      .select('*')
      .limit(1);

    if (error) {
      return {
        connected: false,
        message: `Failed to query 'test_connection': ${error.message}`,
        error,
      };
    }

    return {
      connected: true,
      message: "Successfully queried 'test_connection' table. Database connection is operational.",
      data,
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `Unexpected error during connection verification: ${err?.message || String(err)}`,
      error: err,
    };
  }
}

// Optional window hook for browser console diagnostic
if (typeof window !== 'undefined') {
  (window as any).verifySupabaseConnection = verifyConnection;
}
