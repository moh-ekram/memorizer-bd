import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qredixumhxjcaymwqcec.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_abgr_qMdFxAOn8IhHpm_PA_GamaQUgF';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
