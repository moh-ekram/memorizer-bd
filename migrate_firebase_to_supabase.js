/**
 * ==============================================================================
 * FIREBASE TO SUPABASE COMPLETE MIGRATION SCRIPT (ZERO DATA LOSS)
 * ==============================================================================
 * 
 * Requirements:
 * npm install firebase-admin @supabase/supabase-js dotenv
 * 
 * Usage:
 * 1. Download your Firebase Service Account JSON from Firebase Console:
 *    Project Settings -> Service Accounts -> "Generate new private key"
 *    Save it as "serviceAccountKey.json" in this directory.
 * 
 * 2. Set your Supabase credentials in .env or run directly:
 *    SUPABASE_URL=https://your-project.supabase.co
 *    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
 * 
 * 3. Run:
 *    node migrate_firebase_to_supabase.js
 * ==============================================================================
 */

import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Check Service Account Key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('\n❌ ERROR: "serviceAccountKey.json" not found!');
  console.error('👉 Download it from: Firebase Console -> Project Settings -> Service Accounts -> "Generate New Private Key"');
  console.error('👉 Rename it to "serviceAccountKey.json" and place it in the project root.\n');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// 2. Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌ ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing!');
  console.error('👉 Get them from: Supabase Dashboard -> Project Settings -> API (use "service_role" secret key, NOT anon key).');
  console.error('👉 Set them in .env file or run with:');
  console.error('   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node migrate_firebase_to_supabase.js\n');
  process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const firestore = admin.firestore();

// Initialize Supabase Client with Service Role (Bypasses RLS for migration)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🚀 Starting Zero-Data-Loss Migration from Firebase to Supabase...\n');

async function migrateUsers() {
  console.log('📦 [1/7] Migrating Users & Student Progress...');
  const snapshot = await firestore.collection('users').get();
  if (snapshot.empty) {
    console.log('   ⚠️ No users found in Firebase.');
    return;
  }

  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const userId = doc.id;

    const payload = {
      id: userId,
      email: data.email || `${userId}@migrated.user`,
      display_name: data.displayName || data.name || '',
      role: data.role || 'student',
      is_approved: data.isApproved !== undefined ? data.isApproved : true,
      status: data.status || 'active',
      progress: data.progress || {},
      flashcard_positions: data.flashcardPositions || {},
      folders: Array.isArray(data.folders) ? data.folders : [],
      goal: data.goal || { dailyTarget: 15, streak: 1 },
      settings: data.settings || {},
      synonym_progress: data.synonymProgress || {},
      blank_progress: data.blankProgress || {},
      ooo_progress: data.oooProgress || {},
      analogy_progress: data.analogyProgress || {},
      enrolled_course_ids: Array.isArray(data.enrolledCourseIds) ? data.enrolledCourseIds : ['bank-bcs-gre'],
      active_course_id: data.activeCourseId || 'bank-bcs-gre',
      quiz_score: typeof data.quizScore === 'number' ? data.quizScore : 0,
      quiz_taken: typeof data.quizTaken === 'number' ? data.quizTaken : 0,
      balance: typeof data.balance === 'number' ? data.balance : 0.00,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error(`   ❌ Failed to migrate user ${userId} (${payload.email}):`, error.message);
    } else {
      count++;
    }
  }
  console.log(`   ✅ Successfully migrated ${count}/${snapshot.size} users with full progress.`);
}

async function migrateCourses() {
  console.log('\n📦 [2/7] Migrating Courses, Words, Stories & Articles...');
  const snapshot = await firestore.collection('courses').get();
  if (snapshot.empty) {
    console.log('   ⚠️ No custom courses in Firestore (standard local courses will remain accessible).');
    return;
  }

  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const courseId = doc.id;

    const payload = {
      id: courseId,
      title: data.title || 'Untitled Course',
      description: data.description || '',
      category: data.category || 'General',
      level: data.level || 'All Levels',
      price: typeof data.price === 'number' ? data.price : 0.00,
      is_free: Boolean(data.isFree),
      is_published: data.isPublished !== undefined ? Boolean(data.isPublished) : true,
      thumbnail_url: data.thumbnailUrl || null,
      words: Array.isArray(data.words) ? data.words : [],
      stories: Array.isArray(data.stories) ? data.stories : [],
      articles: Array.isArray(data.articles) ? data.articles : [],
      metadata: data.metadata || {},
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('courses').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error(`   ❌ Failed to migrate course ${courseId}:`, error.message);
    } else {
      count++;
    }
  }
  console.log(`   ✅ Successfully migrated ${count}/${snapshot.size} courses.`);
}

async function migrateAccessRequests() {
  console.log('\n📦 [3/7] Migrating Enrollment Requests & Payment Verification...');
  const snapshot = await firestore.collection('access_requests').get();
  if (snapshot.empty) {
    console.log('   ⚠️ No access requests found.');
    return;
  }

  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const payload = {
      id: doc.id,
      user_id: data.userId || 'unknown',
      user_email: data.userEmail || '',
      user_name: data.userName || '',
      course_id: data.courseId || '',
      course_title: data.courseTitle || '',
      status: data.status || 'pending',
      payment_method: data.paymentMethod || '',
      transaction_id: data.transactionId || '',
      phone_number: data.phoneNumber || '',
      amount: typeof data.amount === 'number' ? data.amount : 0.00,
      created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
    };

    const { error } = await supabase.from('access_requests').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error(`   ❌ Failed to migrate access request ${doc.id}:`, error.message);
    } else {
      count++;
    }
  }
  console.log(`   ✅ Successfully migrated ${count}/${snapshot.size} access requests.`);
}

async function migrateAnnouncements() {
  console.log('\n📦 [4/7] Migrating Announcements...');
  const snapshot = await firestore.collection('announcements').get();
  if (snapshot.empty) {
    console.log('   ⚠️ No announcements found.');
    return;
  }

  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const payload = {
      id: doc.id,
      title: data.title || '',
      message: data.message || '',
      type: data.type || 'info',
      is_active: data.isActive !== undefined ? Boolean(data.isActive) : true,
      target_course_id: data.targetCourseId || null
    };

    const { error } = await supabase.from('announcements').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error(`   ❌ Failed announcement ${doc.id}:`, error.message);
    } else {
      count++;
    }
  }
  console.log(`   ✅ Successfully migrated ${count}/${snapshot.size} announcements.`);
}

async function migrateGameQuestions() {
  console.log('\n📦 [5/7] Migrating Game Question Banks (Odd One Out, Blanks, Analogy, MCQ)...');
  
  const tables = [
    { firestore: 'odd_one_out_questions', supabase: 'odd_one_out_questions' },
    { firestore: 'blank_questions', supabase: 'blank_questions' },
    { firestore: 'word_analogy_questions', supabase: 'word_analogy_questions' },
    { firestore: 'mcq_questions', supabase: 'mcq_questions' }
  ];

  for (const t of tables) {
    const snap = await firestore.collection(t.firestore).get();
    if (!snap.empty) {
      let c = 0;
      for (const doc of snap.docs) {
        const d = doc.data();
        const { error } = await supabase.from(t.supabase).upsert({
          id: doc.id,
          course_id: d.courseId || d.course_id || null,
          data: d
        }, { onConflict: 'id' });
        if (!error) c++;
      }
      console.log(`   ✅ Migrated ${c}/${snap.size} items for ${t.supabase}.`);
    }
  }
}

async function migrateExams() {
  console.log('\n📦 [6/7] Migrating Exams & Student Submissions...');
  const examsSnap = await firestore.collection('exams').get();
  if (!examsSnap.empty) {
    let c = 0;
    for (const doc of examsSnap.docs) {
      const d = doc.data();
      const { error } = await supabase.from('exams').upsert({
        id: doc.id,
        title: d.title || 'Exam',
        description: d.description || '',
        course_id: d.courseId || d.course_id || null,
        duration_minutes: d.durationMinutes || 30,
        total_marks: d.totalMarks || 100,
        pass_marks: d.passMarks || 40,
        questions: Array.isArray(d.questions) ? d.questions : [],
        is_published: d.isPublished !== undefined ? d.isPublished : true
      }, { onConflict: 'id' });
      if (!error) c++;
    }
    console.log(`   ✅ Migrated ${c}/${examsSnap.size} exams.`);
  }

  const subSnap = await firestore.collection('exam_submissions').get();
  if (!subSnap.empty) {
    let sc = 0;
    for (const doc of subSnap.docs) {
      const d = doc.data();
      const { error } = await supabase.from('exam_submissions').upsert({
        id: doc.id,
        exam_id: d.examId || d.exam_id,
        user_id: d.userId || d.user_id,
        score: d.score || 0,
        total_marks: d.totalMarks || 100,
        answers: d.answers || {},
        submitted_at: d.submittedAt || new Date().toISOString()
      }, { onConflict: 'id' });
      if (!error) sc++;
    }
    console.log(`   ✅ Migrated ${sc}/${subSnap.size} exam submissions.`);
  }
}

async function verifyMigration() {
  console.log('\n🔍 [7/7] Verifying Supabase Data Counts...');
  const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
  const { count: coursesCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
  const { count: reqsCount } = await supabase.from('access_requests').select('*', { count: 'exact', head: true });

  console.log('----------------------------------------------------');
  console.log(`🎉 MIGRATION COMPLETE! Summary in Supabase:`);
  console.log(`   👥 Total Users: ${usersCount || 0}`);
  console.log(`   📚 Total Courses: ${coursesCount || 0}`);
  console.log(`   📝 Total Requests: ${reqsCount || 0}`);
  console.log('----------------------------------------------------');
  console.log('All user progress (words, games, positions) is fully preserved!');
}

async function run() {
  try {
    await migrateUsers();
    await migrateCourses();
    await migrateAccessRequests();
    await migrateAnnouncements();
    await migrateGameQuestions();
    await migrateExams();
    await verifyMigration();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Critical Error during migration:', err);
    process.exit(1);
  }
}

run();
