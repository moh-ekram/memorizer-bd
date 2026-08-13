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
  Check,
  Award,
  Info
} from 'lucide-react';
import { db, doc, setDoc, deleteDoc, writeBatch, collection, getDocs, saveBulkDocs } from '../lib/db';
import { QuestionBankItem, QuestionBankRule, Course, Exam, ExamQuestion } from '../types';
import { downloadQuestionBankExcelTemplate, parseQuestionBankExcel } from '../lib/gameExcelUtils';
import { safeGetLocalStorage, safeSetLocalStorage } from '../lib/storage';

interface QuestionBankViewProps {
  courses: Course[];
  onExamPublished?: () => void;
}

export function QuestionBankView({ courses, onExamPublished }: QuestionBankViewProps) {
  const [activeTab, setActiveTab] = useState<'repository' | 'scheduler' | 'scheduled_exams'>('repository');

  // Question Bank State
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup1, setFilterGroup1] = useState<string>('all');
  const [filterGroup2, setFilterGroup2] = useState<string>('all');
  const [filterGroup3, setFilterGroup3] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Scheduled Exams State
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState<boolean>(false);

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
  const [creationMode, setCreationMode] = useState<'selected' | 'random'>('selected');
  const [generatedExam, setGeneratedExam] = useState<Exam | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  // Fetch Question Bank from Firestore with LocalStorage Fallback & Blank Questions Migration
  const fetchQuestions = async () => {
    setLoading(true);
    setPermissionNotice(null);
    const itemMap = new Map<string, QuestionBankItem>();

    // 1. Local Storage cache
    try {
      const cached = safeGetLocalStorage('local_question_bank', null);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          parsed.forEach((q: QuestionBankItem) => { if (q && q.id) itemMap.set(q.id, q); });
        }
      }
    } catch (_) {}

    // 2. Question Bank from Firestore
    try {
      const snap = await getDocs(collection(db, 'question_bank'));
      snap.forEach(docSnap => {
        itemMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as QuestionBankItem);
      });
    } catch (err: any) {
      console.warn('Question bank Firestore fetch notice:', err);
    }

    // 3. Migrate all existing blank_questions into Question Bank
    try {
      const bSnap = await getDocs(collection(db, 'blank_questions'));
      bSnap.forEach(docSnap => {
        const data = docSnap.data();
        const questionStr = data.sentence || data.question || '';
        if (!questionStr) return;

        const opts: string[] = Array.isArray(data.options)
          ? data.options
          : [data.optionA || '', data.optionB || '', data.optionC || '', data.optionD || ''];

        const optA = opts[0] || data.optionA || '';
        const optB = opts[1] || data.optionB || '';
        const optC = opts[2] || data.optionC || '';
        const optD = opts[3] || data.optionD || '';

        let corr = (data.answer || data.correctAnswer || 'A').toString().trim();
        if (corr.length > 1) {
          const idx = opts.findIndex((o: string) => o.trim() === corr);
          if (idx >= 0 && idx < 4) {
            corr = ['A', 'B', 'C', 'D'][idx];
          } else {
            corr = 'A';
          }
        }

        const bqId = `bq_${docSnap.id}`;
        if (!itemMap.has(bqId)) {
          itemMap.set(bqId, {
            id: bqId,
            question: questionStr,
            optionA: optA,
            optionB: optB,
            optionC: optC,
            optionD: optD,
            correctAnswer: corr,
            explanation: data.explanation || 'Blank Filling Question',
            group1: 'Blank Filling',
            group2: data.courseId || 'General',
            group3: 'Existing Database',
            courseId: data.courseId,
            createdAt: data.createdAt || new Date().toISOString()
          });
        }
      });
    } catch (bErr) {
      console.warn('Notice reading blank_questions:', bErr);
    }

    const finalList = Array.from(itemMap.values());
    setQuestions(finalList);
    safeSetLocalStorage('local_question_bank', JSON.stringify(finalList));
    setLoading(false);
  };

  // Fetch Scheduled Exams
  const fetchScheduledExams = async () => {
    setLoadingExams(true);
    const examMap = new Map<string, Exam>();

    // 1. Local Cache
    try {
      const localData = safeGetLocalStorage('local_exams', '[]');
      const parsed = JSON.parse(localData);
      if (Array.isArray(parsed)) {
        parsed.forEach((e: Exam) => { if (e && e.id) examMap.set(e.id, e); });
      }
    } catch (_) {}

    // 2. Firestore
    try {
      const snap = await getDocs(collection(db, 'exams'));
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (docSnap.id) examMap.set(docSnap.id, { id: docSnap.id, ...d } as Exam);
      });
    } catch (err) {
      console.warn('Notice loading cloud exams in QuestionBankView:', err);
    }

    const combined = Array.from(examMap.values());
    setAllExams(combined);
    setLoadingExams(false);
  };

  // Delete Exam handler
  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই শিডিউলড এক্সামটি মুছে ফেলতে চান?')) return;

    const updatedExams = allExams.filter(e => e.id !== examId);
    setAllExams(updatedExams);
    safeSetLocalStorage('local_exams', JSON.stringify(updatedExams));

    try {
      await deleteDoc(doc(db, 'exams', examId));
    } catch (err) {
      console.warn('Cloud exam delete notice (deleted locally):', err);
    }
  };

  useEffect(() => {
    fetchQuestions();
    fetchScheduledExams();
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
    setUploadStatus('এক্সেল ফাইল প্রসেস করা হচ্ছে...');

    try {
      const parsed = await parseQuestionBankExcel(file);
      if (parsed.length === 0) {
        alert('এক্সেল ফাইলে কোনো সঠিক প্রশ্ন পাওয়া যায়নি। অনুগ্রহ করে ফাইলটির কলাম ফরম্যাট চেক করুন।');
        setIsUploading(false);
        setUploadStatus(null);
        return;
      }

      setUploadStatus(`মোট ${parsed.length} টি প্রশ্ন সেভ করা হচ্ছে...`);

      // 1. Update local state & local storage immediately
      const existingMap = new Map(questions.map(q => [q.id, q]));
      parsed.forEach(q => existingMap.set(q.id, q));
      const updatedList = Array.from(existingMap.values());
      setQuestions(updatedList);
      safeSetLocalStorage('local_question_bank', JSON.stringify(updatedList));

      // 2. Try batch save to Firestore safely
      try {
        await saveBulkDocs('question_bank', parsed);
      } catch (fsErr) {
        console.warn('Cloud batch save notice (saved locally):', fsErr);
      }

      setUploadStatus(`সফলভাবে মোট ${parsed.length} টি প্রশ্ন জেনারেট ও সংরক্ষিত হয়েছে!`);
      setTimeout(() => setUploadStatus(null), 3500);
    } catch (err: any) {
      console.error('Upload notice:', err);
      setUploadStatus('প্রশ্নসমূহ লোকাল ডিভাইসে সংরক্ষিত হয়েছে!');
      setTimeout(() => setUploadStatus(null), 3000);
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

    // Update local state and local storage immediately
    const updatedList = questions.some(q => q.id === qId)
      ? questions.map(q => q.id === qId ? item : q)
      : [item, ...questions];
    setQuestions(updatedList);
    safeSetLocalStorage('local_question_bank', JSON.stringify(updatedList));

    setShowAddModal(false);
    setEditingQuestion(null);
    setFormData({
      question: '', optionA: '', optionB: '', optionC: '', optionD: '',
      correctAnswer: 'A', explanation: '', group1: 'General', group2: 'General', group3: 'General'
    });

    try {
      await setDoc(doc(db, 'question_bank', qId), item, { merge: true });
    } catch (err) {
      console.warn('Cloud setDoc notice (saved locally):', err);
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
    const updatedList = questions.filter(q => q.id !== id);
    setQuestions(updatedList);
    safeSetLocalStorage('local_question_bank', JSON.stringify(updatedList));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    try {
      await deleteDoc(doc(db, 'question_bank', id));
    } catch (err) {
      console.warn('Cloud deleteDoc notice:', err);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected questions?`)) return;

    const updatedList = questions.filter(q => !selectedIds.has(q.id));
    setQuestions(updatedList);
    safeSetLocalStorage('local_question_bank', JSON.stringify(updatedList));

    try {
      const idsArr = Array.from(selectedIds);
      setSelectedIds(new Set());
      for (let i = 0; i < idsArr.length; i += 100) {
        const batch = writeBatch(db as any);
        idsArr.slice(i, i + 100).forEach((id: string) => {
          batch.delete(doc(db as any, 'question_bank', id));
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn('Cloud bulk delete notice:', err);
    }
  };

  // --- EXAM SCHEDULER & SELECTION LOGIC ---
  const handleCreateExamFromSelected = () => {
    if (selectedIds.size === 0) {
      alert('অনুগ্রহ করে অন্তত ১টি প্রশ্ন সিলেক্ট করুন।');
      return;
    }

    const selectedQs = questions.filter(q => selectedIds.has(q.id));
    const compiledExamQuestions: ExamQuestion[] = selectedQs.map(q => ({
      id: q.id,
      question: q.question,
      options: [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean),
      answer: q.correctAnswer,
      explanation: q.explanation
    }));

    const targetCourse = courses.find(c => c.id === targetCourseId);
    const totalMarks = compiledExamQuestions.length * (Number(marksPerQuestion) || 1);

    const defaultTitle = examTitle.trim() || `বাছাইকৃত মডেল টেস্ট (${compiledExamQuestions.length} টি প্রশ্ন)`;
    if (!examTitle.trim()) {
      setExamTitle(defaultTitle);
    }

    const examObj: Exam = {
      id: `exam-${Date.now()}`,
      title: defaultTitle,
      description: `কুয়েশ্চন ব্যাংক থেকে হাতে বাছাই করা ${compiledExamQuestions.length} টি প্রশ্নের অনলাইন এক্সাম।`,
      courseId: targetCourseId || undefined,
      courseTitle: targetCourse ? targetCourse.title : 'সকল শিক্ষার্থী / সাধারণ পরীক্ষা',
      durationMinutes: Number(durationMinutes) || 15,
      marksPerQuestion: Number(marksPerQuestion) || 1,
      negativeMarking: Number(negativeMarking) || 0.25,
      totalMarks,
      questions: compiledExamQuestions,
      createdAt: new Date().toISOString()
    };

    setGeneratedExam(examObj);
    setCreationMode('selected');
    setActiveTab('scheduler');
  };

  const handleRemoveQuestionFromExam = (qId: string) => {
    if (!generatedExam) return;
    const updatedQs = generatedExam.questions.filter(q => q.id !== qId);
    if (updatedQs.length === 0) {
      setGeneratedExam(null);
      return;
    }
    setGeneratedExam({
      ...generatedExam,
      questions: updatedQs,
      totalMarks: updatedQs.length * (Number(marksPerQuestion) || 1)
    });
  };

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
        title: examTitle.trim() || `র্যান্ডম জেনারেটেড মডেল টেস্ট (${compiledExamQuestions.length} টি প্রশ্ন)`,
        description: `কুয়েশ্চন ব্যাংক থেকে ফিল্টার করে তৈরি করা ${compiledExamQuestions.length} টি প্রশ্নের অনলাইন এক্সাম।`,
        courseId: targetCourseId || undefined,
        courseTitle: targetCourse ? targetCourse.title : 'সকল শিক্ষার্থী / সাধারণ পরীক্ষা',
        durationMinutes: Number(durationMinutes) || 15,
        marksPerQuestion: Number(marksPerQuestion) || 1,
        negativeMarking: Number(negativeMarking) || 0.25,
        totalMarks,
        questions: compiledExamQuestions,
        createdAt: new Date().toISOString()
      };

      setGeneratedExam(examObj);
      setCreationMode('random');
      setIsGenerating(false);
    }, 200);
  };

  // Publish Exam to Firestore & Local Storage
  const handlePublishExam = async () => {
    if (!generatedExam) return;

    setIsPublishing(true);
    setPublishSuccess(false);

    const targetCourse = courses.find(c => c.id === targetCourseId);
    const finalExamObj: Exam = {
      ...generatedExam,
      title: examTitle.trim() || generatedExam.title,
      durationMinutes: Number(durationMinutes) || generatedExam.durationMinutes,
      marksPerQuestion: Number(marksPerQuestion) || generatedExam.marksPerQuestion,
      negativeMarking: Number(negativeMarking) || generatedExam.negativeMarking,
      totalMarks: generatedExam.questions.length * (Number(marksPerQuestion) || 1),
      courseId: targetCourseId || undefined,
      courseTitle: targetCourse ? targetCourse.title : 'সকল শিক্ষার্থী / সাধারণ পরীক্ষা'
    };

    try {
      // 1. Cloud save
      try {
        await setDoc(doc(db, 'exams', finalExamObj.id), finalExamObj, { merge: true });
      } catch (fsErr) {
        console.warn('Cloud exam save notice (saved locally):', fsErr);
      }

      // 2. Local storage save
      const existingLocalExamsStr = safeGetLocalStorage('local_exams', '[]');
      let localExams: Exam[] = [];
      try {
        localExams = JSON.parse(existingLocalExamsStr);
        if (!Array.isArray(localExams)) localExams = [];
      } catch (_) {
        localExams = [];
      }
      const updatedLocalExams = [finalExamObj, ...localExams.filter(e => e.id !== finalExamObj.id)];
      safeSetLocalStorage('local_exams', JSON.stringify(updatedLocalExams));

      setPublishSuccess(true);
      setSelectedIds(new Set());
      fetchScheduledExams();
      if (onExamPublished) onExamPublished();
      setTimeout(() => setPublishSuccess(false), 4000);
    } catch (err) {
      console.error('Error publishing exam:', err);
      alert('Failed to publish exam.');
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
        <div className="flex flex-wrap bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 z-10 shrink-0 gap-1">
          <button
            onClick={() => setActiveTab('repository')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
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
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'scheduler'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>গ্রুপ কন্ডিশন এক্সাম শিডিউলার</span>
          </button>
          <button
            onClick={() => setActiveTab('scheduled_exams')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'scheduled_exams'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>শিডিউলড এক্সাম তালিকা ({allExams.length})</span>
          </button>
        </div>
      </div>

      {/* Permission / Offline Notice Banner */}
      {permissionNotice && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{permissionNotice}</span>
        </div>
      )}

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
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-fadeIn shadow-xs">
              <span className="text-xs font-black text-indigo-900">
                {selectedIds.size} টি প্রশ্ন সিলেক্ট করা হয়েছে
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateExamFromSelected}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Award className="w-4 h-4" />
                  <span>সিলেক্ট করা ({selectedIds.size}) প্রশ্ন দিয়ে এক্সাম তৈরি করুন</span>
                </button>

                <button
                  onClick={handleDeleteSelected}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ডিলিট করুন</span>
                </button>
              </div>
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
                  <div key={q.id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-2 relative group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-black rounded-md text-[11px] shrink-0">
                          #{idx + 1}
                        </span>
                        <p className="font-extrabold text-slate-900 text-xs leading-relaxed">{q.question}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveQuestionFromExam(q.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                        title="এই পরীক্ষা থেকে প্রশ্নটি বাদ দিন"
                      >
                        <X className="w-4 h-4" />
                      </button>
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

      {/* TAB 3: SCHEDULED EXAMS BY COURSE */}
      {activeTab === 'scheduled_exams' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold block">মোট কোর্স</span>
                <strong className="text-xl font-extrabold text-slate-900">{courses.length} টি</strong>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold block">মোট শিডিউলড এক্সাম</span>
                <strong className="text-xl font-extrabold text-slate-900">{allExams.length} টি</strong>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold block">এক্সামে মোট প্রশ্ন সংখ্যা</span>
                <strong className="text-xl font-extrabold text-slate-900">
                  {allExams.reduce((acc, e) => acc + (e.questions?.length || 0), 0)} টি
                </strong>
              </div>
            </div>
          </div>

          {/* Course-wise Exam List Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>কোর্স ভিত্তিক এক্সাম শিডিউল বিবরণ</span>
              </h3>
              <button
                onClick={fetchScheduledExams}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingExams ? 'animate-spin' : ''}`} />
                <span>রিফ্রেশ</span>
              </button>
            </div>

            {loadingExams ? (
              <div className="bg-white rounded-2xl p-8 text-center text-slate-400 text-sm">
                শিডিউলড এক্সামের তথ্য লোড হচ্ছে...
              </div>
            ) : allExams.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center text-slate-500">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-800">কোন এক্সাম শিডিউল করা নেই</p>
                <p className="text-xs text-slate-400 mt-1">
                  "গ্রুপ কন্ডিশন এক্সাম শিডিউলার" ট্যাব থেকে নতুন পরীক্ষা তৈরি ও শিডিউল করুন।
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Loop over courses */}
                {courses.map(course => {
                  const courseExams = allExams.filter(e => e.courseId === course.id);
                  const totalQ = courseExams.reduce((acc, e) => acc + (e.questions?.length || 0), 0);

                  return (
                    <div key={course.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                      {/* Course Header */}
                      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
                            {course.code ? course.code.substring(0, 3).toUpperCase() : 'CRS'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-slate-900 text-base">{course.title}</h4>
                              {course.code && (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md uppercase">
                                  {course.code}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              মোট প্রশ্ন: <span className="font-bold text-slate-700">{totalQ} টি</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-black ${
                            courseExams.length > 0 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            {courseExams.length} টি এক্সাম শিডিউলড
                          </span>
                        </div>
                      </div>

                      {/* Exam Cards inside Course */}
                      {courseExams.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                          এই কোর্সে এখনও কোনো এক্সাম শিডিউল করা হয়নি।
                        </div>
                      ) : (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white">
                          {courseExams.map(exam => (
                            <div key={exam.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between gap-3">
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <h5 className="font-bold text-slate-900 text-sm">{exam.title}</h5>
                                  <span className="text-[11px] font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
                                    {exam.durationMinutes} মি.
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                                  <span>প্রশ্ন: <strong className="text-slate-800 font-bold">{exam.questions?.length || 0} টি</strong></span>
                                  <span>নম্বর: <strong className="text-slate-800 font-bold">{exam.totalMarks || ((exam.questions?.length || 0) * (exam.marksPerQuestion || 1))}</strong></span>
                                  <span>নেগেটিভ: <strong className="text-rose-600 font-bold">-{exam.negativeMarking || 0}</strong></span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                                <span className="text-[11px] text-slate-400">
                                  {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString() : 'শিডিউলড'}
                                </span>

                                <button
                                  onClick={() => handleDeleteExam(exam.id)}
                                  className="px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>মুছুন</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Unassigned / General Exams Section */}
                {(() => {
                  const generalExams = allExams.filter(e => !e.courseId || !courses.some(c => c.id === e.courseId));
                  if (generalExams.length === 0) return null;

                  return (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs mt-6">
                      <div className="p-4 sm:p-5 bg-amber-50/60 border-b border-amber-200/80 flex items-center justify-between">
                        <div>
                          <h4 className="font-extrabold text-amber-900 text-base">সাধারণ / অল-কোর্স পরীক্ষা</h4>
                          <p className="text-xs text-amber-700">কোন সুনির্দিষ্ট কোর্সে যুক্ত নয় এমন এক্সামসমূহ</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                          {generalExams.length} টি এক্সাম
                        </span>
                      </div>

                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white">
                        {generalExams.map(exam => (
                          <div key={exam.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <h5 className="font-bold text-slate-900 text-sm">{exam.title}</h5>
                                <span className="text-[11px] font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
                                  {exam.durationMinutes} মি.
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                                <span>প্রশ্ন: <strong className="text-slate-800 font-bold">{exam.questions?.length || 0} টি</strong></span>
                                <span>নম্বর: <strong className="text-slate-800 font-bold">{exam.totalMarks || ((exam.questions?.length || 0) * (exam.marksPerQuestion || 1))}</strong></span>
                                <span>নেগেটিভ: <strong className="text-rose-600 font-bold">-{exam.negativeMarking || 0}</strong></span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                              <span className="text-[11px] text-slate-400">
                                {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString() : 'শিডিউলড'}
                              </span>

                              <button
                                onClick={() => handleDeleteExam(exam.id)}
                                className="px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>মুছুন</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
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
