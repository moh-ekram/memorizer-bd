import { supabase } from './supabase';
import { safeSetLocalStorage } from './storage';

export interface AppUser {
  uid: string;
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  user_metadata?: any;
  app_metadata?: any;
  providerData?: Array<{ providerId: string }>;
}

/**
 * Live auth object — `auth.currentUser` reflects the current Supabase session
 * user (parity with the old Firebase `auth` object, where currentUser was a
 * synchronous live reference). Kept in sync below via getSession + the global
 * onAuthStateChange subscription.
 */
let currentAuthUser: AppUser | null = null;

function trackSessionUser(session: any) {
  currentAuthUser = normalizeSupabaseUser(session?.user);
}

// Seed immediately from any persisted session, then follow every change.
supabase.auth.getSession().then(({ data }) => trackSessionUser(data?.session)).catch(() => {});
supabase.auth.onAuthStateChange((_event, session) => trackSessionUser(session));

export const auth = {
  get currentUser(): AppUser | null {
    return currentAuthUser;
  },
  set currentUser(user: AppUser | null) {
    currentAuthUser = user;
  }
};

/**
 * Normalizes Supabase User object to be 100% compatible with existing App components
 */
export function normalizeSupabaseUser(user: any): AppUser | null {
  if (!user) return null;
  const email = user.email || user.user_metadata?.email || null;
  const displayName = 
    user.user_metadata?.full_name || 
    user.user_metadata?.name || 
    user.user_metadata?.display_name || 
    user.displayName || 
    (email ? email.split('@')[0] : 'Learner');
  
  const photoURL = 
    user.user_metadata?.avatar_url || 
    user.user_metadata?.picture || 
    user.photoURL || 
    null;

  const id = user.id || user.uid || email || 'anonymous';
  const provider = user.app_metadata?.provider || (user.user_metadata?.avatar_url ? 'google.com' : 'password');

  return {
    uid: id,
    id: id,
    email: email ? email.trim().toLowerCase() : null,
    displayName,
    photoURL,
    user_metadata: user.user_metadata || {},
    app_metadata: user.app_metadata || {},
    providerData: [{ providerId: provider }]
  };
}

/**
 * Supabase Google OAuth Sign-In
 */
export async function signInWithGoogle(options?: { redirectTo?: string }) {
  const redirectTo = options?.redirectTo || window.location.origin;
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: isIframe,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account'
      }
    }
  });

  if (error) {
    console.error('Supabase Google Sign-In Error:', error);
    throw error;
  }

  if (isIframe && data?.url) {
    const width = 500;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(
      data.url,
      'supabase_oauth_popup',
      `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
    );
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.open(data.url, '_blank');
    }
  }

  return data;
}

/**
 * Backwards-compatible signInWithPopup that routes directly to Supabase Google OAuth
 */
export async function signInWithPopup(authObj?: any, provider?: any) {
  return await signInWithGoogle();
}

/**
 * Backwards-compatible signInWithRedirect that routes to Supabase Google OAuth
 */
export async function signInWithRedirect(authObj?: any, provider?: any) {
  return await signInWithGoogle();
}

/**
 * Dummy GoogleAuthProvider class for full backward-compatibility
 */
export class GoogleAuthProvider {
  setCustomParameters(_params: any) {
    return this;
  }
}

/**
 * Supabase Email & Password Sign-In
 */
export async function signInWithEmailAndPassword(authObj: any, email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password
  });

  if (error) {
    console.error('Supabase Sign-In Error:', error);
    throw error;
  }

  return data;
}

/**
 * Supabase Email & Password Sign-Up
 */
export async function createUserWithEmailAndPassword(authObj: any, email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        name: cleanEmail.split('@')[0]
      }
    }
  });

  if (error) {
    console.error('Supabase Sign-Up Error:', error);
    throw error;
  }

  return data;
}

/**
 * Supabase Sign Out
 */
export async function signOut(authObj?: any) {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn('Supabase SignOut Notice:', error);
  }
  try {
    localStorage.removeItem('vocab_memorizer_cached_user');
  } catch (e) {}
  return true;
}

/**
 * Supabase Auth State Listener
 */
export function onAuthStateChanged(
  authObj: any, 
  callback: (user: AppUser | null) => void | Promise<void>
) {
  let isSubscribed = true;

  // 1. Check current session immediately
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) {
      console.warn('Supabase getSession notice:', error);
    }
    if (isSubscribed) {
      const normalized = normalizeSupabaseUser(session?.user);
      callback(normalized);
    }
  }).catch((err) => {
    console.warn('Error checking initial Supabase session:', err);
    if (isSubscribed) {
      callback(null);
    }
  });

  // 2. Subscribe to auth state change events
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (!isSubscribed) return;
    const normalized = normalizeSupabaseUser(session?.user);
    
    if (normalized) {
      safeSetLocalStorage('vocab_memorizer_cached_user', JSON.stringify({
        uid: normalized.uid,
        email: normalized.email,
        displayName: normalized.displayName,
        photoURL: normalized.photoURL
      }));
    }

    callback(normalized);
  });

  return () => {
    isSubscribed = false;
    subscription?.unsubscribe();
  };
}

/**
 * Backwards-compatible getRedirectResult
 */
export async function getRedirectResult(authObj?: any) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data?.session?.user) return null;
  return {
    user: normalizeSupabaseUser(data.session.user)
  };
}
