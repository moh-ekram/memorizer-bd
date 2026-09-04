import { supabase, getSupabase } from './supabase';

/**
 * Supabase Database Translation Layer (Full Firestore Compatibility Interface)
 * Automatically translates Firestore-like queries, documents, collections, and snapshots
 * into Supabase PostgreSQL queries and JSON structures.
 */

export interface DocRef {
  _isDocRef: true;
  collection: string;
  id: string;
  path: string;
}

export interface CollectionRef {
  _isCollectionRef: true;
  collection: string;
  path: string;
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
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
}

export function collection(_db: any, collectionName: string): CollectionRef;
export function collection(collectionName: string): CollectionRef;
export function collection(...args: any[]): CollectionRef {
  const collectionName = typeof args[0] === 'string' ? args[0] : args[1];
  return {
    _isCollectionRef: true,
    collection: collectionName,
    path: collectionName
  };
}

export function doc(_db: any, collectionName: string, id: string, ...rest: string[]): DocRef;
export function doc(collectionName: string, id: string, ...rest: string[]): DocRef;
export function doc(...args: any[]): DocRef {
  let collectionName = '';
  let id = '';
  const stringArgs = args.filter(a => typeof a === 'string');
  if (stringArgs.length >= 2) {
    collectionName = stringArgs[0];
    id = stringArgs.slice(1).join('_');
  } else if (stringArgs.length === 1) {
    const parts = stringArgs[0].split('/');
    collectionName = parts[0];
    id = parts.slice(1).join('_');
  } else if (args[0] && typeof args[0] === 'object' && args[0]._isCollectionRef) {
    collectionName = args[0].collection || 'default';
    id = args.slice(1).join('_');
  }
  return {
    _isDocRef: true,
    collection: collectionName,
    id,
    path: `${collectionName}/${id}`
  };
}

export function query(collectionRef: CollectionRef | QueryRef, ...queryConstraints: any[]): QueryRef {
  const filters: QueryFilter[] = (collectionRef as any).filters ? [...(collectionRef as any).filters] : [];
  let limitCount = (collectionRef as any).limitCount;
  let orderByField = (collectionRef as any).orderByField;
  let orderDirection = (collectionRef as any).orderDirection;

  for (const constraint of queryConstraints) {
    if (constraint?._type === 'where') {
      filters.push({ field: constraint.field, op: constraint.op, value: constraint.value });
    } else if (constraint?._type === 'limit') {
      limitCount = constraint.limit;
    } else if (constraint?._type === 'orderBy') {
      orderByField = constraint.field;
      orderDirection = constraint.direction || 'asc';
    }
  }

  return {
    _isQueryRef: true,
    collection: collectionRef.collection,
    filters,
    limitCount,
    orderByField,
    orderDirection
  };
}

export function where(field: string, op: string, value: any) {
  return { _type: 'where', field, op, value };
}

export function limit(limitCount: number) {
  return { _type: 'limit', limit: limitCount };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { _type: 'orderBy', field, direction };
}

// ---------------- Helper Column Translation ----------------

function translateFieldForDb(col: string, field: string): string {
  if (col === 'access_requests') {
    if (field === 'email' || field === 'userEmail') return 'user_email';
    if (field === 'userId') return 'user_id';
    if (field === 'courseId') return 'course_id';
    if (field === 'courseIds') return 'course_ids';
    if (field === 'bkashNumber') return 'bkash_number';
    if (field === 'transactionId') return 'transaction_id';
    if (field === 'createdAt') return 'created_at';
    if (field === 'expiresAt') return 'expires_at';
  } else if (col === 'users') {
    if (field === 'displayName' || field === 'name') return 'display_name';
    if (field === 'isApproved') return 'is_approved';
    if (field === 'createdAt') return 'created_at';
    if (field === 'updatedAt') return 'updated_at';
    if (field === 'enrolledCourseIds' || field === 'enrolledCourses') return 'enrolled_course_ids';
    if (field === 'activeCourseId') return 'active_course_id';
    if (field === 'quizScore') return 'quiz_score';
    if (field === 'quizTaken') return 'quiz_taken';
    if (field === 'flashcardPositions') return 'flashcard_positions';
    if (field === 'synonymProgress') return 'synonym_progress';
    if (field === 'blankProgress') return 'blank_progress';
    if (field === 'oooProgress') return 'ooo_progress';
    if (field === 'analogyProgress') return 'analogy_progress';
  } else if (col === 'courses') {
    if (field === 'isFree') return 'is_free';
    if (field === 'isPublished') return 'is_published';
    if (field === 'thumbnailUrl') return 'thumbnail_url';
    if (field === 'createdBy') return 'created_by';
    if (field === 'createdAt') return 'created_at';
    if (field === 'updatedAt') return 'updated_at';
  }
  return field;
}

export function mapUserToDb(data: any): any {
  const row: any = {};
  if (data.id) row.id = data.id;
  if (data.email !== undefined) row.email = (data.email || '').trim().toLowerCase();
  if (data.displayName !== undefined || data.name !== undefined) {
    row.display_name = data.displayName || data.name || '';
  }
  if (data.role !== undefined) row.role = data.role;
  if (data.isApproved !== undefined) row.is_approved = !!data.isApproved;
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
  
  // Package extended course settings into metadata safely
  const meta = {
    ...(data.metadata || {}),
    enabledGames: data.enabledGames,
    placeLabels: data.placeLabels,
    totalGroups: data.totalGroups,
    bkashNumber: data.bkashNumber,
    isRestricted: data.isRestricted,
    allowedUsers: data.allowedUsers,
    allowedUsersExpiry: data.allowedUsersExpiry,
    googleSearchQuery: data.googleSearchQuery,
    order: data.order,
    hidden: data.hidden,
    courseCode: data.courseCode,
    isDefault: data.isDefault
  };
  row.metadata = meta;
  row.updated_at = new Date().toISOString();
  return row;
}

export function mapCourseFromDb(row: any): any {
  if (!row) return null;
  const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {};
  return {
    ...meta,
    id: row.id,
    title: row.title || meta.title || '',
    description: row.description || meta.description || '',
    category: row.category || meta.category || 'General',
    level: row.level || meta.level || 'All Levels',
    price: typeof row.price === 'number' ? row.price : (meta.price !== undefined ? meta.price : Number(row.price || 0)),
    isFree: row.is_free ?? meta.isFree ?? false,
    isPublished: row.is_published ?? meta.isPublished ?? true,
    thumbnailUrl: row.thumbnail_url || meta.thumbnailUrl || '',
    createdBy: row.created_by || meta.createdBy || '',
    words: (Array.isArray(row.words) && row.words.length > 0) ? row.words : (Array.isArray(meta.words) ? meta.words : []),
    stories: Array.isArray(row.stories) ? row.stories : (Array.isArray(meta.stories) ? meta.stories : []),
    articles: Array.isArray(row.articles) ? row.articles : (Array.isArray(meta.articles) ? meta.articles : []),
    enabledGames: meta.enabledGames || { quiz: true, match: true, synonym: true, blank: true, story: true, article: true },
    placeLabels: meta.placeLabels,
    totalGroups: meta.totalGroups || (Array.isArray(row.words) && row.words.length > 0 ? new Set(row.words.map((w: any) => w.group)).size : undefined),
    bkashNumber: row.bkash_number || meta.bkashNumber || '01581624202',
    isRestricted: row.is_restricted ?? meta.isRestricted ?? false,
    allowedUsers: Array.isArray(meta.allowedUsers) ? meta.allowedUsers : (row.allowed_users || []),
    allowedUsersExpiry: meta.allowedUsersExpiry || {},
    isDefault: meta.isDefault ?? (row.is_free ? true : false),
    order: row.order ?? meta.order ?? 999,
    hidden: row.hidden ?? meta.hidden ?? false,
    googleSearchQuery: meta.googleSearchQuery || '',
    metadata: meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapAccessRequestToDb(data: any): any {
  const row: any = {};
  if (data.id) row.id = data.id;
  if (data.userId !== undefined) row.user_id = data.userId;
  if (data.userEmail !== undefined || data.email !== undefined) {
    row.user_email = data.userEmail || data.email || '';
  }
  if (data.courseId !== undefined) row.course_id = data.courseId;
  if (data.courseIds !== undefined) row.course_ids = data.courseIds;
  if (data.bkashNumber !== undefined) row.bkash_number = data.bkashNumber;
  if (data.transactionId !== undefined) row.transaction_id = data.transactionId;
  if (data.amount !== undefined) row.amount = data.amount;
  if (data.status !== undefined) row.status = data.status;
  if (data.expiresAt !== undefined) row.expires_at = data.expiresAt;
  return row;
}

export function mapAccessRequestFromDb(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || '',
    userEmail: row.user_email || '',
    email: row.user_email || '',
    courseId: row.course_id || '',
    courseIds: row.course_ids || (row.course_id ? [row.course_id] : []),
    bkashNumber: row.bkash_number || '',
    transactionId: row.transaction_id || '',
    amount: typeof row.amount === 'number' ? row.amount : Number(row.amount || 0),
    status: row.status || 'pending',
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

// ---------------- Database CRUD Operations ----------------

export async function getDoc(docRef: DocRef | any): Promise<{ id: string; exists: () => boolean; data: () => any }> {
  const col = docRef?.collection || docRef?.path?.split('/')[0];
  const id = docRef?.id || docRef?.path?.split('/')[1];

  if (!col || !id) {
    return { id: id || '', exists: () => false, data: () => null };
  }

  const client = getSupabase();

  // 1. system_settings
  if (col === 'system_settings' || col === 'settings') {
    try {
      const { data, error } = await client
        .from('system_settings')
        .select('key, value')
        .eq('key', id)
        .maybeSingle();

      if (!error && data) {
        const val = data.value || {};
        return {
          id,
          exists: () => true,
          data: () => val
        };
      }
    } catch (e) {
      console.warn(`Supabase getDoc error for ${col}/${id}:`, e);
    }
  }

  // 2. users
  if (col === 'users') {
    // Check if subcollection like /meta/sync_state
    if (docRef?.path && docRef.path.includes('/meta/')) {
      try {
        const metaKey = `meta_${id}`;
        const { data: sData } = await client.from('system_settings').select('value').eq('key', metaKey).maybeSingle();
        return {
          id,
          exists: () => !!sData,
          data: () => sData?.value || null
        };
      } catch (_) {
        return { id, exists: () => false, data: () => null };
      }
    }

    try {
      let data: any = null;
      let error: any = null;

      if (id.includes('@')) {
        const cleanEmail = id.trim().toLowerCase();
        const res = await client.from('users').select('*').eq('email', cleanEmail).maybeSingle();
        data = res.data;
        error = res.error;
        if (!data) {
          const res2 = await client.from('users').select('*').eq('id', id.trim()).maybeSingle();
          data = res2.data;
        }
      } else {
        const res = await client.from('users').select('*').eq('id', id.trim()).maybeSingle();
        data = res.data;
        error = res.error;
        if (!data && id.length > 5) {
          const res2 = await client.from('users').select('*').eq('email', id.trim().toLowerCase()).maybeSingle();
          data = res2.data;
        }
      }

      if (!error && data) {
        const mapped = mapUserFromDb(data);
        return {
          id: data.id || id,
          exists: () => true,
          data: () => mapped
        };
      }
    } catch (e) {
      console.warn(`Supabase user getDoc error:`, e);
    }
  }

  // 3. courses
  if (col === 'courses') {
    try {
      const { data, error } = await client
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
      console.warn(`Supabase course getDoc error:`, e);
    }
  }

  // 4. access_requests
  if (col === 'access_requests') {
    try {
      const { data, error } = await client
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
      console.warn(`Supabase access_requests getDoc error:`, e);
    }
  }

  // 5. Generic collections (e.g. question banks, games, exams)
  try {
    const { data, error } = await client
      .from(col)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      const rowData = (data.data && typeof data.data === 'object') ? data.data : {};
      const qCourseId = rowData.courseId || rowData.course_id || data.course_id || data.courseId || '';
      const mapped = {
        ...data,
        ...rowData,
        id: data.id || rowData.id || id,
        courseId: qCourseId,
        course_id: qCourseId
      };
      return {
        id,
        exists: () => true,
        data: () => mapped
      };
    }
  } catch (e) {
    // Suppress generic table missing errors gracefully
  }

  return {
    id,
    exists: () => false,
    data: () => null
  };
}

export async function getDocs(queryRef: CollectionRef | QueryRef | any): Promise<{
  docs: Array<{ id: string; exists: () => boolean; data: () => any }>;
  empty: boolean;
  size: number;
  forEach: (cb: (doc: any) => void) => void;
}> {
  const col = queryRef?.collection || (typeof queryRef === 'string' ? queryRef : '');
  const filters: QueryFilter[] = queryRef?.filters || [];
  const limitCount = queryRef?.limitCount;
  const orderByField = queryRef?.orderByField;
  const orderDirection = queryRef?.orderDirection;

  if (!col) {
    return { docs: [], empty: true, size: 0, forEach: () => {} };
  }

  const client = getSupabase();

  try {
    let queryBuilder = client.from(col).select('*');

    // Apply translated filters
    for (const f of filters) {
      const dbField = translateFieldForDb(col, f.field);
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
        queryBuilder = queryBuilder.in(dbField, Array.isArray(f.value) ? f.value : [f.value]);
      }
    }

    if (orderByField) {
      const dbOrderField = translateFieldForDb(col, orderByField);
      queryBuilder = queryBuilder.order(dbOrderField, { ascending: orderDirection !== 'desc' });
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
      else if (col === 'system_settings') mappedData = r.value || r;
      else if (r && typeof r === 'object') {
        const rowData = (r.data && typeof r.data === 'object') ? r.data : {};
        const qCourseId = rowData.courseId || rowData.course_id || r.course_id || r.courseId || '';
        mappedData = {
          ...r,
          ...rowData,
          id: r.id || rowData.id,
          courseId: qCourseId,
          course_id: qCourseId
        };
      }

      return {
        id: r.id || r.key || (mappedData as any)?.id,
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

  const client = getSupabase();

  try {
    // 1. system_settings
    if (col === 'system_settings' || col === 'settings') {
      await client.from('system_settings').upsert({
        key: id,
        value: data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      return;
    }

    // 2. users
    if (col === 'users') {
      // Handle subcollection like /meta/sync_state
      if (docRef?.path && docRef.path.includes('/meta/')) {
        await client.from('system_settings').upsert({
          key: `meta_${id}`,
          value: data,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        return;
      }

      const cleanEmail = (data.email || (id.includes('@') ? id : '') || '').trim().toLowerCase();
      const userPayload = mapUserToDb({ ...data, id });
      if (cleanEmail) userPayload.email = cleanEmail;

      // Check if this user already exists in public.users by EMAIL OR by ID
      let existingRecord: any = null;
      try {
        if (cleanEmail) {
          const { data: byEmail } = await client.from('users').select('id, email').eq('email', cleanEmail).maybeSingle();
          if (byEmail?.id) existingRecord = byEmail;
        }
        if (!existingRecord && id) {
          const { data: byId } = await client.from('users').select('id, email').eq('id', id.trim()).maybeSingle();
          if (byId?.id) existingRecord = byId;
        }
      } catch (checkErr) {
        console.warn('Checking existing user record notice:', checkErr);
      }

      if (existingRecord?.id) {
        // Record exists! Update it by its exact primary key ID to avoid unique email constraint collisions
        userPayload.id = existingRecord.id;
        const { error: updateErr } = await client.from('users').update(userPayload).eq('id', existingRecord.id);
        if (updateErr) {
          console.warn('Supabase users update error, attempting upsert on id:', updateErr);
          const { error: upsertErr } = await client.from('users').upsert(userPayload, { onConflict: 'id' });
          if (upsertErr) throw upsertErr;
        }
      } else {
        // Brand new user row!
        const { error: insertErr } = await client.from('users').insert(userPayload);
        if (insertErr) {
          const { error: upsertErr } = await client.from('users').upsert(userPayload, { onConflict: 'id' });
          if (upsertErr) throw upsertErr;
        }
      }
      return;
    }

    // 3. courses
    if (col === 'courses') {
      const coursePayload = mapCourseToDb({ ...data, id });
      await client.from('courses').upsert(coursePayload, { onConflict: 'id' });
      return;
    }

    // 4. access_requests
    if (col === 'access_requests') {
      const reqPayload = mapAccessRequestToDb({ ...data, id });
      await client.from('access_requests').upsert(reqPayload, { onConflict: 'id' });
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

    await client.from(col).upsert(genericPayload, { onConflict: 'id' });
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

  const client = getSupabase();

  try {
    if (col === 'system_settings' || col === 'settings') {
      await client.from('system_settings').delete().eq('key', id);
      return;
    }
    await client.from(col).delete().eq('id', id);
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

  // 2. Setup periodic polling for real-time consistency
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
  }, 3500);

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
  const client = getSupabase();
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

      const { error } = await client.from(collectionName).upsert(rows);
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
  const client = getSupabase();
  try {
    const BATCH_SIZE = 200;
    for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
      const chunk = docIds.slice(i, i + BATCH_SIZE);
      await client.from(collectionName).delete().in('id', chunk);
    }
  } catch (err) {
    console.error(`deleteBulkDocs error for ${collectionName}:`, err);
    throw err;
  }
}

export async function clearCollectionDocs(collectionName: string, courseId?: string) {
  const client = getSupabase();
  try {
    if (courseId) {
      await client.from(collectionName).delete().eq('course_id', courseId);
    } else {
      await client.from(collectionName).delete().neq('id', '___non_existent_id___');
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

export const db = { _isSupabaseDb: true, type: 'supabase' };

export function increment(n: number = 1) {
  return { _isIncrement: true, value: n };
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
