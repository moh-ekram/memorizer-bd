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
  Wrench
} from 'lucide-react';
import CustomLists from './CustomLists';
import SearchDictionary from './SearchDictionary';
import DailyPlanner from './DailyPlanner';
import ReadStoryView from './ReadStoryView';
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
  initialSubTab?: 'hub' | 'lists' | 'dictionary' | 'planner' | 'story';
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
  const [subTab, setSubTab] = useState<'hub' | 'lists' | 'dictionary' | 'planner' | 'story'>(initialSubTab);

  const activeStories = (stories && stories.length > 0) ? stories : (course?.stories || []);
  const isStoryEnabled = enableStoryMode && course?.enabledGames?.story !== false;

  const [mobileCollapsedState, setMobileCollapsedState] = useState<Record<string, boolean>>({});
  const [allCollapsedMobile, setAllCollapsedMobile] = useState<boolean>(false);

  // Configuration for study tools
  const studyToolsConfig = [
    {
      key: 'lists',
      title: 'Bookmark & Lists',
      banglaTitle: 'বুকমার্ক ও কাস্টম লিস্ট',
      desc: 'গুরুত্বপূর্ণ ও কঠিন শব্দগুলো বুকমার্ক করে নিজস্ব কাস্টম লিস্টে ফোল্ডার অনুযায়ী গুছিয়ে রাখুন।',
      tag: `${folders.length} Folders`,
      btnText: 'Open Lists',
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      borderHover: 'hover:border-indigo-200',
      tagColor: 'text-indigo-600',
      enabled: true,
      icon: <BookMarked className="w-6 h-6" />,
      action: () => setSubTab('lists')
    },
    {
      key: 'dictionary',
      title: 'Dictionary',
      banglaTitle: 'ডিকশনারি সার্চ',
      desc: 'ভোকেবুলারির যেকোনো শব্দ দ্রুত সার্চ করে অর্থ, উদাহরণ ও সমার্থক শব্দ শিখুন।',
      tag: 'Search Words',
      btnText: 'Open Dictionary',
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      borderHover: 'hover:border-emerald-200',
      tagColor: 'text-emerald-600',
      enabled: true,
      icon: <BookOpen className="w-6 h-6" />,
      action: () => setSubTab('dictionary')
    },
    {
      key: 'planner',
      title: 'Daily Planner',
      banglaTitle: 'দৈনিক পড়ার লক্ষ্য',
      desc: 'দৈনিক পড়ার টার্গেট সেট করুন এবং ধারাবাহিকতা বজায় রেখে অগ্রগতি ট্র্যাক করুন।',
      tag: `Goal: ${goal.dailyTarget} Words`,
      btnText: 'Open Planner',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      borderHover: 'hover:border-amber-200',
      tagColor: 'text-amber-600',
      enabled: true,
      icon: <CalendarCheck2 className="w-6 h-6" />,
      action: () => setSubTab('planner')
    },
    {
      key: 'story',
      title: 'Read Story',
      banglaTitle: 'গল্প পড়ে শেখা',
      desc: 'গল্পের মাধ্যমে শব্দের সঠিক ব্যবহার শিখুন। কোর্সের শব্দসমূহ হাইলাইট আকারে পড়ার সুযোগ।',
      tag: `${activeStories.length} Stories`,
      btnText: 'Read Stories',
      iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
      borderHover: 'hover:border-purple-200',
      tagColor: 'text-purple-600',
      enabled: isStoryEnabled,
      icon: <BookText className="w-6 h-6" />,
      action: () => setSubTab('story')
    }
  ];

  // Sort tools according to settings.studyToolsItemsOrder
  const studyOrder = settings?.studyToolsItemsOrder && settings.studyToolsItemsOrder.length > 0
    ? settings.studyToolsItemsOrder
    : ['lists', 'dictionary', 'planner', 'story'];

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
    <div className="space-y-6" id="study-tools-center-wrapper">
      {/* Top Bar navigation when inside a specific study tool */}
      {subTab !== 'hub' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-250/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <button
            onClick={() => setSubTab('hub')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Hub</span>
          </button>

          {/* Sub Navigation Capsules */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-0.5 scrollbar-none">
            <button
              onClick={() => setSubTab('lists')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                subTab === 'lists'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>Bookmark</span>
            </button>
            <button
              onClick={() => setSubTab('dictionary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                subTab === 'dictionary'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Dictionary</span>
            </button>
            <button
              onClick={() => setSubTab('planner')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                subTab === 'planner'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
              }`}
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              <span>Planner</span>
            </button>

            {isStoryEnabled && (
              <button
                onClick={() => setSubTab('story')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  subTab === 'story'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                }`}
              >
                <BookText className="w-3.5 h-3.5" />
                <span>Read story</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* RENDER ACTIVE MODE */}
      {subTab === 'hub' && (
        <div className="space-y-6">
          {/* Header Hero Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-md">
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
            <div className="max-w-2xl space-y-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/20 text-indigo-200 text-[10px] font-bold rounded-full uppercase tracking-wider border border-indigo-500/30">
                Resource Hub
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Study Tools</h2>
              <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed font-medium">
                Use the study tools below to make your learning organized and planned. Bookmarks, Dictionary, and Daily Planner are integrated here.
              </p>
            </div>
          </div>

          {/* Mobile Collapse / Expand Control Header */}
          <div className="sm:hidden flex items-center justify-between p-3.5 bg-slate-100/90 rounded-2xl border border-slate-200">
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-600" />
              <span>স্টাডি টুলস ({orderedStudyTools.filter(i => i.enabled).length})</span>
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
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {orderedStudyTools.filter(tool => tool.enabled).map((tool) => {
              const isCollapsedMobile = !!mobileCollapsedState[tool.key];

              return (
                <motion.div
                  key={tool.key}
                  variants={itemVariants}
                  whileHover={{ y: -3, scale: 1.005 }}
                  className={`bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md ${tool.borderHover} transition duration-300 flex flex-col justify-between overflow-hidden`}
                >
                  {/* Tool Header (Collapsible on Mobile) */}
                  <div 
                    onClick={() => {
                      setMobileCollapsedState(prev => ({ ...prev, [tool.key]: !prev[tool.key] }));
                    }}
                    className="p-5 flex items-center justify-between cursor-pointer sm:cursor-default"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${tool.iconBg}`}>
                        {tool.icon}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-base leading-tight">{tool.title}</h3>
                        <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">{tool.banglaTitle}</span>
                      </div>
                    </div>

                    {/* Mobile Collapse Chevron Toggle */}
                    <div className="sm:hidden text-slate-400 p-1">
                      {isCollapsedMobile ? (
                        <ChevronDown className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Tool Body & Footer (Hidden when collapsed on mobile) */}
                  <div className={`${isCollapsedMobile ? 'hidden sm:block' : 'block'} px-5 pb-5 space-y-4 pt-0 border-t border-slate-100/60 sm:border-t-0`}>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed pt-2">
                      {tool.desc}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className={`text-[10px] font-bold tracking-wider uppercase font-mono ${tool.tagColor}`}>
                        {tool.tag}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          tool.action();
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                      >
                        <span>{tool.btnText}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
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
    </div>
  );
}
