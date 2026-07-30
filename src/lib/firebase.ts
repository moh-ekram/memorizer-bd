import { supabase } from './supabase';

export { supabase };

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

    if (error) {
      return { exists: () => false, data: () => null };
    }

    if (!data) {
      return { exists: () => false, data: () => null };
    }

    const docData = data.data ? { id: data.id, ...data.data } : data;
    return {
      exists: () => true,
      data: () => docData,
      id: docId
    };
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

    if (error) {
      return { docs: [], empty: true, size: 0 };
    }

    const docs = (data || []).map((row: any) => {
      const rowData = row.data ? { id: row.id, ...row.data } : row;
      return {
        id: row.id || rowData.id,
        data: () => rowData,
        exists: () => true
      };
    });

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

