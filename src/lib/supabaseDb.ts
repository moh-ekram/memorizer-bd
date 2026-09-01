import { supabase } from './supabase';
import { safeSetLocalStorage, safeGetLocalStorage } from './storage';

export interface DocRef {
  _isDocRef: true;
  collection: string;
  id: string;
}

export interface CollectionRef {
  _isCollectionRef: true;
  collection: string;
}

export interface QueryFilter {
  field: string;
  op: string;
  value: any;
}

export interface QueryRef {
  _isQueryRef: true;
  collection: string;
  filters: QueryFilter[];
  limitCount?: number;
}

export function doc(dbOrCol: any, ...pathSegments: string[]): DocRef {
  let collectionName = '';
  let docId = '';

  if (typeof dbOrCol === 'string') {
    collectionName = dbOrCol;
    docId = pathSegments[0] || '';
  } else if (dbOrCol?._isCollectionRef) {
    collectionName = dbOrCol.collection;
    docId = pathSegments[0] || '';
  } else {
    collectionName = pathSegments[0] || '';
    docId = pathSegments[1] || '';
  }

  return {
    _isDocRef: true,
    collection: collectionName,
    id: docId
  };
}

export function collection(dbObj: any, collectionName: string): CollectionRef {
  return {
    _isCollectionRef: true,
    collection: typeof dbObj === 'string' ? dbObj : collectionName
  };
}

export function where(field: string, op: string, value: any): QueryFilter {
  return { field, op, value };
}

export function limit(count: number) {
  return { _isLimit: true, count };
}

export function query(colRef: CollectionRef | any, ...queryConstraints: any[]): QueryRef {
  const collectionName = colRef.collection || colRef;
  const filters: QueryFilter[] = [];
  let limitCount: number | undefined = undefined;

  for (const c of queryConstraints) {
    if (c?._isLimit) {
      limitCount = c.count;
    } else if (c?.field) {
      filters.push(c);
    }
  }

  return {
    _isQueryRef: true,
    collection: collectionName,
    filters,
    limitCount
  };
}

// ----------------------------------------------------
// Data Translators between Firestore CamelCase and Supabase Postgres Schema
// ----------------------------------------------------

export function mapUserToDb(data: any): any {
  const row: any = {};
  if (data.id) row.id = data.id;
  if (data.email !== undefined) row.email = data.email;
  if (data.displayName !== undefined || data.name !== undefined) {
    row.display_name = data.displayName || data.name || '';
  }
  if (data.role !== undefined) row.role = data.role;
  if (data.isApproved !== undefined) row.is_approved = data.isApproved;
  if (data.status !== undefined) row.status = data.status;
  if (data.progress !== undefined) row.progress = data.progress;
  if (data.flashcardPositions !== undefined) row.flashcard_positions = data.flashcardPositions;
  if (data.folders !== undefined) row.folders = data.folders;
  if (data.goal !== undefined) row.goal = data.goal;
  if (data.settings !== undefined) row.settings = data.settings;
  if (data.synonymProgress !== undefined) row.synonym_progress = data.synonymProgress;
  if (data.blankProgress !== undefined) row.blank_progress = data.blankProgress;
  if (data.oooProgress !== undefined) row.ooo_progress = data.oooProgress;
  if (data.analogyProgress !== undefined) row.analogy_progress = data.analogyProgress;
  if (data.enrolledCourseIds !== undefined) row.enrolled_course_ids = data.enrolledCourseIds;
  if (data.activeCourseId !== undefined) row.active_course_id = data.activeCourseId;
  if (data.quizScore !== undefined) row.quiz_score = data.quizScore;
  if (data.quizTaken !== undefined) row.quiz_taken = data.quizTaken;
  if (data.balance !== undefined || data.walletBalance !== undefined) {
    row.balance = data.balance ?? data.walletBalance ?? 0;
  }
  row.updated_at = new Date().toISOString();
  return row;
}

export function mapUserFromDb(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || '',
    name: row.display_name || '',
    role: row.role || 'student',
    isApproved: row.is_approved ?? true,
    status: row.status || 'active',
    progress: row.progress || {},
    flashcardPositions: row.flashcard_positions || {},
    folders: row.folders || [],
    goal: row.goal || { dailyTarget: 15, streak: 1 },
    settings: row.settings || {},
    synonymProgress: row.synonym_progress || {},
    blankProgress: row.blank_progress || {},
    oooProgress: row.ooo_progress || {},
    analogyProgress: row.analogy_progress || {},
    enrolledCourseIds: row.enrolled_course_ids || ['bank-bcs-gre'],
    activeCourseId: row.active_course_id || 'bank-bcs-gre',
    quizScore: row.quiz_score || 0,
    quizTaken: row.quiz_taken || 0,
    balance: typeof row.balance === 'number' ? row.balance : Number(row.balance || 0),
    walletBalance: typeof row.balance === 'number' ? row.balance : Number(row.balance || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapCourseToDb(data: any): any {
  const row: any = {};
  if (data.id) row.id = data.id;
  if (data.title !== undefined) row.title = data.title;
  if (data.description !== undefined) row.description = data.description;
  if (data.category !== undefined) row.category = data.category;
  if (data.level !== undefined) row.level = data.level;
  if (data.price !== undefined) row.price = data.price;
  if (data.isFree !== undefined) row.is_free = data.isFree;
  if (data.isPublished !== undefined) row.is_published = data.isPublished;
  if (data.thumbnailUrl !== undefined) row.thumbnail_url = data.thumbnailUrl;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  if (data.words !== undefined) row.words = data.words;
  if (data.stories !== undefined) row.stories = data.stories;
  if (data.articles !== undefined) row.articles = data.articles;
  if (data.metadata !== undefined) row.metadata = data.metadata;
  row.updated_at = new Date().toISOString();
  return row;
}

export function mapCourseFromDb(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    category: row.category || 'General',
    level: row.level || 'All Levels',
    price: typeof row.price === 'number' ? row.price : Number(row.price || 0),
    isFree: row.is_free ?? false,
    isPublished: row.is_published ?? true,
    thumbnailUrl: row.thumbnail_url || '',
    createdBy: row.created_by || '',
    words: row.words || [],
    stories: row.stories || [],
    articles: row.articles || [],
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapAccessRequestToDb(data: any): any {
  const row: any = {};
  if (data.id) row.id = data.id;
  if (data.userId || data.user_id) row.user_id = data.userId || data.user_id;
  if (data.userEmail || data.user_email) row.user_email = data.userEmail || data.user_email;
  if (data.courseId || data.course_id) row.course_id = data.courseId || data.course_id;
  if (data.courseIds || data.course_ids) row.course_ids = data.courseIds || data.course_ids;
  if (data.bkashNumber || data.bkash_number) row.bkash_number = data.bkashNumber || data.bkash_number;
  if (data.transactionId || data.transaction_id) row.transaction_id = data.transactionId || data.transaction_id;
  if (data.amount !== undefined) row.amount = data.amount;
  if (data.status !== undefined) row.status = data.status;
  if (data.expiresAt || data.expires_at) row.expires_at = data.expiresAt || data.expires_at;
  return row;
}

export function mapAccessRequestFromDb(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    courseId: row.course_id,
    courseIds: row.course_ids || (row.course_id ? [row.course_id] : []),
    bkashNumber: row.bkash_number,
    transactionId: row.transaction_id,
    amount: typeof row.amount === 'number' ? row.amount : Number(row.amount || 0),
    status: row.status || 'pending',
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

// ----------------------------------------------------
// Core Database CRUD Operations on Supabase
// ----------------------------------------------------

export async function getDoc(docRef: DocRef | any) {
  const col = docRef?.collection || docRef?.path?.split('/')[0];
  const id = docRef?.id || docRef?.path?.split('/')[1];

  if (!col || !id) {
    return {
      id: id || '',
      exists: () => false,
      data: () => null
    };
  }

  // 1. system_settings
  if (col === 'system_settings' || col === 'settings') {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('key', id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const val = data.value || {};
        return {
          id,
          exists: () => true,
          data: () => val
        };
      }
    } catch (e) {
      console.warn(`Supabase getDoc notice for ${col}/${id}:`, e);
    }
  }

  // 2. users
  if (col === 'users') {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const mapped = mapUserFromDb(data);
        return {
          id,
          exists: () => true,
          data: () => mapped
        };
      }
    } catch (e) {
      console.warn(`Supabase user getDoc notice:`, e);
    }
  }

  // 3. courses
  if (col === 'courses') {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const mapped = mapCourseFromDb(data);
        return {
          id,
          exists: () => true,
          data: () => mapped
        };
      }
    } catch (e) {
      console.warn(`Supabase course getDoc notice:`, e);
    }
  }

  // 4. access_requests
  if (col === 'access_requests') {
    try {
      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const mapped = mapAccessRequestFromDb(data);
        return {
          id,
          exists: () => true,
          data: () => mapped
        };
      }
    } catch (e) {
      console.warn(`Supabase access_request getDoc notice:`, e);
    }
  }

  // Generic fallback table query
  try {
    const { data, error } = await supabase
      .from(col)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      const resultData = data.data || data;
      return {
        id,
        exists: () => true,
        data: () => resultData
      };
    }
  } catch (e) {
    console.warn(`Supabase generic getDoc notice for ${col}/${id}:`, e);
  }

  return {
    id,
    exists: () => false,
    data: () => null
  };
}

export async function getDocs(queryOrColRef: CollectionRef | QueryRef | any) {
  const col = queryOrColRef?.collection || 'courses';
  const filters: QueryFilter[] = queryOrColRef?.filters || [];
  const limitCount: number | undefined = queryOrColRef?.limitCount;

  try {
    let queryBuilder = supabase.from(col).select('*');

    // Apply filters
    for (const f of filters) {
      let dbField = f.field;
      if (col === 'access_requests') {
        if (f.field === 'userId') dbField = 'user_id';
        if (f.field === 'userEmail') dbField = 'user_email';
        if (f.field === 'courseId') dbField = 'course_id';
      }
      if (f.op === '==' || f.op === '=') {
        queryBuilder = queryBuilder.eq(dbField, f.value);
      } else if (f.op === '>') {
        queryBuilder = queryBuilder.gt(dbField, f.value);
      } else if (f.op === '>=') {
        queryBuilder = queryBuilder.gte(dbField, f.value);
      } else if (f.op === '<') {
        queryBuilder = queryBuilder.lt(dbField, f.value);
      } else if (f.op === '<=') {
        queryBuilder = queryBuilder.lte(dbField, f.value);
      } else if (f.op === 'in') {
        queryBuilder = queryBuilder.in(dbField, f.value);
      }
    }

    if (limitCount && limitCount > 0) {
      queryBuilder = queryBuilder.limit(limitCount);
    }

    const { data, error } = await queryBuilder;
    if (error) throw error;

    const rows = data || [];
    const docs = rows.map((r: any) => {
      let mappedData = r;
      if (col === 'users') mappedData = mapUserFromDb(r);
      else if (col === 'courses') mappedData = mapCourseFromDb(r);
      else if (col === 'access_requests') mappedData = mapAccessRequestFromDb(r);
      else if (r.data) mappedData = { ...r.data, id: r.id };

      return {
        id: r.id || r.key,
        exists: () => true,
        data: () => mappedData
      };
    });

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: (cb: (doc: any) => void) => docs.forEach(cb)
    };
  } catch (err) {
    console.warn(`Supabase getDocs notice for ${col}:`, err);
    return {
      docs: [],
      empty: true,
      size: 0,
      forEach: () => {}
    };
  }
}

export async function setDoc(docRef: DocRef | any, data: any, options?: { merge?: boolean }) {
  const col = docRef?.collection || docRef?.path?.split('/')[0];
  const id = docRef?.id || docRef?.path?.split('/')[1];

  if (!col || !id) return;

  try {
    // 1. system_settings
    if (col === 'system_settings' || col === 'settings') {
      await supabase.from('system_settings').upsert({
        key: id,
        value: data,
        updated_at: new Date().toISOString()
      });
      return;
    }

    // 2. users
    if (col === 'users') {
      const userPayload = mapUserToDb({ ...data, id });
      await supabase.from('users').upsert(userPayload);
      return;
    }

    // 3. courses
    if (col === 'courses') {
      const coursePayload = mapCourseToDb({ ...data, id });
      await supabase.from('courses').upsert(coursePayload);
      return;
    }

    // 4. access_requests
    if (col === 'access_requests') {
      const reqPayload = mapAccessRequestToDb({ ...data, id });
      await supabase.from('access_requests').upsert(reqPayload);
      return;
    }

    // 5. Question Banks & Generic Collections
    const genericPayload: any = {
      id,
      data: data,
      updated_at: new Date().toISOString()
    };
    if (data.courseId || data.course_id) {
      genericPayload.course_id = data.courseId || data.course_id;
    }

    await supabase.from(col).upsert(genericPayload);
  } catch (err) {
    console.error(`Supabase setDoc error for ${col}/${id}:`, err);
    throw err;
  }
}

export async function updateDoc(docRef: DocRef | any, data: any) {
  return setDoc(docRef, data, { merge: true });
}

export async function deleteDoc(docRef: DocRef | any) {
  const col = docRef?.collection || docRef?.path?.split('/')[0];
  const id = docRef?.id || docRef?.path?.split('/')[1];

  if (!col || !id) return;

  try {
    if (col === 'system_settings' || col === 'settings') {
      await supabase.from('system_settings').delete().eq('key', id);
      return;
    }
    await supabase.from(col).delete().eq('id', id);
  } catch (err) {
    console.error(`Supabase deleteDoc error for ${col}/${id}:`, err);
    throw err;
  }
}

export function onSnapshot(
  refOrQuery: any,
  callback: (snap: any) => void,
  onError?: (error: any) => void
) {
  let isSubscribed = true;

  // 1. Fetch initial snapshot immediately
  if (refOrQuery?._isDocRef) {
    getDoc(refOrQuery).then(snap => {
      if (isSubscribed) callback(snap);
    }).catch(err => {
      if (isSubscribed && onError) onError(err);
    });
  } else {
    getDocs(refOrQuery).then(snap => {
      if (isSubscribed) callback(snap);
    }).catch(err => {
      if (isSubscribed && onError) onError(err);
    });
  }

  // 2. Setup periodic revalidation (every 4 seconds for active views)
  const intervalId = setInterval(() => {
    if (!isSubscribed) return;
    if (refOrQuery?._isDocRef) {
      getDoc(refOrQuery).then(snap => {
        if (isSubscribed) callback(snap);
      }).catch(() => {});
    } else {
      getDocs(refOrQuery).then(snap => {
        if (isSubscribed) callback(snap);
      }).catch(() => {});
    }
  }, 4000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
  };
}

export async function incrementCourseClickCount(courseId: string) {
  if (!courseId) return;
  try {
    const snap = await getDoc(doc('courses', courseId));
    if (snap.exists()) {
      const cData = snap.data() as any;
      const metadata = cData.metadata || {};
      metadata.clickCount = (metadata.clickCount || 0) + 1;
      await updateDoc(doc('courses', courseId), { metadata });
    }
  } catch (err) {
    console.warn('incrementCourseClickCount error:', err);
  }
}

export async function saveBulkDocs(
  collectionName: string,
  items: any[],
  onProgress?: (current: number, total: number) => void
) {
  if (!items || items.length === 0) return;
  try {
    const BATCH_SIZE = 100;
    const totalItems = items.length;
    let savedCount = 0;

    for (let i = 0; i < totalItems; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const rows = chunk.map((item, idx) => {
        const id = item.id || `${collectionName}_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
        if (collectionName === 'users') return mapUserToDb({ ...item, id });
        if (collectionName === 'courses') return mapCourseToDb({ ...item, id });
        if (collectionName === 'access_requests') return mapAccessRequestToDb({ ...item, id });
        return {
          id,
          course_id: item.courseId || item.course_id || null,
          data: item,
          updated_at: new Date().toISOString()
        };
      });

      const { error } = await supabase.from(collectionName).upsert(rows);
      if (error) {
        console.warn(`saveBulkDocs chunk upsert notice for ${collectionName}:`, error);
      }

      savedCount += chunk.length;
      if (onProgress) {
        onProgress(savedCount, totalItems);
      }
    }
  } catch (err) {
    console.error(`saveBulkDocs error for ${collectionName}:`, err);
    throw err;
  }
}

export async function deleteBulkDocs(collectionName: string, docIds: string[]) {
  if (!docIds || docIds.length === 0) return;
  try {
    const BATCH_SIZE = 200;
    for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
      const chunk = docIds.slice(i, i + BATCH_SIZE);
      await supabase.from(collectionName).delete().in('id', chunk);
    }
  } catch (err) {
    console.error(`deleteBulkDocs error for ${collectionName}:`, err);
    throw err;
  }
}

export async function clearCollectionDocs(collectionName: string, courseId?: string) {
  try {
    if (courseId) {
      await supabase.from(collectionName).delete().eq('course_id', courseId);
    } else {
      await supabase.from(collectionName).delete().neq('id', '___non_existent_id___');
    }
  } catch (err) {
    console.error(`clearCollectionDocs error for ${collectionName}:`, err);
    throw err;
  }
}

export function writeBatch(_dbObj?: any) {
  const operations: Array<() => Promise<void>> = [];
  return {
    set: (docRef: DocRef, data: any, _options?: any) => {
      operations.push(() => setDoc(docRef, data));
    },
    update: (docRef: DocRef, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: DocRef) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    }
  };
}

export async function runTransaction(_dbObj: any, updateFunction: (transaction: any) => Promise<any>) {
  const transaction = {
    get: async (docRef: DocRef) => getDoc(docRef),
    set: (docRef: DocRef, data: any) => setDoc(docRef, data),
    update: (docRef: DocRef, data: any) => updateDoc(docRef, data),
    delete: (docRef: DocRef) => deleteDoc(docRef)
  };
  return await updateFunction(transaction);
}
