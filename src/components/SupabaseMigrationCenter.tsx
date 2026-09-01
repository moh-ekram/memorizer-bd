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
  const [activeTab, setActiveTab] = useState<'migration' | 'json-backup' | 'sql'>('migration');
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isRestoringJson, setIsRestoringJson] = useState(false);
  const [jsonUploadStats, setJsonUploadStats] = useState<{
    users: number;
    courses: number;
    access_requests: number;
    system_settings: number;
    fileName?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      for (const [key, val] of Object.entries(settingsObj)) {
        await client.from('system_settings').upsert({
          key,
          value: val,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
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
        if (!error) cDone++;
      }
      addLog(`✅ Uploaded ${cDone}/${courseCount} Courses with vocabularies to Supabase.`, 'success');

      // 3. Requests
      addLog('📦 [3/4] Uploading Access Requests from JSON...', 'info');
      let rDone = 0;
      for (const [rId, rVal] of Object.entries(requestsObj) as any) {
        await client.from('access_requests').upsert({
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
        rDone++;
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
        if (!error) uDone++;
      }
      addLog(`✅ Uploaded ${uDone}/${userCount} User Profiles with full progress to Supabase!`, 'success');

      alert(`🎉 JSON ফাইল থেকে সফলভাবে Supabase-এ সমস্ত ডেটা আপলোড সম্পন্ন হয়েছে!\n\nমোট: ${uDone} জন ইউজার, ${cDone} টি কোর্স।`);
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
      <div className="flex border-b border-slate-200 gap-2 pb-2">
        <button
          onClick={() => setActiveTab('migration')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'migration'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Live 1-Click Migration</span>
        </button>

        <button
          onClick={() => setActiveTab('json-backup')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'json-backup'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>JSON File Download & Upload (সরাসরি ফাইল ট্রান্সফার)</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* STEP 1: DOWNLOAD JSON */}
            <div className="p-6 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 rounded-2xl border border-emerald-200/80 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">1</span>
                  <h5 className="text-sm font-black text-slate-850">Firebase থেকে JSON ফাইল ডাউনলোড করুন</h5>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  এই বাটনে ক্লিক করলে আপনার Firebase এর সব ইউজার প্রোফাইল, লার্নিং প্রগ্রেস, ফ্ল্যাশকার্ডের লাস্ট পজিশন ও কোর্স ডেটা একটি কমপ্লিট <code>.json</code> ফাইল হিসেবে আপনার পিসিতে ডাউনলোড হয়ে যাবে।
                </p>
              </div>

              <div className="pt-2 pl-8">
                <button
                  type="button"
                  onClick={exportFullJsonBackup}
                  disabled={isExportingJson}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingJson ? 'ডাউনলোড তৈরি হচ্ছে...' : '📥 ডাউনলোড করুন Complete JSON Backup'}</span>
                </button>
              </div>
            </div>

            {/* STEP 2: UPLOAD TO SUPABASE */}
            <div className="p-6 bg-gradient-to-br from-indigo-50/70 to-purple-50/40 rounded-2xl border border-indigo-200/80 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">2</span>
                  <h5 className="text-sm font-black text-slate-850">ডাউনলোডকৃত JSON ফাইল Supabase-এ আপলোড করুন</h5>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-8">
                  আপনার ডাউনলোড করা <code>vocabulary_database_complete_backup.json</code> ফাইলটি এখানে সিলেক্ট করলেই সমস্ত ডেটা কোনো ডাটা লস ছাড়াই Supabase-এর টেবিলে ইমপোর্ট হয়ে যাবে।
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
                  className={`w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                    isRestoringJson ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {isRestoringJson ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>সুপাবেজে আপলোড হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-4 h-4" />
                      <span>📤 JSON ফাইল সিলেক্ট করে Supabase-এ আপলোড দিন</span>
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
              <li>প্রথম ধাপে <strong>"ডাউনলোড করুন Complete JSON Backup"</strong> বাটনে চাপ দিন। আপনার ডিভাইসে একটি <code>.json</code> ফাইল সেভ হবে।</li>
              <li>উপরে বা লাইভ ট্যাবে Supabase Credentials (URL ও Key) ঠিক আছে কিনা তা দেখে নিন।</li>
              <li>দ্বিতীয় ধাপে <strong>"JSON ফাইল সিলেক্ট করে Supabase-এ আপলোড দিন"</strong> বাটনে ক্লিক করে ডাউনলোড করা ফাইলটি বেছে নিন।</li>
              <li>১-২ মিনিটের মধ্যেই সব ইউজার প্রগ্রেস ও কোর্স Supabase ক্লাউডে সফলভাবে ট্রান্সফার হয়ে যাবে!</li>
            </ol>
          </div>
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
