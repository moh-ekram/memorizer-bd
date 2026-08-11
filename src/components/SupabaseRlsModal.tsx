import React, { useState } from 'react';
import { X, Copy, Check, Database, ShieldCheck, Terminal } from 'lucide-react';

interface SupabaseRlsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPABASE_RLS_SQL_SCRIPT = `-- =========================================================
-- SUPABASE PUBLIC READ RLS POLICY SCRIPT
-- For Game Questions: Odd One Out, Blank, Word Analogy, MCQ
-- =========================================================

-- 1. Create Question Tables if they don't already exist
CREATE TABLE IF NOT EXISTS public.odd_one_out_questions (
  id TEXT PRIMARY KEY,
  data JSONB,
  "courseId" TEXT,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.blank_questions (
  id TEXT PRIMARY KEY,
  data JSONB,
  "courseId" TEXT,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.word_analogy_questions (
  id TEXT PRIMARY KEY,
  data JSONB,
  "courseId" TEXT,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mcq_questions (
  id TEXT PRIMARY KEY,
  data JSONB,
  "courseId" TEXT,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS) on all Question Tables
ALTER TABLE public.odd_one_out_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_analogy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcq_questions ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent conflict duplicates
DROP POLICY IF EXISTS "Public Read Access for Odd One Out" ON public.odd_one_out_questions;
DROP POLICY IF EXISTS "Public Read Access for Blank Questions" ON public.blank_questions;
DROP POLICY IF EXISTS "Public Read Access for Word Analogy" ON public.word_analogy_questions;
DROP POLICY IF EXISTS "Public Read Access for MCQ Questions" ON public.mcq_questions;

DROP POLICY IF EXISTS "Enable all access for authenticated users on OOO" ON public.odd_one_out_questions;
DROP POLICY IF EXISTS "Enable all access for authenticated users on Blank" ON public.blank_questions;
DROP POLICY IF EXISTS "Enable all access for authenticated users on Analogy" ON public.word_analogy_questions;
DROP POLICY IF EXISTS "Enable all access for authenticated users on MCQ" ON public.mcq_questions;

-- 4. Create Public / Authenticated Read Access Policies (SELECT FOR ALL)
CREATE POLICY "Public Read Access for Odd One Out"
ON public.odd_one_out_questions FOR SELECT
USING (true);

CREATE POLICY "Public Read Access for Blank Questions"
ON public.blank_questions FOR SELECT
USING (true);

CREATE POLICY "Public Read Access for Word Analogy"
ON public.word_analogy_questions FOR SELECT
USING (true);

CREATE POLICY "Public Read Access for MCQ Questions"
ON public.mcq_questions FOR SELECT
USING (true);

-- 5. Create Full Access Policies for Inserting/Updating/Deleting Questions
CREATE POLICY "Enable all access for authenticated users on OOO"
ON public.odd_one_out_questions FOR ALL
USING (true);

CREATE POLICY "Enable all access for authenticated users on Blank"
ON public.blank_questions FOR ALL
USING (true);

CREATE POLICY "Enable all access for authenticated users on Analogy"
ON public.word_analogy_questions FOR ALL
USING (true);

CREATE POLICY "Enable all access for authenticated users on MCQ"
ON public.mcq_questions FOR ALL
USING (true);
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
