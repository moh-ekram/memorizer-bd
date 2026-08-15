export type LibraryType = 'science' | 'central';

export interface SeatBooking {
  seatNumber: number; // 1 to 100
  libraryId: LibraryType;
  roomId: number; // 1, 2, 3, 4
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
}

export interface LibraryRoomInfo {
  id: number;
  name: string;
  bengaliName: string;
  capacity: number; // 100
}
