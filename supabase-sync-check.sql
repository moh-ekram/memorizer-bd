-- ==============================================================================
-- Supabase Database Synchronization & Health Check Script
-- Project: memorizer-bd
-- File: supabase-sync-check.sql
-- ==============================================================================
-- Run these queries directly inside the Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- to verify client connectivity, table existence, and row synchronization counts.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CLIENT TO SUPABASE CONNECTION & SERVER HEALTH CHECK
-- ------------------------------------------------------------------------------
SELECT 
  current_database() AS database_name,
  current_user AS connected_user,
  version() AS postgres_version,
  NOW() AS server_timestamp,
  'CONNECTED & HEALTHY' AS connection_status;

-- ------------------------------------------------------------------------------
-- 2. VERIFY TABLE EXISTENCE FOR 'users', 'courses', AND 'access_requests'
-- ------------------------------------------------------------------------------
SELECT 
  table_name,
  table_schema,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ TABLE EXISTS'
    ELSE '❌ MISSING'
  END AS verification_status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'courses', 'access_requests', 'system_settings')
ORDER BY table_name ASC;

-- ------------------------------------------------------------------------------
-- 3. VERIFY SYNCHRONIZATION: ROW COUNTS AND LATEST UPDATE TIMESTAMPS
-- ------------------------------------------------------------------------------
-- Note: 'access_requests' showing 0 rows is 100% normal if no users have 
-- submitted a course access/enrollment request yet!
SELECT 
  'users' AS table_name,
  COUNT(*) AS total_entries,
  MAX(updated_at) AS latest_sync_timestamp,
  'Contains student & admin accounts, study progress, and quiz history' AS description
FROM public.users

UNION ALL

SELECT 
  'courses' AS table_name,
  COUNT(*) AS total_entries,
  MAX(updated_at) AS latest_sync_timestamp,
  'Contains custom and system courses, word lists, and lessons' AS description
FROM public.courses

UNION ALL

SELECT 
  'access_requests' AS table_name,
  COUNT(*) AS total_entries,
  MAX(created_at) AS latest_sync_timestamp,
  'Contains enrollment and manual payment approval requests (empty until user requests)' AS description
FROM public.access_requests

UNION ALL

SELECT 
  'system_settings' AS table_name,
  COUNT(*) AS total_entries,
  MAX(updated_at) AS latest_sync_timestamp,
  'Contains global payment credentials, website landing config, filter labels' AS description
FROM public.system_settings;

-- ------------------------------------------------------------------------------
-- 4. INSPECT RECENT DATA SAMPLES FROM EACH CORE TABLE
-- ------------------------------------------------------------------------------

-- Sample from 'users' table:
SELECT 
  id, 
  email, 
  display_name, 
  role, 
  status, 
  active_course_id, 
  quiz_taken, 
  updated_at
FROM public.users 
ORDER BY updated_at DESC NULLS LAST 
LIMIT 5;

-- Sample from 'courses' table:
SELECT 
  id, 
  title, 
  category, 
  level, 
  price, 
  is_free, 
  jsonb_array_length(COALESCE(words, '[]'::jsonb)) AS total_words,
  updated_at
FROM public.courses 
ORDER BY updated_at DESC NULLS LAST 
LIMIT 5;

-- Sample from 'access_requests' table (if any exist):
SELECT 
  id, 
  user_id, 
  user_email, 
  user_name, 
  course_id, 
  course_title, 
  status, 
  created_at
FROM public.access_requests 
ORDER BY created_at DESC NULLS LAST 
LIMIT 5;

-- ------------------------------------------------------------------------------
-- 5. VERIFY ROW LEVEL SECURITY (RLS) POLICIES ON CORE TABLES
-- Ensures the client web app is permitted to read and write data without 401/403 errors
-- ------------------------------------------------------------------------------
SELECT 
  tablename, 
  policyname, 
  roles, 
  cmd AS operation, 
  permissive
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'courses', 'access_requests', 'system_settings')
ORDER BY tablename, cmd;
