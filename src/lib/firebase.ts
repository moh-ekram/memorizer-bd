import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection as fbCollection, 
  getDocs as fbGetDocs, 
  doc as fbDoc, 
  getDoc as fbGetDoc 
} from 'firebase/firestore';
import { supabase } from './supabase';
import { RECOVERED_USER_DATA } from './importedUserData';

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
const rawFbDb = getFirestore(fbApp, firebaseDatabaseId);

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
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass
  });
  if (error) throw error;
  currentMappedUser = mapSupabaseUser(data.user);
  return { user: currentMappedUser };
}

export async function createUserWithEmailAndPassword(_auth: any, email: string, pass: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass
  });
  if (error) throw error;
  currentMappedUser = mapSupabaseUser(data.user);
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

export async function getDoc(docRef: any) {
  try {
    const { collectionName, docId } = docRef;
    const { data, error } = await supabase
      .from(collectionName)
      .select('*')
      .eq('id', docId)
      .maybeSingle();

    if (!error && data) {
      const docData = data.data ? { id: data.id, ...data.data } : data;
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

    return { exists: () => false, data: () => null };
  } catch (err) {
    return { exists: () => false, data: () => null };
  }
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  try {
    const { collectionName, docId } = docRef;
    
    if (options?.merge) {
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        const merged = { ...existing.data(), ...data };
        const { error } = await supabase
          .from(collectionName)
          .upsert({ id: docId, ...merged });
        if (error) {
          await supabase.from(collectionName).upsert({ id: docId, data: merged });
        }
        return;
      }
    }

    const { error } = await supabase
      .from(collectionName)
      .upsert({ id: docId, ...data });

    if (error) {
      await supabase.from(collectionName).upsert({ id: docId, data });
    }
  } catch (err) {
    console.warn('setDoc exception:', err);
  }
}

export async function updateDoc(docRef: any, data: any) {
  return setDoc(docRef, data, { merge: true });
}

export async function deleteDoc(docRef: any) {
  try {
    const { collectionName, docId } = docRef;
    await supabase.from(collectionName).delete().eq('id', docId);
  } catch (err) {
    console.warn('deleteDoc exception:', err);
  }
}

export async function getDocs(queryOrCollectionRef: any) {
  try {
    const collectionName = queryOrCollectionRef.collectionName;
    const docsMap = new Map<string, any>();

    // 1. Fetch from Supabase
    try {
      let builder = supabase.from(collectionName).select('*');

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
          const rowData = row.data ? { id: row.id, ...row.data } : row;
          const docId = row.id || rowData.id;
          if (docId) {
            docsMap.set(String(docId), rowData);
          }
        });
      }
    } catch (sbErr) {
      console.warn(`Supabase getDocs error for ${collectionName}:`, sbErr);
    }

    // 2. Fetch from Firebase Firestore to catch any missing docs or empty fields
    try {
      const fbRef = fbCollection(rawFbDb, collectionName);
      const fbSnap = await fbGetDocs(fbRef);
      if (!fbSnap.empty) {
        fbSnap.docs.forEach(docSnap => {
          const docId = docSnap.id;
          const dData = docSnap.data();
          const existingInSB = docsMap.get(docId);
          if (!existingInSB) {
            const merged = { id: docId, ...dData };
            docsMap.set(docId, merged);
            // Sync to Supabase in background
            setDoc({ collectionName, docId }, dData).catch(() => {});
          } else if (collectionName === 'courses' && dData?.words && Array.isArray(dData.words) && dData.words.length > 0 && (!existingInSB.words || existingInSB.words.length === 0)) {
            const merged = { ...existingInSB, ...dData, words: dData.words };
            docsMap.set(docId, merged);
            setDoc({ collectionName, docId }, merged).catch(() => {});
          }
        });
      }
    } catch (fbErr) {
      console.warn(`Firebase getDocs fallback error for ${collectionName}:`, fbErr);
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
      forEach: (callback: (doc: any) => void) => docs.forEach(callback)
    };
  } catch (err) {
    return { docs: [], empty: true, size: 0, forEach: () => {} };
  }
}

export function onSnapshot(_ref: any, callback: (snap: any) => void) {
  getDocs(_ref).then(snap => callback(snap));
  
  const collectionName = _ref.collectionName || 'users';
  const channel = supabase.channel(`public:${collectionName}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: collectionName }, () => {
      getDocs(_ref).then(snap => callback(snap));
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
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
          enrolledCourseIds: Array.from(new Set([...(bestData.enrolledCourseIds || []), ...(curData.enrolledCourseIds || [])]))
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
            enrolledCourseIds: Array.from(new Set([...(bestData.enrolledCourseIds || []), ...(uData.enrolledCourseIds || [])]))
          };
        }
      }
    }
  } catch (e) {
    console.warn('Search Supabase users by email error:', e);
  }

  // 3. Search Firebase Firestore raw 'users' collection directly by email or doc id
  try {
    const fbRef = fbCollection(rawFbDb, 'users');
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
            enrolledCourseIds: Array.from(new Set([...(bestData.enrolledCourseIds || []), ...(uData.enrolledCourseIds || [])]))
          };
        }
      }
    }
  } catch (e) {
    console.warn('Search raw Firebase users by email error:', e);
  }

  // 4. Save merged data to both Supabase and raw Firebase Firestore
  if (bestData) {
    const dataToSave = {
      ...bestData,
      email: currentUser.email,
      updatedAt: new Date().toISOString()
    };
    await setDoc(currentDocRef, dataToSave, { merge: true });
    
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



