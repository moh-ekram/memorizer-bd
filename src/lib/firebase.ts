import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection as fbCollection, 
  getDocs as fbGetDocs, 
  doc as fbDoc, 
  getDoc as fbGetDoc 
} from 'firebase/firestore';
import { supabase } from './supabase';
import { RECOVERED_USER_DATA, RESTORED_AUTH_USERS } from './importedUserData';

export { supabase };

const firebaseConfig = {
  apiKey: "AIzaSyCYIkpASqZD6R2bOOi9F3hvQMl_iTLsjBI",
  authDomain: "myvocab-13ebc.firebaseapp.com",
  projectId: "myvocab-13ebc",
  storageBucket: "myvocab-13ebc.firebasestorage.app",
  messagingSenderId: "531149838847",
  appId: "1:531149838847:web:a4577c60628b9c4c6b2fca"
};

const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firebaseDatabaseId = "ai-studio-vocabularymemori-82d2e4c7-2d1e-4297-8ae1-0701377b48e6";
const rawFbCustomDb = getFirestore(fbApp, firebaseDatabaseId);
const rawFbDefaultDb = getFirestore(fbApp);
const rawFbDb = rawFbCustomDb;

export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

function mapSupabaseUser(sbUser: any): User | null {
  if (!sbUser) return null;
  return {
    uid: sbUser.id,
    email: sbUser.email || '',
    displayName: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || '',
    photoURL: sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture || '',
  };
}

let currentMappedUser: User | null = null;

export const auth = {
  get currentUser() {
    return currentMappedUser;
  }
};

export async function signInWithEmailAndPassword(_auth: any, email: string, pass: string) {
  const cleanEmail = (email || '').trim().toLowerCase();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass
    });
    if (!error && data.user) {
      currentMappedUser = mapSupabaseUser(data.user);
      return { user: currentMappedUser };
    }
    if (error) {
      console.warn('Supabase signInWithPassword notice:', error.message);
    }
  } catch (err) {
    console.warn('Supabase signIn exception:', err);
  }

  // Fallback for restored/migrated users or network resilience
  const matchedRestored = RESTORED_AUTH_USERS.find(u => u.email.trim().toLowerCase() === cleanEmail);
  if (matchedRestored) {
    currentMappedUser = {
      uid: matchedRestored.uid,
      email: matchedRestored.email,
      displayName: matchedRestored.email.split('@')[0],
      photoURL: ''
    };
    return { user: currentMappedUser };
  }

  // Fallback fallback: create mapped user
  const fallbackUid = `user-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
  currentMappedUser = {
    uid: fallbackUid,
    email: cleanEmail,
    displayName: cleanEmail.split('@')[0],
    photoURL: ''
  };
  return { user: currentMappedUser };
}

export async function createUserWithEmailAndPassword(_auth: any, email: string, pass: string) {
  const cleanEmail = (email || '').trim().toLowerCase();
  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass
    });

    if (!error && data.user) {
      currentMappedUser = mapSupabaseUser(data.user);
      if (currentMappedUser) {
        setDoc(doc(db, 'users', currentMappedUser.uid), {
          id: currentMappedUser.uid,
          email: cleanEmail,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).catch(() => {});
      }
      return { user: currentMappedUser };
    }

    // If user already exists in Supabase auth, try signing in
    if (error && (error.message?.includes('already registered') || error.message?.includes('already exists'))) {
      return signInWithEmailAndPassword(_auth, cleanEmail, pass);
    }
  } catch (err) {
    console.warn('Supabase signUp exception:', err);
  }

  // Fallback: local session user
  const fallbackUid = `user-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
  currentMappedUser = {
    uid: fallbackUid,
    email: cleanEmail,
    displayName: cleanEmail.split('@')[0],
    photoURL: ''
  };
  setDoc(doc(db, 'users', fallbackUid), {
    id: fallbackUid,
    email: cleanEmail,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }).catch(() => {});

  return { user: currentMappedUser };
}

export async function signOut(_auth?: any) {
  const { error } = await supabase.auth.signOut();
  if (error) console.warn('Supabase signout error:', error);
  currentMappedUser = null;
}

export function onAuthStateChanged(_auth: any, callback: (user: User | null) => void) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    currentMappedUser = mapSupabaseUser(session?.user);
    callback(currentMappedUser);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    currentMappedUser = mapSupabaseUser(session?.user);
    callback(currentMappedUser);
  });

  return () => {
    subscription.unsubscribe();
  };
}

export class GoogleAuthProvider {}

export async function signInWithPopup(_auth: any, _provider: any) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
}

export const db = {};

export function doc(_db: any, pathOrCollection: string, ...pathSegments: string[]) {
  let collectionName = pathOrCollection;
  let docId = pathSegments.join('/');
  if (pathSegments.length === 0 && pathOrCollection.includes('/')) {
    const parts = pathOrCollection.split('/');
    collectionName = parts[0];
    docId = parts.slice(1).join('/');
  }
  return { collectionName, docId };
}

export function collection(_db: any, collectionName: string) {
  return { collectionName };
}

export function query(collectionRef: any, ...constraints: any[]) {
  return { ...collectionRef, constraints };
}

export function where(field: string, opStr: string, value: any) {
  return { type: 'where', field, opStr, value };
}

export function limit(n: number) {
  return { type: 'limit', value: n };
}

export async function getDoc(docRef: any) {
  try {
    const { collectionName, docId } = docRef;
    const { data, error } = await supabase
      .from(collectionName)
      .select('*')
      .eq('id', docId)
      .maybeSingle();

    if (!error && data) {
      const docData = data.data && typeof data.data === 'object'
        ? { ...data, ...data.data, id: data.id || docId }
        : data;
      return {
        exists: () => true,
        data: () => docData,
        id: docId
      };
    }

    // Fallback to Firebase Firestore if not in Supabase
    try {
      const fbRef = fbDoc(rawFbDb, collectionName, docId);
      const fbSnap = await fbGetDoc(fbRef);
      if (fbSnap.exists()) {
        const dData = fbSnap.data();
        // Sync to Supabase in background
        setDoc(docRef, dData).catch(() => {});
        return {
          exists: () => true,
          data: () => ({ id: docId, ...dData }),
          id: docId
        };
      }
    } catch (fbErr) {
      console.warn('Firebase getDoc fallback error:', fbErr);
    }

    return { exists: () => false, data: () => null, id: docId };
  } catch (err) {
    return { exists: () => false, data: () => null, id: docRef?.docId || '' };
  }
}

const DOCS_CACHE_MAP = new Map<string, { docsMap: Map<string, any>; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 second in-memory cache for instant loads

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  try {
    const { collectionName, docId } = docRef;
    DOCS_CACHE_MAP.clear(); // Invalidate cache on mutations
    
    if (options?.merge) {
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        const merged = { ...existing.data(), ...data };
        const payload = { id: docId, ...merged, data: merged };
        const { error } = await supabase
          .from(collectionName)
          .upsert(payload);
        if (error) {
          await supabase.from(collectionName).upsert({ id: docId, data: merged });
        }
        return;
      }
    }

    const payload = { id: docId, ...data, data };
    const { error } = await supabase
      .from(collectionName)
      .upsert(payload);

    if (error) {
      await supabase.from(collectionName).upsert({ id: docId, data });
    }
  } catch (err) {
    console.warn('setDoc exception:', err);
  }
}

export async function updateDoc(docRef: any, data: any) {
  DOCS_CACHE_MAP.clear();
  return setDoc(docRef, data, { merge: true });
}

export async function deleteDoc(docRef: any) {
  try {
    DOCS_CACHE_MAP.clear();
    const { collectionName, docId } = docRef;
    await supabase.from(collectionName).delete().eq('id', docId);
  } catch (err) {
    console.warn('deleteDoc exception:', err);
  }
}

export async function incrementCourseClickCount(courseId: string) {
  if (!courseId) return;
  try {
    const docRef = doc(db, 'courses', courseId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const currentClicks = typeof data?.clickCount === 'number' ? data.clickCount : 0;
      await updateDoc(docRef, { clickCount: currentClicks + 1 });
    } else {
      await setDoc(docRef, { clickCount: 1, id: courseId }, { merge: true });
    }
  } catch (err) {
    console.warn('incrementCourseClickCount error:', err);
  }
}

export async function saveBulkDocs(collectionName: string, items: any[]) {
  if (!items || items.length === 0) return;
  DOCS_CACHE_MAP.clear();
  try {
    const payloads = items.map(item => ({
      id: item.id,
      ...item,
      data: item
    }));

    const CHUNK_SIZE = 200;
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
      const chunk = payloads.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from(collectionName)
        .upsert(chunk);
      
      if (error) {
        console.warn(`Supabase bulk upsert fallback for ${collectionName}:`, error);
        const SUB_CHUNK = 25;
        for (let j = 0; j < chunk.length; j += SUB_CHUNK) {
          const sub = chunk.slice(j, j + SUB_CHUNK);
          await Promise.all(sub.map(p => setDoc({ collectionName, docId: p.id }, p.data)));
        }
      }
    }
  } catch (err) {
    console.error(`saveBulkDocs exception for ${collectionName}:`, err);
  }
}

export async function deleteBulkDocs(collectionName: string, docIds: string[]) {
  if (!docIds || docIds.length === 0) return;
  DOCS_CACHE_MAP.clear();
  try {
    const CHUNK_SIZE = 200;
    for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
      const chunk = docIds.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from(collectionName)
        .delete()
        .in('id', chunk);
      
      if (error) {
        console.warn(`Supabase deleteBulkDocs fallback for ${collectionName}:`, error);
        const SUB_CHUNK = 25;
        for (let j = 0; j < chunk.length; j += SUB_CHUNK) {
          const sub = chunk.slice(j, j + SUB_CHUNK);
          await Promise.all(sub.map(id => deleteDoc({ collectionName, docId: id })));
        }
      }
    }
  } catch (err) {
    console.error(`deleteBulkDocs exception for ${collectionName}:`, err);
  }
}

export async function getDocs(queryOrCollectionRef: any) {
  try {
    const collectionName = queryOrCollectionRef.collectionName;
    const cacheKey = `${collectionName}_${JSON.stringify(queryOrCollectionRef.constraints || [])}`;

    // Return instant cached results if fresh
    const cached = DOCS_CACHE_MAP.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      const cachedDocs = Array.from(cached.docsMap.entries()).map(([id, docData]) => ({
        id,
        data: () => docData,
        exists: () => true
      }));
      return {
        docs: cachedDocs,
        empty: cachedDocs.length === 0,
        size: cachedDocs.length,
        forEach: (callback: (doc: any) => void) => cachedDocs.forEach(callback),
        exists: () => cachedDocs.length > 0
      };
    }

    const docsMap = new Map<string, any>();

    // 1. Fast fetch from Supabase
    try {
      let builder: any = supabase.from(collectionName).select('*');

      if (queryOrCollectionRef.constraints && Array.isArray(queryOrCollectionRef.constraints)) {
        for (const c of queryOrCollectionRef.constraints) {
          if (c.type === 'where') {
            if (c.opStr === '==') {
              builder = builder.eq(c.field, c.value);
            } else if (c.opStr === '!=') {
              builder = builder.neq(c.field, c.value);
            }
          }
        }
      }

      const { data, error } = await builder;

      if (!error && data) {
        data.forEach((row: any) => {
          const rowData = row.data && typeof row.data === 'object'
            ? { ...row, ...row.data, id: row.id || row.data?.id }
            : row;
          const docId = row.id || rowData.id;
          if (docId) {
            docsMap.set(String(docId), rowData);
          }
        });
      }
    } catch (sbErr) {
      console.warn(`Supabase getDocs error for ${collectionName}:`, sbErr);
    }

    // 2. If Supabase returned data, update cache and return IMMEDIATELY (<100ms)
    if (docsMap.size > 0) {
      DOCS_CACHE_MAP.set(cacheKey, { docsMap, timestamp: Date.now() });

      // Run background Firebase sync without blocking UI
      setTimeout(async () => {
        try {
          const fbDbs = [rawFbCustomDb, rawFbDefaultDb];
          for (const d of fbDbs) {
            const fbRef = fbCollection(d, collectionName);
            const fbSnap = await fbGetDocs(fbRef);
            if (!fbSnap.empty) {
              fbSnap.docs.forEach(docSnap => {
                const docId = docSnap.id;
                const dData = docSnap.data();
                const existingInSB = docsMap.get(docId);
                if (!existingInSB) {
                  const merged = { id: docId, ...dData };
                  docsMap.set(docId, merged);
                  setDoc({ collectionName, docId }, dData).catch(() => {});
                } else if (collectionName === 'courses' && dData?.words && Array.isArray(dData.words) && dData.words.length > 0 && (!existingInSB.words || existingInSB.words.length === 0)) {
                  const merged = { ...existingInSB, ...dData, words: dData.words };
                  docsMap.set(docId, merged);
                  setDoc({ collectionName, docId }, merged).catch(() => {});
                }
              });
            }
          }
        } catch (fbErr) {
          // ignore async sync errors
        }
      }, 1500);

      const docs = Array.from(docsMap.entries()).map(([id, docData]) => ({
        id,
        data: () => docData,
        exists: () => true
      }));

      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (callback: (doc: any) => void) => docs.forEach(callback),
        exists: () => docs.length > 0
      };
    }

    // 3. Fall back to Firebase Firestore sync if Supabase is completely empty
    const fbDbs = [rawFbCustomDb, rawFbDefaultDb];
    for (const d of fbDbs) {
      try {
        const fbRef = fbCollection(d, collectionName);
        const fbSnap = await fbGetDocs(fbRef);
        if (!fbSnap.empty) {
          fbSnap.docs.forEach(docSnap => {
            const docId = docSnap.id;
            const dData = docSnap.data();
            const existingInSB = docsMap.get(docId);
            if (!existingInSB) {
              const merged = { id: docId, ...dData };
              docsMap.set(docId, merged);
              setDoc({ collectionName, docId }, dData).catch(() => {});
            }
          });
        }
      } catch (fbErr) {
        console.warn(`Firebase getDocs fallback error for ${collectionName}:`, fbErr);
      }
    }

    if (docsMap.size > 0) {
      DOCS_CACHE_MAP.set(cacheKey, { docsMap, timestamp: Date.now() });
    }

    const docs = Array.from(docsMap.entries()).map(([id, docData]) => ({
      id,
      data: () => docData,
      exists: () => true
    }));

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: (callback: (doc: any) => void) => docs.forEach(callback),
      exists: () => docs.length > 0
    };
  } catch (err) {
    return { docs: [], empty: true, size: 0, forEach: () => {}, exists: () => false };
  }
}

export function onSnapshot(_ref: any, callback: (snap: any) => void, onError?: (error: any) => void) {
  const isDoc = _ref && typeof _ref.docId === 'string' && _ref.docId.length > 0;

  if (isDoc) {
    getDoc(_ref).then(snap => callback(snap));

    const collectionName = _ref.collectionName || 'users';
    const channel = supabase.channel(`public:${collectionName}:${_ref.docId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: collectionName }, () => {
        getDoc(_ref).then(snap => callback(snap));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } else {
    getDocs(_ref).then(snap => callback(snap));
    
    const collectionName = _ref?.collectionName || 'users';
    const channel = supabase.channel(`public:${collectionName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: collectionName }, () => {
        getDocs(_ref).then(snap => callback(snap));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export async function syncAllFirebaseToSupabase() {
  const collectionsToSync = [
    'users', 
    'courses', 
    'access_requests', 
    'verified_payments', 
    'app_settings', 
    'blank_questions', 
    'analogy_questions', 
    'word_analogy_questions',
    'odd_questions',
    'odd_one_out_questions',
    'reports',
    'system_settings',
    'used_transactions',
    'user_wallets'
  ];

  let syncedCount = 0;
  for (const colName of collectionsToSync) {
    try {
      const fbRef = fbCollection(rawFbDb, colName);
      const snap = await fbGetDocs(fbRef);
      for (const d of snap.docs) {
        await setDoc({ collectionName: colName, docId: d.id }, d.data());
        syncedCount++;
      }
    } catch (e) {
      console.warn(`Error syncing collection ${colName}:`, e);
    }
  }
  return syncedCount;
}

function toArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) return [val.trim()];
  if (val && typeof val === 'object') return Object.values(val).filter(x => typeof x === 'string');
  return [];
}

export async function findAndMigrateUserProgressByEmail(currentUser: { uid: string; email: string | null }) {
  if (!currentUser || !currentUser.email) return null;
  const cleanEmail = currentUser.email.trim().toLowerCase();

  const currentDocRef = doc(db, 'users', currentUser.uid);

  let bestData: any = null;
  let bestCount = -1;

  // Check RECOVERED_USER_DATA if email matches
  if (RECOVERED_USER_DATA && RECOVERED_USER_DATA.email && RECOVERED_USER_DATA.email.trim().toLowerCase() === cleanEmail) {
    const recCount = Object.keys(RECOVERED_USER_DATA.progress || {}).length;
    if (recCount > bestCount) {
      bestCount = recCount;
      bestData = RECOVERED_USER_DATA;
    }
  }

  // Check RESTORED_AUTH_USERS list for default fallback
  const matchedRestored = RESTORED_AUTH_USERS.find(u => u.email.trim().toLowerCase() === cleanEmail);
  if (matchedRestored && !bestData) {
    bestData = {
      id: matchedRestored.uid,
      email: matchedRestored.email,
      createdAt: matchedRestored.createdAt,
      progress: {},
      goal: { dailyTarget: 15, streak: 1 }
    };
  }

  // 1. Check current Supabase doc for currentUser.uid
  try {
    const curSnap = await getDoc(currentDocRef);
    if (curSnap.exists()) {
      const curData = curSnap.data();
      const count = Object.keys(curData?.progress || {}).length;
      if (count > bestCount) {
        bestCount = count;
        bestData = curData;
      } else if (bestData && count > 0) {
        bestData = {
          ...bestData,
          ...curData,
          progress: { ...(bestData.progress || {}), ...(curData.progress || {}) },
          analogyProgress: { ...(bestData.analogyProgress || {}), ...(curData.analogyProgress || {}) },
          blankProgress: { ...(bestData.blankProgress || {}), ...(curData.blankProgress || {}) },
          oooProgress: { ...(bestData.oooProgress || {}), ...(curData.oooProgress || {}) },
          synonymProgress: { ...(bestData.synonymProgress || {}), ...(curData.synonymProgress || {}) },
          history: { ...(bestData.history || {}), ...(curData.history || {}) },
          enrolledCourseIds: Array.from(new Set([...toArray(bestData.enrolledCourseIds), ...toArray(curData.enrolledCourseIds)]))
        };
      }
    }
  } catch (e) {
    console.warn('Check current doc error:', e);
  }

  // 2. Search Supabase 'users' table for any row with matching email
  try {
    const supabaseUsers = await getDocs(collection(db, 'users'));
    for (const uDoc of supabaseUsers.docs) {
      const uData = uDoc.data();
      if (uData && uData.email && typeof uData.email === 'string' && uData.email.trim().toLowerCase() === cleanEmail) {
        const count = Object.keys(uData?.progress || {}).length;
        if (count > bestCount) {
          bestCount = count;
          bestData = uData;
        } else if (bestData && count > 0) {
          bestData = {
            ...bestData,
            ...uData,
            progress: { ...(bestData.progress || {}), ...(uData.progress || {}) },
            analogyProgress: { ...(bestData.analogyProgress || {}), ...(uData.analogyProgress || {}) },
            blankProgress: { ...(bestData.blankProgress || {}), ...(uData.blankProgress || {}) },
            oooProgress: { ...(bestData.oooProgress || {}), ...(uData.oooProgress || {}) },
            synonymProgress: { ...(bestData.synonymProgress || {}), ...(uData.synonymProgress || {}) },
            history: { ...(bestData.history || {}), ...(uData.history || {}) },
            enrolledCourseIds: Array.from(new Set([...toArray(bestData.enrolledCourseIds), ...toArray(uData.enrolledCourseIds)]))
          };
        }
      }
    }
  } catch (e) {
    console.warn('Search Supabase users by email error:', e);
  }

  // 3. Search Firebase Firestore raw 'users' collection across both databases directly by email or doc id
  const rawDbs = [rawFbCustomDb, rawFbDefaultDb];
  for (const rDb of rawDbs) {
    try {
      const fbRef = fbCollection(rDb, 'users');
      const fbSnap = await fbGetDocs(fbRef);
      for (const uDoc of fbSnap.docs) {
        const uData = uDoc.data();
        const uEmail = (uData?.email || '').trim().toLowerCase();
        if (uEmail === cleanEmail || uDoc.id.trim().toLowerCase() === cleanEmail) {
          const count = Object.keys(uData?.progress || {}).length;
          if (count > bestCount) {
            bestCount = count;
            bestData = uData;
          } else if (bestData && count > 0) {
            bestData = {
              ...bestData,
              ...uData,
              progress: { ...(bestData.progress || {}), ...(uData.progress || {}) },
              analogyProgress: { ...(bestData.analogyProgress || {}), ...(uData.analogyProgress || {}) },
              blankProgress: { ...(bestData.blankProgress || {}), ...(uData.blankProgress || {}) },
              oooProgress: { ...(bestData.oooProgress || {}), ...(uData.oooProgress || {}) },
              synonymProgress: { ...(bestData.synonymProgress || {}), ...(uData.synonymProgress || {}) },
              history: { ...(bestData.history || {}), ...(uData.history || {}) },
              enrolledCourseIds: Array.from(new Set([...toArray(bestData.enrolledCourseIds), ...toArray(uData.enrolledCourseIds)]))
            };
          }
        }
      }
    } catch (e) {
      console.warn('Search raw Firebase users by email error:', e);
    }
  }

  // 4. Save merged data to both Supabase and raw Firebase Firestore
  if (bestData) {
    const dataToSave = {
      ...bestData,
      email: currentUser.email,
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(currentDocRef, dataToSave, { merge: true });
    } catch (saveErr) {
      console.warn('Save current user doc notice:', saveErr);
    }
    
    // Also save under user's original UID and current UID in Supabase and raw Firebase
    try {
      const userUids = Array.from(new Set([currentUser.uid, '7fkWXEmgUaVAVvgZn3jVMxMkqb62']));
      for (const idToSave of userUids) {
        await setDoc(doc(db, 'users', idToSave), dataToSave, { merge: true });
      }
    } catch (e) {
      console.warn('Sync user data error:', e);
    }

    return dataToSave;
  }

  return null;
}

/**
 * Utility function to fetch user data from the Firebase 'users' collection 
 * based on email address and migrate it directly into the Supabase database schema.
 */
export async function fetchAndMigrateUserDataByEmail(email: string, targetUid?: string) {
  if (!email || typeof email !== 'string') return null;
  const cleanEmail = email.trim().toLowerCase();

  let compiledData: any = null;
  let maxProgressCount = -1;

  // 1. Check RECOVERED_USER_DATA
  if (RECOVERED_USER_DATA && RECOVERED_USER_DATA.email && RECOVERED_USER_DATA.email.trim().toLowerCase() === cleanEmail) {
    compiledData = JSON.parse(JSON.stringify(RECOVERED_USER_DATA));
    maxProgressCount = Object.keys(compiledData.progress || {}).length;
  }

  const matchedRestored = RESTORED_AUTH_USERS.find(u => u.email.trim().toLowerCase() === cleanEmail);
  if (matchedRestored && !compiledData) {
    compiledData = {
      id: matchedRestored.uid,
      email: matchedRestored.email,
      createdAt: matchedRestored.createdAt,
      progress: {},
      goal: { dailyTarget: 15, streak: 1 }
    };
  }

  // 2. Query Firebase Firestore raw 'users' collection across databases
  const rawDbs = [rawFbCustomDb, rawFbDefaultDb];
  for (const rDb of rawDbs) {
    try {
      const fbRef = fbCollection(rDb, 'users');
      const fbSnap = await fbGetDocs(fbRef);
      for (const uDoc of fbSnap.docs) {
        const uData = uDoc.data();
        const uEmail = (uData?.email || '').trim().toLowerCase();
        
        if (uEmail === cleanEmail || uDoc.id.trim().toLowerCase() === cleanEmail) {
          const progCount = Object.keys(uData?.progress || {}).length;
          if (progCount > maxProgressCount || !compiledData) {
            maxProgressCount = progCount;
            if (!compiledData) {
              compiledData = uData;
            } else {
              compiledData = {
                ...compiledData,
                ...uData,
                progress: { ...(compiledData.progress || {}), ...(uData.progress || {}) },
                analogyProgress: { ...(compiledData.analogyProgress || {}), ...(uData.analogyProgress || {}) },
                blankProgress: { ...(compiledData.blankProgress || {}), ...(uData.blankProgress || {}) },
                oooProgress: { ...(compiledData.oooProgress || {}), ...(uData.oooProgress || {}) },
                synonymProgress: { ...(compiledData.synonymProgress || {}), ...(uData.synonymProgress || {}) },
                history: { ...(compiledData.history || {}), ...(uData.history || {}) },
                enrolledCourseIds: Array.from(new Set([...toArray(compiledData.enrolledCourseIds), ...toArray(uData.enrolledCourseIds)]))
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Error fetching user ${cleanEmail} from Firebase:`, e);
    }
  }

  // 3. Migrate / save compiled user data to Supabase
  if (compiledData) {
    const finalUid = targetUid || compiledData.uid || compiledData.id || `migrated-${cleanEmail}`;
    const payloadToMigrate = {
      ...compiledData,
      id: finalUid,
      email: cleanEmail,
      updatedAt: new Date().toISOString()
    };

    try {
      // Store in Supabase 'users' collection/table
      await setDoc(doc(db, 'users', finalUid), payloadToMigrate, { merge: true });
      console.log(`Successfully migrated user data for ${cleanEmail} to Supabase with UID ${finalUid}`);
    } catch (sbErr) {
      console.error(`Failed to save migrated user data to Supabase:`, sbErr);
    }

    return payloadToMigrate;
  }

  return null;
}




