import React, { useState, useEffect, useMemo } from 'react';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot
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
  Coffee, 
  LogIn,
  Search, 
  Shield,
  Settings2,
  Plus,
  Trash2,
  Timer,
  User,
  Users,
  UserCheck,
  Armchair,
  UserPlus,
  Hash,
  Layers
} from 'lucide-react';

interface LibrarySeatBookingViewProps {
  libraryType: LibraryType;
  user: any;
  onBackToHome: () => void;
  onOpenStudyRoom: () => void;
  onRequireAuth: () => void;
}

const ADMIN_EMAIL = 'mohammad.001ekram@gmail.com';

// Helper to compute formatted seat serial label
export const formatSeatLabel = (seatNum: number, roomConfig?: LibraryRoomConfig): string => {
  if (!roomConfig) return `${seatNum}`;

  const style = roomConfig.numberingStyle || (roomConfig.seatPrefix ? 'prefix' : 'numeric');

  if (style === 'prefix' && roomConfig.seatPrefix) {
    return `${roomConfig.seatPrefix}${seatNum}`;
  }

  if (style === 'grid_rows') {
    const rowIdx = Math.floor((seatNum - 1) / 10);
    const colIdx = ((seatNum - 1) % 10) + 1;
    const rowLetter = String.fromCharCode(65 + (rowIdx % 26)); // A, B, C, D...
    const rowPrefix = rowIdx >= 26 ? `${Math.floor(rowIdx / 26) + 1}` : '';
    return `${rowLetter}${rowPrefix}${colIdx}`;
  }

  if (roomConfig.seatPrefix && roomConfig.seatPrefix.trim() !== '') {
    return `${roomConfig.seatPrefix}${seatNum}`;
  }

  return `${seatNum}`;
};

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

  // Load Library Config (Rooms & Capacities & Serial Layouts)
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
    return config.rooms.find(r => r.id === selectedRoom) || config.rooms[0] || { 
      id: 1, 
      name: 'রুম ১', 
      capacity: 100, 
      seatPrefix: '', 
      numberingStyle: 'numeric' 
    };
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
      const existingRoom = config.rooms.find(r => r.id === existing?.roomId);
      const formattedNum = formatSeatLabel(existing?.seatNumber || 1, existingRoom);
      alert(`আপনি ইতিমধ্যে ${existingRoom?.name || `রুম ${existing?.roomId}`}-এ সিট ${formattedNum} বরাদ্দ নিয়েছেন। একজন শিক্ষার্থী সর্বোচ্চ ১টি সিট নিতে পারেন। নতুন সিট নিতে আগেরটি ছেড়ে দিন।`);
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
      const existingRoom = config.rooms.find(r => r.id === existing?.roomId);
      const formattedNum = formatSeatLabel(existing?.seatNumber || 1, existingRoom);
      alert(`আপনি ইতিমধ্যে ${existingRoom?.name || `রুম ${existing?.roomId}`}-এ সিট ${formattedNum} বরাদ্দ নিয়েছেন। নতুন সিট নেয়ার পূর্বে আগের সিট ছেড়ে দিন।`);
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

  // 🌟 Handle Release Seat (Student releases their own seat; Admin cannot forcibly empty other's seats)
  const handleReleaseSeat = async () => {
    const target = myPrimaryBooking || mySecondaryBooking;
    if (!target) return;

    // If user is secondary booker, only release their secondary reservation
    if (mySecondaryBooking && target.seatNumber === mySecondaryBooking.seatNumber && target.roomId === mySecondaryBooking.roomId) {
      const formattedLabel = formatSeatLabel(target.seatNumber, currentRoomConfig);
      if (!confirm(`আপনি কি সিট ${formattedLabel}-এর সেকেন্ডারি ব্যবহার ছেড়ে দিতে চান?`)) return;
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

    const formattedLabel = formatSeatLabel(target.seatNumber, currentRoomConfig);
    if (!confirm(`আপনি কি নিশ্চিতভাবে রুম ${target.roomId}-এর সিট ${formattedLabel} সম্পূর্ণরূপে ছেড়ে দিতে চান?`)) {
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

  // 🌟 ADMIN CONTROLS: Save Room & Seat Serial Config (No seat clearing powers)
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
      alert('লাইব্রেরির রুম, সিটের সংখ্যা এবং সিরিয়াল বিন্যাস সফলভাবে সেভ হয়েছে!');
      setShowAdminPanel(false);
    } catch (e: any) {
      console.error('Save config error:', e);
      alert('কনফিগারেশন সেভ করতে সমস্যা হয়েছে: ' + e?.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans pb-16">
      
      {/* Top Header Bar - Clean Minimalist Light Mode */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="হোমপেজে ফিরুন"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">হোম</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-base">
              {libraryType === 'science' ? '🧪' : '🏛️'}
            </span>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                {libraryType === 'science' ? 'সাইন্স লাইব্রেরি' : 'সেন্ট্রাল লাইব্রেরি'}
              </h1>
              <p className="text-[11px] text-slate-500 font-normal">
                সিট বুকিং • সকাল ৮:০০ – রাত ১০:০০
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {/* Admin Control Panel Button */}
          {isAdmin && (
            <button
              onClick={() => {
                setAdminRooms(config.rooms);
                setShowAdminPanel(true);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="সিট কন্ট্রোল প্যানেল"
            >
              <Settings2 className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">সিট কন্ট্রোল</span>
            </button>
          )}

          {user ? (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-xs text-slate-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="max-w-[100px] truncate">
                {user.displayName || user.email?.split('@')[0]}
              </span>
            </div>
          ) : (
            <button
              onClick={onRequireAuth}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>লগইন</span>
            </button>
          )}

          <button
            onClick={onOpenStudyRoom}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>স্টাডি রুম</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl w-full mx-auto p-3.5 sm:p-5 lg:p-6 space-y-4">
        
        {/* Operating Hours Alert Banner (If outside 8:00 AM - 10:00 PM) */}
        {!isWithinOperatingHours && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 flex items-center gap-3 text-amber-900 text-xs">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold text-amber-950">বর্তমানে সিট বরাদ্দ বন্ধ রয়েছে: </span>
              <span className="text-amber-800 font-normal">সিট বরাদ্দ প্রতিদিন সকাল ৮:০০ টা থেকে রাত ১০:০০ টা পর্যন্ত চালু থাকে।</span>
            </div>
          </div>
        )}

        {/* 🌟 USER'S ACTIVE BOOKING BANNER (Clean, Calm, Minimal) */}
        {hasAnyActiveBooking && (
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-2xs">
                {formatSeatLabel(myPrimaryBooking?.seatNumber || mySecondaryBooking?.seatNumber || 1, currentRoomConfig)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">
                    {myPrimaryBooking ? 'আপনার সিট' : 'সেকেন্ডারি ব্যবহার'} ({currentRoomConfig.name} • সিট {formatSeatLabel(myPrimaryBooking?.seatNumber || mySecondaryBooking?.seatNumber || 1, currentRoomConfig)})
                  </span>
                  {mySecondaryBooking && (
                    <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-medium">
                      সেকেন্ডারি
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {myPrimaryBooking?.isAway && myPrimaryBooking.awayUntil && new Date(myPrimaryBooking.awayUntil).getTime() > currentTime.getTime() ? (
                    <span className="text-amber-700 font-medium flex items-center gap-1.5">
                      <Hourglass className="w-3.5 h-3.5 animate-spin text-amber-600" />
                      বিরতিতে আছেন: বাকি {getRemainingTimeData(myPrimaryBooking.awayUntil)?.text} ({myPrimaryBooking.awayReason})
                    </span>
                  ) : mySecondaryBooking ? (
                    <span className="text-purple-700 font-medium flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-purple-600" />
                      মূল ব্যবহারকারীর বিরতির সময় ব্যবহার করছেন
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      সিট সক্রিয় ও উপস্থিত
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Only primary booker can set away timer */}
              {myPrimaryBooking && !myPrimaryBooking.isAway && (
                <button
                  onClick={() => setShowAwayModal(true)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5 text-amber-600" />
                  <span>সাময়িক বিরতি</span>
                </button>
              )}

              {myPrimaryBooking?.isAway && (
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-800 flex items-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>বিরতি চলমান</span>
                </div>
              )}

              <button
                onClick={() => handleReleaseSeat()}
                className="flex-1 sm:flex-initial px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>সিট ছাড়ুন</span>
              </button>
            </div>
          </div>
        )}

        {/* Room Navigation Tabs + Search Box */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-0.5">
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
            {config.rooms.map((room) => {
              const isSelected = selectedRoom === room.id;
              const countInRoom = bookings.filter(b => b.roomId === room.id).length;
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>{room.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'}`}>
                    {countInRoom}/{room.capacity || 100}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[130px] sm:min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="সিট নং খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Room Capacity & Status Legend Bar */}
        <div className="bg-white border border-slate-200 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4.5 text-slate-600">
            <div className="flex items-center gap-1.5">
              <Armchair className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.8} />
              <span>খালি <strong className="text-slate-800 font-bold">({roomStats.available})</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-rose-500" strokeWidth={2} />
              <span>উপস্থিত <strong className="text-slate-800 font-bold">({roomStats.occupied})</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-amber-500" strokeWidth={2} />
              <span>সাময়িক বিরতি <strong className="text-slate-800 font-bold">({roomStats.away})</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-600" strokeWidth={2} />
              <span>সেকেন্ডারি <strong className="text-slate-800 font-bold">({roomStats.secondaryOccupied})</strong></span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-normal">
            মোট সিট: <span className="text-slate-700 font-medium">{currentRoomConfig.capacity || 100}</span>
          </div>
        </div>

        {/* 🌟 SEAT MATRIX GRID - FULLY COLORED DIVS WITH MINIMAL LINE-DRAW ICONS & SEAT NUMBERS */}
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-4 shadow-2xs">
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 sm:gap-2">
            {Array.from({ length: currentRoomConfig.capacity || 100 }, (_, i) => i + 1).map((seatNum) => {
              const seatLabel = formatSeatLabel(seatNum, currentRoomConfig);
              const booking = roomBookingsMap.get(seatNum);
              const isMine = !!(user && booking && ((user.uid && booking.userId === user.uid) || (user.email && booking.userEmail === user.email)));
              const isMySecondary = !!(user && booking && ((user.uid && booking.secondaryUserId === user.uid) || (user.email && booking.secondaryUserEmail === user.email)));
              
              const isAway = !!(booking && booking.isAway && booking.awayUntil && new Date(booking.awayUntil).getTime() > currentTime.getTime());
              const hasSecondary = !!(isAway && booking?.secondaryUserId);
              const remainingTime = isAway ? getRemainingTimeData(booking.awayUntil) : null;

              // Filter match
              const matchesSearch = searchQuery === '' || 
                seatNum.toString().includes(searchQuery) ||
                seatLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
                booking?.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                booking?.secondaryUserName?.toLowerCase().includes(searchQuery.toLowerCase());

              if (!matchesSearch) return null;

              return (
                <button
                  key={seatNum}
                  type="button"
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
                      alert(`সিট: ${seatLabel}\nরুম: ${currentRoomConfig.name}\nবুক করেছেন: ${booking.userName}${hasSecondary ? `\nসেকেন্ডারি বুকার: ${booking.secondaryUserName}` : ''}${isAway ? `\nবিরতি: বাকি ${remainingTime?.text}` : ''}`);
                    }
                  }}
                  className={`relative rounded-lg sm:rounded-xl aspect-square flex flex-col items-center justify-center p-1 transition cursor-pointer select-none active:scale-95 border ${
                    isMine || isMySecondary
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-400 ring-offset-1 z-10'
                      : hasSecondary
                      ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                      : isAway
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs animate-pulse'
                      : booking
                      ? 'bg-rose-500 text-white border-rose-600 shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80 hover:border-slate-300'
                  }`}
                  title={`সিট ${seatLabel}${booking ? ` (${booking.userName})` : ' (খালি)'}`}
                >
                  {/* Away Seat -> Coffee Icon + Seat Label + Enlarged Countdown Timer */}
                  {isAway ? (
                    <div className="flex flex-col items-center justify-center leading-none text-center w-full">
                      <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white mb-0.5" strokeWidth={2} />
                      <span className="text-[9px] sm:text-[10px] text-white/90 font-semibold leading-none">
                        {seatLabel}
                      </span>
                      <span className="text-xs sm:text-sm font-black tracking-tight leading-tight mt-0.5 text-white drop-shadow-xs">
                        {remainingTime?.text}
                      </span>
                    </div>
                  ) : hasSecondary ? (
                    /* Secondary Occupied Seat -> Secondary Users Icon + Seat Label */
                    <div className="flex flex-col items-center justify-center leading-none text-center w-full">
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white mb-0.5" strokeWidth={2} />
                      <span className="text-[11px] sm:text-xs font-bold text-white leading-none">
                        {seatLabel}
                      </span>
                    </div>
                  ) : booking ? (
                    /* Booked/Occupied Seat -> Minimal Line Draw User Icon + Seat Label */
                    <div className="flex flex-col items-center justify-center leading-none text-center w-full">
                      {isMine ? (
                        <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white mb-0.5" strokeWidth={2.2} />
                      ) : (
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white mb-0.5" strokeWidth={2} />
                      )}
                      <span className="text-[11px] sm:text-xs font-bold text-white leading-none">
                        {seatLabel}
                      </span>
                    </div>
                  ) : (
                    /* Empty Seat -> Minimal Line Draw Armchair Icon + Seat Label */
                    <div className="flex flex-col items-center justify-center leading-none text-center w-full">
                      <Armchair className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 mb-0.5" strokeWidth={1.75} />
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-700 leading-none">
                        {seatLabel}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* 🌟 MODAL 1: BOOK SEAT CONFIRMATION (LIGHT MODE) */}
      {showBookingModal && selectedSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl text-slate-900">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto text-xl font-black mb-2 shadow-xs">
                {formatSeatLabel(selectedSeat, currentRoomConfig)}
              </div>
              <h3 className="text-lg font-black text-slate-900">
                সিট {formatSeatLabel(selectedSeat, currentRoomConfig)} বরাদ্দ নিশ্চিতকরণ
              </h3>
              <p className="text-xs text-slate-500">
                {currentRoomConfig.name} • {libraryType === 'science' ? 'সাইন্স লাইব্রেরি' : 'সেন্ট্রাল লাইব্রেরি'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl text-xs space-y-2 border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>শিক্ষার্থীর নাম:</span>
                <span className="font-bold text-slate-900">{user?.displayName || user?.email?.split('@')[0]}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>সময়সূচী:</span>
                <span className="font-bold text-emerald-600">রাত ১০:০০ টা পর্যন্ত</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>নিয়মাবলী:</span>
                <span className="font-bold text-amber-700">১ জন = সর্বোচ্চ ১টি সিট</span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => handleConfirmBooking(selectedSeat)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95"
              >
                সিট কনফার্ম করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL 2: SECONDARY BOOKING (LIGHT MODE) */}
      {showSecondaryBookingModal && selectedSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-purple-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl text-slate-900">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center mx-auto text-xl font-black mb-2 shadow-xs">
                <UserPlus className="w-6 h-6" />
              </div>
              <span className="text-[10px] bg-purple-100 text-purple-700 font-black px-2.5 py-0.5 rounded-full border border-purple-200 uppercase tracking-wider">
                সেকেন্ডারি বুকার
              </span>
              <h3 className="text-lg font-black text-slate-900">
                সিট {formatSeatLabel(selectedSeat, currentRoomConfig)} সাময়িক বুকিং
              </h3>
              <p className="text-xs text-slate-500">
                মূল শিক্ষার্থী সাময়িক বিরতিতে থাকায় আপনি এই সময়ে সিটটি ব্যবহার করতে পারবেন।
              </p>
            </div>

            {(() => {
              const targetBooking = roomBookingsMap.get(selectedSeat);
              const remaining = getRemainingTimeData(targetBooking?.awayUntil);
              return (
                <div className="p-3.5 bg-purple-50 rounded-2xl text-xs space-y-2 border border-purple-200">
                  <div className="flex justify-between text-slate-700">
                    <span>মূল বরাদ্দকারী:</span>
                    <span className="font-bold text-slate-900">{targetBooking?.userName}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>বিরতির কারণ:</span>
                    <span className="font-bold text-amber-700">{targetBooking?.awayReason}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>অবশিষ্ট সময়:</span>
                    <span className="font-black text-purple-700">{remaining?.text}</span>
                  </div>
                </div>
              );
            })()}

            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              💡 মূল শিক্ষার্থী বিরতি শেষে ফিরে এলে সিটটি হস্তান্তর করতে হবে।
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSecondaryBookingModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmSecondaryBooking}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl transition shadow-md shadow-purple-600/20 cursor-pointer active:scale-95"
              >
                সেকেন্ডারি বুক করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL 3: AWAY TIMER MODAL (LIGHT MODE) */}
      {showAwayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-amber-200 rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl text-slate-900">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto text-xl mb-2 shadow-xs">
                <Coffee className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                সাময়িক বিরতির সময় নির্ধারণ
              </h3>
              <p className="text-xs text-slate-500">
                বিরতি চলাকালীন অন্য শিক্ষার্থী প্রয়োজনে সেকেন্ডারি হিসেবে সিটটি ব্যবহার করতে পারবে।
              </p>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">কুইক সিলেক্ট (মিনিট):</label>
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
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {m} মিনিট
                  </button>
                ))}
              </div>
            </div>

            {/* 🌟 MANUAL MINUTES INPUT */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                ম্যানুয়াল সময় নির্ধারণ (মিনিট লিখুন):
              </label>
              <div className="relative">
                <Timer className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="5"
                  max="180"
                  placeholder="যেমন: ২৫, ৪০, ৭৫..."
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">বিরতির কারণ:</label>
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
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
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
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 leading-relaxed">
              ⚠️ সাময়িক বিরতি শুরু হলে নির্ধারিত সময়ের আগে বিরতি বাতিল বা ক্যান্সেল করা যাবে না।
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAwayModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSetAwayTimer}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
              >
                বিরতি শুরু করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL 4: ADMIN SEAT CONTROL PANEL (mohammad.001ekram@gmail.com) - Clean Light Mode with Serial Layout Configuration */}
      {showAdminPanel && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-3xl w-full space-y-6 shadow-2xl text-slate-900 max-h-[92vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">
                    লাইব্রেরি সিট কন্ট্রোল প্যানেল
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  রুম নাম্বার, প্রতি রুমে সিটের সংখ্যা এবং সিটের সিরিয়াল বিন্যাস (যেমন: A1, A2, A3... অথবা 1, 2, 3...) কনফিগার করুন।
                </p>
              </div>
              <button
                onClick={() => setShowAdminPanel(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Notice: No forced seat clearing */}
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3 text-xs text-blue-900 font-medium">
              <Layers className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>নিরাপত্তা ও নিয়ম:</strong> সিটের ধারাবাহিকতা রক্ষার জন্য সিট খালি করার কোনো ম্যানুয়াল বাটন নেই। শুধুমাত্র শিক্ষার্থীরা নিজেদের সিট ছাড়তে পারেন অথবা রাত ১০টায় স্বয়ংক্রিয়ভাবে সিট রিসেট হবে।
              </span>
            </div>

            {/* Room Management List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span>রুম, সিট সংখ্যা ও সিরিয়াল বিন্যাস তালিকা</span>
                </h4>

                <button
                  type="button"
                  onClick={() => {
                    const nextId = adminRooms.length > 0 ? Math.max(...adminRooms.map(r => r.id)) + 1 : 1;
                    setAdminRooms([...adminRooms, { 
                      id: nextId, 
                      name: `রুম ${nextId}`, 
                      capacity: 100,
                      seatPrefix: '',
                      numberingStyle: 'numeric'
                    }]);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন রুম যোগ করুন</span>
                </button>
              </div>

              <div className="space-y-3.5">
                {adminRooms.map((r, index) => {
                  const previewLabels = [1, 2, 3].map(n => formatSeatLabel(n, r)).join(', ');
                  return (
                    <div key={r.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3 shadow-2xs hover:border-slate-300 transition">
                      
                      {/* Row Top: Room ID, Name, Capacity, Delete */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                          <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
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
                            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 w-36"
                            placeholder="রুমের নাম"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-600 font-bold">সিট সংখ্যা:</label>
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
                              className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold text-center focus:outline-none focus:border-indigo-600"
                            />
                          </div>

                          {adminRooms.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdminRooms(adminRooms.filter(item => item.id !== r.id));
                              }}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                              title="রুম ডিলিট করুন"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Row Bottom: 🌟 SEAT SERIAL / NUMBERING STYLE SELECTOR */}
                      <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <Hash className="w-3.5 h-3.5 text-indigo-600" />
                            <span>সিরিয়াল ফরম্যাট:</span>
                          </div>

                          <select
                            value={r.numberingStyle || (r.seatPrefix ? 'prefix' : 'numeric')}
                            onChange={(e) => {
                              const updated = [...adminRooms];
                              const val = e.target.value as 'numeric' | 'prefix' | 'grid_rows';
                              updated[index].numberingStyle = val;
                              if (val === 'prefix' && !updated[index].seatPrefix) {
                                updated[index].seatPrefix = 'A';
                              }
                              setAdminRooms(updated);
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                          >
                            <option value="numeric">সংখ্যা (1, 2, 3... 100)</option>
                            <option value="prefix">কাস্টম প্রিফিক্স (A1, A2, A3...)</option>
                            <option value="grid_rows">রো ভিত্তিক (A1..A10, B1..B10...)</option>
                          </select>

                          {/* Custom Prefix text input if 'prefix' style selected */}
                          {(r.numberingStyle === 'prefix' || (!r.numberingStyle && r.seatPrefix)) && (
                            <div className="flex items-center gap-1.5">
                              <label className="text-slate-500 font-medium">প্রিফিক্স:</label>
                              <input
                                type="text"
                                maxLength={5}
                                value={r.seatPrefix || 'A'}
                                onChange={(e) => {
                                  const updated = [...adminRooms];
                                  updated[index].seatPrefix = e.target.value.toUpperCase();
                                  setAdminRooms(updated);
                                }}
                                className="w-14 px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-center text-indigo-700 focus:outline-none focus:border-indigo-600"
                                placeholder="A, B, S"
                              />
                            </div>
                          )}
                        </div>

                        {/* Live Preview Badge */}
                        <div className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] font-bold text-indigo-800">
                          প্রিভিউ: <span className="font-black text-indigo-600">{previewLabels}...</span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAdminPanel(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSaveAdminConfig}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
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
