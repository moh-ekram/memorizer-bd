import { supabase } from './supabase';
import { normalizeCourseId, matchesCourseId, clearQuestionsCache } from './courseUtils';

export { supabase, normalizeCourseId, matchesCourseId, clearQuestionsCache };

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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: pass
  });

  if (error) {
    throw error;
  }

  if (data.user) {
    currentMappedUser = mapSupabaseUser(data.user);
    return { user: currentMappedUser };
  }

  throw new Error('User not found');
}

export async function createUserWithEmailAndPassword(_auth: any, email: string, pass: string) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: pass
  });

  if (error) {
    if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
      return signInWithEmailAndPassword(_auth, cleanEmail, pass);
    }
    throw error;
  }

  if (data.user) {
    currentMappedUser = mapSupabaseUser(data.user);
    if (currentMappedUser) {
      await setDoc(doc(db, 'users', currentMappedUser.uid), {
        id: currentMappedUser.uid,
        email: cleanEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).catch(() => {});
    }
    return { user: currentMappedUser };
  }

  throw new Error('Failed to create user');
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

    // 1. Try server API
    try {
      const res = await fetch(`/api/db/${encodeURIComponent(collectionName)}/doc/${encodeURIComponent(docId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.exists && json.data) {
          return {
            exists: () => true,
            data: () => json.data,
            id: docId
          };
        }
      }
    } catch (_) {}

    // 2. Try Supabase
    try {
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
    } catch (_) {}

    // 3. Check LocalStorage cache fallback if doc was not found
    try {
      const cached = localStorage.getItem(`local_store_${collectionName}_${docId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          exists: () => true,
          data: () => ({ ...parsed, id: docId }),
          id: docId
        };
      }
    } catch (_) {}

    return { exists: () => false, data: () => null, id: docId };
  } catch (err) {
    return { exists: () => false, data: () => null, id: docRef?.docId || '' };
  }
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  try {
    const { collectionName, docId } = docRef;
    
    let dataToSave = data;
    if (options?.merge) {
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        dataToSave = { ...existing.data(), ...data };
      }
    }

    // LocalStorage cache for instant local performance
    try {
      localStorage.setItem(`local_store_${collectionName}_${docId}`, JSON.stringify(dataToSave));
    } catch (_) {}

    // Send to Server API for multi-user cloud persistence
    try {
      await fetch(`/api/db/${encodeURIComponent(collectionName)}/doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, data: dataToSave, merge: options?.merge })
      });
    } catch (e) {
      console.warn(`setDoc API warning for ${collectionName}:`, e);
    }

    // Supabase upsert
    const payload = { id: docId, ...dataToSave, data: dataToSave };
    try {
      await supabase.from(collectionName).upsert(payload);
    } catch (_) {}
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

    try {
      localStorage.removeItem(`local_store_${collectionName}_${docId}`);
    } catch (_) {}

    try {
      await fetch(`/api/db/${encodeURIComponent(collectionName)}/doc/${encodeURIComponent(docId)}`, {
        method: 'DELETE'
      });
    } catch (_) {}

    try {
      await supabase.from(collectionName).delete().eq('id', docId);
    } catch (_) {}
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
  try {
    const processedItems = items.map((item, index) => {
      const docId = item.id || `${collectionName}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        ...item,
        id: docId
      };
    });

    for (const item of processedItems) {
      try {
        localStorage.setItem(`local_store_${collectionName}_${item.id}`, JSON.stringify(item));
      } catch (_) {}
    }

    // Send to Server API for multi-user cloud persistence
    try {
      await fetch(`/api/db/${encodeURIComponent(collectionName)}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: processedItems })
      });
    } catch (e) {
      console.warn(`saveBulkDocs API warning for ${collectionName}:`, e);
    }

    const payloads = processedItems.map(item => ({
      id: item.id,
      ...item,
      data: item
    }));

    const CHUNK_SIZE = 100;
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
      const chunk = payloads.slice(i, i + CHUNK_SIZE);
      try {
        await supabase.from(collectionName).upsert(chunk);
      } catch (_) {}
    }
  } catch (err) {
    console.error(`saveBulkDocs exception for ${collectionName}:`, err);
  }
}

export async function deleteBulkDocs(collectionName: string, docIds: string[]) {
  if (!docIds || docIds.length === 0) return;
  try {
    for (const id of docIds) {
      try {
        localStorage.removeItem(`local_store_${collectionName}_${id}`);
      } catch (_) {}
    }

    try {
      await fetch(`/api/db/${encodeURIComponent(collectionName)}/delete-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docIds })
      });
    } catch (_) {}

    const CHUNK_SIZE = 200;
    for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
      const chunk = docIds.slice(i, i + CHUNK_SIZE);
      try {
        await supabase.from(collectionName).delete().in('id', chunk);
      } catch (_) {}
    }
  } catch (err) {
    console.error(`deleteBulkDocs exception for ${collectionName}:`, err);
  }
}

export async function clearCollectionDocs(collectionName: string, courseId?: string) {
  try {
    // 1. Clear LocalStorage matching collectionName
    const prefix = `local_store_${collectionName}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(prefix) || key.includes(collectionName))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // 2. Call server API clear
    try {
      await fetch(`/api/db/${encodeURIComponent(collectionName)}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId })
      });
    } catch (_) {}

    // 3. Clear directly in Supabase
    try {
      if (courseId) {
        await supabase.from(collectionName).delete().eq('courseId', courseId);
      } else {
        await supabase.from(collectionName).delete().neq('id', '___NON_EXISTENT_ID___');
      }
    } catch (_) {}
  } catch (err) {
    console.error(`clearCollectionDocs error for ${collectionName}:`, err);
  }
}

export async function getDocs(queryOrCollectionRef: any) {
  try {
    const collectionName = queryOrCollectionRef.collectionName;
    const isQuestionCollection = [
      'odd_one_out_questions',
      'blank_questions',
      'word_analogy_questions',
      'mcq_questions'
    ].includes(collectionName);

    const docsMap = new Map<string, any>();
    let dbSuccess = false;

    // 1. Fetch from Server API
    try {
      const res = await fetch(`/api/db/${encodeURIComponent(collectionName)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.docs)) {
          if (json.docs.length > 0) dbSuccess = true;
          json.docs.forEach((docData: any) => {
            if (docData && docData.id) {
              docsMap.set(String(docData.id), docData);
            }
          });
        }
      }
    } catch (e) {
      console.warn(`API getDocs error for ${collectionName}:`, e);
    }

    // 2. Query Supabase directly
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
          } else if (c.type === 'limit') {
            builder = builder.limit(c.value);
          }
        }
      }

      const { data, error } = await builder;

      if (!error && data && data.length > 0) {
        dbSuccess = true;
        data.forEach((row: any) => {
          const rowData = row.data && typeof row.data === 'object'
            ? { ...row, ...row.data, id: row.id || row.data?.id }
            : row;
          const docId = row.id || rowData.id;
          if (docId) {
            docsMap.set(String(docId), rowData);
          }
        });
      } else if (queryOrCollectionRef.constraints && queryOrCollectionRef.constraints.length > 0) {
        const { data: allRows } = await supabase.from(collectionName).select('*');
        if (allRows) {
          if (allRows.length > 0) dbSuccess = true;
          allRows.forEach((row: any) => {
            const rowData = row.data && typeof row.data === 'object'
              ? { ...row, ...row.data, id: row.id || row.data?.id }
              : row;
            const docId = row.id || rowData.id;

            let matchesAll = true;
            for (const c of queryOrCollectionRef.constraints) {
              if (c.type === 'where' && c.opStr === '==') {
                const rowVal = rowData[c.field] !== undefined ? rowData[c.field] : row[c.field];
                if (typeof c.value === 'string') {
                  if (String(rowVal || '').toLowerCase().trim() !== String(c.value).toLowerCase().trim()) {
                    matchesAll = false;
                    break;
                  }
                } else if (rowVal !== c.value) {
                  matchesAll = false;
                  break;
                }
              }
            }

            if (matchesAll && docId) {
              docsMap.set(String(docId), rowData);
            }
          });
        }
      }
    } catch (sbErr) {
      console.warn(`Supabase getDocs error for ${collectionName}:`, sbErr);
    }

    // 3. Fallback to LocalStorage ONLY if NOT a question collection or if DB query was completely empty/offline
    if (!isQuestionCollection || docsMap.size === 0) {
      const unsyncedItems: any[] = [];
      try {
        const prefix = `local_store_${collectionName}_`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const docId = key.replace(prefix, '');
            const rawVal = localStorage.getItem(key);
            if (rawVal) {
              try {
                const parsed = JSON.parse(rawVal);
                const itemObj = { id: docId, ...parsed };
                if (!docsMap.has(docId)) {
                  docsMap.set(docId, itemObj);
                }
                unsyncedItems.push(itemObj);
              } catch (_) {}
            }
          }
        }
      } catch (_) {}

      // Auto-sync any unsynced local items to server background
      if (unsyncedItems.length > 0) {
        fetch(`/api/db/${encodeURIComponent(collectionName)}/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: unsyncedItems })
        }).catch(() => {});
      }
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
    getDoc(_ref)
      .then(snap => callback(snap))
      .catch(err => {
        if (onError) onError(err);
        callback({ exists: () => false, data: () => null });
      });

    const collectionName = _ref.collectionName || 'users';
    let channel: any;
    try {
      channel = supabase.channel(`public:${collectionName}:${_ref.docId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: collectionName }, () => {
          getDoc(_ref).then(snap => callback(snap)).catch(err => { if (onError) onError(err); });
        })
        .subscribe();
    } catch (_) {}

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  } else {
    getDocs(_ref)
      .then(snap => callback(snap))
      .catch(err => {
        if (onError) onError(err);
        callback({ docs: [], empty: true, size: 0, forEach: () => {}, exists: () => false });
      });
    
    const collectionName = _ref?.collectionName || 'users';
    let channel: any;
    try {
      channel = supabase.channel(`public:${collectionName}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: collectionName }, () => {
          getDocs(_ref).then(snap => callback(snap)).catch(err => { if (onError) onError(err); });
        })
        .subscribe();
    } catch (_) {}

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }
}
