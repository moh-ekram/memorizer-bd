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
  Info,
  AlertTriangle,
  Cloud,
  UploadCloud
} from 'lucide-react';
import { db, doc, setDoc, deleteDoc, writeBatch, collection, getDocs, saveBulkDocs } from '../lib/db';
import { QuestionBankItem, QuestionBankRule, Course, Exam, ExamQuestion } from '../types';
import { downloadQuestionBankExcelTemplate, parseQuestionBankExcel, exportQuestionBankToExcel } from '../lib/gameExcelUtils';
import { safeGetLocalStorage, safeSetLocalStorage, setLargeStorage, getLargeStorage } from '../lib/storage';

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
  const [showGuidelineModal, setShowGuidelineModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Upload Preview State
  const [pendingUploadQuestions, setPendingUploadQuestions] = useState<QuestionBankItem[]>([]);
  const [showUploadPreviewModal, setShowUploadPreviewModal] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewPage, setPreviewPage] = useState(1);
  const PREVIEW_ITEMS_PER_PAGE = 15;

  // Title and Duration auto sync state flags
  const [isTitleUserEdited, setIsTitleUserEdited] = useState(false);
  const [isDurationUserEdited, setIsDurationUserEdited] = useState(false);

  const handleExportQuestions = (type: 'all' | 'filtered' | 'selected') => {
    let listToExport: QuestionBankItem[] = [];
    let fileSuffix = '';

    if (type === 'selected' && selectedIds.size > 0) {
      listToExport = questions.filter(q => selectedIds.has(q.id));
      fileSuffix = `_Selected_${selectedIds.size}`;
    } else if (type === 'filtered') {
      listToExport = filteredQuestions;
      fileSuffix = `_Filtered_${filteredQuestions.length}`;
    } else {
      listToExport = questions;
      fileSuffix = `_All_${questions.length}`;
    }

    if (listToExport.length === 0) {
      alert('No questions found to export.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const fileName = `Question_Bank_Export${fileSuffix}_${todayStr}.xlsx`;
    exportQuestionBankToExcel(listToExport, fileName);
    setShowExportModal(false);
  };

  // Delete Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    count: number;
    type: 'single' | 'selected' | 'existing_db' | 'all';
    targetId?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const recordDeletedIds = (idsToDelete: string[]) => {
    try {
      const existing: string[] = JSON.parse(safeGetLocalStorage('deleted_question_ids', '[]')) || [];
      const merged = Array.from(new Set([...existing, ...idsToDelete]));
      safeSetLocalStorage('deleted_question_ids', JSON.stringify(merged));
    } catch (_) {}
  };

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

  // Helper to generate exam title from selected rule categories and total question count
  const generateTitleFromRules = (rulesList: QuestionBankRule[]): string => {
    const totalRuleQuestions = rulesList.reduce((acc, r) => acc + (Number(r.count) || 0), 0);
    const g1Set = new Set<string>();
    const g2Set = new Set<string>();
    const g3Set = new Set<string>();

    rulesList.forEach(r => {
      if (r.group1 && r.group1 !== 'all') g1Set.add(r.group1);
      if (r.group2 && r.group2 !== 'all') g2Set.add(r.group2);
      if (r.group3 && r.group3 !== 'all') g3Set.add(r.group3);
    });

    const parts: string[] = [];
    if (g2Set.size > 0) parts.push(Array.from(g2Set).join(', '));
    if (g1Set.size > 0) parts.push(Array.from(g1Set).join(', '));
    if (g3Set.size > 0) parts.push(Array.from(g3Set).join(', '));

    const categoryText = parts.join(' ').trim();
    if (categoryText) {
      return `Selected Model Test - ${categoryText} (${totalRuleQuestions} Questions)`;
    }
    return `Selected Model Test (${totalRuleQuestions} Questions)`;
  };

  // Automatically sync active repository filters into group matching rules
  useEffect(() => {
    setRules(prevRules => prevRules.map(rule => ({
      ...rule,
      group1: filterGroup1 !== 'all' ? filterGroup1 : rule.group1,
      group2: filterGroup2 !== 'all' ? filterGroup2 : rule.group2,
      group3: filterGroup3 !== 'all' ? filterGroup3 : rule.group3,
    })));
  }, [filterGroup1, filterGroup2, filterGroup3]);

  // Auto-sync duration (1 minute per question) and exam title based on rules
  useEffect(() => {
    const totalRuleQuestions = rules.reduce((acc, r) => acc + (Number(r.count) || 0), 0);
    if (!isDurationUserEdited) {
      setDurationMinutes(totalRuleQuestions > 0 ? totalRuleQuestions : 10);
    }
    if (!isTitleUserEdited) {
      setExamTitle(generateTitleFromRules(rules));
    }
  }, [rules, isDurationUserEdited, isTitleUserEdited]);

  // Generated Exam Preview State
  const [creationMode, setCreationMode] = useState<'selected' | 'random'>('selected');
  const [generatedExam, setGeneratedExam] = useState<Exam | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncCloudMessage, setSyncCloudMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Fetch Question Bank from Firestore with LocalStorage Fallback & Multi-collection aggregation
  const fetchQuestions = async (forceCloud = false) => {
    setLoading(true);
    setPermissionNotice(null);
    const itemMap = new Map<string, QuestionBankItem>();

    const deletedSet = new Set<string>();
    if (!forceCloud) {
      try {
        const deletedArr = JSON.parse(safeGetLocalStorage('deleted_question_ids', '[]'));
        if (Array.isArray(deletedArr)) {
          deletedArr.forEach((id: string) => deletedSet.add(id));
        }
      } catch (_) {}
    } else {
      // Clear deleted list when user explicitly force refreshes
      safeSetLocalStorage('deleted_question_ids', '[]');
    }

    // 1. Local Storage & IndexedDB cache (fast initial render if not forcing cloud)
    if (!forceCloud) {
      try {
        const cachedList = await getLargeStorage<QuestionBankItem[]>('local_question_bank', null);
        if (Array.isArray(cachedList)) {
          cachedList.forEach((q: QuestionBankItem) => {
            if (q && q.id && !deletedSet.has(q.id)) {
              itemMap.set(q.id, q);
            }
          });
        }
      } catch (_) {}
    }

    // 2. Primary Question Bank collection from Firestore
    try {
      const snap = await getDocs(collection(db, 'question_bank'));
      snap.forEach(docSnap => {
        if (!deletedSet.has(docSnap.id)) {
          const dData = docSnap.data();
          itemMap.set(docSnap.id, {
            id: docSnap.id,
            question: dData.question || '',
            optionA: dData.optionA || '',
            optionB: dData.optionB || '',
            optionC: dData.optionC || '',
            optionD: dData.optionD || '',
            correctAnswer: dData.correctAnswer || 'A',
            explanation: dData.explanation || '',
            group1: dData.group1 || 'General',
            group2: dData.group2 || 'General',
            group3: dData.group3 || 'General',
            createdAt: dData.createdAt || new Date().toISOString(),
            ...dData
          } as QuestionBankItem);
        }
      });
    } catch (err: any) {
      console.warn('Question bank Firestore fetch notice:', err);
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        setPermissionNotice('Firestore Security Rules-এর কারণে ফায়ারবেস থেকে ডেটা লোড হতে বাধা পাচ্ছে। দয়া করে ফায়ারবেস কনসোলে Rules ট্যাবে পারমিশন পাবলিশ করুন।');
      } else {
        setPermissionNotice(`ক্লাউড থেকে ডেটা লোড করার সময় সমস্যা: ${err?.message || 'ইন্টারনেট বা ফায়ারবেস কানেকশন চেক করুন'}`);
      }
    }

    // 3. Load MCQ questions collection from Firestore
    try {
      const mcqSnap = await getDocs(collection(db, 'mcq_questions'));
      mcqSnap.forEach(docSnap => {
        const d = docSnap.data();
        const qId = `mcq_${docSnap.id}`;
        if (!deletedSet.has(qId) && !itemMap.has(qId) && !itemMap.has(docSnap.id)) {
          const opts = Array.isArray(d.options) ? d.options : [d.optionA || '', d.optionB || '', d.optionC || '', d.optionD || ''];
          itemMap.set(qId, {
            id: qId,
            question: d.question || '',
            optionA: opts[0] || '',
            optionB: opts[1] || '',
            optionC: opts[2] || '',
            optionD: opts[3] || '',
            correctAnswer: d.answer || opts[0] || 'A',
            explanation: d.explanation || 'MCQ Practice Question',
            group1: d.courseId || 'MCQ',
            group2: 'MCQ Question',
            group3: 'Existing Database',
            courseId: d.courseId,
            createdAt: d.createdAt || new Date().toISOString()
          });
        }
      });
    } catch (mErr) {
      console.warn('Notice reading mcq_questions:', mErr);
    }

    // 4. Load blank_questions from Firestore
    try {
      const bSnap = await getDocs(collection(db, 'blank_questions'));
      bSnap.forEach(docSnap => {
        const data = docSnap.data();
        const questionStr = data.sentence || data.question || '';
        if (!questionStr) return;

        const bqId = `bq_${docSnap.id}`;
        if (deletedSet.has(bqId)) return;

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

    // 5. Load odd_one_out_questions from Firestore
    try {
      const oooSnap = await getDocs(collection(db, 'odd_one_out_questions'));
      oooSnap.forEach(docSnap => {
        const d = docSnap.data();
        const qId = `ooo_${docSnap.id}`;
        if (!deletedSet.has(qId) && !itemMap.has(qId) && Array.isArray(d.words) && d.words.length >= 2) {
          itemMap.set(qId, {
            id: qId,
            question: `Odd One Out: Find the word that does not fit with the others (${d.words.join(', ')})`,
            optionA: d.words[0] || '',
            optionB: d.words[1] || '',
            optionC: d.words[2] || 'N/A',
            optionD: d.words[3] || 'N/A',
            correctAnswer: d.answer || d.words[0] || 'A',
            explanation: d.reason || d.explanation || 'Odd One Out Question',
            group1: d.courseId || 'Odd One Out',
            group2: 'Odd One Out',
            group3: 'Existing Database',
            courseId: d.courseId,
            createdAt: d.createdAt || new Date().toISOString()
          });
        }
      });
    } catch (oErr) {
      console.warn('Notice reading odd_one_out_questions:', oErr);
    }

    // 6. Load word_analogy_questions from Firestore
    try {
      const waSnap = await getDocs(collection(db, 'word_analogy_questions'));
      waSnap.forEach(docSnap => {
        const d = docSnap.data();
        const qId = `wa_${docSnap.id}`;
        if (!deletedSet.has(qId) && !itemMap.has(qId) && Array.isArray(d.options)) {
          itemMap.set(qId, {
            id: qId,
            question: `Word Analogy: ${d.analogy || ''}`,
            optionA: d.options[0] || '',
            optionB: d.options[1] || '',
            optionC: d.options[2] || '',
            optionD: d.options[3] || '',
            correctAnswer: d.answer || d.options[0] || 'A',
            explanation: d.explanation || 'Analogy Question',
            group1: d.courseId || 'Word Analogy',
            group2: 'Word Analogy',
            group3: 'Existing Database',
            courseId: d.courseId,
            createdAt: d.createdAt || new Date().toISOString()
          });
        }
      });
    } catch (waErr) {
      console.warn('Notice reading word_analogy_questions:', waErr);
    }

    const finalList = Array.from(itemMap.values());
    setQuestions(finalList);
    await setLargeStorage('local_question_bank', finalList);
    setLoading(false);
  };

  // Sync All Questions to Cloud (Push local items to Firestore so all devices can see them)
  const handleSyncAllToCloud = async () => {
    if (questions.length === 0) {
      setSyncCloudMessage({ text: 'ক্লাউডে আপলোড করার মতো কোনো প্রশ্ন পাওয়া যায়নি।', type: 'info' });
      setTimeout(() => setSyncCloudMessage(null), 4000);
      return;
    }

    setIsSyncingCloud(true);
    setSyncCloudMessage({ text: `ফায়ারবেস ক্লাউডে ${questions.length}টি প্রশ্ন আপলোড করা হচ্ছে...`, type: 'info' });

    try {
      await saveBulkDocs('question_bank', questions);
      setSyncCloudMessage({ 
        text: `✅ সফলভাবে ${questions.length}টি প্রশ্ন ফায়ারবেস ক্লাউডে আপলোড হয়েছে! এখন যেকোনো ডিভাইস থেকেই দেখা যাবে।`, 
        type: 'success' 
      });
      setTimeout(() => setSyncCloudMessage(null), 6000);
    } catch (err: any) {
      console.error('Cloud bulk upload error:', err);
      setSyncCloudMessage({ 
        text: `❌ ক্লাউডে আপলোড করতে সমস্যা হয়েছে: ${err?.message || 'Firestore Rules বা ইন্টারনেট চেক করুন'}`, 
        type: 'error' 
      });
      setTimeout(() => setSyncCloudMessage(null), 8000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Fetch Scheduled Exams
  const fetchScheduledExams = async () => {
    setLoadingExams(true);
    const examMap = new Map<string, Exam>();

    // 1. Local Cache (IndexedDB & LocalStorage)
    try {
      const localData = await getLargeStorage<Exam[]>('local_exams', []);
      if (Array.isArray(localData)) {
        localData.forEach((e: Exam) => { if (e && e.id) examMap.set(e.id, e); });
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
    if (!window.confirm('Are you sure you want to delete this scheduled exam?')) return;

    const updatedExams = allExams.filter(e => e.id !== examId);
    setAllExams(updatedExams);
    await setLargeStorage('local_exams', updatedExams);

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

  // Handle Excel Upload -> Parse and Open Preview Modal
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Processing Excel file...');

    try {
      const parsed = await parseQuestionBankExcel(file);
      if (parsed.length === 0) {
        alert('No valid questions found in the Excel file. Please check column formatting.');
        setIsUploading(false);
        setUploadStatus(null);
        return;
      }

      setPendingUploadQuestions(parsed);
      setPreviewSearch('');
      setPreviewPage(1);
      setShowUploadPreviewModal(true);
      setUploadStatus(null);
    } catch (err: any) {
      console.error('Upload notice:', err);
      alert('Failed to parse Excel file. Please check column layout.');
      setUploadStatus(null);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Confirm and Save Uploaded Questions to Database
  const handleConfirmUpload = async () => {
    if (pendingUploadQuestions.length === 0) return;

    setIsUploading(true);
    setUploadStatus(`Saving ${pendingUploadQuestions.length} questions...`);

    try {
      // 1. Update local state & local storage immediately
      const existingMap = new Map(questions.map(q => [q.id, q]));
      pendingUploadQuestions.forEach(q => existingMap.set(q.id, q));
      const updatedList = Array.from(existingMap.values());
      setQuestions(updatedList);
      await setLargeStorage('local_question_bank', updatedList);

      const itemsToSave = [...pendingUploadQuestions];
      setPendingUploadQuestions([]);
      setShowUploadPreviewModal(false);

      // 2. Sync to Firestore Cloud directly
      try {
        await saveBulkDocs('question_bank', itemsToSave);
        setUploadStatus(`✅ ${itemsToSave.length}টি প্রশ্ন ক্লাউড ডাটাবেজ ও লোকাল স্টোরেজে সফলভাবে সেভ হয়েছে!`);
      } catch (fsErr: any) {
        console.warn('Cloud batch save notice:', fsErr);
        setUploadStatus(`⚠️ ${itemsToSave.length}টি প্রশ্ন এই ডিভাইসে সেভ হয়েছে (ক্লাউড সিঙ্ক করতে 'Sync All to Cloud' চাপুন)`);
      }
      setTimeout(() => setUploadStatus(null), 5000);
    } catch (err: any) {
      console.error('Upload notice:', err);
      setUploadStatus('Questions saved to local device storage.');
      setTimeout(() => setUploadStatus(null), 3000);
      setShowUploadPreviewModal(false);
      setPendingUploadQuestions([]);
    } finally {
      setIsUploading(false);
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
      explanation: formData.explanation.trim() || 'Explanation for the correct answer will be added soon.',
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
    setLargeStorage('local_question_bank', updatedList);

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

  const existingDbQuestions = useMemo(() => {
    return questions.filter(
      q => q.group3 === 'Existing Database' || q.id.startsWith('bq_') || q.group1 === 'Existing Database'
    );
  }, [questions]);

  const handleDeleteSingle = (id: string) => {
    const qItem = questions.find(q => q.id === id);
    const qTitle = qItem ? `"${qItem.question.slice(0, 45)}${qItem.question.length > 45 ? '...' : ''}"` : 'Selected Question';

    setDeleteConfirmModal({
      isOpen: true,
      title: 'Confirm Question Deletion',
      description: qTitle,
      count: 1,
      type: 'single',
      targetId: id,
      onConfirm: async () => {
        recordDeletedIds([id]);
        const updatedList = questions.filter(q => q.id !== id);
        setQuestions(updatedList);
        setLargeStorage('local_question_bank', updatedList);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        try {
          await deleteDoc(doc(db, 'question_bank', id));
          if (id.startsWith('bq_')) {
            const origBqId = id.replace(/^bq_/, '');
            await deleteDoc(doc(db, 'blank_questions', origBqId));
          }
        } catch (err) {
          console.warn('Cloud deleteDoc notice:', err);
        }
      }
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const idsArr: string[] = Array.from(selectedIds);

    setDeleteConfirmModal({
      isOpen: true,
      title: 'Confirm Delete Selected Questions',
      description: `${selectedIds.size} manually selected questions`,
      count: selectedIds.size,
      type: 'selected',
      onConfirm: async () => {
        recordDeletedIds(idsArr);
        const deleteSet = new Set(idsArr);
        const updatedList = questions.filter(q => !deleteSet.has(q.id));
        setQuestions(updatedList);
        setLargeStorage('local_question_bank', updatedList);
        setSelectedIds(new Set());

        try {
          for (let i = 0; i < idsArr.length; i += 100) {
            const batch = writeBatch(db as any);
            const chunk = idsArr.slice(i, i + 100);
            chunk.forEach((id: string) => {
              batch.delete(doc(db as any, 'question_bank', id));
              if (id.startsWith('bq_')) {
                const origBqId = id.replace(/^bq_/, '');
                batch.delete(doc(db as any, 'blank_questions', origBqId));
              }
            });
            await batch.commit();
          }
        } catch (err) {
          console.warn('Cloud bulk delete notice:', err);
        }
      }
    });
  };

  const handleDeleteExistingDatabaseQuestions = () => {
    if (existingDbQuestions.length === 0) {
      alert('No "Existing Database" marked questions were found in the database.');
      return;
    }

    const idsArr = existingDbQuestions.map(q => q.id);

    setDeleteConfirmModal({
      isOpen: true,
      title: 'Delete All Existing Database Questions',
      description: 'Default & migrated "Existing Database" tagged questions',
      count: existingDbQuestions.length,
      type: 'existing_db',
      onConfirm: async () => {
        recordDeletedIds(idsArr);
        const deleteSet = new Set(idsArr);
        const updatedList = questions.filter(q => !deleteSet.has(q.id));
        setQuestions(updatedList);
        setLargeStorage('local_question_bank', updatedList);
        setSelectedIds(prev => {
          const next = new Set(prev);
          idsArr.forEach(id => next.delete(id));
          return next;
        });

        try {
          for (let i = 0; i < idsArr.length; i += 100) {
            const batch = writeBatch(db as any);
            const chunk = idsArr.slice(i, i + 100);
            chunk.forEach((id: string) => {
              batch.delete(doc(db as any, 'question_bank', id));
              if (id.startsWith('bq_')) {
                const origBqId = id.replace(/^bq_/, '');
                batch.delete(doc(db as any, 'blank_questions', origBqId));
              }
            });
            await batch.commit();
          }
        } catch (err) {
          console.warn('Cloud delete existing db notice:', err);
        }
      }
    });
  };

  // --- EXAM SCHEDULER & SELECTION LOGIC ---
  const handleCreateExamFromSelected = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least 1 question.');
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

    const defaultTitle = examTitle.trim() || `Selected Model Test (${compiledExamQuestions.length} Questions)`;
    if (!examTitle.trim()) {
      setExamTitle(defaultTitle);
    }

    const examObj: Exam = {
      id: `exam-${Date.now()}`,
      title: defaultTitle,
      description: `Online exam containing ${compiledExamQuestions.length} manually selected questions from Question Bank.`,
      courseId: targetCourseId || undefined,
      courseTitle: targetCourse ? targetCourse.title : 'All Students / General Exam',
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
        title: examTitle.trim() || `Random Generated Model Test (${compiledExamQuestions.length} Questions)`,
        description: `Online exam containing ${compiledExamQuestions.length} filtered questions generated from Question Bank.`,
        courseId: targetCourseId || undefined,
        courseTitle: targetCourse ? targetCourse.title : 'All Students / General Exam',
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
      courseTitle: targetCourse ? targetCourse.title : 'All Students / General Exam'
    };

    try {
      // 1. Local storage save (IndexedDB for large exam payloads like 190+ questions)
      let localExams: Exam[] = [];
      try {
        const existing = await getLargeStorage<Exam[]>('local_exams', []);
        if (Array.isArray(existing)) localExams = existing;
      } catch (_) {}

      const updatedLocalExams = [finalExamObj, ...localExams.filter(e => e.id !== finalExamObj.id)];
      await setLargeStorage('local_exams', updatedLocalExams);

      // Update state immediately
      setAllExams(prev => [finalExamObj, ...prev.filter(e => e.id !== finalExamObj.id)]);

      // 2. Cloud save to Firestore
      try {
        await setDoc(doc(db, 'exams', finalExamObj.id), finalExamObj, { merge: true });
      } catch (fsErr) {
        console.warn('Cloud exam save notice (saved locally/IndexedDB):', fsErr);
      }

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

  // Upload Preview Memos
  const filteredPreviewQuestions = useMemo(() => {
    if (!previewSearch.trim()) return pendingUploadQuestions;
    const q = previewSearch.toLowerCase().trim();
    return pendingUploadQuestions.filter(item => 
      item.question.toLowerCase().includes(q) ||
      item.optionA.toLowerCase().includes(q) ||
      item.optionB.toLowerCase().includes(q) ||
      item.optionC.toLowerCase().includes(q) ||
      item.optionD.toLowerCase().includes(q) ||
      (item.group1 && item.group1.toLowerCase().includes(q)) ||
      (item.group2 && item.group2.toLowerCase().includes(q)) ||
      (item.group3 && item.group3.toLowerCase().includes(q))
    );
  }, [pendingUploadQuestions, previewSearch]);

  const totalPreviewPages = Math.ceil(filteredPreviewQuestions.length / PREVIEW_ITEMS_PER_PAGE) || 1;
  const currentPreviewItems = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_ITEMS_PER_PAGE;
    return filteredPreviewQuestions.slice(start, start + PREVIEW_ITEMS_PER_PAGE);
  }, [filteredPreviewQuestions, previewPage]);

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
            Question Bank & Random Exam Scheduler
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-xl leading-relaxed">
            Upload questions via Excel, set group matching rules, and automatically publish random online exams.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 z-10 shrink-0 gap-1 items-center justify-center">
          <button
            onClick={() => setActiveTab('repository')}
            title={`Question Repository (${questions.length})`}
            className={`px-3 sm:px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'repository'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Database className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Question Repository ({questions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('scheduler')}
            title="Rule Exam Scheduler"
            className={`px-3 sm:px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'scheduler'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Shuffle className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Rule Exam Scheduler</span>
          </button>
          <button
            onClick={() => setActiveTab('scheduled_exams')}
            title={`Scheduled Exams (${allExams.length})`}
            className={`px-3 sm:px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
              activeTab === 'scheduled_exams'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Scheduled Exams ({allExams.length})</span>
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
                  placeholder="Search questions or answers..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              {/* Suitable Course Filter */}
              <select
                value={filterGroup1}
                onChange={(e) => {
                  setFilterGroup1(e.target.value);
                  setFilterGroup2('all');
                  setFilterGroup3('all');
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Suitable Courses</option>
                {uniqueGroups1.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              {/* Q.Type Filter */}
              <select
                value={filterGroup2}
                onChange={(e) => {
                  setFilterGroup2(e.target.value);
                  setFilterGroup3('all');
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Question Types</option>
                {uniqueGroups2.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              {/* Others Filter */}
              <select
                value={filterGroup3}
                onChange={(e) => setFilterGroup3(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Other Categories</option>
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
                <span>Download Sample</span>
              </button>

              <button
                onClick={() => setShowGuidelineModal(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-indigo-200/80 shadow-xs"
                title="View Excel upload formatting instructions"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Upload Guidelines</span>
              </button>

              <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel Upload</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>

              <button
                onClick={() => setShowExportModal(true)}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 rounded-xl text-xs font-extrabold shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Export or backup question bank questions to Excel"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Export (Excel)</span>
              </button>

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
                <span>Add New Question</span>
              </button>

              <button
                onClick={handleSyncAllToCloud}
                disabled={isSyncingCloud || questions.length === 0}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Sync all current questions to Firebase Firestore Cloud so other devices can access them"
              >
                {isSyncingCloud ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5 text-white" />
                )}
                <span>{isSyncingCloud ? 'Syncing to Cloud...' : 'Sync All to Cloud (ক্লাউডে সেভ)'}</span>
              </button>

              <button
                onClick={() => fetchQuestions(true)}
                disabled={loading}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                title="Fetch latest questions directly from Firebase Cloud database"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-white ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Refresh from Cloud'}</span>
              </button>

              {existingDbQuestions.length > 0 && (
                <button
                  onClick={handleDeleteExistingDatabaseQuestions}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                  title="Delete all Existing Database marked questions"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete Existing Database Questions ({existingDbQuestions.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Permission or Cloud Error Notice */}
          {permissionNotice && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn shadow-xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="leading-relaxed">{permissionNotice}</span>
              </div>
              <button
                onClick={() => fetchQuestions(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold cursor-pointer shrink-0 transition"
              >
                Retry
              </button>
            </div>
          )}

          {/* Cloud Sync Status Banner */}
          {syncCloudMessage && (
            <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 animate-fadeIn shadow-sm ${
              syncCloudMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                : syncCloudMessage.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-sky-50 text-sky-900 border-sky-200'
            }`}>
              {syncCloudMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : syncCloudMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Cloud className="w-4 h-4 text-sky-600 shrink-0" />
              )}
              <span className="leading-relaxed">{syncCloudMessage.text}</span>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">Total Questions</span>
              <span className="text-xl font-black text-indigo-600">{questions.length}</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">Suitable Courses</span>
              <span className="text-xl font-black text-slate-800">{uniqueGroups1.length}</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">Q.Types</span>
              <span className="text-xl font-black text-slate-800">{uniqueGroups2.length}</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">Other Categories</span>
              <span className="text-xl font-black text-slate-800">{uniqueGroups3.length}</span>
            </div>
          </div>

          {/* Bulk Action Controls */}
          {selectedIds.size > 0 && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-fadeIn shadow-xs">
              <span className="text-xs font-black text-indigo-900">
                {selectedIds.size} questions selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateExamFromSelected}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Award className="w-4 h-4" />
                  <span>Create Exam with Selected ({selectedIds.size})</span>
                </button>

                <button
                  onClick={() => handleExportQuestions('selected')}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Export selected questions to Excel file"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export ({selectedIds.size})</span>
                </button>

                <button
                  onClick={handleDeleteSelected}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
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
                    <th className="p-3 min-w-[240px]">Question Text</th>
                    <th className="p-3 min-w-[200px]">Options & Answer</th>
                    <th className="p-3 w-36">Suitable Course</th>
                    <th className="p-3 w-36">Q.Type</th>
                    <th className="p-3 w-32">Others</th>
                    <th className="p-3 w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        <span>Loading question bank...</span>
                      </td>
                    </tr>
                  ) : filteredQuestions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold space-y-3">
                        <p className="text-slate-500">কোনো প্রশ্ন পাওয়া যায়নি। ফায়ারবেস ক্লাউড থেকে সরাসরি লোড করতে নিচের বাটনে চাপুন:</p>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => fetchQuestions(true)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm mx-auto"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>ফায়ারবেস থেকে লোড করুন (Force Refresh from Cloud)</span>
                          </button>
                        </div>
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
                              Explanation: {q.explanation}
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
                <span>Online Exam Configuration</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Configure exam title, time duration, marks, and group rules to generate random exams.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Target Course */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">Target Course</label>
                <select
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Global / Free Practice Exam</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              {/* Exam Title */}
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 block">
                    Exam Title (Title)
                  </label>
                  {isTitleUserEdited ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsTitleUserEdited(false);
                        const auto = generateTitleFromRules(rules);
                        if (auto) setExamTitle(auto);
                      }}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset Auto Title</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-indigo-600 font-extrabold bg-indigo-50 px-1.5 py-0.5 rounded">
                      Auto-synced from Rules
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => {
                    setExamTitle(e.target.value);
                    if (e.target.value.trim() === '') {
                      setIsTitleUserEdited(false);
                    } else {
                      setIsTitleUserEdited(true);
                    }
                  }}
                  placeholder="e.g. 50th BCS English"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Duration Minutes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 block">Duration (Minutes)</label>
                  {isDurationUserEdited ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDurationUserEdited(false);
                        const totalRuleQuestions = rules.reduce((acc, r) => acc + (Number(r.count) || 0), 0);
                        setDurationMinutes(totalRuleQuestions > 0 ? totalRuleQuestions : 10);
                      }}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset 1 min/q</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded">
                      1 min/q default
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => {
                    setDurationMinutes(Number(e.target.value));
                    setIsDurationUserEdited(true);
                  }}
                  min={1}
                  max={300}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Marks per question */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">Marks per Question</label>
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
                <label className="text-xs font-extrabold text-slate-700 block">Negative Marking (Per Wrong Answer)</label>
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
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <span>Group Matching Rules</span>
                    {(filterGroup1 !== 'all' || filterGroup2 !== 'all' || filterGroup3 !== 'all') && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                        🔒 Repositories Filters Locked
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    Specify how many questions should be randomly picked for each category condition.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Rule</span>
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
                        {/* Suitable Course */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase block">Suitable Course</label>
                            {filterGroup1 !== 'all' && (
                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">Locked</span>
                            )}
                          </div>
                          {filterGroup1 !== 'all' ? (
                            <div className="w-full px-2.5 py-1.5 bg-slate-200/80 border border-slate-300 rounded-lg text-xs font-extrabold text-indigo-900 truncate" title={`Locked by Question Repository filter: ${filterGroup1}`}>
                              🔒 {filterGroup1}
                            </div>
                          ) : (
                            <select
                              value={rule.group1 || 'all'}
                              onChange={(e) => handleRuleChange(rule.id, 'group1', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                            >
                              <option value="all">All Suitable Courses</option>
                              {uniqueGroups1.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Q.Type */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase block">Q.Type</label>
                            {filterGroup2 !== 'all' && (
                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">Locked</span>
                            )}
                          </div>
                          {filterGroup2 !== 'all' ? (
                            <div className="w-full px-2.5 py-1.5 bg-slate-200/80 border border-slate-300 rounded-lg text-xs font-extrabold text-indigo-900 truncate" title={`Locked by Question Repository filter: ${filterGroup2}`}>
                              🔒 {filterGroup2}
                            </div>
                          ) : (
                            <select
                              value={rule.group2 || 'all'}
                              onChange={(e) => handleRuleChange(rule.id, 'group2', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                            >
                              <option value="all">All Question Types</option>
                              {uniqueGroups2.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Others */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase block">Others</label>
                            {filterGroup3 !== 'all' && (
                              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">Locked</span>
                            )}
                          </div>
                          {filterGroup3 !== 'all' ? (
                            <div className="w-full px-2.5 py-1.5 bg-slate-200/80 border border-slate-300 rounded-lg text-xs font-extrabold text-indigo-900 truncate" title={`Locked by Question Repository filter: ${filterGroup3}`}>
                              🔒 {filterGroup3}
                            </div>
                          ) : (
                            <select
                              value={rule.group3 || 'all'}
                              onChange={(e) => handleRuleChange(rule.id, 'group3', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                            >
                              <option value="all">All Other Categories</option>
                              {uniqueGroups3.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Question Count */}
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase block mb-1">Question Count</label>
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
                            Available in Bank: {matchingCount}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            To Pick: {rule.count}
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
                    <span>Selecting Questions...</span>
                  </>
                ) : (
                  <>
                    <Shuffle className="w-4 h-4" />
                    <span>Generate Random Exam</span>
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
                    <span>Exam Prepared</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{generatedExam.title}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Questions: {generatedExam.questions.length} | Time: {generatedExam.durationMinutes} Minutes | Total Marks: {generatedExam.totalMarks}
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
                      <span>Publishing...</span>
                    </>
                  ) : publishSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Published to Online Exams!</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Publish to Online Exams</span>
                    </>
                  )}
                </button>
              </div>

              {/* Questions List Preview */}
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Selected Questions ({generatedExam.questions.length}):</h4>
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
                        title="Remove question from this exam"
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
                <span className="text-xs text-slate-500 font-semibold block">Total Courses</span>
                <strong className="text-xl font-extrabold text-slate-900">{courses.length}</strong>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold block">Total Scheduled Exams</span>
                <strong className="text-xl font-extrabold text-slate-900">{allExams.length}</strong>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold block">Total Exam Questions</span>
                <strong className="text-xl font-extrabold text-slate-900">
                  {allExams.reduce((acc, e) => acc + (e.questions?.length || 0), 0)}
                </strong>
              </div>
            </div>
          </div>

          {/* Course-wise Exam List Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>Course-wise Scheduled Exams</span>
              </h3>
              <button
                onClick={fetchScheduledExams}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingExams ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingExams ? (
              <div className="bg-white rounded-2xl p-8 text-center text-slate-400 text-sm">
                Loading scheduled exams...
              </div>
            ) : allExams.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center text-slate-500">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-800">No scheduled exams found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Create and schedule exams from the "Rule Exam Scheduler" tab.
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
                              Total Questions: <span className="font-bold text-slate-700">{totalQ}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-black ${
                            courseExams.length > 0 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            {courseExams.length} Exams Scheduled
                          </span>
                        </div>
                      </div>

                      {/* Exam Cards inside Course */}
                      {courseExams.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                          No exams scheduled for this course yet.
                        </div>
                      ) : (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white">
                          {courseExams.map(exam => (
                            <div key={exam.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between gap-3">
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <h5 className="font-bold text-slate-900 text-sm">{exam.title}</h5>
                                  <span className="text-[11px] font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
                                    {exam.durationMinutes} m
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                                  <span>Questions: <strong className="text-slate-800 font-bold">{exam.questions?.length || 0}</strong></span>
                                  <span>Marks: <strong className="text-slate-800 font-bold">{exam.totalMarks || ((exam.questions?.length || 0) * (exam.marksPerQuestion || 1))}</strong></span>
                                  <span>Negative: <strong className="text-rose-600 font-bold">-{exam.negativeMarking || 0}</strong></span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                                <span className="text-[11px] text-slate-400">
                                  {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString() : 'Scheduled'}
                                </span>

                                <button
                                  onClick={() => handleDeleteExam(exam.id)}
                                  className="px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
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
                          <h4 className="font-extrabold text-amber-900 text-base">General / All-Course Exams</h4>
                          <p className="text-xs text-amber-700">Exams not linked to a specific course</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                          {generalExams.length} Exams
                        </span>
                      </div>

                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white">
                        {generalExams.map(exam => (
                          <div key={exam.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <h5 className="font-bold text-slate-900 text-sm">{exam.title}</h5>
                                <span className="text-[11px] font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
                                  {exam.durationMinutes} m
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                                <span>Questions: <strong className="text-slate-800 font-bold">{exam.questions?.length || 0}</strong></span>
                                <span>Marks: <strong className="text-slate-800 font-bold">{exam.totalMarks || ((exam.questions?.length || 0) * (exam.marksPerQuestion || 1))}</strong></span>
                                <span>Negative: <strong className="text-rose-600 font-bold">-{exam.negativeMarking || 0}</strong></span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                              <span className="text-[11px] text-slate-400">
                                {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString() : 'Scheduled'}
                              </span>

                              <button
                                onClick={() => handleDeleteExam(exam.id)}
                                className="px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
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
                {editingQuestion ? 'Edit Question' : 'Add New Question'}
              </h3>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              {/* Question Text */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700 block">Question Text</label>
                <textarea
                  rows={3}
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="Enter question text here..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Option A</label>
                  <input
                    type="text"
                    value={formData.optionA}
                    onChange={(e) => setFormData({ ...formData, optionA: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Option B</label>
                  <input
                    type="text"
                    value={formData.optionB}
                    onChange={(e) => setFormData({ ...formData, optionB: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Option C</label>
                  <input
                    type="text"
                    value={formData.optionC}
                    onChange={(e) => setFormData({ ...formData, optionC: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Option D</label>
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
                  <label className="text-[11px] font-extrabold text-slate-600 block">Correct Answer</label>
                  <select
                    value={formData.correctAnswer}
                    onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="A">A (Option A)</option>
                    <option value="B">B (Option B)</option>
                    <option value="C">C (Option C)</option>
                    <option value="D">D (Option D)</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Explanation</label>
                  <input
                    type="text"
                    value={formData.explanation}
                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                    placeholder="Explanation for the correct answer..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              {/* Group Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Suitable Course</label>
                  <input
                    type="text"
                    value={formData.group1}
                    onChange={(e) => setFormData({ ...formData, group1: e.target.value })}
                    placeholder="e.g. BCS, Bank, সমাস, বাগধারা, IELTS"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Q.Type</label>
                  <input
                    type="text"
                    value={formData.group2}
                    onChange={(e) => setFormData({ ...formData, group2: e.target.value })}
                    placeholder="e.g. MCQ, Blank filling, OOO, Analogy"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-600 block">Others</label>
                  <input
                    type="text"
                    value={formData.group3}
                    onChange={(e) => setFormData({ ...formData, group3: e.target.value })}
                    placeholder="e.g. Subject, 2024, Exam Note"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL GUIDELINE MODAL */}
      {showGuidelineModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative animate-scaleUp">
            <button
              onClick={() => setShowGuidelineModal(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Excel Upload Guidelines
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Rules for formatting questions in Excel files and supported column aliases.
                </p>
              </div>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs text-slate-700">
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-1">
                <p className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Column Headers & Format:</span>
                </p>
                <p className="text-[11px] text-indigo-900 leading-relaxed">
                  The 1st row of your Excel file must contain column headers. The system automatically identifies headers based on the column aliases below.
                </p>
              </div>

              <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <h4 className="font-black text-slate-900 text-xs border-b border-slate-200/60 pb-2">
                  List of Supported Column Names and Aliases:
                </h4>

                <ul className="space-y-2 text-slate-700 font-medium leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Question ID / ID / Serial / SL:</strong> (Optional) Unique Question ID (e.g. <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">qb-101</code>). Left blank to auto-generate.
                    </div>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Question / QText:</strong> (Required) Enter main question text.
                    </div>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Option A / Opt A / A:</strong> (Required) First option.
                    </div>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Option B / Opt B / B:</strong> (Required) Second option.
                    </div>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Option C / Opt C / C:</strong> (Required) Third option (or enter N/A).
                    </div>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Option D / Opt D / D:</strong> (Required) Fourth option (or enter N/A).
                    </div>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Correct Answer / Correct / Answer / Ans:</strong> (Required) Correct answer option letter (<code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">A</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">B</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">C</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">D</code>) or exact text.
                    </div>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Explanation / Exp:</strong> (Optional) Detailed explanation for the answer.
                    </div>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Suitable Course / Course / Suitable_Course / Subject:</strong> (Required/Optional) Course or category (e.g. <span className="text-indigo-700 font-bold">BCS</span>, <span className="text-indigo-700 font-bold">Bank</span>, <span className="text-indigo-700 font-bold">IELTS</span>, etc.).
                    </div>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Q.Type / Question Type / QType / Q_Type / Topic:</strong> (Required/Optional) Question type or format (e.g. <span className="text-indigo-700 font-bold">MCQ</span>, <span className="text-indigo-700 font-bold">Blank filling</span>, <span className="text-indigo-700 font-bold">OOO</span>, <span className="text-indigo-700 font-bold">Analogy</span>, etc.).
                    </div>
                  </li>

                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">•</span>
                    <div>
                      <strong className="text-slate-900">Others / Other / Subject / Year / Category / Tag:</strong> (Optional) Other metadata like year or notes (e.g. <span className="text-indigo-700 font-bold">2024</span>, <span className="text-indigo-700 font-bold">38th BCS</span>, etc.).
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={downloadQuestionBankExcelTemplate}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGuidelineModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL WITH ALERT WARNING */}
      {deleteConfirmModal && deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl relative animate-scaleUp border border-slate-100">
            <button
              onClick={() => setDeleteConfirmModal(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {deleteConfirmModal.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Warning before permanent deletion from question bank
                </p>
              </div>
            </div>

            {/* CRITICAL WARNING ALERT */}
            <div className="p-4 bg-rose-50/90 border border-rose-200/90 rounded-2xl space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-rose-950 uppercase tracking-wide">
                    Critical Warning
                  </h4>
                  <p className="text-xs text-rose-900 leading-relaxed font-medium">
                    Deleting questions from the question bank will affect <strong className="font-extrabold text-rose-950 underline decoration-rose-400">all launched exams</strong> containing these questions, and students will no longer see them in exams.
                  </p>
                </div>
              </div>
            </div>

            {/* SUMMARY DETAILS */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs text-slate-700">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-bold">Item Description:</span>
                <span className="font-extrabold text-slate-900 truncate max-w-[200px]" title={deleteConfirmModal.description}>
                  {deleteConfirmModal.description}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Total Questions to Delete:</span>
                <span className="font-black text-rose-600 text-sm">{deleteConfirmModal.count}</span>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const onConf = deleteConfirmModal.onConfirm;
                  setDeleteConfirmModal(null);
                  await onConf();
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT OPTIONS MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl relative animate-scaleUp border border-slate-100">
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Export Excel
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Download an Excel (.xlsx) file for backup or offline editing
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Option 1: Selected Questions */}
              {selectedIds.size > 0 && (
                <button
                  onClick={() => handleExportQuestions('selected')}
                  className="w-full p-4 bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200/90 rounded-2xl text-left transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-indigo-950 block flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-indigo-600" />
                      Export Selected Questions
                    </span>
                    <span className="text-[11px] text-indigo-700/80 font-medium block">
                      {selectedIds.size} questions checked manually
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-extrabold rounded-lg shrink-0 shadow-xs">
                    {selectedIds.size}
                  </span>
                </button>
              )}

              {/* Option 2: Filtered Questions */}
              <button
                onClick={() => handleExportQuestions('filtered')}
                className="w-full p-4 bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200/90 rounded-2xl text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-emerald-950 block flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-emerald-600" />
                    Export Filtered Questions
                  </span>
                  <span className="text-[11px] text-emerald-700/80 font-medium block">
                    {filteredQuestions.length} questions matching search & filter
                  </span>
                </div>
                <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-extrabold rounded-lg shrink-0 shadow-xs">
                  {filteredQuestions.length}
                </span>
              </button>

              {/* Option 3: All Questions */}
              <button
                onClick={() => handleExportQuestions('all')}
                className="w-full p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-slate-900 block flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-slate-600" />
                    All Question Bank Questions (Full Backup)
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Complete backup file of all {questions.length} questions in the database
                  </span>
                </div>
                <span className="px-3 py-1 bg-slate-800 text-white text-xs font-extrabold rounded-lg shrink-0 shadow-xs">
                  {questions.length}
                </span>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL UPLOAD PREVIEW MODAL */}
      {showUploadPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl relative animate-scaleUp border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-4 shrink-0 border-b border-indigo-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white">Question Upload Preview</h3>
                    <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-black">
                      {pendingUploadQuestions.length} Questions Parsed
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">
                    Review parsed Excel questions before confirming save to Question Bank
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowUploadPreviewModal(false);
                  setPendingUploadQuestions([]);
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary & Search Bar */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200/80 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-extrabold text-slate-700 shadow-2xs">
                  Total Parsed: <strong className="text-indigo-600 font-black">{pendingUploadQuestions.length}</strong>
                </span>
                <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 shadow-2xs">
                  Suitable Courses: <strong className="text-slate-900">{new Set(pendingUploadQuestions.map(q => q.group1 || 'General')).size}</strong>
                </span>
                <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 shadow-2xs">
                  Q.Types: <strong className="text-slate-900">{new Set(pendingUploadQuestions.map(q => q.group2 || 'General')).size}</strong>
                </span>
                <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 shadow-2xs">
                  Categories: <strong className="text-slate-900">{new Set(pendingUploadQuestions.map(q => q.group3 || 'General')).size}</strong>
                </span>
              </div>

              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={previewSearch}
                  onChange={(e) => {
                    setPreviewSearch(e.target.value);
                    setPreviewPage(1);
                  }}
                  placeholder="Search parsed questions..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Questions Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 min-h-[250px]">
              {currentPreviewItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold text-sm">
                  No matching questions found for "{previewSearch}".
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3">Question & Options</th>
                        <th className="p-3 w-32">Suitable Course</th>
                        <th className="p-3 w-32">Q.Type</th>
                        <th className="p-3 w-32">Others</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {currentPreviewItems.map((q, idx) => {
                        const globalIdx = (previewPage - 1) * PREVIEW_ITEMS_PER_PAGE + idx + 1;
                        return (
                          <tr key={q.id || idx} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 text-center font-extrabold text-slate-400">
                              {globalIdx}
                            </td>
                            <td className="p-3 space-y-2">
                              <p className="font-extrabold text-slate-900 leading-relaxed">
                                {q.question}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                                <div className={`px-2 py-1 rounded-lg border ${q.correctAnswer === q.optionA ? 'bg-emerald-50 border-emerald-200 font-extrabold text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                  A: {q.optionA} {q.correctAnswer === q.optionA && '✓ (Correct)'}
                                </div>
                                <div className={`px-2 py-1 rounded-lg border ${q.correctAnswer === q.optionB ? 'bg-emerald-50 border-emerald-200 font-extrabold text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                  B: {q.optionB} {q.correctAnswer === q.optionB && '✓ (Correct)'}
                                </div>
                                {q.optionC && (
                                  <div className={`px-2 py-1 rounded-lg border ${q.correctAnswer === q.optionC ? 'bg-emerald-50 border-emerald-200 font-extrabold text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                    C: {q.optionC} {q.correctAnswer === q.optionC && '✓ (Correct)'}
                                  </div>
                                )}
                                {q.optionD && (
                                  <div className={`px-2 py-1 rounded-lg border ${q.correctAnswer === q.optionD ? 'bg-emerald-50 border-emerald-200 font-extrabold text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                    D: {q.optionD} {q.correctAnswer === q.optionD && '✓ (Correct)'}
                                  </div>
                                )}
                              </div>
                              {q.explanation && (
                                <p className="text-[11px] text-slate-500 italic bg-amber-50/60 border border-amber-200/60 p-2 rounded-xl">
                                  💡 <strong>Explanation:</strong> {q.explanation}
                                </p>
                              )}
                            </td>
                            <td className="p-3 align-top">
                              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-extrabold rounded-lg text-[10px] inline-block">
                                {q.group1 || 'General'}
                              </span>
                            </td>
                            <td className="p-3 align-top">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-[10px] inline-block">
                                {q.group2 || 'General'}
                              </span>
                            </td>
                            <td className="p-3 align-top">
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg text-[10px] inline-block">
                                {q.group3 || 'General'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer with Pagination & Action Buttons */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Pagination */}
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span>Page {previewPage} of {totalPreviewPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={previewPage >= totalPreviewPages}
                    onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadPreviewModal(false);
                    setPendingUploadQuestions([]);
                  }}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-extrabold transition cursor-pointer"
                >
                  Cancel & Discard
                </button>
                <button
                  type="button"
                  disabled={isUploading || pendingUploadQuestions.length === 0}
                  onClick={handleConfirmUpload}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Questions...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Save All ({pendingUploadQuestions.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
