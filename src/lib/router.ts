import { ActiveTab } from '../types';

export interface RouteState {
  tab: ActiveTab;
  profileSubTab?: 'flashcard' | 'dashboard' | 'my_courses';
  path: string;
  courseId?: string;
  openLoginModal?: boolean;
}

/**
 * Parses the current URL pathname into corresponding application tabs and sub-tabs
 */
export function parseRoute(pathname: string = window.location.pathname): RouteState {
  const cleanPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';

  // 1. Admin
  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
    return { tab: 'admin', path: '/admin' };
  }

  // 2. Settings
  if (cleanPath === '/settings' || cleanPath.startsWith('/settings/')) {
    return { tab: 'settings', path: '/settings' };
  }

  // 3. Leaderboard
  if (cleanPath === '/leaderboard' || cleanPath.startsWith('/leaderboard/')) {
    return { tab: 'leaderboard', path: '/leaderboard' };
  }

  // 4. Revision
  if (cleanPath === '/revision' || cleanPath.startsWith('/revision/')) {
    return { tab: 'revision', path: '/revision' };
  }

  // 5. Courses / My Courses
  if (cleanPath === '/courses' || cleanPath === '/my-courses' || cleanPath.startsWith('/courses/')) {
    return { tab: 'profile', profileSubTab: 'my_courses', path: '/courses' };
  }

  // 6. Flashcard / Dashboard
  if (cleanPath === '/flashcard' || cleanPath === '/flashcards') {
    return { tab: 'profile', profileSubTab: 'flashcard', path: '/flashcard' };
  }
  if (cleanPath === '/dashboard') {
    return { tab: 'profile', profileSubTab: 'dashboard', path: '/dashboard' };
  }
  if (cleanPath === '/profile') {
    return { tab: 'profile', profileSubTab: 'flashcard', path: '/profile' };
  }

  // 7. Games / Practice
  if (cleanPath === '/games' || cleanPath === '/practice' || cleanPath === '/game') {
    return { tab: 'practice', path: '/games' };
  }
  if (cleanPath === '/games/quiz' || cleanPath === '/quiz') {
    return { tab: 'quiz', path: '/games/quiz' };
  }
  if (cleanPath === '/games/match' || cleanPath === '/match') {
    return { tab: 'match', path: '/games/match' };
  }
  if (cleanPath === '/games/synonym' || cleanPath === '/synonym') {
    return { tab: 'synonym', path: '/games/synonym' };
  }
  if (cleanPath === '/games/blank' || cleanPath === '/blank') {
    return { tab: 'practice', path: '/games/blank' };
  }
  if (cleanPath === '/games/odd-one-out' || cleanPath === '/odd-one-out') {
    return { tab: 'practice', path: '/games/odd-one-out' };
  }
  if (cleanPath === '/games/analogy' || cleanPath === '/analogy') {
    return { tab: 'practice', path: '/games/analogy' };
  }

  // 8. Study Tools
  if (cleanPath === '/study-tools' || cleanPath === '/tools') {
    return { tab: 'study_tools', path: '/study-tools' };
  }
  if (cleanPath === '/study-tools/dictionary' || cleanPath === '/dictionary') {
    return { tab: 'dictionary', path: '/study-tools/dictionary' };
  }
  if (cleanPath === '/study-tools/lists' || cleanPath === '/lists' || cleanPath === '/bookmarks') {
    return { tab: 'lists', path: '/study-tools/lists' };
  }
  if (cleanPath === '/study-tools/planner' || cleanPath === '/planner') {
    return { tab: 'planner', path: '/study-tools/planner' };
  }
  if (cleanPath === '/study-tools/story' || cleanPath === '/story') {
    return { tab: 'story', path: '/study-tools/story' };
  }

  // 9. Login
  if (cleanPath === '/login' || cleanPath === '/signin' || cleanPath === '/signup') {
    return { tab: 'profile', profileSubTab: 'flashcard', path: '/login', openLoginModal: true };
  }

  // 10. Home fallback
  return { tab: 'profile', profileSubTab: 'flashcard', path: '/home' };
}

/**
 * Maps active tab & subtab state to a clean URL sublink path
 */
export function getRoutePath(
  tab: ActiveTab, 
  profileSubTab: 'flashcard' | 'dashboard' | 'my_courses' = 'flashcard'
): string {
  switch (tab) {
    case 'admin':
      return '/admin';
    case 'settings':
      return '/settings';
    case 'leaderboard':
      return '/leaderboard';
    case 'revision':
      return '/revision';
    case 'profile':
      if (profileSubTab === 'my_courses') return '/courses';
      if (profileSubTab === 'dashboard') return '/dashboard';
      return '/flashcard';
    case 'dashboard':
      return '/dashboard';
    case 'my_courses':
      return '/courses';
    case 'flashcard':
      return '/flashcard';
    case 'practice':
      return '/games';
    case 'quiz':
      return '/games/quiz';
    case 'match':
      return '/games/match';
    case 'synonym':
      return '/games/synonym';
    case 'study_tools':
      return '/study-tools';
    case 'dictionary':
      return '/study-tools/dictionary';
    case 'lists':
      return '/study-tools/lists';
    case 'planner':
      return '/study-tools/planner';
    case 'story':
    case 'article':
      return '/study-tools/story';
    default:
      return '/home';
  }
}

/**
 * Updates browser address bar URL history without page reload
 */
export function syncRouteUrl(
  tab: ActiveTab, 
  profileSubTab: 'flashcard' | 'dashboard' | 'my_courses' = 'flashcard',
  replace: boolean = false
) {
  try {
    if (typeof window === 'undefined') return;
    const targetPath = getRoutePath(tab, profileSubTab);
    const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    
    // Don't push if already on the same path
    if (currentPath === targetPath || (currentPath === '/' && targetPath === '/home')) {
      return;
    }

    if (replace) {
      window.history.replaceState({ tab, profileSubTab }, '', targetPath);
    } else {
      window.history.pushState({ tab, profileSubTab }, '', targetPath);
    }
  } catch (err) {
    console.warn('URL pushState notice:', err);
  }
}
