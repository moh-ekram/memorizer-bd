import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookMarked, 
  BookOpen, 
  CalendarCheck2, 
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookText,
  Wrench,
  Newspaper
} from 'lucide-react';
import CustomLists from './CustomLists';
import SearchDictionary from './SearchDictionary';
import DailyPlanner from './DailyPlanner';
import ReadStoryView from './ReadStoryView';
import ReadArticleView from './ReadArticleView';
import { VocabularyWord, WordStatus, CustomFolder, UserProgress, StudyGoal, AppSettings, Course, StoryItem } from '../types';

interface StudyToolsCenterProps {
  words: VocabularyWord[];
  progress: Record<string, UserProgress>;
  folders: CustomFolder[];
  settings?: AppSettings;
  course?: Course;
  stories?: StoryItem[];
  enableStoryMode?: boolean;
  onRateWord: (wordId: string, status: WordStatus) => void;
  onUpdateNotes: (wordId: string, notes: string) => void;
  onToggleBookmark: (wordId: string, folderId: string) => void;
  onCreateFolder: (name: string, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRemoveFromFolder: (wordId: string, folderId: string) => void;
  onLaunchFolderStudy: (folderId: string) => void;
  goal: StudyGoal;
  setGoal: (goal: StudyGoal) => void;
  onLaunchPractice: () => void;
  onOpenSettings?: () => void;
  initialSubTab?: 'hub' | 'lists' | 'dictionary' | 'planner' | 'story' | 'article';
}

export default function StudyToolsCenter({
  words,
  progress,
  folders,
  settings,
  course,
  stories,
  enableStoryMode = true,
  onRateWord,
  onUpdateNotes,
  onToggleBookmark,
  onCreateFolder,
  onDeleteFolder,
  onRemoveFromFolder,
  onLaunchFolderStudy,
  goal,
  setGoal,
  onLaunchPractice,
  onOpenSettings,
  initialSubTab = 'hub'
}: StudyToolsCenterProps) {
  const [subTab, setSubTab] = useState<'hub' | 'lists' | 'dictionary' | 'planner' | 'story' | 'article'>(initialSubTab);

  const activeStories = (stories && stories.length > 0) ? stories : (course?.stories || []);
  const activeArticles = course?.articles || [];
  const isStoryEnabled = enableStoryMode && course?.enabledGames?.story !== false;

  const [mobileCollapsedState, setMobileCollapsedState] = useState<Record<string, boolean>>({});
  const [allCollapsedMobile, setAllCollapsedMobile] = useState<boolean>(false);

  // Configuration for study tools
  const studyToolsConfig = [
    {
      key: 'lists',
      title: 'Bookmark & Lists',
      tag: `${folders.length} Folders`,
      btnText: 'Open',
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      borderHover: 'hover:border-indigo-200',
      tagColor: 'text-indigo-600',
      enabled: true,
      icon: <BookMarked className="w-5 h-5" />,
      action: () => setSubTab('lists')
    },
    {
      key: 'dictionary',
      title: 'Dictionary Search',
      tag: 'Search Words',
      btnText: 'Search',
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      borderHover: 'hover:border-emerald-200',
      tagColor: 'text-emerald-600',
      enabled: true,
      icon: <BookOpen className="w-5 h-5" />,
      action: () => setSubTab('dictionary')
    },
    {
      key: 'planner',
      title: 'Daily Planner',
      tag: `Target: ${goal?.dailyTarget || 15} W/D`,
      btnText: 'Plan',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      borderHover: 'hover:border-amber-200',
      tagColor: 'text-amber-600',
      enabled: true,
      icon: <CalendarCheck2 className="w-5 h-5" />,
      action: () => setSubTab('planner')
    },
    {
      key: 'story',
      title: 'Read Story',
      tag: `${activeStories.length} Stories`,
      btnText: 'Read',
      iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
      borderHover: 'hover:border-purple-200',
      tagColor: 'text-purple-600',
      enabled: isStoryEnabled,
      icon: <BookText className="w-5 h-5" />,
      action: () => setSubTab('story')
    },
    {
      key: 'article',
      title: 'Read Article',
      tag: `${activeArticles.length} Articles`,
      btnText: 'Read',
      iconBg: 'bg-teal-50 text-teal-600 border-teal-100',
      borderHover: 'hover:border-teal-200',
      tagColor: 'text-teal-600',
      enabled: true,
      icon: <Newspaper className="w-5 h-5" />,
      action: () => setSubTab('article')
    }
  ];

  // Sort tools according to settings.studyToolsItemsOrder
  const studyOrder = Array.isArray(settings?.studyToolsItemsOrder) && settings.studyToolsItemsOrder.length > 0
    ? settings.studyToolsItemsOrder
    : ['lists', 'dictionary', 'planner', 'story', 'article'];

  const orderedStudyTools = [...studyToolsConfig].sort((a, b) => {
    const idxA = studyOrder.indexOf(a.key);
    const idxB = studyOrder.indexOf(b.key);
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });

  // Stagger animation variants for cards
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="study-tools-center-wrapper">
      {/* Top Bar navigation when inside a specific study tool */}
      {subTab !== 'hub' && (
        <div className="bg-white p-3 sm:px-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3 animate-fade-in">
          <button
            onClick={() => setSubTab('hub')}
            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer flex items-center justify-center shrink-0"
            title="Back to Hub"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Sub Navigation Pills */}
          <div className="flex items-center gap-1 overflow-x-auto p-0.5 scrollbar-none">
            <button
              onClick={() => setSubTab('lists')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                subTab === 'lists'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Bookmark</span>
            </button>
            <button
              onClick={() => setSubTab('dictionary')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                subTab === 'dictionary'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Dictionary</span>
            </button>
            <button
              onClick={() => setSubTab('planner')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                subTab === 'planner'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Planner</span>
            </button>

            {isStoryEnabled && (
              <button
                onClick={() => setSubTab('story')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                  subTab === 'story'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Read Story</span>
              </button>
            )}

            <button
              onClick={() => setSubTab('article')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                subTab === 'article'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Read Article</span>
            </button>
          </div>
        </div>
      )}

      {/* RENDER ACTIVE MODE */}
      {subTab === 'hub' && (
        <div className="space-y-4">
          {/* Header Area */}
          <div className="px-1 py-0.5 flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Study Tools</h2>
          </div>

          {/* Mobile Collapse / Expand Control Header */}
          <div className="sm:hidden flex items-center justify-between p-3 bg-slate-100/90 rounded-2xl border border-slate-200">
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-600" />
              <span>Study Tools ({orderedStudyTools.filter(i => i.enabled).length})</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const nextState = !allCollapsedMobile;
                setAllCollapsedMobile(nextState);
                const newState: Record<string, boolean> = {};
                orderedStudyTools.forEach(item => { newState[item.key] = nextState; });
                setMobileCollapsedState(newState);
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              {allCollapsedMobile ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Expand All</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Collapse All</span>
                </>
              )}
            </button>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {orderedStudyTools.filter(tool => tool.enabled).map((tool) => {
              const isCollapsedMobile = !!mobileCollapsedState[tool.key];

              return (
                <motion.div
                  key={tool.key}
                  variants={itemVariants}
                  whileHover={{ scale: 1.01 }}
                  onClick={tool.action}
                  className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md ${tool.borderHover} transition duration-200 p-3.5 sm:p-4 flex items-center justify-between cursor-pointer select-none`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${tool.iconBg}`}>
                      {tool.icon}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm leading-tight">{tool.title}</h3>
                      <span className={`text-[10px] font-bold uppercase tracking-wider font-mono ${tool.tagColor} block mt-0.5`}>
                        {tool.tag}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      tool.action();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-extrabold transition shadow-2xs cursor-pointer shrink-0"
                  >
                    <span>{tool.btnText}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      {subTab === 'lists' && (
        <CustomLists
          folders={folders}
          words={words}
          progress={progress}
          onCreateFolder={onCreateFolder}
          onDeleteFolder={onDeleteFolder}
          onRemoveFromFolder={onRemoveFromFolder}
          onLaunchFolderStudy={onLaunchFolderStudy}
        />
      )}

      {subTab === 'dictionary' && (
        <SearchDictionary
          words={words}
          progress={progress}
          folders={folders}
          settings={settings}
          onRateWord={onRateWord}
          onUpdateNotes={onUpdateNotes}
          onToggleBookmark={onToggleBookmark}
        />
      )}

      {subTab === 'planner' && (
        <DailyPlanner
          words={words}
          progress={progress}
          goal={goal}
          setGoal={setGoal}
          onLaunchPractice={onLaunchPractice}
        />
      )}

      {subTab === 'story' && (
        <ReadStoryView
          stories={activeStories}
          words={words}
          progress={progress}
          onRateWord={onRateWord}
          onToggleBookmark={onToggleBookmark}
          onOpenSettings={onOpenSettings}
        />
      )}

      {subTab === 'article' && (
        <ReadArticleView
          articles={activeArticles}
          stories={activeStories}
          words={words}
          progress={progress}
          onRateWord={onRateWord}
          onToggleBookmark={onToggleBookmark}
        />
      )}
    </div>
  );
}
