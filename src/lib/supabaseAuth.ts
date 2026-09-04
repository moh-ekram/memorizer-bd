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
 * user (where currentUser is a synchronous live reference). Kept in sync below
 * via getSession + the global onAuthStateChange subscription.
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
 * Check if the current window is an OAuth popup returning from the provider (Google, etc.)
 */
export function isOAuthPopupCallback(): boolean {
  if (typeof window === 'undefined') return false;
  const hasOpener = !!(window.opener && window.opener !== window);
  if (!hasOpener) return false;

  const isNamedPopup = window.name === 'supabase_oauth_popup';
  const hasHashToken = 
    window.location.hash.includes('access_token=') || 
    window.location.hash.includes('refresh_token=');
  const hasCode = window.location.search.includes('code=');
  const hasError = 
    window.location.hash.includes('error=') || 
    window.location.search.includes('error=');

  return isNamedPopup || hasHashToken || hasCode || hasError;
}

// If this window is the OAuth popup, handle token callback and close window returning to previous window
if (typeof window !== 'undefined' && isOAuthPopupCallback()) {
  const returnToOpener = (user: any) => {
    try {
      window.opener.postMessage({
        type: 'SUPABASE_OAUTH_SUCCESS',
        user: user ? normalizeSupabaseUser(user) : null
      }, '*');
    } catch (e) {
      console.warn('Could not postMessage to opener:', e);
    }

    try {
      window.opener.focus();
    } catch (_) {}

    setTimeout(() => {
      try {
        window.close();
      } catch (_) {}
    }, 200);
  };

  // 1. Immediate session check
  supabase.auth.getSession().then(({ data }) => {
    if (data?.session?.user) {
      returnToOpener(data.session.user);
    }
  }).catch(() => {});

  // 2. Auth state subscription in popup
  const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      authSub?.subscription?.unsubscribe();
      returnToOpener(session.user);
    }
  });

  // 3. Fallback close after 2.5 seconds
  setTimeout(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      returnToOpener(data?.session?.user);
    } catch (_) {
      try { window.close(); } catch (__) {}
    }
  }, 2500);
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
 * Supabase Google OAuth Sign-In with automatic popup management and return-to-window behavior
 */
export async function signInWithGoogle(options?: { redirectTo?: string }): Promise<AppUser | null> {
  const redirectTo = options?.redirectTo || window.location.origin;
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
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

  if (!data?.url) {
    throw new Error('গুগল লগইন লিঙ্ক তৈরি করা সম্ভব হয়নি।');
  }

  const width = 500;
  const height = 650;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;

  let popup: Window | null = null;
  try {
    popup = window.open(
      data.url,
      'supabase_oauth_popup',
      `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
    );
  } catch (err) {
    console.warn('window.open error:', err);
  }

  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    if (!isIframe) {
      window.location.href = data.url;
      return null;
    }
    const blockedErr: any = new Error('ব্রাউজারে পপ-আপ ব্লক করা আছে। দয়া করে এড্রেস বার থেকে পপ-আপ অ্যালাউ করে পুনরায় চেষ্টা করুন।');
    blockedErr.code = 'auth/popup-blocked';
    throw blockedErr;
  }

  return new Promise<AppUser | null>((resolve) => {
    let resolved = false;

    const cleanup = () => {
      clearInterval(pollTimer);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };

    const finish = (rawUser: any) => {
      if (resolved) return;
      resolved = true;
      cleanup();

      try {
        if (popup && !popup.closed) {
          popup.close();
        }
      } catch (_) {}

      try {
        window.focus();
      } catch (_) {}

      const norm = normalizeSupabaseUser(rawUser);
      if (norm) {
        currentAuthUser = norm;
      }
      resolve(norm);
    };

    // 1. PostMessage handler from the popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SUPABASE_OAUTH_SUCCESS') {
        const u = event.data.user;
        if (u) {
          finish(u);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    // 2. Storage event handler (when popup writes session into shared localStorage)
    const handleStorage = async (e: StorageEvent) => {
      if (e.key && (e.key.includes('auth-token') || e.key.includes('supabase'))) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            finish(sessionData.session.user);
          }
        } catch (_) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Polling interval checking session and popup closed status
    const pollTimer = setInterval(async () => {
      try {
        // Check if session is already active in current window
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          finish(sessionData.session.user);
          return;
        }

        // Check if popup has closed
        if (popup?.closed) {
          clearInterval(pollTimer);
          setTimeout(async () => {
            const { data: finalSession } = await supabase.auth.getSession();
            if (finalSession?.session?.user) {
              finish(finalSession.session.user);
            } else if (!resolved) {
              resolved = true;
              cleanup();
              resolve(null);
            }
          }, 350);
        }
      } catch (e) {
        // Ignore polling error
      }
    }, 500);

    // 4. Timeout safeguard after 120 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    }, 120000);
  });
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
