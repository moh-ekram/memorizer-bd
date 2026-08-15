export type LibraryType = 'science' | 'central';

export interface SeatBooking {
  seatNumber: number; // 1 to 100 or customized
  libraryId: LibraryType;
  roomId: number; // 1, 2, 3, 4 etc.
  userId: string;
  userEmail: string;
  userName: string;
  userPhoto?: string;
  bookedAt: string; // ISO string
  isAway?: boolean;
  awayReason?: string;
  awayUntil?: string; // ISO string when user expects to return
  awayMinutes?: number;
  notes?: string;

  // Secondary booker during temporary away status
  secondaryUserId?: string;
  secondaryUserEmail?: string;
  secondaryUserName?: string;
  secondaryBookedAt?: string;
}

export interface LibraryRoomConfig {
  id: number;
  name: string;
  capacity: number; // default 100
  seatPrefix?: string; // default ''
}

export interface LibraryConfig {
  rooms: LibraryRoomConfig[];
  bookingStartHour: number; // 8 (8:00 AM)
  bookingEndHour: number; // 22 (10:00 PM)
  updatedAt?: string;
}

export const DEFAULT_LIBRARY_CONFIG: LibraryConfig = {
  rooms: [
    { id: 1, name: 'রুম ১', capacity: 100 },
    { id: 2, name: 'রুম ২', capacity: 100 },
    { id: 3, name: 'রুম ৩', capacity: 100 },
    { id: 4, name: 'রুম ৪', capacity: 100 },
  ],
  bookingStartHour: 8,
  bookingEndHour: 22,
};
