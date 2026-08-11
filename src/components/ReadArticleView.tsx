import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Newspaper,
  BookOpen, 
  Clock, 
  User, 
  Calendar, 
  Search, 
  Volume2, 
  VolumeX, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  Eye, 
  BookMarked,
  Sparkles,
  Type,
  Tag,
  CheckCircle2,
  Share2,
  Layers,
  ArrowRight,
  Filter
} from 'lucide-react';
import { VocabularyWord, UserProgress, WordStatus, StoryItem } from '../types';

export interface ArticleItem {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  readTime: string;
  publishedAt: string;
  coverGradient: string;
  tags: string[];
}

interface ReadArticleViewProps {
  articles?: ArticleItem[];
  stories?: StoryItem[];
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  onRateWord?: (wordId: string, status: WordStatus) => void;
  onToggleBookmark?: (wordId: string, folderId: string) => void;
}

const DEFAULT_CURATED_ARTICLES: ArticleItem[] = [
  {
    id: 'art-1',
    title: 'The Neuroscience of Memory: How Spaced Repetition Transforms Learning',
    excerpt: 'Explore how cognitive science and neural plasticity optimize memory retention through systematic review intervals and mnemonic cues.',
    content: `Human memory is not a static warehouse where facts remain immutable forever. Instead, it is a dynamic neural network governed by memory consolidation and active retrieval. When we encounter new information, synaptic connections are initially fragile. Without deliberate reinforcement, the forgetting curve rapidly erodes our recall.

To counter this, cognitive psychologists developed the paradigm of spaced repetition. By reviewing vocabulary items at calculated intervals—just as memory strength begins to decline—we trigger long-term potentiation in the brain. This pragmatic approach transforms fleeting short-term memories into resilient, permanent knowledge.

Furthermore, leveraging mnemonic devices and contextual reading acts as a catalyst for deeper encoding. When you read complex words within rich narrative articles, your brain attaches semantic meaning to abstract vocabulary, making retrieval effortless during high-stakes exams.`,
    author: 'Dr. Elena Vance',
    category: 'Memory & Cognition',
    readTime: '4 min read',
    publishedAt: 'Aug 10, 2026',
    coverGradient: 'from-indigo-600 via-purple-600 to-pink-600',
    tags: ['Cognition', 'Memory', 'Spaced Repetition', 'Neuroscience']
  },
  {
    id: 'art-2',
    title: 'Navigating Uncertainty: Pragmatic Decision Making in Complex Systems',
    excerpt: 'In an increasingly volatile world, adopting pragmatic mental models helps leaders dissect ambiguity and make articulate choices.',
    content: `Modern leadership demands an acute ability to navigate ambiguity. When confronted with incomplete data and shifting market dynamics, dogmatic adherence to rigid frameworks often leads to systemic paralysis.

Pragmatism offers a lucid alternative. Rather than pursuing unattainable perfection, pragmatic thinkers evaluate decisions based on real-world utility and adaptable feedback loops. They cultivate intellectual humility, recognizing that initial assumptions must be meticulously tested against empirical reality.

To articulate compelling strategies, one must master the art of concise communication. Expressing complex ideas with clarity eliminates confusion among team members and aligns diverse stakeholders toward a unified objective. By embracing flexible, evidence-based methods, leaders turn turbulence into a competitive advantage.`,
    author: 'Julian Mercer',
    category: 'Philosophy & Logic',
    readTime: '5 min read',
    publishedAt: 'Aug 08, 2026',
    coverGradient: 'from-blue-600 via-indigo-700 to-slate-900',
    tags: ['Philosophy', 'Leadership', 'Pragmatism', 'Strategy']
  },
  {
    id: 'art-3',
    title: 'The Evolution of Language: How Words Shape Human Perception',
    excerpt: 'Linguistic nuances alter how we experience emotion, interpret color, and organize complex thoughts across distinct cultures.',
    content: `Language is far more than an arbitrary instrument for transmitting information; it is the fundamental framework through which we perceive reality. The Sapir-Whorf hypothesis suggests that the structural nuances of a tongue influence its speakers' cognitive habits and worldview.

Consider how specialized vocabularies enrich human expression. A culture with multiple distinct words for subtle emotional states enables its speakers to articulate feelings with surgical precision. Conversely, a sparse vocabulary restricts nuanced discourse, forcing complex ideas into simplistic categories.

Expanding your vocabulary elevates your cognitive bandwidth. As you master evocative words, you refine your internal monologue and gain the capacity to comprehend sophisticated literature, philosophical texts, and scholarly research with profound insight.`,
    author: 'Prof. Arthur Pendelton',
    category: 'Linguistics',
    readTime: '6 min read',
    publishedAt: 'Aug 05, 2026',
    coverGradient: 'from-emerald-600 via-teal-700 to-cyan-900',
    tags: ['Linguistics', 'Culture', 'Vocabulary', 'Perception']
  },
  {
    id: 'art-4',
    title: 'Astrophysics & Deep Space: Exploring Cosmic Frontiers',
    excerpt: 'From gravitational waves to distant exoplanets, modern astronomy reveals the awe-inspiring grandeur of our universe.',
    content: `Looking up at the night sky has inspired human curiosity for millennia. Today, cutting-edge space telescopes and gravitational observatories are unveiling celestial phenomena that were once the domain of pure science fiction.

Astrophysicists study distant galaxies whose light has traveled across billions of light-years. By analyzing cosmic microwave background radiation and stellar spectra, scientists reconstruct the birth of the universe and decipher the mysterious forces of dark matter and dark energy.

This cosmic perspective instills a sense of profound humility. It reminds us that our planet is a precious oasis in a vast, cold expanse, urging humanity to unite in the spirit of scientific discovery and peaceful exploration.`,
    author: 'Dr. Marcus Vance',
    category: 'Science & Space',
    readTime: '5 min read',
    publishedAt: 'Aug 02, 2026',
    coverGradient: 'from-violet-600 via-purple-800 to-slate-950',
    tags: ['Astronomy', 'Physics', 'Universe', 'Space']
  },
  {
    id: 'art-5',
    title: 'The Digital Economy: AI, Automation, and the Future of Work',
    excerpt: 'How artificial intelligence and automated systems are reshaping industry paradigms, productivity, and essential skills.',
    content: `The global economy is undergoing a unprecedented transformation driven by artificial intelligence and automated workflows. Industries ranging from finance to healthcare are experiencing rapid shifts in operational paradigms.

While routine tasks become increasingly automated, the demand for high-level cognitive skills—such as critical thinking, creative synthesis, and emotional intelligence—continues to escalate. Professionals who possess a versatile skill set and adapt quickly to technological innovation will thrive in this new landscape.

Continuous learning is no longer optional; it is a vital necessity. Building a robust command of industry terminology and analytical concepts ensures you stay at the forefront of digital innovation.`,
    author: 'Sophia Reynolds',
    category: 'Tech & Business',
    readTime: '4 min read',
    publishedAt: 'Jul 28, 2026',
    coverGradient: 'from-amber-500 via-orange-600 to-red-700',
    tags: ['Technology', 'AI', 'Economics', 'Future']
  },
  {
    id: 'art-6',
    title: 'Mastering Rhetoric: The Art of Persuasive Communication',
    excerpt: 'Timeless principles of ethos, pathos, and logos that empower speakers and writers to captivate modern audiences.',
    content: `Since the days of ancient Greece, rhetoric has been studied as the master art of persuasion. Aristotle categorized persuasive discourse into three foundational pillars: ethos (credibility), pathos (emotional connection), and logos (logical reasoning).

In today's fast-paced digital media landscape, mastering rhetoric is more crucial than ever. Whether crafting an essay, delivering a keynote speech, or presenting a business proposal, combining logical coherence with compelling storytelling creates an undeniable impact.

A rich vocabulary serves as the orator's finest toolkit. Choosing precisely the right word at the exact moment elevates your prose, commands respect, and leaves a lasting impression on your audience.`,
    author: 'Clara Oswald',
    category: 'Culture & Literature',
    readTime: '5 min read',
    publishedAt: 'Jul 22, 2026',
    coverGradient: 'from-rose-600 via-pink-700 to-purple-900',
    tags: ['Rhetoric', 'Writing', 'Communication', 'Persuasion']
  }
];

export default function ReadArticleView({
  articles,
  stories,
  words,
  progress,
  onRateWord,
  onToggleBookmark
}: ReadArticleViewProps) {
  // Combine custom articles, course stories formatted as articles, and default curated articles
  const allArticlesList = useMemo(() => {
    const list: ArticleItem[] = [];

    if (articles && articles.length > 0) {
      list.push(...articles);
    }

    if (stories && stories.length > 0) {
      stories.forEach((st, idx) => {
        list.push({
          id: `story-art-${st.id || idx}`,
          title: st.title || `Course Article #${idx + 1}`,
          excerpt: st.content.slice(0, 140).replace(/[\*_]/g, '') + '...',
          content: st.content,
          author: 'Course Curator',
          category: 'Vocabulary Reading',
          readTime: `${Math.max(2, Math.ceil(st.content.split(' ').length / 150))} min read`,
          publishedAt: 'Course Content',
          coverGradient: idx % 2 === 0 ? 'from-indigo-600 via-purple-600 to-blue-600' : 'from-teal-600 via-emerald-600 to-cyan-700',
          tags: ['Vocabulary', 'Course Reading']
        });
      });
    }

    // Append default curated articles if not already present
    DEFAULT_CURATED_ARTICLES.forEach(defArt => {
      if (!list.some(a => a.id === defArt.id)) {
        list.push(defArt);
      }
    });

    return list;
  }, [articles, stories]);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeArticleIndex, setActiveArticleIndex] = useState<number | null>(null);
  const [activeWordPopup, setActiveWordPopup] = useState<VocabularyWord | null>(null);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [highlightColor, setHighlightColor] = useState<'indigo' | 'emerald' | 'amber' | 'rose' | 'slate'>('indigo');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [readArticlesSet, setReadArticlesSet] = useState<Set<string>>(() => new Set());

  // Available categories
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    cats.add('All');
    allArticlesList.forEach(a => {
      if (a.category) cats.add(a.category);
    });
    return Array.from(cats);
  }, [allArticlesList]);

  // Filtered Articles
  const filteredArticles = useMemo(() => {
    return allArticlesList.filter(art => {
      const matchesCategory = selectedCategory === 'All' || art.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        art.title.toLowerCase().includes(q) ||
        art.excerpt.toLowerCase().includes(q) ||
        art.content.toLowerCase().includes(q) ||
        art.author.toLowerCase().includes(q) ||
        art.tags.some(t => t.toLowerCase().includes(q));

      return matchesCategory && matchesQuery;
    });
  }, [allArticlesList, selectedCategory, searchQuery]);

  // Active Reading Article
  const activeArticle = activeArticleIndex !== null ? filteredArticles[activeArticleIndex] || null : null;

  // Word extraction helper
  const extractCleanTerms = (text: string | undefined): string[] => {
    if (!text || !text.trim()) return [];
    const cleaned = text.replace(/\(.*?\)/g, ' ').replace(/\[.*?\]/g, ' ');
    const parts = cleaned.split(/[,;/|\n]+/);
    const results: string[] = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length >= 2) results.push(trimmed);
    }
    return results;
  };

  // Build lookup map for vocabulary matching inside article text
  const { wordLookupMap, allSearchTerms } = useMemo(() => {
    const map = new Map<string, VocabularyWord>();
    const termsSet = new Set<string>();

    words.forEach(w => {
      if (w.word && w.word.trim()) {
        const cleanWord = w.word.trim().toLowerCase();
        map.set(cleanWord, w);
        termsSet.add(cleanWord);
      }
      if (w.extraWord && w.extraWord.trim()) {
        const cleanExtra = w.extraWord.trim().toLowerCase();
        if (!map.has(cleanExtra)) map.set(cleanExtra, w);
        termsSet.add(cleanExtra);
      }
      if (w.meaning) {
        extractCleanTerms(w.meaning).forEach(m => {
          const cleanM = m.toLowerCase();
          if (!map.has(cleanM)) map.set(cleanM, w);
          termsSet.add(cleanM);
        });
      }
      if (w.synonyms) {
        extractCleanTerms(w.synonyms).forEach(s => {
          const cleanS = s.toLowerCase();
          if (!map.has(cleanS)) map.set(cleanS, w);
          termsSet.add(cleanS);
        });
      }
    });

    const sortedTerms = Array.from(termsSet)
      .filter(t => t.length >= 2)
      .sort((a, b) => b.length - a.length);

    return { wordLookupMap: map, allSearchTerms: sortedTerms };
  }, [words]);

  // Regex matcher for unicode/English boundary matching
  const wordRegex = useMemo(() => {
    if (allSearchTerms.length === 0) return null;
    const escapedWords = allSearchTerms.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    try {
      return new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_])(${escapedWords.join('|')})(?![\\p{L}\\p{N}\\p{M}_])`, 'giu');
    } catch {
      return new RegExp(`(${escapedWords.join('|')})`, 'gi');
    }
  }, [allSearchTerms]);

  // Audio Speech Synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [activeArticleIndex]);

  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else if (activeArticle) {
      window.speechSynthesis.cancel();
      const cleanText = activeArticle.content.replace(/[\*_]/g, '');
      const utterance = new SpeechSynthesisUtterance(`${activeArticle.title}. ${cleanText}`);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const toggleArticleReadStatus = (articleId: string) => {
    setReadArticlesSet(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  };

  // Render text with interactive highlighted words
  const renderHighlightedText = (text: string) => {
    if (!wordRegex || !wordLookupMap) return text;

    const parts = text.split(wordRegex);
    return parts.map((part, i) => {
      const lower = part.toLowerCase();
      const matchedWord = wordLookupMap.get(lower);

      if (matchedWord) {
        const wordProg = progress[matchedWord.id];
        const status = wordProg?.status || 'unrated';

        let badgeBg = 'bg-indigo-100 text-indigo-900 border-indigo-300 hover:bg-indigo-200';
        if (highlightColor === 'emerald') badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200';
        if (highlightColor === 'amber') badgeBg = 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200';
        if (highlightColor === 'rose') badgeBg = 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200';
        if (highlightColor === 'slate') badgeBg = 'bg-slate-200 text-slate-900 border-slate-300 hover:bg-slate-300';

        let statusDot = 'bg-slate-400';
        if (status === 'know') statusDot = 'bg-emerald-500';
        if (status === 'confusion') statusDot = 'bg-amber-500';
        if (status === 'dont_know') statusDot = 'bg-rose-500';

        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              setActiveWordPopup(matchedWord);
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 mx-0.5 rounded-md text-xs font-semibold border cursor-pointer transition shadow-2xs ${badgeBg}`}
            title={`Click to view definition for "${matchedWord.word}"`}
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
            <span className="font-bold underline decoration-dotted decoration-indigo-400/60 underline-offset-2">
              {part}
            </span>
          </span>
        );
      }

      return <span key={i}>{part}</span>;
    });
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-xs sm:text-sm leading-relaxed';
      case 'lg': return 'text-base sm:text-lg leading-relaxed';
      case 'xl': return 'text-lg sm:text-xl leading-relaxed';
      default: return 'text-sm sm:text-base leading-relaxed';
    }
  };

  const featuredArticle = filteredArticles[0] || null;

  return (
    <div className="space-y-8 w-full max-w-6xl mx-auto pb-12" style={{ fontFamily: "'Poppins', sans-serif" }}>
      
      {/* 1. ARTICLE LISTING VIEW */}
      {activeArticleIndex === null && (
        <div className="space-y-8">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 rounded-3xl relative overflow-hidden shadow-xl border border-indigo-500/20">
            <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full uppercase tracking-wider border border-indigo-500/30">
                <Newspaper className="w-3.5 h-3.5" />
                <span>Read Articles & Insights</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Interactive English Articles
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                Immerse yourself in curated articles and blogs written to expand your vocabulary naturally. Click any highlighted word while reading to view its definition, Bengali meaning, and status.
              </p>
            </div>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles by title, tag, author..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Stats & Article Count */}
              <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{filteredArticles.length} Articles</span>
                </span>
                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{readArticlesSet.size} Read</span>
                </span>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-slate-100">
              <span className="text-xs font-extrabold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Category:</span>
              </span>
              {categoriesList.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                      : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Featured Article Card */}
          {featuredArticle && !searchQuery && selectedCategory === 'All' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Featured Article</span>
              </div>

              <div 
                onClick={() => setActiveArticleIndex(0)}
                className="group relative bg-slate-900 text-white rounded-3xl p-6 sm:p-8 overflow-hidden shadow-xl border border-slate-800 cursor-pointer hover:border-indigo-500/50 transition-all duration-300"
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${featuredArticle.coverGradient} opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none`} />
                
                <div className="relative z-10 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="px-3 py-1 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full font-bold">
                      {featuredArticle.category}
                    </span>
                    <div className="flex items-center gap-4 text-slate-300 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        {featuredArticle.readTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        {featuredArticle.publishedAt}
                      </span>
                    </div>
                  </div>

                  <h2 className="text-xl sm:text-3xl font-black text-white group-hover:text-indigo-200 transition-colors leading-tight">
                    {featuredArticle.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl font-medium">
                    {featuredArticle.excerpt}
                  </p>

                  <div className="pt-2 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center font-bold text-xs">
                        {featuredArticle.author.charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-slate-200">
                        {featuredArticle.author}
                      </span>
                    </div>

                    <button className="px-5 py-2.5 bg-white text-slate-900 hover:bg-indigo-50 rounded-xl text-xs font-bold transition flex items-center gap-2 group-hover:translate-x-1 duration-200">
                      <span>Read Article</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Article Grid Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                {selectedCategory === 'All' ? 'All Articles' : `${selectedCategory} Articles`}
              </h3>
              <span className="text-xs font-bold text-slate-400">
                Showing {filteredArticles.length} items
              </span>
            </div>

            {filteredArticles.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                <Newspaper className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No articles found matching your criteria.</p>
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition"
                >
                  Reset Search & Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArticles.map((art, idx) => {
                  const isRead = readArticlesSet.has(art.id);
                  return (
                    <motion.div
                      key={art.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setActiveArticleIndex(idx)}
                      className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden"
                    >
                      {/* Top Accent Line */}
                      <div className={`h-1.5 w-full bg-gradient-to-r ${art.coverGradient} absolute top-0 left-0 right-0`} />

                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-md border border-slate-200">
                            {art.category}
                          </span>
                          {isRead && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 font-extrabold rounded-md border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Read</span>
                            </span>
                          )}
                        </div>

                        <h4 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                          {art.title}
                        </h4>

                        <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-3">
                          {art.excerpt}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-semibold text-slate-700">{art.author}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{art.readTime}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ARTICLE READER VIEW */}
      {activeArticle && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Top Sticky Navigation & Toolbar */}
          <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-3 z-30 flex flex-wrap items-center justify-between gap-3">
            
            <button
              onClick={() => setActiveArticleIndex(null)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Articles</span>
            </button>

            {/* Reading Toolbar Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              
              {/* Font Size Selector */}
              <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs font-bold text-slate-600 border border-slate-200" style={{ fontFamily: "'Poppins', sans-serif" }}>
                <Type className="w-3.5 h-3.5 ml-2 mr-1 text-slate-400" />
                <span className="text-[10px] uppercase text-slate-400 font-extrabold mr-1 hidden sm:inline">Font Size:</span>
                {([
                  { id: 'sm', label: 'Small' },
                  { id: 'base', label: 'Medium' },
                  { id: 'lg', label: 'Large' },
                  { id: 'xl', label: 'XL' }
                ] as const).map(option => (
                  <button
                    key={option.id}
                    onClick={() => setFontSize(option.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
                      fontSize === option.id ? 'bg-white text-indigo-600 shadow-2xs font-extrabold border border-slate-200/60' : 'hover:text-slate-900 font-semibold text-slate-600'
                    }`}
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Highlight Color Picker */}
              <div className="hidden sm:flex items-center bg-slate-100 rounded-xl p-1 text-xs font-bold border border-slate-200 gap-1">
                <span className="text-[10px] text-slate-400 px-1 font-extrabold">Highlight:</span>
                <button
                  onClick={() => setHighlightColor('indigo')}
                  className={`w-5 h-5 rounded-full bg-indigo-500 border-2 ${highlightColor === 'indigo' ? 'border-slate-800 scale-110' : 'border-white'}`}
                  title="Indigo Highlight"
                />
                <button
                  onClick={() => setHighlightColor('emerald')}
                  className={`w-5 h-5 rounded-full bg-emerald-500 border-2 ${highlightColor === 'emerald' ? 'border-slate-800 scale-110' : 'border-white'}`}
                  title="Emerald Highlight"
                />
                <button
                  onClick={() => setHighlightColor('amber')}
                  className={`w-5 h-5 rounded-full bg-amber-500 border-2 ${highlightColor === 'amber' ? 'border-slate-800 scale-110' : 'border-white'}`}
                  title="Amber Highlight"
                />
                <button
                  onClick={() => setHighlightColor('rose')}
                  className={`w-5 h-5 rounded-full bg-rose-500 border-2 ${highlightColor === 'rose' ? 'border-slate-800 scale-110' : 'border-white'}`}
                  title="Rose Highlight"
                />
              </div>

              {/* Text-To-Speech Button */}
              <button
                onClick={handleToggleSpeech}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  isSpeaking
                    ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{isSpeaking ? 'Stop Audio' : 'Listen Article'}</span>
              </button>

              {/* Mark as Read Toggle */}
              <button
                onClick={() => toggleArticleReadStatus(activeArticle.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  readArticlesSet.has(activeArticle.id)
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{readArticlesSet.has(activeArticle.id) ? 'Marked Read' : 'Mark as Read'}</span>
              </button>
            </div>
          </div>

          {/* Main Article Reader Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-10 space-y-8">
            
            {/* Article Header Metadata */}
            <div className="space-y-4 border-b border-slate-150 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-full border border-indigo-200">
                  {activeArticle.category}
                </span>
                {activeArticle.tags.map(t => (
                  <span key={t} className="px-2.5 py-0.5 bg-slate-100 text-slate-600 font-medium text-[11px] rounded-full">
                    #{t}
                  </span>
                ))}
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                {activeArticle.title}
              </h1>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {activeArticle.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-slate-800 font-bold">{activeArticle.author}</p>
                    <p className="text-[11px] text-slate-400">{activeArticle.publishedAt}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{activeArticle.readTime}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Article Body Content */}
            <div className={`text-slate-800 font-normal space-y-6 ${getFontSizeClass()}`}>
              {activeArticle.content.split('\n\n').map((paragraph, pIdx) => (
                <p key={pIdx} className="leading-relaxed">
                  {renderHighlightedText(paragraph)}
                </p>
              ))}
            </div>

            {/* Article Footer & Next Navigation */}
            <div className="pt-8 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <span>Vocabulary words highlighted inline. Click any word to inspect meaning.</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={activeArticleIndex === 0}
                  onClick={() => setActiveArticleIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev Article</span>
                </button>

                <button
                  disabled={activeArticleIndex === filteredArticles.length - 1}
                  onClick={() => setActiveArticleIndex(prev => (prev !== null && prev < filteredArticles.length - 1 ? prev + 1 : prev))}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm shadow-indigo-500/20"
                >
                  <span>Next Article</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. VOCABULARY WORD DEFINITION POPUP MODAL */}
      <AnimatePresence>
        {activeWordPopup && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-6 relative overflow-hidden"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveWordPopup(null)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs font-bold transition cursor-pointer"
              >
                ✕
              </button>

              {/* Word Header */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-extrabold rounded-full border border-indigo-150">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Vocabulary Word Detail</span>
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 capitalize">
                    {activeWordPopup.word}
                  </h3>
                  {activeWordPopup.pronunciation && (
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                      /{activeWordPopup.pronunciation}/
                    </span>
                  )}
                </div>
              </div>

              {/* Meaning Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Bengali Meaning
                </span>
                <p className="text-base font-bold text-indigo-900">
                  {activeWordPopup.meaning || 'N/A'}
                </p>
                {activeWordPopup.extraMeaning && (
                  <p className="text-xs text-slate-600 font-medium">
                    Extra: {activeWordPopup.extraMeaning}
                  </p>
                )}
              </div>

              {/* Synonyms & Example */}
              {activeWordPopup.synonyms && (
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Synonyms:
                  </span>
                  <p className="text-slate-700 font-medium">
                    {activeWordPopup.synonyms}
                  </p>
                </div>
              )}

              {activeWordPopup.example && (
                <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/60 space-y-1 text-xs">
                  <span className="font-extrabold text-amber-800 text-[10px] uppercase tracking-wider">
                    Example Usage:
                  </span>
                  <p className="text-amber-950 italic font-medium">
                    "{activeWordPopup.example}"
                  </p>
                </div>
              )}

              {/* Rate Word Buttons */}
              {onRateWord && (
                <div className="space-y-2 pt-2 border-t border-slate-150">
                  <span className="text-xs font-extrabold text-slate-500">
                    Update Word Learning Status:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        onRateWord(activeWordPopup.id, 'know');
                        setActiveWordPopup(null);
                      }}
                      className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Know</span>
                    </button>

                    <button
                      onClick={() => {
                        onRateWord(activeWordPopup.id, 'confusion');
                        setActiveWordPopup(null);
                      }}
                      className="py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Confused</span>
                    </button>

                    <button
                      onClick={() => {
                        onRateWord(activeWordPopup.id, 'dont_know');
                        setActiveWordPopup(null);
                      }}
                      className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Don't Know</span>
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
