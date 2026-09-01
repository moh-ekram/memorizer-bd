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
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
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
