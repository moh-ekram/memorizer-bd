import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, Save, RotateCcw, Eye, Code, 
  Layers, CheckCircle2, Type, 
  LayoutTemplate, Check, ArrowRight, Library, BookOpen
} from 'lucide-react';
import { AppSettings, Course } from '../types';
import { db, doc, setDoc } from '../lib/db';
import FlashcardExactPreview from './FlashcardExactPreview';

interface LandingPageEditorProps {
  settings?: AppSettings;
  onSaveSettings: (updated: AppSettings) => void;
  courses?: Course[];
}

export default function LandingPageEditor({
  settings,
  onSaveSettings,
  courses = []
}: LandingPageEditorProps) {
  const [badgeText, setBadgeText] = useState(settings?.landingBadgeText || 'Tailored for Aspirants');
  const [headlineMain, setHeadlineMain] = useState(settings?.landingHeadlineMain || 'Master High-Yield Vocabulary with Smart Flashcards & Practice.');
  const [courseSuffix, setCourseSuffix] = useState(settings?.landingCourseSuffix || 'Candidates');
  const [description, setDescription] = useState(
    settings?.landingDescription || 
    'An intelligent, multi-dimensional vocabulary memorizer engineered for GRE, BCS, IELTS, Bank Job, and competitive exam aspirants. Boost retention with 3D Flashcards, Native Audio Pronunciation, Contextual Stories, and Speed Quizzes.'
  );
  const [startBtnText, setStartBtnText] = useState(settings?.landingStartBtnText || 'Get Started Free');
  const [feature1, setFeature1] = useState(settings?.landingFeature1 || '3D Smart Flashcards & TTS Audio');
  const [feature2, setFeature2] = useState(settings?.landingFeature2 || '6+ Interactive Practice Games');
  const [stat1Num, setStat1Num] = useState(settings?.landingStat1Num || '5,000+');
  const [stat1Label, setStat1Label] = useState(settings?.landingStat1Label || 'Curated Words');
  const [stat2Num, setStat2Num] = useState(settings?.landingStat2Num || '6+');
  const [stat2Label, setStat2Label] = useState(settings?.landingStat2Label || 'Learning Modes');
  const [stat3Num, setStat3Num] = useState(settings?.landingStat3Num || '100%');
  const [stat3Label, setStat3Label] = useState(settings?.landingStat3Label || 'Free to Start');

  const [displayCoursesInput, setDisplayCoursesInput] = useState(
    (settings?.landingDisplayCourses && settings.landingDisplayCourses.length > 0)
      ? settings.landingDisplayCourses.join(', ')
      : 'BCS, GRE, IELTS, Bank Job, Primary Teacher, General Vocabulary'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [previewTab, setPreviewTab] = useState<'desktop' | 'mobile'>('desktop');

  // Keep state in sync if external settings prop updates
  useEffect(() => {
    if (settings) {
      if (settings.landingBadgeText !== undefined) setBadgeText(settings.landingBadgeText);
      if (settings.landingHeadlineMain !== undefined) setHeadlineMain(settings.landingHeadlineMain);
      if (settings.landingCourseSuffix !== undefined) setCourseSuffix(settings.landingCourseSuffix);
      if (settings.landingDescription !== undefined) setDescription(settings.landingDescription);
      if (settings.landingStartBtnText !== undefined) setStartBtnText(settings.landingStartBtnText);
      if (settings.landingFeature1 !== undefined) setFeature1(settings.landingFeature1);
      if (settings.landingFeature2 !== undefined) setFeature2(settings.landingFeature2);
      if (settings.landingStat1Num !== undefined) setStat1Num(settings.landingStat1Num);
      if (settings.landingStat1Label !== undefined) setStat1Label(settings.landingStat1Label);
      if (settings.landingStat2Num !== undefined) setStat2Num(settings.landingStat2Num);
      if (settings.landingStat2Label !== undefined) setStat2Label(settings.landingStat2Label);
      if (settings.landingStat3Num !== undefined) setStat3Num(settings.landingStat3Num);
      if (settings.landingStat3Label !== undefined) setStat3Label(settings.landingStat3Label);
      if (settings.landingDisplayCourses && settings.landingDisplayCourses.length > 0) {
        setDisplayCoursesInput(settings.landingDisplayCourses.join(', '));
      }
    }
  }, [settings]);

  const parsedCourses = displayCoursesInput
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const handleSave = async () => {
    setIsSaving(true);
    const updatedSettings: AppSettings = {
      ...(settings || {}),
      landingBadgeText: badgeText.trim(),
      landingHeadlineMain: headlineMain.trim(),
      landingCourseSuffix: courseSuffix.trim(),
      landingDescription: description.trim(),
      landingStartBtnText: startBtnText.trim(),
      landingFeature1: feature1.trim(),
      landingFeature2: feature2.trim(),
      landingStat1Num: stat1Num.trim(),
      landingStat1Label: stat1Label.trim(),
      landingStat2Num: stat2Num.trim(),
      landingStat2Label: stat2Label.trim(),
      landingStat3Num: stat3Num.trim(),
      landingStat3Label: stat3Label.trim(),
      landingDisplayCourses: parsedCourses.length > 0 ? parsedCourses : ['BCS', 'GRE', 'IELTS', 'Bank Job']
    };

    try {
      // 1. Save to Firestore system_settings document
      await setDoc(doc(db, 'system_settings', 'global'), updatedSettings, { merge: true });

      // 2. Backup to Server API
      try {
        await fetch('/api/db/system_settings/doc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 'global', data: updatedSettings })
        });
      } catch (_) {}

      // 3. Update parent state
      onSaveSettings(updatedSettings);

      setToastMessage({ text: 'Landing page changes saved successfully & live globally!', type: 'success' });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Error saving landing page settings:', err);
      setToastMessage({ text: `Failed to save: ${err.message || 'Unknown error'}`, type: 'error' });
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (!window.confirm('Reset all landing page fields to system default values?')) return;
    setBadgeText('Tailored for Aspirants');
    setHeadlineMain('Master High-Yield Vocabulary with Smart Flashcards & Practice.');
    setCourseSuffix('Candidates');
    setDescription(
      'An intelligent, multi-dimensional vocabulary memorizer engineered for GRE, BCS, IELTS, Bank Job, and competitive exam aspirants. Boost retention with 3D Flashcards, Native Audio Pronunciation, Contextual Stories, and Speed Quizzes.'
    );
    setStartBtnText('Get Started Free');
    setFeature1('3D Smart Flashcards & TTS Audio');
    setFeature2('6+ Interactive Practice Games');
    setStat1Num('5,000+');
    setStat1Label('Curated Words');
    setStat2Num('6+');
    setStat2Label('Learning Modes');
    setStat3Num('100%');
    setStat3Label('Free to Start');
    setDisplayCoursesInput('BCS, GRE, IELTS, Bank Job, Primary Teacher, General Vocabulary');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
            <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" />
            <span>Landing Page Visual Editor</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Live Landing Page & Hero Content Editor
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Customize headlines, badge text, features, rotating course names, and view live interactive preview.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            title="Reset to default copy"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <span>Saving to Cloud...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save & Publish Live</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Split-Screen Layout: Editor Form (Left) & Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Configuration Controls */}
        <div className="lg:col-span-5 space-y-5 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Type className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Content & Typography Settings
            </h3>
          </div>

          <div className="space-y-4">
            {/* 1. Feature Badge Text */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Top Badge Tagline
              </label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="e.g., Tailored for Aspirants"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
              <span className="text-[10px] text-slate-400 block">
                Shown inside the glowing chip at the top of the hero.
              </span>
            </div>

            {/* 2. Main Headline */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Main Hero Headline
              </label>
              <textarea
                rows={3}
                value={headlineMain}
                onChange={(e) => setHeadlineMain(e.target.value)}
                placeholder="e.g., Master High-Yield Vocabulary with Smart Flashcards & Practice."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition leading-relaxed"
              />
            </div>

            {/* 3. Rotating Course Tags / Suffix */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Dynamic Rotating Target Tags (Comma Separated)
              </label>
              <input
                type="text"
                value={displayCoursesInput}
                onChange={(e) => setDisplayCoursesInput(e.target.value)}
                placeholder="BCS, GRE, IELTS, Bank Job, Primary Teacher"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={courseSuffix}
                  onChange={(e) => setCourseSuffix(e.target.value)}
                  placeholder="Suffix (e.g. Candidates)"
                  className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
                />
                <span className="text-[11px] text-slate-500 font-medium">
                  → "Tailored for [Tag] {courseSuffix}"
                </span>
              </div>
            </div>

            {/* 4. Sub-Headline / Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Hero Description / Subtitle
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of your vocabulary engine..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition leading-relaxed"
              />
            </div>

            {/* 5. CTA Button Text */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Primary CTA Button Label
              </label>
              <input
                type="text"
                value={startBtnText}
                onChange={(e) => setStartBtnText(e.target.value)}
                placeholder="Get Started Free"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
            </div>

            {/* 6. Feature Bullets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  Feature 1
                </label>
                <input
                  type="text"
                  value={feature1}
                  onChange={(e) => setFeature1(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  Feature 2
                </label>
                <input
                  type="text"
                  value={feature2}
                  onChange={(e) => setFeature2(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* 7. Stats Numbers & Labels */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Stat 1</label>
                <input
                  type="text"
                  value={stat1Num}
                  onChange={(e) => setStat1Num(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-bold"
                />
                <input
                  type="text"
                  value={stat1Label}
                  onChange={(e) => setStat1Label(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-600"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Stat 2</label>
                <input
                  type="text"
                  value={stat2Num}
                  onChange={(e) => setStat2Num(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-bold"
                />
                <input
                  type="text"
                  value={stat2Label}
                  onChange={(e) => setStat2Label(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-600"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Stat 3</label>
                <input
                  type="text"
                  value={stat3Num}
                  onChange={(e) => setStat3Num(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-bold"
                />
                <input
                  type="text"
                  value={stat3Label}
                  onChange={(e) => setStat3Label(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Exact Design & Interactive Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-xs">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Live Exact Preview
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPreviewTab('desktop')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  previewTab === 'desktop'
                    ? 'bg-white text-indigo-600 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('mobile')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  previewTab === 'mobile'
                    ? 'bg-white text-indigo-600 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Mobile View
              </button>
            </div>
          </div>

          {/* Preview Canvas Container */}
          <div className={`mx-auto bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-6 overflow-hidden shadow-inner transition-all duration-300 ${
            previewTab === 'mobile' ? 'max-w-sm' : 'w-full'
          }`}>
            {/* Live Rendered Hero */}
            <div className="space-y-4 text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {badgeText} • <strong className="text-indigo-900">{parsedCourses[0] || 'BCS & GRE'}</strong> {courseSuffix}
                </span>
              </div>

              {/* Headline */}
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                {headlineMain}
              </h2>

              {/* Sub-headline */}
              <p className="text-xs text-slate-600 leading-relaxed font-normal max-w-xl mx-auto">
                {description}
              </p>

              {/* Features Chip Row */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {feature1 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold shadow-2xs">
                    <Layers className="w-3 h-3 text-indigo-600" />
                    {feature1}
                  </span>
                )}
                {feature2 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold shadow-2xs">
                    <Check className="w-3 h-3 text-emerald-600" />
                    {feature2}
                  </span>
                )}
              </div>

              {/* CTA Preview */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                >
                  <span>{startBtnText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Stats Row Preview */}
              <div className="flex items-center justify-center gap-4 pt-3 border-t border-slate-200 text-center">
                <div>
                  <span className="block text-sm font-black text-slate-900 font-mono">{stat1Num}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">{stat1Label}</span>
                </div>
                <div className="w-px h-5 bg-slate-200" />
                <div>
                  <span className="block text-sm font-black text-indigo-600 font-mono">{stat2Num}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">{stat2Label}</span>
                </div>
                <div className="w-px h-5 bg-slate-200" />
                <div>
                  <span className="block text-sm font-black text-emerald-600 font-mono">{stat3Num}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">{stat3Label}</span>
                </div>
              </div>
            </div>

            {/* Live Exact 3D Flashcard Preview */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="text-center mb-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900">
                  Exact Interactive 3D Flashcard Engine
                </span>
                <p className="text-[10px] text-slate-500">
                  Try flipping, pronouncing audio, and interacting below:
                </p>
              </div>
              <FlashcardExactPreview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
