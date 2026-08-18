import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Course, VocabularyWord, BlankQuestion, OddOneOutQuestion, WordAnalogyQuestion, CustomMcqQuestion, StoryItem, ArticleItem, Exam, ExamQuestion } from '../types';
import { extractTextFromWordFile, parseStoriesFromRawText, parseStoriesFromFile, parseArticlesFromFile, parseArticlesFromRawText } from '../utils/storyParser';
import { 
  X, 
  CheckCircle, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Sliders, 
  Users, 
  ToggleLeft, 
  ToggleRight, 
  Edit, 
  AlertCircle, 
  AlertTriangle,
  Copy, 
  Check, 
  BookOpen, 
  Newspaper,
  Search, 
  UploadCloud, 
  FileSpreadsheet, 
  PlusCircle, 
  ArrowLeft, 
  ArrowRight,
  Settings,
  HelpCircle,
  Eye,
  EyeOff,
  Volume2,
  UserCheck,
  ShieldCheck,
  Gamepad2,
  GraduationCap,
  Sparkles,
  Shuffle,
  Award,
  Save
} from 'lucide-react';
import { db, doc, setDoc, getDoc, collection, getDocs, updateDoc, deleteDoc, saveBulkDocs, deleteBulkDocs, matchesCourseId, clearCollectionDocs, query, where } from '../lib/db';
import { safeGetLocalStorage, safeSetLocalStorage } from '../lib/storage';
import { read, utils, writeFile } from 'xlsx';
import {
  downloadBlankExcelTemplate,
  parseBlankExcel,
  downloadOooExcelTemplate,
  parseOooExcel,
  downloadAnalogyExcelTemplate,
  parseAnalogyExcel,
  downloadMcqExcelTemplate,
  parseMcqExcel,
  downloadExamExcelTemplate,
  parseExamExcel
} from '../lib/gameExcelUtils';
import { ExcelImportStatsReport, ImportStatsReport } from './ExcelImportStatsReport';

interface CourseSettingsProps {
  course: Course;
  onClose: () => void;
  onSaveSuccess: (updatedCourse?: Course) => void;
  initialTab?: 'general' | 'variables' | 'access' | 'students' | 'wordlist' | 'addwords' | 'verification' | 'blank-questions' | 'ooo-questions' | 'analogy-questions' | 'mcq-questions' | 'practice-games' | 'story-management' | 'article-management';
  initialEditWordName?: string;
}

export const CourseSettings: React.FC<CourseSettingsProps> = ({
  course,
  onClose,
  onSaveSuccess,
  initialTab,
  initialEditWordName,
}) => {
  // Instruction font style as requested by user
  const settingInstructionStyle: React.CSSProperties = {
    fontFamily: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize: '10px',
    color: 'oklch(0.704 0.04 256.788)',
    fontWeight: 500,
    lineHeight: '10px',
    letterSpacing: '-0.25px',
  };

  const getNormalizedActiveTab = (tab?: string) => {
    if (tab === 'students' || tab === 'verification') return 'access';
    if (tab === 'addwords') return 'wordlist';
    return tab || 'general';
  };

  // Navigation Section (Settings Sidebar style)
  const [activeTab, setActiveTab] = useState<string>(() => getNormalizedActiveTab(initialTab));
  const [accessSubTab, setAccessSubTab] = useState<'access' | 'students' | 'verification'>(() => {
    if (initialTab === 'students') return 'students';
    if (initialTab === 'verification') return 'verification';
    return 'access';
  });
  const [wordlistSubTab, setWordlistSubTab] = useState<'wordlist' | 'addwords'>(() => {
    if (initialTab === 'addwords') return 'addwords';
    return 'wordlist';
  });

  // --- BLANK QUESTIONS STATES ---
  const [courseBlankQuestions, setCourseBlankQuestions] = useState<BlankQuestion[]>([]);
  const [blankQuestionsLoading, setBlankQuestionsLoading] = useState(false);
  const [newSentence, setNewSentence] = useState('');
  const [newOpt1, setNewOpt1] = useState('');
  const [newOpt2, setNewOpt2] = useState('');
  const [newOpt3, setNewOpt3] = useState('');
  const [newOpt4, setNewOpt4] = useState('');
  const [newCorrectIndex, setNewCorrectIndex] = useState<number>(0);

  const [excelQuestionsPreview, setExcelQuestionsPreview] = useState<BlankQuestion[]>([]);
  const [excelUploadError, setExcelUploadError] = useState<string | null>(null);
  const [excelSaveStatus, setExcelSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- OOO QUESTIONS STATES ---
  const [courseOooQuestions, setCourseOooQuestions] = useState<OddOneOutQuestion[]>([]);
  const [oooQuestionsLoading, setOooQuestionsLoading] = useState(false);
  const [newOooWords, setNewOooWords] = useState<string[]>(['', '', '', '']);
  const [newOooCorrectIndex, setNewOooCorrectIndex] = useState<number>(0);
  const [newOooReason, setNewOooReason] = useState('');
  const [excelOooPreview, setExcelOooPreview] = useState<OddOneOutQuestion[]>([]);
  const [excelOooUploadError, setExcelOooUploadError] = useState<string | null>(null);
  const [excelOooSaveStatus, setExcelOooSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- ANALOGY QUESTIONS STATES ---
  const [courseAnalogyQuestions, setCourseAnalogyQuestions] = useState<WordAnalogyQuestion[]>([]);
  const [analogyQuestionsLoading, setAnalogyQuestionsLoading] = useState(false);
  const [newAnalogy, setNewAnalogy] = useState('');
  const [newAnalogyOpts, setNewAnalogyOpts] = useState<string[]>(['', '', '', '']);
  const [newAnalogyCorrectIndex, setNewAnalogyCorrectIndex] = useState<number>(0);
  const [newAnalogyExplanation, setNewAnalogyExplanation] = useState('');
  const [excelAnalogyPreview, setExcelAnalogyPreview] = useState<WordAnalogyQuestion[]>([]);
  const [excelAnalogyUploadError, setExcelAnalogyUploadError] = useState<string | null>(null);
  const [excelAnalogySaveStatus, setExcelAnalogySaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- MCQ QUESTIONS STATES ---
  const [courseMcqQuestions, setCourseMcqQuestions] = useState<CustomMcqQuestion[]>([]);
  const [mcqQuestionsLoading, setMcqQuestionsLoading] = useState(false);
  const [newMcqQuestion, setNewMcqQuestion] = useState('');
  const [newMcqOpts, setNewMcqOpts] = useState<string[]>(['', '', '', '']);
  const [newMcqCorrectIndex, setNewMcqCorrectIndex] = useState<number>(0);
  const [newMcqExplanation, setNewMcqExplanation] = useState('');
  const [excelMcqPreview, setExcelMcqPreview] = useState<CustomMcqQuestion[]>([]);
  const [excelMcqUploadError, setExcelMcqUploadError] = useState<string | null>(null);
  const [excelMcqNotice, setExcelMcqNotice] = useState<string[] | null>(null);
  const [excelMcqSaveStatus, setExcelMcqSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- ONLINE EXAMS STATES ---
  const [courseExams, setCourseExams] = useState<Exam[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [examTitleInput, setExamTitleInput] = useState('');
  const [examDurationInput, setExamDurationInput] = useState<number>(15);
  const [examMarksPerQInput, setExamMarksPerQInput] = useState<number>(1);
  const [examNegativeMarkInput, setExamNegativeMarkInput] = useState<number>(0.25);
  const [excelExamPreview, setExcelExamPreview] = useState<ExamQuestion[]>([]);
  const [excelExamUploadError, setExcelExamUploadError] = useState<string | null>(null);
  const [excelExamNotice, setExcelExamNotice] = useState<string[] | null>(null);
  const [excelExamSaveStatus, setExcelExamSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- GENERAL COURSE STATES ---
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [localPlaceLabels, setLocalPlaceLabels] = useState<Record<string, string>>(course.placeLabels || {});
  const [isDefault, setIsDefault] = useState(!!course.isDefault);
  const [isRestricted, setIsRestricted] = useState(!!course.isRestricted);
  const [hidden, setHidden] = useState<boolean>(!!course.hidden);
  const [price, setPrice] = useState<number>((course.price && course.price > 0) ? course.price : 30);
  const [bkashNumber, setBkashNumber] = useState<string>((course.bkashNumber && course.bkashNumber !== '01700000000' && course.bkashNumber.trim() !== '') ? course.bkashNumber : '01581624202');
  const [googleSearchQuery, setGoogleSearchQuery] = useState<string>(course.googleSearchQuery || '');
  const [allowedUsers, setAllowedUsers] = useState<string[]>(course.allowedUsers || []);
  const [allowedUsersExpiry, setAllowedUsersExpiry] = useState<Record<string, string>>(course.allowedUsersExpiry || {});
  const [accessDurationDays, setAccessDurationDays] = useState<number>(course.accessDurationDays || 365);
  const [newUserInput, setNewUserInput] = useState('');
  const [newStudentExpiry, setNewStudentExpiry] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [bulkExpiryDate, setBulkExpiryDate] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [courseOrder, setCourseOrder] = useState<number>(course.order !== undefined ? course.order : 0);

  const prevCourseIdRef = useRef<string | null>(null);

  // Sync state whenever course ID or course prop initializes
  useEffect(() => {
    if (!course) return;
    if (prevCourseIdRef.current !== course.id) {
      prevCourseIdRef.current = course.id;
      setTitle(course.title || '');
      setDescription(course.description || '');
      setLocalPlaceLabels(course.placeLabels || {});
      setIsDefault(!!course.isDefault);
      setIsRestricted(!!course.isRestricted);
      setHidden(!!course.hidden);
      setPrice((course.price && course.price > 0) ? course.price : 30);
      setBkashNumber((course.bkashNumber && course.bkashNumber !== '01700000000' && course.bkashNumber.trim() !== '') ? course.bkashNumber : '01581624202');
      setGoogleSearchQuery(course.googleSearchQuery || '');
      setAllowedUsers(course.allowedUsers || []);
      setAllowedUsersExpiry(course.allowedUsersExpiry || {});
      setAccessDurationDays(course.accessDurationDays || 365);
      setCourseOrder(course.order !== undefined ? course.order : 0);
      setVerifiedPayments(course.verifiedPayments || []);
      setLocalWords(sanitizeWordsList(course.words || []));
      setLocalStories(course.stories || []);
      setLocalArticles(course.articles || []);
      setBulkInput((course.allowedUsers || []).join('\n'));
      setEnabledGames({
        quiz: true,
        match: true,
        word_search: true,
        synonym: true,
        blank: true,
        odd_one_out: true,
        analogy: true,
        story: true,
        article: true,
        exam: true,
        flashcards: true,
        spelling: true,
        ...(course.enabledGames || {})
      });
      setToggles({
        meaning: true,
        synonyms: true,
        extraWord: true,
        extraMeaning: true,
        example: true,
        audio: true,
        ...(course.variableToggles || {})
      });
      setSelectedWordIds(new Set());
      const normalized = getNormalizedActiveTab(initialTab);
      setActiveTab(normalized);
      if (initialTab === 'students') setAccessSubTab('students');
      else if (initialTab === 'verification') setAccessSubTab('verification');
      else if (initialTab === 'access') setAccessSubTab('access');

      if (initialTab === 'addwords') setWordlistSubTab('addwords');
      else if (initialTab === 'wordlist') setWordlistSubTab('wordlist');
      setHasAutoOpened(false);
    }
  }, [course?.id, initialTab]);

  // --- AUTO-VERIFICATION PAYMENT STATES ---
  const [verifiedPayments, setVerifiedPayments] = useState<{ bkashNumber: string; trxId: string; amount?: number }[]>(course.verifiedPayments || []);
  const [newVpNumber, setNewVpNumber] = useState('');
  const [newVpTrxId, setNewVpTrxId] = useState('');
  const [newVpAmount, setNewVpAmount] = useState<number>(75);
  const [vpBulkInput, setVpBulkInput] = useState('');
  const [dragActiveVp, setDragActiveVp] = useState(false);
  const [vpExcelError, setVpExcelError] = useState<string | null>(null);
  const [vpExcelSuccess, setVpExcelSuccess] = useState<string | null>(null);
  const [vpSearchQuery, setVpSearchQuery] = useState('');
  const [excelImportStats, setExcelImportStats] = useState<ImportStatsReport | null>(null);

  // --- ACCESS REQUESTS STATES & FUNCTIONS ---
  const [courseRequests, setCourseRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actionModalRequest, setActionModalRequest] = useState<any | null>(null);
  const [actionModalAmount, setActionModalAmount] = useState<string>('');
  const [isProcessingCourseAction, setIsProcessingCourseAction] = useState<boolean>(false);
  const [isAutoVerifyingCourse, setIsAutoVerifyingCourse] = useState<boolean>(false);
  const [autoVerifyCourseMsg, setAutoVerifyCourseMsg] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const qSnap = await getDocs(collection(db, 'access_requests'));
      const list: any[] = [];
      qSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.courseId === course.id || (Array.isArray(data.courseIds) && data.courseIds.includes(course.id))) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setCourseRequests(list);
    } catch (err) {
      console.error('Error fetching access requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const runAutoApprovals = async (requestsToProcess: any[], currentAllowed: string[], currentVps: typeof verifiedPayments) => {
    const cleanPhone = (p: string) => p.replace(/\D/g, '').slice(-10); // match last 10 digits
    let updatedAllowed = [...currentAllowed];
    let hasChanges = false;

    for (const req of requestsToProcess) {
      if (req.status !== 'pending') continue;

      const matchTrx = (req.trxId || '').toLowerCase().trim();
      const matchPhone = cleanPhone(req.bkashNumber || '');

      const matchedVp = currentVps.find(vp => {
        if (vp.claimed || vp.spent) return false;
        const vpPhone = cleanPhone(vp.bkashNumber || '');
        const vpTrx = (vp.trxId || '').toLowerCase().trim();
        return (vpPhone === matchPhone || (vp.bkashNumber || '').trim() === (req.bkashNumber || '').trim()) && vpTrx === matchTrx;
      });

      if (matchedVp) {
        try {
          const finalPrice = matchedVp.amount || Number(req.amount) || Number(req.totalPrice) || Number(req.price) || (Number(course.price) || 0);
          await handleApproveRequest(req, finalPrice);
          hasChanges = true;
        } catch (e) {
          console.error(`Failed to auto-approve request ${req.id}:`, e);
        }
      }
    }

    if (hasChanges) {
      fetchRequests();
    }
  };

  const handleRunCourseAutoVerification = async () => {
    setIsAutoVerifyingCourse(true);
    setAutoVerifyCourseMsg(null);
    try {
      const cleanPhone = (p: string) => p.replace(/\D/g, '').slice(-10);
      const reqSnap = await getDocs(collection(db, 'access_requests'));
      const pendingReqs: any[] = [];
      reqSnap.forEach(d => {
        const data = d.data();
        if (data.status === 'pending' && (data.courseId === course.id || (Array.isArray(data.courseIds) && data.courseIds.includes(course.id)))) {
          pendingReqs.push({ id: d.id, ...data });
        }
      });

      if (pendingReqs.length === 0) {
        setAutoVerifyCourseMsg('No pending requests found for this course.');
        setIsAutoVerifyingCourse(false);
        return;
      }

      // Collect verified payments from this course AND global settings
      let allVps: any[] = [...verifiedPayments];
      try {
        const gSnap = await getDoc(doc(db, 'system_settings', 'global_verified_payments'));
        if (gSnap.exists()) {
          const gList = gSnap.data().verifiedPayments || [];
          gList.forEach((gv: any) => {
            if (!allVps.some(v => v.bkashNumber === gv.bkashNumber && v.trxId.toLowerCase() === gv.trxId.toLowerCase())) {
              allVps.push(gv);
            }
          });
        }
      } catch (_) {}

      let approvedCount = 0;
      for (const req of pendingReqs) {
        const reqPhone = cleanPhone(req.bkashNumber || '');
        const reqTrx = (req.trxId || '').toLowerCase().trim();
        const matchedVp = allVps.find(vp => {
          if (vp.claimed || vp.spent) return false;
          const vpPhone = cleanPhone(vp.bkashNumber || '');
          const vpTrx = (vp.trxId || '').toLowerCase().trim();
          return (vpPhone === reqPhone || (vp.bkashNumber || '').trim() === (req.bkashNumber || '').trim()) && vpTrx === reqTrx;
        });

        if (matchedVp) {
          const matchAmt = matchedVp.amount || Number(req.amount) || Number(req.totalPrice) || Number(req.price) || (Number(course.price) || 0);
          await handleApproveRequest(req, matchAmt);
          approvedCount++;
        }
      }

      await fetchRequests();
      setAutoVerifyCourseMsg(`Auto-verification complete! Approved ${approvedCount} of ${pendingReqs.length} pending requests.`);
    } catch (err: any) {
      setAutoVerifyCourseMsg(`Auto-verification failed: ${err.message || String(err)}`);
    } finally {
      setIsAutoVerifyingCourse(false);
    }
  };

  const handleApproveRequest = async (req: any, overrideAmount?: number) => {
    try {
      const nowISO = new Date().toISOString();
      const emailLower = req.email.toLowerCase().trim();
      const isRecharge = req.courseId === 'wallet_recharge' || 
                         req.courseTitle?.toLowerCase().includes('recharge') ||
                         req.courseTitle?.toLowerCase().includes('wallet');
      const finalPrice = overrideAmount !== undefined 
        ? overrideAmount 
        : (Number(req.amount) || Number(req.totalPrice) || Number(req.price) || (Number(course.price) || 0));

      if (req.trxId) {
        const reqTrx = String(req.trxId).toLowerCase().trim();
        const usedTxSnap = await getDoc(doc(db, 'used_transactions', reqTrx));
        if (usedTxSnap.exists()) {
          const usedData = usedTxSnap.data();
          if (usedData.spent === true || usedData.status === 'spent') {
            alert(`Error: Transaction ID (${req.trxId}) is already marked as 'spent' in used_transactions lock collection.`);
            return;
          }
        }

        await setDoc(doc(db, 'used_transactions', reqTrx), {
          trxId: reqTrx,
          spent: true,
          status: 'spent',
          email: emailLower,
          usedBy: emailLower,
          bkashNumber: req.bkashNumber || '',
          amount: finalPrice,
          createdAt: nowISO,
          usedAt: nowISO
        }, { merge: true });
      }

      const reqRef = doc(db, 'access_requests', req.id);
      await updateDoc(reqRef, { 
        status: 'approved', 
        spent: true, 
        spentAt: nowISO,
        amount: finalPrice,
        totalPrice: finalPrice,
        price: finalPrice
      });
      
      setCourseRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved', spent: true, amount: finalPrice, totalPrice: finalPrice, price: finalPrice } : r));

      if (isRecharge) {
        const rechargeAmt = finalPrice;
        const walletRef = doc(db, 'user_wallets', emailLower);
        const walletSnap = await getDoc(walletRef);
        let curBal = walletSnap.exists() ? (walletSnap.data().balance ?? walletSnap.data().walletBalance ?? 0) : 0;

        try {
          const uQuery = query(collection(db, 'users'), where('email', '==', emailLower));
          const uSnap = await getDocs(uQuery);
          if (!uSnap.empty) {
            uSnap.forEach(uDoc => {
              const b = uDoc.data().balance ?? uDoc.data().walletBalance ?? 0;
              if (typeof b === 'number' && b > curBal) curBal = b;
            });
          }
        } catch (_) {}

        const newBal = curBal + rechargeAmt;
        await setDoc(walletRef, {
          email: emailLower,
          balance: newBal,
          walletBalance: newBal,
          updatedAt: nowISO
        }, { merge: true });

        try {
          const uQuery = query(collection(db, 'users'), where('email', '==', emailLower));
          const uSnap = await getDocs(uQuery);
          if (!uSnap.empty) {
            for (const uDoc of uSnap.docs) {
              await setDoc(doc(db, 'users', uDoc.id), {
                email: emailLower,
                walletBalance: newBal,
                balance: newBal,
                updatedAt: nowISO
              }, { merge: true });
            }
          } else {
            await setDoc(doc(db, 'users', emailLower), {
              email: emailLower,
              walletBalance: newBal,
              balance: newBal,
              updatedAt: nowISO
            }, { merge: true });
          }
        } catch (uErr) {
          console.warn("Notice: users collection update exception:", uErr);
        }
      } else {
        if (!allowedUsers.includes(emailLower)) {
          const updatedAllowed = [...allowedUsers, emailLower];
          setAllowedUsers(updatedAllowed);
          
          const courseRef = doc(db, 'courses', course.id);
          await updateDoc(courseRef, {
            allowedUsers: updatedAllowed
          });
        }

        // Sync enrolledCourseIds directly to user document in users collection
        try {
          const targetCourseIds = (req.courseIds && req.courseIds.length > 0) ? req.courseIds : [req.courseId || course.id];
          const usersQuery = query(collection(db, 'users'), where('email', '==', emailLower));
          const usersSnap = await getDocs(usersQuery);
          if (!usersSnap.empty) {
            for (const uDoc of usersSnap.docs) {
              const uData = uDoc.data();
              const existingEnrolled: string[] = Array.isArray(uData.enrolledCourseIds) ? uData.enrolledCourseIds : [];
              const existingSet = new Set(existingEnrolled.map(id => typeof id === 'string' ? id.trim().toLowerCase() : ''));
              let updated = false;
              const updatedEnrolled = [...existingEnrolled];

              for (const cid of targetCourseIds) {
                if (cid && cid !== 'wallet_recharge' && !existingSet.has(cid.trim().toLowerCase())) {
                  updatedEnrolled.push(cid);
                  existingSet.add(cid.trim().toLowerCase());
                  updated = true;
                }
              }

              if (updated) {
                await setDoc(doc(db, 'users', uDoc.id), { email: emailLower, enrolledCourseIds: updatedEnrolled, updatedAt: nowISO }, { merge: true });
              }
            }
          } else {
            await setDoc(doc(db, 'users', emailLower), {
              email: emailLower,
              enrolledCourseIds: targetCourseIds.filter((id: string) => id && id !== 'wallet_recharge'),
              updatedAt: nowISO
            }, { merge: true });
          }
        } catch (syncErr) {
          console.warn("Notice: enrolledCourseIds user sync notice:", syncErr);
        }
      }

      // Mark matching payment in global_verified_payments as spent
      if (req.trxId) {
        const globalDocRef = doc(db, 'system_settings', 'global_verified_payments');
        const vpSnap = await getDoc(globalDocRef);
        if (vpSnap.exists()) {
          const vps = vpSnap.data().verifiedPayments || [];
          if (Array.isArray(vps)) {
            const reqTrx = String(req.trxId).toLowerCase().trim();
            let updated = false;
            const updatedVps = vps.map((vp: any) => {
              if ((vp.trxId || '').toLowerCase().trim() === reqTrx) {
                updated = true;
                return {
                  ...vp,
                  spent: true,
                  claimed: true,
                  claimedBy: emailLower,
                  claimedAt: nowISO,
                  spentAt: nowISO
                };
              }
              return vp;
            });
            if (updated) {
              await setDoc(globalDocRef, { verifiedPayments: updatedVps }, { merge: true });
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to approve request:', e);
      alert('Failed to approve request.');
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    try {
      const reqRef = doc(db, 'access_requests', reqId);
      await updateDoc(reqRef, { status: 'rejected' });
      
      setCourseRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r));
    } catch (e) {
      console.error('Failed to reject request:', e);
      alert('Failed to reject request.');
    }
  };

  useEffect(() => {
    if (activeTab === 'access' && accessSubTab === 'verification') {
      fetchRequests();
    }
  }, [activeTab, accessSubTab]);

  useEffect(() => {
    if (courseRequests.length > 0 && verifiedPayments.length > 0) {
      runAutoApprovals(courseRequests, allowedUsers, verifiedPayments);
    }
  }, [courseRequests, verifiedPayments]);

  const matchesCourse = (qCourseId?: string, targetCourseId?: string) => {
    return matchesCourseId(qCourseId, targetCourseId);
  };

  const fetchBlankQuestions = async () => {
    setBlankQuestionsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'blank_questions'));
      const list: BlankQuestion[] = [];
      qSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (matchesCourse(data.courseId, course.id)) {
          list.push({ id: docSnap.id, ...data } as BlankQuestion);
        }
      });
      setCourseBlankQuestions(list);
    } catch (err) {
      console.error('Error fetching course blank questions:', err);
    } finally {
      setBlankQuestionsLoading(false);
    }
  };

  const fetchOooQuestions = async () => {
    setOooQuestionsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'odd_one_out_questions'));
      const list: OddOneOutQuestion[] = [];
      qSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (matchesCourse(data.courseId, course.id)) {
          list.push({ id: docSnap.id, ...data } as OddOneOutQuestion);
        }
      });
      setCourseOooQuestions(list);
    } catch (err) {
      console.error('Error fetching course OOO questions:', err);
    } finally {
      setOooQuestionsLoading(false);
    }
  };

  const fetchAnalogyQuestions = async () => {
    setAnalogyQuestionsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'word_analogy_questions'));
      const list: WordAnalogyQuestion[] = [];
      qSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (matchesCourse(data.courseId, course.id)) {
          list.push({ id: docSnap.id, ...data } as WordAnalogyQuestion);
        }
      });
      setCourseAnalogyQuestions(list);
    } catch (err) {
      console.error('Error fetching course analogy questions:', err);
    } finally {
      setAnalogyQuestionsLoading(false);
    }
  };

  const fetchMcqQuestions = async () => {
    setMcqQuestionsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'mcq_questions'));
      const list: CustomMcqQuestion[] = [];
      qSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (matchesCourse(data.courseId, course.id)) {
          list.push({ id: docSnap.id, ...data } as CustomMcqQuestion);
        }
      });
      setCourseMcqQuestions(list);
    } catch (err) {
      console.error('Error fetching course MCQ questions:', err);
    } finally {
      setMcqQuestionsLoading(false);
    }
  };

  const fetchCourseExams = async () => {
    setExamsLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'exams'));
      const list: Exam[] = [];
      qSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (matchesCourseId(data.courseId, course.id) || data.courseId === course.id) {
          list.push({ id: docSnap.id, ...data } as Exam);
        }
      });
      setCourseExams(list);
    } catch (err) {
      console.error('Error fetching course exams:', err);
    } finally {
      setExamsLoading(false);
    }
  };

  useEffect(() => {
    fetchBlankQuestions();
    fetchOooQuestions();
    fetchAnalogyQuestions();
    fetchMcqQuestions();
    fetchCourseExams();
  }, [course.id]);

  useEffect(() => {
    if (activeTab === 'blank-questions') {
      fetchBlankQuestions();
    } else if (activeTab === 'ooo-questions') {
      fetchOooQuestions();
    } else if (activeTab === 'analogy-questions') {
      fetchAnalogyQuestions();
    } else if (activeTab === 'mcq-questions') {
      fetchMcqQuestions();
    } else if (activeTab === 'exam-questions') {
      fetchCourseExams();
    }
  }, [activeTab]);

  const handleUploadBlankExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelUploadError(null);
    setExcelQuestionsPreview([]);
    
    try {
      const { questions, notices } = await parseBlankExcel(file, course.id);
      if (questions.length === 0) {
        setExcelUploadError(notices[0] || 'No valid questions found in the selected Excel file.');
      } else {
        setExcelQuestionsPreview(questions);
        if (notices.length > 0) {
          console.warn('Blank Excel notices:', notices);
        }
      }
    } catch (err: any) {
      console.error('Error parsing blank excel:', err);
      setExcelUploadError('Failed to parse Excel file. Make sure it is a valid .xlsx or .xls file.');
    }
  };

  const handleSaveBlankExcelQuestions = async () => {
    if (excelQuestionsPreview.length === 0) return;
    setExcelSaveStatus('saving');
    try {
      const updatedList = excelQuestionsPreview.map(q => ({ ...q, courseId: course.id }));
      await saveBulkDocs('blank_questions', updatedList);
      setExcelSaveStatus('saved');
      setExcelQuestionsPreview([]);
      fetchBlankQuestions();
      setTimeout(() => setExcelSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Error saving blank questions:', err);
      setExcelSaveStatus('error');
      setExcelUploadError(`Failed to save to cloud: ${err?.message || 'Database connection error'}`);
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
      courseId: course.id,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'blank_questions', newQ.id), newQ);
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
      setCourseBlankQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting blank question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteBlankQuestions = async () => {
    if (courseBlankQuestions.length === 0) {
      alert('No blank questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${courseBlankQuestions.length} Blank Filling questions for this course? This action is permanent and cannot be undone.`)) return;
    setBlankQuestionsLoading(true);
    try {
      const ids = courseBlankQuestions.map(q => q.id);
      await deleteBulkDocs('blank_questions', ids);
      setCourseBlankQuestions([]);
      alert('All Blank Filling questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting blank questions:', err);
      alert('Failed to delete some or all questions.');
    } finally {
      setBlankQuestionsLoading(false);
      fetchBlankQuestions();
    }
  };

  // --- OOO QUESTIONS EXCEL & MANUAL HANDLERS ---
  const handleUploadOooExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelOooUploadError(null);
    setExcelOooPreview([]);

    try {
      const { questions, notices } = await parseOooExcel(file, course.id);
      if (questions.length === 0) {
        setExcelOooUploadError(notices[0] || 'No valid Odd One Out questions found in the selected Excel file.');
      } else {
        setExcelOooPreview(questions);
        if (notices.length > 0) {
          console.warn('OOO Excel notices:', notices);
        }
      }
    } catch (err: any) {
      console.error('Error parsing OOO excel:', err);
      setExcelOooUploadError('Failed to parse Excel file.');
    }
  };

  const handleSaveOooExcelQuestions = async () => {
    if (excelOooPreview.length === 0) return;
    setExcelOooSaveStatus('saving');
    try {
      const updatedList = excelOooPreview.map(q => ({ ...q, courseId: course.id }));
      await saveBulkDocs('odd_one_out_questions', updatedList);
      setExcelOooSaveStatus('saved');
      setExcelOooPreview([]);
      fetchOooQuestions();
      setTimeout(() => setExcelOooSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Error saving OOO questions:', err);
      setExcelOooSaveStatus('error');
      setExcelOooUploadError(`Failed to save to cloud: ${err?.message || 'Database connection error'}`);
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
      courseId: course.id,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'odd_one_out_questions', newQ.id), newQ);
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
      setCourseOooQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting OOO question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteOooQuestions = async () => {
    if (courseOooQuestions.length === 0) {
      alert('No Odd One Out questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${courseOooQuestions.length} Odd One Out questions for this course? This action is permanent and cannot be undone.`)) return;
    setOooQuestionsLoading(true);
    try {
      const ids = courseOooQuestions.map(q => q.id);
      await deleteBulkDocs('odd_one_out_questions', ids);
      setCourseOooQuestions([]);
      alert('All Odd One Out questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting OOO questions:', err);
      alert('Failed to delete some or all questions.');
    } finally {
      setOooQuestionsLoading(false);
      fetchOooQuestions();
    }
  };

  // --- ANALOGY QUESTIONS EXCEL & MANUAL HANDLERS ---
  const handleUploadAnalogyExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelAnalogyUploadError(null);
    setExcelAnalogyPreview([]);

    try {
      const { questions, notices } = await parseAnalogyExcel(file, course.id);
      if (questions.length === 0) {
        setExcelAnalogyUploadError(notices[0] || 'No valid Word Analogy questions found in the selected Excel file.');
      } else {
        setExcelAnalogyPreview(questions);
        if (notices.length > 0) {
          console.warn('Analogy Excel notices:', notices);
        }
      }
    } catch (err: any) {
      console.error('Error parsing analogy excel:', err);
      setExcelAnalogyUploadError('Failed to parse Excel file.');
    }
  };

  const handleSaveAnalogyExcelQuestions = async () => {
    if (excelAnalogyPreview.length === 0) return;
    setExcelAnalogySaveStatus('saving');
    try {
      const updatedList = excelAnalogyPreview.map(q => ({ ...q, courseId: course.id }));
      await saveBulkDocs('word_analogy_questions', updatedList);
      setExcelAnalogySaveStatus('saved');
      setExcelAnalogyPreview([]);
      fetchAnalogyQuestions();
      setTimeout(() => setExcelAnalogySaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Error saving analogy questions:', err);
      setExcelAnalogySaveStatus('error');
      setExcelAnalogyUploadError(`Failed to save to cloud: ${err?.message || 'Database connection error'}`);
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
      courseId: course.id,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'word_analogy_questions', newQ.id), newQ);
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
      setCourseAnalogyQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting analogy question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteAnalogyQuestions = async () => {
    if (courseAnalogyQuestions.length === 0) {
      alert('No Word Analogy questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${courseAnalogyQuestions.length} Word Analogy questions for this course? This action is permanent and cannot be undone.`)) return;
    setAnalogyQuestionsLoading(true);
    try {
      const ids = courseAnalogyQuestions.map(q => q.id);
      await deleteBulkDocs('word_analogy_questions', ids);
      setCourseAnalogyQuestions([]);
      alert('All Word Analogy questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting analogy questions:', err);
      alert('Failed to delete some or all questions.');
    } finally {
      setAnalogyQuestionsLoading(false);
      fetchAnalogyQuestions();
    }
  };

  // --- MCQ QUESTIONS HANDLERS ---
  const handleUploadMcqExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelMcqUploadError(null);
    setExcelMcqNotice(null);
    setExcelMcqPreview([]);

    try {
      const { questions, notices } = await parseMcqExcel(file, course.id);
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
    } catch (err: any) {
      console.error('Error parsing MCQ excel:', err);
      setExcelMcqUploadError('Failed to parse file.');
    }
  };

  const handleSaveMcqExcelQuestions = async () => {
    if (excelMcqPreview.length === 0) return;
    setExcelMcqSaveStatus('saving');
    try {
      const updatedList = excelMcqPreview.map(q => ({ ...q, courseId: course.id }));
      await saveBulkDocs('mcq_questions', updatedList);
      setExcelMcqSaveStatus('saved');
      setExcelMcqPreview([]);
      fetchMcqQuestions();
      setTimeout(() => setExcelMcqSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Error saving MCQ questions:', err);
      setExcelMcqSaveStatus('error');
      setExcelMcqUploadError(`Failed to save to cloud: ${err?.message || 'Database connection error'}`);
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
      courseId: course.id,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'mcq_questions', newQ.id), newQ);
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
      setCourseMcqQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting MCQ question:', err);
      alert('Failed to delete question.');
    }
  };

  const handleBulkDeleteMcqQuestions = async () => {
    if (courseMcqQuestions.length === 0) {
      alert('No MCQ questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${courseMcqQuestions.length} MCQ questions for this course? This action is permanent and cannot be undone.`)) return;
    setMcqQuestionsLoading(true);
    try {
      const ids = courseMcqQuestions.map(q => q.id);
      await deleteBulkDocs('mcq_questions', ids);
      setCourseMcqQuestions([]);
      alert('All MCQ questions deleted successfully!');
    } catch (err) {
      console.error('Error bulk deleting MCQ questions:', err);
      alert('Failed to delete some or all questions.');
    } finally {
      setMcqQuestionsLoading(false);
      fetchMcqQuestions();
    }
  };

  const handleUploadExamExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelExamUploadError(null);
    setExcelExamNotice(null);
    setExcelExamPreview([]);

    try {
      const { questions, notices } = await parseExamExcel(file, course.id);
      if (questions.length === 0) {
        setExcelExamUploadError(notices[0] || 'No valid exam questions found in file.');
      } else {
        setExcelExamPreview(questions);
        if (notices.length > 0) setExcelExamNotice(notices);
      }
    } catch (err: any) {
      console.error('Error parsing exam excel:', err);
      setExcelExamUploadError('Failed to parse Excel file.');
    }
  };

  const handleSaveExamExcel = async () => {
    if (excelExamPreview.length === 0) return;
    setExcelExamSaveStatus('saving');
    try {
      const title = examTitleInput.trim() || `${course.title} - Online Exam`;
      const newExam: Exam = {
        id: `exam_${Date.now()}`,
        title,
        courseId: course.id,
        courseTitle: course.title,
        durationMinutes: examDurationInput || 15,
        marksPerQuestion: examMarksPerQInput || 1,
        negativeMarking: examNegativeMarkInput || 0.25,
        totalMarks: excelExamPreview.length * (examMarksPerQInput || 1),
        questions: excelExamPreview,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'exams', newExam.id), newExam, { merge: true });
      setExcelExamSaveStatus('saved');
      setExcelExamPreview([]);
      setExamTitleInput('');
      fetchCourseExams();
      setTimeout(() => setExcelExamSaveStatus('idle'), 3000);
      alert('Online Exam successfully created and published!');
    } catch (err: any) {
      console.error('Error saving exam:', err);
      setExcelExamSaveStatus('error');
      setExcelExamUploadError(`Failed to save to cloud: ${err?.message || 'Database connection error'}`);
    }
  };

  const handleDeleteCourseExam = async (examId: string) => {
    if (!window.confirm('Are you sure you want to delete this exam?')) return;
    try {
      await deleteDoc(doc(db, 'exams', examId));
      fetchCourseExams();
    } catch (err) {
      console.error('Error deleting exam:', err);
      alert('Failed to delete exam from cloud.');
    }
  };

  // --- FEATURE & VARIABLE TOGGLES ---
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    meaning: true,
    synonyms: true,
    extraWord: true,
    extraMeaning: true,
    example: true,
    audio: true,
    ...(course.variableToggles || {})
  });

  const [enabledGames, setEnabledGames] = useState<Record<string, boolean>>({
    quiz: true,
    match: true,
    word_search: true,
    synonym: true,
    blank: true,
    odd_one_out: true,
    analogy: true,
    story: true,
    article: true,
    exam: true,
    flashcards: true,
    spelling: true,
    ...(course.enabledGames || {})
  });

  // --- STORY MANAGEMENT STATES ---
  const [localStories, setLocalStories] = useState<StoryItem[]>(course.stories || []);
  const [storyUploadLoading, setStoryUploadLoading] = useState<boolean>(false);
  const [storyUploadError, setStoryUploadError] = useState<string | null>(null);
  const [storySaveStatus, setStorySaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pastedStoryText, setPastedStoryText] = useState<string>('');

  // --- ARTICLE MANAGEMENT STATES ---
  const [localArticles, setLocalArticles] = useState<ArticleItem[]>(course.articles || []);
  const [articleUploadLoading, setArticleUploadLoading] = useState<boolean>(false);
  const [articleUploadError, setArticleUploadError] = useState<string | null>(null);
  const [articleSaveStatus, setArticleSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pastedArticleText, setPastedArticleText] = useState<string>('');

  // Direct Cloud Save for Stories
  const saveStoriesListDirectly = async (storiesToSave: StoryItem[]) => {
    setStorySaveStatus('saving');
    setStoryUploadError(null);
    try {
      const sanitizedStories = JSON.parse(JSON.stringify(storiesToSave || [])).map((s: any, idx: number) => ({
        id: String(s.id || `story-${course.id}-${Date.now()}-${idx + 1}`),
        title: String(s.title || `Story ${idx + 1}`),
        content: String(s.content || ''),
        createdAt: s.createdAt || new Date().toISOString()
      }));
      
      // 1. Immediately update local state
      setLocalStories(sanitizedStories);

      // 2. Immediately update local storage cache for instant offline & reload persistence
      try {
        const cachedStr = safeGetLocalStorage('vocab_memorizer_cached_custom_courses', '[]');
        let cachedCourses: Course[] = [];
        try {
          cachedCourses = JSON.parse(cachedStr);
          if (!Array.isArray(cachedCourses)) cachedCourses = [];
        } catch (_) { cachedCourses = []; }
        const cIdx = cachedCourses.findIndex(c => c.id === course.id);
        if (cIdx >= 0) {
          cachedCourses[cIdx] = { ...cachedCourses[cIdx], stories: sanitizedStories };
        } else {
          cachedCourses.push({ ...course, stories: sanitizedStories });
        }
        safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(cachedCourses));
      } catch (lErr) {
        console.warn('Local course cache notice:', lErr);
      }

      // 3. Immediately notify parent state
      if (onSaveSuccess) {
        onSaveSuccess({ ...course, stories: sanitizedStories });
      }

      // 4. Cloud Firestore save with safety timeout race (never hang)
      try {
        const cloudPromise = setDoc(doc(db, 'courses', course.id), { stories: sanitizedStories }, { merge: true });
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
        await Promise.race([cloudPromise, timeoutPromise]);
      } catch (cloudErr: any) {
        console.warn('Cloud setDoc notice for stories (saved locally):', cloudErr);
      }

      setStorySaveStatus('saved');
      setTimeout(() => setStorySaveStatus('idle'), 3500);
      return true;
    } catch (err: any) {
      console.error('Error saving stories:', err);
      setStorySaveStatus('error');
      setStoryUploadError(`Failed to save stories: ${err?.message || 'Connection notice'}`);
      setTimeout(() => setStorySaveStatus('idle'), 4000);
      return false;
    }
  };

  const handleSaveStoriesToCloud = async () => {
    await saveStoriesListDirectly(localStories);
  };

  // Direct Cloud Save for Articles
  const saveArticlesListDirectly = async (articlesToSave: ArticleItem[]) => {
    setArticleSaveStatus('saving');
    setArticleUploadError(null);
    try {
      const gradients = [
        'from-indigo-600 via-purple-600 to-pink-600',
        'from-blue-600 via-cyan-600 to-teal-600',
        'from-emerald-600 via-teal-600 to-cyan-600',
        'from-violet-600 via-fuchsia-600 to-rose-600',
        'from-amber-600 via-orange-600 to-rose-600'
      ];

      const sanitizedArticles = JSON.parse(JSON.stringify(articlesToSave || [])).map((art: any, idx: number) => {
        const bodyContent = String(art.content || art.article || art.text || '');
        const wordsCount = bodyContent.split(/\s+/).length;
        return {
          id: String(art.id || `art-${course.id}-${Date.now()}-${idx + 1}`),
          title: String(art.title || `Article ${idx + 1}`),
          excerpt: String(art.excerpt || (bodyContent.length > 140 ? bodyContent.slice(0, 140) + '...' : bodyContent)),
          content: bodyContent,
          author: String(art.author || 'Course Educator'),
          category: String(art.category || 'Vocabulary Reading'),
          readTime: String(art.readTime || `${Math.max(1, Math.ceil(wordsCount / 180))} min read`),
          publishedAt: String(art.publishedAt || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })),
          coverGradient: String(art.coverGradient || gradients[idx % gradients.length]),
          tags: Array.isArray(art.tags) && art.tags.length > 0 ? art.tags : ['Vocabulary', 'Article'],
          createdAt: art.createdAt || new Date().toISOString()
        };
      });

      // 1. Immediately update local state
      setLocalArticles(sanitizedArticles);

      // 2. Immediately update local storage cache
      try {
        const cachedStr = safeGetLocalStorage('vocab_memorizer_cached_custom_courses', '[]');
        let cachedCourses: Course[] = [];
        try {
          cachedCourses = JSON.parse(cachedStr);
          if (!Array.isArray(cachedCourses)) cachedCourses = [];
        } catch (_) { cachedCourses = []; }
        const cIdx = cachedCourses.findIndex(c => c.id === course.id);
        if (cIdx >= 0) {
          cachedCourses[cIdx] = { ...cachedCourses[cIdx], articles: sanitizedArticles };
        } else {
          cachedCourses.push({ ...course, articles: sanitizedArticles });
        }
        safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(cachedCourses));
      } catch (lErr) {
        console.warn('Local course cache notice:', lErr);
      }

      // 3. Immediately notify parent state
      if (onSaveSuccess) {
        onSaveSuccess({ ...course, articles: sanitizedArticles });
      }

      // 4. Cloud Firestore save with safety timeout race (never hang)
      try {
        const cloudPromise = setDoc(doc(db, 'courses', course.id), { articles: sanitizedArticles }, { merge: true });
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
        await Promise.race([cloudPromise, timeoutPromise]);
      } catch (cloudErr: any) {
        console.warn('Cloud setDoc notice for articles (saved locally):', cloudErr);
      }

      setArticleSaveStatus('saved');
      setTimeout(() => setArticleSaveStatus('idle'), 3500);
      return true;
    } catch (err: any) {
      console.error('Error saving articles:', err);
      setArticleSaveStatus('error');
      setArticleUploadError(`Failed to save articles: ${err?.message || 'Connection notice'}`);
      setTimeout(() => setArticleSaveStatus('idle'), 4000);
      return false;
    }
  };

  const handleSaveArticlesToCloud = async () => {
    await saveArticlesListDirectly(localArticles);
  };

  // --- WORDS LIST STATES ---
  const sanitizeWordsList = (wordsList: VocabularyWord[]) => {
    return (wordsList || []).map((w, idx) => {
      if (!w.id) {
        return {
          ...w,
          id: `w-${course.id}-${w.group || 'all'}-${idx}-${Math.random().toString(36).substr(2, 5)}`
        };
      }
      return w;
    });
  };

  const [localWords, setLocalWords] = useState<VocabularyWord[]>(sanitizeWordsList(course.words || []));
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [wordGroupFilter, setWordGroupFilter] = useState<string>('all');
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  
  // Word editing states
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null);
  const [editedWordId, setEditedWordId] = useState('');
  const [editedWord, setEditedWord] = useState('');
  const [editedMeaning, setEditedMeaning] = useState('');
  const [editedGroup, setEditedGroup] = useState<string>('1');
  const [editedSynonyms, setEditedSynonyms] = useState('');
  const [editedExtraWord, setEditedExtraWord] = useState('');
  const [editedExtraMeaning, setEditedExtraMeaning] = useState('');
  const [editedExample, setEditedExample] = useState('');
  const [editedMnemonic, setEditedMnemonic] = useState('');

  // Pagination
  const [currentWordPage, setCurrentWordPage] = useState(1);
  const [wordsPerPage, setWordsPerPage] = useState<number>(50);

  // Form: Single word addition
  const [singleWordId, setSingleWordId] = useState('');
  const [singleWord, setSingleWord] = useState('');
  const [singleMeaning, setSingleMeaning] = useState('');
  const [singleGroup, setSingleGroup] = useState<string>('1');
  const [singleSynonyms, setSingleSynonyms] = useState('');
  const [singleExtraWord, setSingleExtraWord] = useState('');
  const [singleExtraMeaning, setSingleExtraMeaning] = useState('');
  const [singleExample, setSingleExample] = useState('');
  const [singleMnemonic, setSingleMnemonic] = useState('');
  const [addFormMessage, setAddFormMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form: Bulk spreadsheet uploading
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);
  const [dragActiveWords, setDragActiveWords] = useState(false);

  // General state flags
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // Handle auto-editing of a specified word
  useEffect(() => {
    if (initialEditWordName && localWords.length > 0 && !hasAutoOpened) {
      const match = localWords.find(w => w.word.toLowerCase() === initialEditWordName.trim().toLowerCase());
      if (match) {
        handleStartEditWord(match);
        setWordSearchQuery(match.word);
        setHasAutoOpened(true);
      }
    }
  }, [initialEditWordName, localWords, hasAutoOpened]);

  // Compute variable availability based on real word list data
  const variableAvailability = useMemo(() => {
    const status = {
      meaning: false,
      synonyms: false,
      extraWord: false,
      extraMeaning: false,
      example: false,
      audio: true, // Audio can always be enabled
    };
    localWords.forEach(w => {
      if (w.meaning && w.meaning.trim() !== '') status.meaning = true;
      if (w.synonyms && w.synonyms.trim() !== '') status.synonyms = true;
      if (w.extraWord && w.extraWord.trim() !== '') status.extraWord = true;
      if (w.extraMeaning && w.extraMeaning.trim() !== '') status.extraMeaning = true;
      if (w.example && w.example.trim() !== '') status.example = true;
    });
    return status;
  }, [localWords]);

  // Handle adding a single user to restricted access list
  const handleAddUser = () => {
    const input = newUserInput.trim();
    if (!input) return;

    if (allowedUsers.includes(input)) {
      setError('This student is already in the list.');
      return;
    }

    setAllowedUsers(prev => [...prev, input]);
    if (newStudentExpiry) {
      setAllowedUsersExpiry(prev => ({
        ...prev,
        [input]: newStudentExpiry
      }));
    }
    setNewUserInput('');
    setNewStudentExpiry('');
    setError(null);
  };

  // Handle removing a single user
  const handleRemoveUser = (userToRemove: string) => {
    setAllowedUsers(prev => prev.filter(u => u !== userToRemove));
    setAllowedUsersExpiry(prev => {
      const copy = { ...prev };
      delete copy[userToRemove];
      return copy;
    });
  };

  // Sync bulk input when switching modes
  useEffect(() => {
    if (!isBulkMode) {
      setBulkInput(allowedUsers.join('\n'));
    }
  }, [isBulkMode, allowedUsers]);

  // Apply bulk user changes
  const handleApplyBulk = () => {
    const parsed = bulkInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    const unique: string[] = Array.from(new Set(parsed));
    setAllowedUsers(unique);

    if (bulkExpiryDate) {
      const newExpiries: Record<string, string> = { ...allowedUsersExpiry };
      unique.forEach(user => {
        newExpiries[user] = bulkExpiryDate;
      });
      setAllowedUsersExpiry(newExpiries);
    }
    
    setIsBulkMode(false);
    setError(null);
  };

  // --- AUTO-VERIFICATION PAYMENT HANDLERS ---
  const handleAddVerifiedPayment = () => {
    const num = newVpNumber.trim();
    const trx = newVpTrxId.trim();
    if (!num || !trx) {
      setError('Mobile number and Transaction ID are required.');
      return;
    }

    if (verifiedPayments.some(vp => vp.bkashNumber === num && vp.trxId.toLowerCase() === trx.toLowerCase())) {
      setError('This payment entry is already verified.');
      return;
    }

    setVerifiedPayments(prev => [...prev, { bkashNumber: num, trxId: trx, amount: newVpAmount || 30 }]);
    setNewVpNumber('');
    setNewVpTrxId('');
    setNewVpAmount(75);
    setError(null);
  };

  const handleVpDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveVp(true);
    } else if (e.type === "dragleave") {
      setDragActiveVp(false);
    }
  };

  const handleVpDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveVp(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processVpExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleVpFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processVpExcelFile(e.target.files[0]);
    }
  };

  const processVpExcelFile = (file: File) => {
    setVpExcelError(null);
    setVpExcelSuccess(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = utils.sheet_to_json(sheet) as any[];

        if (rawRows.length === 0) {
          setVpExcelError('Spreadsheet is empty.');
          return;
        }

        const vpList: { bkashNumber: string; trxId: string }[] = [];

        for (const row of rawRows) {
          const rowKeys = Object.keys(row);
          
          const findKey = (candidates: string[]) => {
            return rowKeys.find(k => {
              const cleanK = k.toLowerCase().trim();
              return candidates.some(c => cleanK === c);
            });
          };

          const mobileKey = findKey(['mobile', 'bkashnumber', 'bkash', 'phone', 'number']);
          const trxKey = findKey(['trxid', 'transaction', 'txid', 'transactionid']);

          const mobileVal = mobileKey ? String(row[mobileKey]).trim() : '';
          const trxVal = trxKey ? String(row[trxKey]).trim() : '';

          if (mobileVal && trxVal) {
            vpList.push({
              bkashNumber: mobileVal,
              trxId: trxVal
            });
          }
        }

        if (vpList.length === 0) {
          setVpExcelError('Columns did not match! Spreadsheet must contain "mobile" or "bKash" and "trxId" or "transaction" columns.');
          return;
        }

        // Merge and avoid duplicates
        setVerifiedPayments(prev => {
          const merged = [...prev];
          vpList.forEach(item => {
            if (!merged.some(m => m.bkashNumber === item.bkashNumber && m.trxId.toLowerCase() === item.trxId.toLowerCase())) {
              merged.push(item);
            }
          });
          return merged;
        });

        setVpExcelSuccess(`Successfully added ${vpList.length} verified payment records from file!`);
      } catch (err) {
        console.error(err);
        setVpExcelError('Failed to parse Excel spreadsheet.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApplyVpBulk = () => {
    if (!vpBulkInput.trim()) return;
    const lines = vpBulkInput.split('\n');
    const parsed: { bkashNumber: string; trxId: string }[] = [];
    
    lines.forEach(line => {
      if (!line.trim()) return;
      // split by comma, tab, space or semicolon
      const parts = line.split(/[,\t;]+/).map(p => p.trim());
      if (parts.length >= 2) {
        parsed.push({
          bkashNumber: parts[0],
          trxId: parts[1]
        });
      }
    });

    if (parsed.length === 0) {
      setError('No valid comma/tab separated lines found.');
      return;
    }

    setVerifiedPayments(prev => {
      const merged = [...prev];
      parsed.forEach(item => {
        if (!merged.some(m => m.bkashNumber === item.bkashNumber && m.trxId.toLowerCase() === item.trxId.toLowerCase())) {
          merged.push(item);
        }
      });
      return merged;
    });

    setVpBulkInput('');
    setError(null);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(course.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // --- INDIVIDUAL WORD EDITING ACTION ---
  const handleStartEditWord = (w: VocabularyWord) => {
    setEditingWord(w);
    setEditedWordId(w.id || '');
    setEditedWord(w.word || '');
    setEditedMeaning(w.meaning || '');
    setEditedGroup(String(w.group || '1'));
    setEditedSynonyms(w.synonyms || '');
    setEditedExtraWord(w.extraWord || '');
    setEditedExtraMeaning(w.extraMeaning || '');
    setEditedExample(w.example || '');
    setEditedMnemonic(w.mnemonic || '');
  };

  const handleSaveWordEdit = () => {
    if (!editingWord) return;
    if (!editedWord.trim() || !editedMeaning.trim()) {
      alert('Word and meaning fields are required.');
      return;
    }

    const newId = editedWordId.trim();
    if (!newId) {
      alert('Word Unique ID cannot be empty.');
      return;
    }

    // Check for duplicate ID in other words
    const hasDuplicate = localWords.some(w => w.id === newId && w.id !== editingWord.id);
    if (hasDuplicate) {
      alert(`The ID "${newId}" is already used by another word in this course.`);
      return;
    }

    let groupVal: string | number = editedGroup.trim();
    const numGrp = parseInt(editedGroup.trim(), 10);
    if (!isNaN(numGrp) && String(numGrp) === editedGroup.trim()) {
      groupVal = numGrp;
    }

    setLocalWords(prev => prev.map(w => {
      if (w.id === editingWord.id) {
        return {
          ...w,
          id: newId,
          word: editedWord.trim(),
          meaning: editedMeaning.trim(),
          group: groupVal,
          synonyms: editedSynonyms.trim(),
          extraWord: editedExtraWord.trim(),
          extraMeaning: editedExtraMeaning.trim(),
          example: editedExample.trim(),
          mnemonic: editedMnemonic.trim()
        };
      }
      return w;
    }));

    setEditingWord(null);
  };

  // --- EXPORT WORDS TO EXCEL ---
  const handleExportWordsToExcel = () => {
    if (localWords.length === 0) {
      alert('No words available in this course to export.');
      return;
    }

    const exportData = localWords.map(w => ({
      'Unique ID': w.id,
      'Group': w.group,
      'Word': w.word,
      'Meaning': w.meaning,
      'Synonyms': w.synonyms || '',
      'Derivative Word': w.extraWord || '',
      'Derivative Meaning': w.extraMeaning || '',
      'Example Sentence': w.example || '',
      'Mnemonic': w.mnemonic || ''
    }));

    const worksheet = utils.json_to_sheet(exportData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Words');
    const safeTitle = (course.title || 'course').replace(/[^a-zA-Z0-9_-]/g, '_');
    writeFile(workbook, `${safeTitle}_words_${Date.now()}.xlsx`);
  };

  // --- SINGLE WORD ADDITION HANDLER ---
  const handleAddSingleWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormMessage(null);

    if (!singleWord.trim() || !singleMeaning.trim()) {
      setAddFormMessage({ type: 'error', text: 'Word and meaning fields are required.' });
      return;
    }

    let groupVal: string | number = singleGroup.trim();
    const numGrp = parseInt(singleGroup.trim(), 10);
    if (!isNaN(numGrp) && String(numGrp) === singleGroup.trim()) {
      groupVal = numGrp;
    }

    const uniqueIndexSuffix = localWords.length + 1;
    const finalId = singleWordId.trim() || `${course.id}_g${groupVal}_w_${Date.now()}_${uniqueIndexSuffix}`;

    // Check existing word by ID or by Word name
    const existingIndex = localWords.findIndex(w => 
      (singleWordId.trim() && String(w.id).trim().toLowerCase() === singleWordId.trim().toLowerCase()) ||
      (!singleWordId.trim() && w.word.trim().toLowerCase() === singleWord.trim().toLowerCase())
    );

    if (existingIndex !== -1) {
      // Update/Replace existing word
      const targetId = singleWordId.trim() || localWords[existingIndex].id;
      const updatedWordItem: VocabularyWord = {
        ...localWords[existingIndex],
        id: targetId,
        word: singleWord.trim(),
        meaning: singleMeaning.trim(),
        group: groupVal,
        synonyms: singleSynonyms.trim(),
        extraWord: singleExtraWord.trim(),
        extraMeaning: singleExtraMeaning.trim(),
        example: singleExample.trim(),
        mnemonic: singleMnemonic.trim()
      };

      setLocalWords(prev => {
        const copy = [...prev];
        copy[existingIndex] = updatedWordItem;
        return copy;
      });

      // Reset single word inputs
      setSingleWordId('');
      setSingleWord('');
      setSingleMeaning('');
      setSingleSynonyms('');
      setSingleExtraWord('');
      setSingleExtraMeaning('');
      setSingleExample('');
      setSingleMnemonic('');

      setAddFormMessage({ 
        type: 'success', 
        text: `"${updatedWordItem.word}" (ID: ${targetId}) has been successfully UPDATED/REPLACED in the word list! Click "Update Settings" below to save changes permanently.` 
      });
      return;
    }

    const newWordItem: VocabularyWord = {
      id: finalId,
      word: singleWord.trim(),
      meaning: singleMeaning.trim(),
      group: groupVal,
      synonyms: singleSynonyms.trim(),
      extraWord: singleExtraWord.trim(),
      extraMeaning: singleExtraMeaning.trim(),
      example: singleExample.trim(),
      mnemonic: singleMnemonic.trim()
    };

    setLocalWords(prev => [...prev, newWordItem]);

    // Reset single word inputs
    setSingleWordId('');
    setSingleWord('');
    setSingleMeaning('');
    setSingleSynonyms('');
    setSingleExtraWord('');
    setSingleExtraMeaning('');
    setSingleExample('');
    setSingleMnemonic('');

    setAddFormMessage({ 
      type: 'success', 
      text: `"${newWordItem.word}" has been successfully added to the local list with ID "${finalId}"! Click "Update Settings" below to save changes permanently.` 
    });
  };

  // --- EXCEL DRAG & DROP FOR WORDS ---
  const handleWordsDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveWords(true);
    } else if (e.type === "dragleave") {
      setDragActiveWords(false);
    }
  };

  const handleWordsDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveWords(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processWordsExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleWordsFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processWordsExcelFile(e.target.files[0]);
    }
  };

  const processWordsExcelFile = (file: File) => {
    setExcelError(null);
    setExcelSuccess(null);
    setExcelImportStats(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = utils.sheet_to_json(sheet) as any[];

        if (rawRows.length === 0) {
          setExcelError('No words found in the spreadsheet.');
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
        if (Object.keys(detectedLabels).length > 0) {
          setLocalPlaceLabels(detectedLabels);
        }

        let updatedLocalWords = [...localWords];
        const initialCourseWordsCount = localWords.length;

        // Field change counters
        let place1Changes = 0;
        let place2Changes = 0;
        let place3Changes = 0;
        let place4Changes = 0;
        let place5Changes = 0;
        let place6Changes = 0;
        let groupChanges = 0;

        let updatedCount = 0;
        let addedCount = 0;
        let unchangedInImportCount = 0;

        for (const row of rawRows) {
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
          const wordKey = findKey(['word', 'main word', 'english word'], 'place1');
          const meaningKey = findKey(['meaning', 'bangla meaning', 'bengali meaning'], 'place2');

          if (!idKey && !wordKey) {
            setExcelError('The spreadsheet must contain at least a "Unique ID" column or a "Word" column.');
            return;
          }

          const rawId = idKey && row[idKey] !== undefined && row[idKey] !== null ? String(row[idKey]).trim() : '';

          const groupKey = findKey(['group', 'level']);
          const synonym1Key = findKey(['synonym1', 'syn1'], 'place5');
          const synonym2Key = findKey(['synonym2', 'syn2']);
          const synonymsKey = findKey(['synonyms', 'synonym']);
          const extraWordKey = findKey(['extra word', 'derivative'], 'place4');
          const extraMeaningKey = findKey(['extra meaning']);
          const exampleKey = findKey(['example', 'example sentence'], 'place3');
          const mnemonicKey = findKey(['place6', 'mnemonic', 'mnemonics', 'personal notes', 'personal note', 'notes', 'note', 'nemonik', 'nemoniq', 'নেমোনিক', 'mnemonic note', 'mnemonic notes'], 'place6');

          const baseWord = wordKey && row[wordKey] !== undefined ? String(row[wordKey]).trim() : '';
          const banglaMeaning = meaningKey && row[meaningKey] !== undefined ? String(row[meaningKey]).trim() : '';
          const mnemonic = mnemonicKey && row[mnemonicKey] !== undefined && row[mnemonicKey] !== null ? String(row[mnemonicKey]).trim() : '';

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
          if (synonymsKey && row[synonymsKey]) {
            synonyms = String(row[synonymsKey]).trim();
          } else {
            const synParts = [];
            if (synonym1Key && row[synonym1Key]) synParts.push(String(row[synonym1Key]).trim());
            if (synonym2Key && row[synonym2Key]) synParts.push(String(row[synonym2Key]).trim());
            synonyms = synParts.join(', ');
          }

          const example = exampleKey ? String(row[exampleKey]).trim() : '';
          const extraWord = extraWordKey ? String(row[extraWordKey]).trim() : '';
          const extraMeaning = extraMeaningKey ? String(row[extraMeaningKey]).trim() : '';

          // Match existing word by ID or by Word name
          let existingIdx = -1;
          if (rawId) {
            existingIdx = updatedLocalWords.findIndex(w => String(w.id).trim().toLowerCase() === rawId.toLowerCase());
            if (existingIdx === -1) {
              existingIdx = updatedLocalWords.findIndex(w => {
                const cleanId = String(w.id).trim().toLowerCase();
                const cleanRawId = rawId.toLowerCase();
                return cleanId.endsWith(`-${cleanRawId}`) || cleanId.endsWith(`_${cleanRawId}`);
              });
            }
          }
          if (existingIdx === -1 && baseWord) {
            existingIdx = updatedLocalWords.findIndex(w => w.word.trim().toLowerCase() === baseWord.toLowerCase());
          }

          if (existingIdx !== -1) {
            // Compare & update existing word
            const oldWord = updatedLocalWords[existingIdx];
            const existingWord = { ...oldWord };
            let wordWasChanged = false;

            if (baseWord && baseWord !== oldWord.word) {
              existingWord.word = baseWord;
              place1Changes++;
              wordWasChanged = true;
            }
            if (banglaMeaning && banglaMeaning !== oldWord.meaning) {
              existingWord.meaning = banglaMeaning;
              place2Changes++;
              wordWasChanged = true;
            }
            if (example !== undefined && example !== '' && example !== (oldWord.example || '')) {
              existingWord.example = example;
              place3Changes++;
              wordWasChanged = true;
            }
            if (extraWord !== undefined && extraWord !== '' && extraWord !== (oldWord.extraWord || '')) {
              existingWord.extraWord = extraWord;
              place4Changes++;
              wordWasChanged = true;
            }
            if (synonyms !== undefined && synonyms !== '' && synonyms !== (oldWord.synonyms || '')) {
              existingWord.synonyms = synonyms;
              place5Changes++;
              wordWasChanged = true;
            }
            if (extraMeaning !== undefined && extraMeaning !== '' && extraMeaning !== (oldWord.extraMeaning || '')) {
              existingWord.extraMeaning = extraMeaning;
              if (!synonyms) place5Changes++;
              wordWasChanged = true;
            }
            if (mnemonic !== undefined && mnemonic !== '' && mnemonic !== (oldWord.mnemonic || '')) {
              existingWord.mnemonic = mnemonic;
              place6Changes++;
              wordWasChanged = true;
            }
            if (groupKey && row[groupKey] !== undefined && String(group) !== String(oldWord.group)) {
              existingWord.group = group;
              groupChanges++;
              wordWasChanged = true;
            }

            if (wordWasChanged) {
              updatedLocalWords[existingIdx] = existingWord;
              updatedCount++;
            } else {
              unchangedInImportCount++;
            }
          } else {
            // New word insertion requires word & meaning
            if (!baseWord || !banglaMeaning) {
              continue;
            }

            const normalizedWordSlug = baseWord.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const wordId = rawId || (normalizedWordSlug ? `w-${course.id}-${normalizedWordSlug}` : `w-${course.id}-${group}-${updatedLocalWords.length + 1}`);

            updatedLocalWords.push({
              id: wordId,
              group,
              word: baseWord,
              meaning: banglaMeaning,
              synonyms,
              extraWord,
              extraMeaning,
              example,
              mnemonic
            });
            addedCount++;
          }
        }

        // --- GAME SHEETS & GAME QUESTIONS PROCESSING ---
        let updatedBlankQuestions = [...courseBlankQuestions];
        let blankAdded = 0;
        let blankUpdated = 0;

        let updatedOooQuestions = [...courseOooQuestions];
        let oooAdded = 0;
        let oooUpdated = 0;

        let updatedAnalogyQuestions = [...courseAnalogyQuestions];
        let analogyAdded = 0;
        let analogyUpdated = 0;

        let updatedMcqQuestions = [...courseMcqQuestions];
        let mcqAdded = 0;
        let mcqUpdated = 0;

        workbook.SheetNames.forEach(sName => {
          const lowerName = sName.toLowerCase().trim();
          const ws = workbook.Sheets[sName];
          if (!ws) return;
          const sheetRows = utils.sheet_to_json(ws) as any[];
          if (!sheetRows || sheetRows.length === 0) return;

          // 1. Blank Filling
          if (/blank|fill|gap|blanks|শূন্যস্থান/i.test(lowerName)) {
            sheetRows.forEach((r: any) => {
              const sentence = r.sentence || r.Question || r.Sentence || r['Sentence / Question'] || r.question;
              const ans = r.answer || r.Answer || r.correct || r.Correct;
              if (!sentence) return;
              const opts = [r.opt1 || r['Option 1'], r.opt2 || r['Option 2'], r.opt3 || r['Option 3'], r.opt4 || r['Option 4']].filter(Boolean);
              const exIdx = updatedBlankQuestions.findIndex(q => q.sentence.trim().toLowerCase() === String(sentence).trim().toLowerCase());
              if (exIdx !== -1) {
                blankUpdated++;
              } else {
                updatedBlankQuestions.push({
                  id: r.id || `blank-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  sentence: String(sentence).trim(),
                  options: opts.length >= 2 ? opts : ['Opt A', 'Opt B'],
                  answer: String(ans || opts[0] || '').trim(),
                  explanation: r.explanation || r.Explanation || '',
                  courseId: course.id
                });
                blankAdded++;
              }
            });
          }

          // 2. Odd One Out
          if (/odd|ooo|অড/i.test(lowerName)) {
            sheetRows.forEach((r: any) => {
              const wordsStr = r.words || r.Words || r.options || r.Options;
              const ans = r.answer || r.Answer;
              let wordsArr: string[] = [];
              if (Array.isArray(wordsStr)) wordsArr = wordsStr;
              else if (typeof wordsStr === 'string') wordsArr = wordsStr.split(/[,;\t]+/).map(s => s.trim());
              else {
                wordsArr = [r.w1 || r['Word 1'], r.w2 || r['Word 2'], r.w3 || r['Word 3'], r.w4 || r['Word 4']].filter(Boolean);
              }
              if (wordsArr.length < 3) return;
              const exIdx = updatedOooQuestions.findIndex(q => q.words.join(',').toLowerCase() === wordsArr.join(',').toLowerCase());
              if (exIdx !== -1) {
                oooUpdated++;
              } else {
                updatedOooQuestions.push({
                  id: r.id || `ooo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  words: wordsArr,
                  answer: String(ans || wordsArr[0]).trim(),
                  reason: r.reason || r.Reason || r.explanation || '',
                  courseId: course.id
                });
                oooAdded++;
              }
            });
          }

          // 3. Word Analogy
          if (/analogy|analogies|এনালজি/i.test(lowerName)) {
            sheetRows.forEach((r: any) => {
              const analogy = r.analogy || r.Analogy || r.question || r.Question;
              const ans = r.answer || r.Answer;
              if (!analogy) return;
              const opts = [r.opt1 || r['Option 1'], r.opt2 || r['Option 2'], r.opt3 || r['Option 3'], r.opt4 || r['Option 4']].filter(Boolean);
              const exIdx = updatedAnalogyQuestions.findIndex(q => q.analogy.trim().toLowerCase() === String(analogy).trim().toLowerCase());
              if (exIdx !== -1) {
                analogyUpdated++;
              } else {
                updatedAnalogyQuestions.push({
                  id: r.id || `analogy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  analogy: String(analogy).trim(),
                  options: opts.length >= 2 ? opts : ['A : B', 'C : D'],
                  answer: String(ans || opts[0] || '').trim(),
                  explanation: r.explanation || r.Explanation || '',
                  courseId: course.id
                });
                analogyAdded++;
              }
            });
          }

          // 4. MCQ Quiz
          if (/mcq|quiz|প্রশ্ন/i.test(lowerName)) {
            sheetRows.forEach((r: any) => {
              const question = r.question || r.Question || r.q || r.Q;
              const ans = r.answer || r.Answer;
              if (!question) return;
              const opts = [r.opt1 || r['Option 1'], r.opt2 || r['Option 2'], r.opt3 || r['Option 3'], r.opt4 || r['Option 4']].filter(Boolean);
              const exIdx = updatedMcqQuestions.findIndex(q => q.question.trim().toLowerCase() === String(question).trim().toLowerCase());
              if (exIdx !== -1) {
                mcqUpdated++;
              } else {
                updatedMcqQuestions.push({
                  id: r.id || `mcq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  question: String(question).trim(),
                  options: opts.length >= 2 ? opts : ['Opt 1', 'Opt 2'],
                  answer: String(ans || opts[0] || '').trim(),
                  explanation: r.explanation || r.Explanation || '',
                  courseId: course.id
                });
                mcqAdded++;
              }
            });
          }
        });

        // Check if game states were modified
        if (blankAdded > 0 || blankUpdated > 0) setCourseBlankQuestions(updatedBlankQuestions);
        if (oooAdded > 0 || oooUpdated > 0) setCourseOooQuestions(updatedOooQuestions);
        if (analogyAdded > 0 || analogyUpdated > 0) setCourseAnalogyQuestions(updatedAnalogyQuestions);
        if (mcqAdded > 0 || mcqUpdated > 0) setCourseMcqQuestions(updatedMcqQuestions);

        // Check for new game activations
        const newGamesAddedList: string[] = [];
        if (courseBlankQuestions.length === 0 && updatedBlankQuestions.length > 0) {
          newGamesAddedList.push('Blank Filling Practice');
        }
        if (courseOooQuestions.length === 0 && updatedOooQuestions.length > 0) {
          newGamesAddedList.push('Odd One Out Game');
        }
        if (courseAnalogyQuestions.length === 0 && updatedAnalogyQuestions.length > 0) {
          newGamesAddedList.push('Word Analogy Game');
        }
        if (courseMcqQuestions.length === 0 && updatedMcqQuestions.length > 0) {
          newGamesAddedList.push('MCQ Quiz Questions');
        }

        if (updatedCount === 0 && addedCount === 0 && blankAdded === 0 && oooAdded === 0 && analogyAdded === 0 && mcqAdded === 0) {
          setExcelError('No words or games were updated or added. Make sure your spreadsheet contains valid "Unique ID" matching existing words or new "Word" and "Meaning" columns.');
          return;
        }

        setLocalWords(updatedLocalWords);
        setWordlistSubTab('wordlist');
        setCurrentWordPage(1);

        // Directly persist to Firestore so updates are saved immediately to cloud
        try {
          const uniqueGroupsSize = new Set(updatedLocalWords.map(w => w.group)).size;
          const newPlaceLabels = Object.keys(detectedLabels).length > 0 
            ? { ...(course.placeLabels || {}), ...detectedLabels } 
            : (localPlaceLabels || course.placeLabels);
          
          const courseRef = doc(db, 'courses', course.id);
          await updateDoc(courseRef, {
            words: updatedLocalWords,
            totalGroups: uniqueGroupsSize || 1,
            ...(newPlaceLabels ? { placeLabels: newPlaceLabels } : {})
          });

          if (onSaveSuccess) {
            onSaveSuccess({
              ...course,
              words: updatedLocalWords,
              totalGroups: uniqueGroupsSize || 1,
              placeLabels: newPlaceLabels
            });
          }
        } catch (saveErr) {
          console.warn('Direct cloud save failed, changes kept in local state:', saveErr);
        }

        const unchangedWordsOverall = initialCourseWordsCount > updatedCount 
          ? initialCourseWordsCount - updatedCount 
          : 0;

        const report: ImportStatsReport = {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          filename: file.name,
          totalRowsProcessed: rawRows.length,
          newWordsCount: addedCount,
          updatedWordsCount: updatedCount,
          unchangedWordsCount: unchangedWordsOverall,
          totalWordsNow: updatedLocalWords.length,
          placeChanges: {
            place1: place1Changes,
            place2: place2Changes,
            place3: place3Changes,
            place4: place4Changes,
            place5: place5Changes,
            place6: place6Changes,
            group: groupChanges
          },
          gameStats: {
            blankQuestions: { added: blankAdded, updated: blankUpdated, total: updatedBlankQuestions.length },
            oddOneOut: { added: oooAdded, updated: oooUpdated, total: updatedOooQuestions.length },
            wordAnalogy: { added: analogyAdded, updated: analogyUpdated, total: updatedAnalogyQuestions.length },
            mcqQuiz: { added: mcqAdded, updated: mcqUpdated, total: updatedMcqQuestions.length },
            newGamesAddedList,
            totalGamesModifiedCount: blankAdded + blankUpdated + oooAdded + oooUpdated + analogyAdded + analogyUpdated + mcqAdded + mcqUpdated
          },
          placeLabels: detectedLabels
        };

        setExcelImportStats(report);

        let msg = 'Spreadsheet processed successfully and saved to cloud! ';
        if (updatedCount > 0 && addedCount > 0) {
          msg += `Updated ${updatedCount} existing words and added ${addedCount} new words. `;
        } else if (updatedCount > 0) {
          msg += `Successfully updated ${updatedCount} existing words. `;
        } else if (addedCount > 0) {
          msg += `Successfully added ${addedCount} new words. `;
        }

        if (report.gameStats.totalGamesModifiedCount > 0) {
          msg += `Parsed ${report.gameStats.totalGamesModifiedCount} game question updates! `;
        }

        setExcelSuccess(msg);
      } catch (err) {
        console.error(err);
        setExcelError('Failed to process spreadsheet file. Please verify it is a valid format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- DELETION ACTIONS ---
  const handleDeleteWord = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this word from the course?')) return;
    const updatedWords = localWords.filter(w => w.id !== id);
    setLocalWords(updatedWords);
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    try {
      const uniqueGroupsSize = new Set(updatedWords.map(w => w.group)).size;
      const courseRef = doc(db, 'courses', course.id);
      await updateDoc(courseRef, {
        words: updatedWords,
        totalGroups: uniqueGroupsSize || 1
      });
      if (onSaveSuccess) {
        onSaveSuccess({
          ...course,
          words: updatedWords,
          totalGroups: uniqueGroupsSize || 1
        });
      }
    } catch (err) {
      console.error('Failed to sync word deletion to Firestore:', err);
      alert('Failed to sync word deletion to cloud database.');
    }
  };

  const handleDeleteSelectedWords = async () => {
    if (selectedWordIds.size === 0) return;
    const count = selectedWordIds.size;
    if (!window.confirm(`Are you sure you want to delete the selected ${count} words from the course?`)) return;

    const updatedWords = localWords.filter(w => !selectedWordIds.has(w.id));
    setLocalWords(updatedWords);
    setSelectedWordIds(new Set());
    setCurrentWordPage(1);

    try {
      const uniqueGroupsSize = new Set(updatedWords.map(w => w.group)).size;
      const courseRef = doc(db, 'courses', course.id);
      await updateDoc(courseRef, {
        words: updatedWords,
        totalGroups: uniqueGroupsSize || 1
      });
      if (onSaveSuccess) {
        onSaveSuccess({
          ...course,
          words: updatedWords,
          totalGroups: uniqueGroupsSize || 1
        });
      }
      alert(`Successfully deleted ${count} selected words from cloud!`);
    } catch (err) {
      console.error('Failed to sync bulk word deletion to Firestore:', err);
      alert('Failed to sync bulk deletion to cloud database.');
    }
  };

  const handleBulkDeleteAllWords = async () => {
    if (localWords.length === 0) {
      alert('No words in list to delete.');
      return;
    }
    const count = localWords.length;
    if (!window.confirm(`Are you sure you want to delete ALL ${count} words from this course? This action cannot be undone.`)) return;

    setLocalWords([]);
    setSelectedWordIds(new Set());
    setCurrentWordPage(1);

    try {
      const courseRef = doc(db, 'courses', course.id);
      await updateDoc(courseRef, {
        words: [],
        totalGroups: 1
      });
      if (onSaveSuccess) {
        onSaveSuccess({
          ...course,
          words: [],
          totalGroups: 1
        });
      }
      alert(`Successfully deleted all ${count} words from course!`);
    } catch (err) {
      console.error('Failed to clear all words in Firestore:', err);
      alert('Failed to clear words in cloud database.');
    }
  };

  // --- FILTERS & PAGINATION COMPUTATIONS ---
  const filteredWords = useMemo(() => {
    return localWords.filter(w => {
      const q = wordSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        w.word.toLowerCase().includes(q) || 
        w.meaning.toLowerCase().includes(q) || 
        (w.synonyms && w.synonyms.toLowerCase().includes(q)) ||
        (w.extraWord && w.extraWord.toLowerCase().includes(q)) ||
        (w.extraMeaning && w.extraMeaning.toLowerCase().includes(q));

      const matchesGroup = wordGroupFilter === 'all' || String(w.group) === wordGroupFilter;

      return matchesSearch && matchesGroup;
    });
  }, [localWords, wordSearchQuery, wordGroupFilter]);

  // Reset pagination on search filter or page size adjustments
  useEffect(() => {
    setCurrentWordPage(1);
  }, [wordSearchQuery, wordGroupFilter, wordsPerPage]);

  const effectiveWordsPerPage = wordsPerPage === -1 ? (filteredWords.length || 1) : wordsPerPage;
  const totalWordPages = wordsPerPage === -1 ? 1 : Math.max(1, Math.ceil(filteredWords.length / effectiveWordsPerPage));
  const paginatedWords = useMemo(() => {
    if (wordsPerPage === -1) return filteredWords;
    const startIdx = (currentWordPage - 1) * effectiveWordsPerPage;
    return filteredWords.slice(startIdx, startIdx + effectiveWordsPerPage);
  }, [filteredWords, currentWordPage, wordsPerPage, effectiveWordsPerPage]);

  // Get unique groups for the filters
  const uniqueLocalGroups = useMemo(() => {
    const grps = new Set<string | number>();
    localWords.forEach(w => {
      if (w.group !== undefined && w.group !== null) {
        grps.add(w.group);
      }
    });
    return Array.from(grps).sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b), 'bn');
    });
  }, [localWords]);

  // Bulk check box handling
  const isAllPageSelected = paginatedWords.length > 0 && paginatedWords.every(w => selectedWordIds.has(w.id));
  const handleSelectAllPage = () => {
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        paginatedWords.forEach(w => next.delete(w.id));
      } else {
        paginatedWords.forEach(w => next.add(w.id));
      }
      return next;
    });
  };

  const handleCheckboxChange = (id: string) => {
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // --- ASYNCHRONOUS, DEBOUNCED SAVE OPERATION (MUTATE FIRESTORE) ---
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = () => {
    if (!title.trim()) {
      setError('Course title is required!');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Yield execution to the browser main thread so the loading state and spinner render instantly
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        let finalAllowedUsers = [...allowedUsers];
        if (isBulkMode) {
          finalAllowedUsers = Array.from(new Set(
            bulkInput
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
          ));
        }

        // Compute total groups dynamically
        const uniqueGroupsSize = new Set(localWords.map(w => w.group)).size;

        // Force toggles off for variables which have no data
        const finalToggles = { ...toggles };
        Object.keys(variableAvailability).forEach(key => {
          if (!variableAvailability[key as keyof typeof variableAvailability]) {
            finalToggles[key] = false;
          }
        });

        const updatedCourse: Course = {
          ...course,
          title: title.trim(),
          description: description.trim(),
          isDefault: isDefault,
          isRestricted: isRestricted,
          hidden: Boolean(hidden),
          allowedUsers: finalAllowedUsers, // Always preserve the allowed users list
          allowedUsersExpiry: allowedUsersExpiry, // Save student access expiry dates map
          accessDurationDays: Number(accessDurationDays) || 365,
          words: localWords,
          stories: localStories,
          articles: localArticles,
          variableToggles: finalToggles,
          enabledGames: enabledGames, // Save practice and games toggles!
          totalGroups: uniqueGroupsSize || 1,
          price: Number(price) || 0,
          order: Number(courseOrder) || 0,
          bkashNumber: bkashNumber.trim(),
          googleSearchQuery: googleSearchQuery.trim(),
          verifiedPayments: verifiedPayments,
          placeLabels: localPlaceLabels,
        };

        // Strip out undefined fields safely before setDoc
        const cleanData = JSON.parse(JSON.stringify(updatedCourse));

        // 1. Immediately save to Local Storage cache for instant UI feedback
        try {
          const cachedStr = safeGetLocalStorage('vocab_memorizer_cached_custom_courses', '[]');
          let cachedCourses: Course[] = [];
          try {
            cachedCourses = JSON.parse(cachedStr);
            if (!Array.isArray(cachedCourses)) cachedCourses = [];
          } catch (_) { cachedCourses = []; }

          const cIdx = cachedCourses.findIndex(c => c.id === updatedCourse.id);
          if (cIdx >= 0) {
            cachedCourses[cIdx] = updatedCourse;
          } else {
            cachedCourses.push(updatedCourse);
          }
          safeSetLocalStorage('vocab_memorizer_cached_custom_courses', JSON.stringify(cachedCourses));
        } catch (lErr) {
          console.warn('Local course cache update notice:', lErr);
        }

        // 2. Perform Cloud setDoc with safety timeout race (never hang UI)
        try {
          const cloudPromise = setDoc(doc(db, 'courses', course.id), cleanData, { merge: true });
          const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3500));
          await Promise.race([cloudPromise, timeoutPromise]);
        } catch (cloudErr) {
          console.warn('Cloud setDoc notice, saved locally:', cloudErr);
        }

        setSuccess(true);
        setIsSaving(false);

        setTimeout(() => {
          onSaveSuccess(updatedCourse);
          onClose();
        }, 300);
      } catch (err) {
        console.error('Error updating course in Firestore:', err);
        setSuccess(true);
        setIsSaving(false);
        setTimeout(() => {
          onSaveSuccess(course);
          onClose();
        }, 300);
      }
    }, 30);
  };

  // Navigation Items with Icons and Count Badges
  const menuItems = [
    { id: 'general' as const, label: 'Course Identity', icon: Sliders },
    { id: 'variables' as const, label: 'Features & Variables', icon: Settings },
    { id: 'practice-games' as const, label: 'Practice & Games', icon: Gamepad2 },
    { id: 'access' as const, label: 'Student Access & Verification', icon: Users, badge: (allowedUsers.length + verifiedPayments.length) || undefined },
    { id: 'wordlist' as const, label: 'Word List & Upload', icon: BookOpen, badge: localWords.length },
    { id: 'blank-questions' as const, label: 'Blank Questions', icon: FileSpreadsheet, badge: courseBlankQuestions.length },
    { id: 'ooo-questions' as const, label: 'Odd One Out', icon: HelpCircle, badge: courseOooQuestions.length },
    { id: 'analogy-questions' as const, label: 'Word Analogy', icon: Shuffle, badge: courseAnalogyQuestions.length },
    { id: 'mcq-questions' as const, label: 'MCQ Quiz Qs', icon: GraduationCap, badge: courseMcqQuestions.length },
    { id: 'exam-questions' as const, label: 'Online Exams (অনলাইন এক্সাম)', icon: Award, badge: courseExams.length },
    { id: 'story-management' as const, label: 'Read Story Management', icon: BookOpen, badge: localStories.length },
    { id: 'article-management' as const, label: 'Read Article Management', icon: Newspaper, badge: localArticles.length },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in text-slate-700" id="course-settings-modal">
      <div className="bg-white w-full max-w-7xl xl:max-w-[94vw] rounded-3xl shadow-2xl relative animate-scale-up font-sans overflow-hidden border border-slate-100 flex flex-col m-4 h-[90vh] transition-all duration-300">
        
        {/* Modal Main Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">{course.title} — Course Settings Panel</h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5 font-sans flex items-center gap-2">
                <span>Code: {course.id}</span>
                <button 
                  onClick={handleCopyCode} 
                  className="p-1 hover:bg-indigo-100/50 rounded text-indigo-500 hover:text-indigo-700 transition cursor-pointer flex items-center gap-1"
                  title="Copy share code"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-bold">Copy Code</span>
                </button>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-150 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unified Layout with Left Sidebar and Right Pane Content */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Sidebar */}
          <aside className="w-64 border-r border-slate-100 bg-slate-50/50 hidden md:flex flex-col p-4 space-y-2 overflow-y-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-3 mb-2 block">Course Control Section</span>
            {menuItems.map(item => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition text-left cursor-pointer outline-none ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                      : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <div className="truncate">
                      <p className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-800'}`}>{item.label}</p>
                    </div>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Right Pane (Scrollable Content area) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Mobile Tab Select Overlay (only visible on small screens) */}
            <div className="md:hidden flex border-b border-slate-100 pb-3 overflow-x-auto gap-2 scrollbar-none">
              {menuItems.map(item => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-4 py-2 text-xs font-black rounded-full flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition ${
                      isActive ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="text-[9px] bg-slate-900/10 px-1.5 py-0.2 rounded-full">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Error & Success Messages */}
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
                <span>All course changes have been successfully saved to the cloud!</span>
              </div>
            )}

            {/* --- SECTION 1: GENERAL INFO --- */}
            {activeTab === 'general' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Course Identity & Basic Information</h4>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-600 block">Course Title <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                    placeholder="Enter course title"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-600 block">Course Description</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-semibold transition resize-none text-slate-700 leading-relaxed"
                    placeholder="Enter course description..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">Course Price (TK)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                      placeholder="e.g. 500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">Sort Position (Order Index)</label>
                    <input
                      type="number"
                      value={courseOrder}
                      onChange={(e) => setCourseOrder(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                      placeholder="e.g. 1"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-600 block">bKash Number (Send Money)</label>
                    <input
                      type="text"
                      value={bkashNumber}
                      onChange={(e) => setBkashNumber(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                      placeholder="e.g. 017XXXXXXXX"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 block flex items-center justify-between">
                    <span>Google Search Auto-Query Format</span>
                    <span className="text-[10px] text-slate-400 font-normal">Default: word meaning</span>
                  </label>
                  <input
                    type="text"
                    value={googleSearchQuery}
                    onChange={(e) => setGoogleSearchQuery(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold transition text-slate-800"
                    placeholder="e.g. {word} meaning in Bengali or definition"
                  />
                  <p className="pt-0.5 leading-normal" style={settingInstructionStyle}>
                    Define what will be automatically typed in the Google search bar when clicking the Google search button beside a word in this course. Using the <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">{'{word}'}</code> tag replaces it with the target word (e.g. <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">{'{word} meaning in Bengali'}</code>) or you can enter suffix keywords (e.g. <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">definition and examples</code>).
                  </p>
                </div>

                {/* Course Visibility / Hide Control */}
                <div className={`p-4 rounded-2xl flex items-center justify-between gap-4 border transition-all duration-200 ${
                  hidden 
                    ? 'bg-rose-50/70 border-rose-200' 
                    : 'bg-slate-50 border-slate-200/80'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900 block">Hide Course from All Users</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        hidden 
                          ? 'bg-rose-100 text-rose-700 border-rose-200' 
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}>
                        {hidden ? (
                          <>
                            <EyeOff className="w-3 h-3 text-rose-600" />
                            <span>Hidden (হাইড করা)</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 text-emerald-600" />
                            <span>Visible (দৃশ্যমান)</span>
                          </>
                        )}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium block">
                      {hidden 
                        ? 'এই কোর্সটি বর্তমানে সাধারণ শিক্ষার্থীদের কোর্স তালিকা ও সার্চ থেকে হাইড করা আছে।' 
                        : 'এই কোর্সটি সকল শিক্ষার্থীদের জন্য স্বাভাবিকভাবে দৃশ্যমান রয়েছে।'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHidden(prev => !prev)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      hidden ? 'bg-rose-600' : 'bg-slate-300'
                    }`}
                    title={hidden ? "Click to Unhide Course (দৃশ্যমান করুন)" : "Click to Hide Course (হাইড করুন)"}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        hidden ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Custom Segment Display Labels */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">Custom Segment Display Labels (স্থানভিত্তিক কাস্টম লেবেল)</span>
                    <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                      Customize display names for card positions (place1 through place6) across flashcards, word lists, and games.
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'place1', label: 'place1 (Front Main)', defaultVal: 'Front Main Display' },
                      { key: 'place2', label: 'place2 (Back Main)', defaultVal: 'Back Main Display' },
                      { key: 'place3', label: 'place3 (Example Sentences)', defaultVal: 'Example Sentences' },
                      { key: 'place4', label: 'place4 (Front Sub-Header)', defaultVal: 'Derivative Word' },
                      { key: 'place5', label: 'place5 (Back Extra Sec 1)', defaultVal: 'Synonyms' },
                      { key: 'place6', label: 'place6 (Back Extra Sec 2)', defaultVal: 'Memory Trick / Notes' },
                    ].map(item => (
                      <div key={item.key} className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">{item.label}</label>
                        <input
                          type="text"
                          value={localPlaceLabels[item.key] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLocalPlaceLabels(prev => ({
                              ...prev,
                              [item.key]: val
                            }));
                          }}
                          placeholder={item.defaultVal}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none text-slate-800 transition"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-start gap-3.5">
                  <HelpCircle className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs leading-relaxed text-indigo-950 font-medium">
                    <p className="font-black text-indigo-900 text-xs">Sharing Guidelines</p>
                    <p className="mt-1">
                      Students can use the unique share code above to search and enroll in this custom course from their home dashboard.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* --- SECTION 2: VARIABLE OPTION SWITCHES --- */}
            {activeTab === 'variables' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Feature & Variable Controller</h4>
                </div>

                <div className="bg-amber-50 border border-amber-100 text-amber-900 p-4 rounded-2xl text-xs flex items-start gap-2.5 leading-relaxed">
                  <AlertCircle className="w-4.5 h-4.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-black text-amber-950 block">Variable Auto-Alignment Policy</span>
                    <p className="mt-0.5">
                      Switches for variables with no data in your word list are automatically disabled. Content is seamlessly adapted if features (such as synonyms) are disabled.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white divide-y divide-slate-100">
                  {[
                    { key: 'meaning', label: 'Bengali Meaning', desc: 'Displays the Bengali translation on the back side of the flashcard', icon: BookOpen },
                    { key: 'synonyms', label: 'Synonyms', desc: 'Displays synonyms on the back side of the flashcard. If disabled, the primary meaning is centered.', icon: Eye },
                    { key: 'extraWord', label: 'Extra Word Derivative', desc: 'Displays word derivatives below the main word on the front side of the flashcard', icon: PlusCircle },
                    { key: 'extraMeaning', label: 'Extra Derivative Meaning', desc: 'Displays the Bengali meaning of the derivative word on the front side of the flashcard', icon: HelpCircle },
                    { key: 'example', label: 'Example Sentences', desc: 'Displays real-world usage examples and sentences on the back side of the flashcard', icon: FileSpreadsheet },
                    { key: 'audio', label: 'Voice Pronunciation Audio', desc: 'Enables audio speaker button for word pronunciation on the flashcard', icon: Volume2 },
                  ].map(item => {
                    const hasData = variableAvailability[item.key as keyof typeof variableAvailability];
                    const isEnabled = toggles[item.key] !== false;
                    
                    return (
                      <div 
                        key={item.key} 
                        className={`p-4 flex items-start justify-between gap-4 transition-all duration-200 ${
                          !hasData ? 'bg-slate-50/70 opacity-55' : 'bg-white hover:bg-slate-50/40'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`p-2 rounded-xl mt-0.5 ${
                            !hasData ? 'bg-slate-200 text-slate-400' : isEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <item.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              {item.label}
                              {!hasData && (
                                <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-black">
                                  No Data
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-450 font-medium block mt-1 leading-relaxed">{item.desc}</span>
                          </div>
                        </div>

                        {/* Switch Switch Button */}
                        <button
                          type="button"
                          disabled={!hasData}
                          onClick={() => {
                            if (hasData) {
                              setToggles(prev => ({
                                ...prev,
                                [item.key]: !prev[item.key]
                              }));
                            }
                          }}
                          className={`mt-1 transition-all ${!hasData ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-95'}`}
                        >
                          {isEnabled && hasData ? (
                            <ToggleRight className="w-10 h-10 text-indigo-600" />
                          ) : (
                            <ToggleLeft className="w-10 h-10 text-slate-300" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- SECTION 2.5: PRACTICE & GAMES ON/OFF CONTROL --- */}
            {activeTab === 'practice-games' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Practice & Games Controller</h4>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 text-indigo-900 p-4 rounded-2xl text-xs flex items-start gap-2.5 leading-relaxed">
                  <Gamepad2 className="w-4.5 h-4.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-black text-indigo-950 block">Games Control Policy</span>
                    <p className="mt-0.5">
                      Practice and game options that are turned off will not be visible to students in the Practice & Games Hub. Toggle them on to make them available.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white divide-y divide-slate-100">
                  {[
                    { key: 'quiz', label: 'MCQ Quiz (এমসিকিউ কুইজ)', desc: 'Multiple choice questions and spelling practice games.', icon: GraduationCap },
                    { key: 'match', label: 'Word Match Game (শব্দ মেলানো গেম)', desc: 'Card matching memory training game.', icon: Gamepad2 },
                    { key: 'word_search', label: 'Word Search Puzzle (শব্দ খোঁজা পাজল গেম)', desc: 'Find hidden vocabulary in a letter matrix.', icon: Search },
                    { key: 'synonym', label: 'Synonym Check (সমার্থক শব্দ টেস্ট)', desc: 'Synonym matching and verification game.', icon: Sparkles },
                    { key: 'blank', label: 'Blank Filling Practice (শূন্যস্থান পূরণ)', desc: 'Sentence fill-in-the-blanks practice.', icon: BookOpen },
                    { key: 'odd_one_out', label: 'Odd One Out (ব্যতিক্রমী শব্দ নির্বাচন)', desc: 'Synonyms word selection challenge.', icon: HelpCircle },
                    { key: 'analogy', label: 'Word Analogy (শব্দ এনালজি ও লজিক)', desc: 'Word pairs analogy logic challenge.', icon: Shuffle },
                    { key: 'story', label: 'Read Story Mode (গল্পের মাধ্যমে পড়া)', desc: 'Enable or disable story-based learning module.', icon: BookOpen },
                    { key: 'article', label: 'Read Article Mode (আর্টিকেল রিডিং সেকশন)', desc: 'Reading comprehension and English articles section.', icon: Newspaper },
                    { key: 'exam', label: 'Online Exam Series (অনলাইন মক এক্সাম)', desc: 'Timed mock exam test series with merit leaderboard.', icon: Award },
                    { key: 'flashcards', label: 'Word Flashcards (ফ্ল্যাশকার্ড স্টাডি)', desc: 'Card swipe vocabulary flashcard training.', icon: Eye },
                    { key: 'spelling', label: 'Spelling Bee Challenge (বানান চর্চা)', desc: 'Audio pronunciation and spelling test game.', icon: Volume2 }
                  ].map(item => {
                    const isEnabled = enabledGames[item.key] !== false;
                    
                    return (
                      <div 
                        key={item.key} 
                        className="p-4 flex items-start justify-between gap-4 transition-all duration-200 bg-white hover:bg-slate-50/40"
                      >
                        <div className="flex gap-3">
                          <div className={`p-2 rounded-xl mt-0.5 ${
                            isEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <item.icon className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              {item.label}
                            </span>
                            <span className="text-[10px] text-slate-450 font-medium block mt-1 leading-relaxed">{item.desc}</span>
                          </div>
                        </div>

                        {/* Switch Toggle Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEnabledGames(prev => ({
                              ...prev,
                              [item.key]: !prev[item.key]
                            }));
                          }}
                          className="mt-1 transition-all cursor-pointer active:scale-95"
                        >
                          {isEnabled ? (
                            <ToggleRight className="w-10 h-10 text-indigo-600" />
                          ) : (
                            <ToggleLeft className="w-10 h-10 text-slate-300" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* --- SECTION 3: STUDENT ACCESS & VERIFICATION --- */}
            {activeTab === 'access' && (
              <div className="space-y-5 animate-fadeIn">
                {/* Sub-tabs bar */}
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2 overflow-x-auto scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setAccessSubTab('access')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      accessSubTab === 'access' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Student Access Mode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessSubTab('students')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      accessSubTab === 'students' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Allowed Students</span>
                    {allowedUsers.length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${accessSubTab === 'students' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {allowedUsers.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessSubTab('verification')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      accessSubTab === 'verification' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Auto-Verification</span>
                    {verifiedPayments.length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${accessSubTab === 'verification' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {verifiedPayments.length}
                      </span>
                    )}
                  </button>
                </div>

                {accessSubTab === 'access' && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="border-b border-slate-100 pb-3 mb-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">Student Access & Enroll Security</h4>
                    </div>

                    {/* Switch list */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-4">
                      {/* Default Course */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-xs font-extrabold text-slate-800 block">Set as Default Course for All Users</span>
                          <span className="block mt-1 leading-relaxed" style={settingInstructionStyle}>If enabled, all registered users will see this course automatically on their dashboard.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDefault(!isDefault)}
                          className="text-indigo-600 hover:text-indigo-700 transition cursor-pointer active:scale-95"
                        >
                          {isDefault ? (
                            <ToggleRight className="w-10 h-10 text-indigo-600" />
                          ) : (
                            <ToggleLeft className="w-10 h-10 text-slate-300" />
                          )}
                        </button>
                      </div>

                      {/* Restricted access */}
                      <div className="border-t border-slate-200/50 pt-3.5 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-xs font-extrabold text-slate-800 block">Restricted Access (Restricted Course)</span>
                          <span className="block mt-1 leading-relaxed" style={settingInstructionStyle}>If enabled, only registered students in the allowed list can access and enroll in this course.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsRestricted(!isRestricted)}
                          className="text-indigo-600 hover:text-indigo-700 transition cursor-pointer active:scale-95"
                        >
                          {isRestricted ? (
                            <ToggleRight className="w-10 h-10 text-indigo-600" />
                          ) : (
                            <ToggleLeft className="w-10 h-10 text-slate-300" />
                          )}
                        </button>
                      </div>

                      {/* Access Duration setting */}
                      <div className="border-t border-slate-200/50 pt-3.5 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-xs font-extrabold text-slate-800 block">Default Course Access Duration</span>
                          <span className="block text-[11px] text-slate-500 leading-relaxed" style={settingInstructionStyle}>
                            Default access validity period when a student is enrolled/approved for this course. Default is 365 days (1 Year).
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="1"
                            max="3650"
                            value={accessDurationDays}
                            onChange={(e) => setAccessDurationDays(parseInt(e.target.value, 10) || 365)}
                            className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 text-center outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                          />
                          <span className="text-xs font-bold text-slate-600">Days</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-950 flex items-start gap-2.5 leading-relaxed font-semibold">
                      <AlertCircle className="w-4.5 h-4.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span>Access Configuration Guideline</span>
                        <p className="mt-0.5" style={settingInstructionStyle}>
                          To manage allowed students or configure their individual access expiration dates, please switch to the <strong className="font-extrabold text-indigo-950">Allowed Students</strong> tab above. The student roster remains fully preserved regardless of whether this course is currently public or restricted.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {accessSubTab === 'students' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2 flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-sm">Allowed Students Access & Expiry Management</h4>
                  <button
                    type="button"
                    onClick={() => setIsBulkMode(!isBulkMode)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1.5 rounded-lg"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>{isBulkMode ? 'Back to Individual Add' : 'Bulk Import Lists'}</span>
                  </button>
                </div>

                {isBulkMode ? (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <span className="text-xs font-extrabold text-slate-800 block">Bulk Import Student List</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Default Expiry (Date or Month)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={bulkExpiryDate}
                            onChange={(e) => setBulkExpiryDate(e.target.value)}
                            className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition cursor-pointer"
                            title="Exact Expiry Date"
                          />
                          <input
                            type="month"
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const [yStr, mStr] = e.target.value.split('-');
                              const y = parseInt(yStr, 10);
                              const m = parseInt(mStr, 10);
                              const lastDay = new Date(y, m, 0).getDate();
                              setBulkExpiryDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
                            }}
                            className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition cursor-pointer"
                            title="Select Month (Expiry set to end of month)"
                          />
                        </div>
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[9px] font-bold text-slate-400">Quick:</span>
                          {[
                            { label: '+1 Mo', months: 1 },
                            { label: '+3 Mo', months: 3 },
                            { label: '+6 Mo', months: 6 },
                            { label: '+1 Yr', months: 12 },
                          ].map(preset => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                const d = new Date();
                                d.setMonth(d.getMonth() + preset.months);
                                setBulkExpiryDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                              }}
                              className="px-2 py-0.5 bg-slate-200 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded text-[10px] font-bold transition"
                            >
                              {preset.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setBulkExpiryDate('')}
                            className="px-2 py-0.5 bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 rounded text-[10px] font-bold transition"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center font-semibold leading-relaxed">
                        If specified, this expiration date will be applied to all students in the bulk import list. If left empty, their access will be permanent.
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Paste Emails or Phone Numbers (One per line)</label>
                      <textarea
                        rows={6}
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                        placeholder="user1@gmail.com&#10;user2@gmail.com&#10;01712345678"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono transition resize-none text-slate-700"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyBulk}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition cursor-pointer"
                    >
                      Apply Bulk List
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <span className="text-xs font-extrabold text-slate-800 block">Add Individual Student</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Email or Phone Number</label>
                        <input
                          type="text"
                          value={newUserInput}
                          onChange={(e) => setNewUserInput(e.target.value)}
                          placeholder="student@gmail.com or 01712345678"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold text-slate-700 transition"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Access Expiration (Date or Month)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={newStudentExpiry}
                            onChange={(e) => setNewStudentExpiry(e.target.value)}
                            className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold text-slate-700 transition cursor-pointer"
                            title="Exact Date"
                          />
                          <input
                            type="month"
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const [yStr, mStr] = e.target.value.split('-');
                              const y = parseInt(yStr, 10);
                              const m = parseInt(mStr, 10);
                              const lastDay = new Date(y, m, 0).getDate();
                              setNewStudentExpiry(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
                            }}
                            className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-bold text-slate-700 transition cursor-pointer"
                            title="Select Month (Expiry set to end of month)"
                          />
                        </div>
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[9px] font-bold text-slate-400">Quick:</span>
                          {[
                            { label: '+1 Mo', months: 1 },
                            { label: '+3 Mo', months: 3 },
                            { label: '+6 Mo', months: 6 },
                            { label: '+1 Yr', months: 12 },
                          ].map(preset => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                const d = new Date();
                                d.setMonth(d.getMonth() + preset.months);
                                setNewStudentExpiry(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                              }}
                              className="px-2 py-0.5 bg-slate-200 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded text-[10px] font-bold transition"
                            >
                              {preset.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setNewStudentExpiry('')}
                            className="px-2 py-0.5 bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 rounded text-[10px] font-bold transition"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddUser}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Student to Allowed List</span>
                    </button>
                  </div>
                )}

                {/* Always Show the List */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-slate-500" />
                      <span>Allowed Student List ({allowedUsers.length})</span>
                    </span>
                    {allowedUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Clear all students from the list?')) {
                            setAllowedUsers([]);
                            setAllowedUsersExpiry({});
                          }
                        }}
                        className="text-[10px] font-black text-rose-600 hover:text-rose-800 bg-rose-50 px-2 py-1 rounded transition"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {allowedUsers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs font-semibold">
                      No students registered in the allowed list yet. Use the fields above to add students.
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-150">
                      {/* Header Row */}
                      <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <div className="col-span-5">Student Identifier</div>
                        <div className="col-span-4">Access Expiry Date</div>
                        <div className="col-span-2 text-center">Status</div>
                        <div className="col-span-1 text-right">Action</div>
                      </div>

                      {/* Student List */}
                      <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                        {allowedUsers.map(user => {
                          const expiry = allowedUsersExpiry[user] || '';
                          let isExpired = false;
                          if (expiry) {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const expDate = new Date(expiry);
                            expDate.setHours(23, 59, 59, 999);
                            if (today > expDate) {
                              isExpired = true;
                            }
                          }

                          return (
                            <div key={user} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-xs text-slate-700 hover:bg-slate-50 transition">
                              <div className="col-span-5 font-mono font-bold truncate" title={user}>
                                {user}
                              </div>
                              <div className="col-span-4 pr-2 flex items-center gap-1">
                                <input
                                  type="date"
                                  value={expiry}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAllowedUsersExpiry(prev => ({
                                      ...prev,
                                      [user]: val
                                    }));
                                  }}
                                  className="px-2 py-1 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 transition w-1/2 cursor-pointer"
                                  title="Change expiration date"
                                />
                                <input
                                  type="month"
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    const [yStr, mStr] = e.target.value.split('-');
                                    const y = parseInt(yStr, 10);
                                    const m = parseInt(mStr, 10);
                                    const lastDay = new Date(y, m, 0).getDate();
                                    const lastDayStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                                    setAllowedUsersExpiry(prev => ({
                                      ...prev,
                                      [user]: lastDayStr
                                    }));
                                  }}
                                  className="px-1.5 py-1 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 transition w-1/2 cursor-pointer"
                                  title="Pick Month (Sets expiry to end of month)"
                                />
                              </div>
                              <div className="col-span-2 text-center">
                                {expiry ? (
                                  isExpired ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-100 inline-block">
                                      Expired
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-100 inline-block">
                                      Active
                                    </span>
                                  )
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-100 inline-block">
                                    Permanent
                                  </span>
                                )}
                              </div>
                              <div className="col-span-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUser(user)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                  title="Remove from allowed list"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

                {accessSubTab === 'verification' && (
                  <div className="space-y-6 animate-fadeIn text-slate-700 flex-1 flex flex-col min-h-0">
                    <div className="border-b border-slate-100 pb-3 mb-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">bKash Auto-Verification Gateway</h4>
                      <p className="mt-1 leading-relaxed" style={settingInstructionStyle}>
                        Store mobile numbers and transaction IDs (TrxID) of students who have completed payments. Students' access requests with matching details will be automatically approved.
                      </p>
                    </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto pb-4">
                  {/* Left Column: Form & Import */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Add Single Record */}
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 space-y-4">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-indigo-600" />
                        <span>Add Record Manually</span>
                      </h5>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">bKash Mobile Number</label>
                          <input
                            type="text"
                            value={newVpNumber}
                            onChange={(e) => setNewVpNumber(e.target.value)}
                            placeholder="e.g. 01712345678"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold transition text-slate-800"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">Transaction ID (TrxID)</label>
                          <input
                            type="text"
                            value={newVpTrxId}
                            onChange={(e) => setNewVpTrxId(e.target.value)}
                            placeholder="e.g. K8B9H5J2D"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-mono font-bold transition text-slate-800 uppercase"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">Payment Amount (BDT ৳)</label>
                          <input
                            type="number"
                            value={newVpAmount}
                            onChange={(e) => setNewVpAmount(Number(e.target.value))}
                            placeholder="e.g. 75"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold transition text-slate-800"
                          />
                          <p className="text-[9px] text-slate-400 font-semibold">Course access will be granted automatically based on this payment amount.</p>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddVerifiedPayment}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Record</span>
                        </button>
                      </div>
                    </div>

                    {/* Bulk Import Section */}
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 space-y-4">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <UploadCloud className="w-4 h-4 text-indigo-600" />
                        <span>Bulk Import (Excel / Text)</span>
                      </h5>

                      {/* Spreadsheet Drag-n-Drop */}
                      <div className="space-y-3">
                        <div 
                          onDragEnter={handleVpDrag}
                          onDragLeave={handleVpDrag}
                          onDragOver={handleVpDrag}
                          onDrop={handleVpDrop}
                          className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition relative ${
                            dragActiveVp 
                              ? 'border-indigo-500 bg-indigo-50/30' 
                              : 'border-slate-200 hover:border-slate-350 bg-white'
                          }`}
                        >
                          <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv"
                            onChange={handleVpFileInputChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <FileSpreadsheet className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-700">Upload Excel / CSV File</p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Drag and drop or browse files</p>
                        </div>

                        {vpExcelError && <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl">{vpExcelError}</p>}
                        {vpExcelSuccess && <p className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">{vpExcelSuccess}</p>}

                        <div className="relative flex items-center my-3">
                          <div className="flex-grow border-t border-slate-200"></div>
                          <span className="flex-shrink mx-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Or copy & paste</span>
                          <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        {/* Paste area */}
                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            value={vpBulkInput}
                            onChange={(e) => setVpBulkInput(e.target.value)}
                            placeholder="Mobile, Transaction ID (one per line)&#13;e.g.&#13;01712345678, K8B9H5J2D&#13;01822334455, J3L4K2M5N"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-semibold font-sans resize-none"
                          />
                          <button
                            type="button"
                            onClick={handleApplyVpBulk}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
                          >
                            Add Text Data
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Pre-verified Entries List */}
                  <div className="lg:col-span-7 flex flex-col h-full min-h-[300px]">
                    <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white flex flex-col h-full">
                      {/* List Header */}
                      <div className="p-4 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Verified List</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {verifiedPayments.length} records
                          </span>
                        </div>
                        {verifiedPayments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Do you want to delete all records?')) {
                                setVerifiedPayments([]);
                              }
                            }}
                            className="text-[10px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {/* Search Bar */}
                      <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={vpSearchQuery}
                            onChange={(e) => setVpSearchQuery(e.target.value)}
                            placeholder="Search by Mobile or TrxID..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                          />
                        </div>
                      </div>

                      {/* Scrollable list */}
                      <div className="flex-grow overflow-y-auto divide-y divide-slate-100 max-h-[350px]">
                        {verifiedPayments.filter(vp => {
                          const q = vpSearchQuery.toLowerCase().trim();
                          return !q || vp.bkashNumber.toLowerCase().includes(q) || vp.trxId.toLowerCase().includes(q);
                        }).length === 0 ? (
                          <div className="p-8 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center h-48">
                            <ShieldCheck className="w-8 h-8 text-slate-300 mb-2" />
                            <p>No verified payment data found.</p>
                          </div>
                        ) : (
                          verifiedPayments
                            .filter(vp => {
                              const q = vpSearchQuery.toLowerCase().trim();
                              return !q || vp.bkashNumber.toLowerCase().includes(q) || vp.trxId.toLowerCase().includes(q);
                            })
                            .map((vp, index) => (
                              <div key={index} className="px-4 py-3 hover:bg-slate-50/50 transition flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-black text-slate-800 font-mono">{vp.bkashNumber}</p>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-full border border-emerald-200">
                                      ৳{vp.amount || 30} BDT
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-indigo-600 font-bold font-mono">TrxID: <span className="uppercase">{vp.trxId}</span></p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setVerifiedPayments(prev => prev.filter((_, i) => i !== index))}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Delete record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* student access requests subsection */}
                <div className="border-t border-slate-200/60 pt-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        <span>Student Access Requests & Status</span>
                      </h5>
                      <p className="text-[10px] text-slate-450 font-semibold mt-0.5">
                        View bKash payment requests submitted by students. Approve pending requests manually or run auto-verification against gateway records.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRunCourseAutoVerification}
                        disabled={isAutoVerifyingCourse}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] rounded-xl border border-indigo-200/70 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isAutoVerifyingCourse ? 'animate-spin' : 'text-indigo-600'}`} />
                        <span>{isAutoVerifyingCourse ? 'Verifying...' : 'Auto-Verify Now'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={fetchRequests}
                        disabled={loadingRequests}
                        className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500 transition cursor-pointer"
                        title="Refresh"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {autoVerifyCourseMsg && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-800 flex items-center justify-between">
                      <span>{autoVerifyCourseMsg}</span>
                      <button
                        type="button"
                        onClick={() => setAutoVerifyCourseMsg(null)}
                        className="text-indigo-400 hover:text-indigo-600 text-xs font-black ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white">
                    {loadingRequests ? (
                      <div className="p-8 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                        <p>Loading requests...</p>
                      </div>
                    ) : courseRequests.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center">
                        <Users className="w-8 h-8 text-slate-300 mb-2" />
                        <p>No requests received yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-450 text-[10px] font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-4">Student Email</th>
                              <th className="py-2.5 px-4">Course / Plan</th>
                              <th className="py-2.5 px-4">bKash Number</th>
                              <th className="py-2.5 px-4">Transaction ID</th>
                              <th className="py-2.5 px-4">Amount</th>
                              <th className="py-2.5 px-4">Date</th>
                              <th className="py-2.5 px-4 text-center">Status</th>
                              <th className="py-2.5 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans">
                            {courseRequests.map((req) => {
                              const isApproved = req.status === 'approved';
                              const isRejected = req.status === 'rejected';
                              const displayAmt = Number((req as any).amount) || Number(req.totalPrice) || Number(req.price) || Number(course.price) || 0;
                              return (
                                <tr key={req.id} className="hover:bg-slate-50/50 transition">
                                  <td className="py-2.5 px-4 font-semibold text-slate-800">{req.email}</td>
                                  <td className="py-2.5 px-4">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-[10px] font-mono tracking-wide border border-indigo-100 uppercase">
                                      {req.courseCode || req.courseId || course.id}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-slate-600 font-bold">{req.bkashNumber}</td>
                                  <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 uppercase">{req.trxId}</td>
                                  <td className="py-2.5 px-4 font-mono font-black text-emerald-700">
                                    ৳{displayAmt} BDT
                                  </td>
                                  <td className="py-2.5 px-4 text-[10px] text-slate-400 font-bold">
                                    {req.createdAt ? new Date(req.createdAt).toLocaleDateString('bn-BD') : 'N/A'}
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    {isApproved ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        Approved
                                      </span>
                                    ) : isRejected ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100">
                                        Rejected
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                                        Pending
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    {!isApproved && !isRejected && (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionModalRequest(req);
                                            const initAmt = (req as any).amount ?? req.totalPrice ?? req.price ?? (course.price ?? '');
                                            setActionModalAmount(initAmt !== '' && initAmt !== 0 ? String(initAmt) : '');
                                          }}
                                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] rounded-lg transition cursor-pointer shadow-2xs"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRejectRequest(req.id)}
                                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 font-extrabold text-[10px] rounded-lg transition cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Approve Action Modal for Course Settings */}
                  {actionModalRequest && (
                    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
                      <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden font-sans">
                        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
                          <div>
                            <h3 className="font-extrabold text-sm text-white">Approve Access Request</h3>
                            <p className="text-[11px] text-indigo-200">Confirm payment amount and grant access</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActionModalRequest(null)}
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500 font-bold">Student:</span>
                              <span className="font-mono font-bold text-slate-800">{actionModalRequest.email}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 font-bold">bKash:</span>
                              <span className="font-mono font-bold text-pink-600">{actionModalRequest.bkashNumber}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 font-bold">TrxID:</span>
                              <span className="font-mono font-bold text-indigo-600">{actionModalRequest.trxId}</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-xs font-black text-slate-800">
                              Payment Amount (BDT ৳) <span className="text-rose-500">*</span>
                            </label>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                              Enter or verify the received payment amount before approving:
                            </p>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">৳</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={actionModalAmount}
                                onChange={(e) => setActionModalAmount(e.target.value)}
                                className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 text-sm outline-none focus:border-indigo-600 focus:bg-white font-mono"
                              />
                            </div>
                            <div className="flex items-center gap-1 pt-1 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400">Quick:</span>
                              {[0, 30, 50, 75, 100, 200].map(amt => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setActionModalAmount(String(amt))}
                                  className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[10px] font-bold rounded-md transition"
                                >
                                  ৳{amt}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setActionModalRequest(null)}
                              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isProcessingCourseAction}
                              onClick={async () => {
                                if (!actionModalRequest || isProcessingCourseAction) return;
                                const amtNum = Number(actionModalAmount);
                                if (isNaN(amtNum) || actionModalAmount === '') {
                                  alert('Please enter a valid amount');
                                  return;
                                }
                                setIsProcessingCourseAction(true);
                                try {
                                  await handleApproveRequest(actionModalRequest, amtNum);
                                  setActionModalRequest(null);
                                } finally {
                                  setIsProcessingCourseAction(false);
                                }
                              }}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                            >
                              {isProcessingCourseAction ? 'Processing...' : 'Confirm & Approve'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

            {/* --- SECTION 4: WORD LIST & UPLOAD WORDS --- */}
            {activeTab === 'wordlist' && (
              <div className="space-y-5 animate-fadeIn">
                {/* Sub-tabs header */}
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2 overflow-x-auto scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setWordlistSubTab('wordlist')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      wordlistSubTab === 'wordlist' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Word Directory & Editing</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${wordlistSubTab === 'wordlist' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {localWords.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWordlistSubTab('addwords')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      wordlistSubTab === 'addwords' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add & Upload Words</span>
                  </button>
                </div>

                {excelImportStats && (
                  <ExcelImportStatsReport 
                    stats={excelImportStats} 
                    onClose={() => setExcelImportStats(null)} 
                  />
                )}

                {wordlistSubTab === 'wordlist' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="border-b border-slate-100 pb-3 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">Word Directory & Individual Editing</h4>
                      </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportWordsToExcel}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Download complete course word list as Excel spreadsheet"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Export Excel (.xlsx)</span>
                    </button>

                    {selectedWordIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteSelectedWords}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer animate-fadeIn"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Selected ({selectedWordIds.size})</span>
                      </button>
                    )}

                    {localWords.length > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDeleteAllWords}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Delete all words in this course from cloud"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete All Words ({localWords.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                  <div className="relative flex-1 w-full sm:w-auto">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={wordSearchQuery}
                      onChange={(e) => setWordSearchQuery(e.target.value)}
                      placeholder="Search by word, meaning, or ID..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <select
                      value={wordGroupFilter}
                      onChange={(e) => setWordGroupFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-black focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="all">All Groups</option>
                      {uniqueLocalGroups.map(g => (
                        <option key={g} value={String(g)}>Group {g}</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-extrabold shrink-0">
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">প্রতি পেজে:</span>
                      <select
                        value={wordsPerPage}
                        onChange={(e) => setWordsPerPage(Number(e.target.value))}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-black focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value={20}>20 টি</option>
                        <option value={50}>50 টি</option>
                        <option value={100}>100 টি</option>
                        <option value={250}>250 টি</option>
                        <option value={500}>500 টি</option>
                        <option value={1000}>1000 টি</option>
                        <option value={-1}>সবকটি (All)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Word list table */}
                <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-500 border-b border-slate-200/65 uppercase tracking-wider">
                          <th className="px-4 py-3 w-10 text-center">
                            <input 
                              type="checkbox" 
                              checked={isAllPageSelected}
                              onChange={handleSelectAllPage}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                            />
                          </th>
                          <th className="px-3 py-3 font-mono">Unique ID</th>
                          <th className="px-4 py-3">{localPlaceLabels.place1 || 'place1'}</th>
                          <th className="px-4 py-3">{localPlaceLabels.place2 || 'place2'}</th>
                          <th className="px-4 py-3 text-center">Group</th>
                          <th className="px-4 py-3 hidden sm:table-cell">
                            {[localPlaceLabels.place3, localPlaceLabels.place4, localPlaceLabels.place5, localPlaceLabels.place6].filter(Boolean).join(' / ') || 'Extra Details'}
                          </th>
                          <th className="px-4 py-3 w-24 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                        {paginatedWords.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-semibold bg-white">
                              No words found. Try changing filters or adding some words.
                            </td>
                          </tr>
                        ) : (
                          paginatedWords.map(w => {
                            const isSelected = selectedWordIds.has(w.id);
                            return (
                              <tr key={w.id} className={`hover:bg-slate-50/50 transition ${
                                isSelected ? 'bg-indigo-50/15' : 'bg-white'
                              }`}>
                                <td className="px-4 py-2 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={() => handleCheckboxChange(w.id)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono text-[10px] text-slate-500 font-bold select-all">{w.id}</td>
                                <td className="px-4 py-2 font-black text-slate-900 font-sans">{w.word}</td>
                                <td className="px-4 py-2 text-slate-600 font-bold">{w.meaning}</td>
                                <td className="px-4 py-2 text-center"><span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black text-[10px]">{w.group}</span></td>
                                <td className="px-4 py-2 text-slate-500 text-[10px] hidden sm:table-cell truncate max-w-xs leading-relaxed">
                                  {w.example && <span className="block truncate"><strong className="text-slate-700 font-bold">{localPlaceLabels.place3 || 'place3'}:</strong> {w.example}</span>}
                                  {w.extraWord && <span className="block truncate mt-0.5"><strong className="text-slate-700 font-bold">{localPlaceLabels.place4 || 'place4'}:</strong> {w.extraWord}</span>}
                                  {w.synonyms && <span className="block truncate mt-0.5"><strong className="text-slate-700 font-bold">{localPlaceLabels.place5 || 'place5'}:</strong> {w.synonyms}</span>}
                                  {w.mnemonic && <span className="block truncate mt-0.5 text-indigo-600 font-semibold"><strong className="text-indigo-500 font-bold">{localPlaceLabels.place6 || 'place6'}:</strong> {w.mnemonic}</span>}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditWord(w)}
                                      className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                                      title="Edit Word"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteWord(w.id)}
                                      className="p-1.5 text-slate-350 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                      title="Delete Word"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table Pagination & Summary Info */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs font-semibold">
                  <div className="text-slate-500 font-extrabold text-[11px] text-center sm:text-left">
                    মোট <span className="text-indigo-600 font-black">{filteredWords.length}</span> টি ওয়ার্ডের মধ্যে {
                      wordsPerPage === -1 ? `সবকটি একসাথে প্রদর্শিত হচ্ছে` : (
                        `দেখাচ্ছে ${filteredWords.length === 0 ? 0 : (currentWordPage - 1) * effectiveWordsPerPage + 1} - ${Math.min(currentWordPage * effectiveWordsPerPage, filteredWords.length)} টি`
                      )
                    }
                  </div>

                  {totalWordPages > 1 && wordsPerPage !== -1 && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={currentWordPage === 1}
                        onClick={() => setCurrentWordPage(prev => Math.max(1, prev - 1))}
                        className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                      </button>
                      
                      <span className="font-extrabold text-slate-600 font-mono text-[11px]">
                        Page {currentWordPage} of {totalWordPages}
                      </span>

                      <button
                        type="button"
                        disabled={currentWordPage === totalWordPages}
                        onClick={() => setCurrentWordPage(prev => Math.min(totalWordPages, prev + 1))}
                        className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <span>Next</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                  </div>
                )}

                {wordlistSubTab === 'addwords' && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="border-b border-slate-100 pb-3 mb-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">Add Words & Upload Excel Spreadsheets</h4>
                    </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  
                  {/* Single Word Form */}
                  <form onSubmit={handleAddSingleWordSubmit} className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                      <span className="text-xs font-black text-slate-800">1. Individual Word</span>
                    </div>

                    {addFormMessage && (
                      <div className={`p-3 rounded-xl text-xs font-bold ${
                        addFormMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {addFormMessage.text}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">Unique ID (Optional - auto-generated if left blank)</label>
                      <input 
                        type="text" 
                        value={singleWordId}
                        onChange={(e) => setSingleWordId(e.target.value)}
                        placeholder="e.g. word-101 (leave blank for auto-generation)" 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">
                          {localPlaceLabels.place1 ? `place1: ${localPlaceLabels.place1}` : 'place1 (Front Main Display)'} <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          value={singleWord}
                          onChange={(e) => setSingleWord(e.target.value)}
                          placeholder="e.g. Abate" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">
                          {localPlaceLabels.place2 ? `place2: ${localPlaceLabels.place2}` : 'place2 (Back Main Display)'} <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          value={singleMeaning}
                          onChange={(e) => setSingleMeaning(e.target.value)}
                          placeholder="e.g. decrease / reduce" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">Group/Level (Group Name/No.) <span className="text-rose-500">*</span></label>
                        <input 
                          type="text" 
                          value={singleGroup}
                          onChange={(e) => setSingleGroup(e.target.value)}
                          placeholder="e.g. 1" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">
                          {localPlaceLabels.place3 ? `place3: ${localPlaceLabels.place3}` : 'place3 (Back Secondary Display / Example)'}
                        </label>
                        <input 
                          type="text" 
                          value={singleExample}
                          onChange={(e) => setSingleExample(e.target.value)}
                          placeholder="e.g. Example sentence or secondary info" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">
                          {localPlaceLabels.place4 ? `place4: ${localPlaceLabels.place4}` : 'place4 (Front Sub-Header / Derivative)'}
                        </label>
                        <input 
                          type="text" 
                          value={singleExtraWord}
                          onChange={(e) => setSingleExtraWord(e.target.value)}
                          placeholder="e.g. Abated" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-500 block">
                          {localPlaceLabels.place5 ? `place5: ${localPlaceLabels.place5}` : 'place5 (Back Extra Section 1 / Synonyms)'}
                        </label>
                        <input 
                          type="text" 
                          value={singleSynonyms}
                          onChange={(e) => setSingleSynonyms(e.target.value)}
                          placeholder="e.g. decrease, subside" 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 block">
                        {localPlaceLabels.place6 ? `place6: ${localPlaceLabels.place6}` : 'place6 (Back Extra Section 2 / Mnemonic)'}
                      </label>
                      <input 
                        type="text" 
                        value={singleMnemonic}
                        onChange={(e) => setSingleMnemonic(e.target.value)}
                        placeholder="e.g. Memory trick or hint" 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Save Word</span>
                    </button>
                  </form>

                  {/* Excel Upload Sub-panel */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
                        <span className="text-xs font-black text-slate-800">2. Bulk Import Excel</span>
                      </div>

                      <div className="leading-relaxed mt-2 space-y-1">
                        <p className="font-extrabold text-slate-700 text-xs">Excel Column Guidelines:</p>
                        <p style={settingInstructionStyle}>* <strong className="text-rose-600 font-extrabold">id</strong> (Unique ID)</p>
                        <p style={settingInstructionStyle}>* <strong className="text-indigo-600 font-extrabold">place1:###</strong> — Front Main Display</p>
                        <p style={settingInstructionStyle}>* <strong className="text-indigo-600 font-extrabold">place2:###</strong> — Back Main Display</p>
                        <p style={settingInstructionStyle}>* <strong className="text-indigo-600 font-extrabold">place3:###</strong> — Back Secondary Display</p>
                        <p style={settingInstructionStyle}>* <strong className="text-indigo-600 font-extrabold">place4:###</strong> — Front Sub-Header</p>
                        <p style={settingInstructionStyle}>* <strong className="text-indigo-600 font-extrabold">place5:###</strong> — Back Extra Section 1</p>
                        <p style={settingInstructionStyle}>* <strong className="text-slate-600 font-bold">group</strong> (Optional Group Name/Number)</p>
                      </div>

                      {excelError && (
                        <div className="p-3 mt-3 bg-rose-50 border border-rose-100 text-rose-700 font-bold text-xs rounded-xl">
                          {excelError}
                        </div>
                      )}

                      {excelSuccess && (
                        <div className="p-3 mt-3 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-xs rounded-xl animate-fadeIn">
                          {excelSuccess}
                        </div>
                      )}
                    </div>

                    {/* Drag & Drop Zone */}
                    <div 
                      onDragEnter={handleWordsDrag}
                      onDragOver={handleWordsDrag}
                      onDragLeave={handleWordsDrag}
                      onDrop={handleWordsDrop}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer h-40 ${
                        dragActiveWords 
                          ? 'border-indigo-500 bg-indigo-50/30' 
                          : 'border-slate-250 bg-white hover:border-slate-350'
                      }`}
                    >
                      <UploadCloud className="w-8 h-8 text-indigo-500" />
                      <div>
                        <label className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 transition cursor-pointer">
                          Select Excel File
                          <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            onChange={handleWordsFileInputChange} 
                            className="hidden" 
                          />
                        </label>
                        <span className="text-[10px] text-slate-400 block mt-1 font-medium">or drag and drop here (xlsx, xls format)</span>
                      </div>
                    </div>
                  </div>

                  {excelImportStats && (
                    <div className="mt-4">
                      <ExcelImportStatsReport 
                        stats={excelImportStats} 
                        onClose={() => setExcelImportStats(null)} 
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

            {activeTab === 'blank-questions' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Course Blank Filling Practice</h4>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Manage blank-filling questions specifically for this course. You can upload an Excel spreadsheet or add questions manually.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Excel Upload Card */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
                        <span className="text-xs font-black text-slate-800">Upload via Excel</span>
                      </div>
                      <button
                        type="button"
                        onClick={downloadBlankExcelTemplate}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Download Template</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      <strong>Flexible Layout:</strong> Col 1: Unique ID (optional/auto-generated). Col 2: Sentence/Question. Col 3-6: Options. Indicate correct answer with trailing "<code>#</code>" (e.g., <code>option#</code>) OR specify option in Col 7. Col 8: Explanation.
                    </p>

                    {/* Drag & Drop Zone */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition cursor-pointer relative bg-white">
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleUploadBlankExcel}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans"
                      />
                      <UploadCloud className="w-8 h-8 text-slate-450 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Click or drag Excel/CSV file here</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv</p>
                    </div>

                    {excelUploadError && (
                      <div className="p-3 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{excelUploadError}</span>
                      </div>
                    )}

                    {excelQuestionsPreview.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                            {excelQuestionsPreview.length} questions parsed
                          </span>
                          <button
                            onClick={handleSaveBlankExcelQuestions}
                            disabled={excelSaveStatus === 'saving'}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                          >
                            {excelSaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                          </button>
                        </div>

                        {/* Excel Preview Panel */}
                        <div className="max-h-[180px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-white text-xs">
                          {excelQuestionsPreview.map((q, idx) => (
                            <div key={idx} className="p-3">
                              <p className="font-bold text-slate-800"><span className="text-slate-400 mr-1">#{idx + 1}</span> {q.sentence}</p>
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
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Questions imported successfully!</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Question Form */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                      <span className="text-xs font-black text-slate-800">Add Manually</span>
                    </div>

                    <form onSubmit={handleManualAddBlankQuestion} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Sentence with Blank</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., The journey begins with a single ___."
                          value={newSentence}
                          onChange={(e) => setNewSentence(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option 1</label>
                          <input
                            type="text"
                            required
                            placeholder="Option 1"
                            value={newOpt1}
                            onChange={(e) => setNewOpt1(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option 2</label>
                          <input
                            type="text"
                            required
                            placeholder="Option 2"
                            value={newOpt2}
                            onChange={(e) => setNewOpt2(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option 3</label>
                          <input
                            type="text"
                            required
                            placeholder="Option 3"
                            value={newOpt3}
                            onChange={(e) => setNewOpt3(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option 4</label>
                          <input
                            type="text"
                            required
                            placeholder="Option 4"
                            value={newOpt4}
                            onChange={(e) => setNewOpt4(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Correct Answer Option</label>
                        <select
                          value={newCorrectIndex}
                          onChange={(e) => setNewCorrectIndex(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        >
                          <option value={0}>Option 1: {newOpt1 || '(empty)'}</option>
                          <option value={1}>Option 2: {newOpt2 || '(empty)'}</option>
                          <option value={2}>Option 3: {newOpt3 || '(empty)'}</option>
                          <option value={3}>Option 4: {newOpt4 || '(empty)'}</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer"
                      >
                        Add Question
                      </button>
                    </form>
                  </div>
                </div>

                {/* Existing Questions list */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">Existing Blank Questions ({courseBlankQuestions.length})</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Questions currently available for this specific course</p>
                    </div>
                    <div className="flex gap-2">
                      {courseBlankQuestions.length > 0 && (
                        <button
                          onClick={handleBulkDeleteBlankQuestions}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-750 text-xs font-black rounded-xl transition cursor-pointer"
                        >
                          <span>Bulk Delete All</span>
                        </button>
                      )}
                      <button
                        onClick={fetchBlankQuestions}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${blankQuestionsLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {blankQuestionsLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-xs font-bold font-mono">Loading questions...</span>
                    </div>
                  ) : courseBlankQuestions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-white text-xs text-slate-400">
                      No questions found. Add questions manually or upload an Excel sheet to get started!
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-150">
                            <th className="px-4 py-2.5">Sentence</th>
                            <th className="px-4 py-2.5">Options</th>
                            <th className="px-4 py-2.5">Answer</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {courseBlankQuestions.map((q) => (
                            <tr key={q.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-medium max-w-xs truncate" title={q.sentence}>
                                {q.sentence}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">
                                {q.options.join(', ')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded text-[10px]">
                                  {q.answer}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteBlankQuestion(q.id)}
                                  className="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
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

            {activeTab === 'ooo-questions' && (
              <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Course Odd One Out Practice</h4>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Manage Odd One Out questions specifically for this course. Upload an Excel spreadsheet or add questions manually.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Excel Upload Card */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4.5 h-4.5 text-sky-650" />
                        <span className="text-xs font-black text-slate-800">Upload via Excel</span>
                      </div>
                      <button
                        type="button"
                        onClick={downloadOooExcelTemplate}
                        className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Download Template</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      <strong>Flexible Layout:</strong> Col 1: Unique ID (optional/auto-generated). Col 2-5: 4 Words. Indicate odd word with trailing "<code>#</code>" (e.g., <code>word#</code>) OR specify answer in Col 6. Col 7: Reason / explanation.
                    </p>

                    {/* Drag & Drop Zone */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition cursor-pointer relative bg-white">
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleUploadOooExcel}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans"
                      />
                      <UploadCloud className="w-8 h-8 text-slate-450 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Click or drag Excel/CSV file here</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv</p>
                    </div>

                    {excelOooUploadError && (
                      <div className="p-3 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{excelOooUploadError}</span>
                      </div>
                    )}

                    {excelOooPreview.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg">
                            {excelOooPreview.length} questions parsed
                          </span>
                          <button
                            onClick={handleSaveOooExcelQuestions}
                            disabled={excelOooSaveStatus === 'saving'}
                            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                          >
                            {excelOooSaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                          </button>
                        </div>

                        {/* Excel Preview Panel */}
                        <div className="max-h-[180px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-white text-xs">
                          {excelOooPreview.map((q, idx) => (
                            <div key={idx} className="p-3">
                              <p className="font-bold text-slate-800"><span className="text-slate-400 mr-1">#{idx + 1}</span> {q.words.join(' | ')}</p>
                              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Correct: <span className="text-sky-600 font-extrabold">{q.answer}</span></p>
                              {q.reason && <p className="text-[10px] text-slate-400 mt-0.5">Reason: {q.reason}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {excelOooSaveStatus === 'saved' && (
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Questions imported successfully!</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Question Form */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                      <span className="text-xs font-black text-slate-800">Add Manually</span>
                    </div>

                    <form onSubmit={handleManualAddOooQuestion} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {newOooWords.map((word, wIdx) => (
                          <div className="space-y-1" key={wIdx}>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Word {wIdx + 1}</label>
                            <input
                              type="text"
                              required
                              placeholder={`Word ${wIdx + 1}`}
                              value={word}
                              onChange={(e) => {
                                const next = [...newOooWords];
                                next[wIdx] = e.target.value;
                                setNewOooWords(next);
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Select Odd One Out (Correct Answer)</label>
                        <select
                          value={newOooCorrectIndex}
                          onChange={(e) => setNewOooCorrectIndex(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        >
                          <option value={0}>Word 1: {newOooWords[0] || '(empty)'}</option>
                          <option value={1}>Word 2: {newOooWords[1] || '(empty)'}</option>
                          <option value={2}>Word 3: {newOooWords[2] || '(empty)'}</option>
                          <option value={3}>Word 4: {newOooWords[3] || '(empty)'}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Reason / Explanation (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. This word has a negative connotation, whereas others are positive."
                          value={newOooReason}
                          onChange={(e) => setNewOooReason(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer"
                      >
                        Add Question
                      </button>
                    </form>
                  </div>
                </div>

                {/* Existing Questions list */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">Existing Odd One Out Questions ({courseOooQuestions.length})</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Questions currently available for this specific course</p>
                    </div>
                    <div className="flex gap-2">
                      {courseOooQuestions.length > 0 && (
                        <button
                          onClick={handleBulkDeleteOooQuestions}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-750 text-xs font-black rounded-xl transition cursor-pointer"
                        >
                          <span>Bulk Delete All</span>
                        </button>
                      )}
                      <button
                        onClick={fetchOooQuestions}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${oooQuestionsLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {oooQuestionsLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-xs font-bold font-mono">Loading questions...</span>
                    </div>
                  ) : courseOooQuestions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-white text-xs text-slate-400">
                      No questions found. Add questions manually or upload an Excel sheet to get started!
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-150">
                            <th className="px-4 py-2.5">Words Set</th>
                            <th className="px-4 py-2.5">Odd One Out (Answer)</th>
                            <th className="px-4 py-2.5">Reason / Explanation</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {courseOooQuestions.map((q) => (
                            <tr key={q.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-medium max-w-xs truncate" title={q.words.join(', ')}>
                                {q.words.join(', ')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block px-2 py-0.5 bg-sky-50 text-sky-750 font-extrabold rounded text-[10px]">
                                  {q.answer}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-500 italic max-w-xs truncate" title={q.reason}>
                                {q.reason || 'None'}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteOooQuestion(q.id)}
                                  className="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
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

            {activeTab === 'analogy-questions' && (
              <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">Course Word Analogy Practice</h4>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Manage Word Analogy questions specifically for this course. Upload an Excel spreadsheet or add questions manually.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Excel Upload Card */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4.5 h-4.5 text-purple-650" />
                        <span className="text-xs font-black text-slate-800">Upload via Excel</span>
                      </div>
                      <button
                        type="button"
                        onClick={downloadAnalogyExcelTemplate}
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Download Template</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      <strong>Flexible Layout:</strong> Col 1: Unique ID (optional/auto-generated). Col 2: Stem Analogy (e.g., <code>LIGHT : BLIND</code>). Col 3-6: Pair Options. Indicate correct pair with trailing "<code>#</code>" (e.g., <code>speech : deaf#</code>) OR specify option in Col 7. Col 8: Explanation.
                    </p>

                    {/* Drag & Drop Zone */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition cursor-pointer relative bg-white">
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleUploadAnalogyExcel}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans"
                      />
                      <UploadCloud className="w-8 h-8 text-slate-450 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Click or drag Excel/CSV file here</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv</p>
                    </div>

                    {excelAnalogyUploadError && (
                      <div className="p-3 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{excelAnalogyUploadError}</span>
                      </div>
                    )}

                    {excelAnalogyPreview.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
                            {excelAnalogyPreview.length} questions parsed
                          </span>
                          <button
                            onClick={handleSaveAnalogyExcelQuestions}
                            disabled={excelAnalogySaveStatus === 'saving'}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                          >
                            {excelAnalogySaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                          </button>
                        </div>

                        {/* Excel Preview Panel */}
                        <div className="max-h-[180px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-white text-xs">
                          {excelAnalogyPreview.map((q, idx) => (
                            <div key={idx} className="p-3">
                              <p className="font-bold text-slate-800"><span className="text-slate-400 mr-1">#{idx + 1}</span> {q.analogy}</p>
                              <div className="grid grid-cols-2 gap-1.5 mt-1.5 font-mono text-[11px] text-slate-500">
                                {(Array.from(new Set((q.options || []).map(o => o.trim()))) as string[]).filter(Boolean).map((opt, oIdx) => (
                                  <span key={oIdx} className={opt === q.answer ? 'text-purple-600 font-extrabold bg-purple-50 px-1 rounded' : ''}>
                                    {opt} {opt === q.answer ? '✓' : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {excelAnalogySaveStatus === 'saved' && (
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Questions imported successfully!</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Question Form */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                      <span className="text-xs font-black text-slate-800">Add Manually</span>
                    </div>

                    <form onSubmit={handleManualAddAnalogyQuestion} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Base Analogy</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. cold : hot"
                          value={newAnalogy}
                          onChange={(e) => setNewAnalogy(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {newAnalogyOpts.map((opt, oIdx) => (
                          <div className="space-y-1" key={oIdx}>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option {oIdx + 1}</label>
                            <input
                              type="text"
                              required
                              placeholder={`Option ${oIdx + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const next = [...newAnalogyOpts];
                                next[oIdx] = e.target.value;
                                setNewAnalogyOpts(next);
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Correct Answer Option</label>
                        <select
                          value={newAnalogyCorrectIndex}
                          onChange={(e) => setNewAnalogyCorrectIndex(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        >
                          <option value={0}>Option 1: {newAnalogyOpts[0] || '(empty)'}</option>
                          <option value={1}>Option 2: {newAnalogyOpts[1] || '(empty)'}</option>
                          <option value={2}>Option 3: {newAnalogyOpts[2] || '(empty)'}</option>
                          <option value={3}>Option 4: {newAnalogyOpts[3] || '(empty)'}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Explanation (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Cold and hot are opposites, just like up and down."
                          value={newAnalogyExplanation}
                          onChange={(e) => setNewAnalogyExplanation(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer"
                      >
                        Add Question
                      </button>
                    </form>
                  </div>
                </div>

                {/* Existing Questions list */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">Existing Word Analogy Questions ({courseAnalogyQuestions.length})</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Questions currently available for this specific course</p>
                    </div>
                    <div className="flex gap-2">
                      {courseAnalogyQuestions.length > 0 && (
                        <button
                          onClick={handleBulkDeleteAnalogyQuestions}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-750 text-xs font-black rounded-xl transition cursor-pointer"
                        >
                          <span>Bulk Delete All</span>
                        </button>
                      )}
                      <button
                        onClick={fetchAnalogyQuestions}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${analogyQuestionsLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {analogyQuestionsLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-xs font-bold font-mono">Loading questions...</span>
                    </div>
                  ) : courseAnalogyQuestions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-white text-xs text-slate-400">
                      No questions found. Add questions manually or upload an Excel sheet to get started!
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-150">
                            <th className="px-4 py-2.5">Base Analogy</th>
                            <th className="px-4 py-2.5">Options</th>
                            <th className="px-4 py-2.5">Answer</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {courseAnalogyQuestions.map((q) => (
                            <tr key={q.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-medium max-w-xs truncate" title={q.analogy}>
                                {q.analogy}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 max-w-xs truncate" title={q.options.join(', ')}>
                                {q.options.join(', ')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-755 font-extrabold rounded text-[10px]">
                                  {q.answer}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteAnalogyQuestion(q.id)}
                                  className="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
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

            {/* --- SECTION: COURSE CUSTOM MCQ QUESTIONS --- */}
            {activeTab === 'mcq-questions' && (
              <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <GraduationCap className="w-4.5 h-4.5 text-indigo-600" />
                    <span>Course Custom MCQ Quiz Questions</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                    Upload or manually manage custom Multiple Choice Questions for this course. When custom questions exist and MCQ Quiz toggle is enabled, auto-generated MCQs are stopped and these custom questions are served to students.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Excel Upload Card */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4.5 h-4.5 text-indigo-600" />
                        <span className="text-xs font-black text-slate-800">Upload via Excel / CSV</span>
                      </div>
                      <button
                        type="button"
                        onClick={downloadMcqExcelTemplate}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Download Template</span>
                      </button>
                    </div>

                    <div className="space-y-2 text-[11px] text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80 font-sans">
                      <span className="font-bold text-slate-900 block">Supported Formats:</span>
                      <p>
                        <strong>Format 1:</strong> Col 1: Mandatory ID (e.g. <code>ooo-101</code>) | Col 2: Question | Col 3-6: 4 Options (mark correct option with trailing <code>#</code> like <code>"harmful#"</code>) | Col 7: Reason/Explanation (optional).
                      </p>
                      <p className="border-t border-slate-100 pt-1.5">
                        <strong>Format 2:</strong> Col 1: Mandatory ID (e.g. <code>ooo-101</code>) | Col 2: Question | Col 3-6: 4 Options | Col 7: Correct Answer text (must match one of Col 3-6) | Col 8: Reason/Explanation (optional).
                      </p>
                    </div>

                    {/* Drag & Drop Zone */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition cursor-pointer relative bg-white">
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleUploadMcqExcel}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer font-sans"
                      />
                      <UploadCloud className="w-8 h-8 text-slate-450 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Click or drag Excel/CSV file here</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv</p>
                    </div>

                    {excelMcqUploadError && (
                      <div className="p-3 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-2 border border-rose-100 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{excelMcqUploadError}</span>
                      </div>
                    )}

                    {excelMcqNotice && excelMcqNotice.length > 0 && (
                      <div className="p-3.5 bg-amber-50 text-amber-900 rounded-2xl border border-amber-200/80 text-xs font-semibold space-y-2 animate-fadeIn">
                        <div className="flex items-center gap-2 font-black text-amber-800 text-[11px] uppercase tracking-wide">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span>Notice: {excelMcqNotice.length} Question(s) Skipped Due to Option Mismatch</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed font-normal">
                          The following question(s) were skipped because Column 7 answer did not match any of the 4 option columns. All other valid questions were parsed successfully. You can add the skipped ones manually:
                        </p>
                        <ul className="max-h-36 overflow-y-auto space-y-1.5 pl-2 text-[11px] font-mono text-amber-950 bg-white/80 p-2.5 rounded-xl border border-amber-200/60 divide-y divide-amber-100">
                          {excelMcqNotice.map((notice, nIdx) => (
                            <li key={nIdx} className="pt-1 first:pt-0 break-words leading-snug">{notice}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {excelMcqPreview.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                            {excelMcqPreview.length} questions parsed
                          </span>
                          <button
                            onClick={handleSaveMcqExcelQuestions}
                            disabled={excelMcqSaveStatus === 'saving'}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                          >
                            {excelMcqSaveStatus === 'saving' ? 'Saving...' : 'Save to Cloud'}
                          </button>
                        </div>

                        {/* Excel Preview Panel */}
                        <div className="max-h-[180px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-white text-xs">
                          {excelMcqPreview.map((q, idx) => (
                            <div key={idx} className="p-3 space-y-1">
                              <p className="font-bold text-slate-800"><span className="text-slate-400 mr-1">#{q.id}</span> {q.question}</p>
                              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-slate-500">
                                {(Array.from(new Set((q.options || []).map(o => o.trim()))) as string[]).filter(Boolean).map((opt, oIdx) => (
                                  <span key={oIdx} className={opt === q.answer ? 'text-emerald-600 font-extrabold bg-emerald-50 px-1 rounded' : ''}>
                                    {opt} {opt === q.answer ? '✓' : ''}
                                  </span>
                                ))}
                              </div>
                              {q.explanation && (
                                <p className="text-[10px] text-slate-400 italic">Reason: {q.explanation}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {excelMcqSaveStatus === 'saved' && (
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100 text-xs font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        <span>MCQ questions imported successfully!</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Question Form */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                      <span className="text-xs font-black text-slate-800">Add Manually</span>
                    </div>

                    <form onSubmit={handleManualAddMcqQuestion} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Question</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Which of the following means 'harmful'?"
                          value={newMcqQuestion}
                          onChange={(e) => setNewMcqQuestion(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {newMcqOpts.map((opt, oIdx) => (
                          <div className="space-y-1" key={oIdx}>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Option {oIdx + 1}</label>
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
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Correct Answer Option</label>
                        <select
                          value={newMcqCorrectIndex}
                          onChange={(e) => setNewMcqCorrectIndex(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        >
                          <option value={0}>Option 1: {newMcqOpts[0] || '(empty)'}</option>
                          <option value={1}>Option 2: {newMcqOpts[1] || '(empty)'}</option>
                          <option value={2}>Option 3: {newMcqOpts[2] || '(empty)'}</option>
                          <option value={3}>Option 4: {newMcqOpts[3] || '(empty)'}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Reason / Explanation (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Detrimental means causing harm or damage."
                          value={newMcqExplanation}
                          onChange={(e) => setNewMcqExplanation(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer"
                      >
                        Add Question
                      </button>
                    </form>
                  </div>
                </div>

                {/* Existing Questions list */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">Existing Course MCQ Questions ({courseMcqQuestions.length})</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Uploaded custom questions serve as primary MCQ quiz source</p>
                    </div>
                    <div className="flex gap-2">
                      {courseMcqQuestions.length > 0 && (
                        <button
                          onClick={handleBulkDeleteMcqQuestions}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-750 text-xs font-black rounded-xl transition cursor-pointer"
                        >
                          <span>Bulk Delete All</span>
                        </button>
                      )}
                      <button
                        onClick={fetchMcqQuestions}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${mcqQuestionsLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {mcqQuestionsLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-xs font-bold font-mono">Loading questions...</span>
                    </div>
                  ) : courseMcqQuestions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-white text-xs text-slate-400">
                      No custom MCQ questions uploaded yet. Upload an Excel sheet or add questions manually. (System is using auto-generated vocabulary MCQs)
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider border-b border-slate-150">
                            <th className="px-4 py-2.5">ID</th>
                            <th className="px-4 py-2.5">Question</th>
                            <th className="px-4 py-2.5">Options</th>
                            <th className="px-4 py-2.5">Correct Answer</th>
                            <th className="px-4 py-2.5">Explanation</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {courseMcqQuestions.map((q) => (
                            <tr key={q.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">{q.id}</td>
                              <td className="px-4 py-2.5 font-bold text-slate-800 max-w-xs truncate" title={q.question}>
                                {q.question}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 max-w-xs truncate" title={q.options.join(', ')}>
                                {q.options.join(', ')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-800 font-extrabold rounded text-[10px]">
                                  {q.answer}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-400 italic max-w-xs truncate" title={q.explanation}>
                                {q.explanation || '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteMcqQuestion(q.id)}
                                  className="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition cursor-pointer"
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

            {/* --- SECTION: ONLINE EXAMS MANAGEMENT --- */}
            {activeTab === 'exam-questions' && (
              <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 animate-fadeIn">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-600" />
                      <span>Online Exams Management (অনলাইন এক্সাম ম্যানেজমেন্ট)</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Upload exam questions via Excel, configure time limits, pass marks, and negative marking for <span className="font-bold text-indigo-600">{course.title}</span>.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadExamExcelTemplate()}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl border border-indigo-200 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                    <span>Download Exam Excel Template</span>
                  </button>
                </div>

                {/* Create Exam Card */}
                <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                  <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Create New Exam via Excel Upload</h5>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Exam Title (শিরোনাম)</label>
                      <input
                        type="text"
                        value={examTitleInput}
                        onChange={(e) => setExamTitleInput(e.target.value)}
                        placeholder={`${course.title} Final Test`}
                        className="w-full text-xs font-bold text-slate-800 border border-slate-200 rounded-xl px-3 py-2 bg-white focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Time Limit (Minutes)</label>
                      <input
                        type="number"
                        value={examDurationInput}
                        onChange={(e) => setExamDurationInput(Number(e.target.value) || 15)}
                        className="w-full text-xs font-bold text-slate-800 border border-slate-200 rounded-xl px-3 py-2 bg-white focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Marks per Question</label>
                      <input
                        type="number"
                        step="0.5"
                        value={examMarksPerQInput}
                        onChange={(e) => setExamMarksPerQInput(Number(e.target.value) || 1)}
                        className="w-full text-xs font-bold text-slate-800 border border-slate-200 rounded-xl px-3 py-2 bg-white focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Negative Mark per Wrong Answer</label>
                      <input
                        type="number"
                        step="0.05"
                        value={examNegativeMarkInput}
                        onChange={(e) => setExamNegativeMarkInput(Number(e.target.value) || 0.25)}
                        className="w-full text-xs font-bold text-slate-800 border border-slate-200 rounded-xl px-3 py-2 bg-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Upload Input */}
                  <div className="pt-2">
                    <label className="cursor-pointer bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 p-4 rounded-xl text-center transition flex flex-col items-center justify-center">
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        onChange={handleUploadExamExcel}
                      />
                      <UploadCloud className="w-6 h-6 text-indigo-500 mb-1" />
                      <span className="text-xs font-bold text-slate-700">Click or Drag & Drop Exam Excel File</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Columns: Question, Option A, Option B, Option C, Option D, Correct Answer, Explanation</span>
                    </label>
                  </div>

                  {excelExamUploadError && (
                    <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                      {excelExamUploadError}
                    </p>
                  )}

                  {/* Excel Preview */}
                  {excelExamPreview.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-extrabold text-emerald-900">
                            Exam File Loaded Successfully: {excelExamPreview.length} Questions Ready
                          </p>
                          <p className="text-[11px] font-semibold text-emerald-700">
                            Total Exam Marks: {excelExamPreview.length * (examMarksPerQInput || 1)}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={excelExamSaveStatus === 'saving'}
                          onClick={handleSaveExamExcel}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {excelExamSaveStatus === 'saving' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          <span>Save & Publish Exam</span>
                        </button>
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs text-emerald-950 font-medium border-t border-emerald-200/60 pt-2">
                        {excelExamPreview.map((q, idx) => (
                          <div key={idx} className="bg-white/80 p-2 rounded-lg border border-emerald-100 flex items-center justify-between gap-2">
                            <span className="truncate font-semibold">{idx + 1}. {q.question}</span>
                            <span className="shrink-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">Ans: {q.answer}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Published Exams List */}
                <div className="space-y-3">
                  <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Published Exams for {course.title} ({courseExams.length})</span>
                    <button
                      type="button"
                      onClick={fetchCourseExams}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${examsLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </h5>

                  {courseExams.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs font-medium">
                      No online exams published for this course yet. Upload an Excel file above to create one.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {courseExams.map(ex => (
                        <div key={ex.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h6 className="font-extrabold text-slate-900 text-xs">{ex.title}</h6>
                              <button
                                type="button"
                                onClick={() => handleDeleteCourseExam(ex.id)}
                                className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete Exam"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-500 font-bold">
                              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">{ex.questions?.length || 0} Questions</span>
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">{ex.durationMinutes} Mins</span>
                              <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md">Pass: {ex.totalMarks || (ex.questions?.length || 0)} Marks</span>
                              {ex.negativeMarking ? (
                                <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md">Negative: -{ex.negativeMarking}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- SECTION: READ STORY MANAGEMENT --- */}
            {activeTab === 'story-management' && (
              <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-2">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <BookOpen className="w-4.5 h-4.5 text-indigo-600" />
                      <span>Read Story Management</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      Upload stories via Word document (.docx, .doc, .txt) or manage existing stories for this course.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={storySaveStatus === 'saving'}
                    onClick={handleSaveStoriesToCloud}
                    className={`px-4 py-2 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer shrink-0 disabled:opacity-50 ${
                      storySaveStatus === 'saved' ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {storySaveStatus === 'saving' ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : storySaveStatus === 'saved' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-200" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>
                      {storySaveStatus === 'saving'
                        ? 'Saving Stories...'
                        : storySaveStatus === 'saved'
                        ? 'Stories Saved to Cloud!'
                        : 'Save Stories to Cloud'}
                    </span>
                  </button>
                </div>

                {/* Status Banners */}
                {storySaveStatus === 'saved' && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All {localStories.length} stories have been successfully synchronized to the cloud!</span>
                  </div>
                )}

                {/* Upload Card */}
                <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Document / File Upload */}
                    <label className="cursor-pointer bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 p-5 rounded-xl text-center transition group flex flex-col items-center justify-center">
                      <input
                        type="file"
                        accept=".docx,.doc,.txt,.xlsx,.xls,.csv,.json"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setStoryUploadLoading(true);
                          setStoryUploadError(null);
                          try {
                            const parsed = await parseStoriesFromFile(file, course.id);
                            if (parsed.length === 0) {
                              setStoryUploadError('No valid story titles or paragraphs were detected in the file.');
                            } else {
                              const updated = [...localStories, ...parsed];
                              setLocalStories(updated);
                              // Automatically synchronize directly to Cloud Firestore!
                              await saveStoriesListDirectly(updated);
                            }
                          } catch (err: any) {
                            console.error(err);
                            setStoryUploadError(err?.message || 'Could not process document file. Please ensure it is a valid .docx, .xlsx, .csv, .json, or .txt file.');
                          } finally {
                            setStoryUploadLoading(false);
                            // reset file input
                            e.target.value = '';
                          }
                        }}
                      />
                      <UploadCloud className="w-7 h-7 text-indigo-500 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-slate-800 block">
                        {storyUploadLoading ? 'Extracting & Saving stories to Cloud...' : 'Upload Stories File (.docx / .xlsx / .csv / .json / .txt)'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Word doc, Excel sheet, JSON or text file (Auto-saves to Cloud)
                      </span>
                    </label>

                    {/* Paste Text / Direct Input */}
                    <div className="bg-white p-4 rounded-xl border border-indigo-150 space-y-2 flex flex-col">
                      <label className="text-xs font-extrabold text-slate-800 block">
                        Paste Story Text Directly:
                      </label>
                      <textarea
                        rows={3}
                        value={pastedStoryText}
                        onChange={(e) => setPastedStoryText(e.target.value)}
                        placeholder="Story Title&#10;First paragraph of story..."
                        className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg p-2 focus:border-indigo-500 outline-none flex-1 font-mono resize-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!pastedStoryText.trim()) return;
                          const parsed = parseStoriesFromRawText(pastedStoryText, course.id);
                          if (parsed.length > 0) {
                            const updated = [...localStories, ...parsed];
                            setLocalStories(updated);
                            setPastedStoryText('');
                            setStoryUploadError(null);
                            // Automatically save to cloud
                            await saveStoriesListDirectly(updated);
                          } else {
                            setStoryUploadError('No valid story detected in pasted text.');
                          }
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer self-end flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Parse & Save to Cloud</span>
                      </button>
                    </div>
                  </div>

                  {/* Format Guide */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                    <span className="font-extrabold text-slate-800 block">💡 Supported Formats & Guide:</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Upload Word document (.docx/.doc), Excel/CSV (.xlsx/.csv with columns for Title & Content), JSON, or plain text:
                    </p>
                    <pre className="text-[11px] font-mono text-indigo-900 bg-indigo-50/80 p-2.5 rounded-lg border border-indigo-100 leading-relaxed whitespace-pre font-medium">
{`Story Title 1
First paragraph of story 1...

Story Title 2
First paragraph of story 2...`}
                    </pre>
                  </div>

                  {storyUploadError && (
                    <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                      {storyUploadError}
                    </p>
                  )}
                </div>

                {/* Uploaded Stories List - Displayed one after another separately */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Uploaded Stories List ({localStories.length})
                    </h5>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLocalStories(prev => [
                            ...prev,
                            {
                              id: `story-${course.id}-${Date.now()}-${prev.length + 1}`,
                              title: `Story Title ${prev.length + 1}`,
                              content: '',
                              createdAt: new Date().toISOString()
                            }
                          ]);
                        }}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Story Manually</span>
                      </button>
                      {localStories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setLocalStories([])}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700 transition cursor-pointer"
                        >
                          Remove All Stories
                        </button>
                      )}
                    </div>
                  </div>

                  {localStories.length > 0 ? (
                    <div className="space-y-4">
                      {localStories.map((story, sIdx) => (
                        <div key={story.id || sIdx} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-xs font-mono font-black px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-150 shrink-0">
                                Story #{sIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={story.title}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalStories(prev => prev.map((item, i) => i === sIdx ? { ...item, title: val } : item));
                                }}
                                placeholder="Story Title..."
                                className="text-xs font-extrabold text-slate-900 border border-slate-200 rounded-xl px-3 py-1.5 w-full focus:border-indigo-500 outline-none"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setLocalStories(prev => prev.filter((_, i) => i !== sIdx));
                              }}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
                              title="Delete Story"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </div>

                          <div>
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                              Story Content
                            </label>
                            <textarea
                              rows={4}
                              value={story.content}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLocalStories(prev => prev.map((item, i) => i === sIdx ? { ...item, content: val } : item));
                              }}
                              className="w-full text-xs text-slate-700 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none resize-y font-normal leading-relaxed"
                              placeholder="Enter or edit story content..."
                            />
                          </div>
                        </div>
                      ))}

                      {/* Save to Cloud Button at bottom of story list */}
                      <div className="pt-2 flex items-center justify-between">
                        {storySaveStatus === 'saved' ? (
                          <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4" />
                            <span>Stories successfully synced to cloud!</span>
                          </div>
                        ) : storySaveStatus === 'error' ? (
                          <div className="text-xs font-bold text-rose-600">
                            {storyUploadError || 'Failed to save to cloud'}
                          </div>
                        ) : <div />}
                        <button
                          type="button"
                          disabled={storySaveStatus === 'saving'}
                          onClick={handleSaveStoriesToCloud}
                          className={`px-5 py-2.5 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50 ${
                            storySaveStatus === 'saved' ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {storySaveStatus === 'saving' ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : storySaveStatus === 'saved' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-200" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          <span>
                            {storySaveStatus === 'saving'
                              ? 'Saving Stories...'
                              : storySaveStatus === 'saved'
                              ? 'Stories Saved to Cloud!'
                              : 'Save Stories to Cloud'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 font-medium">
                      No stories uploaded yet. Use the document uploader above to add stories.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- READ ARTICLE MANAGEMENT TAB --- */}
            {activeTab === 'article-management' && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-3xl space-y-2 shadow-lg border border-indigo-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Newspaper className="w-5 h-5 text-indigo-300" />
                      <h4 className="font-extrabold text-sm sm:text-base">Course Article Management</h4>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-extrabold rounded-full flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Cloud Auto-Sync Ready</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-3xl">
                    Add custom reading articles to this course. Added articles will be synchronized with the cloud database and available to all enrolled students in the Article Reading View.
                  </p>
                </div>

                {/* Status Banners */}
                {articleSaveStatus === 'saved' && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All {localArticles.length} articles have been successfully synchronized to the cloud!</span>
                  </div>
                )}
                {articleSaveStatus === 'error' && (
                  <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{articleUploadError || 'Failed to save articles to cloud.'}</span>
                  </div>
                )}

                {/* Article Upload Card */}
                <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Document / File Upload */}
                    <label className="cursor-pointer bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 p-5 rounded-xl text-center transition group flex flex-col items-center justify-center">
                      <input
                        type="file"
                        accept=".docx,.doc,.txt,.xlsx,.xls,.csv,.json"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setArticleUploadLoading(true);
                          setArticleUploadError(null);
                          try {
                            const parsed = await parseArticlesFromFile(file, course.id);
                            if (parsed.length === 0) {
                              setArticleUploadError('No valid article titles or paragraphs were detected in the file.');
                            } else {
                              const updated = [...localArticles, ...parsed];
                              setLocalArticles(updated);
                              // Automatically synchronize directly to Cloud Firestore!
                              await saveArticlesListDirectly(updated);
                            }
                          } catch (err: any) {
                            console.error(err);
                            setArticleUploadError(err?.message || 'Could not process article file. Please ensure it is a valid .docx, .xlsx, .csv, .json, or .txt file.');
                          } finally {
                            setArticleUploadLoading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                      <UploadCloud className="w-7 h-7 text-indigo-500 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-slate-800 block">
                        {articleUploadLoading ? 'Extracting & Saving articles to Cloud...' : 'Upload Articles File (.docx / .xlsx / .csv / .json / .txt)'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Word doc, Excel sheet, JSON or text file (Auto-saves to Cloud)
                      </span>
                    </label>

                    {/* Paste Text / Direct Input */}
                    <div className="bg-white p-4 rounded-xl border border-indigo-150 space-y-2 flex flex-col">
                      <label className="text-xs font-extrabold text-slate-800 block">
                        Paste Article Text Directly:
                      </label>
                      <textarea
                        rows={3}
                        value={pastedArticleText}
                        onChange={(e) => setPastedArticleText(e.target.value)}
                        placeholder="Article Title&#10;First paragraph of article..."
                        className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg p-2 focus:border-indigo-500 outline-none flex-1 font-mono resize-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!pastedArticleText.trim()) return;
                          const parsed = parseArticlesFromRawText(pastedArticleText, course.id);
                          if (parsed.length > 0) {
                            const updated = [...localArticles, ...parsed];
                            setLocalArticles(updated);
                            setPastedArticleText('');
                            setArticleUploadError(null);
                            // Automatically save to cloud
                            await saveArticlesListDirectly(updated);
                          } else {
                            setArticleUploadError('No valid article detected in pasted text.');
                          }
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer self-end flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Parse & Save to Cloud</span>
                      </button>
                    </div>
                  </div>

                  {/* Format Guide */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                    <span className="font-extrabold text-slate-800 block">💡 Supported Formats & Guide:</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Upload Word document (.docx/.doc), Excel/CSV (.xlsx/.csv with columns for Title, Content, Author, Category), JSON, or plain text:
                    </p>
                    <pre className="text-[11px] font-mono text-indigo-900 bg-indigo-50/80 p-2.5 rounded-lg border border-indigo-100 leading-relaxed whitespace-pre font-medium">
{`Article Title 1
First paragraph of article 1...

Article Title 2
First paragraph of article 2...`}
                    </pre>
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span>Course Articles ({localArticles.length})</span>
                    </h5>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLocalArticles(prev => [
                            ...prev,
                            {
                              id: `art-${course.id}-${Date.now()}-${prev.length + 1}`,
                              title: `New Article Title ${prev.length + 1}`,
                              excerpt: 'Brief overview or summary of this article...',
                              content: 'Enter full article content here. Vocabulary words matching course list will be automatically highlighted during reading.',
                              author: 'Course Educator',
                              category: 'Vocabulary Reading',
                              readTime: '4 min read',
                              publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                              coverGradient: 'from-indigo-600 via-purple-600 to-pink-600',
                              tags: ['Vocabulary', 'Article'],
                              createdAt: new Date().toISOString()
                            }
                          ]);
                        }}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add New Article</span>
                      </button>
                      <button
                        type="button"
                        disabled={articleSaveStatus === 'saving'}
                        onClick={handleSaveArticlesToCloud}
                        className={`px-4 py-2 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50 ${
                          articleSaveStatus === 'saved' ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {articleSaveStatus === 'saving' ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : articleSaveStatus === 'saved' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-200" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>
                          {articleSaveStatus === 'saving'
                            ? 'Saving Articles...'
                            : articleSaveStatus === 'saved'
                            ? 'Articles Saved!'
                            : 'Save Articles to Cloud'}
                        </span>
                      </button>
                      {localArticles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to remove all custom articles from this course?')) {
                              setLocalArticles([]);
                            }
                          }}
                          className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        >
                          Remove All Articles
                        </button>
                      )}
                    </div>
                  </div>

                  {localArticles.length > 0 ? (
                    <div className="space-y-5">
                      {localArticles.map((art, aIdx) => (
                        <div key={art.id || aIdx} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-xs font-mono font-black px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-150 shrink-0">
                                Article #{aIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={art.title}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalArticles(prev => prev.map((item, i) => i === aIdx ? { ...item, title: val } : item));
                                }}
                                placeholder="Article Title..."
                                className="text-xs font-extrabold text-slate-900 border border-slate-200 rounded-xl px-3 py-1.5 w-full focus:border-indigo-500 outline-none"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setLocalArticles(prev => prev.filter((_, i) => i !== aIdx));
                              }}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
                              title="Delete Article"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                                Category
                              </label>
                              <input
                                type="text"
                                value={art.category || 'Vocabulary Reading'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalArticles(prev => prev.map((item, i) => i === aIdx ? { ...item, category: val } : item));
                                }}
                                className="w-full text-xs text-slate-800 font-semibold border border-slate-200 rounded-xl p-2.5 focus:border-indigo-500 outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                                Author
                              </label>
                              <input
                                type="text"
                                value={art.author || 'Course Educator'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalArticles(prev => prev.map((item, i) => i === aIdx ? { ...item, author: val } : item));
                                }}
                                className="w-full text-xs text-slate-800 font-semibold border border-slate-200 rounded-xl p-2.5 focus:border-indigo-500 outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                                Read Time
                              </label>
                              <input
                                type="text"
                                value={art.readTime || '4 min read'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalArticles(prev => prev.map((item, i) => i === aIdx ? { ...item, readTime: val } : item));
                                }}
                                className="w-full text-xs text-slate-800 font-semibold border border-slate-200 rounded-xl p-2.5 focus:border-indigo-500 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                              Article Excerpt / Summary
                            </label>
                            <input
                              type="text"
                              value={art.excerpt || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLocalArticles(prev => prev.map((item, i) => i === aIdx ? { ...item, excerpt: val } : item));
                              }}
                              className="w-full text-xs text-slate-700 font-medium border border-slate-200 rounded-xl p-2.5 focus:border-indigo-500 outline-none"
                              placeholder="Brief summary displayed on article card..."
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                              Full Article Content
                            </label>
                            <textarea
                              rows={6}
                              value={art.content}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLocalArticles(prev => prev.map((item, i) => i === aIdx ? { ...item, content: val } : item));
                              }}
                              className="w-full text-xs text-slate-700 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none resize-y font-normal leading-relaxed"
                              placeholder="Enter full article text..."
                            />
                          </div>
                        </div>
                      ))}

                      {/* Save to Cloud Button at bottom of article list */}
                      <div className="pt-2 flex items-center justify-between">
                        {articleSaveStatus === 'saved' ? (
                          <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4" />
                            <span>Articles successfully synced to cloud!</span>
                          </div>
                        ) : articleSaveStatus === 'error' ? (
                          <div className="text-xs font-bold text-rose-600">
                            {articleUploadError || 'Failed to save to cloud'}
                          </div>
                        ) : <div />}
                        <button
                          type="button"
                          disabled={articleSaveStatus === 'saving'}
                          onClick={handleSaveArticlesToCloud}
                          className={`px-5 py-2.5 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50 ${
                            articleSaveStatus === 'saved' ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {articleSaveStatus === 'saving' ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : articleSaveStatus === 'saved' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-200" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          <span>
                            {articleSaveStatus === 'saving'
                              ? 'Saving Articles...'
                              : articleSaveStatus === 'saved'
                              ? 'Articles Saved to Cloud!'
                              : 'Save Articles to Cloud'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 space-y-3">
                      <Newspaper className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-medium text-slate-600">No custom articles added to this course yet.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setLocalArticles([
                            {
                              id: `art-${course.id}-${Date.now()}-1`,
                              title: 'Sample Course Article',
                              excerpt: 'An engaging vocabulary article for students.',
                              content: 'This is a sample article for this course. Add relevant vocabulary words here to help students learn in context.',
                              author: 'Course Instructor',
                              category: 'Reading Practice',
                              readTime: '3 min read',
                              publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                              coverGradient: 'from-indigo-600 via-purple-600 to-pink-600',
                              tags: ['Reading', 'Vocabulary']
                            }
                          ]);
                        }}
                        className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold border border-indigo-200 transition cursor-pointer"
                      >
                        Create First Course Article
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Word Editing Inline Modal/Overlay Overlay */}
        {editingWord && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-55 animate-fade-in text-slate-700">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 relative space-y-4 animate-scale-up border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Edit className="w-4 h-4 text-indigo-650" />
                  <span>Word Individual Editor</span>
                </span>
                <button onClick={() => setEditingWord(null)} className="p-1 hover:bg-slate-100 rounded text-slate-450 hover:text-slate-650 cursor-pointer">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">Word Unique ID (Mandatory)</label>
                <input 
                  type="text" 
                  value={editedWordId}
                  onChange={(e) => setEditedWordId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  placeholder="Unique ID"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">
                    {localPlaceLabels.place1 ? `place1: ${localPlaceLabels.place1}` : 'place1 (Front Main Display)'}
                  </label>
                  <input 
                    type="text" 
                    value={editedWord}
                    onChange={(e) => setEditedWord(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">
                    {localPlaceLabels.place2 ? `place2: ${localPlaceLabels.place2}` : 'place2 (Back Main Display)'}
                  </label>
                  <input 
                    type="text" 
                    value={editedMeaning}
                    onChange={(e) => setEditedMeaning(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">Group / Level</label>
                  <input 
                    type="text" 
                    value={editedGroup}
                    onChange={(e) => setEditedGroup(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">
                    {localPlaceLabels.place3 ? `place3: ${localPlaceLabels.place3}` : 'place3 (Back Secondary Display / Example)'}
                  </label>
                  <textarea 
                    rows={2}
                    value={editedExample}
                    onChange={(e) => setEditedExample(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">
                    {localPlaceLabels.place4 ? `place4: ${localPlaceLabels.place4}` : 'place4 (Front Sub-Header / Derivative)'}
                  </label>
                  <input 
                    type="text" 
                    value={editedExtraWord}
                    onChange={(e) => setEditedExtraWord(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">
                    {localPlaceLabels.place5 ? `place5: ${localPlaceLabels.place5}` : 'place5 (Back Extra Section 1 / Synonyms)'}
                  </label>
                  <input 
                    type="text" 
                    value={editedSynonyms}
                    onChange={(e) => setEditedSynonyms(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">
                  {localPlaceLabels.place6 ? `place6: ${localPlaceLabels.place6}` : 'place6 (Back Extra Section 2 / Notes)'}
                </label>
                <input 
                  type="text" 
                  value={editedMnemonic}
                  onChange={(e) => setEditedMnemonic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  placeholder="Memory trick or hint to display on flashcard..."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button 
                  onClick={() => setEditingWord(null)} 
                  className="px-4 py-2 bg-slate-200 text-slate-650 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveWordEdit} 
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-550 transition shadow-md"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Main Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3.5">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 transition text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button 
            disabled={isSaving}
            onClick={handleSave}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-200 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Update Settings</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
