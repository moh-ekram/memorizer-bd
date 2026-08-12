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
  Search, 
  Eye, 
  BookMarked,
  Layers,
  ArrowRight
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
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState<boolean>(false);
  const [activeWordPopup, setActiveWordPopup] = useState<VocabularyWord | null>(null);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [highlightColor, setHighlightColor] = useState<'red' | 'green' | 'blue' | 'black'>('blue');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Helper function to extract clean terms from text (meanings, synonyms, words)
  const extractCleanTerms = (text: string | undefined): string[] => {
    if (!text || !text.trim()) return [];
    // Remove parenthetical annotations like (বিশেষণ), (noun), (বিঃ)
    const cleaned = text.replace(/\(.*?\)/g, ' ').replace(/\[.*?\]/g, ' ');
    // Split by comma, semicolon, slash, or newline
    const parts = cleaned.split(/[,;/|\n]+/);
    const results: string[] = [];
    for (const part of parts) {
      const trimmed = part.trim();
      // Require at least 2 characters for meaningful matching
      if (trimmed.length >= 2) {
        results.push(trimmed);
      }
    }
    return results;
  };

  // Build a lookup map of course words for fast matching (place1 target words only)
  const { wordLookupMap, allSearchTerms } = useMemo(() => {
    const map = new Map<string, VocabularyWord>();
    const termsSet = new Set<string>();

    words.forEach(w => {
      // 1. Base Word (place1)
      if (w.word && w.word.trim()) {
        const cleanWord = w.word.trim().toLowerCase();
        map.set(cleanWord, w);
        termsSet.add(cleanWord);
      }

      // 2. Extra Word if present (place1)
      if (w.extraWord && w.extraWord.trim()) {
        const cleanExtra = w.extraWord.trim().toLowerCase();
        if (!map.has(cleanExtra)) map.set(cleanExtra, w);
        termsSet.add(cleanExtra);
      }
    });

    const sortedTerms = Array.from(termsSet)
      .filter(t => t.length > 0)
      // Sort longer terms first so longer phrases or multi-word terms match before shorter sub-terms
      .sort((a, b) => b.length - a.length);

    return { wordLookupMap: map, allSearchTerms: sortedTerms };
  }, [words]);

  // Construct regex pattern using Unicode boundary lookarounds
  const wordRegex = useMemo(() => {
    if (allSearchTerms.length === 0) return null;

    const escapedWords = allSearchTerms.map(w => 
      w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    try {
      // Using Unicode lookarounds (?<![\p{L}\p{N}\p{M}_]) and (?![\\p{L}\\p{N}\\p{M}_]) with 'giu' flags
      // This accurately handles both ASCII English and Unicode Bengali script boundaries!
      return new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_])(${escapedWords.join('|')})(?![\\p{L}\\p{N}\\p{M}_])`, 'giu');
    } catch (e) {
      console.error('Unicode Regex compilation error:', e);
      try {
        return new RegExp(`(${escapedWords.join('|')})`, 'gi');
      } catch {
        return null;
      }
    }
  }, [allSearchTerms]);

  // Stop speech when story changes or modal closes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [selectedStoryIndex, isStoryModalOpen]);

  // Keyboard navigation for story modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isStoryModalOpen || selectedStoryIndex === null) return;
      if (e.key === 'Escape') {
        setIsStoryModalOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setSelectedStoryIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'ArrowRight') {
        setSelectedStoryIndex(prev => (prev !== null && prev < stories.length - 1 ? prev + 1 : prev));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStoryModalOpen, selectedStoryIndex, stories.length]);

  const activeStory = selectedStoryIndex !== null ? stories[selectedStoryIndex] || null : null;

  // Handle Text-to-Speech
  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else if (activeStory) {
      window.speechSynthesis.cancel();
      const cleanText = activeStory.content.replace(/[\*_]/g, '');
      const utterance = new SpeechSynthesisUtterance(`${activeStory.title}. ${cleanText}`);
      // Detect if text is mostly Bengali or English
      const hasBengali = /[\u0980-\u09FF]/.test(cleanText);
      utterance.lang = hasBengali ? 'bn-BD' : 'en-US';
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

  // Helper to find unique vocabulary words in a given story text
  const getVocabForStory = (content: string): VocabularyWord[] => {
    if (!content || !wordLookupMap || !wordRegex) return [];
    const found = new Set<VocabularyWord>();
    
    // Reset regex index
    wordRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(content)) !== null) {
      const matchedTerm = match[0].toLowerCase();
      const wordObj = wordLookupMap.get(matchedTerm);
      if (wordObj) {
        found.add(wordObj);
      }
    }

    return Array.from(found);
  };

  // Vocab words present in current active story
  const activeStoryVocab = useMemo(() => {
    if (!activeStory) return [];
    return getVocabForStory(activeStory.content);
  }, [activeStory, wordLookupMap, wordRegex]);

  // Render story paragraph with auto-detected vocabulary words/meanings
  const renderParagraphWithBoldWords = (text: string) => {
    if (!wordRegex) return text;

    const colorClasses = {
      red: 'text-red-600 hover:text-red-700 decoration-red-500',
      green: 'text-emerald-700 hover:text-emerald-800 decoration-emerald-500',
      blue: 'text-indigo-600 hover:text-indigo-800 decoration-indigo-500',
      black: 'text-slate-900 hover:text-black decoration-slate-700'
    };

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    wordRegex.lastIndex = 0;

    while ((match = wordRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      const matchedText = match[0];

      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      const matchedWordObj = wordLookupMap.get(matchedText.toLowerCase());

      if (matchedWordObj) {
        parts.push(
          <button
            key={`vocab-${matchIndex}-${matchedWordObj.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveWordPopup(matchedWordObj);
            }}
            className={`inline font-extrabold underline underline-offset-3 cursor-pointer transition-colors ${colorClasses[highlightColor]}`}
            title={`Click to view flashcard for "${matchedWordObj.word}" (${matchedWordObj.meaning || ''})`}
          >
            {matchedText}
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

  const fontSizeClasses = {
    sm: 'text-xs sm:text-sm leading-relaxed',
    base: 'text-sm sm:text-base leading-relaxed',
    lg: 'text-base sm:text-lg leading-loose',
    xl: 'text-lg sm:text-xl leading-loose'
  };

  const handleOpenStoryModal = (originalIndex: number) => {
    setSelectedStoryIndex(originalIndex);
    setIsStoryModalOpen(true);
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
            এই কোর্সের জন্য কোনো গল্প এখনও আপলোড করা হয়নি। শিক্ষক বা অ্যাডমিন কোর্স সেটিংসে গিয়ে সরাসরি ওয়ার্ড ফাইল (.docx) বা টেক্সট থেকে বাংলা ও ইংরেজি গল্প আপলোড করতে পারবেন।
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">গল্প পড়ুন ও শব্দ শিখুন</h2>
        <p className="text-xs sm:text-sm text-slate-500 font-normal">
          গল্পের ভেতর হাইলাইটেড শব্দ ক্লিক করে অর্থ ও স্ট্যাটাস শিখুন।
        </p>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stories..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium focus:border-indigo-500 outline-none transition text-slate-800"
          />
        </div>

        {/* Minimalist Stats Chips */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 self-end sm:self-center">
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
            {stories.length} Stories
          </span>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
            {words.length} Words
          </span>
        </div>
      </div>

      {/* Stories Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStories.map((story) => {
          const originalIndex = stories.findIndex(s => s.id === story.id);
          const vocabCount = getVocabForStory(story.content).length;

          return (
            <div
              key={story.id}
              onClick={() => handleOpenStoryModal(originalIndex)}
              className="bg-white hover:bg-slate-50/60 rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:shadow-xs transition duration-150 cursor-pointer flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-500">
                    Story #{originalIndex + 1}
                  </span>
                  <span>
                    {story.content.split(/\s+/).length} Words
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                  {story.title}
                </h3>

                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed font-normal">
                  {story.content}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-500">
                {vocabCount > 0 ? (
                  <span className="text-[11px] font-medium text-indigo-600">
                    {vocabCount}টি শব্দ চিহ্নিত
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-normal">সাধারণ গল্প</span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenStoryModal(originalIndex);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer group-hover:scale-102"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>গল্প পড়ুন</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* DEDICATED STORY READING POPUP MODAL (Hides surrounding stories) */}
      <AnimatePresence>
        {isStoryModalOpen && activeStory && (
          <div 
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
            onClick={() => setIsStoryModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden relative"
            >
              {/* Modal Header Bar */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between gap-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-xs font-mono font-black px-2.5 py-1 bg-indigo-500/20 text-indigo-200 rounded-full border border-indigo-400/30 shrink-0">
                    Story {selectedStoryIndex! + 1} / {stories.length}
                  </span>
                  <h3 className="text-base sm:text-xl font-black tracking-tight text-white truncate">
                    {activeStory.title}
                  </h3>
                </div>

                {/* Close Modal Button */}
                <button
                  type="button"
                  onClick={() => setIsStoryModalOpen(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer shrink-0"
                  title="Close Story Popup (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Reader Controls Toolbar Bar */}
              <div className="bg-slate-50 px-5 sm:px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Highlight Color Picker */}
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-extrabold text-slate-500">Color:</span>
                    <button
                      type="button"
                      onClick={() => setHighlightColor('blue')}
                      className={`w-4 h-4 rounded-full transition-all cursor-pointer ${
                        highlightColor === 'blue' ? 'bg-blue-600 ring-2 ring-blue-400 scale-110' : 'bg-blue-500 opacity-60'
                      }`}
                      title="Blue"
                    />
                    <button
                      type="button"
                      onClick={() => setHighlightColor('red')}
                      className={`w-4 h-4 rounded-full transition-all cursor-pointer ${
                        highlightColor === 'red' ? 'bg-red-600 ring-2 ring-red-400 scale-110' : 'bg-red-500 opacity-60'
                      }`}
                      title="Red"
                    />
                    <button
                      type="button"
                      onClick={() => setHighlightColor('green')}
                      className={`w-4 h-4 rounded-full transition-all cursor-pointer ${
                        highlightColor === 'green' ? 'bg-emerald-600 ring-2 ring-emerald-400 scale-110' : 'bg-emerald-500 opacity-60'
                      }`}
                      title="Green"
                    />
                    <button
                      type="button"
                      onClick={() => setHighlightColor('black')}
                      className={`w-4 h-4 rounded-full transition-all cursor-pointer ${
                        highlightColor === 'black' ? 'bg-slate-900 ring-2 ring-slate-400 scale-110' : 'bg-slate-800 opacity-60'
                      }`}
                      title="Black"
                    />
                  </div>

                  {/* Font Size Controls */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setFontSize('sm')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${fontSize === 'sm' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      A-
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontSize('base')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${fontSize === 'base' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontSize('lg')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${fontSize === 'lg' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      A+
                    </button>
                  </div>

                  {/* Speech Listen Button */}
                  <button
                    type="button"
                    onClick={handleToggleSpeech}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer border ${
                      isSpeaking
                        ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                    }`}
                    title="Audio Speech Player"
                  >
                    {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-600" />}
                    <span>{isSpeaking ? 'থামুন (Stop)' : 'শুনুন (Listen)'}</span>
                  </button>
                </div>

                {activeStoryVocab.length > 0 && (
                  <span className="text-[11px] font-extrabold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-150 inline-flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{activeStoryVocab.length} vocabulary words detected</span>
                  </span>
                )}
              </div>

              {/* Story Content Reading Body */}
              <div className="p-6 sm:p-10 flex-1 overflow-y-auto space-y-6 bg-slate-50/30">
                <div className="space-y-2 border-b border-slate-100 pb-4">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                    {activeStory.title}
                  </h2>
                </div>

                <div className={`text-slate-800 space-y-5 font-normal ${fontSizeClasses[fontSize]}`}>
                  {activeStory.content.split(/\r?\n\s*\r?\n+/).map((paragraph, pIdx) => (
                    <p key={`p-${pIdx}`} className="leading-relaxed whitespace-pre-wrap">
                      {renderParagraphWithBoldWords(paragraph)}
                    </p>
                  ))}
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  disabled={selectedStoryIndex === 0}
                  onClick={() => setSelectedStoryIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev))}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 text-slate-800 rounded-xl text-xs font-extrabold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>আগের গল্প (Previous)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsStoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  বন্ধ করুন (Close)
                </button>

                <button
                  type="button"
                  disabled={selectedStoryIndex === stories.length - 1}
                  onClick={() => setSelectedStoryIndex(prev => (prev !== null && prev < stories.length - 1 ? prev + 1 : prev))}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 transition shadow-xs cursor-pointer"
                >
                  <span>পরের গল্প (Next)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Word Flashcard Modal when clicking a vocabulary word inside a story */}
      <AnimatePresence>
        {activeWordPopup && (
          <div 
            className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setActiveWordPopup(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative"
            >
              {/* Flashcard Header Bar */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setActiveWordPopup(null)}
                  className="absolute right-4 top-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer backdrop-blur-xs"
                  title="Close Flashcard"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap mb-3 pr-8">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider text-indigo-200 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                    Flashcard
                  </span>
                  {activeWordPopup.group !== undefined && (
                    <span className="text-[10px] font-mono font-extrabold text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                      Group #{activeWordPopup.group}
                    </span>
                  )}
                  {progress[activeWordPopup.id]?.status && (
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                      progress[activeWordPopup.id]?.status === 'know'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                        : progress[activeWordPopup.id]?.status === 'dont_know'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                    }`}>
                      {progress[activeWordPopup.id]?.status === 'know' ? 'Learned' : progress[activeWordPopup.id]?.status === 'dont_know' ? 'Unlearned' : 'In Progress'}
                    </span>
                  )}
                </div>

                {/* Word Title & Speech Pronunciation */}
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white capitalize">
                    {activeWordPopup.word}
                  </h2>
                  
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                        const u = new SpeechSynthesisUtterance(activeWordPopup.word);
                        u.lang = 'en-US';
                        u.rate = 0.85;
                        window.speechSynthesis.speak(u);
                      }
                    }}
                    className="p-3 bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-200 rounded-2xl transition border border-indigo-400/30 cursor-pointer shrink-0"
                    title="Pronounce word"
                  >
                    <Volume2 className="w-5 h-5 text-amber-300" />
                  </button>
                </div>
              </div>

              {/* Flashcard Content Body */}
              <div className="p-6 space-y-4 bg-slate-50/50">
                {/* Bengali Meaning */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    বাংলা অর্থ (Bengali Meaning)
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-indigo-950 leading-snug">
                    {activeWordPopup.meaning || 'N/A'}
                  </p>
                </div>

                {/* Synonyms */}
                {activeWordPopup.synonyms && activeWordPopup.synonyms.trim() !== '' && (
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      সমার্থ শব্দ (Synonyms)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeWordPopup.synonyms.split(/[,;/]+/).map((syn, sIdx) => {
                        const cleaned = syn.trim();
                        if (!cleaned) return null;
                        return (
                          <span 
                            key={sIdx}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-900 text-xs font-bold rounded-lg border border-indigo-100"
                          >
                            {cleaned}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Example Sentence */}
                {activeWordPopup.example && activeWordPopup.example.trim() !== '' && (
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      বাক্যে প্রয়োগ (Example Sentence)
                    </span>
                    <p className="text-xs sm:text-sm font-medium text-slate-700 italic leading-relaxed border-l-2 border-indigo-500 pl-3 py-0.5">
                      "{activeWordPopup.example}"
                    </p>
                  </div>
                )}

                {/* Flashcard Action Rating Buttons */}
                {onRateWord && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-slate-500">Rate word status:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onRateWord(activeWordPopup.id, 'dont_know');
                          setActiveWordPopup(null);
                        }}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Unlearned</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onRateWord(activeWordPopup.id, 'know');
                          setActiveWordPopup(null);
                        }}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Learned</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
