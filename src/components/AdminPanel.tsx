import React, { useState, useEffect, useMemo } from 'react';
import { parseRoute, syncAdminRouteUrl } from '../lib/router';
import { 
  db, 
  auth,
  doc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  getDoc,
  query,
  where,
  saveBulkDocs,
  incrementCourseClickCount,
  onSnapshot,
  clearCollectionDocs,
  runTransaction,
  writeBatch,
  clearQuestionsCache,
  deleteBulkDocs
} from '../lib/db';
import { VocabularyWord, UserProgress, Course, AccessRequest, BlankQuestion, OddOneOutQuestion, WordAnalogyQuestion, CustomMcqQuestion, AppSettings, VerifiedPayment, ExamQuestion, Exam, StoryItem, ArticleItem } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from '../lib/storage';
import { read, utils } from 'xlsx';
import { 
  parseBlankExcel, 
  parseOooExcel, 
  parseAnalogyExcel, 
  parseMcqExcel, 
  parseMultiSheetGamesExcel,
  downloadBlankExcelTemplate,
  downloadOooExcelTemplate,
  downloadAnalogyExcelTemplate,
  downloadMcqExcelTemplate,
  downloadExamExcelTemplate,
  downloadAllGamesMultiSheetTemplate 
} from '../lib/gameExcelUtils';
import { 
  parseStoriesFromFile, 
  parseStoriesFromRawText, 
  parseArticlesFromFile, 
  parseArticlesFromRawText 
} from '../utils/storyParser';
import { CourseSettings } from './CourseSettings';
import TransactionHistoryView from './TransactionHistoryView';
import LandingPageEditor from './LandingPageEditor';
import { vocabulary } from '../data/vocabulary';
import { logAdminActivity } from '../lib/activityLogger';
import { BulkCsvStudentModal } from './BulkCsvStudentModal';
import { ActivityLogsView } from './ActivityLogsView';
import { QuestionBankView } from './QuestionBankView';
import { CourseExamsSummaryView } from './CourseExamsSummaryView';
import { SupabaseRlsModal } from './SupabaseRlsModal';
import { TransactionDebugger, TransactionLogItem } from './TransactionDebugger';
import SupabaseMigrationCenter from './SupabaseMigrationCenter';
import SupabaseStatusBanner from './SupabaseStatusBanner';
import { Code, Bug, TerminalSquare, AlertCircle, Cloud } from 'lucide-react';
import { 
  Users, 
  ShieldCheck, 
  Search, 
  ChevronRight, 
  Calendar, 
  Flame, 
  TrendingUp, 
  Award, 
  Trophy,
  Info, 
  RefreshCw, 
  Database, 
  HeartCrack, 
  User as UserIcon,
  Filter, 
  X, 
  CheckCircle, 
  CheckCircle2,
  Loader2,
  AlertTriangle, 
  XCircle, 
  Copy, 
  Clock, 
  Sliders,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  FileSpreadsheet,
  Trash2,
  PlusCircle,
  Plus,
  Save,
  BookOpen,
  Edit,
  Lock,
  Layers,
  Globe,
  Gamepad2,
  DollarSign,
  Zap,
  Wallet,
  CreditCard,
  Megaphone,
  Bell,
  Headphones,
  MessageSquare,
  Share2,
  Send,
  Mail,
  MousePointerClick,
  ArrowUpDown,
  SortAsc,
  Eye,
  EyeOff,
  History,
  HelpCircle,
  Shuffle,
  GraduationCap,
  LayoutTemplate,
  Newspaper
} from 'lucide-react';

interface FirestoreUserDoc {
  id: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
  progress?: Record<string, UserProgress>;
  goal?: {
    dailyTarget?: number;
    streak?: number;
    lastStudyDate?: string;
    history?: Record<string, any>;
  };
  synonymProgress?: Record<string, { correct: boolean; updatedAt: string }>;
  settings?: any;
  enrolledCourseIds?: string[];
  walletBalance?: number;
}

// Helper to calculate enrolled courses for a given user doc
function getUserEnrolledCoursesList(
  u: FirestoreUserDoc,
  allCourses: Course[],
  accessRequestsList: AccessRequest[]
): Course[] {
  const cleanEmail = (u.email || '').trim().toLowerCase();
  const enrolledMap = new Map<string, Course>();

  // 1. Default or free courses
  allCourses.forEach(c => {
    if (c.isDefault || c.price === 0) {
      enrolledMap.set(c.id.trim().toLowerCase(), c);
    }
  });

  // 2. User's enrolledCourseIds from Firestore doc
  if (Array.isArray(u.enrolledCourseIds)) {
    u.enrolledCourseIds.forEach(id => {
      const match = allCourses.find(c => c.id.trim().toLowerCase() === id.trim().toLowerCase());
      if (match) {
        enrolledMap.set(match.id.trim().toLowerCase(), match);
      }
    });
  }

  // 3. Course allowedUsers includes email
  allCourses.forEach(c => {
    if (Array.isArray(c.allowedUsers) && c.allowedUsers.some(au => typeof au === 'string' && au.trim().toLowerCase() === cleanEmail)) {
      enrolledMap.set(c.id.trim().toLowerCase(), c);
    }
  });

  // 4. Approved access_requests
  if (cleanEmail) {
    accessRequestsList.forEach(req => {
      const reqEmail = (req.email || '').trim().toLowerCase();
      if (reqEmail === cleanEmail && req.status === 'approved') {
        if (req.courseId && req.courseId !== 'wallet_recharge' && req.courseId !== 'multi_cart') {
          const match = allCourses.find(c => c.id.trim().toLowerCase() === req.courseId.trim().toLowerCase());
          if (match) enrolledMap.set(match.id.trim().toLowerCase(), match);
        }
        if (Array.isArray(req.courseIds)) {
          req.courseIds.forEach(cid => {
            if (cid && cid !== 'wallet_recharge' && cid !== 'multi_cart') {
              const match = allCourses.find(c => c.id.trim().toLowerCase() === cid.trim().toLowerCase());
              if (match) enrolledMap.set(match.id.trim().toLowerCase(), match);
            }
          });
        }
      }
    });
  }

  const result = Array.from(enrolledMap.values());
  if (result.length === 0) {
    const defaultCourse = allCourses.find(c => c.isDefault || c.id === 'gre');
    if (defaultCourse) result.push(defaultCourse);
  }
  return result;
}

// Helper to calculate course specific progress stats for a user
function getUserCourseProgressStats(
  u: FirestoreUserDoc,
  course: Course,
  allWords: VocabularyWord[]
) {
  const courseWords = (course.words && course.words.length > 0)
    ? course.words
    : (course.id.trim().toLowerCase() === 'gre' || course.isDefault ? allWords : []);

  const totalWords = courseWords.length > 0
    ? courseWords.length
    : ((course.totalGroups || 37) * 30);

  let knowCount = 0;
  let confusionCount = 0;
  let dontKnowCount = 0;

  if (courseWords.length > 0) {
    courseWords.forEach(w => {
      const status = u.progress?.[w.id]?.status;
      if (status === 'know') knowCount++;
      else if (status === 'confusion') confusionCount++;
      else if (status === 'dont_know') dontKnowCount++;
    });
  } else {
    const progEntries = Object.values(u.progress || {});
    knowCount = progEntries.filter(p => p.status === 'know').length;
    confusionCount = progEntries.filter(p => p.status === 'confusion').length;
    dontKnowCount = progEntries.filter(p => p.status === 'dont_know').length;
  }

  const unstudiedCount = Math.max(0, totalWords - (knowCount + confusionCount + dontKnowCount));
  const progressPercent = totalWords > 0 ? Math.round((knowCount / totalWords) * 100) : 0;

  return {
    totalWords,
    knowCount,
    confusionCount,
    dontKnowCount,
    unstudiedCount,
    progressPercent
  };
}

// Helper to calculate overall user stats and rank across all users
function getUserOverallStatsAndRank(
  u: FirestoreUserDoc,
  allUsersList: FirestoreUserDoc[],
  allCourses: Course[],
  accessRequestsList: AccessRequest[],
  allWords: VocabularyWord[]
) {
  const getRankScore = (userDoc: FirestoreUserDoc) => {
    const progValues = Object.values(userDoc.progress || {});
    const know = progValues.filter(p => p.status === 'know').length;
    const streak = userDoc.goal?.streak || 0;
    const evaluated = progValues.length;
    return { know, streak, evaluated };
  };

  const sortedUsers = [...allUsersList].sort((a, b) => {
    const scoreA = getRankScore(a);
    const scoreB = getRankScore(b);
    if (scoreB.know !== scoreA.know) return scoreB.know - scoreA.know;
    if (scoreB.streak !== scoreA.streak) return scoreB.streak - scoreA.streak;
    return scoreB.evaluated - scoreA.evaluated;
  });

  const rankIndex = sortedUsers.findIndex(usr => (usr.id === u.id) || (usr.email && usr.email.toLowerCase() === u.email.toLowerCase()));
  const rank = rankIndex >= 0 ? rankIndex + 1 : sortedUsers.length || 1;

  const enrolledCourses = getUserEnrolledCoursesList(u, allCourses, accessRequestsList);

  let totalTargetWords = 0;
  let totalKnow = 0;
  let totalConfusion = 0;
  let totalDontKnow = 0;

  enrolledCourses.forEach(c => {
    const cStats = getUserCourseProgressStats(u, c, allWords);
    totalTargetWords += cStats.totalWords;
    totalKnow += cStats.knowCount;
    totalConfusion += cStats.confusionCount;
    totalDontKnow += cStats.dontKnowCount;
  });

  if (totalTargetWords === 0) {
    totalTargetWords = allWords.length || vocabulary.length;
  }

  const overallPercent = Math.round((totalKnow / totalTargetWords) * 100) || 0;

  return {
    rank,
    totalUsers: allUsersList.length || 1,
    enrolledCourses,
    totalTargetWords,
    totalKnow,
    totalConfusion,
    totalDontKnow,
    overallPercent
  };
}

interface AdminPanelProps {
  words: VocabularyWord[];
  settings?: AppSettings;
  onUpdateSettings?: (settings: AppSettings) => void;
  onCoursesUpdated?: (updatedCourses: Course[]) => void;
}

enum OperationType {
  LIST = 'list',
  GET = 'get',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: (auth.currentUser as any)?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function getProgressValues(progObj: Record<string, UserProgress> | undefined): UserProgress[] {
  return Object.values(progObj || {}) as UserProgress[];
}

function getProgressEntries(progObj: Record<string, UserProgress> | undefined): [string, UserProgress][] {
  return Object.entries(progObj || {}) as [string, UserProgress][];
}

export default function AdminPanel({ words, settings, onUpdateSettings, onCoursesUpdated }: AdminPanelProps) {
  const [users, setUsers] = useState<FirestoreUserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'email' | 'streak' | 'progress' | 'lastActive'>('lastActive');
  const [selectedUser, setSelectedUser] = useState<FirestoreUserDoc | null>(null);
  const [activeUserTab, setActiveUserTab] = useState<'enrolled' | 'progress' | 'analytics' | 'settings'>('enrolled');
  const [activeWordFilter, setActiveWordFilter] = useState<'all' | 'know' | 'confusion' | 'dont_know'>('all');

  // Course management and upload states — initialized from the URL
  // (/admin/:tab) so each admin section is directly linkable/shareable
  // and survives a refresh, instead of always resetting to 'courses'.
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'courses' | 'reports' | 'access-requests' | 'system-settings' | 'landing-editor' | 'blank-questions' | 'activity-logs' | 'transaction-debugger' | 'question-bank' | 'exam-summary' | 'migration'>(
    () => parseRoute().adminTab || 'courses'
  );

  // Keep the URL in sync with the active admin section, and vice versa for
  // browser back/forward — self-contained here since activeAdminTab lives
  // entirely inside this component, not in App.tsx's top-level route state.
  useEffect(() => {
    syncAdminRouteUrl(activeAdminTab);
  }, [activeAdminTab]);

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRoute(window.location.pathname);
      if (parsed.tab === 'admin' && parsed.adminTab) {
        setActiveAdminTab(parsed.adminTab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [requestsSubTab, setRequestsSubTab] = useState<'pending' | 'autoverify' | 'history' | 'debugger'>('pending');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [bulkCsvCourse, setBulkCsvCourse] = useState<Course | null>(null);
  const [showSupabaseRlsModal, setShowSupabaseRlsModal] = useState(false);

  // Transaction Debugger Logs state
  const [transactionLogs, setTransactionLogs] = useState<TransactionLogItem[]>(() => {
    try {
      const saved = localStorage.getItem('admin_tx_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addTransactionLog = (item: TransactionLogItem) => {
    setTransactionLogs(prev => {
      const updated = [item, ...prev].slice(0, 100);
      try {
        localStorage.setItem('admin_tx_logs', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const handleClearTransactionLogs = () => {
    setTransactionLogs([]);
    try {
      localStorage.removeItem('admin_tx_logs');
    } catch (_) {}
    showToast('Transaction logs cleared', 'info');
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.text === text ? null : prev);
    }, 4500);
  };
  const [customCourses, setCustomCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [hasFetchedCourses, setHasFetchedCourses] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [courseSortMode, setCourseSortMode] = useState<'clickFrequency' | 'manualOrder'>('clickFrequency');
  const [coursePage, setCoursePage] = useState<number>(1);
  const [coursePerPage, setCoursePerPage] = useState<number>(8);

  // Pagination for Users & Requests
  const [userPage, setUserPage] = useState<number>(1);
  const [userPerPage, setUserPerPage] = useState<number>(12);
  const [reqPage, setReqPage] = useState<number>(1);
  const [reqPerPage, setReqPerPage] = useState<number>(10);

  // Pending Access Requests Expiry Inputs state
  const [requestExpiryDates, setRequestExpiryDates] = useState<Record<string, string>>({});

  // Global bKash Auto-Verification Gateway state
  const [globalVerifiedPayments, setGlobalVerifiedPayments] = useState<{ bkashNumber: string; trxId: string; amount?: number; createdAt?: string }[]>([]);
  const [globalVpLoading, setGlobalVpLoading] = useState(false);
  const [newGlobalVpNumber, setNewGlobalVpNumber] = useState('');
  const [newGlobalVpTrxId, setNewGlobalVpTrxId] = useState('');
  const [newGlobalVpAmount, setNewGlobalVpAmount] = useState<number>(75);
  const [globalVpSearch, setGlobalVpSearch] = useState('');
  const [globalVpPasteInput, setGlobalVpPasteInput] = useState('');
  const [isAutoVerifyingAll, setIsAutoVerifyingAll] = useState(false);
  const [autoVerifyResultMessage, setAutoVerifyResultMessage] = useState<string | null>(null);

  // Synchronous Diagnostic Verification Check: Verify current user email against admin list before performing writes
  const currentAuthUser = auth.currentUser;
  const currentAuthEmail = currentAuthUser?.email?.trim().toLowerCase() || '';
  const hardcodedAdminsList = ['mohammad.001ekram@gmail.com'];
  const settingsAdminsList = Array.isArray((settings as any)?.adminEmails)
    ? (settings as any).adminEmails.map((e: string) => e.trim().toLowerCase())
    : [];
  const isAuthorizedAdminSync = !!currentAuthEmail && (
    hardcodedAdminsList.includes(currentAuthEmail) || 
    settingsAdminsList.includes(currentAuthEmail)
  );

  const userPermissionDebug = () => {
    const debugData = {
      userId: currentAuthUser?.uid || 'no-auth-uid',
      userEmail: currentAuthEmail,
      isAdmin: isAuthorizedAdminSync,
      hardcodedAdminMatch: hardcodedAdminsList.includes(currentAuthEmail),
      settingsAdminMatch: settingsAdminsList.includes(currentAuthEmail),
      provider: currentAuthUser?.providerData?.[0]?.providerId || 'unknown'
    };
    console.log('🛡️ [userPermissionDebug] AdminPanel Entry Check:', debugData);
    return debugData;
  };

  useEffect(() => {
    userPermissionDebug();
  }, [currentAuthEmail, isAuthorizedAdminSync]);

  useEffect(() => {
    if (onCoursesUpdated && hasFetchedCourses) {
      onCoursesUpdated(customCourses);
    }
  }, [customCourses, hasFetchedCourses, onCoursesUpdated]);

  // New course form states
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseId, setNewCourseId] = useState('');
  const [isSlugTouched, setIsSlugTouched] = useState(false);
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [uploadedWords, setUploadedWords] = useState<VocabularyWord[]>([]);
  const [parsedPlaceLabels, setParsedPlaceLabels] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [creationMethod, setCreationMethod] = useState<'excel' | 'paste'>('excel');
  const [pasteInputText, setPasteInputText] = useState('');

  // Multi-sheet and game excel upload state with visual loading & buffering fix
  const [selectedGameCourseId, setSelectedGameCourseId] = useState<string>('');
  const [isUploadingMultiSheet, setIsUploadingMultiSheet] = useState(false);
  const [multiSheetUploadProgress, setMultiSheetUploadProgress] = useState<number>(0);
  const [multiSheetStatusMessage, setMultiSheetStatusMessage] = useState<string>('');
  const [multiSheetSuccessMessage, setMultiSheetSuccessMessage] = useState<string | null>(null);

  // Course access and default settings states
  const [newCourseIsDefault, setNewCourseIsDefault] = useState(false);
  const [newCourseIsRestricted, setNewCourseIsRestricted] = useState(false);
  const [newCourseAllowedUsersText, setNewCourseAllowedUsersText] = useState('');
  const [newCourseOrder, setNewCourseOrder] = useState<number>(1);

  // Editing course states
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseSettingsInitialTab, setCourseSettingsInitialTab] = useState<'general' | 'variables' | 'access' | 'students' | 'wordlist' | 'addwords' | 'verification' | 'blank-questions' | undefined>(undefined);
  const [courseSettingsInitialEditWordName, setCourseSettingsInitialEditWordName] = useState<string | undefined>(undefined);

  // Access requests states
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [accessRequestsLoading, setAccessRequestsLoading] = useState(false);
  const [selectedActionRequest, setSelectedActionRequest] = useState<AccessRequest | null>(null);
  const [actionBalanceInput, setActionBalanceInput] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Blank questions states
  const [gameUploadSubTab, setGameUploadSubTab] = useState<'multi' | 'blank' | 'ooo' | 'analogy' | 'mcq' | 'story' | 'article'>('multi');
  const [blankQuestions, setBlankQuestions] = useState<BlankQuestion[]>([]);
  const [blankQuestionsLoading, setBlankQuestionsLoading] = useState(false);
  const [blankQuestionsError, setBlankQuestionsError] = useState<string | null>(null);

  const [newSentence, setNewSentence] = useState('');
  const [newOpt1, setNewOpt1] = useState('');
  const [newOpt2, setNewOpt2] = useState('');
  const [newOpt3, setNewOpt3] = useState('');
  const [newOpt4, setNewOpt4] = useState('');
  const [newCorrectIndex, setNewCorrectIndex] = useState<number>(0);

  const [excelQuestionsPreview, setExcelQuestionsPreview] = useState<BlankQuestion[]>([]);
  const [excelUploadError, setExcelUploadError] = useState<string | null>(null);
  const [excelSaveStatus, setExcelSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- OOO (ODD ONE OUT) QUESTIONS STATES ---
  const [oooQuestions, setOooQuestions] = useState<OddOneOutQuestion[]>([]);
  const [oooQuestionsLoading, setOooQuestionsLoading] = useState(false);
  const [newOooWords, setNewOooWords] = useState<string[]>(['', '', '', '']);
  const [newOooCorrectIndex, setNewOooCorrectIndex] = useState<number>(0);
  const [newOooReason, setNewOooReason] = useState('');
  const [excelOooPreview, setExcelOooPreview] = useState<OddOneOutQuestion[]>([]);
  const [excelOooUploadError, setExcelOooUploadError] = useState<string | null>(null);
  const [excelOooSaveStatus, setExcelOooSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- ANALOGY QUESTIONS STATES ---
  const [analogyQuestions, setAnalogyQuestions] = useState<WordAnalogyQuestion[]>([]);
  const [analogyQuestionsLoading, setAnalogyQuestionsLoading] = useState(false);
  const [newAnalogy, setNewAnalogy] = useState('');
  const [newAnalogyOpts, setNewAnalogyOpts] = useState<string[]>(['', '', '', '']);
  const [newAnalogyCorrectIndex, setNewAnalogyCorrectIndex] = useState<number>(0);
  const [newAnalogyExplanation, setNewAnalogyExplanation] = useState('');
  const [excelAnalogyPreview, setExcelAnalogyPreview] = useState<WordAnalogyQuestion[]>([]);
  const [excelAnalogyUploadError, setExcelAnalogyUploadError] = useState<string | null>(null);
  const [excelAnalogySaveStatus, setExcelAnalogySaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- MCQ QUESTIONS STATES ---
  const [mcqQuestions, setMcqQuestions] = useState<CustomMcqQuestion[]>([]);
  const [mcqQuestionsLoading, setMcqQuestionsLoading] = useState(false);
  const [newMcqQuestion, setNewMcqQuestion] = useState('');
  const [newMcqOpts, setNewMcqOpts] = useState<string[]>(['', '', '', '']);
  const [newMcqCorrectIndex, setNewMcqCorrectIndex] = useState<number>(0);
  const [newMcqExplanation, setNewMcqExplanation] = useState('');
  const [excelMcqPreview, setExcelMcqPreview] = useState<CustomMcqQuestion[]>([]);
  const [excelMcqUploadError, setExcelMcqUploadError] = useState<string | null>(null);
  const [excelMcqNotice, setExcelMcqNotice] = useState<string[] | null>(null);
  const [excelMcqSaveStatus, setExcelMcqSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- STORY UPLOAD STATES ---
  const [storyUploadLoading, setStoryUploadLoading] = useState(false);
  const [storyUploadError, setStoryUploadError] = useState<string | null>(null);
  const [storySaveStatus, setStorySaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pastedStoryText, setPastedStoryText] = useState('');
  const [manualStoryTitle, setManualStoryTitle] = useState('');
  const [manualStoryContent, setManualStoryContent] = useState('');

  // --- ARTICLE UPLOAD STATES ---
  const [articleUploadLoading, setArticleUploadLoading] = useState(false);
  const [articleUploadError, setArticleUploadError] = useState<string | null>(null);
  const [articleSaveStatus, setArticleSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pastedArticleText, setPastedArticleText] = useState('');
  const [manualArticleTitle, setManualArticleTitle] = useState('');
  const [manualArticleContent, setManualArticleContent] = useState('');
  const [manualArticleCategory, setManualArticleCategory] = useState('Vocabulary Reading');
  const [manualArticleAuthor, setManualArticleAuthor] = useState('Course Educator');
  const [manualArticleReadTime, setManualArticleReadTime] = useState('4 min read');
  const [manualArticleExcerpt, setManualArticleExcerpt] = useState('');

  const fetchBlankQuestions = async (courseId?: string) => {
    setBlankQuestionsLoading(true);
    setBlankQuestionsError(null);
    try {
      const qSnap = await getDocs(collection(db, 'blank_questions'));
      const list: BlankQuestion[] = [];
      const targetId = courseId !== undefined ? courseId : selectedGameCourseId;
      qSnap.forEach(docSnap => {
        const data = docSnap.data() as BlankQuestion;
        if (!targetId || !data.courseId || data.courseId === targetId) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setBlankQuestions(list);
    } catch (err) {
      console.error('Error fetching blank questions:', err);
      setBlankQuestionsError('Failed to load blank questions.');
    } finally {
      setBlankQuestionsLoading(false);
    }
  };

  const fetchOooQuestions = async (courseId?: string) => {
    setOooQuestionsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'odd_one_out_questions'));
      const list: OddOneOutQuestion[] = [];
      const targetId = courseId !== undefined ? courseId : selectedGameCourseId;
      qSnap.forEach(docSnap => {
        const data = docSnap.data() as OddOneOutQuestion;
        if (!targetId || !data.courseId || data.courseId === targetId) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setOooQuestions(list);
    } catch (err) {
      console.error('Error fetching OOO questions:', err);
    } finally {
      setOooQuestionsLoading(false);
    }
  };

  const fetchAnalogyQuestions = async (courseId?: string) => {
    setAnalogyQuestionsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'word_analogy_questions'));
      const list: WordAnalogyQuestion[] = [];
      const targetId = courseId !== undefined ? courseId : selectedGameCourseId;
      qSnap.forEach(docSnap => {
        const data = docSnap.data() as WordAnalogyQuestion;
        if (!targetId || !data.courseId || data.courseId === targetId) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setAnalogyQuestions(list);
    } catch (err) {
      console.error('Error fetching analogy questions:', err);
    } finally {
      setAnalogyQuestionsLoading(false);
    }
  };

  const fetchMcqQuestions = async (courseId?: string) => {
    setMcqQuestionsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'mcq_questions'));
      const list: CustomMcqQuestion[] = [];
      const targetId = courseId !== undefined ? courseId : selectedGameCourseId;
      qSnap.forEach(docSnap => {
        const data = docSnap.data() as CustomMcqQuestion;
        if (!targetId || !data.courseId || data.courseId === targetId) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setMcqQuestions(list);
    } catch (err) {
      console.error('Error fetching MCQ questions:', err);
    } finally {
      setMcqQuestionsLoading(false);
    }
  };

  const handleUploadBlankExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelUploadError(null);
    setExcelQuestionsPreview([]);
    
    try {
      const { questions, notices } = await parseBlankExcel(file, selectedGameCourseId || undefined);
      if (questions.length === 0) {
        setExcelUploadError(notices[0] || 'No valid questions found. Ensure one of the option columns contains a "#" to indicate the correct answer.');
      } else {
        setExcelQuestionsPreview(questions);
      }
    } catch (err) {
      console.error('Error parsing blank excel:', err);
      setExcelUploadError('Failed to parse Excel file. Make sure it is a valid .xlsx file.');
    }
  };

  const handleSaveBlankExcelQuestions = async () => {
    if (excelQuestionsPreview.length === 0) return;
    setExcelSaveStatus('saving');
    try {
      const listToSave = excelQuestionsPreview.map(q => ({
        ...q,
        courseId: selectedGameCourseId || q.courseId || ''
      }));
      await saveBulkDocs('blank_questions', listToSave);
      clearQuestionsCache('blank_questions', selectedGameCourseId);
      setExcelSaveStatus('saved');
      setExcelQuestionsPreview([]);
      fetchBlankQuestions();
      setTimeout(() => setExcelSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Error saving blank questions:', err);
      setExcelSaveStatus('error');
    }
  };

  const handleManualAddBlankQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSentence.trim() || !newOpt1.trim() || !newOpt2.trim() || !newOpt3.trim() || !newOpt4.trim()) {
      alert('Please fill out the sentence and all 4 options.');
      return;
    }
    const rawOpts = [newOpt1.trim(), newOpt2.trim(), newOpt3.trim(), newOpt4.trim()];
    const answer = rawOpts[newCorrectIndex];
    const newQ: BlankQuestion = {
      id: `bq-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      sentence: newSentence.trim(),
      options: rawOpts,
      answer,
      courseId: selectedGameCourseId || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'blank_questions', newQ.id), newQ);
      clearQuestionsCache('blank_questions', selectedGameCourseId);
      setNewSentence('');
      setNewOpt1('');
      setNewOpt2('');
      setNewOpt3('');
      setNewOpt4('');
      setNewCorrectIndex(0);
      fetchBlankQuestions();
      alert('Question added successfully!');
    } catch (err) {
      console.error('Error adding question manually:', err);
      alert('Failed to add question.');
    }
  };

  const handleDeleteBlankQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteDoc(doc(db, 'blank_questions', id));
      clearQuestionsCache('blank_questions', selectedGameCourseId);
      setBlankQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting blank question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteBlankQuestions = async () => {
    if (blankQuestions.length === 0) {
      alert('No blank questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${blankQuestions.length} Blank Filling questions? This action is permanent.`)) return;
    setBlankQuestionsLoading(true);
    try {
      const ids = blankQuestions.map(q => q.id);
      await deleteBulkDocs('blank_questions', ids);
      clearQuestionsCache('blank_questions', selectedGameCourseId);
      setBlankQuestions([]);
      alert('All Blank Filling questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting blank questions:', err);
      alert('Failed to delete questions.');
    } finally {
      setBlankQuestionsLoading(false);
      fetchBlankQuestions();
    }
  };

  // --- OOO HANDLERS ---
  const handleUploadOooExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelOooUploadError(null);
    setExcelOooPreview([]);

    try {
      const { questions, notices } = await parseOooExcel(file, selectedGameCourseId || undefined);
      if (questions.length === 0) {
        setExcelOooUploadError(notices[0] || 'No valid Odd One Out questions found in the selected Excel file.');
      } else {
        setExcelOooPreview(questions);
      }
    } catch (err) {
      console.error('Error parsing OOO excel:', err);
      setExcelOooUploadError('Failed to parse Excel file.');
    }
  };

  const handleSaveOooExcelQuestions = async () => {
    if (excelOooPreview.length === 0) return;
    setExcelOooSaveStatus('saving');
    try {
      const updatedList = excelOooPreview.map(q => ({
        ...q,
        courseId: selectedGameCourseId || q.courseId || ''
      }));
      await saveBulkDocs('odd_one_out_questions', updatedList);
      clearQuestionsCache('odd_one_out_questions', selectedGameCourseId);
      setExcelOooSaveStatus('saved');
      setExcelOooPreview([]);
      fetchOooQuestions();
      setTimeout(() => setExcelOooSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Error saving OOO questions:', err);
      setExcelOooSaveStatus('error');
      setExcelOooUploadError(`Failed to save: ${err?.message || 'Error'}`);
    }
  };

  const handleManualAddOooQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOooWords.some(w => !w.trim())) {
      alert('Please fill out all 4 words.');
      return;
    }
    const rawWords = newOooWords.map(w => w.trim());
    const answer = rawWords[newOooCorrectIndex];
    const newQ: OddOneOutQuestion = {
      id: `ooo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      words: rawWords,
      answer,
      reason: newOooReason.trim(),
      courseId: selectedGameCourseId || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'odd_one_out_questions', newQ.id), newQ);
      clearQuestionsCache('odd_one_out_questions', selectedGameCourseId);
      setNewOooWords(['', '', '', '']);
      setNewOooCorrectIndex(0);
      setNewOooReason('');
      fetchOooQuestions();
      alert('Question added successfully!');
    } catch (err) {
      console.error('Error adding OOO question manually:', err);
      alert('Failed to add question.');
    }
  };

  const handleDeleteOooQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteDoc(doc(db, 'odd_one_out_questions', id));
      clearQuestionsCache('odd_one_out_questions', selectedGameCourseId);
      setOooQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting OOO question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteOooQuestions = async () => {
    if (oooQuestions.length === 0) {
      alert('No Odd One Out questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${oooQuestions.length} Odd One Out questions? This action is permanent.`)) return;
    setOooQuestionsLoading(true);
    try {
      const ids = oooQuestions.map(q => q.id);
      await deleteBulkDocs('odd_one_out_questions', ids);
      clearQuestionsCache('odd_one_out_questions', selectedGameCourseId);
      setOooQuestions([]);
      alert('All Odd One Out questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting OOO questions:', err);
      alert('Failed to delete questions.');
    } finally {
      setOooQuestionsLoading(false);
      fetchOooQuestions();
    }
  };

  // --- ANALOGY HANDLERS ---
  const handleUploadAnalogyExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelAnalogyUploadError(null);
    setExcelAnalogyPreview([]);

    try {
      const { questions, notices } = await parseAnalogyExcel(file, selectedGameCourseId || undefined);
      if (questions.length === 0) {
        setExcelAnalogyUploadError(notices[0] || 'No valid Word Analogy questions found in the selected Excel file.');
      } else {
        setExcelAnalogyPreview(questions);
      }
    } catch (err) {
      console.error('Error parsing analogy excel:', err);
      setExcelAnalogyUploadError('Failed to parse Excel file.');
    }
  };

  const handleSaveAnalogyExcelQuestions = async () => {
    if (excelAnalogyPreview.length === 0) return;
    setExcelAnalogySaveStatus('saving');
    try {
      const updatedList = excelAnalogyPreview.map(q => ({
        ...q,
        courseId: selectedGameCourseId || q.courseId || ''
      }));
      await saveBulkDocs('word_analogy_questions', updatedList);
      clearQuestionsCache('word_analogy_questions', selectedGameCourseId);
      setExcelAnalogySaveStatus('saved');
      setExcelAnalogyPreview([]);
      fetchAnalogyQuestions();
      setTimeout(() => setExcelAnalogySaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Error saving analogy questions:', err);
      setExcelAnalogySaveStatus('error');
      setExcelAnalogyUploadError(`Failed to save: ${err?.message || 'Error'}`);
    }
  };

  const handleManualAddAnalogyQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnalogy.trim() || newAnalogyOpts.some(o => !o.trim())) {
      alert('Please fill out the base analogy and all 4 options.');
      return;
    }
    const rawOpts = newAnalogyOpts.map(o => o.trim());
    const answer = rawOpts[newAnalogyCorrectIndex];
    const newQ: WordAnalogyQuestion = {
      id: `ana-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      analogy: newAnalogy.trim(),
      options: rawOpts,
      answer,
      explanation: newAnalogyExplanation.trim(),
      courseId: selectedGameCourseId || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'word_analogy_questions', newQ.id), newQ);
      clearQuestionsCache('word_analogy_questions', selectedGameCourseId);
      setNewAnalogy('');
      setNewAnalogyOpts(['', '', '', '']);
      setNewAnalogyCorrectIndex(0);
      setNewAnalogyExplanation('');
      fetchAnalogyQuestions();
      alert('Question added successfully!');
    } catch (err) {
      console.error('Error adding analogy question manually:', err);
      alert('Failed to add question.');
    }
  };

  const handleDeleteAnalogyQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteDoc(doc(db, 'word_analogy_questions', id));
      clearQuestionsCache('word_analogy_questions', selectedGameCourseId);
      setAnalogyQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting analogy question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteAnalogyQuestions = async () => {
    if (analogyQuestions.length === 0) {
      alert('No Word Analogy questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${analogyQuestions.length} Word Analogy questions? This action is permanent.`)) return;
    setAnalogyQuestionsLoading(true);
    try {
      const ids = analogyQuestions.map(q => q.id);
      await deleteBulkDocs('word_analogy_questions', ids);
      clearQuestionsCache('word_analogy_questions', selectedGameCourseId);
      setAnalogyQuestions([]);
      alert('All Word Analogy questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting analogy questions:', err);
      alert('Failed to delete questions.');
    } finally {
      setAnalogyQuestionsLoading(false);
      fetchAnalogyQuestions();
    }
  };

  // --- MCQ HANDLERS ---
  const handleUploadMcqExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelMcqUploadError(null);
    setExcelMcqNotice(null);
    setExcelMcqPreview([]);

    try {
      const { questions, notices } = await parseMcqExcel(file, selectedGameCourseId || undefined);
      if (notices.length > 0) {
        setExcelMcqNotice(notices);
      } else {
        setExcelMcqNotice(null);
      }

      if (questions.length === 0) {
        setExcelMcqUploadError('No valid MCQ questions parsed from the file.');
      } else {
        setExcelMcqPreview(questions);
      }
    } catch (err) {
      console.error('Error parsing MCQ excel:', err);
      setExcelMcqUploadError('Failed to parse file.');
    }
  };

  const handleSaveMcqExcelQuestions = async () => {
    if (excelMcqPreview.length === 0) return;
    setExcelMcqSaveStatus('saving');
    try {
      const updatedList = excelMcqPreview.map(q => ({
        ...q,
        courseId: selectedGameCourseId || q.courseId || ''
      }));
      await saveBulkDocs('mcq_questions', updatedList);
      clearQuestionsCache('mcq_questions', selectedGameCourseId);
      setExcelMcqSaveStatus('saved');
      setExcelMcqPreview([]);
      fetchMcqQuestions();
      setTimeout(() => setExcelMcqSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Error saving MCQ questions:', err);
      setExcelMcqSaveStatus('error');
      setExcelMcqUploadError(`Failed to save: ${err?.message || 'Error'}`);
    }
  };

  const handleManualAddMcqQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMcqQuestion.trim() || newMcqOpts.some(o => !o.trim())) {
      alert('Please fill out the question and all 4 options.');
      return;
    }
    const rawOpts = newMcqOpts.map(o => o.trim());
    const answer = rawOpts[newMcqCorrectIndex];
    const newQ: CustomMcqQuestion = {
      id: `mcq-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      question: newMcqQuestion.trim(),
      options: rawOpts,
      answer,
      explanation: newMcqExplanation.trim(),
      courseId: selectedGameCourseId || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'mcq_questions', newQ.id), newQ);
      clearQuestionsCache('mcq_questions', selectedGameCourseId);
      setNewMcqQuestion('');
      setNewMcqOpts(['', '', '', '']);
      setNewMcqCorrectIndex(0);
      setNewMcqExplanation('');
      fetchMcqQuestions();
      alert('MCQ question added successfully!');
    } catch (err) {
      console.error('Error adding MCQ question manually:', err);
      alert('Failed to add MCQ question.');
    }
  };

  const handleDeleteMcqQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteDoc(doc(db, 'mcq_questions', id));
      clearQuestionsCache('mcq_questions', selectedGameCourseId);
      setMcqQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting MCQ question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteMcqQuestions = async () => {
    if (mcqQuestions.length === 0) {
      alert('No MCQ questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${mcqQuestions.length} MCQ questions? This action is permanent.`)) return;
    setMcqQuestionsLoading(true);
    try {
      const ids = mcqQuestions.map(q => q.id);
      await deleteBulkDocs('mcq_questions', ids);
      clearQuestionsCache('mcq_questions', selectedGameCourseId);
      setMcqQuestions([]);
      alert('All MCQ questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting MCQ questions:', err);
      alert('Failed to delete questions.');
    } finally {
      setMcqQuestionsLoading(false);
      fetchMcqQuestions();
    }
  };

  // --- STORY UPLOAD & MANAGEMENT HANDLERS ---
  const handleSaveCourseStories = async (newStories: StoryItem[], mode: 'append' | 'replace' = 'append') => {
    if (!selectedGameCourseId) {
      setStoryUploadError('অনুগ্রহ করে প্রথমে ড্রপডাউন থেকে একটি কোর্স সিলেক্ট করুন।');
      return false;
    }
    setStorySaveStatus('saving');
    setStoryUploadError(null);
    try {
      const currentTargetCourse = customCourses.find(c => c.id === selectedGameCourseId);
      const existingStories = mode === 'replace' ? [] : (currentTargetCourse?.stories || []);
      const mergedStories = [...existingStories, ...newStories];

      const courseRef = doc(db, 'courses', selectedGameCourseId);
      await setDoc(courseRef, { stories: mergedStories }, { merge: true });

      setCustomCourses(prev => prev.map(c => c.id === selectedGameCourseId ? { ...c, stories: mergedStories } : c));
      
      try {
        const cachedStr = safeGetLocalStorage('vocab_memorizer_cached_custom_courses', '[]');
        let cached = JSON.parse(cachedStr);
        if (Array.isArray(cached)) {
          const idx = cached.findIndex((c: any) => c.id === selectedGameCourseId);
          if (idx >= 0) {
            cached[idx] = { ...cached[idx], stories: mergedStories };
          }
          safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(cached));
        }
      } catch (_) {}

      setStorySaveStatus('saved');
      setTimeout(() => setStorySaveStatus('idle'), 3000);
      return true;
    } catch (err: any) {
      console.error('Error saving stories in AdminPanel:', err);
      setStorySaveStatus('error');
      setStoryUploadError(`Failed to save stories: ${err?.message || 'Database error'}`);
      return false;
    }
  };

  const handleUploadStoryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedGameCourseId) {
      alert('অনুগ্রহ করে প্রথমে ড্রপডাউন থেকে একটি কোর্স সিলেক্ট করুন।');
      e.target.value = '';
      return;
    }
    setStoryUploadLoading(true);
    setStoryUploadError(null);
    try {
      const parsed = await parseStoriesFromFile(file);
      if (parsed.length === 0) {
        setStoryUploadError('কোনো সঠিক স্টোরি পাওয়া যায়নি। অনুগ্রহ করে ফাইলের ফরম্যাট চেক করুন।');
      } else {
        await handleSaveCourseStories(parsed, 'append');
      }
    } catch (err: any) {
      setStoryUploadError(`Error parsing file: ${err.message || 'Unknown error'}`);
    } finally {
      setStoryUploadLoading(false);
      e.target.value = '';
    }
  };

  const handleUploadStoryText = async () => {
    if (!pastedStoryText.trim()) return;
    if (!selectedGameCourseId) {
      alert('অনুগ্রহ করে প্রথমে ড্রপডাউন থেকে একটি কোর্স সিলেক্ট করুন।');
      return;
    }
    setStoryUploadLoading(true);
    setStoryUploadError(null);
    try {
      const parsed = parseStoriesFromRawText(pastedStoryText);
      if (parsed.length === 0) {
        setStoryUploadError('কোনো সঠিক স্টোরি পাওয়া যায়নি। ফরম্যাট: Title: [Title] ... Story: [Story Content]');
      } else {
        const ok = await handleSaveCourseStories(parsed, 'append');
        if (ok) setPastedStoryText('');
      }
    } catch (err: any) {
      setStoryUploadError(`Error: ${err.message || 'Unknown error'}`);
    } finally {
      setStoryUploadLoading(false);
    }
  };

  const handleManualAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStoryTitle.trim() || !manualStoryContent.trim()) {
      alert('Title এবং Story Content আবশ্যক।');
      return;
    }
    if (!selectedGameCourseId) {
      alert('অনুগ্রহ করে প্রথমে ড্রপডাউন থেকে একটি কোর্স সিলেক্ট করুন।');
      return;
    }
    const newStory: StoryItem = {
      id: `story-${selectedGameCourseId}-${Date.now()}`,
      title: manualStoryTitle.trim(),
      content: manualStoryContent.trim(),
      createdAt: new Date().toISOString()
    };
    const ok = await handleSaveCourseStories([newStory], 'append');
    if (ok) {
      setManualStoryTitle('');
      setManualStoryContent('');
      alert('Story added successfully!');
    }
  };

  const handleDeleteCourseStory = async (storyId: string) => {
    if (!selectedGameCourseId) return;
    if (!window.confirm('Are you sure you want to delete this story?')) return;
    const targetCourse = customCourses.find(c => c.id === selectedGameCourseId);
    if (!targetCourse) return;
    const filtered = (targetCourse.stories || []).filter(s => s.id !== storyId);
    await handleSaveCourseStories(filtered, 'replace');
  };

  const handleBulkDeleteCourseStories = async () => {
    if (!selectedGameCourseId) return;
    const targetCourse = customCourses.find(c => c.id === selectedGameCourseId);
    if (!targetCourse || !targetCourse.stories || targetCourse.stories.length === 0) {
      alert('No stories to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${targetCourse.stories.length} stories from this course?`)) return;
    await handleSaveCourseStories([], 'replace');
  };

  // --- ARTICLE UPLOAD & MANAGEMENT HANDLERS ---
  const handleSaveCourseArticles = async (newArticles: ArticleItem[], mode: 'append' | 'replace' = 'append') => {
    if (!selectedGameCourseId) {
      setArticleUploadError('অনুগ্রহ করে প্রথমে ড্রপডাউন থেকে একটি কোর্স সিলেক্ট করুন।');
      return false;
    }
    setArticleSaveStatus('saving');
    setArticleUploadError(null);
    try {
      const currentTargetCourse = customCourses.find(c => c.id === selectedGameCourseId);
      const existingArticles = mode === 'replace' ? [] : (currentTargetCourse?.articles || []);
      const mergedArticles = [...existingArticles, ...newArticles];

      const courseRef = doc(db, 'courses', selectedGameCourseId);
      await setDoc(courseRef, { articles: mergedArticles }, { merge: true });

      setCustomCourses(prev => prev.map(c => c.id === selectedGameCourseId ? { ...c, articles: mergedArticles } : c));
      
      try {
        const cachedStr = safeGetLocalStorage('vocab_memorizer_cached_custom_courses', '[]');
        let cached = JSON.parse(cachedStr);
        if (Array.isArray(cached)) {
          const idx = cached.findIndex((c: any) => c.id === selectedGameCourseId);
          if (idx >= 0) {
            cached[idx] = { ...cached[idx], articles: mergedArticles };
          }
          safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(cached));
        }
      } catch (_) {}

      setArticleSaveStatus('saved');
      setTimeout(() => setArticleSaveStatus('idle'), 3000);
      return true;
    } catch (err: any) {
      console.error('Error saving articles in AdminPanel:', err);
      setArticleSaveStatus('error');
      setArticleUploadError(`Failed to save articles: ${err?.message || 'Database error'}`);
      return false;
    }
  };

  const handleUploadArticleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedGameCourseId) {
      alert('অনুগ্রহ করে প্রথমে ড্রপডাউন থেকে একটি কোর্স সিলেক্ট করুন।');
      e.target.value = '';
      return;
    }
    setArticleUploadLoading(true);
    setArticleUploadError(null);
    try {
      const parsed = await parseArticlesFromFile(file);
      if (parsed.length === 0) {
        setArticleUploadError('কোনো সঠিক আর্টিকেল পাওয়া যায়নি। অনুগ্রহ করে ফাইলের ফরম্যাট চেক করুন।');
      } else {
        await handleSaveCourseArticles(parsed, 'append');
      }
    } catch (err: any) {
      setArticleUploadError(`Error parsing file: ${err.message || 'Unknown error'}`);
    } finally {
      setArticleUploadLoading(false);
      e.target.value = '';
    }
  };

  const handleUploadArticleText = async () => {
    if (!pastedArticleText.trim()) return;
    if (!selectedGameCourseId) {
      alert('অনুগ্রহ করে প্রথমে ড্রপডাউন থেকে একটি কোর্স সিলেক্ট করুন।');
      return;
    }
    setArticleUploadLoading(true);
    setArticleUploadError(null);
    try {
      const parsed = parseArticlesFromRawText(pastedArticleText);
      if (parsed.length === 0) {
        setArticleUploadError('কোনো সঠিক আর্টিকেল পাওয়া যায়নি। ফরম্যাট: Title: [Title] ... Article: [Article Content]');
      } else {
        const ok = await handleSaveCourseArticles(parsed, 'append');
        if (ok) setPastedArticleText('');
      }
    } catch (err: any) {
      setArticleUploadError(`Error: ${err.message || 'Unknown error'}`);
    } finally {
      setArticleUploadLoading(false);
    }
  };

  const handleManualAddArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualArticleTitle.trim() || !manualArticleContent.trim()) {
      alert('Title এবং Article Content আবশ্যক।');
      return;
    }
    if (!selectedGameCourseId) {
      alert('অনুগ্রহ করে প্রথমে ড্রপডাউন থেকে একটি কোর্স সিলেক্ট করুন।');
      return;
    }
    const newArt: ArticleItem = {
      id: `art-${selectedGameCourseId}-${Date.now()}`,
      title: manualArticleTitle.trim(),
      excerpt: manualArticleExcerpt.trim() || manualArticleContent.trim().substring(0, 120) + '...',
      content: manualArticleContent.trim(),
      author: manualArticleAuthor.trim() || 'Course Educator',
      category: manualArticleCategory.trim() || 'Vocabulary Reading',
      readTime: manualArticleReadTime.trim() || '4 min read',
      publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      coverGradient: 'from-indigo-600 via-purple-600 to-pink-600',
      tags: ['Vocabulary', 'Article'],
      createdAt: new Date().toISOString()
    };
    const ok = await handleSaveCourseArticles([newArt], 'append');
    if (ok) {
      setManualArticleTitle('');
      setManualArticleContent('');
      setManualArticleExcerpt('');
      alert('Article added successfully!');
    }
  };

  const handleDeleteCourseArticle = async (articleId: string) => {
    if (!selectedGameCourseId) return;
    if (!window.confirm('Are you sure you want to delete this article?')) return;
    const targetCourse = customCourses.find(c => c.id === selectedGameCourseId);
    if (!targetCourse) return;
    const filtered = (targetCourse.articles || []).filter(a => a.id !== articleId);
    await handleSaveCourseArticles(filtered, 'replace');
  };

  const handleBulkDeleteCourseArticles = async () => {
    if (!selectedGameCourseId) return;
    const targetCourse = customCourses.find(c => c.id === selectedGameCourseId);
    if (!targetCourse || !targetCourse.articles || targetCourse.articles.length === 0) {
      alert('No articles to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${targetCourse.articles.length} articles from this course?`)) return;
    await handleSaveCourseArticles([], 'replace');
  };

  const fetchAccessRequests = async () => {
    // 1. Instant Cache Render (0ms)
    let hasLocal = false;
    try {
      const cachedStr = safeGetLocalStorage('cached_admin_access_requests', '[]');
      const cachedList: AccessRequest[] = JSON.parse(cachedStr);
      if (Array.isArray(cachedList) && cachedList.length > 0) {
        setAccessRequests(cachedList);
        setAccessRequestsLoading(false);
        hasLocal = true;
      }
    } catch (_) {}

    if (!hasLocal) {
      setAccessRequestsLoading(true);
    }

    const reqMap = new Map<string, AccessRequest>();

    // 2. Query Firestore and Server API in parallel
    try {
      const [firestoreRes, apiRes] = await Promise.allSettled([
        (async () => {
          const fetchPromise = getDocs(collection(db, 'access_requests'));
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Access requests fetch timeout')), 4000)
          );
          return (await Promise.race([fetchPromise, timeoutPromise])) as any;
        })(),
        (async () => {
          const res = await fetch('/api/db/access_requests');
          if (res.ok) {
            const json = await res.json();
            return json.docs || json.data || [];
          }
          return [];
        })()
      ]);

      // Process Firestore docs
      if (firestoreRes.status === 'fulfilled' && firestoreRes.value?.forEach) {
        firestoreRes.value.forEach((docSnap: any) => {
          reqMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as AccessRequest);
        });
      }

      // Process Server API docs
      if (apiRes.status === 'fulfilled' && apiRes.value) {
        const apiDocs = Array.isArray(apiRes.value)
          ? apiRes.value
          : (typeof apiRes.value === 'object' ? Object.values(apiRes.value) : []);
        apiDocs.forEach((docData: any) => {
          const docId = docData?.id;
          if (docId) {
            if (!reqMap.has(docId)) {
              reqMap.set(docId, { id: docId, ...docData } as AccessRequest);
            } else {
              // Merge fields
              reqMap.set(docId, { ...docData, ...reqMap.get(docId), id: docId } as AccessRequest);
            }
          }
        });
      }

      const list = Array.from(reqMap.values());
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setAccessRequests(list);
      safeSetLocalStorage('cached_admin_access_requests', JSON.stringify(list));
    } catch (err) {
      console.warn('Notice fetching access requests in background:', err);
    } finally {
      setAccessRequestsLoading(false);
    }
  };

  const updateUserWallet = async (email: string, amountChange: number, isAbsolute = false): Promise<boolean> => {
    const emailLower = email.toLowerCase().trim();
    if (!emailLower) {
      showToast('❌ Invalid email provided for wallet update', 'error');
      return false;
    }

    setIsProcessingAction(true);
    const nowISO = new Date().toISOString();
    let newBalance = 0;

    try {
      await runTransaction(db, async (transaction) => {
        const walletRef = doc(db, 'user_wallets', emailLower);
        const userRef = doc(db, 'users', emailLower);

        const walletSnap = await transaction.get(walletRef);
        const currentBal = walletSnap.exists()
          ? (walletSnap.data().balance ?? walletSnap.data().walletBalance ?? 0)
          : 0;

        newBalance = isAbsolute ? amountChange : currentBal + amountChange;
        if (newBalance < 0) {
          throw new Error(`Insufficient balance. Resulting wallet balance would be ৳${newBalance}`);
        }

        transaction.set(walletRef, {
          email: emailLower,
          balance: newBalance,
          walletBalance: newBalance,
          updatedAt: nowISO
        }, { merge: true });

        transaction.set(userRef, {
          email: emailLower,
          balance: newBalance,
          walletBalance: newBalance,
          updatedAt: nowISO
        }, { merge: true });
      });

      addTransactionLog({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowISO,
        type: 'wallet',
        userEmail: emailLower,
        details: `${isAbsolute ? 'Set balance to' : 'Adjusted balance by ' + (amountChange >= 0 ? '+' : '') + amountChange} -> New balance: ৳${newBalance} BDT`,
        status: 'success'
      });

      showToast(`✅ Wallet transaction successful for ${emailLower}! New balance: ৳${newBalance} BDT`, 'success');
      return true;
    } catch (err: any) {
      console.error('Error in updateUserWallet transaction:', err);
      let errMsg = err.message || String(err);
      if (err?.code === 'permission-denied') {
        errMsg = 'Permission Denied: Your account lacks Firestore write privileges for user_wallets or users.';
      } else if (err?.code === 'aborted' || err?.code === 'failed-precondition') {
        errMsg = 'Concurrent Modification Error: Wallet document was updated concurrently by another operation. Please retry.';
      }

      addTransactionLog({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowISO,
        type: 'wallet',
        userEmail: emailLower,
        details: `Failed wallet update (${amountChange}): ${errMsg}`,
        status: 'failed',
        error: errMsg
      });

      showToast(`❌ Wallet Transaction Failed: ${errMsg}`, 'error');
      return false;
    } finally {
      setIsProcessingAction(false);
    }
  };

  const processAccessRequest = async (req: AccessRequest, action: 'approve' | 'reject', overrideBalance?: number): Promise<boolean> => {
    const isRecharge = req.courseId === 'wallet_recharge' || 
                       req.courseTitle?.toLowerCase().includes('recharge') ||
                       req.courseTitle?.toLowerCase().includes('wallet');
    const finalPrice = overrideBalance !== undefined 
      ? overrideBalance 
      : (Number((req as any).amount) || Number(req.totalPrice) || Number(req.price) || 0);
    const userEmail = req.email.toLowerCase().trim();
    const nowISO = new Date().toISOString();

    if (action === 'reject') {
      // 1. Optimistic UI update (0ms latency)
      setAccessRequests(prev => {
        const updated = prev.map(r => r.id === req.id ? { ...r, status: 'rejected' as const } : r);
        safeSetLocalStorage('cached_admin_access_requests', JSON.stringify(updated));
        return updated;
      });

      addTransactionLog({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowISO,
        type: 'access_request',
        userEmail,
        details: `Rejected access/recharge request ${req.id} (${req.courseTitle || req.courseId})`,
        status: 'success'
      });

      showToast(`Request rejected for ${userEmail}`, 'info');

      // 2. Background Firestore & API sync
      try {
        const reqRef = doc(db, 'access_requests', req.id);
        await updateDoc(reqRef, { status: 'rejected', updatedAt: nowISO });
      } catch (err: any) {
        console.warn('Background reject sync notice:', err);
      }
      try {
        await fetch('/api/db/access_requests/doc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: req.id,
            data: { ...req, status: 'rejected', updatedAt: nowISO }
          })
        });
      } catch (_) {}
      return true;
    }

    // 1. Optimistic Approval UI Update (0ms latency)
    setAccessRequests(prev => {
      const updated = prev.map(r => r.id === req.id ? { ...r, status: 'approved' as const, spent: true, price: finalPrice, totalPrice: finalPrice } : r);
      safeSetLocalStorage('cached_admin_access_requests', JSON.stringify(updated));
      return updated;
    });

    addTransactionLog({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowISO,
      type: 'access_request',
      userEmail,
      details: isRecharge 
        ? `Approved recharge request ৳${finalPrice} BDT` 
        : `Approved course access request (${req.courseTitle || req.courseId})`,
      status: 'success'
    });

    showToast(
      isRecharge 
        ? `✅ Recharged ৳${finalPrice} BDT & updated balance for ${userEmail}!`
        : `✅ Approved course access & updated enrolled courses for ${userEmail}!`,
      'success'
    );

    // 2. Background Transaction & Sync with timeout race protection
    (async () => {
      try {
        const syncPromise = (async () => {
          try {
            await runTransaction(db, async (transaction) => {
              const reqRef = doc(db, 'access_requests', req.id);
              const walletRef = doc(db, 'user_wallets', userEmail);
              const userRef = doc(db, 'users', userEmail);

              const walletSnap = await transaction.get(walletRef);
              const currentWalletBal = walletSnap.exists() ? (walletSnap.data().balance ?? walletSnap.data().walletBalance ?? 0) : 0;

                if (isRecharge) {
                  const newBal = currentWalletBal + finalPrice;
                  transaction.set(walletRef, {
                    email: userEmail,
                    balance: newBal,
                    walletBalance: newBal,
                    updatedAt: nowISO
                  }, { merge: true });

                  transaction.set(userRef, {
                    email: userEmail,
                    balance: newBal,
                    walletBalance: newBal,
                    updatedAt: nowISO
                  }, { merge: true });
                } else {
                const targetCourseIds = (req.courseIds && req.courseIds.length > 0) ? req.courseIds : [req.courseId];
                const userSnap = await transaction.get(userRef);
                let existingEnrolled: string[] = [];
                if (userSnap.exists()) {
                  existingEnrolled = Array.isArray(userSnap.data().enrolledCourseIds) ? userSnap.data().enrolledCourseIds : [];
                }

                const existingSet = new Set(existingEnrolled.map(id => typeof id === 'string' ? id.trim().toLowerCase() : ''));
                const updatedEnrolled = [...existingEnrolled];
                for (const cid of targetCourseIds) {
                  if (cid && cid !== 'wallet_recharge' && !existingSet.has(cid.trim().toLowerCase())) {
                    updatedEnrolled.push(cid);
                    existingSet.add(cid.trim().toLowerCase());
                  }
                }

                transaction.set(userRef, {
                  email: userEmail,
                  enrolledCourseIds: updatedEnrolled,
                  updatedAt: nowISO
                }, { merge: true });
              }

              transaction.set(reqRef, {
                status: 'approved',
                spent: true,
                spentAt: nowISO,
                price: finalPrice,
                totalPrice: finalPrice,
                updatedAt: nowISO
              }, { merge: true });

              if (req.trxId) {
                const reqTrx = req.trxId.toLowerCase().trim();
                const trxRef = doc(db, 'used_transactions', reqTrx);
                transaction.set(trxRef, {
                  trxId: reqTrx,
                  spent: true,
                  status: 'spent',
                  email: userEmail,
                  usedBy: userEmail,
                  bkashNumber: req.bkashNumber || '',
                  amount: finalPrice,
                  createdAt: nowISO,
                  usedAt: nowISO
                }, { merge: true });
              }
            });
          } catch (txnErr) {
            console.warn('runTransaction failed, fallback to setDoc:', txnErr);
            const reqRef = doc(db, 'access_requests', req.id);
            const walletRef = doc(db, 'user_wallets', userEmail);
            const userRef = doc(db, 'users', userEmail);

            if (isRecharge) {
              let currentWalletBal = 0;
              try {
                const walletSnap = await getDoc(walletRef);
                if (walletSnap.exists()) {
                  currentWalletBal = walletSnap.data().balance ?? walletSnap.data().walletBalance ?? 0;
                }
              } catch (_) {}

              const newBal = currentWalletBal + finalPrice;
              await setDoc(walletRef, {
                email: userEmail,
                balance: newBal,
                walletBalance: newBal,
                updatedAt: nowISO
              }, { merge: true });

              try {
                const uQuery = query(collection(db, 'users'), where('email', '==', userEmail));
                const uSnap = await getDocs(uQuery);
                if (!uSnap.empty) {
                  for (const uDoc of uSnap.docs) {
                    await setDoc(doc(db, 'users', uDoc.id), {
                      walletBalance: newBal,
                      balance: newBal,
                      updatedAt: nowISO
                    }, { merge: true });
                  }
                }
              } catch (_) {}

              await setDoc(userRef, {
                email: userEmail,
                balance: newBal,
                walletBalance: newBal,
                updatedAt: nowISO
              }, { merge: true });
            } else {
              const targetCourseIds = (req.courseIds && req.courseIds.length > 0) ? req.courseIds : [req.courseId];
              let existingEnrolled: string[] = [];
              try {
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                  existingEnrolled = Array.isArray(userSnap.data().enrolledCourseIds) ? userSnap.data().enrolledCourseIds : [];
                }
              } catch (_) {}

              const existingSet = new Set(existingEnrolled.map(id => typeof id === 'string' ? id.trim().toLowerCase() : ''));
              const updatedEnrolled = [...existingEnrolled];
              for (const cid of targetCourseIds) {
                if (cid && cid !== 'wallet_recharge' && !existingSet.has(cid.trim().toLowerCase())) {
                  updatedEnrolled.push(cid);
                  existingSet.add(cid.trim().toLowerCase());
                }
              }

              await setDoc(userRef, {
                email: userEmail,
                enrolledCourseIds: updatedEnrolled,
                updatedAt: nowISO
              }, { merge: true });
            }

            await setDoc(reqRef, {
              status: 'approved',
              spent: true,
              spentAt: nowISO,
              price: finalPrice,
              totalPrice: finalPrice,
              updatedAt: nowISO
            }, { merge: true });

            if (req.trxId) {
              const reqTrx = req.trxId.toLowerCase().trim();
              const trxRef = doc(db, 'used_transactions', reqTrx);
              await setDoc(trxRef, {
                trxId: reqTrx,
                spent: true,
                status: 'spent',
                email: userEmail,
                usedBy: userEmail,
                bkashNumber: req.bkashNumber || '',
                amount: finalPrice,
                createdAt: nowISO,
                usedAt: nowISO
              }, { merge: true });
            }
          }

          // Course allowedUsers synchronization
          if (!isRecharge) {
            const targetCourseIds = (req.courseIds && req.courseIds.length > 0) ? req.courseIds : [req.courseId];
            for (const cid of targetCourseIds) {
              if (!cid || cid === 'wallet_recharge') continue;
              try {
                const courseRef = doc(db, 'courses', cid);
                const courseDoc = await getDoc(courseRef);
                if (courseDoc.exists()) {
                  const cData = courseDoc.data() as Course;
                  const allowed = cData.allowedUsers || [];
                  if (!allowed.includes(userEmail)) {
                    await updateDoc(courseRef, { allowedUsers: [...allowed, userEmail] });
                  }
                }
              } catch (cErr) {
                console.warn(`Notice updating course allowedUsers for ${cid}:`, cErr);
              }
            }
          }

          // Server API fallback sync
          try {
            await fetch('/api/db/access_requests/doc', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: req.id,
                data: {
                  ...req,
                  status: 'approved',
                  spent: true,
                  spentAt: nowISO,
                  price: finalPrice,
                  totalPrice: finalPrice,
                  updatedAt: nowISO
                }
              })
            });
            if (isRecharge) {
              let currentBal = 0;
              try {
                const wSnap = await getDoc(doc(db, 'user_wallets', userEmail));
                if (wSnap.exists()) currentBal = wSnap.data().balance ?? wSnap.data().walletBalance ?? 0;
              } catch (_) {}
              const calculatedNewBal = currentBal > 0 ? currentBal : finalPrice;
              await fetch('/api/db/user_wallets/doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: userEmail,
                  data: { email: userEmail, balance: calculatedNewBal, walletBalance: calculatedNewBal, updatedAt: nowISO }
                })
              });
              await fetch('/api/db/users/doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: userEmail,
                  data: { email: userEmail, balance: calculatedNewBal, walletBalance: calculatedNewBal, updatedAt: nowISO }
                })
              });
            }
          } catch (_) {}
        })();

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Sync timeout')), 3500)
        );

        await Promise.race([syncPromise, timeoutPromise]);
      } catch (err) {
        console.warn('Background request approval sync notice:', err);
      }
    })();

    return true;
  };

  const validateWalletAndProcessRequest = processAccessRequest;

  const handleApproveAccessRequest = async (req: AccessRequest, overrideBalance?: number) => {
    return processAccessRequest(req, 'approve', overrideBalance);
  };

  const handleRejectAccessRequest = async (reqId: string) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    const foundReq = accessRequests.find(r => r.id === reqId);
    if (foundReq) {
      return processAccessRequest(foundReq, 'reject');
    }
    try {
      const reqRef = doc(db, 'access_requests', reqId);
      await updateDoc(reqRef, { status: 'rejected' });
      setAccessRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r));
      showToast('✅ Server Confirmed: Request status set to Rejected.', 'info');
    } catch (err: any) {
      console.error('Error rejecting request:', err);
      showToast(`❌ Server Error: Failed to reject request (${err.message || String(err)})`, 'error');
    }
  };

  const handleTestTransaction = async () => {
    const adminEmail = auth.currentUser?.email?.toLowerCase().trim() || 'admin_test@domain.com';
    const testDocId = `test_health_check`;
    const nowISO = new Date().toISOString();
    showToast('Running diagnostic Firestore write transaction...', 'info');

    try {
      await runTransaction(db, async (transaction) => {
        const testRef = doc(db, 'user_wallets', testDocId);
        const snap = await transaction.get(testRef);
        const count = snap.exists() ? (snap.data().testCount || 0) + 1 : 1;
        transaction.set(testRef, {
          testCount: count,
          lastTestedBy: adminEmail,
          updatedAt: nowISO
        }, { merge: true });
      });

      addTransactionLog({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowISO,
        type: 'test_write',
        userEmail: adminEmail,
        details: `Test transaction succeeded on user_wallets/${testDocId}`,
        status: 'success'
      });

      showToast('✅ Firestore Transaction Health Check: SUCCESS! Write privileges verified.', 'success');
    } catch (err: any) {
      console.error('Test transaction error:', err);
      const errMsg = err?.code === 'permission-denied' 
        ? 'Permission Denied: Current user is not authorized to write to user_wallets in Firestore.' 
        : (err.message || String(err));

      addTransactionLog({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowISO,
        type: 'test_write',
        userEmail: adminEmail,
        details: `Test transaction failed: ${errMsg}`,
        status: 'failed',
        error: errMsg
      });

      showToast(`❌ Firestore Transaction Health Check FAILED: ${errMsg}`, 'error');
    }
  };

  // Word issue reports states
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'reports'));
      const list: any[] = [];
      qSnap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
      setReports(list);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setReportsLoading(false);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to mark this report as resolved? It will be deleted.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReports(prev => prev.filter(r => r.id !== reportId));
      alert('Report marked as resolved!');
    } catch (err) {
      console.error('Error resolving report:', err);
      alert('Failed to resolve report.');
    }
  };

  // Fetch custom courses with real-time listener and offline cache
  const fetchCustomCourses = () => {
    // Only handles the instant-cache render now — the actual network fetch
    // used to happen here too AND in the onSnapshot listener below (which
    // already does its own immediate fetch on mount before it starts
    // polling), so every mount fired two separate full-collection requests
    // in parallel, competing to set the same state and roughly doubling
    // load time/bandwidth for admins with many courses (course docs embed
    // their full word lists). onSnapshot's initial fetch now does this job
    // alone; this function just paints the cached list instantly while that
    // request is in flight, same as before.
    try {
      const cachedStr = safeGetLocalStorage('vocab_memorizer_cached_custom_courses', '[]');
      const cachedList: Course[] = JSON.parse(cachedStr);
      if (Array.isArray(cachedList) && cachedList.length > 0) {
        setCustomCourses(cachedList);
        setCoursesLoading(false);
        setHasFetchedCourses(true);
        return;
      }
    } catch (_) {}
    setCoursesLoading(true);
    setCoursesError(null);
  };

  // Real-time courses snapshot listener for Admin Panel — this alone owns
  // the network fetch for the courses list (see fetchCustomCourses above).
  useEffect(() => {
    let unsubscribe = () => {};
    let settled = false;
    // If neither the cache nor the live listener has produced anything
    // within a few seconds (e.g. a genuinely broken connection), surface an
    // error instead of leaving the loading state spinning forever.
    const timeoutId = setTimeout(() => {
      if (!settled) {
        setCoursesLoading(false);
        setCoursesError((prev) => prev ?? 'Failed to load courses list.');
      }
    }, 6000);
    try {
      unsubscribe = onSnapshot(collection(db, 'courses'), (snap) => {
        settled = true;
        clearTimeout(timeoutId);
        const list: Course[] = [];
        snap.forEach(docSnap => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Course);
        });
        setCustomCourses(list);
        setHasFetchedCourses(true);
        setCoursesLoading(false);
        setCoursesError(null);
        safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(list));
        if (onCoursesUpdated) {
          onCoursesUpdated(list);
        }
      }, (err) => {
        console.warn("Notice in AdminPanel courses snapshot:", err);
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          setCoursesLoading(false);
          setCoursesError('Failed to load courses list.');
        }
      });
    } catch (err) {
      console.error("Error setting up AdminPanel courses snapshot:", err);
      clearTimeout(timeoutId);
      setCoursesLoading(false);
      setCoursesError('Failed to load courses list.');
    }
    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [onCoursesUpdated]);

  // Real-time access requests snapshot listener for Admin Panel
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(collection(db, 'access_requests'), (snap) => {
        const snapList: AccessRequest[] = [];
        snap.forEach(docSnap => {
          snapList.push({ id: docSnap.id, ...docSnap.data() } as AccessRequest);
        });
        
        // Merge with existing state so we don't lose any server-side items
        setAccessRequests(prev => {
          const map = new Map<string, AccessRequest>();
          prev.forEach(item => map.set(item.id, item));
          snapList.forEach(item => map.set(item.id, item));
          const merged = Array.from(map.values());
          merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          safeSetLocalStorage('cached_admin_access_requests', JSON.stringify(merged));
          return merged;
        });
        setAccessRequestsLoading(false);
      }, (err) => {
        console.warn("Notice in AdminPanel access_requests snapshot:", err);
      });
    } catch (err) {
      console.error("Error setting up AdminPanel access_requests snapshot:", err);
    }
    return () => unsubscribe();
  }, []);

  // Sync slug from title
  useEffect(() => {
    if (isSlugTouched) return;
    let slug = newCourseTitle
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // remove special chars
      .replace(/[\s_]+/g, '-')  // replace spaces with hyphen
      .replace(/^-+|-+$/g, ''); // trim outer hyphens
    
    // If slug is empty (due to Bangla/unicode characters), auto-generate a fallback ID
    if (!slug && newCourseTitle.trim()) {
      const hash = Math.random().toString(36).substring(2, 8);
      slug = `course-${hash}`;
    }
    setNewCourseId(slug);
  }, [newCourseTitle, isSlugTouched]);

  const fetchUsersData = async () => {
    setLoading(true);
    setError(null);
    const path = 'users';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      const fetchedUsersMap = new Map<string, FirestoreUserDoc>();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const userEmail = (data.email || '').trim().toLowerCase();
        if (data.email || doc.id) {
          fetchedUsersMap.set(userEmail || doc.id, {
            id: doc.id,
            email: data.email || 'unknown@user.com',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            progress: data.progress || {},
            goal: data.goal || {},
            synonymProgress: data.synonymProgress || {},
            settings: data.settings || {},
            enrolledCourseIds: data.enrolledCourseIds || [],
            walletBalance: data.walletBalance ?? data.balance ?? 0
          });
        }
      });

      // Also check access_requests for any users who submitted requests
      try {
        const reqsSnap = await getDocs(collection(db, 'access_requests'));
        reqsSnap.forEach((rDoc) => {
          const rData = rDoc.data();
          const rEmail = (rData.email || rData.userEmail || '').trim().toLowerCase();
          if (rEmail && !fetchedUsersMap.has(rEmail)) {
            fetchedUsersMap.set(rEmail, {
              id: `req-${rDoc.id}`,
              email: rData.email || rData.userEmail,
              createdAt: rData.timestamp || rData.createdAt || new Date().toISOString(),
              updatedAt: rData.timestamp || new Date().toISOString(),
              progress: {},
              goal: {},
              synonymProgress: {},
              settings: {}
            });
          }
        });
      } catch (e) {
        console.warn('Could not supplement users from access_requests:', e);
      }

      setUsers(Array.from(fetchedUsersMap.values()));
    } catch (err) {
      console.warn('Error in fetchUsersData:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial lightweight load
  useEffect(() => {
    fetchCustomCourses();
  }, []);

  // Lazy on-demand data fetching based on activeAdminTab to keep memory lean (<150MB)
  useEffect(() => {
    let intervalId: any = null;
    if (activeAdminTab === 'courses') {
      fetchCustomCourses();
    } else if (activeAdminTab === 'users') {
      fetchUsersData();
    } else if (activeAdminTab === 'reports') {
      fetchReports();
    } else if (activeAdminTab === 'access-requests') {
      fetchAccessRequests();
      fetchGlobalVerifiedPayments();
      // Poll every 6 seconds to keep backend API sync instant
      intervalId = setInterval(() => {
        fetchAccessRequests();
      }, 6000);
    } else if (activeAdminTab === 'blank-questions') {
      fetchBlankQuestions();
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeAdminTab]);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setUploadError(null);
    setUploadedWords([]);
    
    if (!newCourseId) {
      setUploadError('Please provide a course title before uploading files.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = utils.sheet_to_json(sheet) as any[];

        if (rawRows.length === 0) {
          setUploadError('No data found in the selected Excel sheet.');
          return;
        }

        // Extract place labels from headers
        let detectedLabels: Record<string, string> = {};
        const firstRowKeys = Object.keys(rawRows[0]);
        firstRowKeys.forEach(k => {
          const match = k.match(/^place(1|2|3|4|5|6):(.*)$/i);
          if (match) {
            const num = match[1];
            detectedLabels[`place${num}`] = match[2].trim();
          }
        });
        setParsedPlaceLabels(detectedLabels);

        const wordsList: VocabularyWord[] = [];
        let index = 1;

        for (const row of rawRows) {
          // Normalise keys to lowercase, trimming whitespaces
          const rowKeys = Object.keys(row);
          const usedKeys = new Set<string>();
          
          const findKey = (candidates: string[], placePrefix?: string) => {
            if (placePrefix) {
              const placeKey = rowKeys.find(k => {
                if (usedKeys.has(k)) return false;
                const cleanK = k.toLowerCase().trim();
                return new RegExp(`^${placePrefix.toLowerCase()}(\\s*[:_\\-]|\\s*$)`, 'i').test(cleanK);
              });
              if (placeKey) {
                usedKeys.add(placeKey);
                return placeKey;
              }
            }
            const key = rowKeys.find(k => {
              if (usedKeys.has(k)) return false;
              const cleanK = k.toLowerCase().trim();
              if (/^place[1-6](\s*[:_\-]|\s*$)/i.test(cleanK)) {
                return false;
              }
              if (candidates.some(c => cleanK === c)) return true;
              const normK = cleanK.replace(/[^a-z0-9\u0980-\u09FF]/g, '');
              if (candidates.some(c => normK === c.replace(/[^a-z0-9\u0980-\u09FF]/g, ''))) return true;
              return candidates.some(c => c.length >= 3 && (cleanK.includes(c) || c.includes(cleanK)));
            });
            if (key) usedKeys.add(key);
            return key;
          };

          const idKey = findKey(['id', 'unique id', 'word id', 'uid', 'sl', 'serial']);
          const rawId = (idKey && row[idKey]) ? String(row[idKey]).trim() : String(index);

          const wordKey = findKey(['word', 'main word', 'english word'], 'place1');
          const meaningKey = findKey(['meaning', 'bangla meaning', 'bengali meaning'], 'place2');
          const groupKey = findKey(['group', 'level']);
          const synonym1Key = findKey(['synonym1', 'synonm1', 'syn1'], 'place5');
          const synonym2Key = findKey(['synonym2', 'synonm2', 'syn2']);
          const synonymsKey = findKey(['synonyms', 'synonym']);
          const extraWordKey = findKey(['extra word', 'derivative'], 'place4');
          const extraMeaningKey = findKey(['extra meaning']);
          const exampleKey = findKey(['example', 'example sentence'], 'place3');
          const mnemonicKey = findKey(['place6', 'mnemonic', 'mnemonics', 'personal notes', 'personal note', 'notes', 'note', 'nemonik', 'nemoniq', 'নেমোনিক', 'mnemonic note', 'mnemonic notes'], 'place6');

          const baseWord = wordKey ? String(row[wordKey]).trim() : '';
          const banglaMeaning = meaningKey ? String(row[meaningKey]).trim() : '';

          if (!baseWord || !banglaMeaning) {
            continue; // Skip invalid rows
          }

          let group: string | number = 1;
          if (groupKey && row[groupKey] !== undefined && row[groupKey] !== null) {
            const rawGrp = String(row[groupKey]).trim();
            if (rawGrp) {
              const num = parseInt(rawGrp, 10);
              if (!isNaN(num) && String(num) === rawGrp) {
                group = num;
              } else {
                group = rawGrp;
              }
            }
          }

          let synonyms = '';
          const synParts = [];
          if (synonym1Key && row[synonym1Key]) synParts.push(String(row[synonym1Key]).trim());
          if (synonym2Key && row[synonym2Key]) synParts.push(String(row[synonym2Key]).trim());

          if (synParts.length > 0) {
            synonyms = synParts.join(', ');
          } else if (synonymsKey && row[synonymsKey]) {
            synonyms = String(row[synonymsKey]).trim();
          }

          const example = exampleKey ? String(row[exampleKey]).trim() : '';
          const extraWord = extraWordKey ? String(row[extraWordKey]).trim() : '';
          const extraMeaning = extraMeaningKey ? String(row[extraMeaningKey]).trim() : '';
          const mnemonic = mnemonicKey ? String(row[mnemonicKey]).trim() : '';

          wordsList.push({
            id: rawId || String(index),
            group,
            word: baseWord,
            meaning: banglaMeaning,
            synonyms,
            extraWord: extraWord,
            extraMeaning: extraMeaning,
            example,
            mnemonic
          });

          index++;
        }

        if (wordsList.length === 0) {
          setUploadError('Columns did not match! Please make sure you have at least "main word" and "bangla meaning" columns.');
          return;
        }

        setUploadedWords(wordsList);
      } catch (err) {
        console.error(err);
        setUploadError('Failed to process Excel file. Please use a valid spreadsheet format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processPastedText = (text: string) => {
    setUploadError(null);
    setUploadedWords([]);

    if (!text.trim()) {
      return;
    }

    try {
      const lines = text.split(/\r?\n/);
      const parsedWords: VocabularyWord[] = [];
      let index = 1;

      // Check if first line has headers like 'word', 'meaning'
      let startIdx = 0;
      let colIdxs = {
        id: -1,
        word: 0,
        meaning: 1,
        group: 2,
        synonym1: -1,
        synonym2: -1,
        synonyms: 3,
        extraWord: 4,
        extraMeaning: 5,
        example: 6,
        mnemonic: -1
      };

      if (lines.length > 0) {
        const firstLineRawCells = lines[0].split('\t');
        const firstLineCells = firstLineRawCells.map(c => c.toLowerCase().trim());
        
        // Extract place labels from headers
        let detectedLabels: Record<string, string> = {};
        firstLineRawCells.forEach(cell => {
          const match = cell.trim().match(/^place(1|2|3|4|5|6):(.*)$/i);
          if (match) {
            const num = match[1];
            detectedLabels[`place${num}`] = match[2].trim();
          }
        });
        setParsedPlaceLabels(detectedLabels);

        const hasHeader = firstLineCells.some(c => 
          c === 'word' || c === 'main word' || c.startsWith('place1:') ||
          c === 'meaning' || c === 'bangla meaning' || c.startsWith('place2:') ||
          c === 'id' || c === 'unique id' || c === 'word id' || c === 'uid'
        );

        if (hasHeader) {
          startIdx = 1; // skip header row
          
          const findPos = (candidates: string[], placePrefix?: string) => {
            if (placePrefix) {
              const placeIdx = firstLineCells.findIndex(c => {
                const cleanC = c.trim().toLowerCase();
                return new RegExp(`^${placePrefix.toLowerCase()}(\\s*[:_\\-]|\\s*$)`, 'i').test(cleanC);
              });
              if (placeIdx !== -1) return placeIdx;
            }
            return firstLineCells.findIndex(c => {
              const cleanC = c.trim().toLowerCase();
              if (/^place[1-6](\s*[:_\-]|\s*$)/i.test(cleanC)) return false;
              return candidates.some(cand => cleanC === cand || cleanC.includes(cand));
            });
          };

          const idPos = findPos(['id', 'unique id', 'word id', 'uid', 'sl', 'serial']);
          const wordPos = findPos(['word', 'main word'], 'place1');
          const meaningPos = findPos(['meaning', 'bangla meaning'], 'place2');
          const groupPos = findPos(['group']);
          const exPos = findPos(['example', 'example sentence'], 'place3');
          const extraWPos = findPos(['extra word', 'derivative'], 'place4');
          const synsPos = findPos(['synonyms', 'synonym', 'syn1', 'synonym1'], 'place5');
          const extraMPos = findPos(['extra meaning']);
          const mnemPos = findPos(['mnemonic', 'mnemonics', 'notes', 'note', 'nemonik', 'নেমোনিক'], 'place6');

          if (idPos !== -1) colIdxs.id = idPos;
          if (wordPos !== -1) colIdxs.word = wordPos;
          if (meaningPos !== -1) colIdxs.meaning = meaningPos;
          colIdxs.group = groupPos !== -1 ? groupPos : -1;
          colIdxs.synonyms = synsPos !== -1 ? synsPos : -1;
          colIdxs.extraWord = extraWPos !== -1 ? extraWPos : -1;
          colIdxs.extraMeaning = extraMPos !== -1 ? extraMPos : -1;
          colIdxs.example = exPos !== -1 ? exPos : -1;
          colIdxs.mnemonic = mnemPos !== -1 ? mnemPos : -1;
        }
      }

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const cells = line.split('\t');
        if (cells.length < 2) {
          // Try split by comma or semi-colon if they pasted CSV/SSV
          const commaCells = line.split(',');
          if (commaCells.length >= 2) {
            cells.splice(0, cells.length, ...commaCells);
          }
        }

        const rawId = colIdxs.id !== -1 && cells[colIdxs.id] ? cells[colIdxs.id].trim() : String(index);
        const baseWord = cells[colIdxs.word]?.trim() || '';
        const banglaMeaning = cells[colIdxs.meaning]?.trim() || '';

        if (!baseWord || !banglaMeaning) {
          continue; // Skip invalid rows
        }

        let group: string | number = 1;
        if (colIdxs.group !== -1 && cells[colIdxs.group]) {
          const rawGrp = cells[colIdxs.group].trim();
          if (rawGrp) {
            const num = parseInt(rawGrp, 10);
            if (!isNaN(num) && String(num) === rawGrp) {
              group = num;
            } else {
              group = rawGrp;
            }
          }
        }
        
        let synonyms = '';
        const synParts = [];
        if (colIdxs.synonym1 !== -1 && cells[colIdxs.synonym1]) synParts.push(cells[colIdxs.synonym1].trim());
        if (colIdxs.synonym2 !== -1 && cells[colIdxs.synonym2]) synParts.push(cells[colIdxs.synonym2].trim());

        if (synParts.length > 0) {
          synonyms = synParts.join(', ');
        } else if (colIdxs.synonyms !== -1 && cells[colIdxs.synonyms]) {
          synonyms = cells[colIdxs.synonyms].trim();
        }

        const extraWord = colIdxs.extraWord !== -1 ? cells[colIdxs.extraWord]?.trim() || '' : '';
        const extraMeaning = colIdxs.extraMeaning !== -1 ? cells[colIdxs.extraMeaning]?.trim() || '' : '';
        const example = colIdxs.example !== -1 ? cells[colIdxs.example]?.trim() || '' : '';
        const mnemonic = colIdxs.mnemonic && colIdxs.mnemonic !== -1 ? cells[colIdxs.mnemonic]?.trim() || '' : '';

        parsedWords.push({
          id: rawId || String(index),
          group,
          word: baseWord,
          meaning: banglaMeaning,
          synonyms,
          extraWord,
          extraMeaning,
          example,
          mnemonic
        });

        index++;
      }

      if (parsedWords.length === 0) {
        setUploadError('No valid data found. First column must be the word, and second column must be the meaning.');
        return;
      }

      setUploadedWords(parsedWords);
    } catch (err) {
      console.error(err);
      setUploadError('Failed to process pasted text. Please make sure columns are separated by Tabs or Commas.');
    }
  };

  const handleSaveCourse = async () => {
    if (!newCourseTitle.trim() || uploadedWords.length === 0) {
      setSaveError('Please enter a Course Title and provide vocabulary words.');
      return;
    }

    let cleanId = (newCourseId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
    if (!cleanId) {
      cleanId = `course-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    }

    setSaveStatus('saving');
    setSaveError(null);

    try {
      // Find total number of unique groups in uploaded word list
      const groups = new Set(uploadedWords.map(w => w.group));
      const totalGroups = groups.size || 1;

      // Parse allowed users list from text area (one user per line)
      const allowedUsers: string[] = [];
      if (newCourseIsRestricted && newCourseAllowedUsersText.trim()) {
        newCourseAllowedUsersText
          .split('\n')
          .map(line => line.trim().toLowerCase())
          .filter(line => line.length > 0)
          .forEach(user => allowedUsers.push(user));
      }

      // Sanitize words list
      const sanitizedWords: VocabularyWord[] = uploadedWords.map((w, idx) => ({
        id: (w.id && String(w.id).trim()) || String(idx + 1),
        group: w.group !== undefined && w.group !== null ? w.group : 1,
        word: (w.word || '').trim(),
        meaning: (w.meaning || '').trim(),
        synonyms: (w.synonyms || '').trim(),
        extraWord: (w.extraWord || '').trim(),
        extraMeaning: (w.extraMeaning || '').trim(),
        example: (w.example || '').trim(),
        mnemonic: (w.mnemonic || '').trim()
      })).filter(w => w.word && w.meaning);

      const rawCourseData: Course = {
        id: cleanId,
        title: newCourseTitle.trim(),
        description: newCourseDesc.trim() || `${sanitizedWords.length} words vocabulary course.`,
        totalGroups,
        words: sanitizedWords,
        stories: [],
        articles: [],
        enabledGames: { quiz: true, match: true, synonym: true, blank: true, story: true, article: true },
        isDefault: newCourseIsDefault,
        isRestricted: newCourseIsRestricted,
        allowedUsers: allowedUsers,
        price: 30,
        order: Number(newCourseOrder) || 1,
        bkashNumber: '01581624202',
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || 'admin@gmail.com',
        placeLabels: parsedPlaceLabels || {}
      };

      // Sanitize data to remove any undefined fields that cause Firestore errors
      const cleanData: Course = JSON.parse(JSON.stringify(rawCourseData));

      // 1. Save directly to Firestore Cloud Database
      await setDoc(doc(db, 'courses', cleanData.id), cleanData);

      // 2. Update React state and local cache immediately
      const updatedList = [...customCourses.filter(c => c.id !== cleanData.id), cleanData];
      setCustomCourses(updatedList);
      safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(updatedList));

      if (onCoursesUpdated) {
        onCoursesUpdated(updatedList);
      }
      
      setSaveStatus('saved');
      setNewCourseTitle('');
      setNewCourseDesc('');
      setUploadedWords([]);
      setParsedPlaceLabels({});
      setPasteInputText('');
      setNewCourseIsDefault(false);
      setNewCourseIsRestricted(false);
      setNewCourseAllowedUsersText('');
      setNewCourseOrder(1);
      setIsSlugTouched(false);
      setShowCreateCourseModal(false);
      alert(`✅ কোর্স "${cleanData.title}" সফলভাবে ক্লাউডে সেভ ও পাবলিশ হয়েছে!`);
    } catch (err: any) {
      console.error('Error saving course:', err);
      setSaveError(err?.message || 'Failed to save course to cloud.');
      setSaveStatus('idle');
    } finally {
      setSaveStatus('idle');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে এই কোর্সটি (${courseId}) চিরতরে ডিলিট করতে চান? সব ক্লাউড ডাটা মুছে যাবে!`)) {
      return;
    }
    try {
      const cleanCourseId = courseId.trim();

      // 1. Delete from Firestore cloud
      await deleteDoc(doc(db, 'courses', cleanCourseId));
      if (cleanCourseId.toLowerCase() !== cleanCourseId) {
        try {
          await deleteDoc(doc(db, 'courses', cleanCourseId.toLowerCase()));
        } catch (_) {}
      }

      // 2. Immediately update AdminPanel state
      const nextCourses = customCourses.filter(c => c.id !== courseId && c.id.trim().toLowerCase() !== cleanCourseId.toLowerCase());
      setCustomCourses(nextCourses);
      safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(nextCourses));

      // 3. Clean up imported and enrolled course local caches
      try {
        const impStr = safeGetLocalStorage('vocab_memorizer_imported_courses', '[]');
        const impList = JSON.parse(impStr);
        if (Array.isArray(impList)) {
          const updatedImp = impList.filter((c: any) => c.id !== courseId && c.id?.trim()?.toLowerCase() !== cleanCourseId.toLowerCase());
          safeSetLocalStorage('vocab_memorizer_imported_courses', JSON.stringify(updatedImp));
        }
      } catch (_) {}

      try {
        const enrStr = safeGetLocalStorage('vocab_memorizer_enrolled_courses_v2', '[]');
        const enrList = JSON.parse(enrStr);
        if (Array.isArray(enrList)) {
          const updatedEnr = enrList.filter((id: string) => id !== courseId && id?.trim()?.toLowerCase() !== cleanCourseId.toLowerCase());
          safeSetLocalStorage('vocab_memorizer_enrolled_courses_v2', JSON.stringify(updatedEnr));
        }
      } catch (_) {}

      // 4. Notify parent to sync globally across the app
      if (onCoursesUpdated) {
        onCoursesUpdated(nextCourses);
      }

      alert('✅ কোর্সটি ক্লাউড এবং অ্যাপ থেকে সফলভাবে মুছে ফেলা হয়েছে!');
    } catch (err: any) {
      console.error('Error deleting course:', err);
      alert('Failed to delete course from cloud: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleUpdateSingleCourseOrder = async (courseId: string, newOrder: number) => {
    try {
      await setDoc(doc(db, 'courses', courseId), { order: newOrder }, { merge: true });
      setCustomCourses(prev => {
        const next = prev.map(c => c.id === courseId ? { ...c, order: newOrder } : c);
        safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(next));
        if (onCoursesUpdated) onCoursesUpdated(next);
        return next;
      });
    } catch (e) {
      console.error("Error updating course order:", e);
    }
  };

  const handleToggleCourseVisibility = async (courseId: string, currentHidden?: boolean) => {
    const newHidden = !currentHidden;
    try {
      // 1. Immediately update React state and LocalStorage for 0ms feedback
      setCustomCourses(prev => {
        const next = prev.map(c => c.id === courseId ? { ...c, hidden: newHidden } : c);
        safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(next));
        if (onCoursesUpdated) onCoursesUpdated(next);
        return next;
      });
      // 2. Persist directly to Firestore
      await setDoc(doc(db, 'courses', courseId), { hidden: newHidden }, { merge: true });
    } catch (e) {
      console.error("Error toggling course visibility:", e);
      alert('Failed to update course visibility.');
    }
  };

  const handleMoveCourseOrder = async (courseId: string, delta: number, currentList: Course[]) => {
    const sorted = [...currentList].sort((a, b) => (a.order !== undefined ? a.order : 999) - (b.order !== undefined ? b.order : 999));
    const idx = sorted.findIndex(c => c.id === courseId);
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= sorted.length) return;

    const itemA = sorted[idx];
    const itemB = sorted[newIdx];

    const orderA = itemB.order !== undefined ? itemB.order : newIdx;
    const orderB = itemA.order !== undefined ? itemA.order : idx;

    try {
      // Immediate optimistic UI update — don't wait on a refetch (the
      // onSnapshot listener will confirm/reconcile within its normal poll
      // cycle regardless).
      setCustomCourses(prev => {
        const next = prev.map(c => {
          if (c.id === itemA.id) return { ...c, order: orderA };
          if (c.id === itemB.id) return { ...c, order: orderB };
          return c;
        });
        safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(next));
        if (onCoursesUpdated) onCoursesUpdated(next);
        return next;
      });
      const batch = writeBatch(db);
      batch.set(doc(db, 'courses', itemA.id), { order: orderA }, { merge: true });
      batch.set(doc(db, 'courses', itemB.id), { order: orderB }, { merge: true });
      await batch.commit();
    } catch (e) {
      console.error("Error updating course order with writeBatch:", e);
    }
  };

  const fetchGlobalVerifiedPayments = async () => {
    setGlobalVpLoading(true);
    try {
      const snap = await getDoc(doc(db, 'system_settings', 'global_verified_payments'));
      if (snap.exists()) {
        setGlobalVerifiedPayments(snap.data().verifiedPayments || []);
      } else {
        setGlobalVerifiedPayments([]);
      }
    } catch (err) {
      console.error("Error fetching global verified payments:", err);
    } finally {
      setGlobalVpLoading(false);
    }
  };

  const cleanVpRecord = (vp: any) => ({
    bkashNumber: String(vp.bkashNumber || '').trim(),
    trxId: String(vp.trxId || '').trim(),
    amount: Number(vp.amount) || 30,
    createdAt: String(vp.createdAt || new Date().toISOString()),
    ...(vp.claimed ? { claimed: true } : {}),
    ...(vp.spent ? { spent: true } : {}),
    ...(vp.claimedBy ? { claimedBy: String(vp.claimedBy) } : {})
  });

  const handleAddGlobalVerifiedPayment = async () => {
    const num = newGlobalVpNumber.trim();
    const trx = newGlobalVpTrxId.trim();
    const amt = Number(newGlobalVpAmount) || 30;

    if (!num || !trx) {
      alert("Please enter both bKash Number and Transaction ID.");
      return;
    }

    const newRecord = cleanVpRecord({
      bkashNumber: num,
      trxId: trx,
      amount: amt,
      createdAt: new Date().toISOString()
    });

    const updated = [newRecord, ...globalVerifiedPayments.filter(vp => !(vp.bkashNumber === num && vp.trxId.toLowerCase() === trx.toLowerCase()))].map(cleanVpRecord);

    try {
      await setDoc(doc(db, 'system_settings', 'global_verified_payments'), { verifiedPayments: updated }, { merge: true });
      setGlobalVerifiedPayments(updated);
      setNewGlobalVpNumber('');
      setNewGlobalVpTrxId('');
      setNewGlobalVpAmount(75);
    } catch (err) {
      console.error("Error saving global verified payment:", err);
      alert("Failed to save verified payment: " + (err instanceof Error ? err.message : String(err)));
      return;
    }

    try {
      await handleRunCentralAutoVerification(updated);
    } catch (err) {
      console.error("Auto verification error:", err);
    }
  };

  const handleDeleteGlobalVerifiedPayment = async (num: string, trx: string) => {
    if (!confirm(`Remove bKash ${num} (${trx}) from verification gateway?`)) return;
    const updated = globalVerifiedPayments.filter(vp => !(vp.bkashNumber === num && vp.trxId.toLowerCase() === trx.toLowerCase())).map(cleanVpRecord);
    setGlobalVerifiedPayments(updated);
    try {
      await setDoc(doc(db, 'system_settings', 'global_verified_payments'), { verifiedPayments: updated }, { merge: true });
    } catch (err) {
      console.error("Error deleting global verified payment:", err);
    }
  };

  const handleBulkImportGlobalVp = async (textInput: string) => {
    if (!textInput.trim()) return;
    const lines = textInput.split(/\r?\n/);
    const parsed: { bkashNumber: string; trxId: string; amount: number; createdAt: string }[] = [];

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      const parts = cleanLine.split(/[,;\t\s]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const num = parts[0];
        const trx = parts[1];
        let amt = 75;
        if (parts[2] && !isNaN(Number(parts[2]))) {
          amt = Number(parts[2]);
        }
        parsed.push({
          bkashNumber: num,
          trxId: trx,
          amount: amt,
          createdAt: new Date().toISOString()
        });
      }
    }

    if (parsed.length === 0) {
      alert("No valid lines found. Format: MobileNumber, TrxID, Amount (e.g. 01712345678, 8N29X1A, 90)");
      return;
    }

    const existingKeys = new Set(globalVerifiedPayments.map(v => `${v.bkashNumber}_${v.trxId.toLowerCase()}`));
    const newItems = parsed.filter(item => !existingKeys.has(`${item.bkashNumber}_${item.trxId.toLowerCase()}`));

    const updated = [...newItems, ...globalVerifiedPayments].map(cleanVpRecord);

    try {
      await setDoc(doc(db, 'system_settings', 'global_verified_payments'), { verifiedPayments: updated }, { merge: true });
      setGlobalVerifiedPayments(updated);
      setGlobalVpPasteInput('');
    } catch (e) {
      console.error("Error saving bulk verified payments:", e);
      alert("Error saving bulk verified payments: " + (e instanceof Error ? e.message : String(e)));
      return;
    }

    try {
      await handleRunCentralAutoVerification(updated);
    } catch (err) {
      console.error("Auto verification error:", err);
    }
  };

  const handleRunCentralAutoVerification = async (currentVpsList?: typeof globalVerifiedPayments) => {
    setIsAutoVerifyingAll(true);
    setAutoVerifyResultMessage(null);

    try {
      const cleanPhone = (p?: any) => typeof p === 'string' ? p.replace(/\D/g, '').slice(-10) : '';

      const globalDocRef = doc(db, 'system_settings', 'global_verified_payments');
      const snap = await getDoc(globalDocRef);
      let vpsToUse: VerifiedPayment[] = (currentVpsList && Array.isArray(currentVpsList) && currentVpsList.length > 0)
        ? [...currentVpsList]
        : (snap.exists() ? (snap.data().verifiedPayments || []) : []);

      const coursesSnap = await getDocs(collection(db, 'courses'));
      const coursesMap: Record<string, Course> = {};
      coursesSnap.forEach(d => {
        const cData = { id: d.id, ...d.data() } as Course;
        coursesMap[d.id] = cData;
        if (Array.isArray(cData.verifiedPayments)) {
          cData.verifiedPayments.forEach(cvp => {
            if (!vpsToUse.some(v => v.bkashNumber === cvp.bkashNumber && v.trxId.toLowerCase() === cvp.trxId.toLowerCase())) {
              vpsToUse.push(cvp as VerifiedPayment);
            }
          });
        }
      });

      // Gather all pending access & recharge requests from state, Firestore and Server API
      const pendingReqMap = new Map<string, AccessRequest>();
      
      // 1. From local loaded state
      accessRequests.forEach(r => {
        if (r.status === 'pending' || !r.status || (r.status as string) === 'unverified') {
          pendingReqMap.set(r.id, r);
        }
      });

      // 2. From Firestore directly
      try {
        const requestsSnap = await getDocs(collection(db, 'access_requests'));
        requestsSnap.forEach(d => {
          const data = { id: d.id, ...d.data() } as AccessRequest;
          if (data.status === 'pending' || !data.status || (data.status as string) === 'unverified') {
            pendingReqMap.set(d.id, data);
          }
        });
      } catch (e) {
        console.warn("Firestore pending requests fetch notice:", e);
      }

      // 3. From Server API
      try {
        const apiRes = await fetch('/api/db/access_requests');
        if (apiRes.ok) {
          const json = await apiRes.json();
          const docs = json.docs || json.data || [];
          const list = Array.isArray(docs) ? docs : Object.values(docs);
          list.forEach((data: any) => {
            if (data?.id && (data.status === 'pending' || !data.status || data.status === 'unverified')) {
              pendingReqMap.set(data.id, data);
            }
          });
        }
      } catch (_) {}

      const pendingReqs = Array.from(pendingReqMap.values());

      if (pendingReqs.length === 0) {
        setAutoVerifyResultMessage("No pending requests found to verify.");
        setIsAutoVerifyingAll(false);
        return;
      }

      let autoApprovedRequestsCount = 0;
      let totalCoursesGranted = 0;
      let updatedVpList = [...vpsToUse];

      for (const req of pendingReqs) {
        const reqPhone = cleanPhone(req.bkashNumber || (req as any).phone || (req as any).senderPhone);
        const reqTrx = (req.trxId || '').toLowerCase().trim();
        const reqEmail = (req.email || req.requestedBy || '').toLowerCase().trim();

        if (!reqTrx || !reqEmail) continue;

        // Check if reqTrx is already locked by someone else in used_transactions
        try {
          const usedTxSnap = await getDoc(doc(db, 'used_transactions', reqTrx));
          if (usedTxSnap.exists() && (usedTxSnap.data().spent === true || usedTxSnap.data().status === 'spent')) {
            const usedByEmail = (usedTxSnap.data().email || usedTxSnap.data().usedBy || '').toLowerCase().trim();
            if (usedByEmail && usedByEmail !== reqEmail) {
              continue; // Claimed by another user
            }
          }
        } catch (e) {
          console.warn("used_transactions check notice:", e);
        }

        // Match against unclaimed/unspent verified payment in the list
        const matchedVpIdx = updatedVpList.findIndex(vp => {
          if (vp.claimed || vp.spent) return false;
          const vpPhone = cleanPhone(vp.bkashNumber);
          const vpTrx = (vp.trxId || '').toLowerCase().trim();
          
          if (vpTrx && reqTrx && vpTrx === reqTrx) return true;
          if (vpPhone && reqPhone && vpPhone === reqPhone && vpTrx === reqTrx) return true;
          return false;
        });

        const matchedVp = matchedVpIdx !== -1 ? updatedVpList[matchedVpIdx] : null;

        let walletRef = doc(db, 'user_wallets', reqEmail);
        let existingWalletBalance = 0;
        try {
          const walletSnap = await getDoc(walletRef);
          if (walletSnap.exists()) {
            existingWalletBalance = walletSnap.data().balance ?? walletSnap.data().walletBalance ?? 0;
          }
        } catch (_) {}

        const isRechargeReq = req.courseId === 'wallet_recharge' || 
                              req.courseTitle?.toLowerCase().includes('recharge') ||
                              req.courseTitle?.toLowerCase().includes('wallet');

        if (isRechargeReq) {
          if (matchedVp) {
            const rechargeAmt = matchedVp.amount || Number((req as any).amount) || Number(req.totalPrice) || Number(req.price) || 0;
            const newBal = existingWalletBalance + rechargeAmt;
            const nowISO = new Date().toISOString();
            
            // 1. Lock in used_transactions
            try {
              await setDoc(doc(db, 'used_transactions', reqTrx), {
                trxId: reqTrx,
                spent: true,
                status: 'spent',
                email: reqEmail,
                usedBy: reqEmail,
                bkashNumber: req.bkashNumber || matchedVp.bkashNumber || '',
                amount: rechargeAmt,
                createdAt: nowISO,
                usedAt: nowISO
              }, { merge: true });
            } catch (_) {}

            // 2. Mark payment as claimed and spent in verified list
            updatedVpList[matchedVpIdx] = {
              ...matchedVp,
              spent: true,
              claimed: true,
              claimedBy: reqEmail,
              claimedAt: nowISO,
              spentAt: nowISO
            };

            // 3. Update user_wallets collection in Firestore
            try {
              await setDoc(walletRef, {
                email: reqEmail,
                bkashNumber: req.bkashNumber || matchedVp.bkashNumber || '',
                balance: newBal,
                walletBalance: newBal,
                updatedAt: nowISO
              }, { merge: true });
            } catch (_) {}

            // 4. Sync balance to users collection (by query and by doc ID)
            try {
              const uQuery = query(collection(db, 'users'), where('email', '==', reqEmail));
              const uSnap = await getDocs(uQuery);
              if (!uSnap.empty) {
                for (const uDoc of uSnap.docs) {
                  await setDoc(doc(db, 'users', uDoc.id), {
                    walletBalance: newBal,
                    balance: newBal,
                    updatedAt: nowISO
                  }, { merge: true });
                }
              }
            } catch (_) {}

            try {
              await setDoc(doc(db, 'users', reqEmail), {
                email: reqEmail,
                walletBalance: newBal,
                balance: newBal,
                updatedAt: nowISO
              }, { merge: true });
            } catch (_) {}

            // 5. Update access request status
            try {
              await setDoc(doc(db, 'access_requests', req.id), {
                status: 'approved',
                verificationMethod: 'auto',
                spent: true,
                spentAt: nowISO,
                price: rechargeAmt,
                totalPrice: rechargeAmt,
                remainingWalletBalance: newBal,
                updatedAt: nowISO
              }, { merge: true });
            } catch (_) {}

            // 6. Update Server API backup storage
            try {
              await fetch('/api/db/user_wallets/doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: reqEmail,
                  data: { email: reqEmail, balance: newBal, walletBalance: newBal, updatedAt: nowISO }
                })
              });
              await fetch('/api/db/users/doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: reqEmail,
                  data: { email: reqEmail, balance: newBal, walletBalance: newBal, updatedAt: nowISO }
                })
              });
              await fetch('/api/db/access_requests/doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: req.id,
                  data: { status: 'approved', verificationMethod: 'auto', spent: true, price: rechargeAmt, totalPrice: rechargeAmt, remainingWalletBalance: newBal, updatedAt: nowISO }
                })
              });
            } catch (_) {}

            // 7. Update UI state optimistically
            setAccessRequests(prev => prev.map(r => r.id === req.id ? { 
              ...r, 
              status: 'approved', 
              verificationMethod: 'auto', 
              spent: true, 
              price: rechargeAmt, 
              totalPrice: rechargeAmt, 
              remainingWalletBalance: newBal 
            } : r));

            setUsers(prev => prev.map(u => u.email.toLowerCase() === reqEmail ? { ...u, walletBalance: newBal, balance: newBal } : u));

            autoApprovedRequestsCount++;
          }
          continue;
        }

        let totalFundsAvailable = existingWalletBalance + (matchedVp ? (matchedVp.amount || req.totalPrice || req.price || 30) : 0);

        if (matchedVp || existingWalletBalance > 0) {
          let targetIds: string[] = [];
          if (req.courseIds && req.courseIds.length > 0) {
            targetIds = req.courseIds;
          } else if (req.courseId && req.courseId !== 'multi_cart') {
            targetIds = [req.courseId];
          }

          let approvedTargetIds: string[] = [];
          let remainingBalance = totalFundsAvailable;

          for (const cid of targetIds) {
            const courseObj = coursesMap[cid];
            const coursePrice = (courseObj && courseObj.price && courseObj.price > 0) ? courseObj.price : (req.price || 30);

            if (remainingBalance >= coursePrice) {
              approvedTargetIds.push(cid);
              remainingBalance -= coursePrice;

              if (courseObj) {
                const currentAllowed = courseObj.allowedUsers || [];
                if (!currentAllowed.includes(reqEmail)) {
                  const updatedAllowed = [...currentAllowed, reqEmail];
                  courseObj.allowedUsers = updatedAllowed;
                  try {
                    await setDoc(doc(db, 'courses', cid), { allowedUsers: updatedAllowed }, { merge: true });
                  } catch (_) {}
                }
              }
              totalCoursesGranted++;
            }
          }

          if (approvedTargetIds.length > 0) {
            autoApprovedRequestsCount++;
            const nowISO = new Date().toISOString();

            if (matchedVp) {
              // Lock in used_transactions
              try {
                await setDoc(doc(db, 'used_transactions', reqTrx), {
                  trxId: reqTrx,
                  spent: true,
                  status: 'spent',
                  email: reqEmail,
                  usedBy: reqEmail,
                  bkashNumber: req.bkashNumber || matchedVp.bkashNumber || '',
                  amount: req.totalPrice || req.price || 0,
                  createdAt: nowISO,
                  usedAt: nowISO
                }, { merge: true });
              } catch (_) {}

              updatedVpList[matchedVpIdx] = {
                ...matchedVp,
                spent: true,
                claimed: true,
                claimedBy: reqEmail,
                claimedAt: nowISO,
                spentAt: nowISO
              };
            }

            try {
              await setDoc(walletRef, {
                email: reqEmail,
                bkashNumber: req.bkashNumber || '',
                balance: remainingBalance,
                walletBalance: remainingBalance,
                updatedAt: nowISO
              }, { merge: true });
            } catch (_) {}

            // Sync remaining balance to users collection
            try {
              const uQuery = query(collection(db, 'users'), where('email', '==', reqEmail));
              const uSnap = await getDocs(uQuery);
              if (!uSnap.empty) {
                for (const uDoc of uSnap.docs) {
                  await setDoc(doc(db, 'users', uDoc.id), {
                    walletBalance: remainingBalance,
                    balance: remainingBalance,
                    updatedAt: nowISO
                  }, { merge: true });
                }
              }
            } catch (_) {}

            try {
              await setDoc(doc(db, 'users', reqEmail), {
                email: reqEmail,
                walletBalance: remainingBalance,
                balance: remainingBalance,
                updatedAt: nowISO
              }, { merge: true });
            } catch (_) {}

            try {
              await setDoc(doc(db, 'access_requests', req.id), {
                status: 'approved',
                verificationMethod: matchedVp ? 'auto' : 'wallet_balance',
                spent: matchedVp ? true : false,
                spentAt: matchedVp ? nowISO : undefined,
                approvedCoursesCount: approvedTargetIds.length,
                remainingWalletBalance: remainingBalance,
                updatedAt: nowISO
              }, { merge: true });
            } catch (_) {}

            setAccessRequests(prev => prev.map(r => r.id === req.id ? { 
              ...r, 
              status: 'approved', 
              verificationMethod: matchedVp ? 'auto' : 'wallet_balance', 
              spent: matchedVp ? true : false,
              remainingWalletBalance: remainingBalance 
            } : r));

            setUsers(prev => prev.map(u => u.email.toLowerCase() === reqEmail ? { ...u, walletBalance: remainingBalance, balance: remainingBalance } : u));
          }
        }
      }

      // Save updated VP claim status list back to Firestore
      try {
        await setDoc(globalDocRef, { verifiedPayments: updatedVpList }, { merge: true });
      } catch (_) {}
      setGlobalVerifiedPayments(updatedVpList);

      fetchAccessRequests();
      setAutoVerifyResultMessage(`Auto-verification complete! Approved ${autoApprovedRequestsCount} requests and granted access to ${totalCoursesGranted} courses.`);
    } catch (err) {
      console.error("Error running central auto-verification:", err);
      setAutoVerifyResultMessage("Error occurred during auto-verification execution.");
    } finally {
      setIsAutoVerifyingAll(false);
    }
  };

  const handleOpenEditModal = (course: Course) => {
    setEditingCourse(course);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`Copied: ${text}`);
  };

  // Processing users stats
  const totalUsers = users.length;
  
  const averageStreak = totalUsers > 0 
    ? Math.round(users.reduce((acc, curr) => acc + (curr.goal?.streak || 0), 0) / totalUsers)
    : 0;

  const topStreak = totalUsers > 0
    ? Math.max(...users.map(u => u.goal?.streak || 0))
    : 0;

  const totalWordsKnownAll = users.reduce((acc, u) => {
    if (!u.progress) return acc;
    return acc + getProgressValues(u.progress).filter(p => p.status === 'know').length;
  }, 0);

  const averageWordsKnown = totalUsers > 0 ? Math.round(totalWordsKnownAll / totalUsers) : 0;

  // Filter & Sort Users
  const filteredUsers = users
    .filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'email') {
        return a.email.localeCompare(b.email);
      } else if (sortBy === 'streak') {
        return (b.goal?.streak || 0) - (a.goal?.streak || 0);
      } else if (sortBy === 'progress') {
        const aKnown = getProgressValues(a.progress).filter(p => p.status === 'know').length;
        const bKnown = getProgressValues(b.progress).filter(p => p.status === 'know').length;
        return bKnown - aKnown;
      } else {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      }
    });

  // Paginated Users for Lean Memory
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / userPerPage));
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * userPerPage;
    return filteredUsers.slice(start, start + userPerPage);
  }, [filteredUsers, userPage, userPerPage]);

  // Default course with potential Firestore updates
  const dbGreCourse = customCourses.find(c => c.id.trim().toLowerCase() === 'gre');
  const defaultGreCourse: Course = {
    ...(dbGreCourse || {}),
    id: dbGreCourse?.id || 'gre',
    title: dbGreCourse?.title || 'Free Vocabularies',
    description: dbGreCourse?.description || 'Standard free preparation course with 1,110 high-frequency words grouped into 37 levels.',
    totalGroups: dbGreCourse?.totalGroups || (dbGreCourse?.words && dbGreCourse.words.length > 0 ? new Set(dbGreCourse.words.map(w => w.group)).size : 37),
    words: (dbGreCourse?.words && dbGreCourse.words.length > 0) ? dbGreCourse.words : words,
    stories: dbGreCourse?.stories || [],
    articles: dbGreCourse?.articles || [],
    enabledGames: dbGreCourse?.enabledGames || { quiz: true, match: true, synonym: true, blank: true, story: true, article: true },
    isDefault: true,
    isRestricted: false,
    allowedUsers: dbGreCourse?.allowedUsers || [],
    price: 0,
    order: dbGreCourse?.order !== undefined ? dbGreCourse.order : 0,
    bkashNumber: (dbGreCourse?.bkashNumber && dbGreCourse.bkashNumber !== '01700000000' && dbGreCourse.bkashNumber.trim() !== '') ? dbGreCourse.bkashNumber : '01581624202',
    googleSearchQuery: dbGreCourse?.googleSearchQuery || '',
    createdAt: dbGreCourse?.createdAt || new Date('2026-01-01').toISOString(),
    createdBy: dbGreCourse?.createdBy || 'system'
  };

  const filteredCustomCoursesList = customCourses.filter(c => c.id.trim().toLowerCase() !== 'gre');
  const allAdminCoursesList = [defaultGreCourse, ...filteredCustomCoursesList].sort((a, b) => {
    if (courseSortMode === 'clickFrequency') {
      const clicksA = typeof a.clickCount === 'number' ? a.clickCount : 0;
      const clicksB = typeof b.clickCount === 'number' ? b.clickCount : 0;
      if (clicksB !== clicksA) return clicksB - clicksA;
    }
    return (a.order !== undefined ? a.order : 999) - (b.order !== undefined ? b.order : 999);
  });

  const searchedCoursesList = allAdminCoursesList.filter(c => {
    if (!courseSearchQuery.trim()) return true;
    const q = courseSearchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q));
  });

  // Paginated Courses for Lean Memory
  const totalCoursePages = Math.max(1, Math.ceil(searchedCoursesList.length / coursePerPage));
  const paginatedCoursesList = useMemo(() => {
    const start = (coursePage - 1) * coursePerPage;
    return searchedCoursesList.slice(start, start + coursePerPage);
  }, [searchedCoursesList, coursePage, coursePerPage]);

  const handleSyncOrderToClicks = async () => {
    if (!window.confirm("Sync all courses' order numbers (#1, #2, #3...) to match their current click frequency rank?")) return;
    try {
      const updatedList = allAdminCoursesList.map((c, idx) => ({
        ...c,
        order: idx + 1
      }));
      await saveBulkDocs('courses', updatedList);
      setCustomCourses(prev => prev.map(c => {
        const found = updatedList.find(u => u.id === c.id);
        return found ? { ...c, order: found.order } : c;
      }));
      alert("All course order numbers updated and saved based on click frequency!");
    } catch (err) {
      console.error("Error syncing course order:", err);
      alert("Failed to sync course order.");
    }
  };

  const handleAdminIncrementClick = async (courseId: string) => {
    await incrementCourseClickCount(courseId);
    setCustomCourses(prev => prev.map(c => c.id === courseId ? { ...c, clickCount: (c.clickCount || 0) + 1 } : c));
  };

  const getCourseUserCount = (courseId: string) => {
    return users.filter(u => {
      const enrolled = (u as any).enrolledCourseIds || [];
      if (Array.isArray(enrolled) && enrolled.includes(courseId)) return true;
      if (courseId.trim().toLowerCase() === 'gre') return true;
      return false;
    }).length;
  };

  const handlePurgeAllGameData = async () => {
    if (!window.confirm("WARNING: Are you sure you want to delete ALL game questions (Blank Filling, Odd One Out, Word Analogy, MCQ) across ALL courses? This will wipe all game data in local storage, server file cache, and Supabase.")) {
      return;
    }
    try {
      await clearCollectionDocs('blank_questions');
      await clearCollectionDocs('odd_one_out_questions');
      await clearCollectionDocs('word_analogy_questions');
      await clearCollectionDocs('mcq_questions');
      alert("All game questions across all collections have been completely wiped!");
    } catch (err) {
      console.error("Error purging game data:", err);
      alert("Failed to clear some game data.");
    }
  };

  return (
    <div className="space-y-8 font-sans" id="admin-panel-container">
      {/* Fixed Confirmation Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 font-semibold text-xs transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === 'success' 
              ? 'bg-slate-900 text-emerald-300 border-emerald-500/50 shadow-emerald-900/30' 
              : toastMessage.type === 'error'
              ? 'bg-slate-900 text-rose-300 border-rose-500/50 shadow-rose-900/30'
              : 'bg-slate-900 text-indigo-300 border-indigo-500/50 shadow-indigo-900/30'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toastMessage.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
          <span>{toastMessage.text}</span>
          <button 
            onClick={() => setToastMessage(null)} 
            className="ml-2 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md relative overflow-hidden border border-indigo-500/10" id="admin-header-banner">
        <div className="relative z-10 flex flex-row items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-500/20 rounded-full text-indigo-300 text-[10px] font-extrabold border border-indigo-400/20">
              <ShieldCheck className="w-3 h-3" /> Admin
            </div>
            <h2 className="text-base sm:text-xl font-extrabold tracking-tight">Vocab Admin</h2>
          </div>
          
          <button 
            onClick={fetchUsersData}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Synchronous Admin Diagnostic Check Alert Banner */}
      {!isAuthorizedAdminSync && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-start gap-3 shadow-sm" id="admin-diagnostic-warning">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">Diagnostic Notice: Admin Email Verification</h4>
            <p className="text-amber-700/90 dark:text-amber-200/90 leading-relaxed">
              Current authenticated email: <code className="bg-amber-200/50 dark:bg-amber-900/50 px-1.5 py-0.5 rounded font-mono font-bold text-amber-900 dark:text-amber-100">{currentAuthEmail || 'Not Authenticated / Anonymous'}</code>.
              {currentAuthEmail ? ' This account is not listed in the authorized admin list.' : ' Please sign in as an admin.'}
              Write operations to Firestore collections are safeguarded to prevent permissions buffering.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3" id="admin-stats-row">
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/60 shadow-2xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-tight block truncate">Total Users</span>
            <span className="text-base sm:text-lg font-black text-slate-800 font-mono">{totalUsers}</span>
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/60 shadow-2xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-tight block truncate">Avg Streak</span>
            <span className="text-base sm:text-lg font-black text-slate-800 font-mono">{averageStreak}d</span>
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/60 shadow-2xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-tight block truncate">Avg Words</span>
            <span className="text-base sm:text-lg font-black text-slate-800 font-mono">{averageWordsKnown}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 text-white p-2.5 sm:p-3 rounded-xl shadow-2xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-tight block truncate">Database</span>
              <span className="text-xs sm:text-sm font-black text-emerald-400 truncate block">Active</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowSupabaseRlsModal(true)}
              className="p-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold transition cursor-pointer"
              title="Copy RLS Script"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handlePurgeAllGameData}
              className="p-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-bold transition cursor-pointer"
              title="Purge Games"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Backend Ping & Connection Diagnostic Banner */}
      <SupabaseStatusBanner className="shadow-sm" />

      {/* Admin Tab Navigation — single consistent style for every tab
          (previously each tab had its own ad-hoc color: indigo, emerald,
          purple, amber... with no consistent meaning behind the choice).
          Active = solid dark; inactive = quiet gray; badges are a single
          neutral pill style, with a red dot reserved for "needs attention"
          counts specifically. */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'courses' as const, label: 'Courses', icon: FileSpreadsheet, badge: customCourses.length, onClick: () => setActiveAdminTab('courses') },
          { id: 'question-bank' as const, label: 'Question Bank', icon: Database, onClick: () => setActiveAdminTab('question-bank') },
          { id: 'blank-questions' as const, label: 'Game Upload', icon: Award, onClick: () => setActiveAdminTab('blank-questions') },
          { id: 'exam-summary' as const, label: 'Exam Summary', icon: Calendar, onClick: () => setActiveAdminTab('exam-summary') },
          { id: 'users' as const, label: 'Users', icon: Users, onClick: () => setActiveAdminTab('users') },
          { id: 'reports' as const, label: 'Reports', icon: AlertTriangle, badge: reports.length, onClick: () => { setActiveAdminTab('reports'); fetchReports(); } },
          {
            id: 'access-requests' as const,
            label: 'bKash',
            icon: Zap,
            alert: accessRequests.filter(r => r.status === 'pending').length > 0,
            onClick: () => { setActiveAdminTab('access-requests'); fetchAccessRequests(); fetchGlobalVerifiedPayments(); },
          },
          { id: 'activity-logs' as const, label: 'Logs', icon: History, onClick: () => setActiveAdminTab('activity-logs') },
          { id: 'system-settings' as const, label: 'Settings', icon: Sliders, onClick: () => setActiveAdminTab('system-settings') },
          { id: 'landing-editor' as const, label: 'Editor', icon: LayoutTemplate, onClick: () => setActiveAdminTab('landing-editor') },
          { id: 'transaction-debugger' as const, label: 'Tx Debugger', icon: Bug, onClick: () => setActiveAdminTab('transaction-debugger') },
          { id: 'migration' as const, label: 'Cloud Migration', icon: Cloud, onClick: () => setActiveAdminTab('migration') },
        ].map((item) => {
          const isActive = activeAdminTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              title={item.badge !== undefined ? `${item.label} (${item.badge})` : item.label}
              className={`px-2.5 sm:px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 flex-1 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="hidden sm:inline whitespace-nowrap">{item.label}</span>
              {item.badge !== undefined && (
                <span className={`hidden sm:inline-block px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  {item.badge}
                </span>
              )}
              {item.alert && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Cloud Migration Tab View */}
      {activeAdminTab === 'migration' && (
        <SupabaseMigrationCenter />
      )}

      {/* Question Bank Tab View */}
      {activeAdminTab === 'question-bank' && (
        <QuestionBankView courses={customCourses} />
      )}

      {/* Course Exams Summary View */}
      {activeAdminTab === 'exam-summary' && (
        <CourseExamsSummaryView
          courses={customCourses}
          onNavigateToQuestionBank={(courseId) => setActiveAdminTab('question-bank')}
        />
      )}

      {/* Main Grid: Directory */}
      {activeAdminTab === 'users' && (
        <div className="grid grid-cols-1 gap-6">
          {/* User Directory Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">User Directory</h3>
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by email..."
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs rounded-xl w-48 transition font-semibold"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-600">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent border-none outline-none text-xs font-bold text-slate-600 cursor-pointer pr-1"
                  >
                    <option value="lastActive">Recently Active</option>
                    <option value="email">Alphabetical</option>
                    <option value="streak">Streak (🔥)</option>
                    <option value="progress">Progress (Learned)</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-xs font-bold">Fetching real-time data from Supabase Cloud DB...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-500 flex flex-col items-center justify-center gap-3">
                <AlertTriangle className="w-8 h-8" />
                <p className="text-xs font-bold">{error}</p>
                <button 
                  onClick={fetchUsersData}
                  className="px-4 py-2 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-100 hover:bg-rose-100 transition"
                >
                  Retry
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Users className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-bold">No users matched your query.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-4 px-6 text-left">Student Profile</th>
                      <th className="py-4 px-3 text-center">Streak</th>
                      <th className="py-4 px-4 text-left">Progress Breakdown</th>
                      <th className="py-4 px-4 text-right">Last Synced</th>
                      <th className="py-4 px-4 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-sans">
                    {paginatedUsers.map(u => {
                      const stats = getUserOverallStatsAndRank(u, users, allAdminCoursesList, accessRequests, words);
                      const enrolledCourses = stats.enrolledCourses;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-extrabold border border-slate-200 text-xs flex-shrink-0">
                                {u.email[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-slate-800 truncate" title={u.email}>
                                  {u.email.split('@')[0]}
                                </p>
                                <span className="text-[10px] text-slate-400 font-semibold block truncate" title={u.email}>
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-center">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 font-black rounded-full font-mono text-[11px]">
                              <Flame className="w-3.5 h-3.5 text-amber-500" />
                              <span>{u.goal?.streak || 0} d</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="space-y-1.5 min-w-[210px]">
                              {/* Top row stats + Rank */}
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-black text-[9px] border border-indigo-100">
                                    🏆 Rank #{stats.rank}
                                  </span>
                                  <span>{stats.totalKnow}/{stats.totalTargetWords} ({stats.overallPercent}%)</span>
                                </div>
                                <span className="text-[9px] font-semibold text-slate-400">
                                  {stats.totalConfusion}❓ • {stats.totalDontKnow}❌
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${stats.overallPercent}%` }} />
                                <div className="bg-amber-400 h-full transition-all" style={{ width: `${Math.round((stats.totalConfusion / stats.totalTargetWords) * 100)}%` }} />
                                <div className="bg-rose-400 h-full transition-all" style={{ width: `${Math.round((stats.totalDontKnow / stats.totalTargetWords) * 100)}%` }} />
                              </div>

                              {/* Enrolled course badges */}
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {enrolledCourses.slice(0, 2).map(c => (
                                  <span key={c.id} className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 truncate max-w-[110px]" title={c.title}>
                                    {c.title}
                                  </span>
                                ))}
                                {enrolledCourses.length > 2 && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                                    +{enrolledCourses.length - 2} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-[10px] text-slate-500 font-mono font-semibold">
                              {u.updatedAt ? new Date(u.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedUser(u)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black transition cursor-pointer shadow-xs flex items-center justify-center gap-1 mx-auto"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls for Users */}
            {filteredUsers.length > 0 && !loading && !error && (
              <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <span>
                    Showing <strong>{((userPage - 1) * userPerPage) + 1}</strong> to <strong>{Math.min(userPage * userPerPage, filteredUsers.length)}</strong> of <strong>{filteredUsers.length}</strong> users
                  </span>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500">Per page:</span>
                    <select
                      value={userPerPage}
                      onChange={(e) => {
                        setUserPerPage(Number(e.target.value));
                        setUserPage(1);
                      }}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-hidden"
                    >
                      <option value={8}>8</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setUserPage(prev => Math.max(1, prev - 1))}
                    disabled={userPage <= 1}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold border border-slate-200 rounded-lg transition cursor-pointer disabled:cursor-not-allowed text-xs"
                  >
                    Previous
                  </button>

                  <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-100 rounded-lg text-xs">
                    Page {userPage} of {totalUserPages}
                  </span>

                  <button
                    onClick={() => setUserPage(prev => Math.min(totalUserPages, prev + 1))}
                    disabled={userPage >= totalUserPages}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold border border-slate-200 rounded-lg transition cursor-pointer disabled:cursor-not-allowed text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeAdminTab === 'courses' && (
        <div className="space-y-6">
          {/* Minimalist Course Management Table */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-100/90 shadow-2xs space-y-5 w-full" style={{ fontFamily: "'Poppins', sans-serif" }}>
            
            {/* Header & Controls Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100/80">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Course Management</h3>
                <span className="text-xs font-normal text-slate-400">({allAdminCoursesList.length})</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search Bar */}
                <div className="relative min-w-[180px] flex-1 sm:flex-none">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={courseSearchQuery}
                    onChange={(e) => setCourseSearchQuery(e.target.value)}
                    placeholder="Search courses..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50/80 border border-slate-200/60 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {courseSearchQuery && (
                    <button 
                      onClick={() => setCourseSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Single Filter / Sort Dropdown Menu */}
                <div className="relative">
                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'clicks') setCourseSortMode('clickFrequency');
                      if (val === 'manual') setCourseSortMode('manualOrder');
                      if (val === 'sync_rank') handleSyncOrderToClicks();
                      if (val === 'bulk_csv') {
                        if (allAdminCoursesList.length > 0) setBulkCsvCourse(allAdminCoursesList[0]);
                      }
                    }}
                    value={courseSortMode === 'clickFrequency' ? 'clicks' : 'manual'}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-medium rounded-xl focus:outline-none cursor-pointer appearance-none pr-7 transition"
                  >
                    <option value="clicks">Sort: By Clicks</option>
                    <option value="manual">Sort: By Order #</option>
                    <option value="sync_rank">Action: Sync Rank to Order</option>
                    <option value="bulk_csv">Action: Bulk CSV Access</option>
                  </select>
                  <Filter className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Primary CTA: Create Course */}
                <button
                  onClick={() => setShowCreateCourseModal(true)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Course</span>
                </button>
              </div>
            </div>

            {/* Borderless Well-Padded Minimalist Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-3 text-center w-14">Rank</th>
                    <th className="py-3 px-3 text-center w-20">Clicks</th>
                    <th className="py-3 px-3 w-20">ID</th>
                    <th className="py-3 px-3">Title & Description</th>
                    <th className="py-3 px-3 text-center w-16">Words</th>
                    <th className="py-3 px-3 text-center w-16">Users</th>
                    <th className="py-3 px-3 text-center w-20">Price</th>
                    <th className="py-3 px-3 text-center w-20">Access</th>
                    <th className="py-3 px-3 text-center w-24">Visibility</th>
                    <th className="py-3 px-3 text-center w-20">Order</th>
                    <th className="py-3 px-3 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 bg-white">
                  {searchedCoursesList.map((c, index) => {
                    const isDefault = c.id.trim().toLowerCase() === 'gre';
                    const wordCount = c.words?.length || (isDefault ? vocabulary.length : 0);
                    const userCount = getCourseUserCount(c.id);
                    const price = (c.price && c.price > 0) ? c.price : 30;
                    const clickCount = typeof c.clickCount === 'number' ? c.clickCount : 0;
                    const rankNumber = index + 1;
                    const isHidden = !!c.hidden;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                        
                        {/* Column 1: Plain Rank Number */}
                        <td className="py-3 px-3 text-center font-medium text-slate-500">
                          #{rankNumber}
                        </td>

                        {/* Column 2: Click Frequency */}
                        <td className="py-3 px-3 text-center text-slate-700 font-medium">
                          {clickCount.toLocaleString()}
                        </td>

                        {/* Column 3: Plain ID Code */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500 uppercase">
                          {c.id}
                        </td>

                        {/* Column 4: Title & Description */}
                        <td className="py-3 px-3">
                          <div 
                            className="cursor-pointer hover:text-indigo-600 transition"
                            onClick={() => setEditingCourse(c)}
                          >
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{c.title}</span>
                              {isDefault && (
                                <span className="text-[10px] text-indigo-600 font-medium">
                                  (Default)
                                </span>
                              )}
                            </div>
                            {c.description && (
                              <div className="text-[11px] text-slate-400 line-clamp-1 font-normal">
                                {c.description}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Column 5: Words Count */}
                        <td className="py-3 px-3 text-center text-slate-600">
                          {wordCount}
                        </td>

                        {/* Column 6: Users Count */}
                        <td className="py-3 px-3 text-center text-slate-600">
                          {userCount}
                        </td>

                        {/* Column 7: Price */}
                        <td className="py-3 px-3 text-center font-medium text-slate-800">
                          {price === 0 ? 'Free' : `৳${price}`}
                        </td>

                        {/* Column 8: Access Status */}
                        <td className="py-3 px-3 text-center text-slate-500">
                          {c.isRestricted ? 'Restricted' : 'Public'}
                        </td>

                        {/* Column 9: Visibility (Instant 1-Click Toggle) */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCourseVisibility(c.id, c.hidden)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                              isHidden
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                            title={isHidden ? "Course is Hidden. Click to make Visible to all users" : "Course is Visible. Click to Hide from users"}
                          >
                            {isHidden ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                                <span>Hidden</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Visible</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Column 10: Manual Order Number */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            value={c.order !== undefined ? c.order : 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              const newOrder = isNaN(val) ? 0 : val;
                              handleUpdateSingleCourseOrder(c.id, newOrder);
                            }}
                            className="w-10 px-1 py-0.5 text-center font-medium text-slate-700 bg-slate-50/80 border border-slate-200/60 rounded text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </td>

                        {/* Column 11: Actions */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setBulkCsvCourse(c)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                              title="Bulk Add Students"
                            >
                              <Users className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(c)}
                              className="px-2.5 py-1 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-medium transition cursor-pointer"
                              title="Edit Course"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(c.id);
                                alert(`Course Code "${c.id}" copied to clipboard!`);
                              }}
                              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-medium transition cursor-pointer"
                              title="Copy Code"
                            >
                              Copy
                            </button>
                            {!isDefault && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCourse(c.id)}
                                className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium transition cursor-pointer"
                                title="Delete Course"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {searchedCoursesList.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400 font-medium">
                        No courses found matching "{courseSearchQuery}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeAdminTab === 'reports' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">User Word Issue Reports</h3>
          </div>

          {reportsLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              <span className="text-xs font-bold font-mono">Loading active issue logs...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-700">All Clear!</p>
                <p className="text-[10px] text-slate-400 font-semibold">No issues or incorrect vocabulary translations have been reported yet.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto w-full border border-slate-200/80 rounded-2xl bg-white shadow-2xs">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 font-mono uppercase h-10">
                    <th className="px-4 py-2">Word Details</th>
                    <th className="px-4 py-2">Issue Category</th>
                    <th className="px-4 py-2">Report Description</th>
                    <th className="px-4 py-2">Reported By</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-sans text-xs">
                  {reports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            // Find the course
                            let targetCourse: Course | undefined = undefined;
                            if (rep.courseId === 'gre') {
                              targetCourse = defaultGreCourse;
                            } else {
                              targetCourse = customCourses.find(c => c.id === rep.courseId);
                            }

                            if (!targetCourse) {
                              alert(`Course for this word (ID: ${rep.courseId || 'unknown'}) was not found.`);
                              return;
                            }

                            setCourseSettingsInitialTab('wordlist');
                            setCourseSettingsInitialEditWordName(rep.word);
                            setEditingCourse(targetCourse);
                          }}
                          className="font-extrabold text-indigo-600 hover:text-indigo-800 text-sm hover:underline cursor-pointer text-left flex items-center gap-1.5 focus:outline-none"
                          title="Click to directly edit this word inside course list"
                        >
                          <span>{rep.word}</span>
                          <Edit className="w-3.5 h-3.5 opacity-60 inline" />
                        </button>
                        <div className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wide mt-0.5">
                          Course ID: {rep.courseId || 'unknown'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-700 font-black rounded-full text-[10px] uppercase font-mono tracking-wider border border-amber-200/50">
                          {rep.issueType?.replace('_', ' ') || 'Other Error'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-650 font-medium max-w-xs truncate" title={rep.description}>
                        {rep.description || <span className="text-slate-350 italic">No description provided</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700 text-[11px]">{rep.reportedBy?.split('@')[0]}</div>
                        <div className="text-[9px] text-slate-450 font-mono font-semibold mt-0.5">
                          {rep.reportedAt ? new Date(rep.reportedAt).toLocaleString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              // If they want to inspect the details
                              alert(`Word: ${rep.word}\nIssue: ${rep.issueType}\n\nDescription:\n${rep.description || 'No description'}\n\nReported By: ${rep.reportedBy}\nAt: ${rep.reportedAt}`);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
                            title="Inspect Details"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleResolveReport(rep.id)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold rounded-lg text-[10px] transition cursor-pointer"
                          >
                            Resolve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeAdminTab === 'access-requests' && (
        <div className="space-y-6 font-sans" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {/* Sub-Tab Navigation Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setRequestsSubTab('pending');
                  fetchAccessRequests();
                }}
                className={`px-4 py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-2 ${
                  requestsSubTab === 'pending'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>📋 Pending Requests ({accessRequests.filter(r => r.status === 'pending').length})</span>
                {accessRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setRequestsSubTab('autoverify');
                  fetchGlobalVerifiedPayments();
                }}
                className={`px-4 py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-2 ${
                  requestsSubTab === 'autoverify'
                    ? 'bg-amber-400 text-slate-950 shadow-2xs border border-amber-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>⚡ bKash Gateway ({globalVerifiedPayments.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRequestsSubTab('history');
                  fetchAccessRequests();
                }}
                className={`px-4 py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-2 ${
                  requestsSubTab === 'history'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-4 h-4 text-emerald-600" />
                <span>📜 Transaction History ({accessRequests.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setRequestsSubTab('debugger')}
                className={`px-4 py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-2 ${
                  requestsSubTab === 'debugger'
                    ? 'bg-indigo-600 text-white shadow-2xs border border-indigo-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bug className="w-4 h-4 text-amber-300" />
                <span>🛠️ Tx Debugger ({transactionLogs.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => handleRunCentralAutoVerification()}
                disabled={isAutoVerifyingAll}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 fill-slate-950 ${isAutoVerifyingAll ? 'animate-spin' : ''}`} />
                <span>{isAutoVerifyingAll ? 'Verifying...' : '⚡ Auto-Verify All'}</span>
              </button>
            </div>
          </div>

          {requestsSubTab === 'pending' ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Course Access & Balance Requests</h3>
                  <p className="text-xs text-slate-400 font-medium">Verify bKash transactions, approve course access, and manage wallet balance recharges.</p>
                </div>
                <button
                  onClick={fetchAccessRequests}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer self-start sm:self-center"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${accessRequestsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

            {accessRequestsLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                <span className="text-xs font-bold font-mono">Loading access requests...</span>
              </div>
            ) : accessRequests.filter(r => r.status === 'pending').length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-700">No pending requests found</p>
                  <p className="text-[10px] text-slate-400 font-semibold">All student access & wallet recharge requests have been processed!</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto w-full border border-slate-200/80 rounded-2xl bg-white shadow-2xs">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-400 font-mono uppercase h-9">
                      <th className="px-3 py-2">Course Details</th>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Student Email</th>
                      <th className="px-3 py-2">bKash Number</th>
                      <th className="px-3 py-2">Trx ID</th>
                      <th className="px-3 py-2">Access</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-sans text-xs">
                    {accessRequests.filter(r => r.status === 'pending').map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-3 py-2.5">
                          {req.courseIds && req.courseIds.length > 1 ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded-md border border-indigo-200/60">
                                🛒 Bundle ({req.courseIds.length})
                              </span>
                              <div className="text-[11px] font-bold text-slate-800 space-y-0.5">
                                {req.courseTitles && req.courseTitles.length > 0 ? (
                                  req.courseTitles.map((t, idx) => (
                                    <div key={idx} className="truncate max-w-[180px] text-slate-700" title={t}>
                                      • {t}
                                    </div>
                                  ))
                                ) : (
                                  <div className="truncate max-w-[180px]">{req.courseTitle}</div>
                                )}
                              </div>
                              <div className="text-[10px] text-emerald-700 font-bold font-mono">
                                ৳{(req as any).amount || req.totalPrice || req.price || 30} BDT
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-extrabold text-slate-800 text-xs truncate max-w-[180px]" title={req.courseTitle}>{req.courseTitle}</div>
                              <div className="text-[10px] text-indigo-600 font-bold font-mono mt-0.5">
                                ৳{(req as any).amount || req.totalPrice || req.price || (req.courseId === 'wallet_recharge' ? 50 : 30)} BDT
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-[10px] font-mono border border-indigo-200/50 uppercase">
                            {req.courseCode || (req.courseIds && req.courseIds.join(', ')) || req.courseId}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700 max-w-[160px] truncate" title={req.email}>
                          {req.email}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 bg-pink-50 text-pink-700 font-bold rounded-full text-[10px] font-mono border border-pink-200/50">
                            {req.bkashNumber}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="font-mono bg-slate-50 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[11px] select-all">
                              {req.trxId}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(req.trxId);
                                alert('Copied Transaction ID: ' + req.trxId);
                              }}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition"
                              title="Copy transaction ID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {req.courseId === 'wallet_recharge' ? (
                            <span className="text-slate-400 font-mono text-[10px] font-semibold">
                              Recharge
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50/80 text-indigo-700 font-bold rounded text-[10px] border border-indigo-100/80">
                              <Clock className="w-2.5 h-2.5 text-indigo-500" />
                              1 Yr Access
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {req.status === 'approved' ? (
                            <div className="space-y-0.5">
                              <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded-md text-[10px] uppercase font-mono border border-emerald-200/50">
                                Approved
                              </span>
                              <div className="text-[9px] font-bold font-mono">
                                {req.verificationMethod === 'auto' ? (
                                  <span className="text-amber-600">Auto</span>
                                ) : req.verificationMethod === 'wallet_balance' ? (
                                  <span className="text-indigo-600">Wallet</span>
                                ) : (
                                  <span className="text-slate-400">Manual</span>
                                )}
                              </div>
                            </div>
                          ) : req.status === 'rejected' ? (
                            <span className="inline-block px-2 py-0.5 bg-rose-50 text-rose-700 font-extrabold rounded-md text-[10px] uppercase font-mono border border-rose-200/50">
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 font-extrabold rounded-md text-[10px] uppercase font-mono border border-amber-200/50">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {req.status === 'pending' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedActionRequest(req);
                                  setActionBalanceInput(String(req.totalPrice || req.price || ''));
                                }}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs whitespace-nowrap"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Action</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded">
                                Processed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Action Popup Modal for Payment & Balance Requests */}
            {selectedActionRequest && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
                <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden space-y-0 font-sans" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center text-white shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-white">Payment & Access Processing Action</h3>
                        <p className="text-[11px] text-indigo-200">Process request & set account balance</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedActionRequest(null)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    {/* Request Details Card */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Student Email</span>
                        <span className="font-bold text-slate-900 font-mono text-xs">{selectedActionRequest.email}</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Request Details</span>
                        <span className="font-bold text-indigo-700">{selectedActionRequest.courseTitle || selectedActionRequest.courseId}</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">bKash Number</span>
                        <span className="font-bold text-pink-700 font-mono">{selectedActionRequest.bkashNumber || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Transaction ID</span>
                        <span className="font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">{selectedActionRequest.trxId || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Balance Input Box */}
                    <div className="space-y-2 bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl">
                      <label className="block text-xs font-black text-slate-900">
                        Set Balance / Course Price (BDT ৳) <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                        User did not enter a balance. Please enter the desired balance or price before approving. (Default course access duration is 1 year)
                      </p>
                      <div className="relative mt-2">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-500 text-sm">৳</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={actionBalanceInput}
                          onChange={(e) => setActionBalanceInput(e.target.value)}
                          className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl font-black text-slate-900 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-mono shadow-2xs"
                        />
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-500 mr-1">Quick Sets:</span>
                        {[30, 50, 100, 200, 500, 1000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setActionBalanceInput(String(amt))}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-[10px] rounded-lg border border-indigo-200 transition cursor-pointer shadow-2xs"
                          >
                            ৳{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="p-5 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProcessingAction(false);
                        setSelectedActionRequest(null);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedActionRequest || isProcessingAction) return;
                        setIsProcessingAction(true);
                        try {
                          const actionPromise = handleRejectAccessRequest(selectedActionRequest.id);
                          const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Operation timed out. Please check network connection.')), 12000)
                          );
                          await Promise.race([actionPromise, timeoutPromise]);
                          setSelectedActionRequest(null);
                        } catch (err: any) {
                          console.error('Error rejecting request:', err);
                          showToast(`❌ ${err.message || 'Action failed'}`, 'error');
                        } finally {
                          setIsProcessingAction(false);
                        }
                      }}
                      disabled={isProcessingAction}
                      className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{isProcessingAction ? 'Declining...' : 'Decline'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedActionRequest || isProcessingAction) return;
                        const balNum = Number(actionBalanceInput);
                        if (isNaN(balNum) || actionBalanceInput === '') {
                          alert('Please enter a valid balance/price');
                          return;
                        }
                        setIsProcessingAction(true);
                        try {
                          const actionPromise = handleApproveAccessRequest(selectedActionRequest, balNum);
                          const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Operation timed out. Please check network connection.')), 12000)
                          );
                          await Promise.race([actionPromise, timeoutPromise]);
                          setSelectedActionRequest(null);
                        } catch (err: any) {
                          console.error('Error approving request:', err);
                          showToast(`❌ ${err.message || 'Action failed'}`, 'error');
                        } finally {
                          setIsProcessingAction(false);
                        }
                      }}
                      disabled={isProcessingAction}
                      className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75"
                    >
                      {isProcessingAction ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Approve</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : requestsSubTab === 'autoverify' ? (
        <div className="space-y-6 font-sans" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {/* Execution Result Feedback */}
          {autoVerifyResultMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{autoVerifyResultMessage}</span>
              </div>
              <button 
                onClick={() => setAutoVerifyResultMessage(null)}
                className="text-emerald-700 hover:text-slate-900 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Grid: Add Single Payment vs Bulk Import */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Form 1: Single Payment */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">Add Single Payment</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">bKash Mobile Number</label>
                  <input
                    type="text"
                    value={newGlobalVpNumber}
                    onChange={(e) => setNewGlobalVpNumber(e.target.value)}
                    placeholder="e.g. 01712345678"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-xs font-mono font-bold transition text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Transaction ID (TrxID)</label>
                  <input
                    type="text"
                    value={newGlobalVpTrxId}
                    onChange={(e) => setNewGlobalVpTrxId(e.target.value)}
                    placeholder="e.g. 8N29X1A"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-xs font-mono font-bold transition text-slate-800 uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Amount (BDT ৳)</label>
                  <input
                    type="number"
                    value={newGlobalVpAmount}
                    onChange={(e) => setNewGlobalVpAmount(Number(e.target.value))}
                    placeholder="e.g. 75"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-xs font-mono font-bold transition text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Auto-grants course access based on this paid amount.</p>
                </div>

                <button
                  type="button"
                  onClick={handleAddGlobalVerifiedPayment}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Save & Verify</span>
                </button>
              </div>
            </div>

            {/* Form 2: Bulk Import / Paste */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">Bulk Import Payments</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Format: Mobile, TrxID, Amount (1 per line)</label>
                  <textarea
                    rows={4}
                    value={globalVpPasteInput}
                    onChange={(e) => setGlobalVpPasteInput(e.target.value)}
                    placeholder={`01712345678, 8N29X1A, 90\n01811223344, 9K12M8P, 150`}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-xs font-mono font-medium transition text-slate-800"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleBulkImportGlobalVp(globalVpPasteInput)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Bulk Import & Verify</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table of Verified Payments */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Verified Transactions</h3>
                <p className="text-xs text-slate-400 font-medium">All verified bKash payment records stored in system settings.</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={globalVpSearch}
                    onChange={(e) => setGlobalVpSearch(e.target.value)}
                    placeholder="Search phone or TrxID..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-indigo-500 w-48 transition"
                  />
                </div>
                <button
                  onClick={fetchGlobalVerifiedPayments}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                  title="Refresh List"
                >
                  <RefreshCw className={`w-4 h-4 ${globalVpLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {globalVerifiedPayments.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-semibold">
                No verified records found. Add payments above.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 font-mono uppercase h-9">
                      <th className="px-4 py-2">bKash Mobile</th>
                      <th className="px-4 py-2">TrxID</th>
                      <th className="px-4 py-2">Paid Amount</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Added Date</th>
                      <th className="px-4 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-mono">
                    {globalVerifiedPayments
                      .filter(vp => {
                        if (!globalVpSearch) return true;
                        const q = globalVpSearch.toLowerCase();
                        return vp.bkashNumber.includes(q) || vp.trxId.toLowerCase().includes(q) || ((vp as any).claimedBy || '').toLowerCase().includes(q);
                      })
                      .map((vp, idx) => {
                        const cleanNum = (s: string) => (s || '').replace(/\D/g, '').slice(-10);
                        const vpTrx = (vp.trxId || '').toLowerCase().trim();
                        const vpNum = cleanNum(vp.bkashNumber);

                        const matchingReq = accessRequests.find(req => {
                          const reqTrx = (req.trxId || '').toLowerCase().trim();
                          const reqNum = cleanNum(req.bkashNumber || (req as any).phone || (req as any).senderPhone);
                          if (vpTrx && reqTrx && vpTrx === reqTrx) return true;
                          if (vpNum && reqNum && vpNum === reqNum && vpTrx && reqTrx && vpTrx === reqTrx) return true;
                          return false;
                        });

                        const isAlreadyApproved = (vp as any).claimed || (vp as any).spent || matchingReq?.status === 'approved';
                        const isPendingMatch = matchingReq && matchingReq.status === 'pending';
                        const claimedEmail = (vp as any).claimedBy || matchingReq?.email;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition">
                            <td className="px-4 py-2.5 font-bold text-slate-800">{vp.bkashNumber}</td>
                            <td className="px-4 py-2.5 font-bold text-indigo-600 uppercase">{vp.trxId}</td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-black rounded-full text-[10px] border border-emerald-200">
                                ৳{vp.amount || 30} BDT
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-sans">
                              {isAlreadyApproved ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold rounded-lg text-xs border border-emerald-200 shadow-2xs"
                                  title={claimedEmail ? `Claimed & Approved for ${claimedEmail}` : 'Matched and approved in wallet'}
                                >
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>Added</span>
                                  {claimedEmail && (
                                    <span className="text-[10px] text-emerald-600/80 font-normal max-w-[120px] truncate">
                                      ({claimedEmail})
                                    </span>
                                  )}
                                </span>
                              ) : isPendingMatch ? (
                                <div className="inline-flex items-center gap-2">
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-lg text-[11px] border border-amber-200"
                                    title={`Matched pending request from ${claimedEmail}`}
                                  >
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>Matched ({claimedEmail})</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveAccessRequest(matchingReq!, vp.amount || 75)}
                                    className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-[10px] shadow-2xs transition cursor-pointer"
                                  >
                                    Credit Now
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-500 font-bold rounded-lg text-xs border border-slate-200"
                                  title="Not claimed by any user request yet"
                                >
                                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>Unclaimed</span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[10px] text-slate-400 font-mono">
                              {vp.createdAt ? new Date(vp.createdAt).toLocaleDateString() : 'Active'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-sans">
                              <button
                                onClick={() => handleDeleteGlobalVerifiedPayment(vp.bkashNumber, vp.trxId)}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : requestsSubTab === 'debugger' ? (
        <TransactionDebugger
          accessRequests={accessRequests}
          transactionLogs={transactionLogs}
          onClearLogs={handleClearTransactionLogs}
          onTestTransaction={handleTestTransaction}
          onProcessRequest={processAccessRequest}
          onRefreshRequests={fetchAccessRequests}
          isProcessing={isProcessingAction}
          adminUserEmail={auth.currentUser?.email || ''}
        />
      ) : (
        <TransactionHistoryView 
          requests={accessRequests} 
          onRefresh={fetchAccessRequests} 
          onApprove={handleApproveAccessRequest} 
          onReject={handleRejectAccessRequest} 
          showToast={showToast} 
        />
      )}
    </div>
  )}

      {activeAdminTab === 'transaction-debugger' && (
        <div className="space-y-6 animate-fade-in">
          <TransactionDebugger
            accessRequests={accessRequests}
            transactionLogs={transactionLogs}
            onClearLogs={handleClearTransactionLogs}
            onTestTransaction={handleTestTransaction}
            onProcessRequest={processAccessRequest}
            onRefreshRequests={fetchAccessRequests}
            isProcessing={isProcessingAction}
            adminUserEmail={auth.currentUser?.email || ''}
          />
        </div>
      )}

      {activeAdminTab === 'system-settings' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <span>System Settings</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Configure item ordering, support contact info, and platform defaults across the platform.
            </p>
          </div>

          {/* Direct Firebase to Supabase Migration Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-indigo-700/60 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-white">Direct Firebase to Supabase Cloud Migration</h4>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-md uppercase border border-emerald-500/30">
                    Zero Data Loss
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  1-ক্লিকে সমস্ত ইউজার প্রগ্রেস, ফ্ল্যাশকার্ড হিস্ট্রি, শব্দ তালিকা ও পেমেন্ট রেকর্ড Supabase ক্লাউডে সিঙ্ক করুন।
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveAdminTab('migration')}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>ওপেন মাইগ্রেশন সেন্টার (Open Migration Center)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Practice & Games Item Positioning Setting */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4 col-span-1 md:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-purple-600" />
                    <span>Practice & Games Item Ordering</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Control the order and display position of items on the user's Practice & Games page
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const defaultOrder = ['quiz', 'match', 'synonym', 'blank', 'odd_one_out', 'analogy'];
                    const updated = { ...settings, practiceItemsOrder: defaultOrder };
                    if (onUpdateSettings) onUpdateSettings(updated);
                    try { setDoc(doc(db, 'system_settings', 'global'), updated, { merge: true }); } catch (e) {}
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition"
                >
                  Reset Default Order
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-1">
                {(() => {
                  const practiceDict: Record<string, { label: string; desc: string; icon: string }> = {
                    quiz: { label: 'MCQ Quiz', desc: 'Mock test & 4-option quiz game', icon: '🎯' },
                    match: { label: 'Word Match', desc: 'Fast-paced word & meaning matching game', icon: '🧩' },
                    word_search: { label: 'Word Search', desc: 'Find hidden vocabulary in a letter matrix', icon: '🔎' },
                    synonym: { label: 'Synonym Check', desc: 'Synonym preparation and practice', icon: '🔤' },
                    blank: { label: 'Blank Filling', desc: 'Fill in missing words in sentences', icon: '✍️' },
                    odd_one_out: { label: 'Odd One Out', desc: 'Identify the odd word out', icon: '🔍' },
                    analogy: { label: 'Word Analogy', desc: 'Word relationships and analogy game', icon: '⚖️' },
                  };
                  const currentOrder = settings?.practiceItemsOrder && settings.practiceItemsOrder.length > 0
                    ? settings.practiceItemsOrder
                    : ['quiz', 'match', 'word_search', 'synonym', 'blank', 'odd_one_out', 'analogy'];

                  const moveItem = (index: number, direction: 'up' | 'down') => {
                    const newOrder = [...currentOrder];
                    const targetIndex = direction === 'up' ? index - 1 : index + 1;
                    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
                    const temp = newOrder[index];
                    newOrder[index] = newOrder[targetIndex];
                    newOrder[targetIndex] = temp;

                    const updated = { ...settings, practiceItemsOrder: newOrder };
                    if (onUpdateSettings) onUpdateSettings(updated);
                    try { setDoc(doc(db, 'system_settings', 'global'), updated, { merge: true }); } catch (e) {}
                  };

                  return currentOrder.map((key, idx) => {
                    const itemInfo = practiceDict[key] || { label: key, desc: '', icon: '🎮' };
                    return (
                      <div key={key} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl hover:bg-slate-100/60 transition">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-lg">{itemInfo.icon}</span>
                          <div>
                            <span className="font-extrabold text-xs text-slate-800 block">{itemInfo.label}</span>
                            <span className="text-[10px] font-medium text-slate-500">{itemInfo.desc}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveItem(idx, 'up')}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition ${
                              idx === 0 ? 'opacity-30 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : 'bg-white hover:bg-purple-50 text-slate-700 border-slate-200 hover:border-purple-300'
                            }`}
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === currentOrder.length - 1}
                            onClick={() => moveItem(idx, 'down')}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition ${
                              idx === currentOrder.length - 1 ? 'opacity-30 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : 'bg-white hover:bg-purple-50 text-slate-700 border-slate-200 hover:border-purple-300'
                            }`}
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Study Tools Item Positioning Setting */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4 col-span-1 md:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>Study Tools Item Ordering</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Determine the order and display position of tools on the user's Study Tools page
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const defaultOrder = ['lists', 'dictionary', 'planner', 'story'];
                    const updated = { ...settings, studyToolsItemsOrder: defaultOrder };
                    if (onUpdateSettings) onUpdateSettings(updated);
                    try { setDoc(doc(db, 'system_settings', 'global'), updated, { merge: true }); } catch (e) {}
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition"
                >
                  Reset Default Order
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-1">
                {(() => {
                  const studyDict: Record<string, { label: string; desc: string; icon: string }> = {
                    lists: { label: 'Bookmark & Lists', desc: 'Favorite word lists and bookmark folders', icon: '🔖' },
                    dictionary: { label: 'Dictionary Search', desc: 'English & Bengali dictionary with detailed definitions', icon: '📖' },
                    planner: { label: 'Daily Planner', desc: 'Daily reading goals and study routine', icon: '📅' },
                    story: { label: 'Read Story', desc: 'Stories and reading articles', icon: '📚' },
                  };
                  const currentOrder = settings?.studyToolsItemsOrder && settings.studyToolsItemsOrder.length > 0
                    ? settings.studyToolsItemsOrder
                    : ['lists', 'dictionary', 'planner', 'story'];

                  const moveItem = (index: number, direction: 'up' | 'down') => {
                    const newOrder = [...currentOrder];
                    const targetIndex = direction === 'up' ? index - 1 : index + 1;
                    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
                    const temp = newOrder[index];
                    newOrder[index] = newOrder[targetIndex];
                    newOrder[targetIndex] = temp;

                    const updated = { ...settings, studyToolsItemsOrder: newOrder };
                    if (onUpdateSettings) onUpdateSettings(updated);
                    try { setDoc(doc(db, 'system_settings', 'global'), updated, { merge: true }); } catch (e) {}
                  };

                  return currentOrder.map((key, idx) => {
                    const itemInfo = studyDict[key] || { label: key, desc: '', icon: '🛠️' };
                    return (
                      <div key={key} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl hover:bg-slate-100/60 transition">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-lg">{itemInfo.icon}</span>
                          <div>
                            <span className="font-extrabold text-xs text-slate-800 block">{itemInfo.label}</span>
                            <span className="text-[10px] font-medium text-slate-500">{itemInfo.desc}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveItem(idx, 'up')}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition ${
                              idx === 0 ? 'opacity-30 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200 hover:border-emerald-300'
                            }`}
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === currentOrder.length - 1}
                            onClick={() => moveItem(idx, 'down')}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition ${
                              idx === currentOrder.length - 1 ? 'opacity-30 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200 hover:border-emerald-300'
                            }`}
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Contact & Support Channels Config */}
            <div className="bg-white p-6 rounded-2xl border border-emerald-200/80 shadow-xs space-y-4 col-span-1 md:col-span-2 font-['Poppins',sans-serif]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-emerald-600" />
                    <span>Contact & Support Information Controls</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Configure official contact links (WhatsApp, 2 Facebook links, Telegram, and Support Email) visible to all users in User Settings.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[10px] rounded-lg uppercase">
                  Live Synced
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* WhatsApp Number / Chat Link */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Number / Direct Chat Link:</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +8801581624202 or https://wa.me/8801581624202"
                    value={settings?.contactWhatsApp || ''}
                    onChange={(e) => {
                      const updated = { ...settings, contactWhatsApp: e.target.value };
                      if (onUpdateSettings) onUpdateSettings(updated);
                      try { setDoc(doc(db, 'system_settings', 'global'), updated, { merge: true }); } catch (err) {}
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 transition"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Shown on WhatsApp button in User Settings</p>
                </div>

                {/* Facebook Link 1 (Official Page / Main) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-sky-600" />
                    <span>Facebook Link 1 (Official Page / Main Link):</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://facebook.com/memorizer.official"
                    value={settings?.contactFacebook1 || ''}
                    onChange={(e) => {
                      const updated = { ...settings, contactFacebook1: e.target.value };
                      if (onUpdateSettings) onUpdateSettings(updated);
                      try { setDoc(doc(db, 'system_settings', 'global'), updated, { merge: true }); } catch (err) {}
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Link 1: Facebook Page / Main profile</p>
                </div>

                {/* Facebook Link 2 (Community Group) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Facebook Link 2 (Community / Group Link):</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://facebook.com/groups/memorizer.bd"
                    value={settings?.contactFacebook2 || ''}
                    onChange={(e) => {
                      const updated = { ...settings, contactFacebook2: e.target.value };
                      if (onUpdateSettings) onUpdateSettings(updated);
                      try { setDoc(doc(db, 'system_settings', 'global'), updated, { merge: true }); } catch (err) {}
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Link 2: Facebook Community Group / Secondary Link</p>
                </div>

                {/* Telegram Channel / Chat Link */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-500" />
                    <span>Telegram Link / Channel Username:</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://t.me/memorizer_bd"
                    value={settings?.contactTelegram || ''}
                    onChange={(e) => {
                      const updated = { ...settings, contactTelegram: e.target.value };
                      if (onUpdateSettings) onUpdateSettings(updated);
                      try { setDoc(doc(db, 'system_settings', 'global'), updated, { merge: true }); } catch (err) {}
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Telegram channel or support bot link</p>
                </div>

                {/* Support Email */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-600" />
                    <span>Official Support Email Address:</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. support@memorizer.com or mohammad.001ekram@gmail.com"
                    value={settings?.contactEmail || ''}
                    onChange={(e) => {
                      const updated = { ...settings, contactEmail: e.target.value };
                      if (onUpdateSettings) onUpdateSettings(updated);
                      try { setDoc(doc(db, 'system_settings', 'global'), updated, { merge: true }); } catch (err) {}
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 transition"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Official support email for direct inquiries</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeAdminTab === 'blank-questions' && (
        <div className="space-y-8 animate-fade-in">
          {/* Header */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
            <h3 className="font-extrabold text-slate-800 text-lg">গেম ডাটা আপলোড অ্যান্ড এক্সেল ম্যানেজমেন্ট (Game Upload Center)</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              একই সাথে সকল গেমের ডেটা এক্সেল ফাইলের একাধিক শীট (Multi-Sheet) অথবা নির্দিষ্ট গেম ট্যাবে গিয়ে এককভাবে আপলোড ও পরিচালনা করুন। (অনলাইন এক্সাম এখন 'Question Bank' মেনু থেকে সরাসরি তৈরি করা হয়)।
            </p>

            {/* Template Download Buttons */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 mr-1">টেমপ্লেট ডাউনলোড করুন:</span>

              <button
                type="button"
                onClick={() => downloadAllGamesMultiSheetTemplate()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>মাল্টি-শীট গেম টেমপ্লেট (All-in-One)</span>
              </button>

              <button
                type="button"
                onClick={() => downloadBlankExcelTemplate()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Blank Filling
              </button>

              <button
                type="button"
                onClick={() => downloadOooExcelTemplate()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Odd One Out
              </button>

              <button
                type="button"
                onClick={() => downloadAnalogyExcelTemplate()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Word Analogy
              </button>

              <button
                type="button"
                onClick={() => downloadMcqExcelTemplate()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                MCQ Quiz
              </button>
            </div>
          </div>

          {/* Mandatory Target Course Selection Dropdown */}
          <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200/80 space-y-2">
            <label className="text-xs font-extrabold text-indigo-950 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="text-rose-600 font-extrabold text-sm">*</span>
                <span>টার্গেট কোর্স নির্ধারণ করুন (Mandatory Target Course Selection)</span>
              </span>
              {selectedGameCourseId && (
                <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-md uppercase">
                  Selected: {selectedGameCourseId}
                </span>
              )}
            </label>
            <select
              value={selectedGameCourseId}
              onChange={(e) => {
                const newCourseId = e.target.value;
                setSelectedGameCourseId(newCourseId);
                setExcelUploadError(null);
                setExcelOooUploadError(null);
                setExcelAnalogyUploadError(null);
                setExcelMcqUploadError(null);
                fetchBlankQuestions(newCourseId);
                fetchOooQuestions(newCourseId);
                fetchAnalogyQuestions(newCourseId);
                fetchMcqQuestions(newCourseId);
              }}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            >
              <option value="">-- অনুগ্রহ করে কন্টেন্টের জন্য একটি নির্দিষ্ট কোর্স সিলেক্ট করুন (Required) --</option>
              {customCourses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.id.toUpperCase()})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              ⚠️ গেমের ডেটা বা কন্টেন্ট শুধুমাত্র আপনার সিলেক্ট করা নির্দিষ্ট কোর্সের সাথেই যুক্ত থাকবে (সকল কোর্সে স্বয়ংক্রিয়ভাবে গ্লোবালি যাবে না)।
            </p>
          </div>

          {/* Sub-tab Navigation for Game Uploads */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/80 overflow-x-auto">
            <button
              type="button"
              onClick={() => setGameUploadSubTab('multi')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                gameUploadSubTab === 'multi'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Multi-Sheet (All-in-One)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGameUploadSubTab('blank');
                fetchBlankQuestions();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                gameUploadSubTab === 'blank'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-600" />
              <span>Blank Filling</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
                {blankQuestions.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGameUploadSubTab('ooo');
                fetchOooQuestions();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                gameUploadSubTab === 'ooo'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>Odd One Out</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
                {oooQuestions.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGameUploadSubTab('analogy');
                fetchAnalogyQuestions();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                gameUploadSubTab === 'analogy'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Shuffle className="w-4 h-4 text-purple-600" />
              <span>Word Analogy</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
                {analogyQuestions.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGameUploadSubTab('mcq');
                fetchMcqQuestions();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                gameUploadSubTab === 'mcq'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>MCQ Quiz Qs</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
                {mcqQuestions.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGameUploadSubTab('story');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                gameUploadSubTab === 'story'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <BookOpen className="w-4 h-4 text-pink-600" />
              <span>Vocabulary Stories</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
                {customCourses.find(c => c.id === selectedGameCourseId)?.stories?.length || 0}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGameUploadSubTab('article');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                gameUploadSubTab === 'article'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Newspaper className="w-4 h-4 text-indigo-600" />
              <span>Read Article</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
                {customCourses.find(c => c.id === selectedGameCourseId)?.articles?.length || 0}
              </span>
            </button>
          </div>

          {/* SUB-TAB 1: Multi-Sheet All-in-One Upload */}
          {gameUploadSubTab === 'multi' && (
            <div className="space-y-6">
              {/* Column Names Logic Table Explanation */}
              <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl text-xs space-y-3">
                <h4 className="font-extrabold text-amber-900 text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600" />
                  <span>এক্সেল কলামের নাম ও লজিকের নিয়মাবলী (Excel Column Logic Rules)</span>
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse bg-white rounded-xl border border-amber-200/80">
                    <thead>
                      <tr className="bg-amber-100/50 text-amber-900 font-bold text-[11px] border-b border-amber-200">
                        <th className="p-2.5">কলাম ১: প্রশ্ন (Question)</th>
                        <th className="p-2.5">কলাম ২-৫: অপশনসমূহ (Options)</th>
                        <th className="p-2.5">কলাম ৬: উত্তর (Answer - ঐচ্ছিক)</th>
                        <th className="p-2.5">কলাম ৭: ব্যাখ্যা (Explanation - ঐচ্ছিক)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-[11px] text-slate-700">
                      <tr>
                        <td className="p-2.5 font-bold">কলামের নাম: <span className="font-mono text-indigo-700">Question / Sentence / Stem / প্রশ্ন</span></td>
                        <td className="p-2.5 font-bold">কলামের নাম: <span className="font-mono text-indigo-700">Option 1, Option 2, Option 3, Option 4 / অপশন ১-৪</span></td>
                        <td className="p-2.5">কলামের নাম: <span className="font-mono text-indigo-700">Answer / Correct Option / উত্তর</span></td>
                        <td className="p-2.5">কলামের নাম: <span className="font-mono text-indigo-700">Explanation / Reason / ব্যাখ্যা</span></td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-slate-600" colSpan={4}>
                          💡 <strong>লজিক নিয়ম ১ (উত্তরের কলাম না থাকলে):</strong> অপশনের যেকোনো চার কলামের একটি উত্তরের শেষে বা শুরুতে <strong>#</strong> চিহ্ন থাকলে (যেমন: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-rose-600">ঢাকা#</code>) সেটিকে স্বয়ংক্রিয়ভাবে সঠিক উত্তর হিসেবে নির্বাচন করা হবে।<br/>
                          💡 <strong>লজিক নিয়ম ২ (ব্যাখ্যার কলাম না থাকলে):</strong> ব্যাখ্যার জায়গায় স্বয়ংক্রিয়ভাবে ডিফল্ট লেখা বসবে (যেমন: <em>"সঠিক উত্তরের ব্যাখ্যা শীঘ্রই সংযুক্ত করা হবে।"</em>)।
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Multi-Sheet Upload Box */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    <span>মাল্টি-শীট এক্সেল আপলোড (Multi-Sheet Excel Uploader)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                    একই ফাইলে 'Blank Filling', 'Odd One Out', 'Word Analogy', 'MCQ Quiz' নামের শীট থাকলে সবকটি গেম একসাথে আপডেট হবে।
                  </p>
                </div>

                <div className="space-y-3">
                  <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition relative ${
                    isUploadingMultiSheet
                      ? 'border-indigo-400 bg-indigo-50/40'
                      : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50 cursor-pointer'
                  }`}>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      disabled={isUploadingMultiSheet}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        if (!selectedGameCourseId) {
                          setExcelUploadError('আপলোড করার আগে অবশ্যই একটি নির্দিষ্ট কোর্স নির্বাচন করতে হবে (Mandatory Target Course Required)।');
                          e.target.value = '';
                          return;
                        }

                        setExcelUploadError(null);
                        setMultiSheetSuccessMessage(null);
                        setIsUploadingMultiSheet(true);
                        setMultiSheetUploadProgress(20);
                        setMultiSheetStatusMessage('এক্সেল ফাইল প্রসেস করা হচ্ছে এবং প্রশ্নাবলী এক্সট্র্যাক্ট করা হচ্ছে...');

                        try {
                          const res = await parseMultiSheetGamesExcel(file, selectedGameCourseId);
                          const totalQs = (res.blankQs?.length || 0) + (res.oooQs?.length || 0) + (res.analogyQs?.length || 0) + (res.mcqQs?.length || 0);

                          if (totalQs === 0) {
                            throw new Error('এক্সেল ফাইলে কোনো বৈধ প্রশ্ন পাওয়া যায়নি। অনুগ্রহ করে টেমপ্লেট অনুযায়ী কলামগুলো সাজিয়ে আবার চেষ্টা করুন।');
                          }

                          setMultiSheetUploadProgress(45);
                          setMultiSheetStatusMessage(`মোট ${totalQs} টি প্রশ্ন ক্লাউড ডাটাবেজে সংরক্ষিত হচ্ছে...`);

                          const uploadTasks: Promise<any>[] = [];
                          const summaryBreakdown: string[] = [];

                          if (res.blankQs && res.blankQs.length > 0) {
                            uploadTasks.push(
                              saveBulkDocs('blank_questions', res.blankQs).then(() => {
                                summaryBreakdown.push(`Blank Filling (${res.blankQs.length})`);
                                clearQuestionsCache('blank_questions', selectedGameCourseId);
                              })
                            );
                          }

                          if (res.oooQs && res.oooQs.length > 0) {
                            uploadTasks.push(
                              saveBulkDocs('odd_one_out_questions', res.oooQs).then(() => {
                                summaryBreakdown.push(`Odd One Out (${res.oooQs.length})`);
                                clearQuestionsCache('odd_one_out_questions', selectedGameCourseId);
                              })
                            );
                          }

                          if (res.analogyQs && res.analogyQs.length > 0) {
                            uploadTasks.push(
                              saveBulkDocs('word_analogy_questions', res.analogyQs).then(() => {
                                summaryBreakdown.push(`Word Analogy (${res.analogyQs.length})`);
                                clearQuestionsCache('word_analogy_questions', selectedGameCourseId);
                              })
                            );
                          }

                          if (res.mcqQs && res.mcqQs.length > 0) {
                            uploadTasks.push(
                              saveBulkDocs('mcq_questions', res.mcqQs).then(() => {
                                summaryBreakdown.push(`MCQ Quiz (${res.mcqQs.length})`);
                                clearQuestionsCache('mcq_questions', selectedGameCourseId);
                              })
                            );
                          }

                          const safetyTimeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
                          await Promise.race([
                            Promise.all(uploadTasks),
                            safetyTimeout
                          ]);

                          setMultiSheetUploadProgress(100);
                          setMultiSheetStatusMessage('আপলোড সফলভাবে সম্পন্ন হয়েছে!');
                          
                          const msg = `সফলভাবে মোট ${totalQs} টি প্রশ্ন সংরক্ষিত হয়েছে! [${summaryBreakdown.join(', ')}]`;
                          setMultiSheetSuccessMessage(msg);
                          fetchBlankQuestions();
                          fetchOooQuestions();
                          fetchAnalogyQuestions();
                          fetchMcqQuestions();
                        } catch (err: any) {
                          console.error('Multi-sheet upload error:', err);
                          setExcelUploadError(`আপলোড ত্রুটি: ${err?.message || 'ফাইলের ফরম্যাট বা কলাম গঠন সঠিক নয়'}`);
                        } finally {
                          setIsUploadingMultiSheet(false);
                          e.target.value = '';
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />

                    {isUploadingMultiSheet ? (
                      <div className="py-2 space-y-3">
                        <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold text-xs">
                          <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                          <span>{multiSheetStatusMessage}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden max-w-md mx-auto">
                          <div 
                            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${multiSheetUploadProgress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full inline-block">
                            {multiSheetUploadProgress}% প্রসেসিং সম্পন্ন
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsUploadingMultiSheet(false);
                              setMultiSheetSuccessMessage('আপলোড প্রসেস সমাপ্ত করা হয়েছে এবং ডাটাবেজ আপডেট হয়েছে।');
                              fetchBlankQuestions();
                            }}
                            className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-md transition shadow-2xs cursor-pointer"
                          >
                            ⚡ সাথে সাথে শেষ করুন (Instant Finish)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">মাল্টি-শীট এক্সেল ফাইলটি এখানে ক্লিক করে বা ড্রপ করে আপলোড করুন</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">সহায়ক ফাইলের ধরন: .xlsx, .xls</p>
                      </>
                    )}
                  </div>

                  {multiSheetSuccessMessage && (
                    <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-between border border-emerald-200 text-xs font-semibold shadow-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>{multiSheetSuccessMessage}</span>
                      </div>
                      <button 
                        onClick={() => setMultiSheetSuccessMessage(null)}
                        className="text-emerald-600 hover:text-emerald-900 font-bold text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {excelUploadError && (
                    <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl flex items-start justify-between gap-2 border border-rose-100 text-xs font-semibold">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                        <span>{excelUploadError}</span>
                      </div>
                      <button 
                        onClick={() => setExcelUploadError(null)}
                        className="text-rose-500 hover:text-rose-800 font-bold text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: Blank Filling Upload & Manual Add */}
          {gameUploadSubTab === 'blank' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Excel Upload Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                      <span>Blank Filling Excel Upload</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Upload blank filling questions specifically for the selected course.
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition cursor-pointer relative bg-slate-50/50">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleUploadBlankExcel}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Click or drag Blank Filling Excel/CSV file here</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Supports .xlsx, .xls, .csv</p>
                  </div>

                  {excelUploadError && (
                    <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{excelUploadError}</span>
                    </div>
                  )}

                  {excelQuestionsPreview.length > 0 && (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{excelQuestionsPreview.length} questions found</span>
                        </span>
                        <button
                          onClick={handleSaveBlankExcelQuestions}
                          disabled={excelSaveStatus === 'saving'}
                          className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                            excelSaveStatus === 'saving' ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-500'
                          }`}
                        >
                          {excelSaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                        </button>
                      </div>

                      {/* Preview list */}
                      <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-slate-50/20 text-xs">
                        {excelQuestionsPreview.map((q, idx) => (
                          <div key={idx} className="p-3">
                            <p className="font-bold text-slate-850"><span className="text-slate-400 mr-1">#{idx + 1}</span> {q.sentence}</p>
                            <div className="grid grid-cols-2 gap-1.5 mt-1.5 font-mono text-[11px] text-slate-500">
                              {(Array.from(new Set((q.options || []).map(o => o.trim()))) as string[]).filter(Boolean).map((opt, oIdx) => (
                                <span key={oIdx} className={opt === q.answer ? 'text-emerald-600 font-extrabold bg-emerald-50/50 px-1 rounded' : ''}>
                                  {opt} {opt === q.answer ? '✓' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {excelSaveStatus === 'saved' && (
                    <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      <span>Questions successfully saved to database!</span>
                    </div>
                  )}
                </div>

                {/* Manual Form Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-indigo-500" />
                      <span>Add Blank Question Manually</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">Fill out the form below to add a new question directly to the database.</p>
                  </div>

                  <form onSubmit={handleManualAddBlankQuestion} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sentence with blank</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., The rich man was very ___ about his wealth."
                        value={newSentence}
                        onChange={(e) => setNewSentence(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option 1</label>
                        <input
                          type="text"
                          required
                          placeholder="Option 1"
                          value={newOpt1}
                          onChange={(e) => setNewOpt1(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option 2</label>
                        <input
                          type="text"
                          required
                          placeholder="Option 2"
                          value={newOpt2}
                          onChange={(e) => setNewOpt2(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option 3</label>
                        <input
                          type="text"
                          required
                          placeholder="Option 3"
                          value={newOpt3}
                          onChange={(e) => setNewOpt3(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option 4</label>
                        <input
                          type="text"
                          required
                          placeholder="Option 4"
                          value={newOpt4}
                          onChange={(e) => setNewOpt4(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Correct Option</label>
                      <select
                        value={newCorrectIndex}
                        onChange={(e) => setNewCorrectIndex(Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-bold transition"
                      >
                        <option value={0}>Option 1: {newOpt1 || '(Empty)'}</option>
                        <option value={1}>Option 2: {newOpt2 || '(Empty)'}</option>
                        <option value={2}>Option 3: {newOpt3 || '(Empty)'}</option>
                        <option value={3}>Option 4: {newOpt4 || '(Empty)'}</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-xs"
                    >
                      Add Question
                    </button>
                  </form>
                </div>
              </div>

              {/* Existing Questions Table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">Existing Blank Questions ({blankQuestions.length})</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Questions stored in database for the selected course context.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {blankQuestions.length > 0 && (
                      <button
                        onClick={handleBulkDeleteBlankQuestions}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Bulk Delete All</span>
                      </button>
                    )}
                    <button
                      onClick={() => fetchBlankQuestions()}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${blankQuestionsLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {blankQuestionsLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-xs font-bold font-mono">Loading blank questions...</span>
                  </div>
                ) : blankQuestions.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No questions found</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Please upload an Excel sheet or add questions manually.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-100 font-sans">
                          <th className="px-4 py-3">Sentence</th>
                          <th className="px-4 py-3">Options</th>
                          <th className="px-4 py-3">Answer</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {blankQuestions.map((q) => (
                          <tr key={q.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3.5 font-medium text-slate-800 max-w-xs truncate" title={q.sentence}>
                              {q.sentence}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[10px] text-slate-500">
                              {q.options.join(', ')}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 font-black rounded text-[10px] uppercase">
                                {q.answer}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteBlankQuestion(q.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
                                title="Delete question"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: Odd One Out Upload & Manual Add */}
          {gameUploadSubTab === 'ooo' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Excel Upload Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-500" />
                      <span>Odd One Out Excel Upload</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Upload Odd One Out sets (4 words, with 1 marked odd).
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition cursor-pointer relative bg-slate-50/50">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleUploadOooExcel}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Click or drag Odd One Out Excel/CSV file here</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Supports .xlsx, .xls, .csv</p>
                  </div>

                  {excelOooUploadError && (
                    <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{excelOooUploadError}</span>
                    </div>
                  )}

                  {excelOooPreview.length > 0 && (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-amber-600 flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{excelOooPreview.length} questions parsed</span>
                        </span>
                        <button
                          onClick={handleSaveOooExcelQuestions}
                          disabled={excelOooSaveStatus === 'saving'}
                          className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                            excelOooSaveStatus === 'saving' ? 'bg-slate-400' : 'bg-amber-600 hover:bg-amber-500'
                          }`}
                        >
                          {excelOooSaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                        </button>
                      </div>

                      {/* Preview list */}
                      <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-slate-50/20 text-xs">
                        {excelOooPreview.map((q, idx) => (
                          <div key={idx} className="p-3">
                            <p className="font-bold text-slate-850"><span className="text-slate-400 mr-1">#{idx + 1}</span> Words: {q.words.join(', ')}</p>
                            <p className="text-xs text-amber-600 font-bold mt-1">Odd: {q.answer} {q.reason ? `(${q.reason})` : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {excelOooSaveStatus === 'saved' && (
                    <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      <span>Odd One Out questions saved successfully!</span>
                    </div>
                  )}
                </div>

                {/* Manual Form Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-amber-500" />
                      <span>Add Odd One Out Manually</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">Specify 4 words and select the one that does not belong.</p>
                  </div>

                  <form onSubmit={handleManualAddOooQuestion} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3.5">
                      {newOooWords.map((w, wIdx) => (
                        <div key={wIdx}>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Word {wIdx + 1}</label>
                          <input
                            type="text"
                            required
                            placeholder={`Word ${wIdx + 1}`}
                            value={w}
                            onChange={(e) => {
                              const next = [...newOooWords];
                              next[wIdx] = e.target.value;
                              setNewOooWords(next);
                            }}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl text-xs transition"
                          />
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Odd Word (Correct Answer)</label>
                      <select
                        value={newOooCorrectIndex}
                        onChange={(e) => setNewOooCorrectIndex(Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl text-xs font-bold transition"
                      >
                        <option value={0}>Word 1: {newOooWords[0] || '(Empty)'}</option>
                        <option value={1}>Word 2: {newOooWords[1] || '(Empty)'}</option>
                        <option value={2}>Word 3: {newOooWords[2] || '(Empty)'}</option>
                        <option value={3}>Word 4: {newOooWords[3] || '(Empty)'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reason / Explanation (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. All others are synonyms for happy."
                        value={newOooReason}
                        onChange={(e) => setNewOooReason(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl text-xs transition"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-xs"
                    >
                      Add Odd One Out
                    </button>
                  </form>
                </div>
              </div>

              {/* Existing Questions Table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">Existing Odd One Out Questions ({oooQuestions.length})</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Stored questions for the current course.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {oooQuestions.length > 0 && (
                      <button
                        onClick={handleBulkDeleteOooQuestions}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Bulk Delete All</span>
                      </button>
                    )}
                    <button
                      onClick={() => fetchOooQuestions()}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${oooQuestionsLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {oooQuestionsLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-xs font-bold font-mono">Loading questions...</span>
                  </div>
                ) : oooQuestions.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No Odd One Out questions found</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Please upload an Excel sheet or add questions manually.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-100 font-sans">
                          <th className="px-4 py-3">Words</th>
                          <th className="px-4 py-3">Odd One (Answer)</th>
                          <th className="px-4 py-3">Reason</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {oooQuestions.map((q) => (
                          <tr key={q.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3.5 font-mono text-slate-700 max-w-xs truncate">
                              {q.words.join(', ')}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 font-black rounded text-[10px]">
                                {q.answer}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 text-[11px] max-w-xs truncate">
                              {q.reason || '—'}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteOooQuestion(q.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
                                title="Delete question"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 4: Word Analogy Upload & Manual Add */}
          {gameUploadSubTab === 'analogy' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Excel Upload Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <Shuffle className="w-4 h-4 text-purple-500" />
                      <span>Word Analogy Excel Upload</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Upload word analogy questions (e.g. Light : Dark :: Day : Night).
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition cursor-pointer relative bg-slate-50/50">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleUploadAnalogyExcel}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Click or drag Word Analogy Excel/CSV file here</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Supports .xlsx, .xls, .csv</p>
                  </div>

                  {excelAnalogyUploadError && (
                    <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{excelAnalogyUploadError}</span>
                    </div>
                  )}

                  {excelAnalogyPreview.length > 0 && (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-purple-600 flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{excelAnalogyPreview.length} questions parsed</span>
                        </span>
                        <button
                          onClick={handleSaveAnalogyExcelQuestions}
                          disabled={excelAnalogySaveStatus === 'saving'}
                          className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                            excelAnalogySaveStatus === 'saving' ? 'bg-slate-400' : 'bg-purple-600 hover:bg-purple-500'
                          }`}
                        >
                          {excelAnalogySaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                        </button>
                      </div>

                      {/* Preview list */}
                      <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-slate-50/20 text-xs">
                        {excelAnalogyPreview.map((q, idx) => (
                          <div key={idx} className="p-3">
                            <p className="font-bold text-slate-850"><span className="text-slate-400 mr-1">#{idx + 1}</span> {q.analogy}</p>
                            <p className="text-xs text-purple-600 font-bold mt-1">Answer: {q.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {excelAnalogySaveStatus === 'saved' && (
                    <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      <span>Word Analogy questions saved successfully!</span>
                    </div>
                  )}
                </div>

                {/* Manual Form Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-purple-500" />
                      <span>Add Word Analogy Manually</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">Enter base analogy and 4 answer options.</p>
                  </div>

                  <form onSubmit={handleManualAddAnalogyQuestion} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Base Analogy</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. LIGHT : DARK"
                        value={newAnalogy}
                        onChange={(e) => setNewAnalogy(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white rounded-xl text-xs transition"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      {newAnalogyOpts.map((opt, oIdx) => (
                        <div key={oIdx}>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option {oIdx + 1}</label>
                          <input
                            type="text"
                            required
                            placeholder={`e.g. DAY : NIGHT`}
                            value={opt}
                            onChange={(e) => {
                              const next = [...newAnalogyOpts];
                              next[oIdx] = e.target.value;
                              setNewAnalogyOpts(next);
                            }}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white rounded-xl text-xs transition"
                          />
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Correct Analogy Option</label>
                      <select
                        value={newAnalogyCorrectIndex}
                        onChange={(e) => setNewAnalogyCorrectIndex(Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white rounded-xl text-xs font-bold transition"
                      >
                        <option value={0}>Option 1: {newAnalogyOpts[0] || '(Empty)'}</option>
                        <option value={1}>Option 2: {newAnalogyOpts[1] || '(Empty)'}</option>
                        <option value={2}>Option 3: {newAnalogyOpts[2] || '(Empty)'}</option>
                        <option value={3}>Option 4: {newAnalogyOpts[3] || '(Empty)'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Explanation (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Antonym relationship."
                        value={newAnalogyExplanation}
                        onChange={(e) => setNewAnalogyExplanation(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white rounded-xl text-xs transition"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-xs"
                    >
                      Add Analogy
                    </button>
                  </form>
                </div>
              </div>

              {/* Existing Questions Table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">Existing Word Analogy Questions ({analogyQuestions.length})</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Stored analogy questions for the current course.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {analogyQuestions.length > 0 && (
                      <button
                        onClick={handleBulkDeleteAnalogyQuestions}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Bulk Delete All</span>
                      </button>
                    )}
                    <button
                      onClick={() => fetchAnalogyQuestions()}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${analogyQuestionsLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {analogyQuestionsLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-xs font-bold font-mono">Loading questions...</span>
                  </div>
                ) : analogyQuestions.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No Word Analogy questions found</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Please upload an Excel sheet or add questions manually.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-100 font-sans">
                          <th className="px-4 py-3">Base Analogy</th>
                          <th className="px-4 py-3">Options</th>
                          <th className="px-4 py-3">Answer</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {analogyQuestions.map((q) => (
                          <tr key={q.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3.5 font-medium text-slate-800 max-w-xs truncate">
                              {q.analogy}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[10px] text-slate-500">
                              {q.options.join(', ')}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 font-black rounded text-[10px]">
                                {q.answer}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteAnalogyQuestion(q.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
                                title="Delete question"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 5: MCQ Quiz Upload & Manual Add */}
          {gameUploadSubTab === 'mcq' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Excel Upload Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-indigo-500" />
                      <span>Custom MCQ Quiz Excel Upload</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Upload custom MCQ questions. When present, they serve as primary MCQ quiz questions for the selected course.
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition cursor-pointer relative bg-slate-50/50">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleUploadMcqExcel}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Click or drag MCQ Quiz Excel/CSV file here</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Supports .xlsx, .xls, .csv</p>
                  </div>

                  {excelMcqUploadError && (
                    <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{excelMcqUploadError}</span>
                    </div>
                  )}

                  {excelMcqNotice && excelMcqNotice.length > 0 && (
                    <div className="p-3.5 bg-amber-50 text-amber-900 rounded-2xl border border-amber-200/80 text-xs font-semibold space-y-2">
                      <div className="flex items-center gap-2 font-black text-amber-800 text-[11px] uppercase tracking-wide">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>Notice: {excelMcqNotice.length} Question(s) Skipped</span>
                      </div>
                      <p className="text-[11px] text-amber-800 font-normal">
                        Column 7 answer did not match any of the 4 option columns for the following questions:
                      </p>
                      <ul className="max-h-28 overflow-y-auto space-y-1 pl-2 text-[11px] font-mono text-amber-950 bg-white/80 p-2 rounded-lg border border-amber-200/60 divide-y divide-amber-100">
                        {excelMcqNotice.map((notice, nIdx) => (
                          <li key={nIdx} className="pt-1 first:pt-0">{notice}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {excelMcqPreview.length > 0 && (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-indigo-600 flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{excelMcqPreview.length} questions parsed</span>
                        </span>
                        <button
                          onClick={handleSaveMcqExcelQuestions}
                          disabled={excelMcqSaveStatus === 'saving'}
                          className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                            excelMcqSaveStatus === 'saving' ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-500'
                          }`}
                        >
                          {excelMcqSaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                        </button>
                      </div>

                      {/* Preview list */}
                      <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-slate-50/20 text-xs">
                        {excelMcqPreview.map((q, idx) => (
                          <div key={idx} className="p-3">
                            <p className="font-bold text-slate-850"><span className="text-slate-400 mr-1">#{idx + 1}</span> {q.question}</p>
                            <div className="grid grid-cols-2 gap-1.5 mt-1.5 font-mono text-[11px] text-slate-500">
                              {(Array.from(new Set((q.options || []).map(o => o.trim()))) as string[]).filter(Boolean).map((opt, oIdx) => (
                                <span key={oIdx} className={opt === q.answer ? 'text-indigo-600 font-extrabold bg-indigo-50/50 px-1 rounded' : ''}>
                                  {opt} {opt === q.answer ? '✓' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {excelMcqSaveStatus === 'saved' && (
                    <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      <span>MCQ questions saved successfully!</span>
                    </div>
                  )}
                </div>

                {/* Manual Form Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-indigo-500" />
                      <span>Add MCQ Question Manually</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">Enter question, 4 options, and select the correct answer.</p>
                  </div>

                  <form onSubmit={handleManualAddMcqQuestion} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Question</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Which of the following means 'harmful'?"
                        value={newMcqQuestion}
                        onChange={(e) => setNewMcqQuestion(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      {newMcqOpts.map((opt, oIdx) => (
                        <div key={oIdx}>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option {oIdx + 1}</label>
                          <input
                            type="text"
                            required
                            placeholder={`Option ${oIdx + 1}`}
                            value={opt}
                            onChange={(e) => {
                              const next = [...newMcqOpts];
                              next[oIdx] = e.target.value;
                              setNewMcqOpts(next);
                            }}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                          />
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Correct Answer Option</label>
                      <select
                        value={newMcqCorrectIndex}
                        onChange={(e) => setNewMcqCorrectIndex(Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-bold transition"
                      >
                        <option value={0}>Option 1: {newMcqOpts[0] || '(Empty)'}</option>
                        <option value={1}>Option 2: {newMcqOpts[1] || '(Empty)'}</option>
                        <option value={2}>Option 3: {newMcqOpts[2] || '(Empty)'}</option>
                        <option value={3}>Option 4: {newMcqOpts[3] || '(Empty)'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reason / Explanation (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Detrimental means causing harm or damage."
                        value={newMcqExplanation}
                        onChange={(e) => setNewMcqExplanation(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-xs"
                    >
                      Add Question
                    </button>
                  </form>
                </div>
              </div>

              {/* Existing Questions Table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">Existing Course MCQ Questions ({mcqQuestions.length})</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Stored custom questions for the current course.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {mcqQuestions.length > 0 && (
                      <button
                        onClick={handleBulkDeleteMcqQuestions}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Bulk Delete All</span>
                      </button>
                    )}
                    <button
                      onClick={() => fetchMcqQuestions()}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${mcqQuestionsLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {mcqQuestionsLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-xs font-bold font-mono">Loading questions...</span>
                  </div>
                ) : mcqQuestions.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No MCQ questions found</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Please upload an Excel sheet or add questions manually.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-100 font-sans">
                          <th className="px-4 py-3">Question</th>
                          <th className="px-4 py-3">Options</th>
                          <th className="px-4 py-3">Answer</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {mcqQuestions.map((q) => (
                          <tr key={q.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3.5 font-medium text-slate-800 max-w-xs truncate" title={q.question}>
                              {q.question}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[10px] text-slate-500">
                              {q.options.join(', ')}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 font-black rounded text-[10px]">
                                {q.answer}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteMcqQuestion(q.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
                                title="Delete question"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 6: Vocabulary Stories Upload & Management */}
          {gameUploadSubTab === 'story' && (
            <div className="space-y-8">
              {!selectedGameCourseId && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs font-bold text-amber-900">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>কোর্স স্টোরি আপলোড বা ম্যানেজ করার জন্য অনুগ্রহ করে উপরে ড্রপডাউন থেকে একটি নির্দিষ্ট কোর্স সিলেক্ট করুন।</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Upload File & Paste Text Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-pink-500" />
                      <span>Upload Course Stories (File / Text)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Upload stories from .txt, .docx, .pdf, .csv, or .json files, or paste raw text.
                    </p>
                  </div>

                  {/* File Upload Box */}
                  <div className="border-2 border-dashed border-slate-200 hover:border-pink-400 rounded-2xl p-6 text-center transition cursor-pointer relative bg-slate-50/50">
                    <input 
                      type="file" 
                      accept=".txt, .docx, .pdf, .csv, .json, .md" 
                      onChange={handleUploadStoryFile}
                      disabled={storyUploadLoading || !selectedGameCourseId}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <UploadCloud className="w-8 h-8 text-pink-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Click or drag Story file here</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Supports .txt, .docx, .pdf, .csv, .json, .md</p>
                  </div>

                  {/* Paste Raw Text Box */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Or Paste Raw Story Text
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Format: <code className="bg-slate-100 px-1 py-0.5 rounded text-pink-600 font-mono">Title: My Story ... Story: Story text goes here...</code>
                    </p>
                    <textarea
                      rows={5}
                      value={pastedStoryText}
                      onChange={(e) => setPastedStoryText(e.target.value)}
                      placeholder="Paste your story text here..."
                      className="w-full text-xs text-slate-700 border border-slate-200 rounded-xl p-3 focus:border-pink-500 outline-none resize-y"
                    />
                    <button
                      type="button"
                      disabled={storyUploadLoading || !pastedStoryText.trim() || !selectedGameCourseId}
                      onClick={handleUploadStoryText}
                      className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {storyUploadLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                      <span>Parse &amp; Upload Pasted Stories</span>
                    </button>
                  </div>

                  {storyUploadError && (
                    <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{storyUploadError}</span>
                    </div>
                  )}

                  {storySaveStatus === 'saved' && (
                    <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      <span>Stories saved to course successfully!</span>
                    </div>
                  )}
                </div>

                {/* Manual Add Story Form */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-pink-500" />
                      <span>Add Single Story Manually</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">Create a single new vocabulary story for this course.</p>
                  </div>

                  <form onSubmit={handleManualAddStory} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Story Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. The Enchanted Library"
                        value={manualStoryTitle}
                        onChange={(e) => setManualStoryTitle(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-pink-500 focus:bg-white rounded-xl text-xs transition outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Story Content</label>
                      <textarea
                        rows={8}
                        required
                        placeholder="Type the full story narrative here..."
                        value={manualStoryContent}
                        onChange={(e) => setManualStoryContent(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-pink-500 focus:bg-white rounded-xl text-xs transition outline-none resize-y"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={storySaveStatus === 'saving' || !selectedGameCourseId}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Story to Course</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Published Stories Table for Selected Course */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-pink-600" />
                      <span>
                        Published Course Stories (
                        {customCourses.find(c => c.id === selectedGameCourseId)?.stories?.length || 0}
                        )
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {selectedGameCourseId 
                        ? `Course: ${customCourses.find(c => c.id === selectedGameCourseId)?.title || selectedGameCourseId}`
                        : 'Select a course to view its stories'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {(customCourses.find(c => c.id === selectedGameCourseId)?.stories?.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDeleteCourseStories}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete All Stories</span>
                      </button>
                    )}
                  </div>
                </div>

                {(!customCourses.find(c => c.id === selectedGameCourseId)?.stories || 
                  customCourses.find(c => c.id === selectedGameCourseId)?.stories?.length === 0) ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No stories found for this course</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Upload a story file or add a story manually using the forms above.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customCourses.find(c => c.id === selectedGameCourseId)?.stories?.map((st, idx) => (
                      <div key={st.id || idx} className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2 hover:border-pink-200 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2 py-0.5 bg-pink-100 text-pink-700 rounded-md">
                              #{idx + 1}
                            </span>
                            <h5 className="font-extrabold text-xs text-slate-850 truncate max-w-[200px]" title={st.title}>
                              {st.title}
                            </h5>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCourseStory(st.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                            title="Delete Story"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {st.story}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 7: Course Articles Upload & Management */}
          {gameUploadSubTab === 'article' && (
            <div className="space-y-8">
              {!selectedGameCourseId && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs font-bold text-amber-900">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>কোর্স আর্টিকেল আপলোড বা ম্যানেজ করার জন্য অনুগ্রহ করে উপরে ড্রপডাউন থেকে একটি নির্দিষ্ট কোর্স সিলেক্ট করুন।</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Upload File & Paste Text Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <Newspaper className="w-4 h-4 text-indigo-500" />
                      <span>Upload Course Articles (File / Text)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Upload articles from .txt, .docx, .pdf, .csv, or .json files, or paste raw text.
                    </p>
                  </div>

                  {/* File Upload Box */}
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition cursor-pointer relative bg-slate-50/50">
                    <input 
                      type="file" 
                      accept=".txt, .docx, .pdf, .csv, .json, .md" 
                      onChange={handleUploadArticleFile}
                      disabled={articleUploadLoading || !selectedGameCourseId}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Click or drag Article file here</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Supports .txt, .docx, .pdf, .csv, .json, .md</p>
                  </div>

                  {/* Paste Raw Text Box */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Or Paste Raw Article Text
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Format: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">Title: My Article ... Article: Article text goes here...</code>
                    </p>
                    <textarea
                      rows={5}
                      value={pastedArticleText}
                      onChange={(e) => setPastedArticleText(e.target.value)}
                      placeholder="Paste your article text here..."
                      className="w-full text-xs text-slate-700 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none resize-y"
                    />
                    <button
                      type="button"
                      disabled={articleUploadLoading || !pastedArticleText.trim() || !selectedGameCourseId}
                      onClick={handleUploadArticleText}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {articleUploadLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                      <span>Parse &amp; Upload Pasted Articles</span>
                    </button>
                  </div>

                  {articleUploadError && (
                    <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{articleUploadError}</span>
                    </div>
                  )}

                  {articleSaveStatus === 'saved' && (
                    <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      <span>Articles saved to course successfully!</span>
                    </div>
                  )}
                </div>

                {/* Manual Add Article Form */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-indigo-500" />
                      <span>Add Single Article Manually</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">Create a single new article for this course.</p>
                  </div>

                  <form onSubmit={handleManualAddArticle} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Article Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Deep Vocabulary Insights"
                        value={manualArticleTitle}
                        onChange={(e) => setManualArticleTitle(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                        <input
                          type="text"
                          value={manualArticleCategory}
                          onChange={(e) => setManualArticleCategory(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Author</label>
                        <input
                          type="text"
                          value={manualArticleAuthor}
                          onChange={(e) => setManualArticleAuthor(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Read Time</label>
                        <input
                          type="text"
                          value={manualArticleReadTime}
                          onChange={(e) => setManualArticleReadTime(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Excerpt / Brief Summary</label>
                      <input
                        type="text"
                        placeholder="Brief summary shown on card..."
                        value={manualArticleExcerpt}
                        onChange={(e) => setManualArticleExcerpt(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Article Content</label>
                      <textarea
                        rows={5}
                        required
                        placeholder="Type full article text here..."
                        value={manualArticleContent}
                        onChange={(e) => setManualArticleContent(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs transition outline-none resize-y font-normal"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={articleSaveStatus === 'saving' || !selectedGameCourseId}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Article to Course</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Published Articles Table for Selected Course */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <Newspaper className="w-4 h-4 text-indigo-600" />
                      <span>
                        Published Course Articles (
                        {customCourses.find(c => c.id === selectedGameCourseId)?.articles?.length || 0}
                        )
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {selectedGameCourseId 
                        ? `Course: ${customCourses.find(c => c.id === selectedGameCourseId)?.title || selectedGameCourseId}`
                        : 'Select a course to view its articles'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {(customCourses.find(c => c.id === selectedGameCourseId)?.articles?.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDeleteCourseArticles}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete All Articles</span>
                      </button>
                    )}
                  </div>
                </div>

                {(!customCourses.find(c => c.id === selectedGameCourseId)?.articles || 
                  customCourses.find(c => c.id === selectedGameCourseId)?.articles?.length === 0) ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Newspaper className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No articles found for this course</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Upload an article file or add an article manually using the forms above.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customCourses.find(c => c.id === selectedGameCourseId)?.articles?.map((art, idx) => (
                      <div key={art.id || idx} className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2 hover:border-indigo-200 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">
                              #{idx + 1}
                            </span>
                            <h5 className="font-extrabold text-xs text-slate-850 truncate max-w-[200px]" title={art.title}>
                              {art.title}
                            </h5>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCourseArticle(art.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                            title="Delete Article"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                          <span className="bg-slate-200/60 px-1.5 py-0.5 rounded">{art.category || 'Reading'}</span>
                          <span>•</span>
                          <span>{art.author || 'Educator'}</span>
                          <span>•</span>
                          <span>{art.readTime || '4 min'}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {art.excerpt || art.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeAdminTab === 'activity-logs' && (
        <ActivityLogsView currentAdminEmail={auth.currentUser?.email || 'mohammad.001ekram@gmail.com'} />
      )}

      {activeAdminTab === 'landing-editor' && (
        <LandingPageEditor
          settings={settings}
          onSaveSettings={(updatedSettings) => {
            if (onUpdateSettings) {
              onUpdateSettings(updatedSettings);
            }
            showToast('Landing page content & badges saved globally to Firestore system settings!', 'success');
          }}
          courses={customCourses}
        />
      )}

      {/* User Details Slideover / Modal */}
      {selectedUser && (() => {
        const selectedUserStats = getUserOverallStatsAndRank(selectedUser, users, allAdminCoursesList, accessRequests, words);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end z-50 animate-fade-in" id="user-details-modal">
            <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl relative animate-slide-left font-sans">
              
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                    {selectedUser.email[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                      <span>{selectedUser.email.split('@')[0]}</span>
                      <button 
                        onClick={() => copyToClipboard(selectedUser.email)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer" 
                        title="Copy email address"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black flex items-center gap-1 border border-amber-200">
                        <Trophy className="w-3 h-3 text-amber-600 fill-amber-500" />
                        <span>Rank #{selectedUserStats.rank}</span>
                      </span>
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wide">ID: {selectedUser.id}</p>
                      <span className="text-slate-300">•</span>
                      <span className="text-[10px] text-indigo-600 font-extrabold">{selectedUserStats.enrolledCourses.length} Enrolled Courses</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex border-b border-slate-100 px-6 bg-slate-50 text-xs font-bold text-slate-500 gap-6 overflow-x-auto">
                <button 
                  onClick={() => setActiveUserTab('enrolled')}
                  className={`py-3.5 border-b-2 transition outline-none cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    activeUserTab === 'enrolled' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Enrolled Courses & Rank</span>
                </button>
                <button 
                  onClick={() => setActiveUserTab('progress')}
                  className={`py-3.5 border-b-2 transition outline-none cursor-pointer shrink-0 ${
                    activeUserTab === 'progress' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
                  }`}
                >
                  Vocabulary Progress
                </button>
                <button 
                  onClick={() => setActiveUserTab('analytics')}
                  className={`py-3.5 border-b-2 transition outline-none cursor-pointer shrink-0 ${
                    activeUserTab === 'analytics' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
                  }`}
                >
                  Targets & Goals
                </button>
                <button 
                  onClick={() => setActiveUserTab('settings')}
                  className={`py-3.5 border-b-2 transition outline-none cursor-pointer shrink-0 ${
                    activeUserTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
                  }`}
                >
                  User Settings
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {activeUserTab === 'enrolled' && (
                  <div className="space-y-6 font-sans">
                    {/* Top Gradient Rank & Performance Summary Banner */}
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-800/60">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center divide-x divide-indigo-800/50">
                        
                        <div className="px-2">
                          <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">Global Rank</span>
                          <div className="mt-1 flex items-center justify-center gap-1">
                            <Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
                            <span className="text-xl font-black text-amber-300 font-mono">#{selectedUserStats.rank}</span>
                            <span className="text-[10px] text-indigo-200">/ {selectedUserStats.totalUsers}</span>
                          </div>
                        </div>

                        <div className="px-2">
                          <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">Overall Progress</span>
                          <div className="mt-1 flex items-center justify-center gap-1">
                            <span className="text-xl font-black text-emerald-400 font-mono">{selectedUserStats.overallPercent}%</span>
                          </div>
                        </div>

                        <div className="px-2">
                          <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">Words Mastered</span>
                          <div className="mt-1 flex items-center justify-center gap-1">
                            <span className="text-xl font-black text-white font-mono">{selectedUserStats.totalKnow}</span>
                            <span className="text-[10px] text-indigo-300">/ {selectedUserStats.totalTargetWords}</span>
                          </div>
                        </div>

                        <div className="px-2">
                          <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">Enrolled Courses</span>
                          <div className="mt-1 flex items-center justify-center gap-1">
                            <BookOpen className="w-4 h-4 text-indigo-400" />
                            <span className="text-xl font-black text-white font-mono">{selectedUserStats.enrolledCourses.length}</span>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Enrolled Courses Breakdown List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                          <span>Enrolled Courses Statistics ({selectedUserStats.enrolledCourses.length})</span>
                        </h4>
                      </div>

                      <div className="space-y-3">
                        {selectedUserStats.enrolledCourses.map(course => {
                          const cStats = getUserCourseProgressStats(selectedUser, course, words);
                          const isCompleted = cStats.progressPercent >= 100;

                          return (
                            <div key={course.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:border-indigo-300 transition space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-extrabold text-slate-900 text-sm">{course.title}</h5>
                                    {course.isDefault && (
                                      <span className="text-[9px] font-extrabold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                                        Default Free
                                      </span>
                                    )}
                                    {!course.isDefault && (
                                      <span className="text-[9px] font-extrabold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                                        ৳{course.price || 0} BDT
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                                    {course.description || 'Interactive vocabulary course'}
                                  </p>
                                </div>

                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1 shrink-0 ${
                                  isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-50 text-indigo-700'
                                }`}>
                                  {isCompleted ? '🎉 100% Completed' : `${cStats.progressPercent}% Progress`}
                                </span>
                              </div>

                              {/* Course Progress Bar */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                                  <span>
                                    {cStats.knowCount} / {cStats.totalWords} words mastered ({cStats.progressPercent}%)
                                  </span>
                                  <span className="text-slate-400">
                                    {cStats.confusionCount} Confused • {cStats.dontKnowCount} Needs Work • {cStats.unstudiedCount} Unstudied
                                  </span>
                                </div>

                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${cStats.progressPercent}%` }} />
                                  <div className="bg-amber-400 h-full transition-all" style={{ width: `${Math.round((cStats.confusionCount / cStats.totalWords) * 100)}%` }} />
                                  <div className="bg-rose-400 h-full transition-all" style={{ width: `${Math.round((cStats.dontKnowCount / cStats.totalWords) * 100)}%` }} />
                                </div>
                              </div>

                              {/* Sub-metrics breakdown pills */}
                              <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                                  <span className="text-[9px] text-slate-400 font-bold block">Target</span>
                                  <span className="text-xs font-black text-slate-800 font-mono">{cStats.totalWords}</span>
                                </div>
                                <div className="bg-emerald-50/70 rounded-xl p-2 border border-emerald-100">
                                  <span className="text-[9px] text-emerald-700 font-bold block">Known</span>
                                  <span className="text-xs font-black text-emerald-800 font-mono">{cStats.knowCount}</span>
                                </div>
                                <div className="bg-amber-50/70 rounded-xl p-2 border border-amber-100">
                                  <span className="text-[9px] text-amber-700 font-bold block">Confusion</span>
                                  <span className="text-xs font-black text-amber-800 font-mono">{cStats.confusionCount}</span>
                                </div>
                                <div className="bg-rose-50/70 rounded-xl p-2 border border-rose-100">
                                  <span className="text-[9px] text-rose-700 font-bold block">Needs Work</span>
                                  <span className="text-xs font-black text-rose-800 font-mono">{cStats.dontKnowCount}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              {activeUserTab === 'progress' && (
                <div className="space-y-6">
                  {/* Progress Summary Mini-Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                      <span className="text-xs text-emerald-800/80 font-bold block">Know</span>
                      <span className="text-xl font-black text-emerald-800 font-mono">
                        {getProgressValues(selectedUser.progress).filter(p => p.status === 'know').length}
                      </span>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-center">
                      <span className="text-xs text-amber-800/80 font-bold block">Confusion</span>
                      <span className="text-xl font-black text-amber-800 font-mono">
                        {getProgressValues(selectedUser.progress).filter(p => p.status === 'confusion').length}
                      </span>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-center">
                      <span className="text-xs text-rose-800/80 font-bold block">Don't Know</span>
                      <span className="text-xl font-black text-rose-800 font-mono">
                        {getProgressValues(selectedUser.progress).filter(p => p.status === 'dont_know').length}
                      </span>
                    </div>
                  </div>

                  {/* Word Filter Tabs */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-800 text-sm">Evaluation List</h4>
                      
                      <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold text-slate-500 gap-1">
                        {[
                          { key: 'all' as const, label: 'All' },
                          { key: 'know' as const, label: 'Know' },
                          { key: 'confusion' as const, label: 'Confusion' },
                          { key: 'dont_know' as const, label: 'Don\'t Know' }
                        ].map(f => (
                          <button
                            key={f.key}
                            onClick={() => setActiveWordFilter(f.key)}
                            className={`px-2.5 py-1 rounded-lg transition outline-none cursor-pointer ${
                              activeWordFilter === f.key ? 'bg-white text-slate-800 shadow-sm' : 'hover:text-slate-800'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Word List Render */}
                    <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden max-h-80 overflow-y-auto">
                      {getProgressEntries(selectedUser.progress)
                        .filter(([_, p]) => activeWordFilter === 'all' || p.status === activeWordFilter)
                        .length === 0 ? (
                          <div className="p-8 text-center text-slate-400 font-bold text-xs">
                            No words recorded in this category.
                          </div>
                        ) : (
                          getProgressEntries(selectedUser.progress)
                            .filter(([_, p]) => activeWordFilter === 'all' || p.status === activeWordFilter)
                            .map(([wordId, p]) => {
                              const w = words.find(item => item.id === wordId);
                              if (!w) return null;
                              return (
                                <div key={wordId} className="p-3 bg-white hover:bg-slate-50/50 flex items-center justify-between transition">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-slate-800">{w.word}</span>
                                      <span className="text-[9px] text-slate-400 font-bold">Group {w.group}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{w.meaning}</p>
                                    {p.notes && (
                                      <p className="text-[10px] text-indigo-600 font-medium italic mt-1 bg-indigo-50/50 px-2 py-1 rounded">
                                        Note: {p.notes}
                                      </p>
                                    )}
                                  </div>

                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                                    p.status === 'know' ? 'bg-emerald-50 text-emerald-700' :
                                    p.status === 'confusion' ? 'bg-amber-50 text-amber-700' :
                                    'bg-rose-50 text-rose-700'
                                  }`}>
                                    {p.status === 'know' && <CheckCircle className="w-3 h-3" />}
                                    {p.status === 'confusion' && <AlertTriangle className="w-3 h-3" />}
                                    {p.status === 'dont_know' && <XCircle className="w-3 h-3" />}
                                    {p.status === 'know' ? 'Know' : p.status === 'confusion' ? 'Confusion' : 'Don\'t Know'}
                                  </span>
                                </div>
                              );
                            })
                        )}
                    </div>
                  </div>
                </div>
              )}

              {activeUserTab === 'analytics' && (
                <div className="space-y-6">
                  {/* Study Streak & Target */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block">Daily Study Target</span>
                      <span className="text-xl font-black text-slate-800 font-mono">{selectedUser.goal?.dailyTarget || 15} words</span>
                    </div>

                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-4 py-2.5 rounded-2xl text-amber-800">
                      <Flame className="w-5 h-5 text-amber-500 animate-bounce" />
                      <div>
                        <span className="text-[10px] text-amber-700 font-bold block">Current Streak</span>
                        <span className="text-base font-black font-mono">{selectedUser.goal?.streak || 0} days</span>
                      </div>
                    </div>
                  </div>

                  {/* Study History Days list */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-500" />
                      <span>Study History Log</span>
                    </h4>

                    {!selectedUser.goal?.history || Object.keys(selectedUser.goal.history).length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-bold border border-dashed border-slate-200 rounded-2xl text-xs">
                        No study history logs recorded yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(selectedUser.goal.history)
                          .sort((a, b) => b[0].localeCompare(a[0]))
                          .map(([dateStr, count]) => (
                            <div key={dateStr} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                              <span className="text-slate-600 font-bold text-xs">{dateStr}</span>
                              <span className="text-xs bg-emerald-50 text-emerald-700 font-mono px-2 py-0.5 rounded-lg font-black">
                                +{Number(count)} words
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeUserTab === 'settings' && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-800 text-sm">App Configuration Settings</h4>
                  
                  <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                    <div className="p-4 flex items-center justify-between">
                      <span>Default Flashcard Order</span>
                      <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg font-extrabold uppercase text-[10px] tracking-wider">
                        {selectedUser.settings?.defaultFlashcardOrder || 'random'}
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>Auto-play Audio Pronunciation</span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                        selectedUser.settings?.autoPlayAudio ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {selectedUser.settings?.autoPlayAudio ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>Quiz Length</span>
                      <span className="bg-indigo-50 text-indigo-700 font-mono font-black px-3 py-1 rounded-lg">
                        {selectedUser.settings?.quizLength || 10} words
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>Flashcard Rotation Animation</span>
                      <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg font-bold font-mono">
                        {selectedUser.settings?.flashcardAnimation || 'shuffle'}
                      </span>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <span>Daily Banner Flashcard Overlay</span>
                      <span className="bg-indigo-50 text-indigo-800 px-3 py-1 rounded-lg font-extrabold text-[10px]">
                        {selectedUser.settings?.flashcardBannerAnim === 'once_daily'
                          ? '1 Time / Day'
                          : selectedUser.settings?.flashcardBannerAnim === 'disabled'
                          ? 'Disabled (0)'
                          : '2 Times / Day'}
                      </span>
                    </div>

                    <div className="p-4 space-y-3 bg-indigo-50/50">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-indigo-600" />
                          Wallet Balance Management
                        </span>
                        <span className="font-bold font-mono text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                          ৳{selectedUser.walletBalance ?? selectedUser.balance ?? 0} BDT
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Executes atomic Firestore transactions on <code className="font-mono text-indigo-600">user_wallets</code> and <code className="font-mono text-indigo-600">users</code> documents.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            const success = await updateUserWallet(selectedUser.email, 50, false);
                            if (success) {
                              setSelectedUser(prev => prev ? { ...prev, walletBalance: (prev.walletBalance || prev.balance || 0) + 50 } : null);
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                        >
                          +৳50 BDT
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const success = await updateUserWallet(selectedUser.email, 100, false);
                            if (success) {
                              setSelectedUser(prev => prev ? { ...prev, walletBalance: (prev.walletBalance || prev.balance || 0) + 100 } : null);
                            }
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                        >
                          +৳100 BDT
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const input = prompt('Enter custom balance adjustment (e.g., 200 or -50) or set absolute amount:');
                            if (input && !isNaN(Number(input))) {
                              const val = Number(input);
                              const isAbs = window.confirm(`Set absolute balance to ৳${val} BDT? (Cancel to add/subtract ৳${val} BDT)`);
                              const success = await updateUserWallet(selectedUser.email, val, isAbs);
                              if (success) {
                                setSelectedUser(prev => prev ? { ...prev, walletBalance: isAbs ? val : (prev.walletBalance || prev.balance || 0) + val } : null);
                              }
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Custom...
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 transition text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
        );
      })()}

      {/* Edit Course Settings Modal */}
      {editingCourse && (
        <CourseSettings 
          course={editingCourse} 
          onClose={() => {
            setEditingCourse(null);
            setCourseSettingsInitialTab(undefined);
            setCourseSettingsInitialEditWordName(undefined);
          }} 
          onSaveSuccess={(updatedCourse) => {
            if (updatedCourse) {
              setCustomCourses(prev => {
                const idx = prev.findIndex(c => c.id === updatedCourse.id);
                const next = idx >= 0
                  ? prev.map(c => c.id === updatedCourse.id ? updatedCourse : c)
                  : [...prev, updatedCourse];
                safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(next));
                if (onCoursesUpdated) {
                  onCoursesUpdated(next);
                }
                return next;
              });
            }
          }} 
          initialTab={courseSettingsInitialTab}
          initialEditWordName={courseSettingsInitialEditWordName}
        />
      )}

      {/* Create New Course Modal */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in text-slate-700 p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl relative font-sans overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Create & Publish New Course</h3>
                  <p className="text-xs text-slate-400 font-medium">Upload Excel spreadsheet or paste word list to create a new course</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateCourseModal(false)}
                className="p-2 hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Title, Slug & Order */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">Course Title *</label>
                  <input
                    type="text"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    placeholder="e.g. BCS Special Wordlist"
                    className="w-full text-xs font-bold text-slate-900 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">Course ID / Slug *</label>
                  <input
                    type="text"
                    value={newCourseId}
                    onChange={(e) => {
                      setNewCourseId(e.target.value);
                      setIsSlugTouched(true);
                    }}
                    placeholder="bcs-special-wordlist"
                    className="w-full text-xs font-bold font-mono text-indigo-900 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">Order Index (Sort Position)</label>
                  <input
                    type="number"
                    value={newCourseOrder}
                    onChange={(e) => setNewCourseOrder(Number(e.target.value))}
                    placeholder="1"
                    className="w-full text-xs font-bold font-mono text-slate-900 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Course Description</label>
                <input
                  type="text"
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  placeholder="Brief overview of course content..."
                  className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCourseIsDefault}
                    onChange={(e) => setNewCourseIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-800">Set as Default Course</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCourseIsRestricted}
                    onChange={(e) => setNewCourseIsRestricted(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-800">Restricted Course (Specific Emails Only)</span>
                </label>
              </div>

              {newCourseIsRestricted && (
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">Allowed Student Emails (One email per line)</label>
                  <textarea
                    rows={3}
                    value={newCourseAllowedUsersText}
                    onChange={(e) => setNewCourseAllowedUsersText(e.target.value)}
                    placeholder="student1@gmail.com&#10;student2@gmail.com"
                    className="w-full text-xs font-mono text-slate-800 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none"
                  />
                </div>
              )}

              {/* Upload / Paste Tabs */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <button
                    type="button"
                    onClick={() => setCreationMethod('excel')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      creationMethod === 'excel'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Excel File (.xlsx / .xls)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMethod('paste')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      creationMethod === 'paste'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Paste Text / TSV
                  </button>
                </div>

                {creationMethod === 'excel' ? (
                  <label className="block cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 hover:border-indigo-500 p-6 rounded-2xl text-center transition group">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-800 block">Click or Drag & Drop Excel File</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Supports .xlsx and .xls files with columns: id, word, meaning, group, etc.</span>
                  </label>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      value={pasteInputText}
                      onChange={(e) => {
                        setPasteInputText(e.target.value);
                        processPastedText(e.target.value);
                      }}
                      placeholder="Paste tab-separated or comma-separated word list here..."
                      className="w-full text-xs font-mono text-slate-800 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none"
                    />
                  </div>
                )}

                {uploadError && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Parsed Words Summary & Preview — full-column table so every
                  parsed field can be checked before publishing, not just
                  word/meaning/group. */}
              {uploadedWords.length > 0 && (
                <div className="space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-900">
                      Parsed {uploadedWords.length} Words successfully!
                    </span>
                    <span className="text-[10px] font-bold font-mono text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                      {new Set(uploadedWords.map(w => w.group)).size} Groups Detected
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto overflow-x-auto border border-indigo-100 rounded-xl bg-white">
                    <table className="w-full text-left border-collapse text-[11px] min-w-[920px]">
                      <thead className="sticky top-0 bg-indigo-50 z-10">
                        <tr>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">#</th>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">ID</th>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">Group</th>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">Word</th>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">Meaning</th>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">Synonyms</th>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">Extra Word</th>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">Extra Meaning</th>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">Example</th>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">Mnemonic</th>
                          <th className="p-2 font-extrabold text-indigo-900 whitespace-nowrap">Pronunciation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-50">
                        {uploadedWords.map((w, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/40 transition">
                            <td className="p-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-2 font-mono text-slate-500">{w.id}</td>
                            <td className="p-2">
                              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                G{w.group}
                              </span>
                            </td>
                            <td className="p-2 font-extrabold text-slate-900 whitespace-nowrap">{w.word}</td>
                            <td className="p-2 text-slate-700">{w.meaning}</td>
                            <td className="p-2 text-slate-500">{w.synonyms || '—'}</td>
                            <td className="p-2 text-slate-500">{w.extraWord || '—'}</td>
                            <td className="p-2 text-slate-500">{w.extraMeaning || '—'}</td>
                            <td className="p-2 text-slate-500 max-w-[220px] truncate" title={w.example || ''}>{w.example || '—'}</td>
                            <td className="p-2 text-slate-500 max-w-[220px] truncate" title={w.mnemonic || ''}>{w.mnemonic || '—'}</td>
                            <td className="p-2 text-slate-500 max-w-[160px] truncate" title={w.pronunciation || ''}>{w.pronunciation || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {saveError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                  {saveError}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateCourseModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200/60 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveStatus === 'saving' || !newCourseTitle.trim() || !newCourseId.trim() || uploadedWords.length === 0}
                onClick={handleSaveCourse}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50"
              >
                {saveStatus === 'saving' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saveStatus === 'saving' ? 'Publishing Course...' : 'Save & Publish Course'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Student Modal */}
      <BulkCsvStudentModal
        isOpen={!!bulkCsvCourse}
        course={bulkCsvCourse}
        onClose={() => setBulkCsvCourse(null)}
        onApply={async (courseId, updatedAllowedUsers, updatedExpiries, mode) => {
          try {
            // Update DB
            await setDoc(doc(db, 'courses', courseId), {
              allowedUsers: updatedAllowedUsers,
              allowedUsersExpiry: updatedExpiries,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            // Update local courses state
            setCustomCourses(prev => prev.map(c => c.id === courseId ? {
              ...c,
              allowedUsers: updatedAllowedUsers,
              allowedUsersExpiry: updatedExpiries
            } : c));

            // Log activity
            const adminEmail = auth.currentUser?.email || 'mohammad.001ekram@gmail.com';
            await logAdminActivity(
              adminEmail,
              'student_permissions',
              'Bulk Added Students via CSV',
              `Updated student access list for course "${courseId}" (${mode} mode). Total allowed students: ${updatedAllowedUsers.length}`,
              courseId,
              { mode, count: updatedAllowedUsers.length, courseId }
            );

            showToast(`Successfully updated student access list for ${courseId}!`, 'success');
          } catch (err: any) {
            console.error('Error applying bulk CSV access:', err);
            showToast('Failed to update student access list.', 'error');
          }
        }}
      />

      {/* Supabase RLS Policy Script Modal */}
      <SupabaseRlsModal
        isOpen={showSupabaseRlsModal}
        onClose={() => setShowSupabaseRlsModal(false)}
      />
    </div>
  );
}
