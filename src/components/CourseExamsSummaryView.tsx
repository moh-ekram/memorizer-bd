import React, { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, 
  CalendarCheck2, 
  Clock, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Eye, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Layers, 
  Award, 
  Sparkles, 
  Database,
  ArrowUpDown,
  HelpCircle,
  BarChart2
} from 'lucide-react';
import { db, collection, getDocs, deleteDoc, doc } from '../lib/db';
import { Course, Exam } from '../types';
import { safeGetLocalStorage, safeSetLocalStorage } from '../lib/storage';

interface CourseExamsSummaryViewProps {
  courses: Course[];
  onNavigateToQuestionBank?: (courseId?: string) => void;
}

export function CourseExamsSummaryView({ courses, onNavigateToQuestionBank }: CourseExamsSummaryViewProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'with_exams' | 'no_exams'>('all');
  const [sortMode, setSortMode] = useState<'exams_desc' | 'title_asc' | 'words_desc'>('exams_desc');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  // Fetch all scheduled exams from local storage & Firestore
  const fetchExams = async () => {
    setLoading(true);
    const examMap = new Map<string, Exam>();

    // 1. Local storage cache
    try {
      const localData = safeGetLocalStorage('local_exams', '[]');
      const parsed = JSON.parse(localData);
      if (Array.isArray(parsed)) {
        parsed.forEach((e: Exam) => {
          if (e && e.id) examMap.set(e.id, e);
        });
      }
    } catch (_) {}

    // 2. Firestore cloud exams
    try {
      const snap = await getDocs(collection(db, 'exams'));
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (docSnap.id) {
          examMap.set(docSnap.id, { id: docSnap.id, ...d } as Exam);
        }
      });
    } catch (err) {
      console.warn('Notice loading cloud exams in CourseExamsSummaryView:', err);
    }

    const examList = Array.from(examMap.values());
    setExams(examList);
    setLoading(false);
  };

  useEffect(() => {
    fetchExams();
  }, []);

  // Group exams by courseId
  const examsByCourse = useMemo(() => {
    const map = new Map<string, Exam[]>();
    
    // Initialize map for known courses
    courses.forEach(c => {
      map.set(c.id.toLowerCase().trim(), []);
    });

    // General / Unassigned exams
    const generalExams: Exam[] = [];

    exams.forEach(exam => {
      if (exam.courseId) {
        const key = exam.courseId.toLowerCase().trim();
        if (map.has(key)) {
          map.get(key)!.push(exam);
        } else {
          // If courseId doesn't match an existing custom course, try matching by course title or put in general
          const matchCourse = courses.find(c => 
            c.title.toLowerCase().trim() === exam.courseId?.toLowerCase().trim() ||
            c.id.toLowerCase().trim() === exam.courseId?.toLowerCase().trim()
          );
          if (matchCourse) {
            const matchKey = matchCourse.id.toLowerCase().trim();
            if (!map.has(matchKey)) map.set(matchKey, []);
            map.get(matchKey)!.push(exam);
          } else {
            generalExams.push(exam);
          }
        }
      } else {
        generalExams.push(exam);
      }
    });

    return { map, generalExams };
  }, [courses, exams]);

  // Overall Statistics
  const totalCourses = courses.length;
  const totalExams = exams.length;
  const activeCoursesWithExamsCount = Array.from<Exam[]>(examsByCourse.map.values()).filter(list => list.length > 0).length;
  const totalQuestionsScheduled = exams.reduce((acc, e) => acc + (e.questions?.length || 0), 0);

  // Filter & Sort Courses List
  const filteredCourses = useMemo(() => {
    return courses
      .filter(course => {
        const courseExams = examsByCourse.map.get(course.id.toLowerCase().trim()) || [];
        
        // Filter by Search Query
        const matchesQuery = 
          course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (course.description && course.description.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesQuery) return false;

        // Filter by Exam Availability
        if (filterMode === 'with_exams') return courseExams.length > 0;
        if (filterMode === 'no_exams') return courseExams.length === 0;

        return true;
      })
      .sort((a, b) => {
        const examsA = (examsByCourse.map.get(a.id.toLowerCase().trim()) || []).length;
        const examsB = (examsByCourse.map.get(b.id.toLowerCase().trim()) || []).length;

        if (sortMode === 'exams_desc') {
          if (examsB !== examsA) return examsB - examsA;
          return a.title.localeCompare(b.title);
        }
        if (sortMode === 'words_desc') {
          const wordsA = a.words?.length || ((a.totalGroups || 37) * 30);
          const wordsB = b.words?.length || ((b.totalGroups || 37) * 30);
          return wordsB - wordsA;
        }
        return a.title.localeCompare(b.title);
      });
  }, [courses, examsByCourse, searchQuery, filterMode, sortMode]);

  // Handle Delete Exam
  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm('Are you sure you want to delete this scheduled exam?')) return;

    setDeletingExamId(examId);
    const updatedExams = exams.filter(e => e.id !== examId);
    setExams(updatedExams);
    safeSetLocalStorage('local_exams', JSON.stringify(updatedExams));

    try {
      await deleteDoc(doc(db, 'exams', examId));
    } catch (err) {
      console.warn('Cloud delete notice:', err);
    } finally {
      setDeletingExamId(null);
    }
  };

  const toggleExpandCourse = (courseId: string) => {
    setExpandedCourseId(prev => prev === courseId ? null : courseId);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-bold">
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Exam Activity Monitor</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Course & Scheduled Exam Summary
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed font-medium">
              Monitor all courses and currently scheduled active exams across your platform at a glance.
            </p>
          </div>

          <button
            onClick={fetchExams}
            disabled={loading}
            className="self-start md:self-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-500 font-bold block truncate">Total Courses</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">{totalCourses}</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
            <CalendarCheck2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-500 font-bold block truncate">Total Scheduled Exams</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600">{totalExams}</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-500 font-bold block truncate">Courses with Exams</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">{activeCoursesWithExamsCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-500 font-bold block truncate">Total Scheduled Questions</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">{totalQuestionsScheduled}</span>
          </div>
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by course title or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Courses ({courses.length})
            </button>
            <button
              onClick={() => setFilterMode('with_exams')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                filterMode === 'with_exams'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              With Exams ({activeCoursesWithExamsCount})
            </button>
            <button
              onClick={() => setFilterMode('no_exams')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                filterMode === 'no_exams'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              No Exams ({courses.length - activeCoursesWithExamsCount})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="exams_desc">Most Exams First</option>
              <option value="title_asc">Course Title (A-Z)</option>
              <option value="words_desc">Vocabulary Count</option>
            </select>
          </div>
        </div>
      </div>

      {/* Courses List Section */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-bold">Loading courses and exam data...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No Courses Found</h3>
            <p className="text-xs text-slate-500">No courses match your current search or filter criteria.</p>
          </div>
        ) : (
          filteredCourses.map(course => {
            const courseExams = examsByCourse.map.get(course.id.toLowerCase().trim()) || [];
            const isExpanded = expandedCourseId === course.id;
            const wordCount = course.words?.length || ((course.totalGroups || 37) * 30);

            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-200 hover:border-indigo-200"
              >
                {/* Course Main Summary Row */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-black text-sm">
                      <GraduationCap className="w-6 h-6" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-900 truncate">
                          {course.title}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-extrabold uppercase font-mono">
                          ID: {course.id}
                        </span>
                        {course.isDefault && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-extrabold">
                            Default Free
                          </span>
                        )}
                        {course.price ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold">
                            ৳{course.price}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-1 font-medium">
                        {course.description || 'No course description available'}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-slate-400 font-semibold pt-0.5">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          {wordCount} Words
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side Scheduled Exams Count & Actions */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    {/* Scheduled Exams Badge */}
                    <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-extrabold text-xs shadow-2xs ${
                      courseExams.length > 0
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-200/90'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      <CalendarCheck2 className={`w-4 h-4 ${courseExams.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{courseExams.length} Scheduled Exams</span>
                    </div>

                    {/* Expand/Collapse Exams Button */}
                    <button
                      onClick={() => toggleExpandCourse(course.id)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide' : 'View'} Exams</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {/* Schedule Exam Quick Action Button */}
                    {onNavigateToQuestionBank && (
                      <button
                        onClick={() => onNavigateToQuestionBank(course.id)}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Schedule a new exam for this course"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Create New Exam</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Scheduled Exams List Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                        <CalendarCheck2 className="w-4 h-4 text-indigo-600" />
                        {course.title} — Scheduled Exams ({courseExams.length})
                      </h4>

                      {onNavigateToQuestionBank && (
                        <button
                          onClick={() => onNavigateToQuestionBank(course.id)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Exam from Question Bank</span>
                        </button>
                      )}
                    </div>

                    {courseExams.length === 0 ? (
                      <div className="p-6 bg-white rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                        <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-xs text-slate-600 font-bold">
                          There are currently no scheduled exams or model tests for this course.
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Use the Question Bank section to select questions or generate a random test.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {courseExams.map((exam, idx) => (
                          <div
                            key={exam.id}
                            className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5 relative group hover:border-indigo-300 transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-indigo-600 font-black uppercase tracking-wide block">
                                  Exam #{idx + 1}
                                </span>
                                <h5 className="text-xs font-black text-slate-900 leading-snug">
                                  {exam.title}
                                </h5>
                              </div>

                              <button
                                onClick={() => handleDeleteExam(exam.id)}
                                disabled={deletingExamId === exam.id}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete Exam"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Exam Meta Info */}
                            <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50 rounded-lg text-[11px] font-bold text-slate-700">
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase">Questions</span>
                                <span className="font-extrabold text-indigo-700">{exam.questions?.length || 0}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase">Duration</span>
                                <span className="font-extrabold text-slate-900">{exam.durationMinutes} mins</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase">Total Marks</span>
                                <span className="font-extrabold text-slate-900">{exam.totalMarks}</span>
                              </div>
                            </div>

                            {/* Exam Action Bar */}
                            <div className="flex items-center justify-between text-[11px] pt-1">
                              <span className="text-slate-400 text-[10px] font-medium">
                                Created: {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString() : 'Recently'}
                              </span>

                              <button
                                onClick={() => setPreviewExam(exam)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold rounded-lg transition flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>প্রশ্নসমূহ দেখুন</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* General / Unassigned Exams Section */}
      {examsByCourse.generalExams.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4 text-amber-500" />
                সাধারণ / কোর্স বিহীন শিডিউলড এক্সামসমূহ ({examsByCourse.generalExams.length} টি)
              </h3>
              <p className="text-xs text-slate-500">
                এই পরীক্ষাগুলো কোনো নির্দিষ্ট কোর্সের সাথে যুক্ত করা হয়নি, যা সকল শিক্ষার্থী দিতে পারবে।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {examsByCourse.generalExams.map((exam, idx) => (
              <div
                key={exam.id}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-black text-slate-900">{exam.title}</h5>
                    <span className="text-[10px] text-slate-500">সকল শিক্ষার্থীর জন্য উন্মুক্ত</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewExam(exam)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                      title="প্রশ্ন দেখুন"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="এক্সাম মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                  <span>প্রশ্ন: {exam.questions?.length || 0} টি</span>
                  <span>সময়: {exam.durationMinutes} মি.</span>
                  <span>মোট মার্কস: {exam.totalMarks}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXAM PREVIEW OVERLAY MODAL */}
      {previewExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative animate-scaleUp border border-slate-100 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setPreviewExam(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <CalendarCheck2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {previewExam.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {previewExam.courseTitle || 'সাধারণ মডেল টেস্ট'} • মোট প্রশ্ন: {previewExam.questions?.length || 0} টি
                </p>
              </div>
            </div>

            {/* Questions List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {previewExam.questions?.map((q, qIdx) => (
                <div key={q.id || qIdx} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-indigo-600 text-white rounded-md text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      {qIdx + 1}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900 leading-relaxed">
                      {q.question}
                    </h5>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pl-7 pt-1">
                    {q.options?.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isCorrect = q.answer === letter || q.answer === opt;
                      return (
                        <div
                          key={optIdx}
                          className={`p-2 rounded-xl text-xs font-medium border ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <span className="font-bold mr-1">{letter}.</span> {opt}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="ml-7 p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-950 font-medium">
                      <strong>ব্যাখ্যা:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPreviewExam(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold transition cursor-pointer shadow-xs"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
