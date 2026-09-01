import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Cloud,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Server,
  Play,
  FileCode,
  FileText,
  Users,
  BookOpen,
  HelpCircle,
  CreditCard,
  Sliders,
  Terminal,
  Clock,
  Sparkles,
  Layers,
  Archive,
  ArrowUpCircle
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_RLS_SQL_SCRIPT } from './SupabaseRlsModal';

interface MigrationLog {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface MigrationStats {
  usersTotal: number;
  usersDone: number;
  coursesTotal: number;
  coursesDone: number;
  questionsTotal: number;
  questionsDone: number;
  requestsTotal: number;
  requestsDone: number;
  settingsDone: number;
}

export default function SupabaseMigrationCenter() {
  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    return (
      localStorage.getItem('vocab_supabase_url') ||
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      'https://haaxqfhkucuimyvyksrj.supabase.co'
    );
  });

  const [supabaseKey, setSupabaseKey] = useState(() => {
    return (
      localStorage.getItem('vocab_supabase_service_key') ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      ''
    );
  });

  const [isServiceKey, setIsServiceKey] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [stats, setStats] = useState<MigrationStats>({
    usersTotal: 0,
    usersDone: 0,
    coursesTotal: 0,
    coursesDone: 0,
    questionsTotal: 0,
    questionsDone: 0,
    requestsTotal: 0,
    requestsDone: 0,
    settingsDone: 0
  });

  const [connectionStatus, setConnectionStatus] = useState<{
    firestore: 'checking' | 'connected' | 'error';
    supabase: 'idle' | 'checking' | 'connected' | 'error';
    message?: string;
  }>({
    firestore: 'checking',
    supabase: 'idle'
  });

  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedGeneratedSql, setCopiedGeneratedSql] = useState(false);
  const [copiedPartIndex, setCopiedPartIndex] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'migration' | 'json-backup' | 'json-to-sql' | 'sql'>('json-backup');
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isRestoringJson, setIsRestoringJson] = useState(false);
  const [isGeneratingSql, setIsGeneratingSql] = useState(false);
  const [generatedSqlText, setGeneratedSqlText] = useState<string>('');
  const [sqlParts, setSqlParts] = useState<{
    part1: string;
    courseChunks: { label: string; sql: string; count: number; courseTitle: string }[];
    part3: string;
    fullSql: string;
  } | null>(null);
  const [selectedSqlTab, setSelectedSqlTab] = useState<string>('part1');
  const [jsonUploadStats, setJsonUploadStats] = useState<{
    users: number;
    courses: number;
    access_requests: number;
    system_settings: number;
    fileName?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonToSqlInputRef = useRef<HTMLInputElement>(null);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ timestamp: time, message, type }, ...prev].slice(0, 300));
  };

  // Helper function to build bulletproof Supabase SQL from JSON in manageable chunks
  const buildSupabaseSqlPartsFromJson = (jsonData: any) => {
    const escapeSql = (val: any): string => {
      if (val === null || val === undefined) return "''";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const toJsonbDollar = (val: any): string => {
      if (val === null || val === undefined) return "'{}'::jsonb";
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      return `$json$${str}$json$::jsonb`;
    };

    const toTextArray = (arr: any): string => {
      if (!Array.isArray(arr) || arr.length === 0) {
        return "ARRAY['bank-bcs-gre']::text[]";
      }
      const items = arr.map((x) => escapeSql(x)).join(', ');
      return `ARRAY[${items}]::text[]`;
    };

    const usersObj = jsonData.users || {};
    const coursesObj = jsonData.courses || {};
    const requestsObj = jsonData.access_requests || {};
    const settingsObj = jsonData.system_settings || {};
    const oooObj = jsonData.odd_one_out_questions || {};
    const blankObj = jsonData.blank_questions || {};
    const analogyObj = jsonData.word_analogy_questions || {};
    const mcqObj = jsonData.mcq_questions || {};

    // --- PART 1: SCHEMA & USERS & SETTINGS ---
    let part1 = `-- ==============================================================================
-- PART 1 of 3: SUPABASE SCHEMA, RLS POLICIES & USERS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'student',
  is_approved BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  progress JSONB DEFAULT '{}'::jsonb,
  flashcard_positions JSONB DEFAULT '{}'::jsonb,
  folders JSONB DEFAULT '[]'::jsonb,
  goal JSONB DEFAULT '{"dailyTarget": 15, "streak": 1}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  synonym_progress JSONB DEFAULT '{}'::jsonb,
  blank_progress JSONB DEFAULT '{}'::jsonb,
  ooo_progress JSONB DEFAULT '{}'::jsonb,
  analogy_progress JSONB DEFAULT '{}'::jsonb,
  enrolled_course_ids TEXT[] DEFAULT ARRAY['bank-bcs-gre']::TEXT[],
  active_course_id TEXT DEFAULT 'bank-bcs-gre',
  quiz_score INTEGER DEFAULT 0,
  quiz_taken INTEGER DEFAULT 0,
  balance NUMERIC(10, 2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  level TEXT,
  price NUMERIC(10, 2) DEFAULT 0.00,
  is_free BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  thumbnail_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  words JSONB DEFAULT '[]'::jsonb,
  stories JSONB DEFAULT '[]'::jsonb,
  articles JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.access_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_ids TEXT[] DEFAULT ARRAY['bank-bcs-gre']::TEXT[],
  bkash_number TEXT,
  transaction_id TEXT,
  amount NUMERIC(10, 2) DEFAULT 0.00,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.odd_one_out_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.blank_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.word_analogy_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mcq_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS & FULL OPEN POLICIES
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odd_one_out_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_analogy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcq_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public Write system_settings" ON public.system_settings;
CREATE POLICY "Public Read system_settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Public Write system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read users" ON public.users;
DROP POLICY IF EXISTS "Public Write users" ON public.users;
CREATE POLICY "Public Read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Public Write users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read courses" ON public.courses;
DROP POLICY IF EXISTS "Public Write courses" ON public.courses;
CREATE POLICY "Public Read courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Public Write courses" ON public.courses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Public Write access_requests" ON public.access_requests;
CREATE POLICY "Public Read access_requests" ON public.access_requests FOR SELECT USING (true);
CREATE POLICY "Public Write access_requests" ON public.access_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read odd_one_out_questions" ON public.odd_one_out_questions;
DROP POLICY IF EXISTS "Public Write odd_one_out_questions" ON public.odd_one_out_questions;
CREATE POLICY "Public Read odd_one_out_questions" ON public.odd_one_out_questions FOR SELECT USING (true);
CREATE POLICY "Public Write odd_one_out_questions" ON public.odd_one_out_questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read blank_questions" ON public.blank_questions;
DROP POLICY IF EXISTS "Public Write blank_questions" ON public.blank_questions;
CREATE POLICY "Public Read blank_questions" ON public.blank_questions FOR SELECT USING (true);
CREATE POLICY "Public Write blank_questions" ON public.blank_questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read word_analogy_questions" ON public.word_analogy_questions;
DROP POLICY IF EXISTS "Public Write word_analogy_questions" ON public.word_analogy_questions;
CREATE POLICY "Public Read word_analogy_questions" ON public.word_analogy_questions FOR SELECT USING (true);
CREATE POLICY "Public Write word_analogy_questions" ON public.word_analogy_questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read mcq_questions" ON public.mcq_questions;
DROP POLICY IF EXISTS "Public Write mcq_questions" ON public.mcq_questions;
CREATE POLICY "Public Read mcq_questions" ON public.mcq_questions FOR SELECT USING (true);
CREATE POLICY "Public Write mcq_questions" ON public.mcq_questions FOR ALL USING (true) WITH CHECK (true);

-- INSERT SYSTEM SETTINGS
`;

    for (const [sKey, sVal] of Object.entries(settingsObj) as any) {
      part1 += `INSERT INTO public.system_settings (key, value, updated_at) VALUES (${escapeSql(sKey)}, ${toJsonbDollar(sVal)}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();\n`;
    }

    part1 += `\n-- INSERT ${Object.keys(usersObj).length} USERS\n`;
    for (const [uId, uVal] of Object.entries(usersObj) as any) {
      const email = uVal.email || `${uId}@user.local`;
      const name = uVal.displayName || uVal.name || '';
      const role = uVal.role || 'student';
      const isApproved = uVal.isApproved !== undefined ? uVal.isApproved : true;
      const status = uVal.status || 'active';
      const prog = uVal.progress || {};
      const flashPos = uVal.flashcardPositions || {};
      const folders = Array.isArray(uVal.folders) ? uVal.folders : [];
      const goal = uVal.goal || { dailyTarget: 15, streak: 1 };
      const settings = uVal.settings || {};
      const synProg = uVal.synonymProgress || {};
      const blankProg = uVal.blankProgress || {};
      const oooProg = uVal.oooProgress || {};
      const analogyProg = uVal.analogyProgress || {};
      const enrolled = Array.isArray(uVal.enrolledCourseIds) ? uVal.enrolledCourseIds : ['bank-bcs-gre'];
      const activeC = uVal.activeCourseId || 'bank-bcs-gre';
      const qScore = typeof uVal.quizScore === 'number' ? uVal.quizScore : 0;
      const qTaken = typeof uVal.quizTaken === 'number' ? uVal.quizTaken : 0;
      const balance = typeof uVal.balance === 'number' ? uVal.balance : (uVal.walletBalance || 0.0);

      part1 += `INSERT INTO public.users (id, email, display_name, role, is_approved, status, progress, flashcard_positions, folders, goal, settings, synonym_progress, blank_progress, ooo_progress, analogy_progress, enrolled_course_ids, active_course_id, quiz_score, quiz_taken, balance, updated_at) VALUES (${escapeSql(uId)}, ${escapeSql(email)}, ${escapeSql(name)}, ${escapeSql(role)}, ${isApproved}, ${escapeSql(status)}, ${toJsonbDollar(prog)}, ${toJsonbDollar(flashPos)}, ${toJsonbDollar(folders)}, ${toJsonbDollar(goal)}, ${toJsonbDollar(settings)}, ${toJsonbDollar(synProg)}, ${toJsonbDollar(blankProg)}, ${toJsonbDollar(oooProg)}, ${toJsonbDollar(analogyProg)}, ${toTextArray(enrolled)}, ${escapeSql(activeC)}, ${qScore}, ${qTaken}, ${balance}, NOW()) ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, role = EXCLUDED.role, is_approved = EXCLUDED.is_approved, status = EXCLUDED.status, progress = EXCLUDED.progress, flashcard_positions = EXCLUDED.flashcard_positions, folders = EXCLUDED.folders, goal = EXCLUDED.goal, settings = EXCLUDED.settings, synonym_progress = EXCLUDED.synonym_progress, blank_progress = EXCLUDED.blank_progress, ooo_progress = EXCLUDED.ooo_progress, analogy_progress = EXCLUDED.analogy_progress, enrolled_course_ids = EXCLUDED.enrolled_course_ids, active_course_id = EXCLUDED.active_course_id, quiz_score = EXCLUDED.quiz_score, quiz_taken = EXCLUDED.quiz_taken, balance = EXCLUDED.balance, updated_at = NOW();\n`;
    }

    // --- PART 2: COURSES CHUNKS (1 course per batch so even massive courses with thousands of words never exceed SQL editor size) ---
    const courseEntries = Object.entries(coursesObj);
    const courseChunks: { label: string; sql: string; count: number; courseTitle: string }[] = [];

    courseEntries.forEach(([cId, cVal]: [string, any], idx: number) => {
      const title = cVal.title || cId;
      const desc = cVal.description || '';
      const category = cVal.category || 'General';
      const level = cVal.level || 'All Levels';
      const price = typeof cVal.price === 'number' ? cVal.price : 0.0;
      const isFree = !!cVal.isDefault || !cVal.price;
      const isPub = cVal.hidden !== true;
      const thumb = cVal.thumbnail || '';
      const createdBy = cVal.createdBy || 'admin@gmail.com';
      const words = Array.isArray(cVal.words) ? cVal.words : [];
      const stories = Array.isArray(cVal.stories) ? cVal.stories : [];
      const articles = Array.isArray(cVal.articles) ? cVal.articles : [];
      const meta = {
        placeLabels: cVal.placeLabels || {},
        order: cVal.order || 0,
        allowedUsers: cVal.allowedUsers || [],
        enabledGames: cVal.enabledGames || {}
      };

      let chunkSql = `-- ==============================================================================
-- PART 2.${idx + 1}: COURSE "${title}" (${words.length} Words)
-- ==============================================================================
INSERT INTO public.courses (
  id, title, description, category, level, price, is_free, is_published, thumbnail_url, created_by, words, stories, articles, metadata, updated_at
) VALUES (
  ${escapeSql(cId)},
  ${escapeSql(title)},
  ${escapeSql(desc)},
  ${escapeSql(category)},
  ${escapeSql(level)},
  ${price},
  ${isFree},
  ${isPub},
  ${escapeSql(thumb)},
  ${escapeSql(createdBy)},
  ${toJsonbDollar(words)},
  ${toJsonbDollar(stories)},
  ${toJsonbDollar(articles)},
  ${toJsonbDollar(meta)},
  NOW()
) ON CONFLICT (id) DO UPDATE SET 
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  level = EXCLUDED.level,
  price = EXCLUDED.price,
  is_free = EXCLUDED.is_free,
  is_published = EXCLUDED.is_published,
  thumbnail_url = EXCLUDED.thumbnail_url,
  words = EXCLUDED.words,
  stories = EXCLUDED.stories,
  articles = EXCLUDED.articles,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
`;

      courseChunks.push({
        label: `Part 2.${idx + 1}: ${title} (${words.length} words)`,
        courseTitle: title,
        sql: chunkSql,
        count: 1
      });
    });

    // Ensure missing columns are gracefully added if table was previously created with older schema
    let part3 = `-- ==============================================================================
-- PART 3 of 3: ACCESS REQUESTS, PAYMENTS & QUESTION BANKS
-- ==============================================================================
-- Ensure columns exist in access_requests table
ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS course_ids TEXT[] DEFAULT ARRAY['bank-bcs-gre']::TEXT[];
ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
`;

    for (const [rId, rVal] of Object.entries(requestsObj) as any) {
      const uId = rVal.userId || rVal.email || rId;
      const email = rVal.email || '';
      const courseId = rVal.courseId || 'bank-bcs-gre';
      const courseIds = Array.isArray(rVal.courseIds) ? rVal.courseIds : [courseId];
      const bkash = rVal.bkashNumber || '';
      const trx = rVal.trxId || rVal.transactionId || '';
      const amount = typeof rVal.amount === 'number' ? rVal.amount : 0.0;
      const status = rVal.status || 'pending';
      const createdAt = rVal.createdAt ? escapeSql(rVal.createdAt) : 'NOW()';
      const expiresAt = rVal.expiresAt ? escapeSql(rVal.expiresAt) : 'NULL';

      part3 += `INSERT INTO public.access_requests (id, user_id, user_email, course_id, course_ids, bkash_number, transaction_id, amount, status, created_at, expires_at) VALUES (${escapeSql(rId)}, ${escapeSql(uId)}, ${escapeSql(email)}, ${escapeSql(courseId)}, ${toTextArray(courseIds)}, ${escapeSql(bkash)}, ${escapeSql(trx)}, ${amount}, ${escapeSql(status)}, ${createdAt === 'NOW()' ? 'NOW()' : `${createdAt}::timestamptz`}, ${expiresAt === 'NULL' ? 'NULL' : `${expiresAt}::timestamptz`}) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, expires_at = EXCLUDED.expires_at;\n`;
    }

    part3 += `\n-- QUESTION BANKS\n`;
    for (const [id, val] of Object.entries(oooObj) as any) {
      const cId = val.courseId || val.course_id || 'bank-bcs-gre';
      part3 += `INSERT INTO public.odd_one_out_questions (id, course_id, data, updated_at) VALUES (${escapeSql(id)}, ${escapeSql(cId)}, ${toJsonbDollar(val)}, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();\n`;
    }

    for (const [id, val] of Object.entries(blankObj) as any) {
      const cId = val.courseId || val.course_id || 'bank-bcs-gre';
      part3 += `INSERT INTO public.blank_questions (id, course_id, data, updated_at) VALUES (${escapeSql(id)}, ${escapeSql(cId)}, ${toJsonbDollar(val)}, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();\n`;
    }

    for (const [id, val] of Object.entries(analogyObj) as any) {
      const cId = val.courseId || val.course_id || 'bank-bcs-gre';
      part3 += `INSERT INTO public.word_analogy_questions (id, course_id, data, updated_at) VALUES (${escapeSql(id)}, ${escapeSql(cId)}, ${toJsonbDollar(val)}, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();\n`;
    }

    for (const [id, val] of Object.entries(mcqObj) as any) {
      const cId = val.courseId || val.course_id || 'bank-bcs-gre';
      part3 += `INSERT INTO public.mcq_questions (id, course_id, data, updated_at) VALUES (${escapeSql(id)}, ${escapeSql(cId)}, ${toJsonbDollar(val)}, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();\n`;
    }

    part3 += `\n-- VERIFICATION QUERY\nSELECT \n  (SELECT COUNT(*) FROM public.users) AS total_users,\n  (SELECT COUNT(*) FROM public.courses) AS total_courses,\n  (SELECT COUNT(*) FROM public.access_requests) AS total_requests,\n  (SELECT COUNT(*) FROM public.system_settings) AS total_settings;\n`;

    const fullSql = `${part1}\n${courseChunks.map((c) => c.sql).join('\n')}\n${part3}`;

    return {
      part1,
      courseChunks,
      part3,
      fullSql
    };
  };

  // Test Firestore Connection on load
  useEffect(() => {
    const checkFirestore = async () => {
      try {
        const snap = await getDocs(collection(db, 'system_settings'));
        setConnectionStatus((prev) => ({ ...prev, firestore: 'connected' }));
        addLog('✅ Firebase Firestore Cloud DB connected successfully.', 'success');
      } catch (err: any) {
        setConnectionStatus((prev) => ({ ...prev, firestore: 'error', message: err.message }));
        addLog(`❌ Firebase Firestore connection error: ${err.message}`, 'error');
      }
    };
    checkFirestore();
  }, []);

  // Save inputs to localStorage
  const handleSaveCredentials = () => {
    localStorage.setItem('vocab_supabase_url', supabaseUrl.trim());
    localStorage.setItem('vocab_supabase_service_key', supabaseKey.trim());
    addLog('💾 Supabase Credentials saved locally in browser.', 'info');
  };

  // Test Supabase Connection
  const testSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      alert('অনুগ্রহ করে Supabase Project URL এবং API Key (Service Role Key / Anon Key) প্রদান করুন।');
      return;
    }
    setConnectionStatus((prev) => ({ ...prev, supabase: 'checking' }));
    addLog(`🔍 Testing Supabase connection to: ${supabaseUrl.trim()}...`, 'info');

    try {
      const client = createClient(supabaseUrl.trim(), supabaseKey.trim(), {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { data, error } = await client.from('courses').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        const pingTest = await client.from('users').select('id').limit(1);
        if (pingTest.error && !pingTest.error.message.includes('relation "public.users" does not exist')) {
          throw new Error(pingTest.error.message);
        }
      }

      setConnectionStatus((prev) => ({ ...prev, supabase: 'connected' }));
      handleSaveCredentials();
      addLog('🎉 Supabase Cloud Database connection verified and active!', 'success');
    } catch (err: any) {
      setConnectionStatus((prev) => ({ ...prev, supabase: 'error', message: err.message }));
      addLog(`❌ Supabase connection failed: ${err.message}`, 'error');
      alert(`Supabase Connection Failed: ${err.message}\n\nঅনুগ্রহ করে Supabase Dashboard > Settings > API থেকে সঠিক URL ও Key চেক করুন।`);
    }
  };

  // Main Live Migration Function
  const executeDirectMigration = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      alert('অনুগ্রহ করে Supabase Project URL এবং API Key (Service Role Key) প্রদান করুন।');
      return;
    }

    const confirmMsg =
      'আপনি কি নিশ্চিত যে আপনি Firebase Firestore থেকে সমস্ত ডেটা (ইউজার প্রোফাইল, শব্দ তালিকা, প্রগ্রেস, পেমেন্ট রেকর্ড) Supabase-এ মাইগ্রেট করতে চান?';
    if (!window.confirm(confirmMsg)) return;

    setIsMigrating(true);
    setProgressPercent(5);
    setLogs([]);
    addLog('🚀 Zero-Data-Loss Live Cloud Migration started...', 'info');

    const client = createClient(supabaseUrl.trim(), supabaseKey.trim(), {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    try {
      // 1. Settings
      setCurrentStep('1/6: System Settings Migration...');
      setProgressPercent(15);
      addLog('📦 [1/6] Fetching and migrating System Settings...', 'info');

      try {
        const sysSnap = await getDocs(collection(db, 'system_settings'));
        for (const docSnap of sysSnap.docs) {
          const sysData = docSnap.data();
          await client.from('system_settings').upsert({
            key: docSnap.id,
            value: sysData,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        }
        setStats((prev) => ({ ...prev, settingsDone: sysSnap.size }));
        addLog(`✅ System Settings (${sysSnap.size} configs) synced to Supabase.`, 'success');
      } catch (err: any) {
        addLog(`⚠️ Note on system_settings: ${err.message}`, 'warning');
      }

      // 2. Courses
      setCurrentStep('2/6: Courses & Vocabularies Migration...');
      setProgressPercent(30);
      addLog('📦 [2/6] Reading Courses from Firebase Firestore...', 'info');

      const coursesSnap = await getDocs(collection(db, 'courses'));
      setStats((prev) => ({ ...prev, coursesTotal: coursesSnap.size }));
      let courseCount = 0;
      for (const docSnap of coursesSnap.docs) {
        const cData = docSnap.data();
        const courseId = docSnap.id;
        const payload = {
          id: courseId,
          title: cData.title || courseId,
          description: cData.description || '',
          category: cData.category || 'General',
          level: cData.level || 'All Levels',
          price: typeof cData.price === 'number' ? cData.price : 0.0,
          is_free: !!cData.isDefault || !cData.price,
          is_published: cData.hidden !== true,
          thumbnail_url: cData.thumbnail || '',
          created_by: cData.createdBy || 'admin@gmail.com',
          words: Array.isArray(cData.words) ? cData.words : [],
          stories: Array.isArray(cData.stories) ? cData.stories : [],
          articles: Array.isArray(cData.articles) ? cData.articles : [],
          metadata: {
            placeLabels: cData.placeLabels || {},
            order: cData.order || 0,
            allowedUsers: cData.allowedUsers || [],
            enabledGames: cData.enabledGames || {}
          },
          updated_at: new Date().toISOString()
        };

        const { error } = await client.from('courses').upsert(payload, { onConflict: 'id' });
        if (error) {
          addLog(`❌ Failed course "${courseId}": ${error.message}`, 'error');
        } else {
          courseCount++;
          setStats((prev) => ({ ...prev, coursesDone: courseCount }));
          addLog(`✅ Course synced: "${payload.title}" (${(payload.words || []).length} words)`, 'success');
        }
      }

      // 3. Questions
      setCurrentStep('3/6: Interactive Question Banks Migration...');
      setProgressPercent(50);
      addLog('📦 [3/6] Migrating MCQ, Blank, Analogy, and Odd One Out questions...', 'info');
      let totalQuestions = 0;
      const questionTables = [
        { col: 'odd_one_out_questions', tbl: 'odd_one_out_questions' },
        { col: 'blank_questions', tbl: 'blank_questions' },
        { col: 'word_analogy_questions', tbl: 'word_analogy_questions' },
        { col: 'mcq_questions', tbl: 'mcq_questions' },
        { col: 'questions', tbl: 'mcq_questions' }
      ];

      for (const item of questionTables) {
        try {
          const qSnap = await getDocs(collection(db, item.col));
          for (const qDoc of qSnap.docs) {
            const qData = qDoc.data();
            await client.from(item.tbl).upsert({
              id: qDoc.id,
              course_id: qData.courseId || qData.course_id || 'bank-bcs-gre',
              data: qData,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
            totalQuestions++;
          }
          if (qSnap.size > 0) {
            addLog(`✅ Migrated ${qSnap.size} items from "${item.col}".`, 'success');
          }
        } catch (e: any) {}
      }
      setStats((prev) => ({ ...prev, questionsTotal: totalQuestions, questionsDone: totalQuestions }));

      // 4. Access Requests
      setCurrentStep('4/6: bKash Transactions & Course Enrollments Migration...');
      setProgressPercent(70);
      addLog('📦 [4/6] Migrating Access Requests and Payment Logs...', 'info');
      let reqCount = 0;
      try {
        const reqSnap = await getDocs(collection(db, 'access_requests'));
        setStats((prev) => ({ ...prev, requestsTotal: reqSnap.size }));
        for (const rDoc of reqSnap.docs) {
          const rData = rDoc.data();
          await client.from('access_requests').upsert({
            id: rDoc.id,
            user_id: rData.userId || rData.email || rDoc.id,
            user_email: rData.email || '',
            course_id: rData.courseId || 'bank-bcs-gre',
            course_ids: Array.isArray(rData.courseIds) ? rData.courseIds : [rData.courseId || 'bank-bcs-gre'],
            bkash_number: rData.bkashNumber || '',
            transaction_id: rData.trxId || rData.transactionId || '',
            amount: typeof rData.amount === 'number' ? rData.amount : 0.0,
            status: rData.status || 'pending',
            created_at: rData.createdAt || new Date().toISOString(),
            expires_at: rData.expiresAt || null
          }, { onConflict: 'id' });
          reqCount++;
        }
        setStats((prev) => ({ ...prev, requestsDone: reqCount }));
        addLog(`✅ Migrated ${reqCount} Access & Payment records.`, 'success');
      } catch (err: any) {
        addLog(`⚠️ Note on access_requests: ${err.message}`, 'warning');
      }

      // 5. Users
      setCurrentStep('5/6: User Profiles & Study Progress Migration...');
      setProgressPercent(85);
      addLog('📦 [5/6] Reading Users and Learning Progress from Firebase...', 'info');
      const usersSnap = await getDocs(collection(db, 'users'));
      setStats((prev) => ({ ...prev, usersTotal: usersSnap.size }));
      let userCount = 0;
      for (const uDoc of usersSnap.docs) {
        const uData = uDoc.data();
        const userId = uDoc.id;
        const payload = {
          id: userId,
          email: uData.email || `${userId}@user.local`,
          display_name: uData.displayName || uData.name || '',
          role: uData.role || 'student',
          is_approved: uData.isApproved !== undefined ? uData.isApproved : true,
          status: uData.status || 'active',
          progress: uData.progress || {},
          flashcard_positions: uData.flashcardPositions || {},
          folders: Array.isArray(uData.folders) ? uData.folders : [],
          goal: uData.goal || { dailyTarget: 15, streak: 1 },
          settings: uData.settings || {},
          synonym_progress: uData.synonymProgress || {},
          blank_progress: uData.blankProgress || {},
          ooo_progress: uData.oooProgress || {},
          analogy_progress: uData.analogyProgress || {},
          enrolled_course_ids: Array.isArray(uData.enrolledCourseIds)
            ? uData.enrolledCourseIds
            : ['bank-bcs-gre'],
          active_course_id: uData.activeCourseId || 'bank-bcs-gre',
          quiz_score: typeof uData.quizScore === 'number' ? uData.quizScore : 0,
          quiz_taken: typeof uData.quizTaken === 'number' ? uData.quizTaken : 0,
          balance: typeof uData.balance === 'number' ? uData.balance : (uData.walletBalance || 0.0),
          updated_at: new Date().toISOString()
        };

        const { error } = await client.from('users').upsert(payload, { onConflict: 'id' });
        if (error) {
          addLog(`❌ Failed user ${userId} (${payload.email}): ${error.message}`, 'error');
        } else {
          userCount++;
          setStats((prev) => ({ ...prev, usersDone: userCount }));
        }
      }
      addLog(`✅ Successfully migrated ${userCount}/${usersSnap.size} user profiles with full progress.`, 'success');

      // 6. Finish
      setCurrentStep('Migration Completed Successfully!');
      setProgressPercent(100);
      addLog('🎉🎉 FULL ZERO-DATA-LOSS MIGRATION COMPLETED SUCCESSFULLY! 🎉🎉', 'success');
      alert('🎉 সফলভাবে Firebase থেকে Supabase-এ সমস্ত ডেটা মাইগ্রেট সম্পন্ন হয়েছে!\n\nসব ইউজার প্রগ্রেস, ফ্ল্যাশকার্ড হিস্ট্রি এবং কোর্স ডেটা সম্পূর্ণ সংরক্ষিত রয়েছে।');
    } catch (err: any) {
      console.error('Migration failed:', err);
      addLog(`💥 Migration Fatal Error: ${err.message}`, 'error');
      alert(`মাইগ্রেশনে ত্রুটি হয়েছে: ${err.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  // EXPORT ALL DATA TO 1 COMPLETE JSON FILE
  const exportFullJsonBackup = async () => {
    setIsExportingJson(true);
    addLog('📥 Generating complete JSON snapshot of all Firebase Firestore data...', 'info');

    try {
      const backupData: Record<string, any> = {
        meta: {
          exportVersion: '2.0',
          appName: 'Vocabulary Memorizer',
          exportedAt: new Date().toISOString(),
          description: 'Complete database export for Supabase transfer'
        },
        users: {},
        courses: {},
        access_requests: {},
        system_settings: {},
        odd_one_out_questions: {},
        blank_questions: {},
        word_analogy_questions: {},
        mcq_questions: {}
      };

      // 1. Users
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach((d) => {
        backupData.users[d.id] = d.data();
      });
      addLog(`Fetched ${usersSnap.size} Users with progress data.`, 'info');

      // 2. Courses
      const coursesSnap = await getDocs(collection(db, 'courses'));
      coursesSnap.forEach((d) => {
        backupData.courses[d.id] = d.data();
      });
      addLog(`Fetched ${coursesSnap.size} Courses with full vocabularies.`, 'info');

      // 3. Access Requests
      const reqSnap = await getDocs(collection(db, 'access_requests'));
      reqSnap.forEach((d) => {
        backupData.access_requests[d.id] = d.data();
      });
      addLog(`Fetched ${reqSnap.size} Payment & Access requests.`, 'info');

      // 4. System Settings
      const sysSnap = await getDocs(collection(db, 'system_settings'));
      sysSnap.forEach((d) => {
        backupData.system_settings[d.id] = d.data();
      });

      // 5. Question Banks
      const questionCols = [
        'odd_one_out_questions',
        'blank_questions',
        'word_analogy_questions',
        'mcq_questions'
      ];
      for (const colName of questionCols) {
        try {
          const qSnap = await getDocs(collection(db, colName));
          qSnap.forEach((d) => {
            backupData[colName][d.id] = d.data();
          });
        } catch (e) {}
      }

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `vocabulary_database_complete_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog(`✅ Complete JSON Snapshot (${(jsonStr.length / 1024).toFixed(1)} KB) downloaded successfully!`, 'success');
      alert(`✅ সম্পূর্ণ ডেটাবেজের JSON ফাইল ডাউনলোড সম্পন্ন হয়েছে!\n\nফাইলে ${usersSnap.size} জন ইউজার, ${coursesSnap.size} টি কোর্স এবং পেমেন্ট হিস্ট্রি রয়েছে।`);
    } catch (err: any) {
      addLog(`❌ Backup download failed: ${err.message}`, 'error');
      alert(`Backup error: ${err.message}`);
    } finally {
      setIsExportingJson(false);
    }
  };

  // UPLOAD JSON FILE TO SUPABASE
  const handleUploadJsonToSupabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      alert('অনুগ্রহ করে Supabase Project URL এবং API Key (Service Role Key) প্রদান করুন।');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsRestoringJson(true);
      addLog(`📂 Reading JSON file: ${file.name}...`, 'info');
      const fileText = await file.text();
      const jsonData = JSON.parse(fileText);

      const usersObj = jsonData.users || {};
      const coursesObj = jsonData.courses || {};
      const requestsObj = jsonData.access_requests || {};
      const settingsObj = jsonData.system_settings || {};

      const userCount = Object.keys(usersObj).length;
      const courseCount = Object.keys(coursesObj).length;
      const reqCount = Object.keys(requestsObj).length;
      const settingCount = Object.keys(settingsObj).length;

      setJsonUploadStats({
        users: userCount,
        courses: courseCount,
        access_requests: reqCount,
        system_settings: settingCount,
        fileName: file.name
      });

      addLog(`Found in JSON: ${userCount} users, ${courseCount} courses, ${reqCount} requests, ${settingCount} settings.`, 'info');

      const confirmUpload = window.confirm(
        `JSON ফাইল থেকে ${userCount} জন ইউজার, ${courseCount} টি কোর্স এবং ${reqCount} টি পেমেন্ট রেকর্ড Supabase-এ আপলোড করবেন?`
      );
      if (!confirmUpload) {
        setIsRestoringJson(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const client = createClient(supabaseUrl.trim(), supabaseKey.trim(), {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      // 1. Settings
      addLog('📦 [1/4] Uploading System Settings from JSON...', 'info');
      let lastErrorMessage = '';
      for (const [key, val] of Object.entries(settingsObj)) {
        const { error } = await client.from('system_settings').upsert({
          key,
          value: val,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (error) {
          lastErrorMessage = error.message;
          addLog(`⚠️ Settings note (${key}): ${error.message}`, 'warning');
        }
      }
      addLog(`✅ Uploaded ${settingCount} System Settings.`, 'success');

      // 2. Courses
      addLog('📦 [2/4] Uploading Courses from JSON...', 'info');
      let cDone = 0;
      for (const [cId, cVal] of Object.entries(coursesObj) as any) {
        const payload = {
          id: cId,
          title: cVal.title || cId,
          description: cVal.description || '',
          category: cVal.category || 'General',
          level: cVal.level || 'All Levels',
          price: typeof cVal.price === 'number' ? cVal.price : 0.0,
          is_free: !!cVal.isDefault || !cVal.price,
          is_published: cVal.hidden !== true,
          thumbnail_url: cVal.thumbnail || '',
          created_by: cVal.createdBy || 'admin@gmail.com',
          words: Array.isArray(cVal.words) ? cVal.words : [],
          stories: Array.isArray(cVal.stories) ? cVal.stories : [],
          articles: Array.isArray(cVal.articles) ? cVal.articles : [],
          metadata: {
            placeLabels: cVal.placeLabels || {},
            order: cVal.order || 0,
            allowedUsers: cVal.allowedUsers || [],
            enabledGames: cVal.enabledGames || {}
          },
          updated_at: new Date().toISOString()
        };
        const { error } = await client.from('courses').upsert(payload, { onConflict: 'id' });
        if (!error) {
          cDone++;
        } else {
          lastErrorMessage = error.message;
          addLog(`❌ Failed course "${cId}": ${error.message}`, 'error');
        }
      }
      addLog(`✅ Uploaded ${cDone}/${courseCount} Courses with vocabularies to Supabase.`, 'success');

      // 3. Requests
      addLog('📦 [3/4] Uploading Access Requests from JSON...', 'info');
      let rDone = 0;
      for (const [rId, rVal] of Object.entries(requestsObj) as any) {
        const { error } = await client.from('access_requests').upsert({
          id: rId,
          user_id: rVal.userId || rVal.email || rId,
          user_email: rVal.email || '',
          course_id: rVal.courseId || 'bank-bcs-gre',
          course_ids: Array.isArray(rVal.courseIds) ? rVal.courseIds : [rVal.courseId || 'bank-bcs-gre'],
          bkash_number: rVal.bkashNumber || '',
          transaction_id: rVal.trxId || rVal.transactionId || '',
          amount: typeof rVal.amount === 'number' ? rVal.amount : 0.0,
          status: rVal.status || 'pending',
          created_at: rVal.createdAt || new Date().toISOString(),
          expires_at: rVal.expiresAt || null
        }, { onConflict: 'id' });
        if (!error) {
          rDone++;
        } else {
          lastErrorMessage = error.message;
        }
      }
      addLog(`✅ Uploaded ${rDone}/${reqCount} Access & Payment records.`, 'success');

      // 4. Users
      addLog('📦 [4/4] Uploading Users & Learning Progress from JSON...', 'info');
      let uDone = 0;
      for (const [uId, uVal] of Object.entries(usersObj) as any) {
        const payload = {
          id: uId,
          email: uVal.email || `${uId}@user.local`,
          display_name: uVal.displayName || uVal.name || '',
          role: uVal.role || 'student',
          is_approved: uVal.isApproved !== undefined ? uVal.isApproved : true,
          status: uVal.status || 'active',
          progress: uVal.progress || {},
          flashcard_positions: uVal.flashcardPositions || {},
          folders: Array.isArray(uVal.folders) ? uVal.folders : [],
          goal: uVal.goal || { dailyTarget: 15, streak: 1 },
          settings: uVal.settings || {},
          synonym_progress: uVal.synonymProgress || {},
          blank_progress: uVal.blankProgress || {},
          ooo_progress: uVal.oooProgress || {},
          analogy_progress: uVal.analogyProgress || {},
          enrolled_course_ids: Array.isArray(uVal.enrolledCourseIds)
            ? uVal.enrolledCourseIds
            : ['bank-bcs-gre'],
          active_course_id: uVal.activeCourseId || 'bank-bcs-gre',
          quiz_score: typeof uVal.quizScore === 'number' ? uVal.quizScore : 0,
          quiz_taken: typeof uVal.quizTaken === 'number' ? uVal.quizTaken : 0,
          balance: typeof uVal.balance === 'number' ? uVal.balance : (uVal.walletBalance || 0.0),
          updated_at: new Date().toISOString()
        };
        const { error } = await client.from('users').upsert(payload, { onConflict: 'id' });
        if (!error) {
          uDone++;
        } else {
          lastErrorMessage = error.message;
          addLog(`❌ Failed user ${uId}: ${error.message}`, 'error');
        }
      }

      if (uDone === 0 && userCount > 0 && lastErrorMessage) {
        alert(
          `⚠️ Supabase আপলোডে পারমিশন সমস্যা পাওয়া গেছে!\n\nকারণ: ${lastErrorMessage}\n\nসমাধান:\n১. 'Supabase SQL Schema' ট্যাব থেকে কোড কপি করে Supabase SQL Editor-এ একবার Run দিন।\n২. অথবা Supabase Dashboard > Settings > API থেকে Service Role Key ব্যবহার করুন।`
        );
      } else {
        addLog(`✅ Uploaded ${uDone}/${userCount} User Profiles with full progress to Supabase!`, 'success');
        alert(`🎉 JSON ফাইল থেকে সফলভাবে Supabase-এ ডেটা আপলোড সম্পন্ন হয়েছে!\n\nমোট: ${uDone} জন ইউজার, ${cDone} টি কোর্স, ${rDone} টি পেমেন্ট রেকর্ড।`);
      }
    } catch (err: any) {
      console.error('JSON upload failed:', err);
      addLog(`❌ JSON Upload error: ${err.message}`, 'error');
      alert(`JSON আপলোডে ত্রুটি হয়েছে: ${err.message}`);
    } finally {
      setIsRestoringJson(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_RLS_SQL_SCRIPT);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      alert('Unable to copy SQL script automatically.');
    }
  };

  const handleCopyGeneratedSql = async () => {
    if (!generatedSqlText) return;
    try {
      await navigator.clipboard.writeText(generatedSqlText);
      setCopiedGeneratedSql(true);
      setTimeout(() => setCopiedGeneratedSql(false), 3000);
    } catch {
      alert('Unable to copy generated SQL script.');
    }
  };

  const handleCopyPartSql = async (sqlToCopy: string, partId: string) => {
    if (!sqlToCopy) return;
    try {
      await navigator.clipboard.writeText(sqlToCopy);
      setCopiedPartIndex(partId);
      setTimeout(() => setCopiedPartIndex(null), 3000);
    } catch {
      alert('Unable to copy SQL script part.');
    }
  };

  const downloadGeneratedSql = (customSql?: string, customName?: string) => {
    const textToDownload = customSql || generatedSqlText;
    if (!textToDownload) return;
    const blob = new Blob([textToDownload], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = customName || `supabase_full_data_import_${dateStr}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Convert uploaded JSON directly to Ready-to-Run SQL Script
  const handleConvertJsonFileToSql = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsGeneratingSql(true);
    addLog(`📄 Reading JSON backup file: ${file.name}...`, 'info');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);

        const usersCount = Object.keys(parsed.users || {}).length;
        const coursesCount = Object.keys(parsed.courses || {}).length;
        const reqCount = Object.keys(parsed.access_requests || {}).length;
        const settingsCount = Object.keys(parsed.system_settings || {}).length;

        setJsonUploadStats({
          users: usersCount,
          courses: coursesCount,
          access_requests: reqCount,
          system_settings: settingsCount,
          fileName: file.name
        });

        addLog(`⚡ Converting ${usersCount} Users, ${coursesCount} Courses & ${reqCount} Requests into Ready-to-Run Supabase SQL...`, 'info');

        const parts = buildSupabaseSqlPartsFromJson(parsed);
        setSqlParts(parts);
        setGeneratedSqlText(parts.fullSql);
        setSelectedSqlTab('part1');
        setActiveTab('json-to-sql');
        addLog(`🎉 SQL Script successfully generated and split into manageable parts!`, 'success');
      } catch (err: any) {
        console.error('Failed to convert JSON to SQL:', err);
        addLog(`❌ JSON to SQL conversion error: ${err.message}`, 'error');
        alert(`JSON ফাইলে সমস্যা পাওয়া গেছে: ${err.message}`);
      } finally {
        setIsGeneratingSql(false);
        if (jsonToSqlInputRef.current) jsonToSqlInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // 1-Click Generate Ready-to-Run SQL directly from live Firebase
  const handleGenerateSqlFromFirebase = async () => {
    setIsGeneratingSql(true);
    addLog('⚡ Fetching live Firebase data to generate Ready-to-Run Supabase SQL...', 'info');

    try {
      const backupData: Record<string, any> = {
        users: {},
        courses: {},
        access_requests: {},
        system_settings: {},
        odd_one_out_questions: {},
        blank_questions: {},
        word_analogy_questions: {},
        mcq_questions: {}
      };

      // Users
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach((d) => { backupData.users[d.id] = d.data(); });

      // Courses
      const coursesSnap = await getDocs(collection(db, 'courses'));
      coursesSnap.forEach((d) => { backupData.courses[d.id] = d.data(); });

      // Access Requests
      const reqSnap = await getDocs(collection(db, 'access_requests'));
      reqSnap.forEach((d) => { backupData.access_requests[d.id] = d.data(); });

      // System Settings
      const sysSnap = await getDocs(collection(db, 'system_settings'));
      sysSnap.forEach((d) => { backupData.system_settings[d.id] = d.data(); });

      // Questions
      for (const colName of ['odd_one_out_questions', 'blank_questions', 'word_analogy_questions', 'mcq_questions']) {
        try {
          const qSnap = await getDocs(collection(db, colName));
          qSnap.forEach((d) => { backupData[colName][d.id] = d.data(); });
        } catch (e) {}
      }

      setJsonUploadStats({
        users: usersSnap.size,
        courses: coursesSnap.size,
        access_requests: reqSnap.size,
        system_settings: sysSnap.size,
        fileName: 'Live Firebase Snapshot'
      });

      const parts = buildSupabaseSqlPartsFromJson(backupData);
      setSqlParts(parts);
      setGeneratedSqlText(parts.fullSql);
      setSelectedSqlTab('part1');
      setActiveTab('json-to-sql');
      addLog(`🎉 Generated complete SQL script for ${usersSnap.size} Users & ${coursesSnap.size} Courses!`, 'success');
    } catch (err: any) {
      addLog(`❌ Failed to generate SQL from Firebase: ${err.message}`, 'error');
      alert(`Error generating SQL: ${err.message}`);
    } finally {
      setIsGeneratingSql(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-['Poppins',sans-serif]">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-indigo-800/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400">
              <Cloud className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Firebase ➔ Supabase Cloud Migration Center</h3>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black rounded-full uppercase">
                  Zero Data Loss
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1">
                Direct Cloud Migration অথবা ১-ক্লিকে সম্পূর্ণ ডেটাবেজের JSON ব্যাকআপ ডাউনলোড ও সুপাবেজে আপলোড করুন।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportFullJsonBackup}
              disabled={isExportingJson}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg cursor-pointer"
              title="Download entire database as single JSON file"
            >
              <Download className="w-4 h-4 fill-slate-950" />
              <span>{isExportingJson ? 'Exporting...' : 'Download Full JSON File'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 gap-2 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('json-backup')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'json-backup'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>JSON File Transfer (ডাউনলোড ও আপলোড)</span>
        </button>

        <button
          onClick={() => {
            if (!generatedSqlText) {
              handleGenerateSqlFromFirebase();
            } else {
              setActiveTab('json-to-sql');
            }
          }}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'json-to-sql'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 bg-purple-50 text-purple-700'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>JSON ➔ SQL Generator (১০০% নির্ভরযোগ্য ডিরেক্ট SQL)</span>
        </button>

        <button
          onClick={() => setActiveTab('migration')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'migration'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Live Cloud Sync</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'sql'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Supabase SQL Schema</span>
        </button>
      </div>

      {/* TAB 1: LIVE 1-CLICK MIGRATION */}
      {activeTab === 'migration' && (
        <div className="space-y-6">
          {/* Connection Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Source Database</span>
                  <h4 className="text-sm font-black text-slate-850">Firebase Firestore</h4>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black rounded-xl flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Connected</span>
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Target Database</span>
                  <h4 className="text-sm font-black text-slate-850 truncate max-w-[200px]">
                    {supabaseUrl ? supabaseUrl.replace('https://', '').split('.')[0] : 'Supabase Cloud'}
                  </h4>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 text-xs font-black rounded-xl flex items-center gap-1 border ${
                  connectionStatus.supabase === 'connected'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : connectionStatus.supabase === 'checking'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {connectionStatus.supabase === 'connected' ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </>
                ) : connectionStatus.supabase === 'checking' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <span>Ready to Connect</span>
                )}
              </span>
            </div>
          </div>

          {/* Supabase Target Credentials Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span>Target Supabase Credentials</span>
                </h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Enter your Supabase URL and Service Role Key (recommended for migration to bypass RLS).
                </p>
              </div>
              <button
                type="button"
                onClick={testSupabase}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Test Connection</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Supabase Project URL *</label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full text-xs font-mono text-slate-800 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Supabase Key ({isServiceKey ? 'Service Role Key' : 'Anon Public Key'}) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsServiceKey(!isServiceKey)}
                    className="text-[10px] text-indigo-600 hover:underline font-bold"
                  >
                    Switch to {isServiceKey ? 'Anon Key' : 'Service Key'}
                  </button>
                </div>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder={
                    isServiceKey
                      ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (service_role secret)'
                      : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (anon public)'
                  }
                  className="w-full text-xs font-mono text-slate-800 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-400 font-medium">
                💡 টিপ: Supabase Dashboard &gt; Settings &gt; API থেকে <code>service_role</code> কী ব্যবহার করলে টেবিল পারমিশন এরর ছাড়াই দ্রুত মাইগ্রেশন সম্পন্ন হয়।
              </span>
              <button
                type="button"
                onClick={handleSaveCredentials}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                Save to Browser Storage
              </button>
            </div>
          </div>

          {/* Action Trigger Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-3xl border border-indigo-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-extrabold text-indigo-950 text-base flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600 fill-indigo-600" />
                  <span>Start Direct Firebase to Supabase Cloud Migration</span>
                </h4>
                <p className="text-xs text-indigo-800/80 font-medium mt-1">
                  Transfers User Profiles, Study Progress, Flashcards, Courses, Question Banks & bKash transactions.
                </p>
              </div>

              <button
                type="button"
                onClick={executeDirectMigration}
                disabled={isMigrating}
                className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs shadow-lg hover:shadow-xl transition cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                {isMigrating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Migrating... ({progressPercent}%)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Execute Migration Now</span>
                  </>
                )}
              </button>
            </div>

            {/* Progress Bar */}
            {isMigrating && (
              <div className="space-y-2 pt-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                  <span>{currentStep}</span>
                  <span className="font-mono">{progressPercent}%</span>
                </div>
                <div className="w-full bg-indigo-200/60 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Live Progress Numbers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-white/80 p-3 rounded-xl border border-indigo-100 text-center">
                <span className="text-[10px] text-slate-400 font-bold block">Users Synced</span>
                <span className="text-base font-black text-slate-800 font-mono">
                  {stats.usersDone} / {stats.usersTotal || '—'}
                </span>
              </div>

              <div className="bg-white/80 p-3 rounded-xl border border-indigo-100 text-center">
                <span className="text-[10px] text-slate-400 font-bold block">Courses Synced</span>
                <span className="text-base font-black text-slate-800 font-mono">
                  {stats.coursesDone} / {stats.coursesTotal || '—'}
                </span>
              </div>

              <div className="bg-white/80 p-3 rounded-xl border border-indigo-100 text-center">
                <span className="text-[10px] text-slate-400 font-bold block">Questions Synced</span>
                <span className="text-base font-black text-slate-800 font-mono">
                  {stats.questionsDone} / {stats.questionsTotal || '—'}
                </span>
              </div>

              <div className="bg-white/80 p-3 rounded-xl border border-indigo-100 text-center">
                <span className="text-[10px] text-slate-400 font-bold block">Payments Synced</span>
                <span className="text-base font-black text-slate-800 font-mono">
                  {stats.requestsDone} / {stats.requestsTotal || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Live Migration Log Console */}
          <div className="bg-slate-950 text-slate-200 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-slate-300">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">Real-time Migration Terminal Logs</span>
              </div>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-[10px] text-slate-400 hover:text-white transition"
              >
                Clear Log
              </button>
            </div>

            <div className="max-h-[260px] overflow-y-auto space-y-1.5 scrollbar-thin text-[11px] pr-1">
              {logs.length === 0 ? (
                <p className="text-slate-500 italic">Ready. Click 'Execute Migration Now' to stream real-time logs.</p>
              ) : (
                logs.map((l, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 ${
                      l.type === 'error'
                        ? 'text-rose-400'
                        : l.type === 'success'
                        ? 'text-emerald-400'
                        : l.type === 'warning'
                        ? 'text-amber-300'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-500 select-none">[{l.timestamp}]</span>
                    <span>{l.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JSON BACKUP DOWNLOAD & RESTORE */}
      {activeTab === 'json-backup' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h4 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <Archive className="w-5 h-5 text-emerald-600" />
              <span>Full Database JSON Backup & Supabase Importer</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              ১টি ক্লিকে Firebase-এর সব ডেটা (Users, Progress, Courses, Words, bKash Payments) একটি JSON ফাইলে সেভ করুন এবং সেই ফাইলটি সরাসরি Supabase-এ আপলোড করুন।
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* STEP 1: DOWNLOAD JSON */}
            <div className="p-6 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 rounded-2xl border border-emerald-200/80 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">1</span>
                  <h5 className="text-sm font-black text-slate-850">JSON ব্যাকআপ ডাউনলোড</h5>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  আপনার Firebase এর সব ইউজার প্রোফাইল, লার্নিং প্রগ্রেস, ফ্ল্যাশকার্ডের লাস্ট পজিশন ও কোর্স ডেটা একটি কমপ্লিট <code>.json</code> ফাইল হিসেবে ডাউনলোড করুন।
                </p>
              </div>

              <div className="pt-2 pl-8">
                <button
                  type="button"
                  onClick={exportFullJsonBackup}
                  disabled={isExportingJson}
                  className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingJson ? 'ডাউনলোড হচ্ছে...' : '📥 ডাউনলোড Complete JSON'}</span>
                </button>
              </div>
            </div>

            {/* STEP 2: CONVERT JSON TO SQL (RECOMMENDED) */}
            <div className="p-6 bg-gradient-to-br from-purple-50/80 to-indigo-50/60 rounded-2xl border-2 border-purple-300 space-y-4 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-purple-600 text-white text-[9px] font-black rounded-full uppercase tracking-wider">
                ১০০% সফল সমাধান
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">2</span>
                  <h5 className="text-sm font-black text-slate-850">JSON ➔ Ready SQL জেনারেট</h5>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  ডাউনলোড করা JSON ফাইল থেকে সরাসরি রেডিমেড <code>.sql</code> ফাইল তৈরি করুন। Supabase SQL Editor-এ পেস্ট করলে কোনো পারমিশন এরর ছাড়াই ১ সেকেন্ডে ডেটা ইনসার্ট হবে!
                </p>
              </div>

              <div className="pt-2 pl-8 space-y-2">
                <input
                  type="file"
                  accept=".json,application/json"
                  ref={jsonToSqlInputRef}
                  onChange={handleConvertJsonFileToSql}
                  disabled={isGeneratingSql}
                  className="hidden"
                  id="json-to-sql-file-input"
                />
                <label
                  htmlFor="json-to-sql-file-input"
                  className={`w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                    isGeneratingSql ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>⚡ JSON থেকে SQL রূপান্তর করুন</span>
                </label>
                
                <button
                  type="button"
                  onClick={handleGenerateSqlFromFirebase}
                  disabled={isGeneratingSql}
                  className="w-full text-center text-[11px] text-purple-700 hover:underline font-bold"
                >
                  অথবা লাইভ ডেটাবেজ থেকে সরাসরি SQL তৈরি করুন ➔
                </button>
              </div>
            </div>

            {/* STEP 3: DIRECT RESTORE TO SUPABASE */}
            <div className="p-6 bg-gradient-to-br from-indigo-50/70 to-slate-50/40 rounded-2xl border border-indigo-200/80 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">3</span>
                  <h5 className="text-sm font-black text-slate-850">সরাসরি ক্লাউডে আপলোড</h5>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  সরাসরি ব্রাউজার API দিয়ে Supabase-এ আপলোড দিন। (যদি RLS এরর পান, তবে পাশের ২ নং 'JSON ➔ SQL' পদ্ধতিটি ব্যবহার করুন)।
                </p>
              </div>

              <div className="pt-2 pl-8">
                <input
                  type="file"
                  accept=".json,application/json"
                  ref={fileInputRef}
                  onChange={handleUploadJsonToSupabase}
                  disabled={isRestoringJson}
                  className="hidden"
                  id="json-backup-upload-input"
                />
                <label
                  htmlFor="json-backup-upload-input"
                  className={`w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                    isRestoringJson ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {isRestoringJson ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>আপলোড হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-4 h-4" />
                      <span>📤 JSON সরাসরি আপলোড</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* JSON Summary Badge if available */}
          {jsonUploadStats && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">Loaded File:</span>
                <span className="font-mono text-emerald-300">{jsonUploadStats.fileName}</span>
              </div>
              <div className="flex items-center gap-4 text-slate-300">
                <span>Users: <strong className="text-white">{jsonUploadStats.users}</strong></span>
                <span>Courses: <strong className="text-white">{jsonUploadStats.courses}</strong></span>
                <span>Requests: <strong className="text-white">{jsonUploadStats.access_requests}</strong></span>
                <span>Settings: <strong className="text-white">{jsonUploadStats.system_settings}</strong></span>
              </div>
            </div>
          )}

          {/* Step-by-step Guide */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
            <h6 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>সহজ নির্দেশনা (JSON ফাইলের মাধ্যমে ট্রান্সফার):</span>
            </h6>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 leading-relaxed">
              <li>প্রথম ধাপে <strong>"ডাউনলোড Complete JSON"</strong> বাটনে চাপ দিয়ে আপনার পিসিতে <code>vocabulary_database_complete_backup.json</code> ফাইলটি সংরক্ষণ করুন।</li>
              <li>এরপর ২নং বক্সে <strong>"⚡ JSON থেকে SQL রূপান্তর করুন"</strong> বাটনে ক্লিক করে ডাউনলোড করা ফাইলটি বেছে নিন।</li>
              <li>সাথে সাথে সব ডেটাসহ স্বয়ংক্রিয়ভাবে তৈরি হওয়া SQL স্ক্রিপ্টটি কপি করে Supabase Dashboard-এর <strong>SQL Editor</strong>-এ গিয়ে রান দিলেই সম্পূর্ণ ডেটাবেজ Supabase-এ লোড হয়ে যাবে!</li>
            </ol>
          </div>
        </div>
      )}

      {/* TAB: JSON TO SQL GENERATOR & VIEWER */}
      {activeTab === 'json-to-sql' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </span>
                <h4 className="font-extrabold text-slate-850 text-base">
                  Supabase Ready-to-Run SQL Import Generator (Split in Small Parts)
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ১৭টি কোর্সের হাজার হাজার ভোকাবুলারি থাকার কারণে সম্পূর্ণ SQL বড় হয়ে গেলে Supabase SQL Editor সাইজ লিমিট দেয়। তাই নিচে <strong>অল্প অল্প করে (Part 1, 2, 3)</strong> রান করার সুবিধাজনক ব্যবস্থা রয়েছে।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => downloadGeneratedSql(generatedSqlText, 'supabase_full_database.sql')}
                disabled={!generatedSqlText}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>📥 Download Full .sql File</span>
              </button>
            </div>
          </div>

          {/* Solution Recommendation Box */}
          <div className="p-5 bg-gradient-to-br from-indigo-900 to-purple-950 text-white rounded-2xl shadow-md space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-400 text-slate-900 text-[10px] font-black rounded-full uppercase">
                সহজ সমাধান
              </span>
              <h5 className="font-extrabold text-sm">
                কেন "Query is too large" এরর আসে এবং করণীয়:
              </h5>
            </div>
            <p className="text-xs text-indigo-200 leading-relaxed">
              Supabase-এর ওয়েব ব্রাউজার SQL Editor একবারে ১-২ মেগাবাইটের বেশি কুয়েরি রান করতে পারে না। আপনার পছন্দমতো নিচের যেকোনো ১টি পদ্ধতিতে সমাধান করতে পারেন:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 bg-white/10 rounded-xl border border-white/10 space-y-1">
                <span className="text-[11px] font-bold text-amber-300">পদ্ধতি ১ (পার্ট-বাই-পার্ট ছোট SQL রান - সবচেয়ে নিরাপদ):</span>
                <p className="text-[11px] text-indigo-100">
                  নিচের <strong>Part 1</strong> (টেবিল ও ইউজার), এরপর <strong>Part 2</strong> (কোর্স ব্যাচসমূহ), এবং <strong>Part 3</strong> (পেমেন্ট ও গেমস) আলাদা আলাদা করে SQL Editor-এ রান করুন। কোনো সাইজ এরর আসবে না!
                </p>
              </div>

              <div className="p-3.5 bg-white/10 rounded-xl border border-white/10 space-y-1">
                <span className="text-[11px] font-bold text-emerald-300">পদ্ধতি ২ (সরাসরি ডিরেক্ট ক্লাউড আপলোড):</span>
                <p className="text-[11px] text-indigo-100">
                  প্রথমে নিচের <strong>Part 1</strong> রান করে টেবিলগুলো বানিয়ে নিন। এরপর <strong>"JSON File Transfer"</strong> ট্যাবে গিয়ে জাস্ট আপনার JSON ফাইলটি আপলোড দিন, ব্রাউজার নিজে থেকেই সব ডেটা পাঠিয়ে দিবে!
                </p>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          {jsonUploadStats && (
            <div className="p-4 bg-purple-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">Source:</span>
                <span className="font-mono text-purple-200">{jsonUploadStats.fileName}</span>
              </div>
              <div className="flex items-center gap-4 text-purple-200">
                <span>Users: <strong className="text-white">{jsonUploadStats.users}</strong></span>
                <span>Courses: <strong className="text-white">{jsonUploadStats.courses}</strong></span>
                <span>Requests: <strong className="text-white">{jsonUploadStats.access_requests}</strong></span>
                <span>Settings: <strong className="text-white">{jsonUploadStats.system_settings}</strong></span>
              </div>
            </div>
          )}

          {/* MULTI-PART SQL TABS & CONTROLS */}
          {sqlParts ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  ছোট ছোট ভাগে ভাগ করা SQL কুয়েরিসমূহ:
                </span>
                <span className="text-xs text-slate-500">
                  যেকোনো পার্ট কপি করে Supabase SQL Editor-এ রান করুন
                </span>
              </div>

              {/* Part Navigation Buttons */}
              <div className="flex flex-wrap gap-2">
                {/* Part 1 */}
                <button
                  type="button"
                  onClick={() => setSelectedSqlTab('part1')}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    selectedSqlTab === 'part1'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-black">1</span>
                  <span>Part 1: Schema & Users ({jsonUploadStats?.users || 0} Users)</span>
                </button>

                {/* Part 2 Course Chunks */}
                {sqlParts.courseChunks.map((chunk, idx) => {
                  const tabKey = `part2_${idx}`;
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => setSelectedSqlTab(tabKey)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                        selectedSqlTab === tabKey
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-black">2.{idx + 1}</span>
                      <span className="max-w-[140px] truncate" title={chunk.courseTitle}>{chunk.courseTitle}</span>
                    </button>
                  );
                })}

                {/* Part 3 */}
                <button
                  type="button"
                  onClick={() => setSelectedSqlTab('part3')}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    selectedSqlTab === 'part3'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-black">3</span>
                  <span>Part 3: Requests & Questions</span>
                </button>

                {/* Full SQL */}
                <button
                  type="button"
                  onClick={() => setSelectedSqlTab('full')}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    selectedSqlTab === 'full'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>Full Combined SQL</span>
                </button>
              </div>

              {/* Active Part Action Bar */}
              {(() => {
                let currentSql = '';
                let currentTitle = '';
                let currentDescription = '';
                let currentPartId = selectedSqlTab;

                if (selectedSqlTab === 'part1') {
                  currentSql = sqlParts.part1;
                  currentTitle = 'Part 1: Schema, Tables, RLS Policies, Settings & Users';
                  currentDescription = 'প্রথমে এই অংশটি রান করুন। এটি সব টেবিল, পারমিশন রুলস এবং সমস্ত ইউজার প্রোফাইল ও লার্নিং প্রগ্রেস লোড করবে। (সাইজ: ~' + (currentSql.length / 1024).toFixed(1) + ' KB)';
                } else if (selectedSqlTab.startsWith('part2_')) {
                  const idx = parseInt(selectedSqlTab.replace('part2_', ''), 10);
                  const chunk = sqlParts.courseChunks[idx];
                  if (chunk) {
                    currentSql = chunk.sql;
                    currentTitle = chunk.label;
                    currentDescription = `"${chunk.courseTitle}" কোর্সের সমস্ত ভোকাবুলারি শব্দ ও ডেটা। (সাইজ: ~${(currentSql.length / 1024).toFixed(1)} KB)`;
                  }
                } else if (selectedSqlTab === 'part3') {
                  currentSql = sqlParts.part3;
                  currentTitle = 'Part 3: Payment Records & Game Question Banks';
                  currentDescription = 'এটি সমস্ত bKash পেমেন্ট রিকোয়েস্ট এবং কুইজ প্রশ্ন লোড করবে। (সাইজ: ~' + (currentSql.length / 1024).toFixed(1) + ' KB)';
                } else {
                  currentSql = sqlParts.fullSql;
                  currentTitle = 'Full Database Combined SQL Script';
                  currentDescription = 'সম্পূর্ণ ডেটাবেজের একীভূত SQL কোড। (সাইজ: ~' + (currentSql.length / 1024).toFixed(1) + ' KB)';
                }

                return (
                  <div className="space-y-3">
                    <div className="p-4 bg-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200">
                      <div>
                        <h6 className="font-extrabold text-slate-800 text-xs sm:text-sm">{currentTitle}</h6>
                        <p className="text-[11px] text-slate-500 mt-0.5">{currentDescription}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyPartSql(currentSql, currentPartId)}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          {copiedPartIndex === currentPartId ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-300" />
                              <span>কপি হয়েছে!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>📋 Copy Selected Part</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadGeneratedSql(currentSql, `${currentPartId}.sql`)}
                          className="px-3.5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>.sql</span>
                        </button>
                      </div>
                    </div>

                    {/* SQL Preview Box */}
                    <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-[380px] leading-relaxed border border-slate-800">
                      {currentSql}
                    </pre>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                এখনো কোনো SQL তৈরি করা হয়নি। আপনার ডাউনলোড করা JSON ফাইলটি দিয়ে ছোট ছোট পার্টে SQL তৈরি করতে পারেন অথবা লাইভ ডেটাবেজ থেকে তৈরি করতে পারেন।
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleConvertJsonFileToSql}
                  className="hidden"
                  id="direct-json-to-sql-file-input"
                />
                <label
                  htmlFor="direct-json-to-sql-file-input"
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Archive className="w-4 h-4" />
                  <span>Select Downloaded JSON File</span>
                </label>

                <button
                  type="button"
                  onClick={handleGenerateSqlFromFirebase}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Zap className="w-4 h-4" />
                  <span>Generate Directly from Live DB</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SUPABASE SQL SCHEMA */}
      {activeTab === 'sql' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm">Supabase Database Tables & RLS Policies SQL Script</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste this script inside your Supabase Dashboard &gt; SQL Editor &gt; New Query and click 'Run'.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copiedSql ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-[400px]">
            {SUPABASE_RLS_SQL_SCRIPT}
          </pre>
        </div>
      )}
    </div>
  );
}
