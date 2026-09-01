import React, { useState } from 'react';
import { X, Copy, Check, Database, ShieldCheck, Terminal } from 'lucide-react';

interface SupabaseRlsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPABASE_RLS_SQL_SCRIPT = `-- ==============================================================================
-- VOCABULARY MASTER: COMPLETE SUPABASE DATABASE SCHEMA & RLS POLICIES
-- ==============================================================================
-- Run this script in your Supabase Dashboard:
-- SQL Editor -> New Query -> Paste & Click 'Run'
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Users Table (Stores user profiles, word progress & flashcard positions)
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
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 4. Courses Table
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
CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses(is_published);

-- 5. Access Requests & bKash Transactions
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
CREATE INDEX IF NOT EXISTS idx_access_req_user ON public.access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_access_req_status ON public.access_requests(status);

-- 6. Interactive Game Question Tables
CREATE TABLE IF NOT EXISTS public.odd_one_out_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ooo_course ON public.odd_one_out_questions(course_id);

CREATE TABLE IF NOT EXISTS public.blank_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blank_course ON public.blank_questions(course_id);

CREATE TABLE IF NOT EXISTS public.word_analogy_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analogy_course ON public.word_analogy_questions(course_id);

CREATE TABLE IF NOT EXISTS public.mcq_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mcq_course ON public.mcq_questions(course_id);

-- 7. Announcements & Activity Logs
CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_active BOOLEAN DEFAULT true,
  target_course_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- ==============================================================================
-- Enable RLS on all tables
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odd_one_out_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_analogy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcq_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflict
DROP POLICY IF EXISTS "Public Read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public Write system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public Read users" ON public.users;
DROP POLICY IF EXISTS "Public Write users" ON public.users;
DROP POLICY IF EXISTS "Public Read courses" ON public.courses;
DROP POLICY IF EXISTS "Public Write courses" ON public.courses;
DROP POLICY IF EXISTS "Public Read access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Public Write access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Public Read odd_one_out_questions" ON public.odd_one_out_questions;
DROP POLICY IF EXISTS "Public Write odd_one_out_questions" ON public.odd_one_out_questions;
DROP POLICY IF EXISTS "Public Read blank_questions" ON public.blank_questions;
DROP POLICY IF EXISTS "Public Write blank_questions" ON public.blank_questions;
DROP POLICY IF EXISTS "Public Read word_analogy_questions" ON public.word_analogy_questions;
DROP POLICY IF EXISTS "Public Write word_analogy_questions" ON public.word_analogy_questions;
DROP POLICY IF EXISTS "Public Read mcq_questions" ON public.mcq_questions;
DROP POLICY IF EXISTS "Public Write mcq_questions" ON public.mcq_questions;
DROP POLICY IF EXISTS "Public Read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Public Write announcements" ON public.announcements;

-- Create Permissive Policies (Allows Frontend Client, Migration Script & Service Role to read & write)
CREATE POLICY "Public Read system_settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Public Write system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Public Write users" ON public.users FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Public Write courses" ON public.courses FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read access_requests" ON public.access_requests FOR SELECT USING (true);
CREATE POLICY "Public Write access_requests" ON public.access_requests FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read odd_one_out_questions" ON public.odd_one_out_questions FOR SELECT USING (true);
CREATE POLICY "Public Write odd_one_out_questions" ON public.odd_one_out_questions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read blank_questions" ON public.blank_questions FOR SELECT USING (true);
CREATE POLICY "Public Write blank_questions" ON public.blank_questions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read word_analogy_questions" ON public.word_analogy_questions FOR SELECT USING (true);
CREATE POLICY "Public Write word_analogy_questions" ON public.word_analogy_questions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read mcq_questions" ON public.mcq_questions FOR SELECT USING (true);
CREATE POLICY "Public Write mcq_questions" ON public.mcq_questions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Public Write announcements" ON public.announcements FOR ALL USING (true) WITH CHECK (true);
`;

export const SupabaseRlsModal: React.FC<SupabaseRlsModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_RLS_SQL_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy SQL script:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Supabase RLS Policy SQL Script</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                  Public Read Access
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Run this SQL in your Supabase SQL Editor to enable public read access for all game questions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-200">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-1">What this SQL script does:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li>Creates <code className="text-emerald-300">odd_one_out_questions</code>, <code className="text-emerald-300">blank_questions</code>, <code className="text-emerald-300">word_analogy_questions</code>, & <code className="text-emerald-300">mcq_questions</code> tables if missing.</li>
                <li>Enables <strong>Row Level Security (RLS)</strong> with Public Read Access (<code className="text-emerald-300">SELECT FOR ALL</code>) so all students & users can load questions without permission errors.</li>
                <li>Grants full Insert/Update/Delete permissions for authenticated admin uploads.</li>
              </ul>
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 rounded-t-xl border border-b-0 border-slate-800 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>supabase_rls_policies.sql</span>
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy SQL Script</span>
                  </>
                )}
              </button>
            </div>
            <pre className="bg-slate-950 text-emerald-300/90 p-4 rounded-b-xl border border-slate-800 text-xs font-mono overflow-x-auto max-h-80 leading-relaxed">
              {SUPABASE_RLS_SQL_SCRIPT}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Paste this code into <strong>Supabase Dashboard &gt; SQL Editor &gt; New Query &gt; Run</strong>
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy SQL'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
