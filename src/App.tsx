import React, { useState, useEffect, useRef, useMemo } from 'react';
import { vocabulary } from './data/vocabulary';
import { UserProgress, WordStatus, CustomFolder, StudyGoal, ActiveTab, AppSettings, SyncLogEntry } from './types';
import StatsDashboard from './components/StatsDashboard';
import FlashcardViewer from './components/FlashcardViewer';
import PracticeCenter from './components/PracticeCenter';
import StudyToolsCenter from './components/StudyToolsCenter';
import AppSettingsView from './components/AppSettingsView';
import AdminPanel from './components/AdminPanel';
import GlobalLeaderboard from './components/GlobalLeaderboard';
import MyCoursesView from './components/MyCoursesView';
import AnnouncementBanner from './components/AnnouncementBanner';
import LandingHomePage from './components/LandingHomePage';
import RevisionCenter from './components/RevisionCenter';
import { SyncConflictModal, SyncConflictData } from './components/SyncConflictModal';
import { safeSetLocalStorage } from './lib/storage';

import {
  LayoutDashboard,
  Layers,
  GraduationCap,
  Sparkles,
  BookMarked,
  Search,
  CalendarCheck2,
  BookOpen,
  FolderLock,
  RotateCcw,
  Sparkle,
  Cloud,
  LogOut,
  User,
  AlertCircle,
  Trophy,
  Gamepad2,
  Settings,
  CreditCard,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Lock
} from 'lucide-react';

import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  onAuthStateChanged,
  signOut,
  collection,
  onSnapshot,
  getDocs,
  query,
  where
} from './lib/db';
import type { User as DbUser } from 'firebase/auth';
import { Course } from './types';
import { isCourseEnrolled, isCourseAccessible } from './lib/courseAccess';
import AuthModal from './components/AuthModal';
import { 
  saveProgressToIndexedDB, 
  getProgressFromIndexedDB, 
  addUpdateToSyncQueue, 
  getQueuedSyncItems, 
  clearSyncQueue,
  saveMetaValue,
  getMetaValue,
  clearIndexedDBCache
} from './lib/offlineDb';

const LOCAL_STORAGE_PROGRESS_KEY = 'vocab_memorizer_progress_v2';
const LOCAL_STORAGE_FOLDERS_KEY = 'vocab_memorizer_folders_v2';
const LOCAL_STORAGE_GOALS_KEY = 'vocab_memorizer_goals_v2';
const LOCAL_STORAGE_SYNONYM_PROGRESS_KEY = 'vocab_memorizer_synonym_progress_v2';
const LOCAL_STORAGE_BLANK_PROGRESS_KEY = 'vocab_memorizer_blank_progress_v2';
const LOCAL_STORAGE_SETTINGS_KEY = 'vocab_memorizer_settings_v3';
const LOCAL_STORAGE_ENROLLED_COURSES_KEY = 'vocab_memorizer_enrolled_courses_v2';
const LOCAL_STORAGE_ACTIVE_COURSE_KEY = 'vocab_memorizer_active_course_v2';

export default function App() {

  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
  const [profileSubTab, setProfileSubTab] = useState<'flashcard' | 'dashboard' | 'my_courses'>('flashcard');
  const [selectedGroupFromDash, setSelectedGroupFromDash] = useState<number | string | null>(null);
  const [noCourseToast, setNoCourseToast] = useState<string | null>(null);

  const handleNavigateTab = (tab: string) => {
    if (enrolledCourseIds.length === 0 && !['my_courses', 'admin', 'settings'].includes(tab)) {
      setNoCourseToast("You don't have any enrolled courses yet. Please enroll in a course to start learning!");
      setActiveTab('profile');
      setProfileSubTab('my_courses');
      setTimeout(() => setNoCourseToast(null), 5000);
      return;
    }
    if (['flashcard', 'dashboard', 'my_courses'].includes(tab)) {
      setActiveTab('profile');
      setProfileSubTab(tab as any);
    } else {
      setActiveTab(tab as ActiveTab);
    }
  };

  // --- MOBILE SWIPE NAVIGATION SETUP ---
  const navContainerRef = useRef<HTMLDivElement>(null);
  const [swipeToast, setSwipeToast] = useState<{ message: string; direction: 'left' | 'right' } | null>(null);

  const touchState = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    isVerticalScroll: boolean;
    isCancelled: boolean;
  } | null>(null);

  const MAIN_TABS = ['profile', 'revision', 'leaderboard', 'practice', 'study_tools', 'settings'];

  const TAB_LABELS: Record<string, string> = {
    profile: 'My Profile',
    dashboard: 'Dashboard',
    my_courses: 'My Courses',
    flashcard: 'Flashcard',
    revision: 'Revision',
    leaderboard: 'Leaderboard',
    practice: 'Games',
    study_tools: 'Study Tools',
    settings: 'Settings',
    admin: 'Admin Panel'
  };

  const getPrimaryTab = (tab: string): string => {
    if (['profile', 'dashboard', 'my_courses', 'flashcard'].includes(tab)) return 'profile';
    if (tab === 'revision') return 'revision';
    if (['practice', 'synonym', 'quiz', 'match'].includes(tab)) return 'practice';
    if (['study_tools', 'dictionary', 'lists', 'planner', 'story'].includes(tab)) return 'study_tools';
    return tab;
  };

  // Auto-scroll active tab into view in horizontal menu bar
  useEffect(() => {
    if (navContainerRef.current) {
      const activeBtn = navContainerRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  const showSwipeFeedback = (label: string, direction: 'left' | 'right') => {
    setSwipeToast({ message: label, direction });
    setTimeout(() => {
      setSwipeToast(null);
    }, 1200);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    
    const target = e.target as HTMLElement;
    
    // Ignore if touch started inside interactive components like flashcard stage, inputs, buttons, range sliders, or horizontal scroll areas
    if (
      target.closest('#vocabulary-card-stage') ||
      target.closest('[data-no-swipe="true"]') ||
      target.closest('input, textarea, select, button, [type="range"]') ||
      target.closest('table') ||
      target.closest('.overflow-x-auto')
    ) {
      touchState.current = null;
      return;
    }

    touchState.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTime: Date.now(),
      isVerticalScroll: false,
      isCancelled: false
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchState.current || touchState.current.isCancelled) return;

    const deltaX = e.touches[0].clientX - touchState.current.startX;
    const deltaY = e.touches[0].clientY - touchState.current.startY;

    // Detect if movement is primarily vertical scrolling early to cancel tab swipe
    if (!touchState.current.isVerticalScroll && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      touchState.current.isVerticalScroll = true;
      touchState.current.isCancelled = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchState.current || touchState.current.isCancelled || touchState.current.isVerticalScroll) {
      touchState.current = null;
      return;
    }

    const endX = e.changedTouches[0]?.clientX ?? touchState.current.startX;
    const endY = e.changedTouches[0]?.clientY ?? touchState.current.startY;
    const deltaX = endX - touchState.current.startX;
    const deltaY = endY - touchState.current.startY;
    const timeDiff = Date.now() - touchState.current.startTime;

    touchState.current = null;

    // Minimum swipe threshold: >= 55px horizontal distance, < 80px vertical drift, within 600ms
    if (Math.abs(deltaX) >= 55 && Math.abs(deltaY) < 80 && timeDiff < 600) {
      const currentPrimary = getPrimaryTab(activeTab);
      const isAdmin = user && user.email && ['mohammad.001ekram@gmail.com'].includes(user.email.trim().toLowerCase());
      const availableTabs = isAdmin
        ? [...MAIN_TABS, 'admin']
        : MAIN_TABS;
      const currentIndex = availableTabs.indexOf(currentPrimary);

      if (deltaX < -55) {
        // Swiped Left -> Advance to Next Tab
        if (currentIndex >= 0 && currentIndex < availableTabs.length - 1) {
          const nextTab = availableTabs[currentIndex + 1];
          if (nextTab === 'dashboard') setSelectedGroupFromDash(null);
          setActiveTab(nextTab);
          showSwipeFeedback(TAB_LABELS[nextTab] || nextTab, 'left');
        }
      } else if (deltaX > 55) {
        // Swiped Right -> Go back to Previous Tab
        if (currentIndex > 0) {
          const prevTab = availableTabs[currentIndex - 1];
          if (prevTab === 'dashboard') setSelectedGroupFromDash(null);
          setActiveTab(prevTab);
          showSwipeFeedback(TAB_LABELS[prevTab] || prevTab, 'right');
        }
      }
    }
  };

  // --- PERSISTED STATES ---
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_ENROLLED_COURSES_KEY);
    return saved ? JSON.parse(saved) : ['gre'];
  });

  const [activeCourseId, setActiveCourseId] = useState<string>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_ACTIVE_COURSE_KEY);
    return saved ? saved : 'gre';
  });

  const [customCourses, setCustomCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('vocab_memorizer_cached_custom_courses');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [importedCourses, setImportedCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('vocab_memorizer_imported_courses');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [progress, setProgress] = useState<Record<string, UserProgress>>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [folders, setFolders] = useState<CustomFolder[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_FOLDERS_KEY);
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Important Words (High Priority)', color: '#ef4444' },
      { id: '2', name: 'Hard Synonyms', color: '#f59e0b' }
    ];
  });

  const [goal, setGoal] = useState<StudyGoal>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_GOALS_KEY);
    return saved ? JSON.parse(saved) : {
      dailyTarget: 15,
      streak: 1,
      lastStudyDate: new Date().toISOString().split('T')[0],
      history: {}
    };
  });

  const [synonymProgress, setSynonymProgress] = useState<Record<string, { correct: boolean; updatedAt: string }>>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_SYNONYM_PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [blankProgress, setBlankProgress] = useState<Record<string, { correct: boolean; updatedAt: string }>>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_BLANK_PROGRESS_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [oooProgress, setOooProgress] = useState<Record<string, { correct: boolean; updatedAt: string }>>(() => {
    const saved = localStorage.getItem('vocab_memorizer_ooo_progress');
    return saved ? JSON.parse(saved) : {};
  });

  const [analogyProgress, setAnalogyProgress] = useState<Record<string, { correct: boolean; updatedAt: string }>>(() => {
    const saved = localStorage.getItem('vocab_memorizer_analogy_progress');
    return saved ? JSON.parse(saved) : {};
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('vocab_memorizer_dark_mode');
    return saved ? JSON.parse(saved) : false;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      defaultFlashcardTags: parsed.defaultFlashcardTags || ['know', 'confusion', 'dont_know', 'unrated'],
      defaultFlashcardOrder: parsed.defaultFlashcardOrder || 'random',
      autoPlayAudio: !!parsed.autoPlayAudio,
      quizLength: parsed.quizLength || 10,
      
      // New custom default settings fields
      defaultSynonymOrder: parsed.defaultSynonymOrder || 'random',
      defaultSynonymTags: parsed.defaultSynonymTags || ['know', 'dont_know', 'unrated'],
      defaultQuizType: parsed.defaultQuizType || 'mcq_en_bn',
      defaultMatchSize: parsed.defaultMatchSize || 8,

      // Default keyboard shortcuts mapping
      shortcuts: parsed.shortcuts || {
        'Space': 'flip',
        'ArrowRight': 'know',
        'ArrowLeft': 'dont_know',
        'ArrowUp': 'confusion',
        'ArrowDown': 'skip',
        'Enter': 'audio'
      },

      // Default flashcard rotation animation
      flashcardAnimation: ['flip-h', 'flip-v', 'diagonal', 'shuffle'].includes(parsed.flashcardAnimation) ? parsed.flashcardAnimation : 'shuffle',

      // Default colorize main word setting
      colorizeMainWord: parsed.colorizeMainWord !== undefined ? !!parsed.colorizeMainWord : true,

      // Default flashcard banner overlay animation setting
      flashcardBannerAnim: parsed.flashcardBannerAnim || 'twice_daily',
      flashcardBannerCountPerDay: parsed.flashcardBannerCountPerDay !== undefined ? parsed.flashcardBannerCountPerDay : (parsed.flashcardBannerAnim === 'once_daily' ? 1 : parsed.flashcardBannerAnim === 'disabled' ? 0 : 2),
      flashcardBannerDurationSec: parsed.flashcardBannerDurationSec !== undefined ? parsed.flashcardBannerDurationSec : 3,

      // Practice & Quiz Modules Toggles
      enableBlankFillingGame: parsed.enableBlankFillingGame !== undefined ? !!parsed.enableBlankFillingGame : true,
      enableWordAnalogyGame: parsed.enableWordAnalogyGame !== undefined ? !!parsed.enableWordAnalogyGame : true,
      enableOddOneOutGame: parsed.enableOddOneOutGame !== undefined ? !!parsed.enableOddOneOutGame : true,
      enableSynonymCheck: parsed.enableSynonymCheck !== undefined ? !!parsed.enableSynonymCheck : true,
      enableWordMatchGame: parsed.enableWordMatchGame !== undefined ? !!parsed.enableWordMatchGame : true,

      // System & Access Controls
      enableGlobalLeaderboard: parsed.enableGlobalLeaderboard !== undefined ? !!parsed.enableGlobalLeaderboard : true,
      soundEffectsEnabled: parsed.soundEffectsEnabled !== undefined ? !!parsed.soundEffectsEnabled : true,
      showBengaliTranslations: parsed.showBengaliTranslations !== undefined ? !!parsed.showBengaliTranslations : true,
      dailyGoalWordCount: parsed.dailyGoalWordCount || 20,

      // Item Position & Order Defaults
      practiceItemsOrder: parsed.practiceItemsOrder || ['quiz', 'match', 'synonym', 'blank', 'odd_one_out', 'analogy'],
      studyToolsItemsOrder: parsed.studyToolsItemsOrder || ['lists', 'dictionary', 'planner', 'story'],

      // Starting Page Customization & Course Displayer
      landingBadgeText: parsed.landingBadgeText || 'স্মার্ট ৩ডি ফ্ল্যাশকার্ড ও গেমিফাইড ভোকেবুলারি লার্নিং',
      landingHeadlineMain: parsed.landingHeadlineMain || 'সহজে শব্দ মনে রাখুন,',
      landingCourseSuffix: parsed.landingCourseSuffix || 'কোর্স ইনরোল করে প্রস্তুতি নিন',
      landingDescription: parsed.landingDescription || 'GRE, BCS, IELTS, Bank Job কিংবা সাধারণ ইংরেজি শব্দভাণ্ডার সমৃদ্ধ করতে নিয়ে এলাম অল-ইন-ওয়ান মেমোরাইজার প্ল্যাটফর্ম। ফ্ল্যাশকার্ড, কুইজ, ভয়েস প্রোনাউনসিয়েশন এবং বিভিন্ন গেমের মাধ্যমে শব্দ শিখুন আনন্দ নিয়ে।',
      landingStartBtnText: parsed.landingStartBtnText || 'পড়াশোনা শুরু করুন',
      landingFeature1: parsed.landingFeature1 || 'অফলাইন সাপোর্ট',
      landingFeature2: parsed.landingFeature2 || 'লাইভ লিডারবোর্ড',
      landingStat1Num: parsed.landingStat1Num || '৩,০০০+',
      landingStat1Label: parsed.landingStat1Label || 'গুরুত্বপূর্ণ ভোকাব',
      landingStat2Num: parsed.landingStat2Num || '৬টি+',
      landingStat2Label: parsed.landingStat2Label || 'ইন্টারঅ্যাক্টিভ গেম',
      landingStat3Num: parsed.landingStat3Num || '১০০%',
      landingStat3Label: parsed.landingStat3Label || 'ক্লাউড সিঙ্ক',
      landingDisplayCourses: Array.isArray(parsed.landingDisplayCourses) && parsed.landingDisplayCourses.length > 0 
        ? parsed.landingDisplayCourses 
        : ['BCS', 'GRE', 'IELTS', 'Bank Job', 'Primary Teacher', 'Basic Vocab']
    };
  });

  const [quizScore, setQuizScore] = useState<number>(() => {
    const saved = localStorage.getItem('vocab_memorizer_quiz_score');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [quizTaken, setQuizTaken] = useState<number>(() => {
    const saved = localStorage.getItem('vocab_memorizer_quiz_taken');
    return saved ? parseInt(saved, 10) : 0;
  });

  // --- CLOUD SYNC & AUTH STATES ---
  const [user, setUser] = useState<DbUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const isSyncingFromCloud = useRef(false);
  const [hasLoadedFromCloud, setHasLoadedFromCloud] = useState(false);

  // Data Conflict Resolution states
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflictModalData, setConflictModalData] = useState<SyncConflictData | null>(null);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('memorizer_sync_logs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const addSyncLog = (type: 'auto' | 'manual' | 'offline_queue' | 'cloud_fetch', message: string, status: 'success' | 'error' = 'success', itemCount?: number) => {
    const newEntry: SyncLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      type,
      message,
      status,
      itemCount
    };
    setSyncLogs(prev => {
      const updated = [newEntry, ...prev].slice(0, 15);
      safeSetLocalStorage('memorizer_sync_logs', JSON.stringify(updated));
      return updated;
    });
  };

  // Load from IndexedDB on initial mount as a secure backup
  useEffect(() => {
    const loadIndexedDBCache = async () => {
      try {
        const cachedProgress = await getProgressFromIndexedDB();
        if (cachedProgress && Object.keys(cachedProgress).length > 0) {
          setProgress(prev => {
            const merged = { ...prev };
            Object.keys(cachedProgress).forEach(key => {
              const prevItem = prev[key];
              const cachedItem = cachedProgress[key];
              if (!prevItem) {
                merged[key] = cachedItem;
              } else {
                const prevTime = new Date(prevItem.updatedAt || 0).getTime();
                const cachedTime = new Date(cachedItem.updatedAt || 0).getTime();
                if (cachedTime > prevTime) {
                  merged[key] = cachedItem;
                }
              }
            });
            return merged;
          });
        }
      } catch (err) {
        console.warn('Could not read IndexedDB progress cache:', err);
      }
    };
    loadIndexedDBCache();
  }, []);

  // Service Worker Registration and Background Sync Listener
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered successfully:', registration);

          // Listen for messages from SW (e.g. SYNC_COMPLETE)
          const handleSWMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'SYNC_COMPLETE') {
              console.log('[App] Received SYNC_COMPLETE message from SW:', event.data);
              if (event.data.progress) {
                setProgress(prev => {
                  const merged = { ...prev };
                  Object.keys(event.data.progress).forEach(key => {
                    const prevItem = prev[key];
                    const incomingItem = event.data.progress[key];
                    if (!prevItem) {
                      merged[key] = incomingItem;
                    } else {
                      const prevTime = new Date(prevItem.updatedAt || 0).getTime();
                      const incomingTime = new Date(incomingItem.updatedAt || 0).getTime();
                      if (incomingTime > prevTime) {
                        merged[key] = incomingItem;
                      }
                    }
                  });
                  return merged;
                });
                setSyncStatus('synced');
                setPendingSyncCount(0);
              }
            }
          };

          navigator.serviceWorker.addEventListener('message', handleSWMessage);

          return () => {
            navigator.serviceWorker.removeEventListener('message', handleSWMessage);
          };
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      };

      registerSW();
    }
  }, []);

  // Utility to register a background sync or fall back to manual postMessage triggering
  const triggerBackgroundSync = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await (registration as any).sync.register('sync-progress');
          console.log('[App] Registered sync-progress background sync');
        } else {
          // Fallback if background sync is not supported: post a message to trigger immediate sync in SW
          if (registration.active) {
            registration.active.postMessage({ type: 'TRIGGER_SYNC' });
          }
        }
      } catch (err) {
        console.warn('Background sync registration failed, falling back:', err);
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.active) {
            reg.active.postMessage({ type: 'TRIGGER_SYNC' });
          }
        } catch (e) {}
      }
    }
  };

  // Sync offline updates once connection is restored
  const syncOfflineQueueToFirestore = async (currentProgress: Record<string, UserProgress> = progress) => {
    if (!user || !hasLoadedFromCloud || !navigator.onLine) return;
    try {
      const queuedItems = await getQueuedSyncItems();
      if (queuedItems.length === 0) return;

      setSyncStatus('syncing');
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        progress: currentProgress,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await clearSyncQueue();
      setPendingSyncCount(0);
      setSyncStatus('synced');
      addSyncLog('offline_queue', 'Synced queued offline changes to Cloud', 'success', queuedItems.length);
    } catch (err) {
      console.error('Error syncing offline queue to database:', err);
      setSyncStatus('error');
      addSyncLog('offline_queue', 'Offline queue synchronization failed', 'error');
    }
  };

  // Sync network status & trigger automatic queue synchronization
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueueToFirestore();
      triggerBackgroundSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    const checkQueue = async () => {
      try {
        const items = await getQueuedSyncItems();
        setPendingSyncCount(items.length);
        if (items.length > 0 && navigator.onLine) {
          syncOfflineQueueToFirestore();
          triggerBackgroundSync();
        }
      } catch (e) {}
    };
    checkQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, hasLoadedFromCloud]);

  // Local Storage & IndexedDB Cache Save
  useEffect(() => {
    safeSetLocalStorage(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(progress));
    saveProgressToIndexedDB(progress);
    
    // Also update pending count on progress change
    const updateCount = async () => {
      try {
        const items = await getQueuedSyncItems();
        setPendingSyncCount(items.length);
      } catch (e) {}
    };
    updateCount();
  }, [progress]);

  useEffect(() => {
    safeSetLocalStorage(LOCAL_STORAGE_FOLDERS_KEY, JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    safeSetLocalStorage(LOCAL_STORAGE_GOALS_KEY, JSON.stringify(goal));
  }, [goal]);

  useEffect(() => {
    safeSetLocalStorage(LOCAL_STORAGE_SYNONYM_PROGRESS_KEY, JSON.stringify(synonymProgress));
  }, [synonymProgress]);

  useEffect(() => {
    safeSetLocalStorage(LOCAL_STORAGE_BLANK_PROGRESS_KEY, JSON.stringify(blankProgress));
  }, [blankProgress]);

  useEffect(() => {
    safeSetLocalStorage('vocab_memorizer_ooo_progress', JSON.stringify(oooProgress));
  }, [oooProgress]);

  useEffect(() => {
    safeSetLocalStorage('vocab_memorizer_analogy_progress', JSON.stringify(analogyProgress));
  }, [analogyProgress]);

  useEffect(() => {
    safeSetLocalStorage(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    safeSetLocalStorage('vocab_memorizer_dark_mode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    safeSetLocalStorage(LOCAL_STORAGE_ENROLLED_COURSES_KEY, JSON.stringify(enrolledCourseIds));
  }, [enrolledCourseIds]);

  useEffect(() => {
    safeSetLocalStorage(LOCAL_STORAGE_ACTIVE_COURSE_KEY, activeCourseId);
  }, [activeCourseId]);

  useEffect(() => {
    safeSetLocalStorage('vocab_memorizer_quiz_score', String(quizScore));
  }, [quizScore]);

  useEffect(() => {
    safeSetLocalStorage('vocab_memorizer_quiz_taken', String(quizTaken));
  }, [quizTaken]);

  // Load custom courses with real-time snapshot updates and offline caching
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const coursesRef = collection(db, 'courses');
      unsubscribe = onSnapshot(coursesRef, (querySnapshot) => {
        const loaded: Course[] = [];
        querySnapshot.forEach(docSnap => {
          loaded.push({ ...docSnap.data(), id: docSnap.id } as Course);
        });
        setCustomCourses(loaded);
        safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(loaded));

        // Sync importedCourses if any match custom course IDs
        setImportedCourses(prev => {
          let hasChanges = false;
          const next = prev.map(imp => {
            const match = loaded.find(c => c.id.trim().toLowerCase() === imp.id.trim().toLowerCase());
            if (match) {
              hasChanges = true;
              return { ...imp, ...match };
            }
            return imp;
          });
          if (hasChanges) {
            safeSetLocalStorage('vocab_memorizer_imported_courses', JSON.stringify(next));
            return next;
          }
          return prev;
        });
      }, (error) => {
        console.warn("Error in real-time courses listener (Offline-first active):", error);
      });
    } catch (error) {
      console.error("Error setting up courses snapshot:", error);
    }
    return () => unsubscribe();
  }, []);

  // Load global system settings with real-time snapshot updates
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const sysRef = doc(db, 'system_settings', 'global');
      unsubscribe = onSnapshot(sysRef, (docSnap) => {
        if (docSnap.exists()) {
          const sysData = docSnap.data();
          setSettings(prev => ({
            ...prev,
            ...sysData
          }));
        }
      }, (error) => {
        console.warn("Real-time system_settings listener notice:", error);
      });
    } catch (err) {
      console.error("Error setting up system_settings snapshot:", err);
    }
    return () => unsubscribe();
  }, []);

  // Continuous real-time enrollment auto-sync whenever user email, customCourses or access_requests change
  useEffect(() => {
    const cleanUserEmail = (user?.email || '').trim().toLowerCase();
    if (!cleanUserEmail) return;

    // 1. Scan customCourses allowedUsers for matching email
    const allowedCourseIds = customCourses
      .filter(c => Array.isArray(c.allowedUsers) && c.allowedUsers.some(u => typeof u === 'string' && u.trim().toLowerCase() === cleanUserEmail))
      .map(c => c.id.trim().toLowerCase());

    if (allowedCourseIds.length > 0) {
      setEnrolledCourseIds(prev => {
        const existingSet = new Set(prev.map(id => id.trim().toLowerCase()));
        let updated = false;
        const newArr = [...prev];
        allowedCourseIds.forEach(id => {
          if (!existingSet.has(id)) {
            existingSet.add(id);
            newArr.push(id);
            updated = true;
          }
        });
        if (updated) {
          safeSetLocalStorage(LOCAL_STORAGE_ENROLLED_COURSES_KEY, JSON.stringify(newArr));
          if (user) {
            setDoc(doc(db, 'users', user.uid), { enrolledCourseIds: newArr }, { merge: true }).catch(console.error);
          }
        }
        return updated ? newArr : prev;
      });
    }

    // 2. Real-time snapshot on access_requests for approved requests matching email
    let unsubscribeReqs = () => {};
    try {
      const q = query(
        collection(db, 'access_requests'),
        where('email', '==', cleanUserEmail),
        where('status', '==', 'approved')
      );
      unsubscribeReqs = onSnapshot(q, (snapshot) => {
        const approvedIds = new Set<string>();
        snapshot.docs.forEach(docSnap => {
          const rd = docSnap.data() as any;
          if (rd.courseId && rd.courseId !== 'wallet_recharge' && rd.courseId !== 'multi_cart') {
            approvedIds.add(rd.courseId.trim().toLowerCase());
          }
          if (Array.isArray(rd.courseIds)) {
            rd.courseIds.forEach((cid: string) => {
              if (cid && cid !== 'wallet_recharge' && cid !== 'multi_cart') {
                approvedIds.add(cid.trim().toLowerCase());
              }
            });
          }
        });

        if (approvedIds.size > 0) {
          setEnrolledCourseIds(prev => {
            const existingSet = new Set(prev.map(id => id.trim().toLowerCase()));
            let updated = false;
            const newArr = [...prev];
            approvedIds.forEach(id => {
              if (!existingSet.has(id)) {
                existingSet.add(id);
                newArr.push(id);
                updated = true;
              }
            });
            if (updated) {
              safeSetLocalStorage(LOCAL_STORAGE_ENROLLED_COURSES_KEY, JSON.stringify(newArr));
              if (user) {
                setDoc(doc(db, 'users', user.uid), { enrolledCourseIds: newArr }, { merge: true }).catch(console.error);
              }
            }
            return updated ? newArr : prev;
          });
        }
      }, (err) => {
        console.warn("access_requests snapshot notice:", err);
      });
    } catch (err) {
      console.warn("Error setting up access_requests snapshot:", err);
    }

    return () => unsubscribeReqs();
  }, [customCourses, user]);

  // Filter custom courses based on strictly enforced permissions
  const filteredCustomCourses = customCourses.filter(c => 
    isCourseAccessible(c, enrolledCourseIds, user?.email)
  );

  // Auto-enroll default custom courses so they are immediately visible to users
  useEffect(() => {
    if (filteredCustomCourses.length > 0) {
      const defaultIds = filteredCustomCourses.filter(c => c.isDefault).map(c => c.id);
      if (defaultIds.length > 0) {
        setEnrolledCourseIds(prev => {
          const newIds = [...prev];
          let updated = false;
          defaultIds.forEach(id => {
            if (!newIds.some(existing => existing.trim().toLowerCase() === id.trim().toLowerCase())) {
              newIds.push(id);
              updated = true;
            }
          });
          return updated ? newIds : prev;
        });
      }
    }
  }, [filteredCustomCourses]);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          await saveMetaValue('uid', currentUser.uid);
        } catch (e) {
          console.warn('Error saving uid to IDB:', e);
        }

        setSyncStatus('syncing');
        setHasLoadedFromCloud(false);
        isSyncingFromCloud.current = true;
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          
          let data: any = null;
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            data = docSnap.data();
          }

          if (data) {

            // Merge state from cloud data with existing local progress to prevent overwriting locally rated words
            setProgress(prev => {
              const cloudProg = (data.progress && typeof data.progress === 'object') ? data.progress : {};
              const merged = { ...cloudProg };
              Object.keys(prev).forEach(wordId => {
                if (!merged[wordId]) {
                  merged[wordId] = prev[wordId];
                } else {
                  const localTime = new Date(prev[wordId].updatedAt || 0).getTime();
                  const cloudTime = new Date(merged[wordId].updatedAt || 0).getTime();
                  if (localTime > cloudTime) {
                    merged[wordId] = prev[wordId];
                  }
                }
              });
              return merged;
            });
            setFolders(Array.isArray(data.folders) && data.folders.length > 0 ? data.folders : [
              { id: '1', name: 'Important Words (High Priority)', color: '#ef4444' },
              { id: '2', name: 'Hard Synonyms', color: '#f59e0b' }
            ]);

            const rawGoal = data.goal && typeof data.goal === 'object' ? data.goal : {};
            setGoal({
              dailyTarget: typeof rawGoal.dailyTarget === 'number' ? rawGoal.dailyTarget : 15,
              streak: typeof rawGoal.streak === 'number' ? rawGoal.streak : 1,
              lastStudyDate: typeof rawGoal.lastStudyDate === 'string' ? rawGoal.lastStudyDate : new Date().toISOString().split('T')[0],
              history: rawGoal.history && typeof rawGoal.history === 'object' ? rawGoal.history : {}
            });

            setSynonymProgress(data.synonymProgress && typeof data.synonymProgress === 'object' ? data.synonymProgress : {});
            setBlankProgress(data.blankProgress && typeof data.blankProgress === 'object' ? data.blankProgress : {});
            setOooProgress(data.oooProgress && typeof data.oooProgress === 'object' ? data.oooProgress : {});
            setAnalogyProgress(data.analogyProgress && typeof data.analogyProgress === 'object' ? data.analogyProgress : {});
            if (data.settings && typeof data.settings === 'object') {
              setSettings(prev => ({
                ...prev,
                ...data.settings,
                practiceItemsOrder: Array.isArray(data.settings?.practiceItemsOrder) ? data.settings.practiceItemsOrder : prev.practiceItemsOrder,
                studyToolsItemsOrder: Array.isArray(data.settings?.studyToolsItemsOrder) ? data.settings.studyToolsItemsOrder : prev.studyToolsItemsOrder,
                landingDisplayCourses: Array.isArray(data.settings?.landingDisplayCourses) ? data.settings.landingDisplayCourses : prev.landingDisplayCourses
              }));
            }
            const userEnrolled = Array.isArray(data.enrolledCourseIds) ? data.enrolledCourseIds : [];

            // Auto-sync any course access requests or allowedUsers entries matching currentUser.email
            let autoSyncedPurchased: string[] = [];
            try {
              const cleanUserEmail = (currentUser.email || '').trim().toLowerCase();
              if (cleanUserEmail) {
                const foundIds = new Set<string>();
                const reqsQuery = query(
                  collection(db, 'access_requests'),
                  where('email', '==', cleanUserEmail),
                  where('status', '==', 'approved')
                );
                const reqsSnap = await getDocs(reqsQuery);
                reqsSnap.docs.forEach(docSnap => {
                  const rd = docSnap.data() as any;
                  if (rd.courseId && rd.courseId !== 'wallet_recharge' && rd.courseId !== 'multi_cart') {
                    foundIds.add(rd.courseId.trim().toLowerCase());
                  }
                  if (Array.isArray(rd.courseIds)) {
                    rd.courseIds.forEach((cid: string) => {
                      if (cid && cid !== 'wallet_recharge' && cid !== 'multi_cart') {
                        foundIds.add(cid.trim().toLowerCase());
                      }
                    });
                  }
                });

                const coursesSnap = await getDocs(collection(db, 'courses'));
                coursesSnap.docs.forEach(cSnap => {
                  const cData = cSnap.data();
                  if (Array.isArray(cData.allowedUsers)) {
                    const isAllowed = cData.allowedUsers.some(
                      (u: string) => typeof u === 'string' && u.trim().toLowerCase() === cleanUserEmail
                    );
                    if (isAllowed) {
                      foundIds.add(cSnap.id.trim().toLowerCase());
                    }
                  }
                });
                autoSyncedPurchased = Array.from(foundIds);
              }
            } catch (syncErr) {
              console.warn("Auto-sync course purchases error:", syncErr);
            }

            const mergedEnrolled = Array.from(new Set([...userEnrolled, ...autoSyncedPurchased]));
            setEnrolledCourseIds(mergedEnrolled);
            // Sync active course from cloud: prefer cloud active course if available and valid
            setActiveCourseId(prev => {
              if (data.activeCourseId) return data.activeCourseId;
              return prev || (mergedEnrolled[0] || 'gre');
            });
            setQuizScore(typeof data.quizScore === 'number' ? data.quizScore : 0);
            setQuizTaken(typeof data.quizTaken === 'number' ? data.quizTaken : 0);
            
            if (mergedEnrolled.length > userEnrolled.length) {
              try {
                await setDoc(userDocRef, { enrolledCourseIds: mergedEnrolled }, { merge: true });
              } catch (setErr) {
                console.warn("Failed to update user enrolledCourseIds in cloud:", setErr);
              }
            }

            setSyncStatus('synced');
            setHasLoadedFromCloud(true);
            const loadedCount = Object.keys(data.progress || {}).length;
            addSyncLog('cloud_fetch', `Restored ${loadedCount} progress item${loadedCount === 1 ? '' : 's'} from Cloud snapshot`, 'success', loadedCount);
          } else {
            // New user signup: create clean user record with auto-synced purchases if any
            const cleanProgress = {};
            const cleanFolders = [
              { id: '1', name: 'Important Words (High Priority)', color: '#ef4444' },
              { id: '2', name: 'Hard Synonyms', color: '#f59e0b' }
            ];
            const cleanGoal = {
              dailyTarget: 15,
              streak: 1,
              lastStudyDate: new Date().toISOString().split('T')[0],
              history: {}
            };

            let cleanEnrolled: string[] = [];
            try {
              const cleanUserEmail = (currentUser.email || '').trim().toLowerCase();
              if (cleanUserEmail) {
                const foundIds = new Set<string>();
                const reqsQuery = query(
                  collection(db, 'access_requests'),
                  where('email', '==', cleanUserEmail),
                  where('status', '==', 'approved')
                );
                const reqsSnap = await getDocs(reqsQuery);
                reqsSnap.docs.forEach(docSnap => {
                  const rd = docSnap.data() as any;
                  if (rd.courseId && rd.courseId !== 'wallet_recharge' && rd.courseId !== 'multi_cart') {
                    foundIds.add(rd.courseId.trim().toLowerCase());
                  }
                  if (Array.isArray(rd.courseIds)) {
                    rd.courseIds.forEach((cid: string) => {
                      if (cid && cid !== 'wallet_recharge' && cid !== 'multi_cart') {
                        foundIds.add(cid.trim().toLowerCase());
                      }
                    });
                  }
                });

                const coursesSnap = await getDocs(collection(db, 'courses'));
                coursesSnap.docs.forEach(cSnap => {
                  const cData = cSnap.data();
                  if (Array.isArray(cData.allowedUsers)) {
                    const isAllowed = cData.allowedUsers.some(
                      (u: string) => typeof u === 'string' && u.trim().toLowerCase() === cleanUserEmail
                    );
                    if (isAllowed) {
                      foundIds.add(cSnap.id.trim().toLowerCase());
                    }
                  }
                });
                cleanEnrolled = Array.from(foundIds);
              }
            } catch (syncErr) {
              console.warn("Auto-sync course purchases error on signup:", syncErr);
            }

            const cleanActive = cleanEnrolled[0] || 'gre';

            setProgress(cleanProgress);
            setFolders(cleanFolders);
            setGoal(cleanGoal);
            setSynonymProgress({});
            setBlankProgress({});
            setOooProgress({});
            setAnalogyProgress({});
            setEnrolledCourseIds(cleanEnrolled);
            setActiveCourseId(cleanActive);
            setQuizScore(0);
            setQuizTaken(0);

            // Direct new user to 'My Courses' if they have no enrolled courses on initial load
            if (cleanEnrolled.length === 0 && !hasLoadedFromCloud) {
              setActiveTab('profile');
              setProfileSubTab('my_courses');
            }

            await setDoc(userDocRef, {
              progress: cleanProgress,
              folders: cleanFolders,
              goal: cleanGoal,
              synonymProgress: {},
              blankProgress: {},
              oooProgress: {},
              analogyProgress: {},
              settings,
              enrolledCourseIds: cleanEnrolled,
              activeCourseId: cleanActive,
              quizScore: 0,
              quizTaken: 0,
              email: currentUser.email,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            setSyncStatus('synced');
            setHasLoadedFromCloud(true);
          }
        } catch (err) {
          console.error('Error fetching user data from Firestore:', err);
          setSyncStatus('error');
        } finally {
          setTimeout(() => {
            isSyncingFromCloud.current = false;
          }, 500);
        }
      } else {
        // Logged out
        try {
          await saveMetaValue('uid', null);
        } catch (e) {}
        isSyncingFromCloud.current = false;
        setHasLoadedFromCloud(false);
        setSyncStatus('idle');
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync to Cloud whenever state changes and user is logged in (debounced)
  useEffect(() => {
    if (!user || !hasLoadedFromCloud) {
      setSyncStatus('idle');
      return;
    }

    if (isSyncingFromCloud.current) {
      return;
    }

    const performSync = async () => {
      setSyncStatus('syncing');
      try {
        await setDoc(doc(db, 'users', user.uid), {
          progress,
          folders,
          goal,
          synonymProgress,
          blankProgress,
          oooProgress,
          analogyProgress,
          settings,
          enrolledCourseIds,
          activeCourseId,
          quizScore,
          quizTaken,
          email: user.email,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setSyncStatus('synced');
        const itemCount = Object.keys(progress || {}).length;
        addSyncLog('auto', `Saved ${itemCount} study item${itemCount === 1 ? '' : 's'} & preferences to Cloud`, 'success', itemCount);
      } catch (err) {
        console.error('Error saving to Cloud:', err);
        setSyncStatus('error');
        addSyncLog('auto', 'Automatic cloud sync failed', 'error', 0);
      }
    };

    const timer = setTimeout(() => {
      performSync();
    }, 1000);

    return () => clearTimeout(timer);
  }, [progress, folders, goal, synonymProgress, blankProgress, oooProgress, analogyProgress, settings, enrolledCourseIds, activeCourseId, quizScore, quizTaken, user, hasLoadedFromCloud]);

  const forceSyncToCloud = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      await setDoc(doc(db, 'users', user.uid), {
        progress,
        folders,
        goal,
        synonymProgress,
        blankProgress,
        oooProgress,
        analogyProgress,
        settings,
        enrolledCourseIds,
        activeCourseId,
        quizScore,
        quizTaken,
        email: user.email,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSyncStatus('synced');
      setHasLoadedFromCloud(true);
      const itemsProcessed = Object.keys(progress || {}).length;
      addSyncLog('manual', `Manual cloud backup & recovery completed (${itemsProcessed} item${itemsProcessed === 1 ? '' : 's'} verified)`, 'success', itemsProcessed);
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncStatus('error');
      addSyncLog('manual', 'Manual cloud backup failed', 'error', 0);
    }
  };

  const handleLogOut = async () => {
    if (confirm('Are you sure you want to log out?')) {
      try {
        await signOut(auth);
        
        // Remove all local storage items associated with the previous account
        localStorage.removeItem(LOCAL_STORAGE_PROGRESS_KEY);
        localStorage.removeItem(LOCAL_STORAGE_FOLDERS_KEY);
        localStorage.removeItem(LOCAL_STORAGE_GOALS_KEY);
        localStorage.removeItem(LOCAL_STORAGE_SYNONYM_PROGRESS_KEY);
        localStorage.removeItem(LOCAL_STORAGE_BLANK_PROGRESS_KEY);
        localStorage.removeItem('vocab_memorizer_ooo_progress');
        localStorage.removeItem('vocab_memorizer_analogy_progress');
        localStorage.removeItem(LOCAL_STORAGE_ENROLLED_COURSES_KEY);
        localStorage.removeItem(LOCAL_STORAGE_ACTIVE_COURSE_KEY);
        localStorage.removeItem('vocab_memorizer_quiz_score');
        localStorage.removeItem('vocab_memorizer_quiz_taken');
        localStorage.removeItem('memorizer_sync_logs');

        // Clear offline IndexedDB cache
        await clearIndexedDBCache();

        // Reset state to clean defaults
        setProgress({});
        setFolders([
          { id: '1', name: 'Important Words (High Priority)', color: '#ef4444' },
          { id: '2', name: 'Hard Synonyms', color: '#f59e0b' }
        ]);
        setGoal({
          dailyTarget: 15,
          streak: 1,
          lastStudyDate: new Date().toISOString().split('T')[0],
          history: {}
        });
        setSynonymProgress({});
        setBlankProgress({});
        setOooProgress({});
        setAnalogyProgress({});
        setSettings({
          defaultFlashcardTags: ['dont_know'],
          defaultFlashcardOrder: 'random',
          autoPlayAudio: false,
          quizLength: 10
        });
        setEnrolledCourseIds([]);
        setActiveCourseId('gre');
        setQuizScore(0);
        setQuizTaken(0);

        setUser(null);
        setHasLoadedFromCloud(false);
        setSyncStatus('idle');
      } catch (err) {
        console.error('Log out failed:', err);
      }
    }
  };

  // Handle active streak checks on load
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    setGoal(prev => {
      let currentStreak = prev.streak || 1;
      let lastDate = prev.lastStudyDate || todayStr;

      if (lastDate === yesterdayStr) {
        // Streak continues, do nothing yet till they study today
      } else if (lastDate !== todayStr) {
        // Broke streak (inactive for over 1 day)
        currentStreak = 1;
      }

      return {
        ...prev,
        streak: currentStreak,
        lastStudyDate: todayStr
      };
    });
  }, []);

  // helper function to format current date string
  function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // --- COURSE RESOLVERS ---
  const dbGreCourse = customCourses.find(c => c.id.trim().toLowerCase() === 'gre');
  const defaultGreCourse: Course = {
    ...(dbGreCourse || {}),
    id: dbGreCourse?.id || 'gre',
    title: dbGreCourse?.title || 'Free Vocabularies',
    description: dbGreCourse?.description || 'Core 1100 Vocabulary Preparation Course (Free & Unlocked)',
    totalGroups: dbGreCourse?.totalGroups || (dbGreCourse?.words && dbGreCourse.words.length > 0 ? new Set(dbGreCourse.words.map(w => w.group)).size : 37),
    words: (dbGreCourse?.words && dbGreCourse.words.length > 0) ? dbGreCourse.words : vocabulary,
    stories: dbGreCourse?.stories || [],
    enabledGames: dbGreCourse?.enabledGames || { quiz: true, match: true, synonym: true, blank: true, story: true },
    isDefault: true,
    isRestricted: false,
    allowedUsers: dbGreCourse?.allowedUsers || [],
    price: 0,
    bkashNumber: (dbGreCourse?.bkashNumber && dbGreCourse.bkashNumber !== '01700000000' && dbGreCourse.bkashNumber.trim() !== '') ? dbGreCourse.bkashNumber : '01581624202',
    googleSearchQuery: dbGreCourse?.googleSearchQuery || '',
    createdAt: dbGreCourse?.createdAt || new Date('2026-01-01').toISOString(),
    createdBy: dbGreCourse?.createdBy || 'system'
  };

  const allCourses: Course[] = useMemo(() => {
    const rawAllCourses: Course[] = [
      defaultGreCourse, 
      ...customCourses.filter(c => c.id.trim().toLowerCase() !== 'gre'), 
      ...importedCourses.filter(c => c.id.trim().toLowerCase() !== 'gre')
    ];
    const coursesList: Course[] = [];
    const seenCourseIds = new Set<string>();
    for (const c of rawAllCourses) {
      const cIdLower = c.id.trim().toLowerCase();
      if (!seenCourseIds.has(cIdLower)) {
        seenCourseIds.add(cIdLower);
        const isFreeCourse = c.isDefault || cIdLower === 'gre' || c.price === 0;
        coursesList.push({
          ...c,
          price: isFreeCourse ? 0 : (c.price !== undefined ? c.price : 30),
          bkashNumber: (c.bkashNumber && c.bkashNumber !== '01700000000' && c.bkashNumber.trim() !== '') ? c.bkashNumber : '01581624202'
        });
      }
    }
    // Sort courses by click frequency (highest clicks first), then by custom order
    coursesList.sort((a, b) => {
      const clicksA = typeof a.clickCount === 'number' ? a.clickCount : 0;
      const clicksB = typeof b.clickCount === 'number' ? b.clickCount : 0;
      if (clicksB !== clicksA) return clicksB - clicksA;
      return (a.order !== undefined ? a.order : 999) - (b.order !== undefined ? b.order : 999);
    });
    return coursesList;
  }, [defaultGreCourse, customCourses, importedCourses]);

  const allAvailableCourses: Course[] = allCourses;

// Unified helper function to resolve active course matching activeCourseId or falling back cleanly
const getActiveCourse = (
  targetId: string | undefined | null,
  courses: Course[],
  defaultFallback: Course
): Course => {
  if (!courses || courses.length === 0) return defaultFallback;
  const norm = targetId?.trim().toLowerCase();
  
  if (norm) {
    // 1. Direct exact ID match
    let match = courses.find(c => c && c.id && c.id.trim().toLowerCase() === norm);
    if (match) return match;

    // 2. Course code match
    match = courses.find(c => c && (c as any).courseCode && (c as any).courseCode.trim().toLowerCase() === norm);
    if (match) return match;

    // 3. Title match
    match = courses.find(c => c && c.title && c.title.trim().toLowerCase() === norm);
    if (match) return match;

    // 4. Loose substring match
    match = courses.find(c => 
      (c && c.id && (c.id.trim().toLowerCase().includes(norm) || norm.includes(c.id.trim().toLowerCase()))) ||
      (c && c.title && (c.title.trim().toLowerCase().includes(norm) || norm.includes(c.title.trim().toLowerCase())))
    );
    if (match) return match;
  }

  // Fallback to explicitly default course or first available course
  const defaultObj = courses.find(c => c.isDefault || c.id.trim().toLowerCase() === 'gre') || courses[0];
  return defaultObj || defaultFallback;
};

  useEffect(() => {
    if (!allCourses || allCourses.length === 0) return;

    const resolvedCourse = getActiveCourse(activeCourseId, allCourses, defaultGreCourse);
    
    // Automatically ensure activeCourseId stays in sync with canonical course ID
    if (resolvedCourse && resolvedCourse.id && resolvedCourse.id !== activeCourseId) {
      setActiveCourseId(resolvedCourse.id);
    }

    const canonicalId = resolvedCourse ? resolvedCourse.id : 'gre';
    setEnrolledCourseIds(prev => {
      if (!prev || prev.length === 0) {
        return [canonicalId];
      }
      if (!prev.some(id => id.trim().toLowerCase() === canonicalId.trim().toLowerCase())) {
        return [canonicalId, ...prev];
      }
      return prev;
    });
  }, [allCourses, activeCourseId, defaultGreCourse]);

  const handleImportCourse = (course: Course) => {
    setImportedCourses(prev => {
      if (prev.some(c => c.id.trim().toLowerCase() === course.id.trim().toLowerCase())) {
        return prev;
      }
      const updated = [...prev, course];
      safeSetLocalStorage('vocab_memorizer_imported_courses', JSON.stringify(updated));
      return updated;
    });

    setEnrolledCourseIds(prev => {
      if (!prev.some(id => id.trim().toLowerCase() === course.id.trim().toLowerCase())) {
        return [...prev, course.id];
      }
      return prev;
    });

    setActiveCourseId(course.id);
  };

  const rawActiveCourse = useMemo(() => {
    return getActiveCourse(activeCourseId, allCourses, defaultGreCourse);
  }, [allCourses, activeCourseId, defaultGreCourse]);

  const isCourseFullyAccessible = isCourseAccessible(rawActiveCourse, enrolledCourseIds, user?.email);
  const isRestrictedLocked = !isCourseFullyAccessible;

  const activeCourse = rawActiveCourse;
  const effectiveFreeLimit = 5;
  const activeWords = isRestrictedLocked
    ? (activeCourse.words || []).slice(0, effectiveFreeLimit)
    : (activeCourse.words || []);

  // --- DATABASE STATE HANDLERS ---

  // Rate/Tag word ('pari', 'pari na', 'confusion')
  const handleRateWord = (wordId: string, status: WordStatus) => {
    const oldStatus = progress[wordId]?.status || 'unrated';
    const timestamp = new Date().toISOString();

    setProgress(prev => {
      const prevWord = prev[wordId] || { id: wordId, status: 'unrated', notes: '', bookmarks: [] };
      return {
        ...prev,
        [wordId]: {
          ...prevWord,
          status,
          updatedAt: timestamp
        }
      };
    });

    // Handle offline queueing
    if (!navigator.onLine) {
      addUpdateToSyncQueue({
        wordId,
        status,
        progressData: {
          status,
          updatedAt: timestamp,
          notes: progress[wordId]?.notes || '',
          bookmarks: progress[wordId]?.bookmarks || []
        },
        timestamp
      }).then(() => {
        getQueuedSyncItems().then(items => {
          setPendingSyncCount(items.length);
          triggerBackgroundSync();
        });
      });
    }

    // Increment Today's Study counter if marked as "know" or completed
    if (status !== 'unrated' && oldStatus !== status) {
      const todayStr = getTodayString();
      setGoal(prev => {
        const currentCount = prev.history[todayStr] || 0;
        const newHistory = { ...prev.history, [todayStr]: currentCount + 1 };

        // Streak logic on studying
        let newStreak = prev.streak;
        if (prev.lastStudyDate !== todayStr) {
          newStreak += 1;
        }

        return {
          ...prev,
          streak: newStreak,
          lastStudyDate: todayStr,
          history: newHistory
        };
      });
    }
  };

  // Batch Rate/Tag multiple words at once
  const handleBatchRateWords = (wordIds: string[], status: WordStatus) => {
    if (!wordIds || wordIds.length === 0) return;
    const timestamp = new Date().toISOString();
    const todayStr = getTodayString();

    let newlyRatedCount = 0;

    setProgress(prev => {
      const nextProgress = { ...prev };
      wordIds.forEach(wordId => {
        const oldStatus = prev[wordId]?.status || 'unrated';
        if (status !== 'unrated' && oldStatus !== status) {
          newlyRatedCount++;
        }
        nextProgress[wordId] = {
          ...(prev[wordId] || { id: wordId, status: 'unrated', notes: '', bookmarks: [] }),
          status,
          updatedAt: timestamp
        };
      });
      return nextProgress;
    });

    if (newlyRatedCount > 0) {
      setGoal(prev => {
        const currentCount = prev.history[todayStr] || 0;
        const newHistory = { ...prev.history, [todayStr]: currentCount + newlyRatedCount };

        let newStreak = prev.streak;
        if (prev.lastStudyDate !== todayStr) {
          newStreak += 1;
        }

        return {
          ...prev,
          streak: newStreak,
          lastStudyDate: todayStr,
          history: newHistory
        };
      });
    }

    if (!navigator.onLine) {
      wordIds.forEach(wordId => {
        addUpdateToSyncQueue({
          wordId,
          status,
          progressData: {
            status,
            updatedAt: timestamp,
            notes: progress[wordId]?.notes || '',
            bookmarks: progress[wordId]?.bookmarks || []
          },
          timestamp
        });
      });
      getQueuedSyncItems().then(items => {
        setPendingSyncCount(items.length);
        triggerBackgroundSync();
      });
    }
  };

  // Update personal Notes
  const handleUpdateNotes = (wordId: string, notes: string) => {
    const timestamp = new Date().toISOString();
    setProgress(prev => {
      const prevWord = prev[wordId] || { id: wordId, status: 'unrated', notes: '', bookmarks: [] };
      return {
        ...prev,
        [wordId]: {
          ...prevWord,
          notes,
          updatedAt: timestamp
        }
      };
    });

    if (!navigator.onLine) {
      addUpdateToSyncQueue({
        wordId,
        status: progress[wordId]?.status || 'unrated',
        progressData: {
          status: progress[wordId]?.status || 'unrated',
          updatedAt: timestamp,
          notes,
          bookmarks: progress[wordId]?.bookmarks || []
        },
        timestamp
      }).then(() => {
        getQueuedSyncItems().then(items => {
          setPendingSyncCount(items.length);
          triggerBackgroundSync();
        });
      });
    }
  };

  // Toggle Bookmark inside custom lists
  const handleToggleBookmark = (wordId: string, folderId: string) => {
    const timestamp = new Date().toISOString();
    setProgress(prev => {
      const prevWord = prev[wordId] || { id: wordId, status: 'unrated', notes: '', bookmarks: [] };
      const currentBookmarks = prevWord.bookmarks || [];
      const updatedBookmarks = currentBookmarks.includes(folderId)
        ? currentBookmarks.filter(id => id !== folderId)
        : [...currentBookmarks, folderId];

      const updatedProgressData = {
        ...prevWord,
        bookmarks: updatedBookmarks,
        updatedAt: timestamp
      };

      if (!navigator.onLine) {
        addUpdateToSyncQueue({
          wordId,
          status: prevWord.status,
          progressData: updatedProgressData,
          timestamp
        }).then(() => {
          getQueuedSyncItems().then(items => {
            setPendingSyncCount(items.length);
            triggerBackgroundSync();
          });
        });
      }

      return {
        ...prev,
        [wordId]: updatedProgressData
      };
    });
  };

  // Folder creator
  const handleCreateFolder = (name: string, color: string) => {
    setFolders(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name,
        color
      }
    ]);
  };

  // Folder Deleter
  const handleDeleteFolder = (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    // clean from word bookmarks
    setProgress(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(key => {
        if (copy[key].bookmarks) {
          copy[key].bookmarks = copy[key].bookmarks.filter(id => id !== folderId);
        }
      });
      return copy;
    });
  };

  // Remove word from folder list directly
  const handleRemoveFromFolder = (wordId: string, folderId: string) => {
    handleToggleBookmark(wordId, folderId);
  };

  // Launch folder focused flashcard session
  const handleLaunchFolderStudy = (folderId: string) => {
    setSelectedGroupFromDash(null);
    setActiveTab('flashcard');
  };

  // Update Synonym Checking progress
  const handleUpdateSynonymProgress = (wordId: string, correct: boolean) => {
    setSynonymProgress(prev => {
      return {
        ...prev,
        [wordId]: {
          correct,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  // Update Blank Filling progress
  const handleUpdateBlankProgress = (questionId: string, correct: boolean) => {
    setBlankProgress(prev => {
      return {
        ...prev,
        [questionId]: {
          correct,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  // Update Odd One Out progress
  const handleUpdateOooProgress = (questionId: string, correct: boolean) => {
    setOooProgress(prev => {
      return {
        ...prev,
        [questionId]: {
          correct,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  // Update Word Analogy progress
  const handleUpdateAnalogyProgress = (questionId: string, correct: boolean) => {
    setAnalogyProgress(prev => {
      return {
        ...prev,
        [questionId]: {
          correct,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  // Clear data function for reset/refresh study
  const handleClearAllProgress = () => {
    if (confirm('Are you sure you want to delete all your study progress and streaks? This action cannot be undone.')) {
      setProgress({});
      setGoal({
        dailyTarget: 15,
        streak: 1,
        lastStudyDate: new Date().toISOString().split('T')[0],
        history: {}
      });
      setSynonymProgress({});
      setBlankProgress({});
      setOooProgress({});
      setAnalogyProgress({});
      alert('All progress has been successfully deleted.');
    }
  };

  if (!user) {
    return (
      <LandingHomePage 
        onAuthSuccess={() => {
          setIsAuthModalOpen(false);
        }} 
        courses={allAvailableCourses} 
        onImportCourse={handleImportCourse}
        settings={settings}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 w-full max-w-full overflow-x-hidden" id="main-layout-stage">
      {/* Global User Announcement / Notice / Ad Banner */}
      <AnnouncementBanner settings={settings} />

      {/* Top Header / Main Banner (Unified for Mobile & Desktop) */}
      <header className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-4 md:px-8 md:py-5 flex items-center justify-between shadow-md flex-shrink-0" id="main-header-banner">
        <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
          <div className="p-2 md:p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-500/20 flex-shrink-0">
            <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-black tracking-tight font-sans text-white uppercase leading-none">
              Memorizer
            </h1>
            <p className="text-[10px] md:text-xs font-semibold text-emerald-400 mt-1 truncate max-w-[120px] sm:max-w-xs md:max-w-md" title={activeCourse?.title}>
              {activeCourse?.title || 'Default Course'}
            </p>
          </div>
        </div>

        {/* User Stats & Auth (Unified Header UI) */}
        <div className="flex items-center gap-1.5 md:gap-3.5 flex-shrink-0">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(prev => !prev)}
            className="p-1.5 md:p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/15 text-indigo-200 hover:text-white transition cursor-pointer flex items-center justify-center"
            title={darkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
            id="dark-mode-toggle"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-300" /> : <Moon className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300" />}
          </button>

          {user ? (
            <div className="flex items-center gap-2 md:gap-3 bg-white/5 border border-white/10 px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl">
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-[10px] md:text-xs border border-white/10 flex-shrink-0">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <div className="hidden sm:block text-left max-w-[120px] md:max-w-[150px]">
                <p className="text-[11px] md:text-xs font-extrabold text-white truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </p>
                <span className="text-[9px] md:text-[10px] text-indigo-200 font-bold block truncate">
                  {user.email}
                </span>
              </div>
              
              {/* Sync Status Info */}
              <div className="hidden md:flex items-center gap-1.5 bg-indigo-950/45 border border-indigo-500/15 px-2 py-1 rounded-lg text-[9px]">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus === 'synced' ? 'bg-emerald-400 animate-pulse' :
                  syncStatus === 'syncing' ? 'bg-indigo-400 animate-spin' :
                  syncStatus === 'error' ? 'bg-rose-400' : 'bg-slate-400'
                }`} />
                <span className="text-indigo-200 font-semibold">
                  {syncStatus === 'synced' && 'Synced'}
                  {syncStatus === 'syncing' && 'Syncing...'}
                  {syncStatus === 'error' && 'Sync Error'}
                  {syncStatus === 'idle' && 'Idle'}
                </span>
              </div>

              {/* Force Sync button */}
              <button
                onClick={forceSyncToCloud}
                className="text-[10px] text-indigo-200 hover:text-white font-extrabold cursor-pointer hover:underline bg-white/10 px-2 py-0.5 rounded-md transition"
                disabled={syncStatus === 'syncing' || !isOnline}
                title="Force Sync"
              >
                {syncStatus === 'syncing' ? '...' : 'Sync'}
              </button>

              <button
                onClick={handleLogOut}
                className="p-1 text-indigo-200 hover:text-rose-400 rounded-lg transition cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-[10px] md:text-xs font-extrabold px-3 py-2 md:px-4 md:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer shadow-md shadow-indigo-500/20"
            >
              Cloud Backup (Login)
            </button>
          )}
        </div>
      </header>

      {/* Unified Horizontal Menu Bar (Sits directly under the main banner) */}
      <div 
        ref={navContainerRef}
        className="bg-white border-b border-slate-200/60 overflow-x-auto flex items-center justify-center gap-1.5 md:gap-2.5 p-2 md:px-8 md:py-3 scrollbar-none flex-shrink-0 relative w-full" 
        id="horizontal-menu-navigation"
      >
        <button
          onClick={() => {
            setActiveTab('profile');
          }}
          data-active={['profile', 'dashboard', 'my_courses', 'flashcard'].includes(activeTab)}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            ['profile', 'dashboard', 'my_courses', 'flashcard'].includes(activeTab)
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <User className="w-4 h-4 text-amber-300" />
          <span>My Profile</span>
        </button>

        <button
          onClick={() => handleNavigateTab('revision')}
          data-active={activeTab === 'revision'}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'revision'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-emerald-400" />
          <span>Revision</span>
        </button>

        <button
          onClick={() => handleNavigateTab('leaderboard')}
          data-active={activeTab === 'leaderboard'}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'leaderboard'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="hidden md:inline">Leaderboard</span>
        </button>

        <button
          onClick={() => handleNavigateTab('practice')}
          data-active={['practice', 'synonym', 'quiz', 'match'].includes(activeTab)}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            ['practice', 'synonym', 'quiz', 'match'].includes(activeTab)
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span className="hidden md:inline">Games</span>
        </button>

        <button
          onClick={() => handleNavigateTab('study_tools')}
          data-active={['study_tools', 'dictionary', 'lists', 'planner', 'story'].includes(activeTab)}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            ['study_tools', 'dictionary', 'lists', 'planner', 'story'].includes(activeTab)
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden md:inline">Study Tools</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          data-active={activeTab === 'settings'}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/15'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="hidden md:inline">Settings</span>
        </button>

        {user && user.email && ['mohammad.001ekram@gmail.com'].includes(user.email.trim().toLowerCase()) && (
          <button
            onClick={() => setActiveTab('admin')}
            data-active={activeTab === 'admin'}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 p-2 md:px-4 md:py-2.5 rounded-xl transition cursor-pointer flex-shrink-0 text-xs font-bold border border-dashed border-rose-200 ${
              activeTab === 'admin'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/15 border-rose-500'
                : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
            }`}
          >
            <FolderLock className="w-4 h-4" />
            <span className="hidden md:inline">Admin Panel</span>
          </button>
        )}

        {/* App Meta Info */}
        <div className="hidden xl:flex items-center gap-1 text-[10px] text-slate-400 font-mono absolute right-6 pointer-events-none">
          <span>v2.5.0</span>
          <span>•</span>
          <span>{activeWords.length} Words ({activeCourseId.toUpperCase()})</span>
        </div>
      </div>

      {/* Mobile Swipe Toast Feedback */}
      {swipeToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-bounce sm:hidden">
          <div className="bg-slate-900/90 backdrop-blur-md text-white border border-indigo-500/30 px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold tracking-wide">
            {swipeToast.direction === 'right' && <ChevronLeft className="w-4 h-4 text-emerald-400 animate-pulse" />}
            <span className="text-indigo-200">Swiped to:</span>
            <span className="text-white font-black">{swipeToast.message}</span>
            {swipeToast.direction === 'left' && <ChevronRight className="w-4 h-4 text-emerald-400 animate-pulse" />}
          </div>
        </div>
      )}

      {/* No Course Toast Warning Banner */}
      {noCourseToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto max-w-md w-[92vw] animate-in fade-in slide-in-from-top-4 duration-300" style={{ fontFamily: "'Poppins', sans-serif" }}>
          <div className="bg-slate-900/95 text-white border-2 border-amber-500/60 p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 border border-amber-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-amber-100 leading-snug">
                {noCourseToast}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNoCourseToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg text-xs font-bold cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Workspace Layout */}
      <main 
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 w-full max-w-full touch-pan-y" 
        id="main-content-display"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-7xl mx-auto">
          {['profile', 'dashboard', 'my_courses', 'flashcard'].includes(activeTab) && (
            <div className="space-y-6">
              {/* My Profile Sub-Navigation Pills */}
              <div className="bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-center gap-1 sm:gap-2 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (enrolledCourseIds.length === 0) {
                      setNoCourseToast("You don't have any enrolled courses yet. Please enroll in a course to start learning!");
                      setActiveTab('profile');
                      setProfileSubTab('my_courses');
                    } else {
                      setActiveTab('profile');
                      setProfileSubTab('flashcard');
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-extrabold text-xs transition cursor-pointer ${
                    profileSubTab === 'flashcard'
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Flashcard</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('profile');
                    setProfileSubTab('my_courses');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-extrabold text-xs transition cursor-pointer ${
                    profileSubTab === 'my_courses'
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>My Courses</span>
                </button>
              </div>

              {/* Flashcard Sub-View with StatsDashboard underneath */}
              {profileSubTab === 'flashcard' && (
                enrolledCourseIds.length === 0 ? (
                  <div className="bg-slate-900/90 text-white border-2 border-amber-500/40 rounded-3xl p-8 text-center space-y-4 max-w-md mx-auto shadow-2xl my-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
                      <Lock className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-extrabold text-white">You don't have any enrolled courses yet!</h3>
                      <p className="text-xs text-slate-300 font-medium leading-relaxed">
                        Please enroll in or purchase a course from "My Courses" to access flashcards, vocabulary lists, and practice tools.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('profile');
                        setProfileSubTab('my_courses');
                      }}
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-lg shadow-indigo-500/25 border border-indigo-400/30 uppercase tracking-wider inline-flex items-center gap-2"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Go to My Courses & Enroll</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <FlashcardViewer
                      words={activeWords}
                      progress={progress}
                      folders={folders}
                      streak={goal.streak}
                      onRateWord={handleRateWord}
                      onUpdateNotes={handleUpdateNotes}
                      onToggleBookmark={handleToggleBookmark}
                      initialGroup={selectedGroupFromDash}
                      settings={settings}
                      onUpdateSettings={setSettings}
                      placeLabels={activeCourse?.placeLabels}
                      googleSearchQuery={activeCourse?.googleSearchQuery}
                      isRestrictedLocked={isRestrictedLocked}
                      freeFlashcardsCount={activeCourse?.freeFlashcardsCount}
                      coursePrice={activeCourse?.price}
                      courseTitle={activeCourse?.title}
                      onUnlockCourse={() => setProfileSubTab('my_courses')}
                    />

                    {/* Dashboard shown directly below Flashcard Setup */}
                    <div className="pt-4 border-t border-slate-200/60">
                      <StatsDashboard
                      user={user}
                      words={activeWords}
                      progress={progress}
                      goal={goal}
                      setGoal={setGoal}
                      allCourses={allAvailableCourses}
                      enrolledCourseIds={enrolledCourseIds}
                      activeCourseId={activeCourseId}
                      setActiveCourseId={setActiveCourseId}
                      setEnrolledCourseIds={setEnrolledCourseIds}
                      onImportCourse={handleImportCourse}
                      onRateWord={handleRateWord}
                      onBatchRateWords={handleBatchRateWords}
                      onSelectGroup={(gNum) => {
                        setSelectedGroupFromDash(gNum);
                        setProfileSubTab('flashcard');
                      }}
                      onSelectTab={(tab) => {
                        if (['flashcard', 'dashboard', 'my_courses'].includes(tab)) {
                          setProfileSubTab(tab as any);
                        } else {
                          setActiveTab(tab as ActiveTab);
                        }
                      }}
                      settings={settings}
                    />
                  </div>
                </div>
              ))}

              {/* Dashboard Sub-View */}
              {profileSubTab === 'dashboard' && (
                <StatsDashboard
                  user={user}
                  words={activeWords}
                  progress={progress}
                  goal={goal}
                  setGoal={setGoal}
                  allCourses={allAvailableCourses}
                  enrolledCourseIds={enrolledCourseIds}
                  activeCourseId={activeCourseId}
                  setActiveCourseId={setActiveCourseId}
                  setEnrolledCourseIds={setEnrolledCourseIds}
                  onImportCourse={handleImportCourse}
                  onRateWord={handleRateWord}
                  onBatchRateWords={handleBatchRateWords}
                  onSelectGroup={(gNum) => {
                    setSelectedGroupFromDash(gNum);
                    setProfileSubTab('flashcard');
                  }}
                  onSelectTab={(tab) => {
                    if (['flashcard', 'dashboard', 'my_courses'].includes(tab)) {
                      setProfileSubTab(tab as any);
                    } else {
                      setActiveTab(tab as ActiveTab);
                    }
                  }}
                  settings={settings}
                />
              )}

              {/* My Courses Sub-View */}
              {profileSubTab === 'my_courses' && (
                <MyCoursesView
                  user={user}
                  allCourses={allAvailableCourses}
                  enrolledCourseIds={enrolledCourseIds}
                  activeCourseId={activeCourseId}
                  setActiveCourseId={setActiveCourseId}
                  setEnrolledCourseIds={setEnrolledCourseIds}
                  progress={progress}
                  onImportCourse={handleImportCourse}
                  onSelectTab={(tab) => {
                    if (['flashcard', 'dashboard', 'my_courses'].includes(tab)) {
                      setProfileSubTab(tab as any);
                    } else {
                      setActiveTab(tab as ActiveTab);
                    }
                  }}
                />
              )}
            </div>
          )}

          {activeTab === 'revision' && (
            <RevisionCenter
              words={activeWords}
              progress={progress}
              folders={folders}
              streak={goal.streak}
              onRateWord={handleRateWord}
              onUpdateNotes={handleUpdateNotes}
              onToggleBookmark={handleToggleBookmark}
              settings={settings}
              onUpdateSettings={setSettings}
              placeLabels={activeCourse?.placeLabels}
              googleSearchQuery={activeCourse?.googleSearchQuery}
              isRestrictedLocked={isRestrictedLocked}
              freeFlashcardsCount={activeCourse?.freeFlashcardsCount}
              coursePrice={activeCourse?.price}
              courseTitle={activeCourse?.title}
              onUnlockCourse={() => {
                setActiveTab('profile');
                setProfileSubTab('my_courses');
              }}
            />
          )}

          {activeTab === 'leaderboard' && (
            <GlobalLeaderboard />
          )}

          {['practice', 'synonym', 'quiz', 'match'].includes(activeTab) && (
            <PracticeCenter
              words={activeWords}
              progress={progress}
              onRateWord={handleRateWord}
              onUpdateNotes={handleUpdateNotes}
              onToggleBookmark={handleToggleBookmark}
              folders={folders}
              synonymProgress={synonymProgress}
              onUpdateSynonymProgress={handleUpdateSynonymProgress}
              blankProgress={blankProgress}
              onUpdateBlankProgress={handleUpdateBlankProgress}
              oooProgress={oooProgress}
              onUpdateOooProgress={handleUpdateOooProgress}
              analogyProgress={analogyProgress}
              onUpdateAnalogyProgress={handleUpdateAnalogyProgress}
              activeGroup={selectedGroupFromDash}
              settings={settings}
              onQuizComplete={(score, totalQuestions) => {
                setQuizScore(prev => prev + score);
                setQuizTaken(prev => prev + 1);
              }}
              activeCourseId={activeCourseId}
              allCourses={allAvailableCourses}
              enabledGames={activeCourse?.enabledGames}
              placeLabels={activeCourse?.placeLabels}
              googleSearchQuery={activeCourse?.googleSearchQuery}
            />
          )}

          {['study_tools', 'dictionary', 'lists', 'planner', 'story'].includes(activeTab) && (
            <StudyToolsCenter
              words={activeWords}
              progress={progress}
              folders={folders}
              settings={settings}
              course={activeCourse}
              stories={activeCourse?.stories || []}
              enableStoryMode={activeCourse?.enabledGames?.story !== false}
              onRateWord={handleRateWord}
              onUpdateNotes={handleUpdateNotes}
              onToggleBookmark={handleToggleBookmark}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
              onRemoveFromFolder={handleRemoveFromFolder}
              onLaunchFolderStudy={handleLaunchFolderStudy}
              goal={goal}
              setGoal={setGoal}
              onOpenSettings={() => setActiveTab('admin')}
              onLaunchPractice={() => {
                setSelectedGroupFromDash(null);
                setActiveTab('flashcard');
              }}
              initialSubTab={activeTab === 'study_tools' ? 'hub' : (activeTab as any)}
            />
          )}

          {activeTab === 'settings' && (
            <AppSettingsView
              settings={settings}
              onUpdateSettings={setSettings}
              onClearAllProgress={handleClearAllProgress}
              userEmail={user?.email}
              syncStatus={syncStatus}
              onForceSync={forceSyncToCloud}
              syncLogs={syncLogs}
              allCourses={customCourses}
            />
          )}

          {activeTab === 'admin' && user && user.email && ['mohammad.001ekram@gmail.com'].includes(user.email.trim().toLowerCase()) && (
            <AdminPanel 
              words={activeWords} 
              settings={settings}
              onUpdateSettings={setSettings}
              onCoursesUpdated={async (updatedCourses) => {
                console.log('[App.tsx onCoursesUpdated] Invoked with updatedCourses count:', updatedCourses?.length);
                setCustomCourses(updatedCourses);
                safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(updatedCourses));

                // Verify user write access permission and persist courses data to Firestore DB via setDoc
                const adminEmails = ['mohammad.001ekram@gmail.com'];
                const userEmail = user?.email?.trim().toLowerCase();
                const hasWriteAccess = !!userEmail && (
                  adminEmails.includes(userEmail) || 
                  (settings.adminEmails && settings.adminEmails.map(e => e.trim().toLowerCase()).includes(userEmail))
                );

                if (hasWriteAccess && Array.isArray(updatedCourses) && updatedCourses.length > 0) {
                  try {
                    const batch = writeBatch(db);
                    let validCount = 0;
                    for (const course of updatedCourses) {
                      if (course && course.id) {
                        const courseRef = doc(db, 'courses', course.id);
                        batch.set(courseRef, course, { merge: true });
                        validCount++;
                      } else {
                        console.warn('[App.tsx onCoursesUpdated] Skipping invalid course item missing id:', course);
                      }
                    }
                    if (validCount > 0) {
                      await batch.commit();
                      console.log(`[App.tsx onCoursesUpdated] Atomically persisted ${validCount} course(s) to Firestore using writeBatch.`);
                    }
                  } catch (err) {
                    console.error('[App.tsx onCoursesUpdated] Error persisting course data to Firestore:', err);
                  }
                } else {
                  console.warn('[App.tsx onCoursesUpdated] Write access permission check failed or no updated courses provided.', {
                    userEmail,
                    hasWriteAccess,
                    updatedCoursesCount: updatedCourses?.length
                  });
                }
              }}
            />
          )}
        </div>
      </main>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onAuthSuccess={() => {}}
      />

      <SyncConflictModal
        isOpen={isConflictModalOpen}
        conflictData={conflictModalData}
        onClose={() => setIsConflictModalOpen(false)}
        onKeepLocal={async () => {
          setIsConflictModalOpen(false);
          await forceSyncToCloud();
          addSyncLog('manual', 'Resolved Conflict: Device local state pushed to Cloud', 'success');
        }}
        onUseServer={() => {
          if (!conflictModalData?.cloudRawData) return;
          const data = conflictModalData.cloudRawData;
          setIsConflictModalOpen(false);
          if (data.progress) setProgress(data.progress);
          if (Array.isArray(data.folders)) setFolders(data.folders);
          if (data.goal) setGoal(data.goal);
          addSyncLog('cloud_fetch', 'Resolved Conflict: Replaced local device with Cloud Backup', 'success');
        }}
        onMergeBoth={async () => {
          if (!conflictModalData?.cloudRawData) return;
          const data = conflictModalData.cloudRawData;
          setIsConflictModalOpen(false);
          const cloudProg = (data.progress && typeof data.progress === 'object') ? data.progress : {};
          const merged = { ...cloudProg };
          Object.keys(progress).forEach(wordId => {
            if (!merged[wordId]) {
              merged[wordId] = progress[wordId];
            } else {
              const localTime = new Date(progress[wordId].updatedAt || 0).getTime();
              const cloudTime = new Date(merged[wordId].updatedAt || 0).getTime();
              if (localTime >= cloudTime) {
                merged[wordId] = progress[wordId];
              }
            }
          });
          setProgress(merged);
          if (user) {
            try {
              await setDoc(doc(db, 'users', user.uid), {
                progress: merged,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            } catch (e) {}
          }
          addSyncLog('manual', 'Resolved Conflict: Merged local & cloud progress', 'success');
        }}
      />
    </div>
  );
}
