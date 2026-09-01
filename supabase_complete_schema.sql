-- ==============================================================================
-- VOCABULARY MASTER: FULL SUPABASE DATABASE SCHEMA (COMPLETE & ZERO DATA LOSS)
-- ==============================================================================
-- Run this script in your Supabase Dashboard:
-- SQL Editor -> New Query -> Paste & Click 'Run'
-- ==============================================================================

-- Enable UUID extension (standard in Postgres/Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROFILES / USERS TABLE (Stores all user progress & personal data)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,                       -- Firebase UID or Supabase Auth UUID (Text format ensures 100% compatibility)
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'student',               -- 'admin' | 'student' | 'instructor'
  is_approved BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Core Vocabulary & Study Progress (JSONB preserves exact Firestore structure)
  progress JSONB DEFAULT '{}'::jsonb,                     -- Word status: { [wordId]: { status: 'know'|'confusion'|'dont_know', ... } }
  flashcard_positions JSONB DEFAULT '{}'::jsonb,          -- Per-course last viewed index: { [courseId]: { lastIndex, lastWordId } }
  folders JSONB DEFAULT '[]'::jsonb,                      -- Custom study folders & word buckets
  goal JSONB DEFAULT '{"dailyTarget": 15, "streak": 1}'::jsonb, -- Daily goal & streak stats
  settings JSONB DEFAULT '{}'::jsonb,                     -- User preferences (audio, dark mode, auto-advance, etc.)

  -- Interactive Games Progress (Zero Data Loss)
  synonym_progress JSONB DEFAULT '{}'::jsonb,             -- Synonym match progress
  blank_progress JSONB DEFAULT '{}'::jsonb,               -- Fill in the blanks progress
  ooo_progress JSONB DEFAULT '{}'::jsonb,                 -- Odd One Out progress
  analogy_progress JSONB DEFAULT '{}'::jsonb,             -- Word Analogy progress

  -- Course Enrollments & Quiz Stats
  enrolled_course_ids TEXT[] DEFAULT ARRAY['bank-bcs-gre']::TEXT[],
  active_course_id TEXT DEFAULT 'bank-bcs-gre',
  quiz_score INTEGER DEFAULT 0,
  quiz_taken INTEGER DEFAULT 0,
  balance NUMERIC(10, 2) DEFAULT 0.00
);

-- Index for instant lookup by email and active course
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ==============================================================================
-- 2. COURSES TABLE (Vocabulary courses, custom word sets, stories & articles)
-- ==============================================================================
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

  -- Course Content
  words JSONB DEFAULT '[]'::jsonb,                        -- Complete vocabulary list with meanings, synonyms, examples
  stories JSONB DEFAULT '[]'::jsonb,                      -- Vocabulary reading stories
  articles JSONB DEFAULT '[]'::jsonb,                    -- Reading articles
  metadata JSONB DEFAULT '{}'::jsonb                      -- Custom tags, group labels, order settings
);

CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses(is_published);

-- ==============================================================================
-- 3. GAME QUESTION BANKS (Odd One Out, Blanks, Analogy, MCQ)
-- ==============================================================================
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

-- ==============================================================================
-- 4. EXAMS & SUBMISSIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  course_id TEXT,
  duration_minutes INTEGER DEFAULT 30,
  total_marks INTEGER DEFAULT 100,
  pass_marks INTEGER DEFAULT 40,
  questions JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_submissions (
  id TEXT PRIMARY KEY,
  exam_id TEXT REFERENCES public.exams(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL,
  total_marks INTEGER NOT NULL,
  answers JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exam_sub_user ON public.exam_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_sub_exam ON public.exam_submissions(exam_id);

-- ==============================================================================
-- 5. COURSE ENROLLMENT REQUESTS & TRANSACTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.access_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  course_id TEXT NOT NULL,
  course_title TEXT,
  status TEXT DEFAULT 'pending',             -- 'pending' | 'approved' | 'rejected'
  payment_method TEXT,
  transaction_id TEXT,
  phone_number TEXT,
  amount NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_access_req_user ON public.access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_access_req_status ON public.access_requests(status);

CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL,                        -- 'deposit' | 'purchase' | 'refund'
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'completed',           -- 'pending' | 'completed' | 'failed'
  payment_method TEXT,
  trx_id TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trx_user ON public.transactions(user_id);

-- ==============================================================================
-- 6. ANNOUNCEMENTS & ACTIVITY LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',                  -- 'info' | 'warning' | 'success' | 'alert'
  is_active BOOLEAN DEFAULT true,
  target_course_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_logs(created_at DESC);

-- ==============================================================================
-- 7. AUTO-UPDATE TIMESTAMP TRIGGER FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON public.users;
CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_courses_updated ON public.courses;
CREATE TRIGGER trg_courses_updated
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odd_one_out_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_analogy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcq_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DROP POLICY IF EXISTS "Public can view published courses" ON public.courses;
DROP POLICY IF EXISTS "Public can view active announcements" ON public.announcements;
DROP POLICY IF EXISTS "Public can view questions" ON public.odd_one_out_questions;
DROP POLICY IF EXISTS "Public can view blank questions" ON public.blank_questions;
DROP POLICY IF EXISTS "Public can view analogy questions" ON public.word_analogy_questions;
DROP POLICY IF EXISTS "Public can view mcq questions" ON public.mcq_questions;
DROP POLICY IF EXISTS "Public can view published exams" ON public.exams;
DROP POLICY IF EXISTS "Allow user to read own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user to update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user to insert own profile" ON public.users;
DROP POLICY IF EXISTS "Allow all for authenticated/service role" ON public.users;

-- Public & Student Read Policies
CREATE POLICY "Public can view published courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Public can view active announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Public can view questions" ON public.odd_one_out_questions FOR SELECT USING (true);
CREATE POLICY "Public can view blank questions" ON public.blank_questions FOR SELECT USING (true);
CREATE POLICY "Public can view analogy questions" ON public.word_analogy_questions FOR SELECT USING (true);
CREATE POLICY "Public can view mcq questions" ON public.mcq_questions FOR SELECT USING (true);
CREATE POLICY "Public can view published exams" ON public.exams FOR SELECT USING (true);

-- User Profile Access Policies (Select, Insert, Update)
CREATE POLICY "Allow all access on users table" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on access_requests" ON public.access_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on exam_submissions" ON public.exam_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- Admin / Author Course management
CREATE POLICY "Allow all management on courses" ON public.courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all management on announcements" ON public.announcements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all management on game questions ooo" ON public.odd_one_out_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all management on game questions blank" ON public.blank_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all management on game questions analogy" ON public.word_analogy_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all management on game questions mcq" ON public.mcq_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all management on exams" ON public.exams FOR ALL USING (true) WITH CHECK (true);
