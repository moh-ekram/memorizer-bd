-- ==============================================================================
-- 🚀 VOCABULARY MASTER: FRESH BULLETPROOF SUPABASE SQL SETUP (100% ZERO DATA LOSS)
-- ==============================================================================
-- এই স্ক্রিপ্টটি আপনার Supabase SQL Editor-এ রান করুন:
-- 1. Supabase Dashboard-এ যান (https://supabase.com/dashboard)
-- 2. বাম পাশের মেনু থেকে 'SQL Editor' এ ক্লিক করুন
-- 3. 'New Query' বাটনে ক্লিক করে পুরো কোডটি পেস্ট করুন
-- 4. নিচের সবুজ 'Run' (বা Ctrl+Enter) বাটনে ক্লিক করুন
-- 
-- 🛡️ গ্যারান্টি: এটি সম্পূর্ণ নিরাপদ (Non-destructive)।
-- আপনার পূর্বের সকল ইউজার অ্যাকাউন্ট, ইমেইল, পাসওয়ার্ড, কোর্স ও ডেটা ১০০% অক্ষত থাকবে!
-- কোনো ডেটা ডিলিট বা ট্রাঙ্কেট (TRUNCATE) করা হবে না।
-- ==============================================================================

-- 1. UUID এক্সটেনশন সক্রিয়করণ
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. USERS টেবিল নিশ্চিতকরণ (Creating table if not exists)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'student',
  is_approved BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- পূর্বের ইউজারদের অক্ষত রেখে প্রগ্রেস ও সেটিংসের সব কলাম স্বয়ংক্রিয়ভাবে অ্যাড করা
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ভোকাবুলারি স্টাডি ও প্রগ্রেস কলাম (JSONB)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS flashcard_positions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS folders JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS goal JSONB DEFAULT '{"dailyTarget": 15, "streak": 1}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- গেমস প্রগ্রেস কলামসমূহ
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS synonym_progress JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS blank_progress JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ooo_progress JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS analogy_progress JSONB DEFAULT '{}'::jsonb;

-- কোর্স তালিকা, সক্রিয় কোর্স, কুইজ ও ব্যালেন্স
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS enrolled_course_ids TEXT[] DEFAULT ARRAY['bank-bcs-gre']::TEXT[];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_course_id TEXT DEFAULT 'bank-bcs-gre';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS quiz_score INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS quiz_taken INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) DEFAULT 0.00;

-- ফাস্ট সার্চ ইনডেক্স
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ==============================================================================
-- 3. COURSES টেবিল নিশ্চিতকরণ
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'General',
  level TEXT DEFAULT 'All Levels',
  price NUMERIC(10, 2) DEFAULT 0.00,
  is_free BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  thumbnail_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS words JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS stories JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS articles JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses(is_published);

-- ==============================================================================
-- 4. ACCESS_REQUESTS, TRANSACTIONS & SYSTEM_SETTINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.access_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  course_id TEXT NOT NULL,
  course_ids TEXT[],
  course_title TEXT,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  transaction_id TEXT,
  bkash_number TEXT,
  phone_number TEXT,
  amount NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_access_req_user ON public.access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_access_req_status ON public.access_requests(status);

CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'completed',
  payment_method TEXT,
  trx_id TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
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

-- গেম প্রশ্ন ব্যাংক টেবিলসমূহ
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

-- কেন্দ্রীয় প্রশ্ন ব্যাংক টেবিল (MCQ & Question Bank Items)
CREATE TABLE IF NOT EXISTS public.question_bank (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  question TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_answer TEXT,
  explanation TEXT,
  group1 TEXT DEFAULT 'General',
  group2 TEXT DEFAULT 'General',
  group3 TEXT DEFAULT 'General',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qb_course ON public.question_bank(course_id);

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

CREATE TABLE IF NOT EXISTS public.exam_results (
  id TEXT PRIMARY KEY,
  exam_id TEXT,
  user_id TEXT,
  user_email TEXT,
  score NUMERIC(5, 2) NOT NULL,
  total_marks INTEGER NOT NULL,
  answers JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. AUTO-UPDATE TIMESTAMP FUNCTION & TRIGGERS
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

DROP TRIGGER IF EXISTS trg_qb_updated ON public.question_bank;
CREATE TRIGGER trg_qb_updated
BEFORE UPDATE ON public.question_bank
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) - নিরবচ্ছিন্ন সিঙ্কের জন্য উন্মুক্ত পারমিশন
-- ==============================================================================
-- RLS সক্রিয় করা যাতে ডাটাবেস সুরক্ষিত থাকে
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odd_one_out_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_analogy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcq_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- পুরাতন কনফликт সৃষ্টিকারী পলিসিগুলো বাতিল করা
DROP POLICY IF EXISTS "Allow full access on users" ON public.users;
DROP POLICY IF EXISTS "Allow all access on users table" ON public.users;
DROP POLICY IF EXISTS "Allow all access on courses" ON public.courses;
DROP POLICY IF EXISTS "Allow all management on courses" ON public.courses;
DROP POLICY IF EXISTS "Allow all access on access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow all access on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow all access on system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow all access on announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow all access on activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow all access on ooo" ON public.odd_one_out_questions;
DROP POLICY IF EXISTS "Allow all access on blanks" ON public.blank_questions;
DROP POLICY IF EXISTS "Allow all access on analogy" ON public.word_analogy_questions;
DROP POLICY IF EXISTS "Allow all access on mcq" ON public.mcq_questions;
DROP POLICY IF EXISTS "Allow all access on question_bank" ON public.question_bank;
DROP POLICY IF EXISTS "Allow all access on exams" ON public.exams;
DROP POLICY IF EXISTS "Allow all access on submissions" ON public.exam_submissions;
DROP POLICY IF EXISTS "Allow all access on exam_results" ON public.exam_results;

-- নতুন নিরবচ্ছিন্ন সিঙ্ক পলিসি তৈরি (Allow full read & write for sync)
CREATE POLICY "Allow full access on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on courses" ON public.courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on access_requests" ON public.access_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on announcements" ON public.announcements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on ooo" ON public.odd_one_out_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on blanks" ON public.blank_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on analogy" ON public.word_analogy_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on mcq" ON public.mcq_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on question_bank" ON public.question_bank FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on exams" ON public.exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on submissions" ON public.exam_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on exam_results" ON public.exam_results FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. ভেরিফিকেশন ও ডেটা কুয়েরি করার এসকিউএল কোড (DATA QUERY SCRIPTS)
-- ==============================================================================

-- 📌 ১. কোর্স ডেটা কুয়েরি (Course Data Queries)
-- সকল কোর্স ও তাদের শব্দ সংখ্যা দেখা:
SELECT 
  id, 
  title, 
  category, 
  price, 
  is_free, 
  is_published, 
  jsonb_array_length(COALESCE(words, '[]'::jsonb)) AS total_words,
  updated_at
FROM public.courses
ORDER BY updated_at DESC;

-- 📌 ২. ইউজার ডেটা কুয়েরি (User Data Queries)
-- সকল ইউজার, তাদের ইমেইল, রোল, স্কোর ও অনুমোদিত স্ট্যাটাস:
SELECT 
  id, 
  email, 
  display_name, 
  role, 
  is_approved, 
  quiz_score, 
  quiz_taken, 
  enrolled_course_ids, 
  active_course_id,
  updated_at
FROM public.users
ORDER BY updated_at DESC;

-- 📌 ৩. কুয়েশ্চন ব্যাংক কুয়েরি (Question Bank Queries)
-- কোশ্চেন ব্যাংকে কয়টি প্রশ্ন আছে এবং তাদের তালিকা:
SELECT 
  id, 
  course_id, 
  question, 
  correct_answer, 
  group1, 
  created_at
FROM public.question_bank
ORDER BY created_at DESC;

-- 📌 ৪. গেমস ডেটা কুয়েরি (Games Data Queries)
-- প্রতিটি গেমের মোট প্রশ্নের সংখ্যা ও তালিকা:
SELECT 'Fill in the Blanks' AS game_type, COUNT(*) AS total_questions FROM public.blank_questions
UNION ALL
SELECT 'Odd One Out' AS game_type, COUNT(*) AS total_questions FROM public.odd_one_out_questions
UNION ALL
SELECT 'Word Analogy' AS game_type, COUNT(*) AS total_questions FROM public.word_analogy_questions
UNION ALL
SELECT 'Custom MCQ' AS game_type, COUNT(*) AS total_questions FROM public.mcq_questions;

