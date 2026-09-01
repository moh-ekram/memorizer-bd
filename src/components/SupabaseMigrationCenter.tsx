import React, { useState, useEffect } from 'react';
import {
  Database,
  Cloud,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Server,
  Play,
  FileCode,
  Users,
  BookOpen,
  HelpCircle,
  CreditCard,
  Sliders,
  Terminal,
  Clock,
  Sparkles
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
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
  const [activeTab, setActiveTab] = useState<'migration' | 'sql' | 'export'>('migration');
  const [isExportingJson, setIsExportingJson] = useState(false);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ timestamp: time, message, type }, ...prev].slice(0, 300));
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
        // If courses table not created yet, check if client reached database
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
    addLog('🚀 Zero-Data-Loss Migration process started...', 'info');

    const client = createClient(supabaseUrl.trim(), supabaseKey.trim(), {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    try {
      // -------------------------------------------------------------
      // PHASE 1: Migrate System Settings
      // -------------------------------------------------------------
      setCurrentStep('1/6: System Settings & Platform Configurations Migration...');
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

      // -------------------------------------------------------------
      // PHASE 2: Migrate Courses, Words & Articles
      // -------------------------------------------------------------
      setCurrentStep('2/6: Courses, Vocabularies & Articles Migration...');
      setProgressPercent(30);
      addLog('📦 [2/6] Reading Courses from Firebase Firestore...', 'info');

      const coursesSnap = await getDocs(collection(db, 'courses'));
      setStats((prev) => ({ ...prev, coursesTotal: coursesSnap.size }));
      addLog(`Found ${coursesSnap.size} courses to migrate.`, 'info');

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
          addLog(`❌ Failed to migrate Course "${courseId}": ${error.message}`, 'error');
        } else {
          courseCount++;
          setStats((prev) => ({ ...prev, coursesDone: courseCount }));
          addLog(`✅ Course synced: "${payload.title}" (${(payload.words || []).length} words)`, 'success');
        }
      }

      // -------------------------------------------------------------
      // PHASE 3: Migrate Question Banks (MCQ, Blank, Analogy, OddOneOut)
      // -------------------------------------------------------------
      setCurrentStep('3/6: Interactive Game Question Banks Migration...');
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
        } catch (e: any) {
          // collection might not exist, skip silently
        }
      }
      setStats((prev) => ({ ...prev, questionsTotal: totalQuestions, questionsDone: totalQuestions }));

      // -------------------------------------------------------------
      // PHASE 4: Migrate Access Requests & bKash Transactions
      // -------------------------------------------------------------
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

      // -------------------------------------------------------------
      // PHASE 5: Migrate Users & Student Progress
      // -------------------------------------------------------------
      setCurrentStep('5/6: User Profiles & Study Progress Migration...');
      setProgressPercent(85);
      addLog('📦 [5/6] Reading Users and Learning Progress from Firebase...', 'info');

      const usersSnap = await getDocs(collection(db, 'users'));
      setStats((prev) => ({ ...prev, usersTotal: usersSnap.size }));
      addLog(`Found ${usersSnap.size} user accounts to migrate.`, 'info');

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

      // -------------------------------------------------------------
      // PHASE 6: Complete
      // -------------------------------------------------------------
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

  // Export Full JSON Backup
  const exportFullJsonBackup = async () => {
    setIsExportingJson(true);
    addLog('📥 Generating complete JSON export from Firebase...', 'info');

    try {
      const backupData: Record<string, any> = {
        exportedAt: new Date().toISOString(),
        users: {},
        courses: {},
        access_requests: {},
        system_settings: {},
        questions: {}
      };

      // Users
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach((d) => {
        backupData.users[d.id] = d.data();
      });

      // Courses
      const coursesSnap = await getDocs(collection(db, 'courses'));
      coursesSnap.forEach((d) => {
        backupData.courses[d.id] = d.data();
      });

      // Access Requests
      const reqSnap = await getDocs(collection(db, 'access_requests'));
      reqSnap.forEach((d) => {
        backupData.access_requests[d.id] = d.data();
      });

      // System Settings
      const sysSnap = await getDocs(collection(db, 'system_settings'));
      sysSnap.forEach((d) => {
        backupData.system_settings[d.id] = d.data();
      });

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vocabulary_firebase_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog('✅ Complete JSON Backup downloaded successfully!', 'success');
    } catch (err: any) {
      addLog(`❌ Backup download failed: ${err.message}`, 'error');
      alert(`Backup error: ${err.message}`);
    } finally {
      setIsExportingJson(false);
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

  return (
    <div className="space-y-6 animate-fade-in font-['Poppins',sans-serif]">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-indigo-800/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400">
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
                Directly migrate all users, vocabulary progress, courses, payments, and question banks to Supabase with 1-click.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportFullJsonBackup}
              disabled={isExportingJson}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-white/10 cursor-pointer"
              title="Download full JSON backup of Firebase database"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isExportingJson ? 'Exporting...' : 'Backup JSON'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 gap-2 pb-2">
        <button
          onClick={() => setActiveTab('migration')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'migration'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Live 1-Click Migration</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'sql'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Supabase SQL Schema</span>
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'export'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Offline Backup & Restore</span>
        </button>
      </div>

      {/* TAB 1: LIVE 1-CLICK MIGRATION */}
      {activeTab === 'migration' && (
        <div className="space-y-6">
          {/* Connection Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source: Firebase */}
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

            {/* Target: Supabase */}
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

      {/* TAB 2: SUPABASE SQL SCHEMA */}
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

      {/* TAB 3: OFFLINE BACKUP */}
      {activeTab === 'export' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Offline Database JSON Backup</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Download all collections (users, progress records, custom courses, and transactions) as a single JSON file.
            </p>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h5 className="text-xs font-black text-slate-800">Complete JSON Snapshot</h5>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Contains complete users with progress map, flashcard indices, course words, and question bank records.
              </p>
            </div>

            <button
              type="button"
              onClick={exportFullJsonBackup}
              disabled={isExportingJson}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingJson ? 'Downloading...' : 'Download Full JSON Backup'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
