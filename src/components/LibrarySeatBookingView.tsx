import React, { useState, useEffect, useMemo } from 'react';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from '../lib/db';
import { LibraryType, SeatBooking } from '../types/library';
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
  UserCheck
} from 'lucide-react';

interface LibrarySeatBookingViewProps {
  libraryType: LibraryType;
  user: any;
  onBackToHome: () => void;
  onOpenStudyRoom: () => void;
  onRequireAuth: () => void;
}

const ROOMS = [
  { id: 1, name: 'রুম ১' },
  { id: 2, name: 'রুম ২' },
  { id: 3, name: 'রুম ৩' },
  { id: 4, name: 'রুম ৪' },
];

export const LibrarySeatBookingView: React.FC<LibrarySeatBookingViewProps> = ({
  libraryType,
  user,
  onBackToHome,
  onOpenStudyRoom,
  onRequireAuth,
}) => {
  const [selectedRoom, setSelectedRoom] = useState<number>(1);
  const [bookings, setBookings] = useState<SeatBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  
  // Modal states for booking / managing seat
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [showAwayModal, setShowAwayModal] = useState<boolean>(false);
  const [awayMinutes, setAwayMinutes] = useState<number>(30);
  const [awayReason, setAwayReason] = useState<string>('চা/নাস্তার বিরতি');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // 1-second live clock for counting down temporary away timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const collectionName = `library_seats_${libraryType}`;
  const localCacheKey = `cache_seats_${libraryType}`;

  useEffect(() => {
    setLoading(true);
    // Load local cache initially
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
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as SeatBooking);
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

  // Current user's existing booking in this library
  const myBooking = useMemo(() => {
    if (!user?.uid && !user?.email) return null;
    return bookings.find(b => 
      (user.uid && b.userId === user.uid) || 
      (user.email && b.userEmail?.toLowerCase() === user.email.toLowerCase())
    );
  }, [bookings, user]);

  // Room bookings map: seatNumber -> booking
  const roomBookingsMap = useMemo(() => {
    const map = new Map<number, SeatBooking>();
    bookings.filter(b => b.roomId === selectedRoom).forEach(b => {
      map.set(b.seatNumber, b);
    });
    return map;
  }, [bookings, selectedRoom]);

  // Room stats
  const roomStats = useMemo(() => {
    let occupied = 0;
    let away = 0;
    roomBookingsMap.forEach(b => {
      if (b.isAway && b.awayUntil && new Date(b.awayUntil).getTime() > currentTime.getTime()) {
        away++;
      } else {
        occupied++;
      }
    });
    return {
      occupied,
      away,
      available: 100 - (occupied + away)
    };
  }, [roomBookingsMap, currentTime]);

  // Handle Book Seat
  const handleConfirmBooking = async (seatNum: number) => {
    if (!user) {
      onRequireAuth();
      return;
    }

    if (myBooking) {
      alert(`আপনার ইতিমধ্যে ${myBooking.libraryId === 'science' ? 'সাইন্স' : 'সেন্ট্রাল'} লাইব্রেরির রুম ${myBooking.roomId}-এ সিট #${myBooking.seatNumber} বুক করা আছে। নতুন সিট বুক করার আগে পূর্বের সিটটি ছাড়ুন।`);
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

  // Handle Cancel / Release Seat
  const handleReleaseSeat = async (bookingToRelease?: SeatBooking) => {
    const target = bookingToRelease || myBooking;
    if (!target) return;

    if (!confirm(`আপনি কি নিশ্চিতভাবে রুম ${target.roomId}-এর সিট #${target.seatNumber} ছেড়ে দিতে চান?`)) {
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

  // Handle Set Temporary Away Timer
  const handleSetAwayTimer = async () => {
    if (!myBooking) return;
    const returnTime = new Date(Date.now() + awayMinutes * 60 * 1000).toISOString();
    const docId = `r${myBooking.roomId}_s${myBooking.seatNumber}`;

    const updatedBooking: SeatBooking = {
      ...myBooking,
      isAway: true,
      awayReason: awayReason || 'সাময়িক বিরতি',
      awayMinutes: awayMinutes,
      awayUntil: returnTime,
    };

    try {
      await setDoc(doc(db, collectionName, docId), updatedBooking);
      const updated = bookings.map(b => (b.roomId === myBooking.roomId && b.seatNumber === myBooking.seatNumber ? updatedBooking : b));
      setBookings(updated);
      localStorage.setItem(localCacheKey, JSON.stringify(updated));
      setShowAwayModal(false);
    } catch (err: any) {
      console.error('Away timer error:', err);
      alert('টাইমার সেট করতে সমস্যা হয়েছে: ' + (err?.message || ''));
    }
  };

  // Handle Return / Cancel Away Status
  const handleCancelAway = async () => {
    if (!myBooking) return;
    const docId = `r${myBooking.roomId}_s${myBooking.seatNumber}`;
    const updatedBooking: SeatBooking = {
      ...myBooking,
      isAway: false,
      awayReason: undefined,
      awayUntil: undefined,
      awayMinutes: undefined,
    };

    try {
      await setDoc(doc(db, collectionName, docId), updatedBooking);
      const updated = bookings.map(b => (b.roomId === myBooking.roomId && b.seatNumber === myBooking.seatNumber ? updatedBooking : b));
      setBookings(updated);
      localStorage.setItem(localCacheKey, JSON.stringify(updated));
      setShowAwayModal(false);
    } catch (err: any) {
      console.error('Cancel away error:', err);
    }
  };

  // Format real-time countdown
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

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white flex flex-col font-sans pb-16">
      
      {/* Top Header Bar */}
      <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold border border-slate-700 cursor-pointer shadow-xs"
            title="হোমপেজে ফিরুন"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">হোমপেজ</span>
          </button>

          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl text-lg ${libraryType === 'science' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
              {libraryType === 'science' ? '🧪' : '🏛️'}
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                {libraryType === 'science' ? 'সাইন্স লাইব্রেরি' : 'সেন্ট্রাল লাইব্রেরি'}
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">সিট নির্বাচন ও লাইভ বুকিং</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {user ? (
            <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <span className="font-bold text-slate-300 max-w-[120px] truncate">
                {user.displayName || user.email?.split('@')[0]}
              </span>
            </div>
          ) : (
            <button
              onClick={onRequireAuth}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
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

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* User's Active Booking Banner */}
        {myBooking && (
          <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-md">
                #{myBooking.seatNumber}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-300">
                    আপনার বুক করা সিট (রুম {myBooking.roomId} • #{myBooking.seatNumber})
                  </span>
                </div>
                <p className="text-sm font-bold text-white">
                  {myBooking.isAway && myBooking.awayUntil && new Date(myBooking.awayUntil).getTime() > currentTime.getTime() ? (
                    <span className="text-yellow-400 flex items-center gap-1.5">
                      <Hourglass className="w-4 h-4 animate-spin text-yellow-400" />
                      বিরতিতে আছেন: বাকি {getRemainingTimeData(myBooking.awayUntil)?.text} ({myBooking.awayReason})
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      বর্তমানে স্টাডি রুমে সক্রিয় আছেন
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {myBooking.isAway && myBooking.awayUntil && new Date(myBooking.awayUntil).getTime() > currentTime.getTime() ? (
                <button
                  onClick={handleCancelAway}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>বিরতি শেষ / সিটে ফিরুন</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowAwayModal(true)}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border border-yellow-400/40 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>সাময়িক বিরতি / টাইমার</span>
                </button>
              )}

              <button
                onClick={() => handleReleaseSeat()}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>সিট ছাড়ুন</span>
              </button>
            </div>
          </div>
        )}

        {/* Room Navigation & Status Legend */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-6 shadow-xl">
          
          {/* Room Selector & Live Status Counters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            
            {/* Room Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
              {ROOMS.map(r => {
                const isSelected = selectedRoom === r.id;
                const count = bookings.filter(b => b.roomId === r.id).length;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoom(r.id)}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-between gap-2 cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                    }`}
                  >
                    <span>{r.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {count}/100
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Status Legend (সবুজ = ফাঁকা, লাল = বুকড, হলুদ = বিরতি) */}
            <div className="flex items-center justify-around sm:justify-end gap-3 sm:gap-4 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <div className="w-3 h-3 rounded-md bg-emerald-500" />
                <span>ফাঁকা ({roomStats.available})</span>
              </div>
              <div className="flex items-center gap-1.5 text-red-400">
                <div className="w-3 h-3 rounded-md bg-red-600" />
                <span>বুকড ({roomStats.occupied})</span>
              </div>
              <div className="flex items-center gap-1.5 text-yellow-400">
                <div className="w-3 h-3 rounded-md bg-yellow-400" />
                <span>বিরতি ({roomStats.away})</span>
              </div>
            </div>
          </div>

          {/* Quick Filter Input */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-white">
              {ROOMS.find(r => r.id === selectedRoom)?.name}-এর সিট বিন্যাস (১ - ১০০)
            </h3>

            <div className="relative w-48 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="সিট নং বা নাম লিখুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 100 Seats Interactive Grid Layout */}
          <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-10 lg:grid-cols-10 gap-2 sm:gap-2.5">
            {Array.from({ length: 100 }, (_, i) => i + 1).map((seatNum) => {
              const booking = roomBookingsMap.get(seatNum);
              const isOccupied = !!booking;
              const isMine = booking && (
                (user?.uid && booking.userId === user.uid) || 
                (user?.email && booking.userEmail?.toLowerCase() === user.email.toLowerCase())
              );
              const isAway = booking?.isAway && booking?.awayUntil && new Date(booking.awayUntil).getTime() > currentTime.getTime();
              const awayData = isAway ? getRemainingTimeData(booking?.awayUntil) : null;

              // Search filtering
              const matchesSearch = searchQuery.trim() === '' || 
                seatNum.toString().includes(searchQuery.trim()) ||
                (booking?.userName && booking.userName.toLowerCase().includes(searchQuery.toLowerCase()));

              if (!matchesSearch) {
                return (
                  <div 
                    key={seatNum}
                    className="opacity-20 border border-slate-800 rounded-xl p-2 text-center text-xs font-bold text-slate-600 bg-slate-950"
                  >
                    #{seatNum}
                  </div>
                );
              }

              // SEAT DESIGN:
              // 1. Available -> Bright Green (সবুজ)
              // 2. Booked -> Bright Red (লাল)
              // 3. Away -> Bright Yellow with big countdown across seat (হলুদ)
              return (
                <button
                  key={seatNum}
                  onClick={() => {
                    if (!user) {
                      onRequireAuth();
                      return;
                    }
                    if (!isOccupied) {
                      setSelectedSeat(seatNum);
                      setShowBookingModal(true);
                    } else if (isMine) {
                      // Allow direct access to away/release
                      if (isAway) {
                        handleCancelAway();
                      } else {
                        setShowAwayModal(true);
                      }
                    } else {
                      setSelectedSeat(seatNum);
                    }
                  }}
                  className={`relative rounded-xl p-2 flex flex-col items-center justify-between min-h-[76px] sm:min-h-[82px] transition-all cursor-pointer shadow-sm ${
                    isAway
                      ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 border-2 border-yellow-300 font-black shadow-md shadow-yellow-500/20 animate-pulse'
                      : isOccupied
                      ? 'bg-red-600 hover:bg-red-500 text-white border-2 border-red-500 font-bold shadow-md shadow-red-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-400 font-bold hover:scale-[1.04] shadow-md shadow-emerald-600/20'
                  }`}
                  title={
                    isOccupied 
                      ? `সিট #${seatNum}: ${booking?.userName} ${isAway ? `(বিরতিতে: ${awayData?.text})` : '(বুকড)'}` 
                      : `সিট #${seatNum}: ফাঁকা (ক্লিক করে বুক করুন)`
                  }
                >
                  {/* Top: Seat Number */}
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] sm:text-xs font-black">
                      #{seatNum}
                    </span>

                    {isMine && (
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    )}
                  </div>

                  {/* Middle Area: Full-Seat Countdown Timer for Away OR Status Icon */}
                  {isAway ? (
                    <div className="w-full flex flex-col items-center justify-center my-0.5">
                      <div className="text-xs sm:text-sm font-black tracking-tight text-slate-950 flex items-center gap-0.5">
                        <Clock className="w-3 h-3 text-slate-950 shrink-0" />
                        <span>{awayData?.text}</span>
                      </div>
                      <span className="text-[8px] font-extrabold uppercase text-slate-900 tracking-wider">
                        বিরতি
                      </span>
                    </div>
                  ) : isOccupied ? (
                    <div className="w-full flex flex-col items-center justify-center my-0.5">
                      <div className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold">
                        {booking?.userName ? booking.userName[0].toUpperCase() : 'U'}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center justify-center my-0.5">
                      <div className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center text-[11px] font-black">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  )}

                  {/* Bottom: Name or Status */}
                  <div className="w-full text-center truncate">
                    {isAway ? (
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-950 block truncate">
                        {booking?.userName?.split(' ')[0] || 'বিরতি'}
                      </span>
                    ) : isOccupied ? (
                      <span className="text-[8px] sm:text-[9px] font-bold text-white/90 block truncate">
                        {isMine ? 'আমার সিট' : booking?.userName?.split(' ')[0] || 'বুকড'}
                      </span>
                    ) : (
                      <span className="text-[8px] sm:text-[9px] font-black text-white block truncate">
                        ফাঁকা
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- MODAL 1: Confirm Booking Modal --- */}
      {showBookingModal && selectedSeat && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">সিট বুকিং</h3>
              <button
                onClick={() => setShowBookingModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">লাইব্রেরি ও রুম:</span>
                <span className="font-bold text-white">
                  {libraryType === 'science' ? 'সাইন্স লাইব্রেরি' : 'সেন্ট্রাল লাইব্রেরি'} • রুম {selectedRoom}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">সিট নম্বর:</span>
                <span className="text-base font-black text-emerald-400">সিট #{selectedSeat}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">আপনার নাম:</span>
                <span className="font-bold text-white">{user?.displayName || user?.email?.split('@')[0]}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => handleConfirmBooking(selectedSeat)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                বুক করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Temporary Away & Timer Modal --- */}
      {showAwayModal && myBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-yellow-400/60 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Coffee className="w-4 h-4 text-yellow-400" />
                <span>সাময়িক বিরতি ও টাইমার সেট</span>
              </h3>
              <button
                onClick={() => setShowAwayModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="font-bold text-slate-300 block">বিরতির কারণ:</label>
              <input
                type="text"
                value={awayReason}
                onChange={(e) => setAwayReason(e.target.value)}
                placeholder="যেমন: চা/নাস্তার বিরতি, নামাজ..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-yellow-400"
              />

              <label className="font-bold text-slate-300 block pt-1">কতক্ষণ পর ফিরবেন (মিনিট):</label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setAwayMinutes(mins)}
                    className={`py-2 rounded-xl font-black text-xs transition cursor-pointer border ${
                      awayMinutes === mins
                        ? 'bg-yellow-400 text-slate-950 border-yellow-300 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {mins} মিনিট
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAwayModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSetAwayTimer}
                className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer shadow-lg shadow-yellow-400/30"
              >
                টাইমার চালু করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibrarySeatBookingView;
