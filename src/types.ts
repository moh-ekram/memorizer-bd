export interface VocabularyWord {
  id: string; // unique id, e.g. "g1-w1"
  group: number | string; // Support both numeric (1 to 37) and custom group names (like letter-based)
  word: string; // Base Word
  meaning: string; // Bengali Meaning
  synonyms: string; // Synonyms
  extraWord: string; // Word from extra column
  extraMeaning: string; // Meaning from extra column
  example?: string; // Optional usage sentence/example
  mnemonic?: string; // Mnemonic / memory aid note
}

export type WordStatus = 'know' | 'dont_know' | 'confusion' | 'unrated'; // 'know', 'dont_know', 'confusion', 'unrated'

export interface UserProgress {
  status: WordStatus;
  updatedAt: string;
  notes?: string; // Custom notes/mnemonic memory aid
  bookmarks?: string[]; // Custom folder IDs
  reviewAt?: string; // ISO date string for spaced repetition review
  repetitionCount?: number; // count of times studied
}

export interface CustomFolder {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
}

export type ActiveTab = 'profile' | 'dashboard' | 'my_courses' | 'flashcard' | 'synonym' | 'quiz' | 'match' | 'dictionary' | 'lists' | 'planner' | 'settings' | 'admin' | 'leaderboard' | 'practice' | 'study_tools' | 'story';

export interface AppSettings {
  defaultFlashcardTags: WordStatus[];
  defaultFlashcardOrder: 'serial' | 'alphabetical' | 'random';
  autoPlayAudio: boolean;
  quizLength: number;
  
  // New default settings fields for custom user defaults everywhere
  defaultSynonymOrder?: 'serial' | 'alphabetical' | 'random';
  defaultSynonymTags?: ('know' | 'dont_know' | 'unrated')[];
  defaultQuizType?: 'mcq_en_bn' | 'mcq_bn_en' | 'typing_spelling';
  defaultMatchSize?: number;

  // Keyboard Shortcuts Mapping: e.g. { "Space": "flip", "ArrowRight": "know" }
  shortcuts?: Record<string, string>;

  // Flashcard rotation animation
  flashcardAnimation?: 'flip-h' | 'flip-v' | 'diagonal' | 'shuffle';

  // Option to colorize main words on flashcards based on their status (Green for Learned/know, Red for Unlearned/dont_know, Amber for Confused/confusion)
  colorizeMainWord?: boolean;

  // Option to control daily dashboard full banner flashcard animation overlay
  flashcardBannerAnim?: 'twice_daily' | 'once_daily' | 'disabled';
  flashcardBannerCountPerDay?: number;
  flashcardBannerDurationSec?: number;

  // Practice & Quiz Modules Toggles
  enableBlankFillingGame?: boolean;
  enableWordAnalogyGame?: boolean;
  enableOddOneOutGame?: boolean;
  enableSynonymCheck?: boolean;
  enableWordMatchGame?: boolean;

  // Global Announcement / Notice / Ad Banner settings
  announcementEnabled?: boolean;
  announcementText?: string;
  announcementLink?: string;
  announcementLinkText?: string;
  announcementType?: 'info' | 'warning' | 'success' | 'promo';
  announcementClosable?: boolean;

  // System & Access Controls
  enableGlobalLeaderboard?: boolean;
  soundEffectsEnabled?: boolean;
  showBengaliTranslations?: boolean;
  dailyGoalWordCount?: number;
  freeFlashcardsCount?: number; // Free sample flashcards count for restricted courses (default 10)

  // Item Position & Ordering Settings
  practiceItemsOrder?: string[];
  studyToolsItemsOrder?: string[];

  // Starting Page / Landing Customization & Course Displayer
  landingBadgeText?: string;
  landingHeadlineMain?: string;
  landingCourseSuffix?: string;
  landingDescription?: string;
  landingStartBtnText?: string;
  landingFeature1?: string;
  landingFeature2?: string;
  landingStat1Num?: string;
  landingStat1Label?: string;
  landingStat2Num?: string;
  landingStat2Label?: string;
  landingStat3Num?: string;
  landingStat3Label?: string;
  landingDisplayCourses?: string[];
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'auto' | 'manual' | 'offline_queue' | 'cloud_fetch';
  message: string;
  status: 'success' | 'error';
  itemCount?: number;
}

export interface StudySession {
  date: string; // YYYY-MM-DD
  wordsStudied: number;
  correctAnswers: number;
  quizTaken: number;
}

export interface StudyGoal {
  dailyTarget: number; // e.g. 20 words
  streak: number;
  lastActiveDate?: string;
  history: Record<string, number>; // date YYYY-MM-DD -> words studied count
}

export interface StoryItem {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  totalGroups: number;
  words: VocabularyWord[];
  stories?: StoryItem[];
  isDefault?: boolean;
  isRestricted?: boolean;
  allowedUsers?: string[];
  allowedUsersExpiry?: Record<string, string>;
  accessDurationDays?: number;
  variableToggles?: Record<string, boolean>;
  enabledGames?: Record<string, boolean>;
  createdAt: string;
  createdBy: string;
  price?: number;
  freeFlashcardsCount?: number;
  bkashNumber?: string;
  order?: number;
  code?: string;
  verifiedPayments?: { bkashNumber: string; trxId: string; amount?: number }[];
  placeLabels?: {
    place1?: string;
    place2?: string;
    place3?: string;
    place4?: string;
    place5?: string;
    place6?: string;
  };
  googleSearchQuery?: string;
  hidden?: boolean;
}

export interface AccessRequest {
  id: string;
  courseId: string;
  courseTitle: string;
  courseCode?: string;
  courseIds?: string[];
  courseTitles?: string[];
  bkashNumber: string;
  email: string;
  trxId: string;
  status: 'pending' | 'approved' | 'rejected';
  price?: number;
  totalPrice?: number;
  createdAt: string;
  requestedBy?: string;
  expiryDate?: string;
  verificationMethod?: 'auto' | 'manual' | 'wallet_balance';
  spent?: boolean;
  spentAt?: string;
}

export interface VerifiedPayment {
  id?: string;
  bkashNumber: string;
  trxId: string;
  amount?: number;
  createdAt?: string;
  note?: string;
  claimed?: boolean;
  claimedBy?: string;
  claimedAt?: string;
  spent?: boolean;
  spentAt?: string;
}

export interface UserWallet {
  email?: string;
  bkashNumber?: string;
  balance: number;
  updatedAt: string;
}

export interface BlankQuestion {
  id: string;
  sentence: string;
  options: string[];
  answer: string;
  explanation?: string;
  courseId?: string;
  createdAt?: string;
}

export interface OddOneOutQuestion {
  id: string;
  words: string[]; // 4 words, e.g. ["benevolent", "generous", "kind", "malevolent"]
  answer: string;  // e.g. "malevolent"
  reason?: string; // explanation
  courseId?: string;
  createdAt?: string;
}

export interface WordAnalogyQuestion {
  id: string;
  analogy: string;  // e.g. "light : dark"
  options: string[]; // 4 word pairs, e.g. ["hot : cold", "big : huge", "fast : quick", "soft : smooth"]
  answer: string;   // e.g. "hot : cold"
  explanation?: string;
  courseId?: string;
  createdAt?: string;
}


