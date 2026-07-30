import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://qredixumhxjcaymwqcec.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_abgr_qMdFxAOn8IhHpm_PA_GamaQUgF';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
