import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection as fbCollection, 
  getDocs as fbGetDocs, 
  doc as fbDoc, 
  getDoc as fbGetDoc 
} from 'firebase/firestore';
import { supabase } from './supabase';

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
const rawFbDb = getFirestore(fbApp);

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

    let docs: any[] = [];
    if (!error && data && data.length > 0) {
      docs = data.map((row: any) => {
        const rowData = row.data ? { id: row.id, ...row.data } : row;
        return {
          id: row.id || rowData.id,
          data: () => rowData,
          exists: () => true
        };
      });
    }

    // Fallback to Firebase Firestore if Supabase returned 0 docs or errored
    if (docs.length === 0) {
      try {
        const fbRef = fbCollection(rawFbDb, collectionName);
        const fbSnap = await fbGetDocs(fbRef);
        if (!fbSnap.empty) {
          docs = fbSnap.docs.map(docSnap => {
            const dData = docSnap.data();
            const docObj = { id: docSnap.id, ...dData };
            // Sync to Supabase in background
            setDoc({ collectionName, docId: docSnap.id }, dData).catch(() => {});
            return {
              id: docSnap.id,
              data: () => docObj,
              exists: () => true
            };
          });
        }
      } catch (fbErr) {
        console.warn('Firebase getDocs fallback error:', fbErr);
      }
    }

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length
    };
  } catch (err) {
    return { docs: [], empty: true, size: 0 };
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
    'odd_questions'
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


