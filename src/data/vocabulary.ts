import { VocabularyWord } from '../types';

export const vocabulary: VocabularyWord[] = [
  { id: '1-1', group: 1, word: 'Abound', meaning: 'প্রচুর পরিমাণে থাকা', synonyms: 'Proliferate, Burgeon', extraWord: 'Abscond', extraMeaning: 'পালিয়ে যাওয়া' },
  { id: '1-2', group: 1, word: 'Amorphous', meaning: 'আকারহীন বা নির্দিষ্ট গড়নহীন', synonyms: 'Obscure, Opaque', extraWord: 'Anomalous', extraMeaning: 'অস্বাভাবিক' },
  { id: '1-3', group: 1, word: 'Austere', meaning: 'কঠোর, নির্মম বা অনাড়ম্বর', synonyms: 'Stern, Spartan', extraWord: 'Astute', extraMeaning: 'চতুর' },
  { id: '1-4', group: 1, word: 'Belie', meaning: 'মিথ্যা ধারণা দেওয়া', synonyms: 'Dissemble, Distort', extraWord: 'Belittle', extraMeaning: 'তুচ্ছ করা' },
  { id: '1-5', group: 1, word: 'Capricious', meaning: 'খামখেয়ালী বা পরিবর্তনশীল', synonyms: 'Mercurial, Erratic', extraWord: 'Captious', extraMeaning: 'খুঁতখুঁতে' },
  { id: '1-6', group: 1, word: 'Cerebral', meaning: 'বুদ্ধিবৃত্তিক', synonyms: 'Erudite, Rational', extraWord: 'Celebrate', extraMeaning: 'উদযাপন করা' },
  { id: '1-7', group: 1, word: 'Congenial', meaning: 'উপযুক্ত, অনুকূল বা আনন্দদায়ক', synonyms: 'Convivial, Amicable', extraWord: 'Congenital', extraMeaning: 'সহজাত' },
  { id: '1-8', group: 1, word: 'Conspicuous', meaning: 'সুস্পষ্ট বা চোখে পড়ার মতো', synonyms: 'Manifest, Patent', extraWord: 'Perspicacious', extraMeaning: 'তীক্ষ্ণ বুদ্ধি সম্পন্ন' },
  { id: '1-9', group: 1, word: 'Cursory', meaning: 'তাড়াহুড়া করে করা বা ভাসা-ভাসা', synonyms: 'Superficial, Perfunctory', extraWord: 'Cursor', extraMeaning: 'কম্পিউটার কার্সার' },
  { id: '1-10', group: 1, word: 'Daunting', meaning: 'ভীতিকর বা নিরুৎসাহজনক', synonyms: 'Perilous, Arduous', extraWord: 'Taunting', extraMeaning: 'বিদ্রূপ করা' },
  { id: '1-11', group: 1, word: 'Deify', meaning: 'দেবত্ব আরোপ করা বা পূজা করা', synonyms: 'Venerate, Canonize', extraWord: 'Defy', extraMeaning: 'অবজ্ঞা করা' },
  { id: '1-12', group: 1, word: 'Didactic', meaning: 'উপদেশমূলক বা শিক্ষণীয়', synonyms: 'Pedantic, Edify', extraWord: 'Dictate', extraMeaning: 'নির্দেশ দেওয়া' },
  { id: '1-13', group: 1, word: 'Disseminate', meaning: 'ব্যাপকভাবে ছড়িয়ে দেওয়া', synonyms: 'Propagate, Diffuse', extraWord: 'Dissemble', extraMeaning: 'ছদ্মবেশ ধারণ করা' },
  { id: '1-14', group: 1, word: 'Feasible', meaning: 'সম্ভব বা বাস্তবায়নযোগ্য', synonyms: 'Viable, Expedient', extraWord: 'Feeble', extraMeaning: 'দুর্বল' },
  { id: '1-15', group: 1, word: 'Flout', meaning: 'প্রকাশ্যে অবজ্ঞা করা', synonyms: 'Contravene, Deride', extraWord: 'Flaunt', extraMeaning: 'দম্ভভরে প্রদর্শন করা' },
  { id: '1-16', group: 1, word: 'Homogeneous', meaning: 'সমজাতীয়', synonyms: 'Analogous, Interchangeable', extraWord: 'Heterogeneous', extraMeaning: 'বৈচিত্র্যময়' },
  { id: '1-17', group: 1, word: 'Humdrum', meaning: 'একঘেye বা বৈচিত্র্যহীন', synonyms: 'Prosaic, Mundane', extraWord: 'Conundrum', extraMeaning: 'ধাঁধা' },
  { id: '1-18', group: 1, word: 'Insipid', meaning: 'স্বাদহীন বা নীরস', synonyms: 'Vapid, Banal', extraWord: 'Intrepid', extraMeaning: 'নির্ভীক' },
  { id: '1-19', group: 1, word: 'Loquacious', meaning: 'বাচাল বা অতিভাষী', synonyms: 'Garrulous, Verbose', extraWord: 'Fallacious', extraMeaning: 'ভ্রান্ত' },
  { id: '1-20', group: 1, word: 'Misanthropic', meaning: 'মানববিদ্বেষী', synonyms: 'Churlish, Aloof', extraWord: 'Philanthropic', extraMeaning: 'মানবদরদী' }
];

export const TOTAL_GROUPS = 1;

export function getWordsByGroup(groupNumber: number): VocabularyWord[] {
  return vocabulary.filter(w => w.group === groupNumber);
}
