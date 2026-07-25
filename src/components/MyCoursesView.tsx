import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Check, Trash2, Lock, Sparkles, Volume2, PlusCircle, 
  FileSpreadsheet, HelpCircle, Shuffle, GraduationCap, Trophy, 
  Gamepad2, Search, CheckCircle, AlertCircle, ShoppingBag, X, 
  Copy, ArrowRight, Star, Heart, Calendar, ShieldAlert, Layers, Play,
  ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { Course, UserProgress, ActiveTab } from '../types';
import { isCourseEnrolled, isCourseAccessible } from '../lib/courseAccess';

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

  // Fetch wallet balance whenever accessEmail changes or modal opens
  useEffect(() => {
    if (!accessEmail || !accessEmail.includes('@')) return;
    const fetchWallet = async () => {
      try {
        const walletSnap = await getDoc(doc(db, 'user_wallets', accessEmail.toLowerCase().trim()));
        if (walletSnap.exists()) {
          setUserWalletBalance(walletSnap.data().balance || 0);
        } else {
          setUserWalletBalance(0);
        }
      } catch (e) {
        console.warn("Wallet fetch notice:", e);
      }
    };
    fetchWallet();
  }, [accessEmail, selectedBuyCourse, isCartCheckoutMode]);

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

    const totalPrice = targetCourses.reduce((sum, c) => sum + ((c.price && c.price > 0) ? c.price : 30), 0);

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

      // 2. Unlock all target courses directly
      for (const appCourse of targetCourses) {
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

      // 3. Save approved access request record for history
      const requestId = `req_wallet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await setDoc(doc(db, 'access_requests', requestId), {
        id: requestId,
        courseId: isCartPurchase ? 'multi_cart' : targetCourses[0].id,
        courseTitle: isCartPurchase ? `Cart Purchase (${targetCourses.length} Courses)` : targetCourses[0].title,
        courseCode: targetCourses.map(c => c.code || c.id).join(', '),
        courseIds: targetCourses.map(c => c.id),
        courseTitles: targetCourses.map(c => c.title),
        bkashNumber: 'WALLET_BALANCE',
        email: cleanEmail,
        trxId: `WALLET_PAY_${Date.now()}`,
        status: 'approved',
        price: targetCourses[0].price || 30,
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
      // 1. Call SERVER-SIDE API verification check & spent marking endpoint
      const res = await fetch('/api/verify-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          bkashNumber: cleanSender,
          trxId: cleanTrx
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setRechargeMessage({
          type: 'error',
          text: data.reason || 'রিচার্জ প্রসেস করার সময়ে একটি সমস্যা তৈরি হয়েছে।'
        });
        setIsSubmittingRecharge(false);
        return;
      }

      if (data.autoVerified) {
        setUserWalletBalance(data.newBalance || 0);
        setRechargeMessage({
          type: 'success',
          text: data.message || `অটো-ভেরিফিকেশন সফল! ৳${data.amountAdded} BDT ওয়ালেটে জমা হয়েছে।`
        });
        setRechargeTrx('');
      } else {
        setRechargeMessage({
          type: 'info',
          text: data.message || `আপনার ওয়ালেট রিচার্জ রিকুয়েস্ট জমা হয়েছে। এডমিন প্যানেল থেকে ভেরিফাই করে দ্রুত ব্যালেন্স যোগ করা হবে।`
        });
        setRechargeTrx('');
      }
    } catch (err) {
      console.error('Error verifying recharge on server:', err);
      // Fallback client-side verification if server is unreachable
      try {
        const matchTrx = cleanTrx;
        const matchPhone = cleanPhone(cleanSender);

        // Check used_transactions lock
        const usedTxSnap = await getDoc(doc(db, 'used_transactions', matchTrx));
        if (usedTxSnap.exists() && (usedTxSnap.data().spent === true || usedTxSnap.data().status === 'spent')) {
          setRechargeMessage({
            type: 'error',
            text: `এই ট্রাঞ্জেকশন আইডিটি (${rechargeTrx}) ইতোমধ্যে 'spent' বা ব্যবহৃত হিসেবে 'used_transactions'-এ লক্ করা রয়েছে।`
          });
          setIsSubmittingRecharge(false);
          return;
        }

        const existingReqsSnap = await getDocs(query(collection(db, 'access_requests')));
        const isAlreadyUsedReq = existingReqsSnap.docs.some(docSnap => {
          const d = docSnap.data();
          return (d.trxId && String(d.trxId).trim().toLowerCase() === matchTrx) && (d.spent === true || d.status === 'approved' || d.status === 'pending');
        });

        if (isAlreadyUsedReq) {
          setRechargeMessage({
            type: 'error',
            text: `এই ট্রাঞ্জেকশন আইডিটি (${rechargeTrx}) ইতোমধ্যে একবার সিস্টেমে ব্যবহার বা ক্লেইম করা হয়েছে। একই ট্রাঞ্জেকশন নম্বর দিয়ে একাধিকবার রিচার্জ পাওয়া সম্ভব নয়।`
          });
          setIsSubmittingRecharge(false);
          return;
        }

        const globalVpSnap = await getDoc(doc(db, 'system_settings', 'global_verified_payments'));
        let allVps: any[] = [];
        let matchedVpIndex = -1;
        let matchedVp: any = null;

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

        if (matchedVp && (matchedVp.claimed || matchedVp.spent)) {
          setRechargeMessage({
            type: 'error',
            text: `এই ট্রাঞ্জেকশন আইডিটি (${rechargeTrx}) ইতোমধ্যে ${matchedVp.claimedBy || 'অন্য এক ইউজার'} ক্লেইম/Spent করে নিয়েছেন।`
          });
          setIsSubmittingRecharge(false);
          return;
        }

        if (matchedVp) {
          const addAmount = matchedVp.amount && matchedVp.amount > 0 ? matchedVp.amount : 50;
          const walletRef = doc(db, 'user_wallets', cleanEmail);
          const walletSnap = await getDoc(walletRef);
          const currentBalance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;
          const newBalance = currentBalance + addAmount;
          const nowISO = new Date().toISOString();

          // ATOMIC LOCK: Record transaction in used_transactions collection as 'spent' BEFORE updating wallet balance
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

          await setDoc(walletRef, {
            email: cleanEmail,
            bkashNumber: cleanSender,
            balance: newBalance,
            updatedAt: nowISO
          }, { merge: true });

          allVps[matchedVpIndex] = {
            ...matchedVp,
            spent: true,
            claimed: true,
            claimedBy: cleanEmail,
            claimedAt: nowISO,
            spentAt: nowISO
          };
          await setDoc(doc(db, 'system_settings', 'global_verified_payments'), { verifiedPayments: allVps }, { merge: true });

          setUserWalletBalance(newBalance);

          const reqId = `req_recharge_auto_${Date.now()}`;
          await setDoc(doc(db, 'access_requests', reqId), {
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
          });

          setRechargeMessage({
            type: 'success',
            text: `অটো-ভেরিফিকেশন সফল! এডমিনের ভেরিফাইড পেমেন্ট থেকে ৳${addAmount} BDT সরাসরি আপনার ওয়ালেটে জমা হয়েছে এবং ট্রাঞ্জেকশনটি 'Spent' হিসেবে চিহ্নিত হয়েছে।`
          });
          setRechargeTrx('');
        } else {
          const reqId = `req_recharge_manual_${Date.now()}`;
          const nowISO = new Date().toISOString();
          await setDoc(doc(db, 'access_requests', reqId), {
            id: reqId,
            courseId: 'wallet_recharge',
            courseTitle: `Wallet Recharge Claim`,
            bkashNumber: cleanSender,
            email: cleanEmail,
            trxId: cleanTrx,
            status: 'pending',
            verificationMethod: 'manual',
            spent: false,
            price: 0,
            totalPrice: 0,
            createdAt: nowISO,
            requestedBy: user?.email || cleanEmail
          });

          setRechargeMessage({
            type: 'info',
            text: `আপনার ওয়ালেট রিচার্জ রিকুয়েস্ট সফলভাবে জমা হয়েছে। এডমিন প্যানেল থেকে ভেরিফাই করে ব্যালেন্স যোগ করা হবে।`
          });
          setRechargeTrx('');
        }
      } catch (clientErr) {
        setRechargeMessage({
          type: 'error',
          text: 'রিচার্জ আবেদন জমা দিতে ব্যর্থ হয়েছে: ' + (clientErr instanceof Error ? clientErr.message : String(clientErr))
        });
      }
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

      await setDoc(doc(db, 'access_requests', requestId), requestPayload);

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

  // Filter courses based on selections
  const matchingSearchCourses = allCourses.filter(c => {
    return c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           c.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const enrolledCoursesList = matchingSearchCourses.filter(c => isCourseAccessible(c, enrolledCourseIds, user?.email));
  const lockedCoursesList = matchingSearchCourses.filter(c => !isCourseAccessible(c, enrolledCourseIds, user?.email));

  // Sort enrolled courses so active course is ALWAYS FIRST at the top left position
  const activeCourseObj = enrolledCoursesList.find(c => c.id.trim().toLowerCase() === activeCourseId?.trim().toLowerCase());
  const otherEnrolledCourses = enrolledCoursesList.filter(c => c.id.trim().toLowerCase() !== activeCourseId?.trim().toLowerCase());
  const sortedEnrolledCourses = activeCourseObj ? [activeCourseObj, ...otherEnrolledCourses] : enrolledCoursesList;

  const renderCourseCard = (course: Course) => {
    const isActive = course.id.trim().toLowerCase() === activeCourseId?.trim().toLowerCase();
    const isUserAllowed = isCourseAccessible(course, enrolledCourseIds, user?.email);
    const wordsCount = course.words?.length || 0;

    const courseWords = course.words || [];
    const masteredCount = courseWords.filter(w => progress[w.id]?.status === 'know').length;
    const progressPercent = wordsCount > 0 ? Math.round((masteredCount / wordsCount) * 100) : 0;
    const isExpanded = !!expandedCourseIds[course.id];

    return (
      <motion.div
        key={course.id}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group relative rounded-2xl sm:rounded-3xl transition-all duration-300 flex flex-col justify-between ${
          isActive 
            ? 'bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 p-[2px] sm:p-[3px] shadow-md sm:shadow-xl shadow-slate-900/20 ring-2 sm:ring-4 ring-slate-400/30' 
            : isUserAllowed
            ? 'bg-slate-200 hover:bg-slate-300 p-[1.5px] sm:p-[2px] shadow-2xs hover:shadow-md'
            : 'bg-gradient-to-r from-orange-300 via-amber-300 to-orange-400 p-[1.5px] sm:p-[2px] shadow-2xs hover:shadow-lg'
        }`}
      >
        {/* Inner Card Container */}
        <div className={`w-full h-full rounded-[14px] sm:rounded-[22px] p-2.5 sm:p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
          isActive 
            ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-white' 
            : isUserAllowed
            ? 'bg-white hover:bg-slate-50/90 text-slate-900 border border-slate-200'
            : 'bg-orange-50/80 hover:bg-orange-100/90 text-slate-900 border border-orange-200/90'
        }`}>

          {/* MOBILE COMPACT HEADER (Visible on mobile <sm:) */}
          <div 
            onClick={() => toggleCourseExpand(course.id)}
            className="sm:hidden flex items-center justify-between gap-2 cursor-pointer select-none py-0.5"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Status Dot / Badge */}
              {isActive ? (
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0 ring-2 ring-indigo-200/50" title="Active Course" />
              ) : !isUserAllowed ? (
                <Lock className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
              ) : (
                <Check className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
              )}

              {/* Title */}
              <h3 
                style={{ fontFamily: "'Poppins', sans-serif" }}
                className={`text-xs font-bold truncate ${
                  isActive ? 'text-white' : 'text-slate-900'
                }`}
              >
                {course.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Progress Percent Pill */}
              <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded border ${
                isActive 
                  ? 'bg-white/20 text-white border-white/30' 
                  : isUserAllowed 
                  ? 'bg-slate-100 text-slate-800 border-slate-200' 
                  : 'bg-orange-200/80 text-orange-950 border-orange-300'
              }`}>
                {progressPercent}%
              </span>

              {/* Price */}
              <span className={`text-xs font-black font-mono ${isActive ? 'text-white' : 'text-slate-900'}`}>
                ৳{(course.price && course.price > 0) ? course.price : 30}
              </span>

              {/* Expand Toggle Button */}
              <button 
                type="button" 
                onClick={(e) => toggleCourseExpand(course.id, e)}
                className={`p-1 rounded-lg transition-colors ${
                  isActive ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200/60 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* DESKTOP CONTENT (Always visible on sm:), MOBILE CONTENT (Visible when isExpanded on <sm:) */}
          <div className={`${isExpanded ? 'block mt-2.5 pt-2 sm:mt-0 sm:pt-0 border-t border-slate-200/30 sm:border-0' : 'hidden sm:block'}`}>
            {/* Header Row (Badges + Course ID) */}
            <div 
              onClick={() => setSelectedDetailCourse(course)}
              className="cursor-pointer"
            >
              <div className="flex justify-between items-center gap-2 mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isActive ? (
                    <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-white/20 backdrop-blur-md text-white font-black text-[9px] rounded-full uppercase tracking-wider border border-white/30 flex items-center gap-1 shadow-2xs">
                      <Check className="w-3 h-3 text-indigo-300" /> Active Course
                    </span>
                  ) : !isUserAllowed ? (
                    <span className="px-2.5 py-0.5 bg-orange-100 text-orange-800 border border-orange-200/80 font-extrabold text-[9px] rounded-full uppercase tracking-wider flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-orange-600" /> Locked
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 font-extrabold text-[9px] rounded-full uppercase tracking-wider">
                      ✓ Enrolled
                    </span>
                  )}

                  {course.isDefault && (
                    <span className={`px-2 py-0.5 font-extrabold text-[9px] rounded-full uppercase tracking-wider border ${
                      isActive 
                        ? 'bg-white/20 text-white border-white/30' 
                        : isUserAllowed 
                        ? 'bg-slate-100 text-slate-700 border-slate-200' 
                        : 'bg-orange-100 text-orange-800 border-orange-200'
                    }`}>
                      Default
                    </span>
                  )}
                </div>

                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isActive 
                    ? 'bg-white/10 text-slate-200 border-white/20' 
                    : isUserAllowed 
                    ? 'bg-slate-100 text-slate-700 border-slate-200' 
                    : 'bg-orange-100 text-orange-800 border-orange-200'
                }`}>
                  #{course.id}
                </span>
              </div>

              {/* Course Title */}
              <h3 
                style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}
                className={`text-sm sm:text-lg tracking-tight leading-snug line-clamp-2 my-1 sm:my-1.5 ${
                  isActive 
                    ? 'text-white' 
                    : isUserAllowed 
                    ? 'text-slate-900 group-hover:text-indigo-600 transition-colors' 
                    : 'text-slate-900 group-hover:text-orange-600 transition-colors'
                }`}
              >
                {course.title}
              </h3>

              {/* Price Tag */}
              <div className="mt-1.5 sm:mt-2.5 flex items-baseline gap-1.5">
                <span className={`text-lg sm:text-2xl font-black font-mono tracking-tight ${
                  isActive 
                    ? 'text-white' 
                    : isUserAllowed 
                    ? 'text-slate-900' 
                    : 'text-orange-950'
                }`}>
                  ৳{(course.price && course.price > 0) ? course.price : 30}
                </span>
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                  isActive 
                    ? 'text-slate-300' 
                    : isUserAllowed 
                    ? 'text-slate-500' 
                    : 'text-orange-700'
                }`}>
                  BDT
                </span>
              </div>
            </div>

            {/* Word Count & Visual Progress Bar Indicator */}
            <div 
              style={{ fontFamily: "'Poppins', sans-serif" }}
              className={`mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t space-y-1.5 text-xs ${
                isActive 
                  ? 'border-white/20 text-slate-200' 
                  : isUserAllowed 
                  ? 'border-slate-200 text-slate-700' 
                  : 'border-orange-200/60 text-orange-900'
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-bold">
                  <Trophy className={`w-3.5 h-3.5 ${
                    isActive ? 'text-amber-300' : isUserAllowed ? 'text-amber-500' : 'text-orange-500'
                  }`} />
                  <span>Mastered: <strong className={`font-extrabold ${isActive ? 'text-white' : 'text-slate-900'}`}>{masteredCount}</strong> / {wordsCount} words</span>
                </span>
                <span className={`font-black font-mono text-[10px] px-1.5 py-0.5 rounded-md border ${
                  isActive 
                    ? 'bg-white/20 text-white border-white/30' 
                    : isUserAllowed 
                    ? 'bg-slate-100 text-slate-800 border-slate-200' 
                    : 'bg-orange-200/80 text-orange-900 border-orange-300'
                }`}>
                  {progressPercent}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className={`w-full h-2 rounded-full overflow-hidden p-0.5 ${
                isActive 
                  ? 'bg-black/30' 
                  : isUserAllowed 
                  ? 'bg-slate-100 border border-slate-200' 
                  : 'bg-orange-200/70 border border-orange-300/50'
              }`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`h-full rounded-full transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-300 to-indigo-300 shadow-xs'
                      : isUserAllowed
                      ? 'bg-gradient-to-r from-slate-700 to-slate-900'
                      : 'bg-gradient-to-r from-orange-400 to-amber-500'
                  }`}
                />
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="mt-3 sm:mt-4 pt-1 flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              {!isUserAllowed && (
                <>
                  <button
                    type="button"
                    onClick={(e) => toggleCartCourse(course, e)}
                    title={cart.some(c => c.id === course.id) ? "Remove from Cart" : "Add to Cart"}
                    className={`px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border ${
                      cart.some(c => c.id === course.id)
                        ? 'bg-slate-800 text-white border-slate-900 font-black shadow-2xs'
                        : 'bg-orange-100 hover:bg-orange-200 text-orange-950 border-orange-300/80 font-extrabold'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{cart.some(c => c.id === course.id) ? 'Cart ✓' : '+ Cart'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCourseId(course.id);
                      if (onSelectTab) {
                        onSelectTab('flashcard');
                      }
                    }}
                    title="ফ্রি ফ্ল্যাশকার্ড প্র্যাকটিস করুন (Free Sample Flashcards)"
                    className="flex-1 py-2 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 transition shadow-xs cursor-pointer border border-indigo-500/80 active:scale-98"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-amber-300" />
                    <span>ফ্রি কার্ডস</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isUserAllowed) {
                    setIsCartCheckoutMode(false);
                    setSelectedBuyCourse(course);
                    return;
                  }
                  setActiveCourseId(course.id);
                  if (onSelectTab) {
                    onSelectTab('flashcard');
                  }
                }}
                className={`${!isUserAllowed ? 'px-3' : 'flex-1'} py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 hover:bg-slate-100 font-black shadow-md'
                    : isUserAllowed
                    ? 'bg-slate-900 hover:bg-black text-white font-extrabold'
                    : 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold'
                }`}
              >
                {isUserAllowed ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Flashcard</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Buy Now</span>
                  </>
                )}
              </button>

              {/* View Details Button for Mobile */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDetailCourse(course);
                }}
                className={`sm:hidden px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border ${
                  isActive 
                    ? 'bg-white/10 hover:bg-white/20 text-white border-white/20' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                }`}
                title="কোর্সের সকল তথ্য দেখুন"
              >
                <Info className="w-3.5 h-3.5" />
                <span>বিস্তারিত</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6" id="my-courses-view-root" style={{ fontFamily: "'Poppins', 'Kalpurush', 'SutonnyMJ', sans-serif" }}>
      {/* 1. Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-4 sm:p-6 text-white relative overflow-hidden shadow-lg border border-indigo-950">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[10px] font-black uppercase tracking-widest font-sans">
            <Trophy className="w-3 h-3 text-amber-400" /> Course & Syllabus Hub
          </span>
          <h2 className="text-lg sm:text-2xl font-black tracking-tight leading-tight text-white">
            My Courses & Syllabus Directory
          </h2>
        </div>
      </div>

      {/* 1.5 Wallet Credit Balance Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0">
            ৳
          </div>
          <div>
            <h4 className="font-extrabold text-xs text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
              <span>আপনার ওয়ালেট ব্যালেন্স (Wallet Credit)</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] rounded-full font-black">Active</span>
            </h4>
            <p className="text-xs text-emerald-800 font-normal mt-0.5" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}>
              আপনার অ্যাকাউন্টে <strong>৳{userWalletBalance} BDT</strong> ওয়ালেট ব্যালেন্স রয়েছে। রিচার্জ করতে পাশের বাটনে ক্লিক করুন।
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <span className="font-mono text-lg sm:text-xl font-black text-emerald-700 px-3 py-1.5 bg-white rounded-xl border border-emerald-200 shadow-2xs">
            ৳{userWalletBalance}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsRechargeModalOpen(true);
              setRechargeMessage(null);
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-light text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 border border-emerald-700"
            style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>রিচার্জ করুন</span>
          </button>
        </div>
      </div>

      {/* 2. Advanced Search & Tabs Control */}
      <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-center bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/70 shadow-xs max-w-full overflow-hidden">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses by name or keyword..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-[11px] font-normal transition text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex bg-slate-100/80 p-1 rounded-xl w-full sm:w-auto overflow-x-auto max-w-full gap-1 shrink-0" id="course-filter-toggles">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg text-[10px] font-medium transition whitespace-nowrap cursor-pointer shrink-0 ${
              filter === 'all' ? 'bg-white text-indigo-700 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Courses
          </button>
          <button
            onClick={() => setFilter('enrolled')}
            className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg text-[10px] font-medium transition whitespace-nowrap cursor-pointer shrink-0 ${
              filter === 'enrolled' ? 'bg-white text-indigo-700 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            My Active / Enrolled
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg text-[10px] font-medium transition whitespace-nowrap cursor-pointer shrink-0 ${
              filter === 'locked' ? 'bg-white text-indigo-700 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Locked Courses
          </button>
        </div>
      </div>

      {/* 3. Multi-Layer Course Cards Layout */}
      <div className="space-y-8" id="courses-grid-container">
        {/* Layer 1: Enrolled / Active Courses */}
        {(filter === 'all' || filter === 'enrolled') && (
          <div className="space-y-3" id="enrolled-courses-section">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>My Active & Enrolled Courses ({sortedEnrolledCourses.length})</span>
              </h3>
            </div>

            {sortedEnrolledCourses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                {sortedEnrolledCourses.map(course => renderCourseCard(course))}
              </div>
            ) : (
              <div className="p-6 bg-emerald-50/50 rounded-2xl border border-dashed border-emerald-200 text-center text-xs text-emerald-800 font-medium">
                No active/enrolled courses found.
              </div>
            )}
          </div>
        )}

        {/* Divider with "Buy New Course" Button */}
        {filter === 'all' && (
          <div className="relative my-8 py-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-slate-300/80" />
            </div>
            <div className="relative bg-slate-50 px-4 rounded-full">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('locked-courses-section');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    setIsCartOpen(true);
                  }
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs sm:text-sm rounded-full shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer border-2 border-white uppercase tracking-wider"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Buy New Course</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Layer 2: Locked Courses (Orange Theme) */}
        {(filter === 'all' || filter === 'locked') && (
          <div className="space-y-3" id="locked-courses-section">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-orange-950 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-orange-600" />
                <span>Locked / Available Courses ({lockedCoursesList.length})</span>
              </h3>
            </div>

            {lockedCoursesList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                {lockedCoursesList.map(course => renderCourseCard(course))}
              </div>
            ) : (
              <div className="p-6 bg-orange-50/50 rounded-2xl border border-dashed border-orange-200 text-center text-xs text-orange-800 font-medium">
                No locked courses found.
              </div>
            )}
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

      {/* 4. Course Detail Pop-Up Modal */}
      <AnimatePresence>
        {selectedDetailCourse && (() => {
          const course = selectedDetailCourse;
          const isActive = course.id.trim().toLowerCase() === activeCourseId?.trim().toLowerCase();
          const isEnrolled = isCourseEnrolled(course.id, enrolledCourseIds);
          const isUserAllowed = isCourseAccessible(course, enrolledCourseIds, user?.email);
          const wordsCount = course.words?.length || 0;

          const courseWords = course.words || [];
          const progressCount = courseWords.filter(w => progress[w.id]?.status === 'know').length;
          const progressPercent = wordsCount > 0 ? Math.round((progressCount / wordsCount) * 100) : 0;

          const variables = [
            { key: 'meaning', label: 'Word Meaning', icon: BookOpen },
            { key: 'synonyms', label: 'Synonyms', icon: Sparkles },
            { key: 'extraWord', label: 'Derivatives', icon: PlusCircle },
            { key: 'extraMeaning', label: 'Derivative Meaning', icon: HelpCircle },
            { key: 'example', label: 'Example Sentences', icon: FileSpreadsheet },
            { key: 'audio', label: 'Voice Pronunciation', icon: Volume2 }
          ];

          const games = [
            { key: 'quiz', label: 'Practice Quiz', icon: GraduationCap },
            { key: 'match', label: 'Word Match', icon: Gamepad2 },
            { key: 'synonym', label: 'Synonym Check', icon: Sparkles },
            { key: 'blank', label: 'Fill in the Blank', icon: BookOpen },
            { key: 'odd_one_out', label: 'Odd One Out', icon: HelpCircle },
            { key: 'analogy', label: 'Word Analogy', icon: Shuffle }
          ];

          return (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="course-detail-modal-container">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col border border-slate-100"
                style={{ fontFamily: "'Poppins', 'Kalpurush', 'SutonnyMJ', sans-serif" }}
              >
                {/* Modal Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isActive ? (
                        <span className="px-2.5 py-0.5 bg-emerald-500 text-white font-black text-[9px] rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active Course
                        </span>
                      ) : !isUserAllowed ? (
                        <span className="px-2 py-0.5 bg-rose-500 text-white font-black text-[9px] rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Restricted (৳{(course.price && course.price > 0) ? course.price : 30})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold text-[9px] rounded-full uppercase tracking-wider border border-indigo-100">
                          Enrolled
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono font-bold">Code: {course.id}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-snug">
                      {course.title}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedDetailCourse(null)}
                    className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
                  {/* Course Description */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Description</span>
                    <p className="text-xs text-slate-650 leading-relaxed font-medium bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      {course.description || 'No description specified for this course.'}
                    </p>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100/60">
                      <span className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-wider block">Total Words</span>
                      <span className="text-lg font-black text-indigo-900">{wordsCount}</span>
                    </div>
                    <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100/60">
                      <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider block">Mastered Words</span>
                      <span className="text-lg font-black text-emerald-900">{progressCount} ({progressPercent}%)</span>
                    </div>
                    <div className="p-3 bg-teal-50/60 rounded-2xl border border-teal-100/60">
                      <span className="text-[9px] font-extrabold text-teal-600 uppercase tracking-wider block">Total Groups</span>
                      <span className="text-lg font-black text-teal-900">{course.totalGroups || 1}</span>
                    </div>
                    <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100/60">
                      <span className="text-[9px] font-extrabold text-amber-600 uppercase tracking-wider block">Course Price</span>
                      <span className="text-lg font-black text-amber-900">৳{(course.price && course.price > 0) ? course.price : 30}</span>
                    </div>
                  </div>

                  {/* Course Mastered Visual Progress Bar */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span>Course Mastery Progress</span>
                      </span>
                      <span className="font-mono font-black text-emerald-700 text-xs bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {progressCount} / {wordsCount} words ({progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5 border border-slate-300/40">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full shadow-2xs" 
                      />
                    </div>
                  </div>

                  {/* Active Features & Games */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    {/* Features */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Features</span>
                      <ul className="space-y-1 text-xs">
                        {variables.map(v => {
                          const isEnabled = course.variableToggles ? course.variableToggles[v.key] !== false : true;
                          if (!isEnabled) return null;
                          const label = getEnglishFeatureLabel(v.key, course.placeLabels);
                          return (
                            <li key={v.key} className="flex items-center gap-1.5 text-slate-700 font-semibold">
                              <span className="text-indigo-500 font-black">•</span>
                              <span>{label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Games */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Practice Games</span>
                      <ul className="space-y-1 text-xs">
                        {games.map(g => {
                          const isEnabled = course.enabledGames ? course.enabledGames[g.key] !== false : true;
                          if (!isEnabled) return null;
                          const label = getEnglishGameLabel(g.key, course.placeLabels);
                          return (
                            <li key={g.key} className="flex items-center gap-1.5 text-slate-700 font-semibold">
                              <span className="text-emerald-500 font-black">•</span>
                              <span>{label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center text-[10px] font-black">
                      <span className="text-slate-400 uppercase tracking-wider">Syllabus Progress</span>
                      <span className="text-emerald-600 font-mono">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-150 flex flex-wrap items-center gap-2">
                  {!isUserAllowed ? (
                    <div className="w-full flex flex-col sm:flex-row items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveCourseId(course.id);
                          if (onSelectTab) {
                            onSelectTab('flashcard');
                          }
                          setSelectedDetailCourse(null);
                        }}
                        className="flex-1 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 active:scale-98"
                      >
                        <Play className="w-4 h-4 fill-current text-amber-300" />
                        <span>ফ্রি কার্ডস দেখুন ({course.freeFlashcardsCount || 10}টি ফ্রি)</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedDetailCourse(null);
                          setSelectedBuyCourse(course);
                        }}
                        className="flex-1 w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/10 active:scale-98"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Buy Course (৳{(course.price && course.price > 0) ? course.price : 30})</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (!isEnrolled) {
                            handleFreeEnroll(course);
                          }
                          setActiveCourseId(course.id);
                          if (onSelectTab) {
                            onSelectTab('flashcard');
                          }
                          setSelectedDetailCourse(null);
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Flashcards</span>
                      </button>

                      {!isActive && (
                        <button
                          onClick={() => {
                            if (!isEnrolled) {
                              handleFreeEnroll(course);
                            } else {
                              setActiveCourseId(course.id);
                            }
                            setSelectedDetailCourse(null);
                          }}
                          className="py-2.5 px-3.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ArrowRight className="w-4 h-4" />
                          <span>Set Active</span>
                        </button>
                      )}
                    </>
                  )}

                  {isUserAllowed && isEnrolled && !course.isDefault && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${course.title}"?`)) {
                          setEnrolledCourseIds(prev => {
                            const updated = prev.filter(id => id !== course.id);
                            if (isActive && updated.length > 0) {
                              setActiveCourseId(updated[0]);
                            }
                            return updated;
                          });
                          setSelectedDetailCourse(null);
                        }
                      }}
                      className="p-2.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer flex-shrink-0"
                      title="Delete Course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
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
                  const requiredPrice = isCartCheckoutMode && cart.length > 0 
                    ? cartTotalPrice 
                    : ((selectedBuyCourse?.price && selectedBuyCourse.price > 0) ? selectedBuyCourse.price : 30);
                  const hasEnoughBalance = userWalletBalance >= requiredPrice;

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
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-light text-xs rounded-xl transition cursor-pointer shadow-xs mt-1 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingRecharge ? (
                    <span>যাচাই করা হচ্ছে...</span>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>রিচার্জ ক怼ইম করুন</span>
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
