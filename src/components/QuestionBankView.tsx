import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Download, 
  Search, 
  Filter, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Shuffle, 
  Play, 
  Clock, 
  BookOpen, 
  HelpCircle,
  X,
  Edit2,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';
import { db, doc, setDoc, deleteDoc, writeBatch, collection, getDocs } from '../lib/db';
import { QuestionBankItem, QuestionBankRule, Course, Exam, ExamQuestion } from '../types';
import { downloadQuestionBankExcelTemplate, parseQuestionBankExcel } from '../lib/gameExcelUtils';

interface QuestionBankViewProps {
  courses: Course[];
  onExamPublished?: () => void;
}

export function QuestionBankView({ courses, onExamPublished }: QuestionBankViewProps) {
  const [activeTab, setActiveTab] = useState<'repository' | 'scheduler'>('repository');

  // Question Bank State
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup1, setFilterGroup1] = useState<string>('all');
  const [filterGroup2, setFilterGroup2] = useState<string>('all');
  const [filterGroup3, setFilterGroup3] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Upload & Upload Status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Manual Add/Edit Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankItem | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A',
    explanation: '',
    group1: 'General',
    group2: 'General',
    group3: 'General'
  });

  // Exam Scheduler / Generator State
  const [targetCourseId, setTargetCourseId] = useState<string>(courses[0]?.id || '');
  const [examTitle, setExamTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(1);
  const [negativeMarking, setNegativeMarking] = useState<number>(0.25);
  const [rules, setRules] = useState<QuestionBankRule[]>([
    { id: 'rule-1', group1: 'all', group2: 'all', group3: 'all', count: 10 }
  ]);

  // Generated Exam Preview State
  const [generatedExam, setGeneratedExam] = useState<Exam | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Fetch Question Bank from Firestore
  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'question_bank'));
      const list: QuestionBankItem[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as QuestionBankItem);
      });
      setQuestions(list);
    } catch (err) {
      console.error('Failed to fetch question bank:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Compute unique groups for filter dropdowns
  const uniqueGroups1 = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => { if (q.group1) set.add(q.group1); });
    return Array.from(set).sort();
  }, [questions]);

  const uniqueGroups2 = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      if (filterGroup1 !== 'all' && q.group1 !== filterGroup1) return;
      if (q.group2) set.add(q.group2);
    });
    return Array.from(set).sort();
  }, [questions, filterGroup1]);

  const uniqueGroups3 = useMemo(() => {
    const set = new Set<string>();
    questions.forEach(q => {
      if (filterGroup1 !== 'all' && q.group1 !== filterGroup1) return;
      if (filterGroup2 !== 'all' && q.group2 !== filterGroup2) return;
      if (q.group3) set.add(q.group3);
    });
    return Array.from(set).sort();
  }, [questions, filterGroup1, filterGroup2]);

  // Filtered Questions list
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (filterGroup1 !== 'all' && q.group1 !== filterGroup1) return false;
      if (filterGroup2 !== 'all' && q.group2 !== filterGroup2) return false;
      if (filterGroup3 !== 'all' && q.group3 !== filterGroup3) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesQ = q.question.toLowerCase().includes(query);
        const matchesOpt = [q.optionA, q.optionB, q.optionC, q.optionD].some(o => o.toLowerCase().includes(query));
        const matchesG = [q.group1, q.group2, q.group3].some(g => g?.toLowerCase().includes(query));
        return matchesQ || matchesOpt || matchesG;
      }
      return true;
    });
  }, [questions, filterGroup1, filterGroup2, filterGroup3, searchQuery]);

  // Handle Excel Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Parsing spreadsheet...');

    try {
      const parsed = await parseQuestionBankExcel(file);
      if (parsed.length === 0) {
        alert('No valid questions found in the spreadsheet.');
        setIsUploading(false);
        setUploadStatus(null);
        return;
      }

      setUploadStatus(`Saving ${parsed.length} questions to cloud database...`);

      // Batch save to Firestore in chunks of 100
      const batchSize = 100;
      for (let i = 0; i < parsed.length; i += batchSize) {
        const batch = writeBatch(db as any);
        const chunk = parsed.slice(i, i + batchSize);
        chunk.forEach(q => {
          const docRef = doc(db as any, 'question_bank', q.id);
          batch.set(docRef, q, { merge: true });
        });
        await batch.commit();
        setUploadStatus(`Saved ${Math.min(i + batchSize, parsed.length)} / ${parsed.length} questions...`);
      }

      await fetchQuestions();
      setUploadStatus(`Successfully uploaded ${parsed.length} questions!`);
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err: any) {
      console.error('Upload error:', err);
      alert('Error processing Excel file: ' + (err?.message || 'Unknown error'));
      setUploadStatus(null);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Manual Add / Edit Question
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question.trim() || !formData.optionA.trim() || !formData.optionB.trim()) {
      alert('Question text and at least Options A & B are required.');
      return;
    }

    const qId = editingQuestion ? editingQuestion.id : `qb-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    
    // Resolve correct answer value
    let ansVal = formData.optionA;
    if (formData.correctAnswer === 'B') ansVal = formData.optionB;
    else if (formData.correctAnswer === 'C') ansVal = formData.optionC || formData.optionA;
    else if (formData.correctAnswer === 'D') ansVal = formData.optionD || formData.optionA;

    const item: QuestionBankItem = {
      id: qId,
      question: formData.question.trim(),
      optionA: formData.optionA.trim(),
      optionB: formData.optionB.trim(),
      optionC: formData.optionC.trim() || 'N/A',
      optionD: formData.optionD.trim() || 'N/A',
      correctAnswer: ansVal,
      explanation: formData.explanation.trim() || 'সঠিক উত্তরের ব্যাখ্যা শীঘ্রই সংযুক্ত করা হবে।',
      group1: formData.group1.trim() || 'General',
      group2: formData.group2.trim() || 'General',
      group3: formData.group3.trim() || 'General',
      createdAt: editingQuestion?.createdAt || new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'question_bank', qId), item, { merge: true });
      await fetchQuestions();
      setShowAddModal(false);
      setEditingQuestion(null);
      setFormData({
        question: '', optionA: '', optionB: '', optionC: '', optionD: '',
        correctAnswer: 'A', explanation: '', group1: 'General', group2: 'General', group3: 'General'
      });
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save question to Firestore.');
    }
  };

  const handleEditClick = (q: QuestionBankItem) => {
    setEditingQuestion(q);
    
    // Determine letter for correctAnswer
    let letter = 'A';
    if (q.correctAnswer === q.optionB) letter = 'B';
    else if (q.correctAnswer === q.optionC) letter = 'C';
    else if (q.correctAnswer === q.optionD) letter = 'D';

    setFormData({
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: letter,
      explanation: q.explanation || '',
      group1: q.group1 || 'General',
      group2: q.group2 || 'General',
      group3: q.group3 || 'General'
    });
    setShowAddModal(true);
  };

  const handleDeleteSingle = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteDoc(doc(db, 'question_bank', id));
      setQuestions(prev => prev.filter(q => q.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete question.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected questions?`)) return;

    try {
      const idsArr = Array.from(selectedIds);
      for (let i = 0; i < idsArr.length; i += 100) {
        const batch = writeBatch(db as any);
        idsArr.slice(i, i + 100).forEach((id: string) => {
          batch.delete(doc(db as any, 'question_bank', id));
        });
        await batch.commit();
      }
      setQuestions(prev => prev.filter(q => !selectedIds.has(q.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk delete error:', err);
      alert('Failed to bulk delete questions.');
    }
  };

  // --- EXAM SCHEDULER LOGIC ---
  const handleAddRule = () => {
    setRules(prev => [
      ...prev,
      { id: `rule-${Date.now()}`, group1: 'all', group2: 'all', group3: 'all', count: 5 }
    ]);
  };

  const handleRemoveRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleRuleChange = (id: string, field: keyof QuestionBankRule, value: any) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Calculate matching available questions for a rule
  const getMatchingCount = (rule: QuestionBankRule) => {
    return questions.filter(q => {
      if (rule.group1 && rule.group1 !== 'all' && q.group1 !== rule.group1) return false;
      if (rule.group2 && rule.group2 !== 'all' && q.group2 !== rule.group2) return false;
      if (rule.group3 && rule.group3 !== 'all' && q.group3 !== rule.group3) return false;
      return true;
    }).length;
  };

  // Generate Randomized Exam based on Group Rules
  const handleGenerateExam = () => {
    if (questions.length === 0) {
      alert('Question Bank is empty! Please upload or add questions first.');
      return;
    }

    if (rules.length === 0) {
      alert('Please add at least one group matching rule.');
      return;
    }

    setIsGenerating(true);
    setGeneratedExam(null);

    setTimeout(() => {
      const pickedQuestionIds = new Set<string>();
      const compiledExamQuestions: ExamQuestion[] = [];

      for (const rule of rules) {
        const pool = questions.filter(q => {
          if (pickedQuestionIds.has(q.id)) return false; // Avoid duplicates across rules
          if (rule.group1 && rule.group1 !== 'all' && q.group1 !== rule.group1) return false;
          if (rule.group2 && rule.group2 !== 'all' && q.group2 !== rule.group2) return false;
          if (rule.group3 && rule.group3 !== 'all' && q.group3 !== rule.group3) return false;
          return true;
        });

        // Shuffle pool
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const countToPick = Math.min(rule.count, shuffled.length);
        const selected = shuffled.slice(0, countToPick);

        selected.forEach(q => {
          pickedQuestionIds.add(q.id);
          compiledExamQuestions.push({
            id: q.id,
            question: q.question,
            options: [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean),
            answer: q.correctAnswer,
            explanation: q.explanation
          });
        });
      }

      if (compiledExamQuestions.length === 0) {
        alert('No matching questions found for the specified rules. Try adjusting the group filters.');
        setIsGenerating(false);
        return;
      }

      const targetCourse = courses.find(c => c.id === targetCourseId);
      const totalMarks = compiledExamQuestions.length * marksPerQuestion;

      const examObj: Exam = {
        id: `exam-${Date.now()}`,
        title: examTitle.trim() || `Scheduled Random Exam (${compiledExamQuestions.length} Questions)`,
        description: `Randomized exam generated from Question Bank with ${compiledExamQuestions.length} questions.`,
        courseId: targetCourseId || undefined,
        courseTitle: targetCourse ? targetCourse.title : 'Global Practice Exam',
        durationMinutes: Number(durationMinutes) || 15,
        marksPerQuestion: Number(marksPerQuestion) || 1,
        negativeMarking: Number(negativeMarking) || 0.25,
        totalMarks,
        questions: compiledExamQuestions,
        createdAt: new Date().toISOString()
      };

      setGeneratedExam(examObj);
      setIsGenerating(false);
    }, 200);
  };

  // Publish Exam to Firestore
  const handlePublishExam = async () => {
    if (!generatedExam) return;

    setIsPublishing(true);
    setPublishSuccess(false);

    try {
      await setDoc(doc(db, 'exams', generatedExam.id), generatedExam);
      setPublishSuccess(true);
      if (onExamPublished) onExamPublished();
      setTimeout(() => setPublishSuccess(false), 4000);
    } catch (err) {
      console.error('Error publishing exam:', err);
      alert('Failed to publish exam to Firestore.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-200 text-xs font-extrabold uppercase tracking-widest">
            <Database className="w-3.5 h-3.5 text-indigo-300" />
            <span>Master Question Bank Engine</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            প্রশ্ন ব্যাংক ও র্যান্ডম এক্সাম শিডিউলার
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-xl leading-relaxed">
            এক্সেল দিয়ে প্রশ্ন আপলোড করুন, গ্রুপ কন্ডিশন সেট করুন এবং স্বয়ংক্রিয়ভাবে র্যান্ডম প্রশ্ন বেছে অনলাইন পরীক্ষা প্রকাশ করুন।
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 z-10 shrink-0">
          <button
            onClick={() => setActiveTab('repository')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'repository'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>প্রশ্ন ভাণ্ডার ({questions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('scheduler')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'scheduler'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>গ্রুপ কন্ডিশন এক্সাম শিডিউলার</span>
          </button>
        </div>
      </div>

      {/* Upload Status Alert */}
      {uploadStatus && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs font-extrabold text-indigo-900 flex items-center gap-3 animate-fadeIn">
          <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* TAB 1: QUESTION REPOSITORY */}
      {activeTab === 'repository' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Action Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            {/* Search & Group Filters */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Search input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="প্রশ্ন বা উত্তর খুঁজুন..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              {/* Group 1 Filter */}
              <select
                value={filterGroup1}
                onChange={(e) => {
                  setFilterGroup1(e.target.value);
                  setFilterGroup2('all');
                  setFilterGroup3('all');
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">সব বিষয় (Group 1)</option>
                {uniqueGroups1.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              {/* Group 2 Filter */}
              <select
                value={filterGroup2}
                onChange={(e) => {
                  setFilterGroup2(e.target.value);
                  setFilterGroup3('all');
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">সব টপিক (Group 2)</option>
                {uniqueGroups2.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              {/* Group 3 Filter */}
              <select
                value={filterGroup3}
                onChange={(e) => setFilterGroup3(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">সব ক্যাটাগরি (Group 3)</option>
                {uniqueGroups3.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadQuestionBankExcelTemplate}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Download Excel Format Sample"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>টেমপ্লেট ডাউনলোড</span>
              </button>

              <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
                <span>এক্সেল আপলোড</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>

              <button
                onClick={() => {
                  setEditingQuestion(null);
                  setFormData({
                    question: '', optionA: '', optionB: '', optionC: '', optionD: '',
                    correctAnswer: 'A', explanation: '', group1: 'General', group2: 'General', group3: 'General'
                  });
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন প্রশ্ন যোগ করুন</span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">মোট প্রশ্ন</span>
              <span className="text-xl font-black text-indigo-600">{questions.length} টি</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">বিষয় (Group 1)</span>
              <span className="text-xl font-black text-slate-800">{uniqueGroups1.length} টি</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">টপিক (Group 2)</span>
              <span className="text-xl font-black text-slate-800">{uniqueGroups2.length} টি</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">ফিল্টার করা দেখাচ্ছে</span>
              <span className="text-xl font-black text-emerald-600">{filteredQuestions.length} টি</span>
            </div>
          </div>

          {/* Bulk Action Controls */}
          {selectedIds.size > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-4 animate-fadeIn">
              <span className="text-xs font-extrabold text-rose-900">
                {selectedIds.size} টি প্রশ্ন সিলেক্ট করা হয়েছে
              </span>
              <button
                onClick={handleDeleteSelected}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>সিলেক্ট করা প্রশ্ন ডিলিট করুন</span>
              </button>
            </div>
          )}

          {/* Question Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-extrabold sticky top-0 uppercase tracking-wider">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === filteredQuestions.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(filteredQuestions.map(q => q.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                    </th>
                    <th className="p-3 min-w-[240px]">প্রশ্ন (Question)</th>
                    <th className="p-3 min-w-[200px]">অপশনসমূহ & উত্তর</th>
                    <th className="p-3 w-36">গ্রুপ/বিষয়</th>
                    <th className="p-3 w-36">টপিক/অধ্যায়</th>
                    <th className="p-3 w-32">ক্যাটাগরি</th>
                    <th className="p-3 w-20 text-center">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        <span>প্রশ্ন ভাণ্ডার লোড হচ্ছে...</span>
                      </td>
                    </tr>
                  ) : filteredQuestions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold">
                        কোনো প্রশ্ন পাওয়া যায়নি। "নতুন প্রশ্ন যোগ করুন" বা "এক্সেল আপলোড" বাটনে ক্লিক করুন।
                      </td>
                    </tr>
                  ) : (
                    filteredQuestions.map(q => (
                      <tr key={q.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(q.id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(q.id);
                              else next.delete(q.id);
                              setSelectedIds(next);
                            }}
                            className="rounded border-slate-300 text-indigo-600"
                          />
                        </td>
                        <td className="p-3 space-y-1">
                          <span className="font-extrabold text-slate-900 block leading-relaxed">{q.question}</span>
                          {q.explanation && (
                            <span className="text-[11px] text-slate-400 block font-normal italic">
                              ব্যাখ্যা: {q.explanation}
                            </span>
                          )}
                        </td>
                        <td className="p-3 space-y-1 text-[11px]">
                          <div className="grid grid-cols-2 gap-1">
                            <span className={q.correctAnswer === q.optionA ? 'font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded' : 'text-slate-500'}>
                              A: {q.optionA}
                            </span>
                            <span className={q.correctAnswer === q.optionB ? 'font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded' : 'text-slate-500'}>
                              B: {q.optionB}
                            </span>
                            <span className={q.correctAnswer === q.optionC ? 'font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded' : 'text-slate-500'}>
                              C: {q.optionC}
                            </span>
                            <span className={q.correctAnswer === q.optionD ? 'font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded' : 'text-slate-500'}>
                              D: {q.optionD}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-extrabold text-[10px] inline-block">
                            {q.group1 || 'General'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-[10px] inline-block">
                            {q.group2 || 'General'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-[10px] inline-block">
                            {q.group3 || 'General'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditClick(q)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Edit Question"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSingle(q.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXAM SCHEDULER */}
      {activeTab === 'scheduler' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Exam Configuration Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>অনলাইন এক্সাম কনফিগারেশন</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                পরীক্ষার নাম, সময়সীমা, মার্কস এবং গ্রুপ কন্ডিশন নির্ধারণ করে র্যান্ডম এক্সাম তৈরি করুন।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Target Course */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">টার্গেট কোর্স</label>
                <select
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">গ্লোবাল / ফ্রি প্র্যাকটিস এক্সাম</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              {/* Exam Title */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-extrabold text-slate-700 block">পরীক্ষার শিরোনাম (Title)</label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="e.g. BCS Special Practice Exam 01"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Duration Minutes */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">সময় (মিনিট)</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  min={1}
                  max={300}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Marks per question */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">প্রতি প্রশ্নের মান (Marks)</label>
                <input
                  type="number"
                  step="0.5"
                  value={marksPerQuestion}
                  onChange={(e) => setMarksPerQuestion(Number(e.target.value))}
                  min={0.5}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Negative Marking */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">নেগেটিভ মার্কিং (প্রতি ভুল উত্তর)</label>
                <input
                  type="number"
                  step="0.05"
                  value={negativeMarking}
                  onChange={(e) => setNegativeMarking(Number(e.target.value))}
                  min={0}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Group Matching Rules Table */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">গ্রুপ কন্ডিশন ম্যাচিং রুলস (Rules)</h4>
                  <p className="text-xs text-slate-400 font-medium">
                    নির্দিষ্ট কন্ডিশন পূরণ করে কতটি প্রশ্ন বেছে নেওয়া হবে তা ঠিক করুন।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন রুল যোগ করুন</span>
                </button>
              </div>

              <div className="space-y-3">
                {rules.map((rule, index) => {
                  const matchingCount = getMatchingCount(rule);
                  const isInsufficient = matchingCount < rule.count;

                  return (
                    <div key={rule.id} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <span className="text-xs font-black text-indigo-600 shrink-0">
                        Rule #{index + 1}
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 flex-1">
                        {/* Group 1 */}
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1">Group 1 / বিষয়</label>
                          <select
                            value={rule.group1 || 'all'}
                            onChange={(e) => handleRuleChange(rule.id, 'group1', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          >
                            <option value="all">সব বিষয় (Any Subject)</option>
                            {uniqueGroups1.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>

                        {/* Group 2 */}
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1">Group 2 / টপিক</label>
                          <select
                            value={rule.group2 || 'all'}
                            onChange={(e) => handleRuleChange(rule.id, 'group2', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          >
                            <option value="all">সব টপিক (Any Topic)</option>
                            {uniqueGroups2.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>

                        {/* Group 3 */}
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1">Group 3 / ক্যাটাগরি</label>
                          <select
                            value={rule.group3 || 'all'}
                            onChange={(e) => handleRuleChange(rule.id, 'group3', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          >
                            <option value="all">সব ক্যাটাগরি (Any Tag)</option>
                            {uniqueGroups3.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>

                        {/* Question Count */}
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1">প্রশ্নের সংখ্যা</label>
                          <input
                            type="number"
                            value={rule.count}
                            onChange={(e) => handleRuleChange(rule.id, 'count', Number(e.target.value))}
                            min={1}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                          />
                        </div>
                      </div>

                      {/* Matching info */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className={`text-[11px] font-extrabold block ${isInsufficient ? 'text-amber-600' : 'text-emerald-600'}`}>
                            ব্যাংকে আছে: {matchingCount} টি
                          </span>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            পিক করবে: {rule.count} টি
                          </span>
                        </div>

                        {rules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(rule.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Generate Exam Button */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateExam}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>প্রশ্ন নির্বাচন হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Shuffle className="w-4 h-4" />
                    <span>র্যান্ডম এক্সাম জেনারেট করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Exam Preview */}
          {generatedExam && (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-emerald-200/80 shadow-lg space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>পরীক্ষা প্রস্তুত করা হয়েছে</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{generatedExam.title}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    মোট প্রশ্ন: {generatedExam.questions.length} টি | সময়: {generatedExam.durationMinutes} মিনিট | মোট নম্বর: {generatedExam.totalMarks}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={handlePublishExam}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-lg transition flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>পাবলিশ হচ্ছে...</span>
                    </>
                  ) : publishSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>সফলভাবে অনলাইন এক্সামে প্রকাশিত!</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>অনলাইন এক্সাম লিস্টে প্রকাশ করুন</span>
                    </>
                  )}
                </button>
              </div>

              {/* Questions List Preview */}
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">নির্বাচিত প্রশ্নসমূহ ({generatedExam.questions.length}):</h4>
                {generatedExam.questions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-black rounded-md text-[11px] shrink-0">
                        #{idx + 1}
                      </span>
                      <p className="font-extrabold text-slate-900 text-xs leading-relaxed">{q.question}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-medium text-slate-600 pl-7">
                      {q.options.map((opt, oIdx) => (
                        <span 
                          key={oIdx} 
                          className={opt === q.answer ? 'font-black text-emerald-700 bg-emerald-100/70 px-2 py-1 rounded-lg border border-emerald-200' : 'bg-white px-2 py-1 rounded-lg border border-slate-200'}
                        >
                          {String.fromCharCode(65 + oIdx)}: {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-scaleUp">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                {editingQuestion ? 'প্রশ্ন এডিট করুন' : 'নতুন প্রশ্ন যোগ করুন'}
              </h3>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              {/* Question Text */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 block">প্রশ্ন (Question)</label>
                <textarea
                  rows={3}
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="এখানে প্রশ্নটি লিখুন..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">অপশন A (ক)</label>
                  <input
                    type="text"
                    value={formData.optionA}
                    onChange={(e) => setFormData({ ...formData, optionA: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">অপশন B (খ)</label>
                  <input
                    type="text"
                    value={formData.optionB}
                    onChange={(e) => setFormData({ ...formData, optionB: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">অপশন C (গ)</label>
                  <input
                    type="text"
                    value={formData.optionC}
                    onChange={(e) => setFormData({ ...formData, optionC: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">অপশন D (ঘ)</label>
                  <input
                    type="text"
                    value={formData.optionD}
                    onChange={(e) => setFormData({ ...formData, optionD: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              {/* Correct Answer & Explanation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">সঠিক উত্তর</label>
                  <select
                    value={formData.correctAnswer}
                    onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="A">A (অপশন ক)</option>
                    <option value="B">B (অপশন খ)</option>
                    <option value="C">C (অপশন গ)</option>
                    <option value="D">D (অপশন ঘ)</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-extrabold text-slate-600 block">ব্যাখ্যা (Explanation)</label>
                  <input
                    type="text"
                    value={formData.explanation}
                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                    placeholder="সঠিক উত্তরের ব্যাখ্যা..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              {/* Group Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Group 1 (বিষয়)</label>
                  <input
                    type="text"
                    value={formData.group1}
                    onChange={(e) => setFormData({ ...formData, group1: e.target.value })}
                    placeholder="e.g. English, Bangla"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Group 2 (টপিক)</label>
                  <input
                    type="text"
                    value={formData.group2}
                    onChange={(e) => setFormData({ ...formData, group2: e.target.value })}
                    placeholder="e.g. Grammar, Algebra"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Group 3 (ক্যাটাগরি)</label>
                  <input
                    type="text"
                    value={formData.group3}
                    onChange={(e) => setFormData({ ...formData, group3: e.target.value })}
                    placeholder="e.g. BCS, Bank, Varsity"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  সেভ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
