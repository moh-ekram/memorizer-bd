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
 * Browser Remembrance & Persistent Session Management
 */
export const REMEMBER_ME_STORAGE_KEY = 'vocab_memorizer_remember_me';
export const CACHED_USER_STORAGE_KEY = 'vocab_memorizer_cached_user';
export const SAVED_EMAIL_STORAGE_KEY = 'vocab_memorizer_saved_email';

export function isRememberMeEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(REMEMBER_ME_STORAGE_KEY) !== 'false';
}

export function setRememberMeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  safeSetLocalStorage(REMEMBER_ME_STORAGE_KEY, enabled ? 'true' : 'false');
}

export function getSavedEmail(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(SAVED_EMAIL_STORAGE_KEY) || '';
}

export function saveCachedUser(user: AppUser | null, remember: boolean = true): void {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(CACHED_USER_STORAGE_KEY);
    return;
  }
  setRememberMeEnabled(remember);
  safeSetLocalStorage(CACHED_USER_STORAGE_KEY, JSON.stringify({
    uid: user.uid,
    id: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL
  }));
  if (user.email) {
    safeSetLocalStorage(SAVED_EMAIL_STORAGE_KEY, user.email);
  }
}

export function getCachedUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHED_USER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

/**
 * Quick Browser Remembrance Login - lets learner instantly continue on this browser
 */
export function continueWithBrowserSession(customName?: string): AppUser {
  const existing = getCachedUser();
  if (existing) {
    currentAuthUser = existing;
    return existing;
  }
  
  const guestUser: AppUser = {
    uid: 'local_' + Math.random().toString(36).substring(2, 10),
    id: 'local_' + Math.random().toString(36).substring(2, 10),
    email: 'learner.local@vocabmaster.app',
    displayName: customName || 'Learner (This Browser)',
    photoURL: null,
    user_metadata: { is_local_remembered: true },
    app_metadata: { provider: 'browser_storage' },
    providerData: [{ providerId: 'browser_storage' }]
  };
  saveCachedUser(guestUser, true);
  currentAuthUser = guestUser;
  return guestUser;
}

/**
 * Supabase Google OAuth Sign-In with automatic popup management,
 * synchronous gesture pre-opening (to defeat browser popup blockers),
 * and direct window fallback.
 */
export async function signInWithGoogle(options?: { redirectTo?: string; promptDirectRedirect?: boolean }): Promise<AppUser | null> {
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  const redirectTo = options?.redirectTo || (typeof window !== 'undefined' ? window.location.origin : '');
  
  // PRE-OPEN POPUP SYNCHRONOUSLY IN DIRECT USER GESTURE FRAME
  // Crucial: browsers block window.open called after an await. Pre-opening preserves user activation!
  let popup: Window | null = null;
  const width = 500;
  const height = 650;
  const left = typeof window !== 'undefined' ? Math.max(0, (window.screen.width - width) / 2) : 0;
  const top = typeof window !== 'undefined' ? Math.max(0, (window.screen.height - height) / 2) : 0;

  try {
    popup = window.open(
      'about:blank',
      'supabase_oauth_popup',
      `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
    );
    if (popup) {
      try {
        popup.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Google Sign-In Connecting...</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
                .box { text-align: center; padding: 24px; }
                .spinner { width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
                @keyframes spin { to { transform: rotate(360deg); } }
                p { font-size: 14px; font-weight: 600; }
              </style>
            </head>
            <body>
              <div class="box">
                <div class="spinner"></div>
                <p>Connecting to Google Sign-In...</p>
              </div>
            </body>
          </html>
        `);
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Pre-open popup warning:', err);
  }

  let data: any = null;
  let error: any = null;

  try {
    const res = await supabase.auth.signInWithOAuth({
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
    data = res.data;
    error = res.error;
  } catch (e) {
    if (popup && !popup.closed) {
      try { popup.close(); } catch (_) {}
    }
    throw e;
  }

  if (error) {
    if (popup && !popup.closed) {
      try { popup.close(); } catch (_) {}
    }
    console.error('Supabase Google Sign-In Error:', error);
    throw error;
  }

  if (!data?.url) {
    if (popup && !popup.closed) {
      try { popup.close(); } catch (_) {}
    }
    throw new Error('গুগল লগইন লিঙ্ক তৈরি করা সম্ভব হয়নি।');
  }

  // If popup was successfully opened, navigate it to the Google OAuth authorization URL
  if (popup && !popup.closed) {
    try {
      popup.location.href = data.url;
    } catch (e) {
      console.warn('Popup location href assignment warning:', e);
      try {
        popup.close();
      } catch (_) {}
      popup = window.open(data.url, 'supabase_oauth_popup');
    }
  } else {
    // If popup was blocked or could not be opened
    if (!isIframe) {
      window.location.href = data.url;
      return null;
    } else {
      // In iframe/preview: try open in new window or throw error containing the direct URL
      const directWin = window.open(data.url, '_blank');
      if (!directWin) {
        const blockedErr: any = new Error('ব্রাউজারে পপ-আপ ব্লক করা আছে। নিচের বাটনে ক্লিক করে সরাসরি গুগল লগইন সম্পন্ন করুন।');
        blockedErr.code = 'auth/popup-blocked';
        blockedErr.oauthUrl = data.url;
        throw blockedErr;
      }
    }
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
        saveCachedUser(norm, true);
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
    localStorage.removeItem(CACHED_USER_STORAGE_KEY);
    localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
    currentAuthUser = null;
  } catch (e) {}
  return true;
}

/**
 * Supabase Auth State Listener with persistent browser remembrance
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
      if (normalized) {
        saveCachedUser(normalized, true);
        callback(normalized);
      } else {
        const cached = getCachedUser();
        if (cached && isRememberMeEnabled()) {
          currentAuthUser = cached;
          callback(cached);
        } else {
          callback(null);
        }
      }
    }
  }).catch((err) => {
    console.warn('Error checking initial Supabase session:', err);
    if (isSubscribed) {
      const cached = getCachedUser();
      if (cached && isRememberMeEnabled()) {
        currentAuthUser = cached;
        callback(cached);
      } else {
        callback(null);
      }
    }
  });

  // 2. Subscribe to auth state change events
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (!isSubscribed) return;
    const normalized = normalizeSupabaseUser(session?.user);
    
    if (normalized) {
      saveCachedUser(normalized, true);
      currentAuthUser = normalized;
      callback(normalized);
    } else if (event === 'SIGNED_OUT') {
      // User explicitly clicked sign out
      try {
        localStorage.removeItem(CACHED_USER_STORAGE_KEY);
        localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
      } catch (_) {}
      currentAuthUser = null;
      callback(null);
    } else {
      // Offline, token refreshing, or network delay: preserve remembered user session
      const cached = getCachedUser();
      if (cached && isRememberMeEnabled()) {
        currentAuthUser = cached;
        callback(cached);
      } else {
        callback(null);
      }
    }
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
