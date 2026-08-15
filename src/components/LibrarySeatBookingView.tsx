import React, { useState, useEffect, useMemo } from 'react';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  writeBatch
} from '../lib/db';
import { LibraryType, SeatBooking, LibraryRoomConfig, LibraryConfig, DEFAULT_LIBRARY_CONFIG } from '../types/library';
import { 
  Building2, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  Hourglass, 
  LogOut, 
  ArrowLeft, 
  RotateCcw, 
  Coffee, 
  LogIn,
  Search, 
  Check,
  Flame,
  UserCheck,
  Shield,
  Settings2,
  Plus,
  Trash2,
  AlertTriangle,
  Users,
  Timer,
  UserPlus
} from 'lucide-react';

interface LibrarySeatBookingViewProps {
  libraryType: LibraryType;
  user: any;
  onBackToHome: () => void;
  onOpenStudyRoom: () => void;
  onRequireAuth: () => void;
}

const ADMIN_EMAIL = 'mohammad.001ekram@gmail.com';

export const LibrarySeatBookingView: React.FC<LibrarySeatBookingViewProps> = ({
  libraryType,
  user,
  onBackToHome,
  onOpenStudyRoom,
  onRequireAuth,
}) => {
  // Config state (Rooms, Capacities, Operating Hours)
  const [config, setConfig] = useState<LibraryConfig>(DEFAULT_LIBRARY_CONFIG);
  const [selectedRoom, setSelectedRoom] = useState<number>(1);
  const [bookings, setBookings] = useState<SeatBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  
  // Modals
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [showAwayModal, setShowAwayModal] = useState<boolean>(false);
  const [showSecondaryBookingModal, setShowSecondaryBookingModal] = useState<boolean>(false);
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);

  // Away Form States (Manual Input + Quick Presets)
  const [awayMinutes, setAwayMinutes] = useState<number>(30);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('30');
  const [awayReason, setAwayReason] = useState<string>('চা/নাস্তার বিরতি');
  const [customReasonInput, setCustomReasonInput] = useState<string>('');

  // Search & Real-time Live Clock
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Admin Panel Editing State
  const [adminRooms, setAdminRooms] = useState<LibraryRoomConfig[]>(DEFAULT_LIBRARY_CONFIG.rooms);

  const isAdmin = useMemo(() => {
    return user?.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }, [user]);

  // 1-second live ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const collectionName = `library_seats_${libraryType}`;
  const configDocName = `library_config_${libraryType}`;
  const localCacheKey = `cache_seats_${libraryType}`;
  const localConfigCacheKey = `cache_config_${libraryType}`;

  // Operating Hours (8:00 AM to 10:00 PM)
  const isWithinOperatingHours = useMemo(() => {
    const hour = currentTime.getHours();
    return hour >= 8 && hour < 22; // 8:00 to 21:59:59
  }, [currentTime]);

  // Load Library Config (Rooms & Capacities)
  useEffect(() => {
    try {
      const cachedConfig = localStorage.getItem(localConfigCacheKey);
      if (cachedConfig) {
        const parsed = JSON.parse(cachedConfig);
        setConfig(parsed);
        setAdminRooms(parsed.rooms || DEFAULT_LIBRARY_CONFIG.rooms);
      }
    } catch (_) {}

    try {
      const configRef = doc(db, 'library_settings', configDocName);
      const unsubscribe = onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as LibraryConfig;
          if (data && Array.isArray(data.rooms) && data.rooms.length > 0) {
            setConfig(data);
            setAdminRooms(data.rooms);
            try {
              localStorage.setItem(localConfigCacheKey, JSON.stringify(data));
            } catch (_) {}
          }
        }
      }, (err) => {
        console.warn('Config snapshot error:', err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Config listener init error:', e);
    }
  }, [libraryType]);

  // Load Real-time Seat Bookings from Firestore with auto-reset for previous days
  useEffect(() => {
    setLoading(true);
    try {
      const cached = localStorage.getItem(localCacheKey);
      if (cached) {
        setBookings(JSON.parse(cached));
      }
    } catch (_) {}

    try {
      const seatCol = collection(db, collectionName);
      const unsubscribe = onSnapshot(seatCol, (snapshot) => {
        const list: SeatBooking[] = [];
        const todayDateStr = new Date().toDateString();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as SeatBooking;
          // Filter out records from previous days if daily 10PM reset occurred
          if (data.bookedAt) {
            const bookingDateStr = new Date(data.bookedAt).toDateString();
            if (bookingDateStr === todayDateStr) {
              list.push(data);
            }
          } else {
            list.push(data);
          }
        });

        setBookings(list);
        try {
          localStorage.setItem(localCacheKey, JSON.stringify(list));
        } catch (_) {}
        setLoading(false);
      }, (err) => {
        console.warn('Firestore seats snapshot error:', err);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Seat realtime listener error:', err);
      setLoading(false);
    }
  }, [libraryType]);

  // Current active room config
  const currentRoomConfig = useMemo(() => {
    return config.rooms.find(r => r.id === selectedRoom) || config.rooms[0] || { id: 1, name: 'রুম ১', capacity: 100 };
  }, [config.rooms, selectedRoom]);

  // Current user's existing primary OR secondary booking across this library
  const myPrimaryBooking = useMemo(() => {
    if (!user?.uid && !user?.email) return null;
    return bookings.find(b => 
      (user.uid && b.userId === user.uid) || 
      (user.email && b.userEmail?.toLowerCase() === user.email.toLowerCase())
    );
  }, [bookings, user]);

  const mySecondaryBooking = useMemo(() => {
    if (!user?.uid && !user?.email) return null;
    return bookings.find(b => 
      (user.uid && b.secondaryUserId === user.uid) || 
      (user.email && b.secondaryUserEmail?.toLowerCase() === user.email.toLowerCase())
    );
  }, [bookings, user]);

  const hasAnyActiveBooking = !!(myPrimaryBooking || mySecondaryBooking);

  // Map of room bookings: seatNumber -> booking
  const roomBookingsMap = useMemo(() => {
    const map = new Map<number, SeatBooking>();
    bookings.filter(b => b.roomId === selectedRoom).forEach(b => {
      map.set(b.seatNumber, b);
    });
    return map;
  }, [bookings, selectedRoom]);

  // Stats calculation
  const roomStats = useMemo(() => {
    let occupied = 0;
    let away = 0;
    let secondaryOccupied = 0;
    const capacity = currentRoomConfig.capacity || 100;

    roomBookingsMap.forEach(b => {
      const isTimerActive = b.isAway && b.awayUntil && new Date(b.awayUntil).getTime() > currentTime.getTime();
      if (isTimerActive) {
        if (b.secondaryUserId) {
          secondaryOccupied++;
        } else {
          away++;
        }
      } else {
        occupied++;
      }
    });

    const totalBooked = occupied + away + secondaryOccupied;
    return {
      occupied,
      away,
      secondaryOccupied,
      available: Math.max(0, capacity - totalBooked),
      capacity
    };
  }, [roomBookingsMap, currentTime, currentRoomConfig]);

  // Format Remaining Away Time
  const getRemainingTimeData = (awayUntilStr?: string) => {
    if (!awayUntilStr) return null;
    const diff = new Date(awayUntilStr).getTime() - currentTime.getTime();
    if (diff <= 0) return { expired: true, text: 'সময় শেষ' };
    const totalSecs = Math.floor(diff / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return {
      expired: false,
      mins,
      secs,
      text: `${mins}:${secs < 10 ? '0' : ''}${secs}`
    };
  };

  // 🌟 Handle Book Seat (Primary)
  const handleConfirmBooking = async (seatNum: number) => {
    if (!user) {
      onRequireAuth();
      return;
    }

    if (!isWithinOperatingHours) {
      alert('বর্তমানে সিট বরাদ্দ বন্ধ রয়েছে। সিট বরাদ্দ প্রতিদিন সকাল ৮:০০ টা থেকে রাত ১০:০০ টা পর্যন্ত চালু থাকে।');
      return;
    }

    if (hasAnyActiveBooking) {
      const existing = myPrimaryBooking || mySecondaryBooking;
      alert(`আপনি ইতিমধ্যে রুম ${existing?.roomId}-এ সিট #${existing?.seatNumber} বরাদ্দ নিয়েছেন। একজন শিক্ষার্থী সর্বোচ্চ ১টি সিট নিতে পারেন। নতুন সিট নিতে আগেরটি ছেড়ে দিন।`);
      return;
    }

    const docId = `r${selectedRoom}_s${seatNum}`;
    const newBooking: SeatBooking = {
      seatNumber: seatNum,
      libraryId: libraryType,
      roomId: selectedRoom,
      userId: user.uid || 'user_' + Date.now(),
      userEmail: user.email || '',
      userName: user.displayName || user.email?.split('@')[0] || 'শিক্ষার্থী',
      userPhoto: user.photoURL || '',
      bookedAt: new Date().toISOString(),
      isAway: false,
    };

    try {
      await setDoc(doc(db, collectionName, docId), newBooking);
      const updated = [...bookings.filter(b => !(b.roomId === selectedRoom && b.seatNumber === seatNum)), newBooking];
      setBookings(updated);
      localStorage.setItem(localCacheKey, JSON.stringify(updated));
      setShowBookingModal(false);
      setSelectedSeat(null);
    } catch (err: any) {
      console.error('Seat booking error:', err);
      alert('সিট বুক করার সময় সমস্যা হয়েছে: ' + (err?.message || 'ইন্টারনেট চেক করুন'));
    }
  };

  // 🌟 Handle Secondary Booking on an Away Seat
  const handleConfirmSecondaryBooking = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }

    if (!isWithinOperatingHours) {
      alert('বর্তমানে সিট বরাদ্দ বন্ধ রয়েছে। সিট বরাদ্দ প্রতিদিন সকাল ৮:০০ টা থেকে রাত ১০:০০ টা পর্যন্ত চালু থাকে।');
      return;
    }

    if (hasAnyActiveBooking) {
      const existing = myPrimaryBooking || mySecondaryBooking;
      alert(`আপনি ইতিমধ্যে রুম ${existing?.roomId}-এ সিট #${existing?.seatNumber} বরাদ্দ নিয়েছেন। নতুন সিট নেয়ার পূর্বে আগের সিট ছেড়ে দিন।`);
      return;
    }

    if (!selectedSeat) return;
    const target = roomBookingsMap.get(selectedSeat);
    if (!target || !target.isAway) {
      alert('এই সিটটি বর্তমানে সাময়িক বিরতিতে নেই।');
      setShowSecondaryBookingModal(false);
      return;
    }

    const docId = `r${selectedRoom}_s${selectedSeat}`;
    const updatedBooking: SeatBooking = {
      ...target,
      secondaryUserId: user.uid || 'sec_user_' + Date.now(),
      secondaryUserEmail: user.email || '',
      secondaryUserName: user.displayName || user.email?.split('@')[0] || 'সেকেন্ডারি শিক্ষার্থী',
      secondaryBookedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, collectionName, docId), updatedBooking);
      const updated = bookings.map(b => (b.roomId === selectedRoom && b.seatNumber === selectedSeat ? updatedBooking : b));
      setBookings(updated);
      localStorage.setItem(localCacheKey, JSON.stringify(updated));
      setShowSecondaryBookingModal(false);
      setSelectedSeat(null);
    } catch (err: any) {
      console.error('Secondary booking error:', err);
      alert('সেকেন্ডারি বুকিংয়ে সমস্যা হয়েছে: ' + (err?.message || ''));
    }
  };

  // 🌟 Handle Set Temporary Away Timer (Supports Custom Manual Input)
  const handleSetAwayTimer = async () => {
    if (!myPrimaryBooking) return;
    const mins = parseInt(customMinutesInput, 10) || awayMinutes || 30;
    if (mins <= 0 || mins > 300) {
      alert('বিরতির সময় ১ থেকে ৩০০ মিনিটের মধ্যে নির্ধারণ করুন।');
      return;
    }

    const reason = customReasonInput.trim() || awayReason || 'সাময়িক বিরতি';
    const returnTime = new Date(Date.now() + mins * 60 * 1000).toISOString();
    const docId = `r${myPrimaryBooking.roomId}_s${myPrimaryBooking.seatNumber}`;

    const updatedBooking: SeatBooking = {
      ...myPrimaryBooking,
      isAway: true,
      awayReason: reason,
      awayMinutes: mins,
      awayUntil: returnTime,
    };

    try {
      await setDoc(doc(db, collectionName, docId), updatedBooking);
      const updated = bookings.map(b => (b.roomId === myPrimaryBooking.roomId && b.seatNumber === myPrimaryBooking.seatNumber ? updatedBooking : b));
      setBookings(updated);
      localStorage.setItem(localCacheKey, JSON.stringify(updated));
      setShowAwayModal(false);
    } catch (err: any) {
      console.error('Away timer error:', err);
      alert('টাইমার সেট করতে সমস্যা হয়েছে: ' + (err?.message || ''));
    }
  };

  // 🌟 Handle Release Seat (Primary or Secondary or Admin)
  const handleReleaseSeat = async (bookingToRelease?: SeatBooking) => {
    const target = bookingToRelease || myPrimaryBooking || mySecondaryBooking;
    if (!target) return;

    // If user is secondary booker, only release their secondary reservation
    if (mySecondaryBooking && target.seatNumber === mySecondaryBooking.seatNumber && target.roomId === mySecondaryBooking.roomId && !isAdmin) {
      if (!confirm(`আপনি কি সিট #${target.seatNumber}-এর সেকেন্ডারি ব্যবহার ছেড়ে দিতে চান?`)) return;
      const docId = `r${target.roomId}_s${target.seatNumber}`;
      const updatedBooking: SeatBooking = {
        ...target,
        secondaryUserId: undefined,
        secondaryUserEmail: undefined,
        secondaryUserName: undefined,
        secondaryBookedAt: undefined
      };
      try {
        await setDoc(doc(db, collectionName, docId), updatedBooking);
        const updated = bookings.map(b => (b.roomId === target.roomId && b.seatNumber === target.seatNumber ? updatedBooking : b));
        setBookings(updated);
        localStorage.setItem(localCacheKey, JSON.stringify(updated));
      } catch (err: any) {
        console.error('Release secondary error:', err);
      }
      return;
    }

    if (!confirm(`আপনি কি নিশ্চিতভাবে রুম ${target.roomId}-এর সিট #${target.seatNumber} সম্পূর্ণরূপে ছেড়ে দিতে চান?`)) {
      return;
    }

    const docId = `r${target.roomId}_s${target.seatNumber}`;
    try {
      await deleteDoc(doc(db, collectionName, docId));
      const updated = bookings.filter(b => !(b.roomId === target.roomId && b.seatNumber === target.seatNumber));
      setBookings(updated);
      localStorage.setItem(localCacheKey, JSON.stringify(updated));
      setShowAwayModal(false);
      setSelectedSeat(null);
    } catch (err: any) {
      console.error('Seat release error:', err);
      alert('সিট ছাড়ার সময় সমস্যা হয়েছে: ' + (err?.message || ''));
    }
  };

  // 🌟 ADMIN CONTROLS: Save Room & Seat Config
  const handleSaveAdminConfig = async () => {
    if (!isAdmin) return;
    const updatedConfig: LibraryConfig = {
      rooms: adminRooms,
      bookingStartHour: 8,
      bookingEndHour: 22,
      updatedAt: new Date().toISOString()
    };

    try {
      const configRef = doc(db, 'library_settings', configDocName);
      await setDoc(configRef, updatedConfig, { merge: true });
      setConfig(updatedConfig);
      localStorage.setItem(localConfigCacheKey, JSON.stringify(updatedConfig));
      alert('লাইব্রেরি রুম ও সিটের কনফিগারেশন সফলভাবে সেভ হয়েছে!');
      setShowAdminPanel(false);
    } catch (e: any) {
      console.error('Save config error:', e);
      alert('কনফিগারেশন সেভ করতে সমস্যা হয়েছে: ' + e?.message);
    }
  };

  // 🌟 ADMIN CONTROLS: Reset All Seats
  const handleAdminResetAllSeats = async () => {
    if (!isAdmin) return;
    if (!confirm(`⚠️ সতর্কবার্তা: আপনি কি ${libraryType === 'science' ? 'সাইন্স' : 'সেন্ট্রাল'} লাইব্রেরির সব রুমের সকল সিট এক ক্লিকে খালি/রিসেট করতে চান?`)) {
      return;
    }

    try {
      const batch = writeBatch(db);
      bookings.forEach(b => {
        const docId = `r${b.roomId}_s${b.seatNumber}`;
        const ref = doc(db, collectionName, docId);
        batch.delete(ref);
      });
      await batch.commit();
      setBookings([]);
      localStorage.setItem(localCacheKey, JSON.stringify([]));
      alert('সকল সিট সফলভাবে রিসেট ও খালি করা হয়েছে।');
    } catch (err: any) {
      console.error('Admin reset seats error:', err);
      alert('রিসেট করতে সমস্যা হয়েছে: ' + err?.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      
      {/* Top Header Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold border border-slate-700 cursor-pointer shadow-xs"
            title="হোমপেজে ফিরুন"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">হোমপেজ</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-lg ${libraryType === 'science' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
              {libraryType === 'science' ? '🧪' : '🏛️'}
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                {libraryType === 'science' ? 'সাইন্স লাইব্রেরি' : 'সেন্ট্রাল লাইব্রেরি'}
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                সিট নির্বাচন ও লাইভ বুকিং (সকাল ৮:০০ – রাত ১০:০০)
              </p>
            </div>
          </div>
        </div>

        {/* Right Header: Admin Panel Trigger + Study Room Button */}
        <div className="flex items-center gap-2.5">
          {/* Admin Control Panel Button (Only for mohammad.001ekram@gmail.com) */}
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer animate-pulse"
              title="সিট কন্ট্রোল প্যানেল"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">সিট কন্ট্রোল প্যানেল</span>
            </button>
          )}

          {user ? (
            <div className="hidden sm:flex items-center gap-2 bg-slate-850 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <span className="font-bold text-slate-300 max-w-[110px] truncate">
                {user.displayName || user.email?.split('@')[0]}
              </span>
            </div>
          ) : (
            <button
              onClick={onRequireAuth}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>লগইন করুন</span>
            </button>
          )}

          <button
            onClick={onOpenStudyRoom}
            className="px-3.5 py-1.5 sm:py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-purple-600/30 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>স্টাডি রুম</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Operating Hours Alert Banner (If outside 8:00 AM - 10:00 PM) */}
        {!isWithinOperatingHours && (
          <div className="bg-amber-950/70 border-2 border-amber-500/60 rounded-2xl p-4 flex items-center gap-3.5 text-amber-200 shadow-lg">
            <Clock className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h4 className="text-sm font-black text-white">
                বর্তমানে সিট বরাদ্দ বন্ধ রয়েছে
              </h4>
              <p className="text-xs text-amber-300/90 font-medium">
                প্রতিদিন সকাল ৮:০০ টা থেকে রাত ১০:০০ টা পর্যন্ত সিট বরাদ্দ চালু থাকে। প্রতিদিন রাত ১০:০০ টায় সমস্ত সিট স্বয়ংক্রিয়ভাবে রিসেট হয়ে যায়।
              </p>
            </div>
          </div>
        )}

        {/* 🌟 USER'S ACTIVE BOOKING BANNER (Primary or Secondary) */}
        {hasAnyActiveBooking && (
          <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-md">
                #{myPrimaryBooking?.seatNumber || mySecondaryBooking?.seatNumber}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-300">
                    {myPrimaryBooking ? 'আপনার মূল সিট' : 'আপনার সেকেন্ডারি ব্যবহার'} (রুম {myPrimaryBooking?.roomId || mySecondaryBooking?.roomId} • #{myPrimaryBooking?.seatNumber || mySecondaryBooking?.seatNumber})
                  </span>
                  {mySecondaryBooking && (
                    <span className="text-[10px] bg-purple-500/30 text-purple-300 border border-purple-400/40 px-2 py-0.5 rounded-md font-bold">
                      সেকেন্ডারি বুকার
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-white mt-0.5">
                  {myPrimaryBooking?.isAway && myPrimaryBooking.awayUntil && new Date(myPrimaryBooking.awayUntil).getTime() > currentTime.getTime() ? (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <Hourglass className="w-4 h-4 animate-spin text-amber-400" />
                      বিরতিতে আছেন: বাকি {getRemainingTimeData(myPrimaryBooking.awayUntil)?.text} ({myPrimaryBooking.awayReason})
                    </span>
                  ) : mySecondaryBooking ? (
                    <span className="text-purple-300 flex items-center gap-1.5">
                      <Timer className="w-4 h-4 text-purple-400" />
                      মূল ব্যবহারকারীর বিরতির সময়ে ব্যবহার করছেন
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      সিট সক্রিয় ও উপস্থিত
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Only primary booker can set away timer (and cannot cancel away arbitrarily once set) */}
              {myPrimaryBooking && !myPrimaryBooking.isAway && (
                <button
                  onClick={() => setShowAwayModal(true)}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>সাময়িক বিরতি নিন</span>
                </button>
              )}

              {myPrimaryBooking?.isAway && (
                <div className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5 animate-spin" />
                  <span>বিরতি চলমান (ক্যান্সেল করা যাবে না)</span>
                </div>
              )}

              <button
                onClick={() => handleReleaseSeat()}
                className="flex-1 sm:flex-initial px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>সিট ছাড়ুন</span>
              </button>
            </div>
          </div>
        )}

        {/* Room Navigation Tabs */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
          <div className="flex items-center gap-2">
            {config.rooms.map((room) => {
              const isSelected = selectedRoom === room.id;
              const countInRoom = bookings.filter(b => b.roomId === room.id).length;
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  <span>{room.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'}`}>
                    {countInRoom}/{room.capacity || 100}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[140px] sm:min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="সিট নং বা নাম খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Room Capacity & Legend Bar */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-md bg-emerald-500/20 border border-emerald-500/60"></div>
              <span className="text-slate-300">খালি ({roomStats.available})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-md bg-rose-500/30 border border-rose-500/80"></div>
              <span className="text-slate-300">উপস্থিত ({roomStats.occupied})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-md bg-amber-500/30 border border-amber-500/80"></div>
              <span className="text-slate-300">সাময়িক বিরতি ({roomStats.away})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-md bg-purple-500/40 border border-purple-400"></div>
              <span className="text-slate-300">সেকেন্ডারি বুকার ({roomStats.secondaryOccupied})</span>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            রুমের মোট ক্ষমতা: <span className="font-bold text-white">{currentRoomConfig.capacity || 100} টি সিট</span>
          </div>
        </div>

        {/* 🌟 100-SEAT MATRIX GRID */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 sm:gap-2.5">
            {Array.from({ length: currentRoomConfig.capacity || 100 }, (_, i) => i + 1).map((seatNum) => {
              const booking = roomBookingsMap.get(seatNum);
              const isMine = !!(user && booking && ((user.uid && booking.userId === user.uid) || (user.email && booking.userEmail === user.email)));
              const isMySecondary = !!(user && booking && ((user.uid && booking.secondaryUserId === user.uid) || (user.email && booking.secondaryUserEmail === user.email)));
              
              const isAway = !!(booking && booking.isAway && booking.awayUntil && new Date(booking.awayUntil).getTime() > currentTime.getTime());
              const hasSecondary = !!(isAway && booking?.secondaryUserId);
              const remainingTime = isAway ? getRemainingTimeData(booking.awayUntil) : null;

              // Filter match
              const matchesSearch = searchQuery === '' || 
                seatNum.toString().includes(searchQuery) ||
                booking?.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                booking?.secondaryUserName?.toLowerCase().includes(searchQuery.toLowerCase());

              if (!matchesSearch) return null;

              return (
                <div
                  key={seatNum}
                  onClick={() => {
                    if (!isWithinOperatingHours) {
                      alert('সিট বরাদ্দ সকাল ৮:০০ টা থেকে রাত ১০:০০ টা পর্যন্ত চালু থাকে।');
                      return;
                    }

                    if (!booking) {
                      // Seat is empty -> open primary booking modal
                      setSelectedSeat(seatNum);
                      setShowBookingModal(true);
                    } else if (isAway && !hasSecondary && !isMine) {
                      // Seat is in temporary away & no secondary booker yet -> open secondary booking modal!
                      setSelectedSeat(seatNum);
                      setShowSecondaryBookingModal(true);
                    } else if (isMine) {
                      setSelectedSeat(seatNum);
                      setShowAwayModal(true);
                    } else {
                      // Occupied seat details
                      alert(`সিট #${seatNum}\nরুম: ${currentRoomConfig.name}\nবুক করেছেন: ${booking.userName}${hasSecondary ? `\nসেকেন্ডারি বুকার: ${booking.secondaryUserName}` : ''}${isAway ? `\nবিরতি: বাকি ${remainingTime?.text}` : ''}`);
                    }
                  }}
                  className={`relative p-2 rounded-xl flex flex-col items-center justify-between min-h-[72px] sm:min-h-[82px] border transition cursor-pointer select-none group ${
                    isMine || isMySecondary
                      ? 'bg-indigo-600/30 border-indigo-400 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-400'
                      : hasSecondary
                      ? 'bg-purple-950/60 border-purple-500/80 hover:border-purple-400'
                      : isAway
                      ? 'bg-amber-950/40 border-amber-500/70 hover:border-amber-400 animate-pulse'
                      : booking
                      ? 'bg-slate-850 border-rose-500/40 hover:border-rose-400/80 text-slate-300'
                      : 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/80 hover:bg-emerald-950/20 text-slate-400'
                  }`}
                >
                  {/* Seat Number Badge */}
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[11px] font-black ${isMine ? 'text-indigo-300' : hasSecondary ? 'text-purple-300' : isAway ? 'text-amber-300' : booking ? 'text-rose-300' : 'text-slate-400'}`}>
                      #{seatNum}
                    </span>
                    {isMine && (
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
                    )}
                  </div>

                  {/* Seat Middle Status Icon / Timer */}
                  <div className="my-0.5 text-center">
                    {hasSecondary ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] bg-purple-500/40 text-purple-200 px-1 py-0.5 rounded font-black leading-none">
                          সেকেন্ডারি
                        </span>
                        <span className="text-[9px] text-amber-300 font-bold mt-0.5">
                          {remainingTime?.text}
                        </span>
                      </div>
                    ) : isAway ? (
                      <div className="flex flex-col items-center">
                        <Hourglass className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                        <span className="text-[9px] font-black text-amber-300 mt-0.5">
                          {remainingTime?.text}
                        </span>
                      </div>
                    ) : booking ? (
                      <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[9px] font-bold">
                        {booking.userName[0]?.toUpperCase() || 'U'}
                      </div>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-bold group-hover:scale-110 transition">
                        ফাঁকা
                      </span>
                    )}
                  </div>

                  {/* Seat Bottom Name Tag */}
                  <div className="w-full truncate text-[9px] text-center font-medium">
                    {hasSecondary ? (
                      <span className="text-purple-300 truncate font-bold">{booking?.secondaryUserName?.split(' ')[0]}</span>
                    ) : isAway ? (
                      <span className="text-amber-300 font-bold">বিরতি</span>
                    ) : booking ? (
                      <span className="text-slate-400 truncate">{booking.userName.split(' ')[0]}</span>
                    ) : (
                      <span className="text-slate-500 font-normal">বুক করুন</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 🌟 MODAL 1: BOOK SEAT CONFIRMATION (PRIMARY) */}
      {showBookingModal && selectedSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl text-white">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto text-xl font-black mb-2">
                #{selectedSeat}
              </div>
              <h3 className="text-lg font-black text-white">
                সিট #{selectedSeat} বরাদ্দ নিশ্চিতকরণ
              </h3>
              <p className="text-xs text-slate-400">
                {currentRoomConfig.name} • {libraryType === 'science' ? 'সাইন্স লাইব্রেরি' : 'সেন্ট্রাল লাইব্রেরি'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-800/80 rounded-2xl text-xs space-y-2 border border-slate-700">
              <div className="flex justify-between text-slate-400">
                <span>শিক্ষার্থীর নাম:</span>
                <span className="font-bold text-white">{user?.displayName || user?.email?.split('@')[0]}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>সময়সূচী:</span>
                <span className="font-bold text-emerald-400">রাত ১০:০০ টা পর্যন্ত</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>নিয়মাবলী:</span>
                <span className="font-bold text-amber-300">১ জন = সর্বোচ্চ ১টি সিট</span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => handleConfirmBooking(selectedSeat)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                সিট কনফার্ম করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL 2: SECONDARY BOOKING ON TEMPORARY AWAY SEAT */}
      {showSecondaryBookingModal && selectedSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs">
          <div className="bg-slate-900 border-2 border-purple-500/50 rounded-3xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl text-white">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/40 flex items-center justify-center mx-auto text-xl font-black mb-2">
                <UserPlus className="w-6 h-6" />
              </div>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 font-black px-2.5 py-0.5 rounded-full border border-purple-500/30 uppercase tracking-wider">
                সেকেন্ডারি বুকার
              </span>
              <h3 className="text-lg font-black text-white">
                সিট #{selectedSeat} সাময়িক বুকিং
              </h3>
              <p className="text-xs text-slate-400">
                মূল শিক্ষার্থী সাময়িক বিরতিতে থাকায় আপনি এই সময়ে সিটটি ব্যবহার করতে পারবেন।
              </p>
            </div>

            {(() => {
              const targetBooking = roomBookingsMap.get(selectedSeat);
              const remaining = getRemainingTimeData(targetBooking?.awayUntil);
              return (
                <div className="p-3.5 bg-purple-950/30 rounded-2xl text-xs space-y-2 border border-purple-500/30">
                  <div className="flex justify-between text-slate-300">
                    <span>মূল বরাদ্দকারী:</span>
                    <span className="font-bold text-white">{targetBooking?.userName}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>বিরতির কারণ:</span>
                    <span className="font-bold text-amber-300">{targetBooking?.awayReason}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>অবশিষ্ট সময়:</span>
                    <span className="font-black text-purple-300">{remaining?.text}</span>
                  </div>
                </div>
              );
            })()}

            <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-800/60 p-2.5 rounded-xl">
              💡 মূল শিক্ষার্থী বিরতি শেষে ফিরে এলে সিটটি হস্তান্তর করতে হবে।
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSecondaryBookingModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmSecondaryBooking}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl transition shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                সেকেন্ডারি বুক করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL 3: TEMPORARY AWAY TIMER MODAL (WITH MANUAL MINUTE INPUT) */}
      {showAwayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl text-white">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto text-xl mb-2">
                <Coffee className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">
                সাময়িক বিরতির সময় নির্ধারণ
              </h3>
              <p className="text-xs text-slate-400">
                বিরতি চলাকালীন অন্য শিক্ষার্থী প্রয়োজনে সেকেন্ডারি হিসেবে সিটটি ব্যবহার করতে পারবে।
              </p>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">কুইক সিলেক্ট (মিনিট):</label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setAwayMinutes(m);
                      setCustomMinutesInput(m.toString());
                    }}
                    className={`py-2 rounded-xl text-xs font-black transition border cursor-pointer ${
                      customMinutesInput === m.toString()
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    {m} মিনিট
                  </button>
                ))}
              </div>
            </div>

            {/* 🌟 MANUAL MINUTES INPUT OPTION */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                ম্যানুয়াল সময় নির্ধারণ (মিনিট লিখুন):
              </label>
              <div className="relative">
                <Timer className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="5"
                  max="180"
                  placeholder="যেমন: ২৫, ৪০, ৭৫..."
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">বিরতির কারণ:</label>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {['চা/নাস্তা', 'নামাযের বিরতি', 'জরুরি কাজ'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setAwayReason(r);
                      setCustomReasonInput(r);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                      customReasonInput === r
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="অন্য কোনো কারণ লিখুন..."
                value={customReasonInput}
                onChange={(e) => setCustomReasonInput(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 leading-relaxed">
              ⚠️ সাময়িক বিরতি শুরু হলে নির্ধারিত সময়ের আগে বিরতি বাতিল বা ক্যান্সেল করা যাবে না।
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAwayModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSetAwayTimer}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/30 cursor-pointer"
              >
                বিরতি শুরু করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL 4: ADMIN SEAT CONTROL PANEL (mohammad.001ekram@gmail.com) */}
      {showAdminPanel && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black text-white">
                    লাইব্রেরি সিট কন্ট্রোল প্যানেল
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  রুম নাম্বার, প্রতি রুমে সিটের সংখ্যা এবং সিটের সিরিয়াল নিয়ন্ত্রণ করুন।
                </p>
              </div>
              <button
                onClick={() => setShowAdminPanel(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Room Management List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-200 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>রুম ও সিট ক্যাপাসিটি তালিকা</span>
                </h4>

                <button
                  type="button"
                  onClick={() => {
                    const nextId = adminRooms.length > 0 ? Math.max(...adminRooms.map(r => r.id)) + 1 : 1;
                    setAdminRooms([...adminRooms, { id: nextId, name: `রুম ${nextId}`, capacity: 100 }]);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন রুম যোগ করুন</span>
                </button>
              </div>

              <div className="space-y-3">
                {adminRooms.map((r, index) => (
                  <div key={r.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                        {r.id}
                      </span>
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => {
                          const updated = [...adminRooms];
                          updated[index].name = e.target.value;
                          setAdminRooms(updated);
                        }}
                        className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-amber-500 w-32"
                        placeholder="রুমের নাম"
                      />
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 font-bold">সিট সংখ্যা:</label>
                        <input
                          type="number"
                          min="10"
                          max="300"
                          value={r.capacity}
                          onChange={(e) => {
                            const updated = [...adminRooms];
                            updated[index].capacity = parseInt(e.target.value, 10) || 100;
                            setAdminRooms(updated);
                          }}
                          className="w-20 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold text-center focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {adminRooms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAdminRooms(adminRooms.filter(item => item.id !== r.id));
                          }}
                          className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                          title="রুম ডিলিট করুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Danger Zone Operations */}
            <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-2xl space-y-3">
              <h5 className="text-xs font-black text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>জরুরি সিট রিসেট অপারেশন (Reset Zone)</span>
              </h5>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-rose-200/80">
                  বর্তমান লাইব্রেরির সকল রুমের সিট এক ক্লিকে খালি ও রিসেট করুন।
                </p>
                <button
                  type="button"
                  onClick={handleAdminResetAllSeats}
                  className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer shrink-0"
                >
                  সকল সিট খালি করুন
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAdminPanel(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSaveAdminConfig}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                কনফিগারেশন সেভ করুন
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default LibrarySeatBookingView;
