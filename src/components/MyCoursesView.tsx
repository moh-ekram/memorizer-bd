import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Check, Trash2, Lock, Sparkles, Volume2, PlusCircle, 
  FileSpreadsheet, HelpCircle, Shuffle, GraduationCap, Trophy, 
  Gamepad2, Search, CheckCircle, AlertCircle, ShoppingBag, X, 
  Copy, ArrowRight, Star, Heart, Calendar, ShieldAlert, Layers, Play,
  ChevronDown, ChevronUp, Info, Eye, Wallet, EyeOff, MoreHorizontal, ArrowUpRight
} from 'lucide-react';
import { db, doc, setDoc, getDoc, getDocs, onSnapshot, query, collection, where, incrementCourseClickCount } from '../lib/db';
import { safeSetLocalStorage } from '../lib/storage';
import { Course, UserProgress, ActiveTab } from '../types';
import { isCourseEnrolled, isCourseAccessible } from '../lib/courseAccess';
import CoursePreviewModal from './CoursePreviewModal';

const getEnglishFeatureLabel = (key: string, placeLabels?: Record<string, string>) => {
  switch (key) {
    case 'meaning': return placeLabels?.place2 || 'Word Meaning';
    case 'synonyms': return placeLabels?.place5 || 'Synonyms';
    case 'extraWord': return placeLabels?.place4 || 'Derivatives';
    case 'extraMeaning': return placeLabels?.place6 || 'Derivative Meaning';
    case 'example': return placeLabels?.place3 || 'Example Sentences';
    case 'audio': return 'Voice Pronunciation';
    default: return key;
  }
};

const getEnglishGameLabel = (key: string, placeLabels?: Record<string, string>) => {
  switch (key) {
    case 'quiz': return 'Practice Quiz';
    case 'match': return 'Word Match';
    case 'synonym': return 'Synonym Check';
    case 'blank': return 'Fill in the Blank';
    case 'odd_one_out': return 'Odd One Out';
    case 'analogy': return 'Word Analogy';
    default: return key;
  }
};

const cleanPhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10);

interface MyCoursesViewProps {
  user: any;
  allCourses: Course[];
  enrolledCourseIds: string[];
  activeCourseId: string;
  setActiveCourseId: (id: string) => void;
  setEnrolledCourseIds: React.Dispatch<React.SetStateAction<string[]>>;
  progress: Record<string, UserProgress>;
  onImportCourse: (course: Course) => void;
  onSelectTab?: (tab: ActiveTab) => void;
}

export default function MyCoursesView({
  user,
  allCourses,
  enrolledCourseIds,
  activeCourseId,
  setActiveCourseId,
  setEnrolledCourseIds,
  progress,
  onImportCourse,
  onSelectTab
}: MyCoursesViewProps) {
  const [filter, setFilter] = useState<'all' | 'enrolled' | 'locked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Detail popup modal
  const [selectedDetailCourse, setSelectedDetailCourse] = useState<Course | null>(null);

  // Cart States
  const [cart, setCart] = useState<Course[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartCheckoutMode, setIsCartCheckoutMode] = useState(false);

  // Mobile Course Card Expansion State
  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<string, boolean>>({});
  const [activeCourseToast, setActiveCourseToast] = useState<string | null>(null);

  const toggleCourseExpand = (courseId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedCourseIds(prev => ({
      ...prev,
      [courseId]: !prev[courseId]
    }));
  };

  // Payment states
  const [selectedBuyCourse, setSelectedBuyCourse] = useState<Course | null>(null);
  const [bkashSender, setBkashSender] = useState('');
  const [accessEmail, setAccessEmail] = useState(user?.email || '');
  const [trxId, setTrxId] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userWalletBalance, setUserWalletBalance] = useState<number>(0);
  const [showWalletBalance, setShowWalletBalance] = useState<boolean>(true);

  // Wallet Recharge states
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [rechargeSender, setRechargeSender] = useState('');
  const [rechargeEmail, setRechargeEmail] = useState(user?.email || '');
  const [rechargeAmount, setRechargeAmount] = useState<number | string>(50);
  const [rechargeTrx, setRechargeTrx] = useState('');
  const [isSubmittingRecharge, setIsSubmittingRecharge] = useState(false);
  const [rechargeMessage, setRechargeMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (user?.email) {
      setAccessEmail(user.email);
      setRechargeEmail(user.email);
    }
  }, [user]);

  // Listen to wallet balance in real time whenever accessEmail or user changes
  useEffect(() => {
    if ((!accessEmail || !accessEmail.includes('@')) && !user?.email) return;
    const cleanEmail = (accessEmail || user?.email || '').toLowerCase().trim();
    if (!cleanEmail) return;

    let isMounted = true;

    const fetchAndUpdateBalance = async () => {
      let maxBal = 0;

      // 1. Check user_wallets by cleanEmail
      try {
        const walletSnap = await getDoc(doc(db, 'user_wallets', cleanEmail));
        if (walletSnap.exists()) {
          const d = walletSnap.data();
          const b = typeof d?.balance === 'number' ? d.balance : (typeof d?.walletBalance === 'number' ? d.walletBalance : 0);
          if (b > maxBal) maxBal = b;
        }
      } catch (_) {}

      // 2. Check users collection by user.uid if available
      if (user?.uid) {
        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const d = userSnap.data();
            const b = typeof d?.balance === 'number' ? d.balance : (typeof d?.walletBalance === 'number' ? d.walletBalance : 0);
            if (b > maxBal) maxBal = b;
          }
        } catch (_) {}
      }

      // 3. Check users collection by email query as fallback
      try {
        const uQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const uSnap = await getDocs(uQuery);
        if (!uSnap.empty) {
          uSnap.forEach(uDoc => {
            const d = uDoc.data();
            const b = typeof d?.balance === 'number' ? d.balance : (typeof d?.walletBalance === 'number' ? d.walletBalance : 0);
            if (b > maxBal) maxBal = b;
          });
        }
      } catch (_) {}

      if (isMounted) {
        setUserWalletBalance(maxBal);
      }
    };

    fetchAndUpdateBalance();

    // Real-time listener on user_wallets
    const walletRef = doc(db, 'user_wallets', cleanEmail);
    const unsubWallet = onSnapshot(walletRef, () => {
      fetchAndUpdateBalance();
    }, (err) => {
      console.warn("Realtime wallet listener notice:", err);
    });

    // Real-time listener on users document
    let unsubUser: (() => void) | undefined;
    if (user?.uid) {
      const userRef = doc(db, 'users', user.uid);
      unsubUser = onSnapshot(userRef, () => {
        fetchAndUpdateBalance();
      });
    }

    const intervalId = setInterval(fetchAndUpdateBalance, 10000);

    return () => {
      isMounted = false;
      unsubWallet();
      if (unsubUser) unsubUser();
      clearInterval(intervalId);
    };
  }, [accessEmail, user]);

  const toggleCartCourse = (course: Course, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => {
      if (prev.some(c => c.id === course.id)) {
        return prev.filter(c => c.id !== course.id);
      } else {
        return [...prev, course];
      }
    });
  };

  const removeFromCart = (courseId: string) => {
    setCart(prev => prev.filter(c => c.id !== courseId));
  };

  // Free sample usage tracking state
  const [usedFreeSamples, setUsedFreeSamples] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const cleanEmail = (user?.email || accessEmail || '').trim().toLowerCase();
    if (cleanEmail) {
      getDoc(doc(db, 'user_used_samples', cleanEmail)).then((snap) => {
        if (snap.exists()) {
          const remoteData = (snap.data() as any)?.samples || {};
          setUsedFreeSamples(remoteData);
        }
      }).catch(err => console.warn("Error fetching remote free samples:", err));
    }
  }, [user?.email, accessEmail]);

  const isFreeSampleUsed = (courseId: string) => {
    const normId = courseId.trim().toLowerCase();
    return Boolean(usedFreeSamples[normId]);
  };

  const handleOpenFreeSample = async (course: Course, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const normId = course.id.trim().toLowerCase();
    
    // Check if free sample was already used
    if (isFreeSampleUsed(normId)) {
      alert(`আপনি ইতোমধ্যে "${course.title}" কোর্সের ফ্রি স্যাম্পল ফ্ল্যাশকার্ড দেখেছেন। কোর্সটি সম্পূর্ণ পড়তে অনুগ্রহ করে আনলক/ক্রয় করে নিন।`);
      return;
    }

    // Mark as used locally and in DB
    const cleanEmail = (user?.email || accessEmail || '').trim().toLowerCase();
    const storageKey = `vocab_used_free_samples_${cleanEmail || 'guest'}`;
    const updated = { ...usedFreeSamples, [normId]: true };
    setUsedFreeSamples(updated);
    safeSetLocalStorage(storageKey, JSON.stringify(updated));

    if (cleanEmail) {
      try {
        await setDoc(doc(db, 'user_used_samples', cleanEmail), {
          email: cleanEmail,
          samples: updated,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn("Failed to update remote free sample record:", err);
      }
    }

    // Close detail modal if open
    setSelectedDetailCourse(null);

    // Set active course & directly navigate to flashcards tab
    setActiveCourseId(course.id);
    if (onSelectTab) {
      onSelectTab('flashcard');
    }
  };

  const cartTotalPrice = cart.reduce((sum, c) => sum + ((c.price && c.price > 0) ? c.price : 30), 0);

  // Direct Claim with Wallet Balance (no bKash Sender or TrxID required)
  const handleDirectWalletClaim = async () => {
    const cleanEmail = accessEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setCheckoutMessage({ type: 'error', text: 'অনুগ্রহ করে ইমেইল ঠিকানা প্রদান করুন।' });
      return;
    }

    const isCartPurchase = isCartCheckoutMode && cart.length > 0;
    const targetCourses = isCartPurchase ? cart : (selectedBuyCourse ? [selectedBuyCourse] : []);
    if (targetCourses.length === 0) return;

    // Filter out courses that are ALREADY accessible/enrolled
    const unpurchasedCourses = targetCourses.filter(c => !isCourseAccessible(c, enrolledCourseIds, cleanEmail));

    if (unpurchasedCourses.length === 0) {
      // All target courses are already unlocked!
      setCheckoutMessage({
        type: 'success',
        text: 'এই কোর্সটি ইতোমধ্যে আপনার একাউন্টে সফলভাবে আনলক করা রয়েছে! কোনো ব্যালেন্স কাটা হয়নি।'
      });
      // Ensure local enrollment state is updated
      targetCourses.forEach(c => onImportCourse(c));
      return;
    }

    const totalPrice = unpurchasedCourses.reduce((sum, c) => sum + ((c.price && c.price > 0) ? c.price : 30), 0);

    if (userWalletBalance < totalPrice) {
      setCheckoutMessage({ 
        type: 'error', 
        text: `ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই। প্রয়োজনীয়: ৳${totalPrice}, আপনার ব্যালেন্স: ৳${userWalletBalance}` 
      });
      return;
    }

    setIsSubmittingRequest(true);
    setCheckoutMessage(null);

    try {
      const remainingBalance = userWalletBalance - totalPrice;

      // 1. Update wallet balance
      const walletRef = doc(db, 'user_wallets', cleanEmail);
      await setDoc(walletRef, {
        email: cleanEmail,
        balance: remainingBalance,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setUserWalletBalance(remainingBalance);

      // 2. Unlock all unpurchased courses directly
      for (const appCourse of unpurchasedCourses) {
        try {
          const courseRef = doc(db, 'courses', appCourse.id);
          const courseSnap = await getDoc(courseRef);
          if (courseSnap.exists()) {
            const currentAllowed = courseSnap.data().allowedUsers || [];
            if (!currentAllowed.includes(cleanEmail)) {
              await setDoc(courseRef, {
                allowedUsers: [...currentAllowed, cleanEmail]
              }, { merge: true });
            }
          }
        } catch (cWriteErr) {
          console.warn("Course update notice:", cWriteErr);
        }
        onImportCourse(appCourse);
      }

      // Update local enrolledCourseIds state immediately
      const newClaimedIds = unpurchasedCourses.map(c => c.id.trim().toLowerCase());
      setEnrolledCourseIds(prev => {
        const updated = [...prev];
        newClaimedIds.forEach(id => {
          if (!updated.some(existing => existing.trim().toLowerCase() === id)) {
            updated.push(id);
          }
        });
        safeSetLocalStorage('vocab_memorizer_enrolled_courses', JSON.stringify(updated));
        if (user) {
          setDoc(doc(db, 'users', user.uid), { email: user.email, enrolledCourseIds: updated }, { merge: true }).catch(console.error);
        }
        return updated;
      });

      // 3. Save approved access request record for history
      const requestId = `req_wallet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await setDoc(doc(db, 'access_requests', requestId), {
        id: requestId,
        courseId: isCartPurchase ? 'multi_cart' : unpurchasedCourses[0].id,
        courseTitle: isCartPurchase ? `Cart Purchase (${unpurchasedCourses.length} Courses)` : unpurchasedCourses[0].title,
        courseCode: unpurchasedCourses.map(c => c.code || c.id).join(', '),
        courseIds: unpurchasedCourses.map(c => c.id),
        courseTitles: unpurchasedCourses.map(c => c.title),
        bkashNumber: 'WALLET_BALANCE',
        email: cleanEmail,
        trxId: `WALLET_PAY_${Date.now()}`,
        status: 'approved',
        price: unpurchasedCourses[0].price || 30,
        totalPrice,
        createdAt: new Date().toISOString(),
        requestedBy: user?.email || cleanEmail
      });

      setCheckoutMessage({
        type: 'success',
        text: `ওয়ালেট ব্যালেন্স থেকে ৳${totalPrice} দিয়ে কোর্স সফলভাবে আনলক করা হয়েছে! আপনার অবশিষ্ট ওয়ালেট ব্যালেন্স: ৳${remainingBalance} BDT।`
      });

      if (isCartPurchase) setCart([]);

    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Claim Wallet Recharge (bKash Send Money to 01581624202)
  const handleClaimWalletRecharge = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = (rechargeEmail || user?.email || accessEmail || '').trim().toLowerCase();
    const cleanSender = rechargeSender.trim();
    const cleanTrx = rechargeTrx.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setRechargeMessage({ type: 'error', text: 'অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা প্রদান করুন।' });
      return;
    }
    if (!cleanSender || cleanSender.length < 10) {
      setRechargeMessage({ type: 'error', text: 'অনুগ্রহ করে সঠিক বিকাশ সেন্ডার নম্বর প্রদান করুন।' });
      return;
    }
    if (!cleanTrx || cleanTrx.length < 4) {
      setRechargeMessage({ type: 'error', text: 'অনুগ্রহ করে সঠিক ট্রাঞ্জেকশন আইডি (TrxID) প্রদান করুন।' });
      return;
    }

    setIsSubmittingRecharge(true);
    setRechargeMessage(null);

    try {
      let serverHandled = false;

      // 1. Try SERVER-SIDE API verification check first
      try {
        const res = await fetch('/api/verify-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            bkashNumber: cleanSender,
            trxId: cleanTrx
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            serverHandled = true;
            if (data.autoVerified) {
              setUserWalletBalance(data.newBalance || 0);
              const reqId = data.reqId || `req_recharge_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              const nowISO = new Date().toISOString();
              const autoPayload = {
                id: reqId,
                courseId: 'wallet_recharge',
                courseTitle: `Wallet Recharge (৳${data.amountAdded || 50} BDT)`,
                bkashNumber: cleanSender,
                email: cleanEmail,
                trxId: cleanTrx,
                status: 'approved',
                verificationMethod: 'auto',
                spent: true,
                spentAt: nowISO,
                price: data.amountAdded || 50,
                totalPrice: data.amountAdded || 50,
                createdAt: nowISO,
                requestedBy: user?.email || cleanEmail
              };
              try {
                await setDoc(doc(db, 'access_requests', reqId), autoPayload, { merge: true });
              } catch (_) {}
              try {
                await fetch('/api/db/access_requests/doc', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: reqId, data: autoPayload })
                });
              } catch (_) {}

              setRechargeMessage({
                type: 'success',
                text: data.message || `অটো-ভেরিফিকেশন সফল! ৳${data.amountAdded} BDT ওয়ালেটে জমা হয়েছে।`
              });
              setRechargeTrx('');
              return;
            } else {
              // Server registered manual pending request
              const reqId = data.reqId || `req_recharge_manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              const nowISO = new Date().toISOString();
              const manualPayload = {
                id: reqId,
                courseId: 'wallet_recharge',
                courseTitle: `Wallet Recharge Claim`,
                bkashNumber: cleanSender,
                email: cleanEmail,
                trxId: cleanTrx,
                status: 'pending',
                verificationMethod: 'manual',
                spent: false,
                price: 50,
                totalPrice: 50,
                amount: 50,
                createdAt: nowISO,
                requestedBy: user?.email || cleanEmail
              };
              try {
                await setDoc(doc(db, 'access_requests', reqId), manualPayload, { merge: true });
              } catch (_) {}
              try {
                await fetch('/api/db/access_requests/doc', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: reqId, data: manualPayload })
                });
              } catch (_) {}

              setRechargeMessage({
                type: 'info',
                text: data.message || `আপনার ওয়ালেট রিচার্জ রিকুয়েস্ট সফলভাবে জমা হয়েছে। এডমিন প্যানেল থেকে ভেরিফাই করে ব্যালেন্স যোগ করা হবে।`
              });
              setRechargeTrx('');
              return;
            }
          } else if (data.reason) {
            setRechargeMessage({
              type: 'error',
              text: data.reason
            });
            return;
          }
        }
      } catch (serverErr) {
        console.warn('Server endpoint /api/verify-transaction not reached, using direct client handler:', serverErr);
      }

      // 2. Client-side fallback if server was not reachable
      const matchTrx = cleanTrx;
      const matchPhone = cleanPhone(cleanSender);
      const nowISO = new Date().toISOString();

      // Safe check used_transactions (don't fail on permission errors)
      try {
        const usedTxSnap = await getDoc(doc(db, 'used_transactions', matchTrx));
        if (usedTxSnap.exists() && (usedTxSnap.data().spent === true || usedTxSnap.data().status === 'spent')) {
          setRechargeMessage({
            type: 'error',
            text: `এই ট্রাঞ্জেকশন আইডিটি (${rechargeTrx}) ইতোমধ্যে 'spent' বা ব্যবহৃত হিসেবে 'used_transactions'-এ লক্ করা রয়েছে।`
          });
          return;
        }
      } catch (lockErr) {
        console.warn("used_transactions check skipped:", lockErr);
      }

      // Safe check global_verified_payments
      let matchedVp: any = null;
      let matchedVpIndex = -1;
      let allVps: any[] = [];
      try {
        const globalVpSnap = await getDoc(doc(db, 'system_settings', 'global_verified_payments'));
        if (globalVpSnap.exists()) {
          allVps = globalVpSnap.data().verifiedPayments || [];
          if (Array.isArray(allVps)) {
            matchedVpIndex = allVps.findIndex((vp: any) => {
              if (vp.spent || vp.claimed) return false;
              const vpPhone = cleanPhone(vp.bkashNumber || '');
              const vpTrx = (vp.trxId || '').toLowerCase().trim();
              return (vpPhone === matchPhone || (vp.bkashNumber || '').trim() === cleanSender) && vpTrx === matchTrx;
            });
            if (matchedVpIndex !== -1) {
              matchedVp = allVps[matchedVpIndex];
            }
          }
        }
      } catch (vpErr) {
        console.warn("global_verified_payments check skipped:", vpErr);
      }

      if (matchedVp && (matchedVp.claimed || matchedVp.spent)) {
        setRechargeMessage({
          type: 'error',
          text: `এই ট্রাঞ্জেকশন আইডিটি (${rechargeTrx}) ইতোমধ্যে ${matchedVp.claimedBy || 'অন্য এক ইউজার'} ক্লেইম/Spent করে নিয়েছেন।`
        });
        return;
      }

      if (matchedVp) {
        const addAmount = matchedVp.amount && matchedVp.amount > 0 ? matchedVp.amount : 50;
        const walletRef = doc(db, 'user_wallets', cleanEmail);
        let currentBalance = 0;
        try {
          const walletSnap = await getDoc(walletRef);
          currentBalance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;
        } catch (_) {}
        const newBalance = currentBalance + addAmount;

        try {
          await setDoc(doc(db, 'used_transactions', matchTrx), {
            trxId: matchTrx,
            spent: true,
            status: 'spent',
            email: cleanEmail,
            usedBy: cleanEmail,
            bkashNumber: cleanSender,
            amount: addAmount,
            createdAt: nowISO,
            usedAt: nowISO
          }, { merge: true });
        } catch (_) {}

        try {
          await setDoc(walletRef, {
            email: cleanEmail,
            bkashNumber: cleanSender,
            balance: newBalance,
            updatedAt: nowISO
          }, { merge: true });
        } catch (_) {}

        if (matchedVpIndex !== -1 && Array.isArray(allVps)) {
          allVps[matchedVpIndex] = {
            ...matchedVp,
            spent: true,
            claimed: true,
            claimedBy: cleanEmail,
            claimedAt: nowISO,
            spentAt: nowISO
          };
          try {
            await setDoc(doc(db, 'system_settings', 'global_verified_payments'), { verifiedPayments: allVps }, { merge: true });
          } catch (_) {}
        }

        setUserWalletBalance(newBalance);

        const reqId = `req_recharge_auto_${Date.now()}`;
        const autoPayload = {
          id: reqId,
          courseId: 'wallet_recharge',
          courseTitle: `Wallet Recharge (৳${addAmount} BDT)`,
          bkashNumber: cleanSender,
          email: cleanEmail,
          trxId: cleanTrx,
          status: 'approved',
          verificationMethod: 'auto',
          spent: true,
          spentAt: nowISO,
          price: addAmount,
          totalPrice: addAmount,
          createdAt: nowISO,
          requestedBy: user?.email || cleanEmail
        };

        try {
          await setDoc(doc(db, 'access_requests', reqId), autoPayload, { merge: true });
        } catch (_) {}
        try {
          await fetch('/api/db/access_requests/doc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: reqId, data: autoPayload })
          });
        } catch (_) {}

        setRechargeMessage({
          type: 'success',
          text: `অটো-ভেরিফিকেশন সফল! এডমিনের ভেরিফাইড পেমেন্ট থেকে ৳${addAmount} BDT সরাসরি আপনার ওয়ালেটে জমা হয়েছে এবং ট্রাঞ্জেকশনটি 'Spent' হিসেবে চিহ্নিত হয়েছে। বর্তমান ব্যালেন্স: ৳${newBalance}`
        });
        setRechargeTrx('');
      } else {
        // Submit manual recharge request to Firestore and Server API
        const reqId = `req_recharge_manual_${Date.now()}`;
        const manualPayload = {
          id: reqId,
          courseId: 'wallet_recharge',
          courseTitle: `Wallet Recharge Claim`,
          bkashNumber: cleanSender,
          email: cleanEmail,
          trxId: cleanTrx,
          status: 'pending',
          verificationMethod: 'manual',
          spent: false,
          price: 50,
          totalPrice: 50,
          amount: 50,
          createdAt: nowISO,
          requestedBy: user?.email || cleanEmail
        };

        let saved = false;
        try {
          await setDoc(doc(db, 'access_requests', reqId), manualPayload, { merge: true });
          saved = true;
        } catch (fErr) {
          console.warn("Direct Firestore access_requests write skipped/failed:", fErr);
        }

        try {
          const apiRes = await fetch('/api/db/access_requests/doc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: reqId, data: manualPayload })
          });
          if (apiRes.ok) saved = true;
        } catch (apiErr) {
          console.warn("Backend API sync notice:", apiErr);
        }

        setRechargeMessage({
          type: 'info',
          text: `আপনার ওয়ালেট রিচার্জ রিকুয়েস্ট সফলভাবে জমা হয়েছে। এডমিন প্যানেল থেকে ভেরিফাই করে দ্রুত আপনার ওয়ালেটে ব্যালেন্স যোগ করা হবে, অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।`
        });
        setRechargeTrx('');
      }
    } catch (err: any) {
      console.error('Error during wallet recharge claim:', err);
      // Even if unexpected error occurs, submit request safely
      const reqId = `req_recharge_fallback_${Date.now()}`;
      const nowISO = new Date().toISOString();
      const fallbackPayload = {
        id: reqId,
        courseId: 'wallet_recharge',
        courseTitle: `Wallet Recharge Claim`,
        bkashNumber: cleanSender,
        email: cleanEmail,
        trxId: cleanTrx,
        status: 'pending',
        verificationMethod: 'manual',
        spent: false,
        price: 50,
        totalPrice: 50,
        createdAt: nowISO,
        requestedBy: user?.email || cleanEmail
      };
      try {
        await setDoc(doc(db, 'access_requests', reqId), fallbackPayload, { merge: true });
      } catch (_) {}
      try {
        await fetch('/api/db/access_requests/doc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: reqId, data: fallbackPayload })
        });
      } catch (_) {}

      setRechargeMessage({
        type: 'info',
        text: `আপনার ওয়ালেট রিচার্জ রিকুয়েস্ট সফলভাবে জমা হয়েছে। এডমিন প্যানেল থেকে ভেরিফাই করে ব্যালেন্স যোগ করা হবে।`
      });
      setRechargeTrx('');
    } finally {
      setIsSubmittingRecharge(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isCartPurchase = isCartCheckoutMode && cart.length > 0;
    const targetCourses = isCartPurchase ? cart : (selectedBuyCourse ? [selectedBuyCourse] : []);

    if (targetCourses.length === 0) return;

    const cleanSender = bkashSender.trim();
    const cleanEmail = accessEmail.trim();
    const cleanTrx = trxId.trim();

    if (!cleanSender || !cleanEmail || !cleanTrx) {
      setCheckoutMessage({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    setIsSubmittingRequest(true);
    setCheckoutMessage(null);

    try {
      const cleanPhone = (p: string) => p.replace(/\D/g, '').slice(-10);
      const matchTrx = cleanTrx.toLowerCase().trim();
      const matchPhone = cleanPhone(cleanSender);

      // --- USED_TRANSACTIONS LOCK CHECK ---
      try {
        const usedTxSnap = await getDoc(doc(db, 'used_transactions', matchTrx));
        if (usedTxSnap.exists()) {
          const usedData = usedTxSnap.data();
          if (usedData.spent === true || usedData.status === 'spent') {
            setIsSubmittingRequest(false);
            setCheckoutMessage({
              type: 'error',
              text: `এই ট্রাঞ্জেকশন আইডিটি (${cleanTrx}) ইতোমধ্যে 'spent' বা ব্যবহৃত হিসেবে 'used_transactions'-এ লক্ করা রয়েছে।`
            });
            return;
          }
        }
      } catch (lockErr) {
        console.warn("used_transactions lock check notice:", lockErr);
      }

      // --- TRANSACTION ID UNIQUENESS CHECK ---
      try {
        const requestsSnap = await getDocs(query(collection(db, 'access_requests')));
        const existingWithTrx = requestsSnap.docs.find(d => {
          const reqData = d.data();
          const reqTrx = reqData.trxId ? String(reqData.trxId).toLowerCase().trim() : '';
          if (reqTrx === matchTrx) {
            return reqData.spent === true || reqData.status === 'approved' || reqData.status === 'pending' || reqData.verificationMethod === 'auto';
          }
          return false;
        });

        if (existingWithTrx) {
          setIsSubmittingRequest(false);
          setCheckoutMessage({
            type: 'error',
            text: `এই ট্রাঞ্জেকশন আইডিটি (${cleanTrx}) ইতোমধ্যে একবার সিস্টেমে ব্যবহার বা ক্লেইম করা হয়েছে। একই ট্রাঞ্জেকশন নম্বর দিয়ে একাধিকবার রিকুয়েস্ট করা সম্ভব নয়।`
          });
          return;
        }
      } catch (trxCheckErr) {
        console.warn("Trx ID check notice:", trxCheckErr);
      }

      const courseIds = targetCourses.map(c => c.id);
      const courseTitles = targetCourses.map(c => c.title);
      const courseCodes = targetCourses.map(c => c.code || c.id);
      const totalPrice = targetCourses.reduce((sum, c) => sum + ((c.price && c.price > 0) ? c.price : 30), 0);

      // --- BKASH AUTO-VERIFICATION GATEWAY & WALLET ALLOCATION ---
      let existingWalletBalance = 0;
      let walletRef = doc(db, 'user_wallets', cleanEmail.toLowerCase());
      try {
        let walletSnap = await getDoc(walletRef);
        existingWalletBalance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;
      } catch (wReadErr) {
        console.warn("Wallet read notice:", wReadErr);
      }

      // 1. Fetch global verified payments from central system_settings
      let globalVps: any[] = [];
      try {
        const globalVpSnap = await getDoc(doc(db, 'system_settings', 'global_verified_payments'));
        if (globalVpSnap.exists()) {
          globalVps = globalVpSnap.data().verifiedPayments || [];
        }
      } catch (err) {
        console.warn("Global verified payments check notice:", err);
      }

      // Find matching UNCLAIMED/UNSPENT verified payment entry
      let matchedVp: any = null;
      let matchedVpIndex = -1;
      
      if (Array.isArray(globalVps)) {
        matchedVpIndex = globalVps.findIndex((vp: any) => {
          if (vp.spent || vp.claimed) return false;
          const vpPhone = cleanPhone(vp.bkashNumber || '');
          const vpTrx = (vp.trxId || '').toLowerCase().trim();
          return (vpPhone === matchPhone || (vp.bkashNumber || '').trim() === cleanSender) && vpTrx === matchTrx;
        });
        if (matchedVpIndex !== -1) {
          matchedVp = globalVps[matchedVpIndex];
        }
      }

      if (!matchedVp) {
        // Fallback to course-level legacy verified payments
        for (const course of allCourses) {
          if (course.verifiedPayments && course.verifiedPayments.length > 0) {
            const found = course.verifiedPayments.find((vp: any) => {
              if (vp.spent || vp.claimed) return false;
              const vpPhone = cleanPhone(vp.bkashNumber || '');
              const vpTrx = (vp.trxId || '').toLowerCase().trim();
              return (vpPhone === matchPhone || (vp.bkashNumber || '').trim() === cleanSender) && vpTrx === matchTrx;
            });
            if (found) {
              matchedVp = found;
              break;
            }
          }
        }
      }

      // MARK VERIFIED PAYMENT AS SPENT/CLAIMED IMMEDIATELY IN FIRESTORE & LOCK IN used_transactions
      if (matchedVp) {
        const nowISO = new Date().toISOString();
        try {
          await setDoc(doc(db, 'used_transactions', matchTrx), {
            trxId: matchTrx,
            spent: true,
            status: 'spent',
            email: cleanEmail.toLowerCase(),
            usedBy: cleanEmail.toLowerCase(),
            bkashNumber: cleanSender,
            amount: matchedVp.amount || 30,
            createdAt: nowISO,
            usedAt: nowISO
          }, { merge: true });
        } catch (lockWriteErr) {
          console.warn("Failed to lock in used_transactions:", lockWriteErr);
        }
      }

      if (matchedVp && matchedVpIndex !== -1 && Array.isArray(globalVps)) {
        const nowISO = new Date().toISOString();
        globalVps[matchedVpIndex] = {
          ...matchedVp,
          spent: true,
          claimed: true,
          claimedBy: cleanEmail.toLowerCase(),
          claimedAt: nowISO,
          spentAt: nowISO
        };
        try {
          await setDoc(doc(db, 'system_settings', 'global_verified_payments'), { verifiedPayments: globalVps }, { merge: true });
        } catch (vpUpdateErr) {
          console.warn("Failed to mark VP as spent in global_verified_payments:", vpUpdateErr);
        }
      }

      let totalFundsAvailable = existingWalletBalance + (matchedVp ? (matchedVp.amount || 30) : 0);
      let approvedCourses: Course[] = [];
      let pendingCourses: Course[] = [];
      let remainingBalance = totalFundsAvailable;

      if (matchedVp || existingWalletBalance > 0) {
        for (const c of targetCourses) {
          const cPrice = (c.price && c.price > 0) ? c.price : 30;
          if (remainingBalance >= cPrice) {
            approvedCourses.push(c);
            remainingBalance -= cPrice;
          } else {
            pendingCourses.push(c);
          }
        }
      }

      // Save remaining wallet balance
      if (matchedVp || existingWalletBalance > 0) {
        try {
          await setDoc(walletRef, {
            email: cleanEmail.toLowerCase(),
            bkashNumber: cleanSender,
            balance: remainingBalance,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          setUserWalletBalance(remainingBalance);
        } catch (wWriteErr) {
          console.warn("Wallet write notice:", wWriteErr);
        }
      }

      // Automatically activate approved courses
      if (approvedCourses.length > 0) {
        const newlyApprovedIds = approvedCourses.map(c => c.id.trim().toLowerCase());
        setEnrolledCourseIds(prev => {
          const updated = [...prev];
          newlyApprovedIds.forEach(id => {
            if (!updated.some(existing => existing.trim().toLowerCase() === id)) {
              updated.push(id);
            }
          });
          safeSetLocalStorage('vocab_memorizer_enrolled_courses', JSON.stringify(updated));
          if (user) {
            setDoc(doc(db, 'users', user.uid), { email: user.email, enrolledCourseIds: updated }, { merge: true }).catch(console.error);
          }
          return updated;
        });

        for (const appCourse of approvedCourses) {
          try {
            const courseRef = doc(db, 'courses', appCourse.id);
            const courseSnap = await getDoc(courseRef);
            if (courseSnap.exists()) {
              const currentAllowed = courseSnap.data().allowedUsers || [];
              if (!currentAllowed.includes(cleanEmail.toLowerCase())) {
                await setDoc(courseRef, {
                  allowedUsers: [...currentAllowed, cleanEmail.toLowerCase()]
                }, { merge: true });
              }
            }
          } catch (cWriteErr) {
            console.warn("Course update notice:", cWriteErr);
          }
          onImportCourse(appCourse);
        }
      }

      const isFullyApproved = approvedCourses.length === targetCourses.length;
      const isPartiallyApproved = approvedCourses.length > 0 && !isFullyApproved;

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const requestPayload = {
        id: requestId,
        courseId: isCartPurchase ? 'multi_cart' : targetCourses[0].id,
        courseTitle: isCartPurchase ? `Cart Purchase (${targetCourses.length} Courses)` : targetCourses[0].title,
        courseCode: courseCodes.join(', '),
        courseIds,
        courseTitles,
        bkashNumber: cleanSender,
        email: cleanEmail.toLowerCase(),
        trxId: cleanTrx,
        status: isFullyApproved ? 'approved' : (isPartiallyApproved ? 'approved' : 'pending'),
        verificationMethod: matchedVp ? 'auto' : (existingWalletBalance > 0 ? 'wallet_balance' : 'manual'),
        spent: matchedVp ? true : false,
        spentAt: matchedVp ? new Date().toISOString() : undefined,
        price: targetCourses[0].price || 30,
        totalPrice,
        createdAt: new Date().toISOString(),
        requestedBy: user?.email || 'anonymous'
      };

      try {
        await setDoc(doc(db, 'access_requests', requestId), requestPayload, { merge: true });
      } catch (fErr) {
        console.warn("Firestore access_requests write notice:", fErr);
      }
      try {
        await fetch('/api/db/access_requests/doc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: requestId, data: requestPayload })
        });
      } catch (_) {}

      if (isFullyApproved) {
        setCheckoutMessage({
          type: 'success',
          text: `পেমেন্ট সফলভাবে ভেরিফাই করা হয়েছে! আপনার ${targetCourses.length}টি কোর্সে অ্যাক্সেস দেওয়া হয়েছে। ${remainingBalance > 0 ? `অবশিষ্ট ৳${remainingBalance} টাকা আপনার ওয়ালেটে জমা রাখা হয়েছে।` : ''}`
        });
        if (isCartPurchase) setCart([]);
      } else if (isPartiallyApproved) {
        setCheckoutMessage({
          type: 'success',
          text: `প্রাপ্ত টাকার হিসাব অনুযায়ী ${approvedCourses.length}টি কোর্স বরাদ্দ দেওয়া হয়েছে (${approvedCourses.map(c => c.title).join(', ')})। অবশিষ্ট ৳${remainingBalance} টাকা ওয়ালেটে জমা রাখা রয়েছে।`
        });
        if (isCartPurchase) setCart([]);
      } else {
        setCheckoutMessage({
          type: 'success',
          text: isCartPurchase 
            ? `Access request for ${targetCourses.length} courses (Total ৳${totalPrice} BDT) submitted with Course Code(s): ${courseCodes.join(', ')}! Admin will verify and activate all courses shortly.`
            : `Access request submitted successfully for Course Code: ${courseCodes.join(', ')}! Admin will verify and activate your course access shortly.`
        });
        if (isCartPurchase) setCart([]);
      }
    } catch (err: any) {
      console.error("Error submitting access request:", err);
      setCheckoutMessage({
        type: "error",
        text: err?.message ? `ত্রুটি: ${err.message}` : "Error submitting request. Please try again."
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleFreeEnroll = (course: Course) => {
    setEnrolledCourseIds(prev => {
      if (!prev.some(id => id.trim().toLowerCase() === course.id.trim().toLowerCase())) {
        return [...prev, course.id];
      }
      return prev;
    });
    setActiveCourseId(course.id);
  };

  const adminEmails = ['mohammad.001ekram@gmail.com'];
  const isAdminUser = user?.email && adminEmails.includes(user.email.trim().toLowerCase());

  // Filter courses based on selections & admin hidden flag
  const matchingSearchCourses = allCourses.filter(c => {
    if (c.hidden && !isAdminUser) {
      return false;
    }
    return c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           c.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const enrolledCoursesList = matchingSearchCourses.filter(c => {
    const normId = c.id.trim().toLowerCase();
    const isActive = normId === activeCourseId?.trim().toLowerCase();
    const isEnrolled = isCourseEnrolled(c.id, enrolledCourseIds);
    const isAccessible = isCourseAccessible(c, enrolledCourseIds, user?.email);
    return isActive || isEnrolled || isAccessible;
  });

  const enrolledCourseIdSet = new Set(enrolledCoursesList.map(c => c.id.trim().toLowerCase()));
  const lockedCoursesList = matchingSearchCourses.filter(c => !enrolledCourseIdSet.has(c.id.trim().toLowerCase()));

  // Sort enrolled courses so active course is ALWAYS FIRST at the top position
  const activeCourseObj = enrolledCoursesList.find(c => c.id.trim().toLowerCase() === activeCourseId?.trim().toLowerCase());
  const otherEnrolledCourses = enrolledCoursesList.filter(c => c.id.trim().toLowerCase() !== activeCourseId?.trim().toLowerCase());
  const sortedEnrolledCourses = activeCourseObj ? [activeCourseObj, ...otherEnrolledCourses] : enrolledCoursesList;

  const renderCourseCard = (course: Course) => {
    const isActive = course.id.trim().toLowerCase() === activeCourseId?.trim().toLowerCase();
    const isUserAllowed = isCourseAccessible(course, enrolledCourseIds, user?.email) || isActive;
    const wordsCount = course.words?.length || 0;

    const courseWords = course.words || [];
    const masteredCount = courseWords.filter(w => progress[w.id]?.status === 'know').length;
    const progressPercent = wordsCount > 0 ? Math.round((masteredCount / wordsCount) * 100) : 0;

    const isExpanded = !!expandedCourseIds[course.id];

    // Enabled Practice & Study Tools Lists for Includes
    const enabledPracticeList = [
      { key: 'quiz', label: 'MCQ Quiz', enabled: course.enabledGames?.quiz !== false },
      { key: 'match', label: 'Word Match', enabled: course.enabledGames?.match !== false },
      { key: 'word_search', label: 'Word Search', enabled: course.enabledGames?.word_search !== false },
      { key: 'synonym', label: 'Synonym Check', enabled: course.enabledGames?.synonym !== false },
      { key: 'blank', label: 'Blank Filling', enabled: course.enabledGames?.blank !== false },
      { key: 'odd_one_out', label: 'Odd One Out', enabled: course.enabledGames?.odd_one_out !== false },
      { key: 'analogy', label: 'Word Analogy', enabled: course.enabledGames?.analogy !== false },
    ].filter(i => i.enabled).map(i => i.label);

    const enabledStudyList = [
      { key: 'lists', label: 'Bookmark & Lists', enabled: true },
      { key: 'dictionary', label: 'Dictionary', enabled: true },
      { key: 'planner', label: 'Daily Planner', enabled: true },
      { key: 'story', label: 'Read Story', enabled: course.enabledGames?.story !== false },
    ].filter(i => i.enabled).map(i => i.label);

    return (
      <motion.div
        key={course.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => {
          incrementCourseClickCount(course.id);
          if (isUserAllowed) {
            setActiveCourseId(course.id);
            setActiveCourseToast(`Activated "${course.title}" course!`);
            setTimeout(() => setActiveCourseToast(null), 2500);
          } else {
            setSelectedDetailCourse(course);
          }
        }}
        className={`group relative transition-all duration-300 flex flex-row items-center justify-between p-2.5 sm:p-3.5 px-3 sm:px-4 rounded-2xl sm:rounded-3xl gap-2.5 sm:gap-4 overflow-hidden cursor-pointer ${
          isActive 
            ? 'bg-gradient-to-r from-[#3C7B58] via-[#32694a] to-[#28573d] text-white shadow-md shadow-[#3C7B58]/15 hover:brightness-105' 
            : isUserAllowed
            ? 'bg-gradient-to-r from-[#704261] via-[#603551] to-[#502942] text-white shadow-md shadow-[#704261]/15 hover:brightness-105'
            : 'bg-gradient-to-r from-[#EF5426] via-[#e24415] to-[#ce3508] text-white shadow-md shadow-[#EF5426]/15 hover:brightness-105 ring-2 ring-orange-400/30'
        }`}
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {/* Left Side: Badge Box (30 Tk) */}
        <div className={`w-12 sm:w-16 h-12 sm:h-16 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-xs text-center font-poppins px-1 ${
          isActive 
            ? 'bg-[#E3F297] text-[#24422A]' 
            : isUserAllowed 
            ? 'bg-[#F7C6D7] text-[#542B47]' 
            : 'bg-[#F8F299] text-[#7E2809]'
        }`}>
          <div className="flex items-baseline justify-center gap-0.5 font-poppins leading-none">
            <span className="text-xl sm:text-2xl font-black tracking-tight leading-none">
              {(course.price !== undefined && course.price >= 0) ? course.price : 30}
            </span>
            <span className="text-[9px] sm:text-[10px] font-black uppercase leading-none">
              TK
            </span>
          </div>
        </div>

        {/* Middle Side: Course Info & Title */}
        <div className="flex-1 min-w-0 space-y-0.5 font-poppins">
          <h3 
            onClick={(e) => {
              if (!isUserAllowed) {
                e.stopPropagation();
                setSelectedDetailCourse(course);
              }
            }}
            className={`text-sm sm:text-base font-extrabold text-white leading-tight font-poppins truncate max-w-[180px] sm:max-w-md ${
              !isUserAllowed ? 'hover:underline cursor-pointer flex items-center gap-1' : ''
            }`} 
            title={course.title}
          >
            <span>{course.title}</span>
            {!isUserAllowed && (
              <Eye className="w-3.5 h-3.5 text-amber-200 shrink-0 inline ml-1 opacity-90" />
            )}
          </h3>

          <div className="text-[11px] sm:text-xs font-bold text-white/95 font-poppins leading-none">
            Total {wordsCount} Words
          </div>

          <div className="text-[9px] sm:text-[10px] font-medium text-white/80 font-poppins tracking-tight truncate flex items-center gap-1.5">
            <span>Flashcard-PDF-Story-Games</span>
            {!isUserAllowed && (
              <span className="bg-amber-300/30 text-amber-100 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0 border border-amber-300/30">
                Click Preview
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Divider Line & Action Button */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 self-center">
          <div className="h-8 sm:h-10 w-[1.5px] bg-white/25 shrink-0" />

          {isActive ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCourseId(course.id);
                if (onSelectTab) onSelectTab('flashcard');
              }}
              className="font-black italic text-[11px] sm:text-xs text-white tracking-wider hover:scale-105 active:scale-95 transition cursor-pointer shrink-0 uppercase px-0.5 py-1"
            >
              STUDY NOW
            </button>
          ) : isUserAllowed ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCourseId(course.id);
                setActiveCourseToast(`Activated "${course.title}" course!`);
                setTimeout(() => setActiveCourseToast(null), 2500);
              }}
              className="font-black italic text-[11px] sm:text-xs text-white tracking-wider hover:scale-105 active:scale-95 transition cursor-pointer shrink-0 uppercase px-0.5 py-1"
            >
              SET ACTIVE
            </button>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCartCheckoutMode(false);
                  setSelectedBuyCourse(course);
                }}
                className="font-black italic text-[11px] sm:text-xs text-white tracking-wider hover:scale-105 active:scale-95 transition cursor-pointer shrink-0 uppercase px-0.5 py-1"
              >
                BUY NOW
              </button>
              <button
                type="button"
                onClick={(e) => toggleCartCourse(course, e)}
                className={`p-1 rounded-md text-xs font-bold transition ${
                  cart.some(c => c.id === course.id)
                    ? 'bg-white text-orange-600'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title={cart.some(c => c.id === course.id) ? "Remove from Cart" : "Add to Cart"}
              >
                <ShoppingBag className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto" id="my-courses-view-root" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* Active Course Feedback Toast */}
      <AnimatePresence>
        {activeCourseToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-900 text-white px-4 py-2 rounded-full shadow-2xl border border-emerald-400/50 flex items-center gap-2 text-xs font-bold font-poppins"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{activeCourseToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account Balance Wallet Card */}
      <div className="flex justify-start sm:justify-start font-poppins">
        <div className="bg-gradient-to-r from-[#5C53E4] via-[#675DE8] to-[#7B71F3] rounded-[24px] p-5 sm:p-6 text-white shadow-md flex items-center justify-between max-w-md w-full font-poppins">
          
          <div className="space-y-1">
            <div className="text-xs sm:text-sm font-semibold text-white/95 font-poppins">
              Account Balance
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black italic tracking-tight text-white font-poppins">
                {showWalletBalance ? userWalletBalance.toLocaleString('en-BD') : '••••'}
              </span>
              <span className="text-base sm:text-lg font-black italic text-white/95 font-poppins">
                Tk
              </span>

              <button
                type="button"
                onClick={() => setShowWalletBalance(!showWalletBalance)}
                className="ml-2.5 text-white/70 hover:text-white transition cursor-pointer p-0.5 inline-flex items-center"
                title={showWalletBalance ? "Hide Balance" : "Show Balance"}
              >
                {showWalletBalance ? (
                  <Eye className="w-4 h-4 text-white/80" />
                ) : (
                  <EyeOff className="w-4 h-4 text-white/80" />
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsRechargeModalOpen(true);
              setRechargeMessage(null);
            }}
            className="bg-[#2B2251] hover:bg-[#211942] active:scale-95 text-white font-extrabold text-xs sm:text-sm px-6 py-2.5 rounded-2xl shadow-md transition cursor-pointer font-poppins shrink-0"
          >
            Recharge
          </button>

        </div>
      </div>

      {/* Zero Enrolled Course Prompt Banner */}
      {enrolledCourseIds.length === 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-indigo-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-amber-200 flex items-start gap-3.5 shadow-md font-poppins">
          <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-amber-300">
              স্বাগতম! আপনি এখনও কোনো কোর্সে ইনরোল করেননি।
            </h3>
            <p className="text-[11px] sm:text-xs text-amber-100/90 font-medium leading-relaxed">
              পড়াশোনা শুরু করতে নিচের ক্যাটালগ থেকে আপনার পছন্দসই কোর্সে ইনরোল অথবা ক্রয় (Unlock Course) করে নিন।
            </p>
          </div>
        </div>
      )}

      {/* 3. Multi-Layer Course Cards Layout matching Screenshot */}
      <div className="space-y-6" id="courses-grid-container">
        
        {/* Top Active Course Card (Green) */}
        {activeCourseObj && (
          <div className="space-y-3" id="active-course-section">
            {renderCourseCard(activeCourseObj)}
          </div>
        )}

        {/* Middle Enrolled Courses Section (Purple) */}
        {otherEnrolledCourses.length > 0 && (
          <div className="space-y-3" id="enrolled-courses-section">
            <div className="flex justify-center my-3">
              <span className="bg-[#784968] text-white font-extrabold text-xs px-6 py-1.5 rounded-full shadow-xs border border-white/20 tracking-wide font-poppins">
                Enrolled Courses
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {otherEnrolledCourses.map(course => renderCourseCard(course))}
            </div>
          </div>
        )}

        {/* Bottom Buy New Course Section (Orange) */}
        {lockedCoursesList.length > 0 && (
          <div className="space-y-3" id="locked-courses-section">
            <div className="flex justify-center my-5">
              <span className="bg-[#EF5826] text-white font-extrabold text-xs px-7 py-2 rounded-full shadow-xs border border-white/20 tracking-wide font-poppins uppercase">
                Buy New Course
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {lockedCoursesList.map(course => renderCourseCard(course))}
            </div>
          </div>
        )}

      </div>

      {/* Global Empty State */}
      {sortedEnrolledCourses.length === 0 && lockedCoursesList.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4 shadow-xs">
          <div className="p-4 bg-indigo-50 text-indigo-500 rounded-full w-fit mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">No courses found</h3>
            <p className="text-xs text-slate-500 mt-1">Try changing your search keywords or filter options.</p>
          </div>
        </div>
      )}

      {/* 4. Large Course Preview Modal */}
      <AnimatePresence>
        {selectedDetailCourse && (() => {
          const course = selectedDetailCourse;
          const isActive = course.id.trim().toLowerCase() === activeCourseId?.trim().toLowerCase();
          const isEnrolled = isCourseEnrolled(course.id, enrolledCourseIds);
          const isUserAllowed = isCourseAccessible(course, enrolledCourseIds, user?.email);
          const sampleUsed = isFreeSampleUsed(course.id);

          return (
            <CoursePreviewModal
              key={course.id}
              course={course}
              isOpen={Boolean(selectedDetailCourse)}
              onClose={() => setSelectedDetailCourse(null)}
              isEnrolled={isEnrolled}
              isUserAllowed={isUserAllowed}
              isActive={isActive}
              progress={progress}
              sampleUsed={sampleUsed}
              onStartFlashcards={() => {
                if (!isEnrolled) {
                  handleFreeEnroll(course);
                }
                setActiveCourseId(course.id);
                if (onSelectTab) {
                  onSelectTab('flashcard');
                }
                setSelectedDetailCourse(null);
              }}
              onBuyCourse={() => {
                setSelectedDetailCourse(null);
                setSelectedBuyCourse(course);
              }}
              onFreeEnroll={() => {
                handleFreeEnroll(course);
              }}
              onOpenFreeSample={() => {
                handleOpenFreeSample(course);
              }}
              onSetActive={() => {
                if (!isEnrolled) {
                  handleFreeEnroll(course);
                } else {
                  setActiveCourseId(course.id);
                }
                setSelectedDetailCourse(null);
              }}
            />
          );
        })()}
      </AnimatePresence>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 bg-slate-900 text-white p-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border border-indigo-500/30 flex items-center gap-4 transition hover:scale-102">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="w-5 h-5 text-indigo-400" />
              <span className="absolute -top-2 -right-2 bg-pink-600 text-white font-black text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-slate-900">
                {cart.length}
              </span>
            </div>
            <div>
              <span className="text-xs font-black block">{cart.length} Course{cart.length > 1 ? 's' : ''} in Cart</span>
              <span className="text-[10px] text-indigo-300 font-bold font-mono">Total: ৳{cartTotalPrice} BDT</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm"
          >
            View Cart
          </button>
        </div>
      )}

      {/* Cart Drawer / Modal */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col border border-slate-100"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-extrabold text-slate-900 text-base">Course Shopping Cart ({cart.length})</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cart Items List */}
              <div className="p-5 overflow-y-auto space-y-3 flex-1">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 space-y-2">
                    <ShoppingBag className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold">Your cart is empty.</p>
                  </div>
                ) : (
                  cart.map((item, index) => {
                    const price = (item.price && item.price > 0) ? item.price : 30;
                    return (
                      <div key={item.id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-mono text-indigo-600 font-extrabold block">Course #{index + 1}</span>
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">{item.title}</h4>
                          <span className="text-[11px] font-bold text-slate-500 font-mono">৳{price} BDT</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200/60 rounded-xl transition cursor-pointer"
                          title="Remove course from cart"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-slate-150 bg-slate-50/80 space-y-3">
                  <div className="flex items-center justify-between text-sm font-extrabold text-slate-900 px-1">
                    <span>Total Bundle Amount:</span>
                    <span className="text-indigo-600 font-black font-mono text-base">৳{cartTotalPrice} BDT</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Clear Cart
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCartCheckoutMode(true);
                        setIsCartOpen(false);
                      }}
                      className="py-2.5 px-3 bg-pink-600 hover:bg-pink-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md shadow-pink-600/10 flex items-center justify-center gap-1.5"
                    >
                      <span>Checkout ({cart.length})</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Course Purchase Modal (Wallet Balance Required) */}
      <AnimatePresence>
        {(selectedBuyCourse || (isCartCheckoutMode && cart.length > 0)) && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="course-hub-bkash-modal">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl relative max-h-[90vh] flex flex-col border border-slate-200"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}
            >
              {/* Minimal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <div>
                  <h3 className="font-light text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                    <span className="font-extrabold text-emerald-600 text-xs">Wallet</span> Purchase
                  </h3>
                  <p className="text-[11px] text-slate-400 font-light truncate max-w-[220px]">
                    {isCartCheckoutMode && cart.length > 0
                      ? `${cart.length} Courses Bundle`
                      : selectedBuyCourse?.title}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedBuyCourse(null);
                    setIsCartCheckoutMode(false);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-700">
                {/* Cart / Single Course Summary */}
                {isCartCheckoutMode && cart.length > 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs font-light">
                    <div className="flex justify-between font-normal text-slate-800 pb-1 border-b border-slate-200/60 text-[11px]">
                      <span>Selected Items:</span>
                      <span className="font-mono">৳{cartTotalPrice} BDT</span>
                    </div>
                    <div className="space-y-0.5 max-h-24 overflow-y-auto pt-0.5 text-[11px] text-slate-500">
                      {cart.map((c, idx) => (
                        <div key={c.id} className="flex justify-between truncate">
                          <span className="truncate pr-1">{idx + 1}. {c.title}</span>
                          <span className="font-mono shrink-0">৳{(c.price && c.price > 0) ? c.price : 30}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs font-light">
                    <span className="font-normal text-slate-800 truncate pr-2">{selectedBuyCourse?.title}</span>
                    <span className="font-mono font-normal text-emerald-700 shrink-0">
                      ৳{(selectedBuyCourse?.price && selectedBuyCourse.price > 0) ? selectedBuyCourse.price : 30} BDT
                    </span>
                  </div>
                )}

                {checkoutMessage && (
                  <div className={`p-3 rounded-xl text-xs font-light leading-snug flex items-start gap-2 ${
                    checkoutMessage.type === 'success' 
                      ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' 
                      : 'bg-rose-50 border border-rose-100 text-rose-800'
                  }`}>
                    {checkoutMessage.type === 'success' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
                    )}
                    <span>{checkoutMessage.text}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-light text-slate-500 block">
                    ইমেইল অ্যাড্রেস <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                    placeholder="student@gmail.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-emerald-400 outline-none text-xs font-light transition text-slate-800"
                  />
                </div>

                {/* Wallet Balance Check */}
                {(() => {
                  const targetCourses = isCartCheckoutMode && cart.length > 0 ? cart : (selectedBuyCourse ? [selectedBuyCourse] : []);
                  const cleanEmail = accessEmail.trim().toLowerCase();
                  const isAlreadyUnlocked = targetCourses.length > 0 && targetCourses.every(c => isCourseAccessible(c, enrolledCourseIds, cleanEmail));
                  const requiredPrice = isCartCheckoutMode && cart.length > 0 
                    ? cartTotalPrice 
                    : ((selectedBuyCourse?.price && selectedBuyCourse.price > 0) ? selectedBuyCourse.price : 30);
                  const hasEnoughBalance = userWalletBalance >= requiredPrice;

                  if (isAlreadyUnlocked || checkoutMessage?.type === 'success') {
                    return (
                      <div className="space-y-3 pt-1 font-sans">
                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-1">
                          <p className="text-xs font-bold flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>কোর্সটি ইতোমধ্যে আপনার একাউন্টে সফলভাবে আনলক করা রয়েছে!</span>
                          </p>
                          <p className="text-[11px] text-emerald-700 font-medium">
                            আপনার ওয়ালেট থেকে কোনো অতিরিক্ত টাকা কাটা হবে না। সরাসরি স্টাডি অপশনে ক্লিক করে পড়াশোনা শুরু করুন।
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (targetCourses.length > 0) {
                              setActiveCourseId(targetCourses[0].id);
                              if (onSelectTab) {
                                onSelectTab('flashcard');
                              }
                            }
                            setSelectedBuyCourse(null);
                            setIsCartCheckoutMode(false);
                          }}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4 fill-current text-amber-300" />
                          <span>কোর্সটিতে ঢুকুন (Start Studying)</span>
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3 pt-1">
                      <div className={`p-3.5 rounded-xl border space-y-1.5 ${
                        hasEnoughBalance 
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                          : 'bg-amber-50/80 border-amber-200 text-amber-900'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-light">
                          <span>বর্তমান ওয়ালেট ব্যালেন্স:</span>
                          <span className="font-mono font-normal text-sm text-emerald-700">৳{userWalletBalance} BDT</span>
                        </div>
                        
                        {!hasEnoughBalance ? (
                          <p className="text-[11px] text-amber-800 font-light leading-relaxed border-t border-amber-200/60 pt-1.5">
                            ⚠️ ওয়ালেটে পর্যাপ্ত ব্যালেন্স নাই! কোর্স কিনতে ৳{requiredPrice} BDT প্রয়োজন। অনুগ্রহ করে বিকাশ দিয়ে ওয়ালেট রিচার্জ করুন।
                          </p>
                        ) : (
                          <p className="text-[11px] text-emerald-800 font-light leading-relaxed border-t border-emerald-200/60 pt-1.5">
                            ✅ আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স আছে। নিচের বাটনে ক্লিক করে সরাসরি কোর্সটি আনলক করে নিন।
                          </p>
                        )}
                      </div>

                      {hasEnoughBalance ? (
                        <button
                          type="button"
                          onClick={handleDirectWalletClaim}
                          disabled={isSubmittingRequest}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-light text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>
                            {isSubmittingRequest 
                              ? 'প্রসেস করা হচ্ছে...' 
                              : `ওয়ালেট ব্যালেন্স থেকে কোর্স কিনুন (৳${requiredPrice} BDT)`}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBuyCourse(null);
                            setIsCartCheckoutMode(false);
                            setIsRechargeModalOpen(true);
                          }}
                          className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-light text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>ওয়ালেট রিচার্জ করুন (Recharge Wallet)</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Wallet Recharge Modal */}
      <AnimatePresence>
        {isRechargeModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="wallet-recharge-modal">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl relative max-h-[90vh] flex flex-col border border-slate-200"
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}
            >
              {/* Minimal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <div>
                  <h3 className="font-light text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                    <span className="font-extrabold text-emerald-600 text-xs">bKash</span> ওয়ালেট রিচার্জ (Wallet Recharge)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-light truncate max-w-[220px]">
                    বর্তমান ওয়ালেট ব্যালেন্স: ৳{userWalletBalance} BDT
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRechargeModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleClaimWalletRecharge} className="p-5 overflow-y-auto space-y-3.5 flex-1 text-slate-700">
                {/* Instructions Box */}
                <div className="p-3 bg-pink-50/50 border border-pink-100/80 rounded-xl space-y-2 text-xs font-light">
                  <p className="text-slate-600 text-[11px] leading-snug">
                    ওয়ালেটে টাকা রিচার্জ করতে <strong className="font-normal text-pink-600">bKash Personal</strong> নম্বরে Send Money করে নিচের ফরমে ক্লেইম করুন:
                  </p>
                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-pink-100">
                    <span className="font-mono font-normal text-slate-800 text-xs tracking-wider">
                      01581624202
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('01581624202');
                        alert('bKash number 01581624202 copied!');
                      }}
                      className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-light text-[10px] rounded border border-slate-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-light italic">
                    💡 টাকা দেওয়ার পর ট্রাঞ্জেকশন আইডি জমা দিন। টাকা কত পাঠিয়েছেন তা ইনপুট দিতে হবে না, এডমিনের আপলোড করা ডেটা থেকে সিস্টেম স্বয়ংক্রিয়ভাবে শনাক্ত করে আপনার ওয়ালেটে ব্যালেন্স জমা করবে।
                  </p>
                </div>

                {rechargeMessage && (
                  <div className={`p-3 rounded-xl text-xs font-light leading-snug flex items-start gap-2 ${
                    rechargeMessage.type === 'success' 
                      ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' 
                      : rechargeMessage.type === 'info'
                      ? 'bg-amber-50 border border-amber-100 text-amber-900'
                      : 'bg-rose-50 border border-rose-100 text-rose-800'
                  }`}>
                    {rechargeMessage.type === 'success' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    ) : rechargeMessage.type === 'info' ? (
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
                    )}
                    <span>{rechargeMessage.text}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-light text-slate-500 block">
                    ইমেইল অ্যাড্রেস <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={rechargeEmail}
                    onChange={(e) => setRechargeEmail(e.target.value)}
                    placeholder="student@gmail.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-emerald-400 outline-none text-xs font-light transition text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-light text-slate-500 block">
                    bKash সেন্ডার নম্বর <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={rechargeSender}
                    onChange={(e) => setRechargeSender(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-emerald-400 outline-none text-xs font-light transition text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-light text-slate-500 block">
                    ট্রাঞ্জেকশন আইডি (TrxID) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={rechargeTrx}
                    onChange={(e) => setRechargeTrx(e.target.value)}
                    placeholder="K8L9O0P1Q2"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-emerald-400 outline-none text-xs font-light transition text-slate-800 font-mono uppercase"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingRecharge}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium text-xs rounded-xl transition cursor-pointer shadow-xs mt-1 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingRecharge ? (
                    <span>Request Sent...</span>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Claim Recharge</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
