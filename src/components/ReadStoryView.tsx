import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Volume2, 
  VolumeX, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Check, 
  X, 
  HelpCircle, 
  Bookmark, 
  Info, 
  Search, 
  AArrowDown, 
  AArrowUp, 
  RotateCcw,
  BookMarked
} from 'lucide-react';
import { VocabularyWord, UserProgress, WordStatus, StoryItem } from '../types';

interface ReadStoryViewProps {
  stories: StoryItem[];
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  onRateWord?: (wordId: string, status: WordStatus) => void;
  onToggleBookmark?: (wordId: string, folderId: string) => void;
  onOpenSettings?: () => void;
}

export default function ReadStoryView({
  stories,
  words,
  progress,
  onRateWord,
  onToggleBookmark,
  onOpenSettings
}: ReadStoryViewProps) {
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number>(0);
  const [activeWordPopup, setActiveWordPopup] = useState<VocabularyWord | null>(null);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeStory = stories[selectedStoryIndex] || null;

  // Build a lookup map of course words for fast matching (lowercase)
  const wordLookupMap = useMemo(() => {
    const map = new Map<string, VocabularyWord>();
    words.forEach(w => {
      if (w.word && w.word.trim()) {
        const clean = w.word.trim().toLowerCase();
        map.set(clean, w);
      }
    });
    return map;
  }, [words]);

  // Construct regex pattern for matching course words in story content
  const wordRegex = useMemo(() => {
    if (words.length === 0) return null;
    const escapedWords = words
      .map(w => w.word ? w.word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '')
      .filter(w => w.length > 0)
      // Sort longer words first so "benevolent" matches before "benevol"
      .sort((a, b) => b.length - a.length);

    if (escapedWords.length === 0) return null;

    try {
      return new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
    } catch (e) {
      console.error('Regex compilation error:', e);
      return null;
    }
  }, [words]);

  // Stop speech when story changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [selectedStoryIndex]);

  // Handle Text-to-Speech
  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else if (activeStory) {
      window.speechSynthesis.cancel();
      // Remove markdown bold markers if any
      const cleanText = activeStory.content.replace(/[\*_]/g, '');
      const utterance = new SpeechSynthesisUtterance(`${activeStory.title}. ${cleanText}`);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  // Filtered stories list
  const filteredStories = useMemo(() => {
    if (!searchQuery.trim()) return stories;
    const q = searchQuery.toLowerCase();
    return stories.filter(s => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q));
  }, [stories, searchQuery]);

  // Count vocabulary words present in the active story
  const activeStoryVocab = useMemo(() => {
    if (!activeStory || !wordLookupMap) return [];
    const found = new Set<VocabularyWord>();
    const textLower = activeStory.content.toLowerCase();
    
    words.forEach(w => {
      if (w.word && w.word.trim()) {
        const regex = new RegExp(`\\b${w.word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(textLower)) {
          found.add(w);
        }
      }
    });

    return Array.from(found);
  }, [activeStory, words, wordLookupMap]);

  // Render story paragraph with auto-bolded vocabulary words
  const renderParagraphWithBoldWords = (text: string) => {
    if (!wordRegex) return text;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Reset regex index
    wordRegex.lastIndex = 0;

    while ((match = wordRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      const matchedText = match[0];

      // Push preceding text
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      // Find vocabulary object
      const matchedWordObj = wordLookupMap.get(matchedText.toLowerCase());

      if (matchedWordObj) {
        const wordStatus = progress[matchedWordObj.id]?.status || 'unrated';

        parts.push(
          <button
            key={`vocab-${matchIndex}-${matchedWordObj.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveWordPopup(matchedWordObj);
            }}
            className={`inline-flex items-center px-1.5 py-0.5 my-0.5 mx-0.5 rounded font-black text-xs sm:text-sm cursor-pointer transition-all duration-200 border group ${
              wordStatus === 'know'
                ? 'bg-emerald-100/90 hover:bg-emerald-200 text-emerald-950 border-emerald-300'
                : wordStatus === 'dont_know'
                ? 'bg-rose-100/90 hover:bg-rose-200 text-rose-950 border-rose-300'
                : wordStatus === 'confusion'
                ? 'bg-amber-100/90 hover:bg-amber-200 text-amber-950 border-amber-300'
                : 'bg-indigo-100/90 hover:bg-indigo-200 text-indigo-950 border-indigo-300 shadow-2xs'
            }`}
            title={`Click to view meaning: ${matchedWordObj.meaning}`}
          >
            <span>{matchedText}</span>
            <Sparkles className="w-2.5 h-2.5 ml-1 opacity-70 group-hover:opacity-100 text-indigo-600" />
          </button>
        );
      } else {
        parts.push(<strong key={`bold-${matchIndex}`} className="font-bold">{matchedText}</strong>);
      }

      lastIndex = matchIndex + matchedText.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  // Font size CSS class mapping
  const fontSizeClasses = {
    sm: 'text-xs sm:text-sm leading-relaxed',
    base: 'text-sm sm:text-base leading-relaxed',
    lg: 'text-base sm:text-lg leading-loose',
    xl: 'text-lg sm:text-xl leading-loose'
  };

  if (stories.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4 shadow-2xs my-4">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-2xs">
          <BookOpen className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="font-extrabold text-slate-900 text-lg">কোনো গল্প পাওয়া যায়নি (No Stories Yet)</h3>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            এই কোর্সের জন্য কোনো গল্প এখনও আপলোড করা হয়নি। শিক্ষক বা অ্যাডমিন কোর্স সেটিংসে গিয়ে সরাসরি ওয়ার্ড ফাইল (.docx) থেকে গল্প আপলোড করতে পারবেন।
          </p>
        </div>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <BookMarked className="w-4 h-4" />
            <span>কোর্স সেটিংসে গিয়ে গল্প যোগ করুন</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1 max-w-xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-indigo-500/20 text-indigo-200 text-[10px] font-black rounded-full uppercase tracking-wider border border-indigo-500/30">
            <BookOpen className="w-3 h-3 text-amber-300" /> Read Story Mode
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">গল্প পড়ুন ও শব্দ শিখুন</h2>
          <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed font-medium">
            গল্পের মাঝে কোর্সের ভোকাবুলারি শব্দগুলো বোল্ড করা রয়েছে। শব্দে ক্লিক করে সাথে সাথে বাংলা অর্থ, সমার্থ ও উদাহরণ দেখে নিন।
          </p>
        </div>

        {/* Stats Pill */}
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 text-xs font-bold shrink-0">
          <div>
            <span className="text-[10px] text-indigo-200 uppercase tracking-wider block font-medium">মোট গল্প</span>
            <span className="text-lg font-black font-mono text-white">{stories.length}</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div>
            <span className="text-[10px] text-indigo-200 uppercase tracking-wider block font-medium">কোর্স শব্দ</span>
            <span className="text-lg font-black font-mono text-amber-300">{words.length}</span>
          </div>
        </div>
      </div>

      {/* Main Layout: Story Selector + Story Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Story Selector Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="গল্পের টাইটেল বা শব্দ খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-indigo-500 outline-none transition text-slate-800 shadow-2xs"
            />
          </div>

          {/* Stories List */}
          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredStories.map((story, idx) => {
              const originalIndex = stories.findIndex(s => s.id === story.id);
              const isSelected = originalIndex === selectedStoryIndex;

              return (
                <div
                  key={story.id}
                  onClick={() => setSelectedStoryIndex(originalIndex)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 border ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white border-indigo-700 shadow-md ring-2 ring-indigo-500/20'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/80 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${
                      isSelected
                        ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/30'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      Story #{originalIndex + 1}
                    </span>

                    <span className={`text-[10px] font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {story.content.split(/\s+/).length} Words
                    </span>
                  </div>

                  <h4 className={`text-sm font-bold line-clamp-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    {story.title}
                  </h4>

                  <p className={`text-xs line-clamp-2 mt-1 font-normal ${isSelected ? 'text-indigo-200/80' : 'text-slate-500'}`}>
                    {story.content}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Story Reader Main Panel (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {activeStory ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 relative">
              
              {/* Reader Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Story {selectedStoryIndex + 1} of {stories.length}</span>
                </div>

                {/* Toolbar buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Speech Button */}
                  <button
                    type="button"
                    onClick={handleToggleSpeech}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer border ${
                      isSpeaking
                        ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                    title="Audio Listen"
                  >
                    {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isSpeaking ? 'Stop Audio' : 'Listen Story'}</span>
                  </button>

                  {/* Font Size Controls */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setFontSize('sm')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${fontSize === 'sm' ? 'bg-white shadow-2xs text-indigo-700' : 'text-slate-500'}`}
                    >
                      A-
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontSize('base')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${fontSize === 'base' ? 'bg-white shadow-2xs text-indigo-700' : 'text-slate-500'}`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontSize('lg')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${fontSize === 'lg' ? 'bg-white shadow-2xs text-indigo-700' : 'text-slate-500'}`}
                    >
                      A+
                    </button>
                  </div>
                </div>
              </div>

              {/* Story Title */}
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  {activeStory.title}
                </h3>

                {/* Vocab found badge */}
                {activeStoryVocab.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-extrabold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-150 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      <span>{activeStoryVocab.length} vocabulary words in this story</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Story Body Content */}
              <div 
                style={{ fontFamily: "'Poppins', sans-serif" }}
                className={`text-slate-800 space-y-4 font-normal ${fontSizeClasses[fontSize]}`}
              >
                {activeStory.content.split(/\r?\n\s*\r?\n+/).map((paragraph, pIdx) => (
                  <p key={`p-${pIdx}`} className="leading-relaxed whitespace-pre-wrap">
                    {renderParagraphWithBoldWords(paragraph)}
                  </p>
                ))}
              </div>

              {/* Reader Footer Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <button
                  type="button"
                  disabled={selectedStoryIndex === 0}
                  onClick={() => setSelectedStoryIndex(prev => Math.max(0, prev - 1))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 rounded-xl text-xs font-extrabold flex items-center gap-1 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Story</span>
                </button>

                <button
                  type="button"
                  disabled={selectedStoryIndex === stories.length - 1}
                  onClick={() => setSelectedStoryIndex(prev => Math.min(stories.length - 1, prev + 1))}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 transition shadow-xs cursor-pointer"
                >
                  <span>Next Story</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-500 text-xs font-medium">
              গল্প নির্বাচন করুন
            </div>
          )}
        </div>
      </div>

      {/* Interactive Word Detail Modal / Popover when clicking a bolded word */}
      <AnimatePresence>
        {activeWordPopup && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 relative overflow-hidden"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setActiveWordPopup(null)}
                className="absolute right-4 top-4 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-150 inline-block">
                  Vocabulary Word #{activeWordPopup.id}
                </span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {activeWordPopup.word}
                </h3>
              </div>

              {/* Meaning & Details */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-150 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">বাংলা অর্থ (Bengali Meaning)</span>
                  <p className="text-base font-extrabold text-indigo-950 mt-0.5">
                    {activeWordPopup.meaning || 'N/A'}
                  </p>
                </div>

                {activeWordPopup.synonyms && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">সমার্থ শব্দ (Synonyms)</span>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">
                      {activeWordPopup.synonyms}
                    </p>
                  </div>
                )}

                {activeWordPopup.example && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">বাক্যে প্রয়োগ (Example Sentence)</span>
                    <p className="text-xs font-medium text-slate-600 italic mt-0.5">
                      "{activeWordPopup.example}"
                    </p>
                  </div>
                )}
              </div>

              {/* Status Action Buttons */}
              {onRateWord && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase">স্ট্যাটাস সেট করুন:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onRateWord(activeWordPopup.id, 'know');
                        setActiveWordPopup(null);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Learned</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onRateWord(activeWordPopup.id, 'dont_know');
                        setActiveWordPopup(null);
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Unlearned</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
