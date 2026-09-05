import React, { useState, useMemo } from 'react';
import { AppSettings, WordStatus, SyncLogEntry, Course, DEFAULT_KEYBOARD_SHORTCUTS, VocabularyWord, UserProgress } from '../types';
import SyncDebugTable from './SyncDebugTable';
import { 
  Settings, 
  Layers, 
  Sliders, 
  RotateCcw, 
  Volume2, 
  HelpCircle, 
  Trash2, 
  CheckCircle2, 
  Sparkles,
  Info,
  Keyboard,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Circle,
  ListOrdered,
  BookOpen,
  Shuffle,
  MoveHorizontal,
  MoveVertical,
  ArrowLeftRight,
  Eye,
  ZoomIn,
  Languages,
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  RectangleHorizontal,
  Hash,
  Type,
  Gamepad2,
  Globe,
  Bell,
  Layout,
  Plus,
  Headphones,
  MessageSquare,
  Send,
  ExternalLink,
  Copy,
  Check,
  Mail,
  Share2,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Wifi,
  Package,
  Clock,
  ShieldCheck,
  Activity,
  Filter,
  Database,
  Zap,
  Radio
} from 'lucide-react';

interface AppSettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onClearAllProgress: () => void;
  userEmail?: string | null;
  userId?: string | null;
  syncStatus: string;
  onForceSync?: () => void;
  syncLogs?: SyncLogEntry[];
  allCourses?: Course[];
  progress?: Record<string, UserProgress>;
  onUpdateProgress?: (newProgress: Record<string, UserProgress>) => void;
  words?: VocabularyWord[];
  isOnline?: boolean;
  lastCloudSyncAt?: string | null;
}

export default function AppSettingsView({
  settings,
  onUpdateSettings,
  onClearAllProgress,
  userEmail,
  userId,
  syncStatus,
  onForceSync,
  syncLogs = [],
  allCourses = [],
  progress = {},
  onUpdateProgress,
  words = [],
  isOnline = true,
  lastCloudSyncAt = null
}: AppSettingsViewProps) {

  const [activeTab, setActiveTab] = useState<'account' | 'sync_debug' | 'shortcuts' | 'contact'>('account');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [syncLogFilter, setSyncLogFilter] = useState<'all' | 'auto' | 'manual' | 'offline_queue' | 'cloud_fetch'>('all');

  const formatLogTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSecs < 15) return 'Just now';
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Recently';
    }
  };

  const formatExactDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const displayActivityLogs: SyncLogEntry[] = useMemo(() => {
    // Only REAL sync events are shown — never fabricated "success" placeholders.
    const actual = (syncLogs || []);
    if (syncLogFilter === 'all') return actual.slice(0, 10);
    return actual.filter(l => l.type === syncLogFilter).slice(0, 10);
  }, [syncLogs, syncLogFilter]);

  const handleToggleTag = (tag: WordStatus) => {
    let newTags = [...settings.defaultFlashcardTags];
    if (newTags.includes(tag)) {
      newTags = newTags.filter(t => t !== tag);
    } else {
      newTags.push(tag);
    }
    if (newTags.length === 0) return;
    
    onUpdateSettings({
      ...settings,
      defaultFlashcardTags: newTags
    });
  };

  const handleOrderChange = (order: 'serial' | 'alphabetical' | 'random') => {
    onUpdateSettings({
      ...settings,
      defaultFlashcardOrder: order
    });
  };

  const handleQuizLengthChange = (length: number) => {
    onUpdateSettings({
      ...settings,
      quizLength: length
    });
  };

  const handleToggleAudio = () => {
    onUpdateSettings({
      ...settings,
      autoPlayAudio: !settings.autoPlayAudio
    });
  };

  const handleToggleColorizeMainWord = () => {
    onUpdateSettings({
      ...settings,
      colorizeMainWord: settings.colorizeMainWord !== false ? false : true
    });
  };

  const handleToggleSynonymTag = (tag: 'know' | 'dont_know' | 'unrated') => {
    let newTags = [...(settings.defaultSynonymTags || ['dont_know', 'unrated'])];
    if (newTags.includes(tag)) {
      newTags = newTags.filter(t => t !== tag);
    } else {
      newTags.push(tag);
    }
    if (newTags.length === 0) return;

    onUpdateSettings({
      ...settings,
      defaultSynonymTags: newTags
    });
  };

  const handleSynonymOrderChange = (order: 'serial' | 'alphabetical' | 'random') => {
    onUpdateSettings({
      ...settings,
      defaultSynonymOrder: order
    });
  };

  const handleQuizTypeChange = (type: 'mcq_en_bn' | 'mcq_bn_en' | 'typing_spelling') => {
    onUpdateSettings({
      ...settings,
      defaultQuizType: type
    });
  };

  const handleMatchSizeChange = (size: number) => {
    onUpdateSettings({
      ...settings,
      defaultMatchSize: size
    });
  };

  const handleAnimationChange = (anim: 'flip-h' | 'flip-v' | 'diagonal' | 'shuffle') => {
    onUpdateSettings({
      ...settings,
      flashcardAnimation: anim
    });
  };

  const handleBannerAnimChange = (anim: 'twice_daily' | 'once_daily' | 'disabled') => {
    const count = anim === 'once_daily' ? 1 : anim === 'disabled' ? 0 : 2;
    onUpdateSettings({
      ...settings,
      flashcardBannerAnim: anim,
      flashcardBannerCountPerDay: count
    });
  };

  const handleBannerCountChange = (count: number) => {
    const animMode = count === 0 ? 'disabled' : count === 1 ? 'once_daily' : 'twice_daily';
    onUpdateSettings({
      ...settings,
      flashcardBannerAnim: animMode,
      flashcardBannerCountPerDay: Math.max(0, count)
    });
  };

  const handleBannerDurationChange = (durSec: number) => {
    onUpdateSettings({
      ...settings,
      flashcardBannerDurationSec: Math.max(0.5, durSec)
    });
  };

  // --- Cloud backup & flashcard overview toggles ---
  const handleToggleAutoBackup = () => {
    onUpdateSettings({ ...settings, autoCloudBackup: settings.autoCloudBackup !== false ? false : true } as AppSettings);
  };

  const handleToggleCompactOverview = () => {
    onUpdateSettings({ ...settings, compactFlashcardOverview: !settings.compactFlashcardOverview } as AppSettings);
  };

  const handleToggleStat = (field: 'showTotalWordsStat' | 'showNotStudiedStat' | 'showKnowStat' | 'showConfusedStat' | 'showDontKnowStat') => {
    onUpdateSettings({
      ...settings,
      [field]: settings[field] !== false ? false : true
    } as AppSettings);
  };

  const triggerResetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      onUpdateSettings({
        defaultFlashcardTags: ['know', 'confusion', 'dont_know', 'unrated'],
        defaultFlashcardOrder: 'alphabetical',
        autoPlayAudio: false,
        quizLength: 10,
        defaultSynonymOrder: 'random',
        defaultSynonymTags: ['know', 'dont_know', 'unrated'],
        defaultQuizType: 'mcq_en_bn',
        defaultMatchSize: 8,
        shortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
        flashcardAnimation: 'flip-h',
        colorizeMainWord: true,
        flashcardBannerAnim: 'twice_daily'
      });
    }
  };

  return (
    <div className="flex-1 p-3 sm:p-5 space-y-4 max-w-3xl mx-auto font-sans text-slate-800" id="app-settings-page">
      {/* Top title and resetting button */}
      <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Settings</h1>
        <button
          onClick={triggerResetSettings}
          className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 transition flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Navigation tabs styled elegantly & minimally */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-4 sm:gap-6 pb-px">
        {[
          { key: 'account' as const, label: 'Account & Sync', icon: Settings },
          { key: 'sync_debug' as const, label: 'Sync Debug', icon: Activity, badge: 'Realtime' },
          { key: 'shortcuts' as const, label: 'Shortcuts', icon: Keyboard },
          { key: 'contact' as const, label: 'Contact Us', icon: Headphones }
        ].map(tab => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={tab.label}
              className={`pb-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap px-0.5 ${
                isActive
                  ? 'border-slate-800 text-slate-900 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-violet-100 text-violet-700 rounded-md">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div className="mt-2 transition-all duration-200">
        
        {/* Sync Debug Mode Tab */}
        {activeTab === 'sync_debug' && (
          <SyncDebugTable
            localProgress={progress}
            onUpdateLocalProgress={onUpdateProgress}
            words={words}
            userEmail={userEmail}
            userId={userId}
            onTriggerSync={onForceSync}
          />
        )}
        




        {/* Shortcuts Settings Tab */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <label className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Keyboard Shortcuts</label>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({
                      ...settings,
                      shortcuts: DEFAULT_KEYBOARD_SHORTCUTS
                    });
                  }}
                  className="text-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-semibold transition-all duration-150 cursor-pointer"
                >
                  Reset Shortcuts
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'Space', label: 'Spacebar', icon: RectangleHorizontal },
                  { id: 'Enter', label: 'Enter Key', icon: CornerDownLeft },
                  { id: 'ArrowRight', label: 'Right Arrow (→)', icon: ArrowRight },
                  { id: 'ArrowLeft', label: 'Left Arrow (←)', icon: ArrowLeft },
                  { id: 'ArrowUp', label: 'Up Arrow (↑)', icon: ArrowUp },
                  { id: 'ArrowDown', label: 'Down Arrow (↓)', icon: ArrowDown },
                  { id: 'Digit1', label: 'Number 1', icon: Hash },
                  { id: 'Digit2', label: 'Number 2', icon: Hash },
                  { id: 'Digit3', label: 'Number 3', icon: Hash },
                  { id: 'Digit4', label: 'Number 4', icon: Hash },
                  { id: 'Digit5', label: 'Number 5', icon: Hash },
                  { id: 'Digit6', label: 'Number 6', icon: Hash },
                  { id: 'KeyA', label: 'Letter A', icon: Type },
                  { id: 'KeyS', label: 'Letter S', icon: Type },
                  { id: 'KeyD', label: 'Letter D', icon: Type },
                  { id: 'KeyF', label: 'Letter F', icon: Type },
                  { id: 'KeyG', label: 'Letter G', icon: Type },
                ].map(keyObj => {
                  const currentShortcuts = settings.shortcuts || DEFAULT_KEYBOARD_SHORTCUTS;
                  const assignedAction = currentShortcuts[keyObj.id] || 'none';
   
                  const actionIconsMap: Record<string, { icon: any; color: string; bg: string; label: string }> = {
                    none: { icon: Circle, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-150', label: 'Disabled' },
                    know: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-100', label: 'Learned' },
                    dont_know: { icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-50 border-rose-100', label: 'Unlearned' },
                    confusion: { icon: HelpCircle, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-100', label: 'Confused' },
                    skip: { icon: ChevronRight, color: 'text-sky-500', bg: 'bg-sky-50 border-sky-100', label: 'Next' },
                    prev: { icon: ChevronLeft, color: 'text-sky-500', bg: 'bg-sky-50 border-sky-100', label: 'Prev' },
                    flip: { icon: RotateCcw, color: 'text-indigo-500', bg: 'bg-indigo-50 border-indigo-100', label: 'Flip' },
                    google: { icon: Search, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100', label: 'Google' },
                    audio: { icon: Volume2, color: 'text-teal-500', bg: 'bg-teal-50 border-teal-100', label: 'Speak' },
                  };
   
                  const actionDetail = actionIconsMap[assignedAction] || actionIconsMap.none;
                  const ActionIcon = actionDetail.icon;
                  const KeyIcon = keyObj.icon;
   
                  return (
                    <div key={keyObj.id} className="flex items-center justify-between gap-2 p-1.5 px-2 bg-slate-50/80 hover:bg-slate-100/80 rounded-lg border border-slate-150 transition-all duration-150">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-5.5 h-5.5 rounded-md flex items-center justify-center border border-slate-200 bg-white text-slate-400 shadow-2xs flex-shrink-0">
                          <KeyIcon className="w-2.5 h-2.5" />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 truncate">{keyObj.label}</span>
                      </div>
   
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className={`w-4.5 h-4.5 rounded flex items-center justify-center border ${actionDetail.bg}`} title={actionDetail.label}>
                          <ActionIcon className={`w-2.5 h-2.5 ${actionDetail.color}`} />
                        </div>
                        <div className="relative">
                          <select
                            value={assignedAction}
                            onChange={(e) => {
                              onUpdateSettings({
                                ...settings,
                                shortcuts: {
                                  ...currentShortcuts,
                                  [keyObj.id]: e.target.value
                                }
                              });
                            }}
                            className="w-22 sm:w-26 bg-white hover:bg-slate-50 border border-slate-200 text-[10px] font-medium rounded-md pl-1.5 pr-3.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-800 text-slate-700 cursor-pointer appearance-none transition-all duration-150"
                          >
                            <option value="none">Disabled</option>
                            <option value="know">Learned</option>
                            <option value="dont_know">Unlearned</option>
                            <option value="confusion">Confused</option>
                            <option value="skip">Next Card</option>
                            <option value="prev">Prev Card</option>
                            <option value="flip">Flip Card</option>
                            <option value="google">Google Search</option>
                            <option value="audio">Speak Audio</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-slate-400">
                            <ChevronRight className="w-2 h-2 rotate-90" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Account & Storage Settings Tab */}
        {activeTab === 'account' && (
          <div className="space-y-4 font-['Poppins',sans-serif]">
            
            {/* Flashcard Overview (Start Page) Appearance */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Layout className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Flashcard Overview</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Choose what appears on the flashcard start page.</p>
                </div>
              </div>

              {/* Compact overview master switch */}
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-700">Compact mode</span>
                  <span className="block text-[11px] text-slate-500 font-medium">One-line summary instead of the big donut charts.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.compactFlashcardOverview === true}
                  onClick={handleToggleCompactOverview}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer border ${
                    settings.compactFlashcardOverview ? 'bg-slate-800 border-slate-900' : 'bg-slate-200 border-slate-300'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${settings.compactFlashcardOverview ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="border-t border-slate-100 pt-1 divide-y divide-slate-100/80">
                {[
                  { key: 'showTotalWordsStat', label: 'Total words', icon: Hash },
                  { key: 'showNotStudiedStat', label: 'Not studied', icon: Eye },
                  { key: 'showKnowStat', label: 'Know %', icon: CheckCircle },
                  { key: 'showConfusedStat', label: 'Confused %', icon: AlertTriangle },
                  { key: 'showDontKnowStat', label: "Don't Know %", icon: XCircle }
                ].map(row => {
                  const RowIcon = row.icon;
                  const isOn = (settings as any)[row.key] !== false;
                  return (
                    <div key={row.key} className="flex items-center justify-between gap-3 py-2.5 px-1">
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                        <RowIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{row.label}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        onClick={() => handleToggleStat(row.key as any)}
                        className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 cursor-pointer border ${
                          isOn ? 'bg-indigo-600 border-indigo-700' : 'bg-slate-200 border-slate-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transition-all ${isOn ? 'left-[20px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-rose-50/40 border border-rose-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-rose-800">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <h2 className="text-xs font-bold tracking-wider uppercase">Danger Zone</h2>
              </div>
              
              <p className="text-[11px] text-rose-600/90 leading-relaxed font-medium">
                Permanently delete all study progress, streaks, and custom lists. This action cannot be undone.
              </p>

              <button
                onClick={onClearAllProgress}
                className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Progress</span>
              </button>
            </div>

            {/* How sync works */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                <Info className="w-4 h-4 text-indigo-600" />
                <span>How Cloud Synchronization Works</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Your study activity (mastered words, custom folders, study streaks, and quiz results) is saved in your browser and automatically backed up to your cloud account within a second of every change. Open the same account on another device — phone, PC, or tablet — and your progress appears there automatically.
              </p>
            </div>

          </div>
        )}

        {/* Contact & Support Tab */}
        {activeTab === 'contact' && (
          <div className="space-y-4 font-['Poppins',sans-serif]">
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-5 rounded-2xl text-white shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">Contact & Support</h2>
                  <p className="text-xs text-indigo-200/80 font-medium mt-0.5">Have questions, feedback, or need course access help? Reach out to us directly through any channel below!</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* WhatsApp Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs hover:border-emerald-300 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">WhatsApp Support</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Direct Messaging & Quick Help</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">Instant</span>
                </div>
                
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex items-center justify-between text-xs font-mono font-bold text-slate-700">
                  <span>{settings.contactWhatsApp || '+8801581624202'}</span>
                </div>

                <a
                  href={
                    (settings.contactWhatsApp || '+8801581624202').startsWith('http')
                      ? settings.contactWhatsApp
                      : `https://wa.me/${(settings.contactWhatsApp || '8801581624202').replace(/[^0-9]/g, '')}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat on WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>

              {/* Facebook Link 1 (Page / Official) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs hover:border-sky-300 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Facebook Page</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Official Updates & News</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-md">Official</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 text-xs font-mono font-bold text-slate-700 truncate">
                  {settings.contactFacebook1 || 'https://facebook.com/memorizer.official'}
                </div>

                <a
                  href={settings.contactFacebook1 || 'https://facebook.com/memorizer.official'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  <span>Visit Facebook Page</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>

              {/* Facebook Link 2 (Community / Group) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs hover:border-indigo-300 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Facebook Group</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Community Discussion & Prep Tips</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">Community</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 text-xs font-mono font-bold text-slate-700 truncate">
                  {settings.contactFacebook2 || 'https://facebook.com/groups/memorizer.bd'}
                </div>

                <a
                  href={settings.contactFacebook2 || 'https://facebook.com/groups/memorizer.bd'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Join Facebook Group</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>

              {/* Telegram Channel / Support */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs hover:border-blue-300 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Telegram Channel</h3>
                      <p className="text-[11px] text-slate-500 font-medium">PDF Books, Notes & Updates</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">Telegram</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 text-xs font-mono font-bold text-slate-700 truncate">
                  {settings.contactTelegram || 'https://t.me/memorizer_bd'}
                </div>

                <a
                  href={settings.contactTelegram || 'https://t.me/memorizer_bd'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Open Telegram</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>

              {/* Email Support Card */}
              <div className="md:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs hover:border-amber-300 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Email Support</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Send us detailed feedback or inquiries</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">24/7 Email</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-0 bg-slate-50 p-2.5 rounded-xl border border-slate-150 text-xs font-mono font-bold text-slate-700 truncate">
                    {settings.contactEmail || 'mohammad.001ekram@gmail.com'}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(settings.contactEmail || 'mohammad.001ekram@gmail.com');
                      setCopiedEmail(true);
                      setTimeout(() => setCopiedEmail(false), 2000);
                    }}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedEmail ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedEmail ? 'Copied!' : 'Copy Email'}</span>
                  </button>
                  <a
                    href={`mailto:${settings.contactEmail || 'mohammad.001ekram@gmail.com'}`}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Send Mail</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
