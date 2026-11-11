import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  Plus,
  Trash2,
  Layers,
  AlertCircle,
  CheckCircle,
  Building2,
  Users,
  ShieldAlert,
  ChevronRight,
  Info,
  CheckSquare,
  Square,
  Search,
  Download,
  FileText,
  RotateCcw,
  Eye,
  Filter,
  CalendarDays,
  UserCheck,
  XCircle,
  GraduationCap
} from 'lucide-react';
import { FacultyPersonalReport } from '../components/attendance/FacultyPersonalReport';
import { PrincipalFacultyReports } from '../components/attendance/PrincipalFacultyReports';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';

interface Batch {
  id: number;
  code: string;
  name: string;
  admission_academic_year: string;
  current_professional_year: number | null;
  scheme_id: number;
  scheme_code: string;
  scheme_name: string;
}

interface ClassTypeMapping {
  id: number;
  abbreviation: string;
  name: string;
  category: 'LT' | 'NLT' | 'NLP' | 'OTHER';
  description: string;
}

interface Subject {
  id: number;
  code: string;
  name: string;
  professional_year: number;
}

interface SubBatch {
  id: number;
  batch_id: number;
  code: string;
  name: string;
  description: string;
  student_count?: number;
}

export const isNonSubjectClassType = (
  type?: string | null,
  list?: Array<{ abbreviation: string; name: string }>
): boolean => {
  if (!type) return false;
  const upper = type.trim().toUpperCase();
  if (['MENTOR', 'SPORTS', 'LIB', 'LIBRARY'].includes(upper)) return true;
  if (list && list.length > 0) {
    const matched = list.find((ct) => ct.abbreviation.toUpperCase() === upper);
    if (matched) {
      const nameUpper = matched.name.toUpperCase();
      if (
        nameUpper.includes('MENTOR') ||
        nameUpper.includes('SPORTS') ||
        nameUpper.includes('LIBRARY')
      ) {
        return true;
      }
    }
  }
  return false;
};

export const getSlotDisplaySubject = (
  subjectName?: string | null,
  classType?: string | null
): string => {
  if (subjectName && subjectName.trim()) return subjectName;
  const upper = (classType || '').trim().toUpperCase();
  if (upper === 'MENTOR') return 'Mentor-Mentee';
  if (upper === 'SPORTS') return 'Sports & Physical Education';
  if (upper === 'LIB' || upper === 'LIBRARY') return 'Library Classes';
  return classType || 'Activity Slot';
};

interface TimetableSlot {
  id: number;
  timetable_version_id: number;
  weekday: string;
  start_time: string;
  end_time: string;
  subject_id: number | null;
  subject_code: string | null;
  subject_name: string | null;
  professional_year?: number;
  class_type: string;
  sub_batch_id: number | null;
  sub_batch_code: string | null;
  sub_batch_name: string | null;
  week_pattern: string;
  location_or_room: string | null;
  notes: string | null;
  attendanceSession?: {
    id: number;
    recordedAt: string;
    absentStudentIds: number[];
    absentCount: number;
  } | null;
}

interface TimetableVersion {
  id: number;
  batch_id: number;
  version_code: string;
  title: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  creator_name: string | null;
  hasAttendance: boolean;
  slots: TimetableSlot[];
}

interface Student {
  id: number;
  student_id_number: string;
  temporary_roll_number: string | null;
  permanent_university_number: string | null;
  full_name: string;
}

interface RegisterAbsentee {
  studentId: number;
  rollNumber: string;
  studentIdNumber: string;
  permanentUniversityNumber: string | null;
  studentName: string;
}

interface RegisterItem {
  date: string;
  weekday: string;
  slotId: number;
  timetableVersionId: number;
  versionCode: string;
  subjectId: number | null;
  subjectCode: string | null;
  subjectName: string;
  startTime: string;
  endTime: string;
  classType: string;
  subBatchId: number | null;
  subBatchCode: string | null;
  subBatchName: string | null;
  locationOrRoom: string | null;
  eligibleCount: number;
  presentCount: number | null;
  absentCount: number | null;
  status: 'RECORDED' | 'NOT_RECORDED';
  sessionId: number | null;
  recordedAt: string | null;
  recorderName: string | null;
  absentStudents: RegisterAbsentee[];
}

interface AbsenceItem {
  absenceId: number;
  sessionId: number;
  studentId: number;
  rollNumber: string;
  studentIdNumber: string;
  permanentUniversityNumber: string | null;
  studentName: string;
  date: string;
  weekday: string;
  startTime: string;
  endTime: string;
  classType: string;
  subjectId: number | null;
  subjectCode: string | null;
  subjectName: string;
  subBatchId: number | null;
  subBatchCode: string | null;
  subBatchName: string | null;
}

interface StudentHistoryItem {
  sessionId: number;
  date: string;
  weekday: string;
  startTime: string;
  endTime: string;
  subjectId: number | null;
  subjectCode: string | null;
  subjectName: string;
  classType: string;
  subBatchId: number | null;
  subBatchCode: string | null;
  subBatchName: string | null;
  status: 'PRESENT' | 'ABSENT';
  recordedAt: string | null;
  recorderName: string | null;
  isAcademic?: boolean;
}

interface StudentHistoryData {
  student: {
    id: number;
    rollNumber: string;
    studentIdNumber: string;
    permanentUniversityNumber: string | null;
    name: string;
    batchId: number;
    batchCode: string;
    batchName: string;
    currentProfessionalYear: number;
    schemeCode: string;
    schemeName: string;
    subBatches: Array<{ id: number; code: string; name: string }>;
  };
  filters: {
    fromDate: string | null;
    toDate: string | null;
    subjectId: number | null;
  };
  summary: {
    totalEligibleSessions: number;
    presentCount: number;
    absentCount: number;
    note: string;
  };
  history: StudentHistoryItem[];
}

interface SubjectSummaryItem {
  studentId: number;
  rollNumber: string;
  studentIdNumber: string;
  permanentUniversityNumber: string | null;
  studentName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  lt: { recorded: number; present: number; absent: number; percentage: number | null };
  nlt: { recorded: number; present: number; absent: number; percentage: number | null };
  nlp: { recorded: number; present: number; absent: number; percentage: number | null };
  other: { recorded: number; present: number; absent: number; percentage: number | null };
  combined: { recorded: number; present: number; absent: number; percentage: number | null };
}

interface MissingSessionItem {
  date: string;
  weekday: string;
  slotId: number;
  startTime: string;
  endTime: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  classType: string;
  subBatchId: number | null;
  subBatchCode: string | null;
  subBatchName: string | null;
  timetableVersionId: number;
  timetableVersionCode: string;
  status: 'NOT RECORDED';
}

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getFirstDayOfMonthString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapeCsv = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };
  const content = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\r\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const AttendanceManagementView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'student_attendance' | 'reports' | 'timetable' | 'settings'>('student_attendance');

  // Timetable setup state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [classTypes, setClassTypes] = useState<ClassTypeMapping[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subBatches, setSubBatches] = useState<SubBatch[]>([]);
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reports State
  const [reportSubTab, setReportSubTab] = useState<'register' | 'absences' | 'student_history' | 'subject_summary' | 'missing_sessions'>('register');
  const [reportBatchId, setReportBatchId] = useState<number | null>(null);
  const [reportFromDate, setReportFromDate] = useState<string>(getFirstDayOfMonthString());
  const [reportToDate, setReportToDate] = useState<string>(getTodayString());
  const [reportSubjectId, setReportSubjectId] = useState<number | ''>('');
  const [reportClassType, setReportClassType] = useState<string>('');
  const [reportSubBatchId, setReportSubBatchId] = useState<number | ''>('');
  const [registerReport, setRegisterReport] = useState<{
    totalClasses: number;
    recordedClasses: number;
    unrecordedClasses: number;
    items: RegisterItem[];
    batch: any;
  } | null>(null);
  const [absencesReport, setAbsencesReport] = useState<{
    totalAbsences: number;
    absences: AbsenceItem[];
  } | null>(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [selectedClassForAbsentees, setSelectedClassForAbsentees] = useState<RegisterItem | null>(null);
  const [reportFilterQuery, setReportFilterQuery] = useState('');

  // Subject-Wise Percentages State (Stage 6)
  const [subjectSummaryList, setSubjectSummaryList] = useState<SubjectSummaryItem[]>([]);
  const [isLoadingSubjectSummary, setIsLoadingSubjectSummary] = useState(false);
  const [attendanceThreshold, setAttendanceThreshold] = useState<number>(75.00);

  const fetchAttendanceThreshold = async () => {
    try {
      const res = await fetch('/api/attendance/settings/threshold').then((r) => r.json());
      if (res.success) setAttendanceThreshold(Number(res.threshold));
    } catch (err) {
      console.error('Failed to load threshold:', err);
    }
  };

  useEffect(() => {
    fetchAttendanceThreshold();
  }, []);

  // Missing Sessions State (Stage 7)
  const [missingSessionsList, setMissingSessionsList] = useState<MissingSessionItem[]>([]);
  const [totalMissingSessionsCount, setTotalMissingSessionsCount] = useState<number>(0);
  const [isLoadingMissingSessions, setIsLoadingMissingSessions] = useState(false);

  // Student-Wise History State (Stage 5)
  const [historyBatchId, setHistoryBatchId] = useState<number | null>(null);
  const [historyStudentId, setHistoryStudentId] = useState<number | null>(null);
  const [historyStudentsList, setHistoryStudentsList] = useState<Student[]>([]);
  const [historyFromDate, setHistoryFromDate] = useState<string>('');
  const [historyToDate, setHistoryToDate] = useState<string>('');
  const [historySubjectId, setHistorySubjectId] = useState<number | ''>('');
  const [historyData, setHistoryData] = useState<StudentHistoryData | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilterQuery, setHistoryFilterQuery] = useState('');

  // Student Attendance Entry State
  const [attendanceDate, setAttendanceDate] = useState<string>(getTodayString());
  const [scheduleData, setScheduleData] = useState<{
    isHoliday: boolean;
    holidayName: string | null;
    version: { id: number; versionCode: string; title: string; effectiveFrom: string } | null;
    slots: TimetableSlot[];
  } | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [holidayConfirmed, setHolidayConfirmed] = useState(false);

  // Attendance Taking Modal State
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [activeSlotForAttendance, setActiveSlotForAttendance] = useState<TimetableSlot | null>(null);
  const [eligibleStudents, setEligibleStudents] = useState<Student[]>([]);
  const [absentStudentIdsSet, setAbsentStudentIdsSet] = useState<Set<number>>(new Set());
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // Modals & form state for Timetable setup
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newVersionCode, setNewVersionCode] = useState('');
  const [newVersionTitle, setNewVersionTitle] = useState('');
  const [newEffectiveFrom, setNewEffectiveFrom] = useState('');
  const [newEffectiveTo, setNewEffectiveTo] = useState('');

  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [selectedVersionIdForSlot, setSelectedVersionIdForSlot] = useState<number | null>(null);
  const [slotWeekday, setSlotWeekday] = useState('MONDAY');
  const [slotStartTime, setSlotStartTime] = useState('09:00');
  const [slotEndTime, setSlotEndTime] = useState('10:00');
  const [slotSubjectId, setSlotSubjectId] = useState<number | ''>('');
  const [slotClassType, setSlotClassType] = useState('LT');
  const [slotSubBatchId, setSlotSubBatchId] = useState<number | ''>('');
  const [slotWeekPattern, setSlotWeekPattern] = useState('EVERY_WEEK');
  const [slotLocation, setSlotLocation] = useState('');
  const [slotNotes, setSlotNotes] = useState('');

  const [showSubBatchModal, setShowSubBatchModal] = useState(false);
  const [subBatchCode, setSubBatchCode] = useState('');
  const [subBatchName, setSubBatchName] = useState('');
  const [subBatchDesc, setSubBatchDesc] = useState('');

  // Fetch batches & class types on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch versions, subjects, and sub-batches when selected batch changes
  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchDetails(selectedBatchId);
      if (activeTab === 'student_attendance') {
        fetchStudentSchedule(selectedBatchId, attendanceDate);
      }
    } else {
      setVersions([]);
      setSubjects([]);
      setSubBatches([]);
      setScheduleData(null);
    }
  }, [selectedBatchId]);

  const fetchInitialData = async () => {
    try {
      const [batchRes, ctRes] = await Promise.all([
        fetch('/api/attendance/timetable/batches').then((r) => r.json()),
        fetch('/api/attendance/timetable/class-types').then((r) => r.json()),
      ]);
      if (batchRes.success) {
        setBatches(batchRes.batches);
        if (batchRes.batches.length > 0) {
          if (!selectedBatchId) setSelectedBatchId(batchRes.batches[0].id);
          if (!reportBatchId) setReportBatchId(batchRes.batches[0].id);
        }
      }
      if (ctRes.success) {
        setClassTypes(ctRes.classTypes);
      }
    } catch (err) {
      console.error('Failed to load initial timetable data:', err);
      setErrorMsg('Failed to load timetable setup data.');
    }
  };

  const fetchReportsData = async (
    bId: number | null,
    from: string,
    to: string,
    subjId: number | '',
    cType: string,
    sbId: number | ''
  ) => {
    if (!bId || !from || !to) return;
    setIsLoadingReports(true);
    setErrorMsg(null);
    try {
      const qParams = new URLSearchParams({
        batchId: String(bId),
        fromDate: from,
        toDate: to,
      });
      if (subjId !== '') qParams.append('subjectId', String(subjId));
      if (cType) qParams.append('classType', cType);
      if (sbId !== '') qParams.append('subBatchId', String(sbId));

      const [regRes, absRes] = await Promise.all([
        fetch(`/api/attendance/reports/student/register?${qParams.toString()}`).then((r) => r.json()),
        fetch(`/api/attendance/reports/student/absences?${qParams.toString()}`).then((r) => r.json()),
      ]);

      if (regRes.success) {
        setRegisterReport(regRes);
      } else {
        setErrorMsg(regRes.error || 'Failed to load date-wise register.');
      }

      if (absRes.success) {
        setAbsencesReport(absRes);
      } else {
        setErrorMsg(absRes.error || 'Failed to load absent student report.');
      }

      // Fetch Subject-Wise Summary & Missing Sessions in parallel
      fetchSubjectSummaryData(bId, from, to, subjId, null);
      fetchMissingSessionsData(bId, from, to);
    } catch (err: any) {
      console.error('Failed to load reports:', err);
      setErrorMsg('Failed to load attendance reports.');
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleResetFilters = () => {
    const defaultFrom = getFirstDayOfMonthString();
    const defaultTo = getTodayString();
    setReportFromDate(defaultFrom);
    setReportToDate(defaultTo);
    setReportSubjectId('');
    setReportClassType('');
    setReportSubBatchId('');
    setReportFilterQuery('');
    if (reportBatchId) {
      fetchReportsData(reportBatchId, defaultFrom, defaultTo, '', '', '');
    }
  };

  const handleExportRegisterCsv = () => {
    if (!registerReport || registerReport.items.length === 0) return;
    const headers = [
      'Date',
      'Weekday',
      'Time Slot',
      'Subject Code',
      'Subject Name',
      'Class Type',
      'Sub-Batch',
      'Eligible Students',
      'Present Count',
      'Absent Count',
      'Status',
      'Recorded At',
      'Recorded By',
      'Absent Roll Numbers',
    ];
    const rows = registerReport.items.map((item) => [
      item.date,
      item.weekday,
      `${item.startTime} - ${item.endTime}`,
      item.subjectCode,
      item.subjectName,
      item.classType,
      item.subBatchCode ? `${item.subBatchCode} (${item.subBatchName || ''})` : 'Whole Batch',
      item.eligibleCount,
      item.presentCount !== null ? item.presentCount : 'NOT RECORDED',
      item.absentCount !== null ? item.absentCount : 'NOT RECORDED',
      item.status,
      item.recordedAt ? item.recordedAt : '-',
      item.recorderName || '-',
      item.absentStudents.map((s) => s.rollNumber).join('; '),
    ]);
    const filename = `Attendance_Register_${registerReport.batch?.code || 'Batch'}_${reportFromDate}_to_${reportToDate}.csv`;
    downloadCsv(filename, headers, rows);
  };

  const handleExportAbsencesCsv = () => {
    if (!absencesReport || absencesReport.absences.length === 0) return;
    const headers = [
      'Date',
      'Weekday',
      'Roll Number',
      'Student Name',
      'University Reg No',
      'Student ID',
      'Subject Code',
      'Subject Name',
      'Class Time',
      'Class Type',
      'Sub-Batch',
    ];
    const rows = absencesReport.absences.map((r) => [
      r.date,
      r.weekday,
      r.rollNumber,
      r.studentName,
      r.permanentUniversityNumber || '-',
      r.studentIdNumber,
      r.subjectCode,
      r.subjectName,
      `${r.startTime} - ${r.endTime}`,
      r.classType,
      r.subBatchCode ? `${r.subBatchCode} (${r.subBatchName || ''})` : 'Whole Batch',
    ]);
    const filename = `Absent_Students_${reportFromDate}_to_${reportToDate}.csv`;
    downloadCsv(filename, headers, rows);
  };

  const fetchSubjectSummaryData = async (
    bId: number | null,
    from?: string,
    to?: string,
    subjId?: number | '',
    stId?: number | null
  ) => {
    if (!bId) return;
    setIsLoadingSubjectSummary(true);
    setErrorMsg(null);
    try {
      const qParams = new URLSearchParams({
        batchId: String(bId),
      });
      if (from) qParams.append('fromDate', from);
      if (to) qParams.append('toDate', to);
      if (subjId !== undefined && subjId !== '') qParams.append('subjectId', String(subjId));
      if (stId) qParams.append('studentId', String(stId));

      const res = await fetch(`/api/attendance/reports/subject-wise?${qParams.toString()}`).then((r) => r.json());
      if (res.success) {
        setSubjectSummaryList(res.summary || []);
      } else {
        setErrorMsg(res.error || 'Failed to load subject-wise attendance percentages.');
      }
    } catch (err: any) {
      console.error('Failed to load subject summary:', err);
      setErrorMsg('Failed to load subject-wise attendance percentages.');
    } finally {
      setIsLoadingSubjectSummary(false);
    }
  };

  const handleExportSubjectSummaryCsv = () => {
    if (subjectSummaryList.length === 0) return;
    const headers = [
      'Roll Number',
      'Student Name',
      'University Reg No',
      'Subject Code',
      'Subject Name',
      'LT Conducted',
      'LT Present',
      'LT %',
      'NLT Conducted',
      'NLT Present',
      'NLT %',
      'NLP Conducted',
      'NLP Present',
      'NLP %',
      'OTHER Conducted',
      'OTHER Present',
      'OTHER %',
      'Combined Conducted',
      'Combined Present',
      'Combined %',
    ];
    const rows = subjectSummaryList.map((item) => [
      item.rollNumber,
      item.studentName,
      item.permanentUniversityNumber || 'N/A',
      item.subjectCode,
      item.subjectName,
      item.lt.recorded,
      item.lt.present,
      item.lt.percentage !== null ? `${item.lt.percentage}%` : 'N/A',
      item.nlt.recorded,
      item.nlt.present,
      item.nlt.percentage !== null ? `${item.nlt.percentage}%` : 'N/A',
      item.nlp.recorded,
      item.nlp.present,
      item.nlp.percentage !== null ? `${item.nlp.percentage}%` : 'N/A',
      item.other.recorded,
      item.other.present,
      item.other.percentage !== null ? `${item.other.percentage}%` : 'N/A',
      item.combined.recorded,
      item.combined.present,
      item.combined.percentage !== null ? `${item.combined.percentage}%` : 'N/A',
    ]);
    const filename = `Subject_Wise_Attendance_Percentages_${reportFromDate || 'all'}_to_${reportToDate || 'all'}.csv`;
    downloadCsv(filename, headers, rows);
  };

  const fetchMissingSessionsData = async (bId: number | null, from?: string, to?: string) => {
    if (!bId) return;
    setIsLoadingMissingSessions(true);
    setErrorMsg(null);
    try {
      const qParams = new URLSearchParams({ batchId: String(bId) });
      if (from) qParams.append('fromDate', from);
      if (to) qParams.append('toDate', to);

      const res = await fetch(`/api/attendance/reports/missing-sessions?${qParams.toString()}`).then((r) => r.json());
      if (res.success) {
        setMissingSessionsList(res.missingSessions || []);
        setTotalMissingSessionsCount(res.totalMissing || 0);
      } else {
        setErrorMsg(res.error || 'Failed to load missing attendance sessions.');
      }
    } catch (err: any) {
      console.error('Failed to load missing sessions:', err);
      setErrorMsg('Failed to load missing attendance sessions.');
    } finally {
      setIsLoadingMissingSessions(false);
    }
  };

  const handleExportMissingSessionsCsv = () => {
    if (missingSessionsList.length === 0) return;
    const headers = [
      'Date',
      'Weekday',
      'Time Slot',
      'Subject Code',
      'Subject Name',
      'Class Type',
      'Scope / Sub-Batch',
      'Timetable Version Code',
      'Status',
    ];
    const rows = missingSessionsList.map((m) => [
      m.date,
      m.weekday,
      `${m.startTime} - ${m.endTime}`,
      m.subjectCode,
      m.subjectName,
      m.classType,
      m.subBatchCode ? `${m.subBatchCode} (${m.subBatchName || ''})` : 'Whole Batch',
      m.timetableVersionCode,
      'NOT RECORDED',
    ]);
    const filename = `Missing_Attendance_Sessions_${reportFromDate || 'all'}_to_${reportToDate || 'all'}.csv`;
    downloadCsv(filename, headers, rows);
  };

  const fetchHistoryStudents = async (batchId: number) => {
    try {
      const res = await fetch(`/api/attendance/student/eligible-students?batchId=${batchId}`);
      const data = await res.json();
      if (data.success) {
        setHistoryStudentsList(data.students || []);
      }
    } catch (err) {
      console.error('Failed to load students for batch:', err);
    }
  };

  const fetchStudentHistory = async (
    stId: number,
    bId?: number | null,
    from?: string,
    to?: string,
    subId?: number | ''
  ) => {
    setIsLoadingHistory(true);
    setErrorMsg(null);
    try {
      const qParams = new URLSearchParams({
        studentId: String(stId),
      });
      if (bId) qParams.append('batchId', String(bId));
      if (from) qParams.append('fromDate', from);
      if (to) qParams.append('toDate', to);
      if (subId !== undefined && subId !== '') qParams.append('subjectId', String(subId));

      const res = await fetch(`/api/attendance/reports/student/history?${qParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setHistoryData(data);
      } else {
        setErrorMsg(data.error || 'Failed to load student attendance history.');
      }
    } catch (err) {
      console.error('Failed to fetch student attendance history:', err);
      setErrorMsg('Failed to load student attendance history.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleResetHistoryFilters = () => {
    setHistoryFromDate('');
    setHistoryToDate('');
    setHistorySubjectId('');
    setHistoryFilterQuery('');
    if (historyStudentId) {
      fetchStudentHistory(historyStudentId, historyBatchId, '', '', '');
    }
  };

  const handleExportStudentHistoryCsv = () => {
    if (!historyData || historyData.history.length === 0) return;
    const st = historyData.student;
    const headers = [
      'Roll Number',
      'Student Name',
      'Student ID',
      'University Reg No',
      'Batch',
      'Date',
      'Weekday',
      'Scheduled Time',
      'Subject Code',
      'Subject Name',
      'Class Type',
      'Sub-Batch',
      'Status',
      'Recorded At',
      'Recorded By',
    ];
    const rows = historyData.history.map((h) => [
      st.rollNumber,
      st.name,
      st.studentIdNumber,
      st.permanentUniversityNumber || '-',
      st.batchCode,
      h.date,
      h.weekday,
      `${h.startTime} - ${h.endTime}`,
      h.subjectCode,
      h.subjectName,
      h.classType,
      h.subBatchCode ? `${h.subBatchCode} (${h.subBatchName || ''})` : 'Whole Batch',
      h.status,
      h.recordedAt ? new Date(h.recordedAt).toLocaleString() : '-',
      h.recorderName || '-',
    ]);
    const filename = `Student_Attendance_History_${st.rollNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${getTodayString()}.csv`;
    downloadCsv(filename, headers, rows);
  };

  const handleSelectStudentForHistory = (stId: number, bId?: number | null) => {
    const targetBatchId = bId || reportBatchId || selectedBatchId || (batches[0]?.id ?? null);
    setReportSubTab('student_history');
    if (targetBatchId) {
      setHistoryBatchId(targetBatchId);
      fetchHistoryStudents(targetBatchId);
    }
    setHistoryStudentId(stId);
    fetchStudentHistory(stId, targetBatchId, historyFromDate, historyToDate, historySubjectId);
  };

  const fetchBatchDetails = async (batchId: number) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [subjRes, sbRes, verRes] = await Promise.all([
        fetch(`/api/attendance/timetable/subjects?batchId=${batchId}`).then((r) => r.json()),
        fetch(`/api/attendance/timetable/sub-batches?batchId=${batchId}`).then((r) => r.json()),
        fetch(`/api/attendance/timetable/versions?batchId=${batchId}`).then((r) => r.json()),
      ]);

      if (subjRes.success) setSubjects(subjRes.subjects);
      if (sbRes.success) setSubBatches(sbRes.subBatches);
      if (verRes.success) setVersions(verRes.versions);
    } catch (err) {
      console.error('Failed to fetch batch timetable details:', err);
      setErrorMsg('Failed to load timetable versions and subjects.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudentSchedule = async (batchId: number, dateStr: string) => {
    setIsLoadingSchedule(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/attendance/student/schedule?batchId=${batchId}&date=${dateStr}`);
      const data = await res.json();
      if (data.success) {
        setScheduleData(data);
      } else {
        setErrorMsg(data.error || 'Failed to load student schedule.');
      }
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
      setErrorMsg('Failed to fetch student attendance schedule.');
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const handleOpenAttendanceModal = async (slot: TimetableSlot) => {
    if (!selectedBatchId) return;
    setActiveSlotForAttendance(slot);
    setErrorMsg(null);
    try {
      const subBatchParam = slot.sub_batch_id ? `&subBatchId=${slot.sub_batch_id}` : '';
      const res = await fetch(`/api/attendance/student/eligible-students?batchId=${selectedBatchId}${subBatchParam}`);
      const data = await res.json();
      if (data.success) {
        setEligibleStudents(data.students);
        const absentSet = new Set<number>(slot.attendanceSession?.absentStudentIds || []);
        setAbsentStudentIdsSet(absentSet);
        setStudentSearchQuery('');
        setShowAttendanceModal(true);
      } else {
        setErrorMsg(data.error || 'Failed to load eligible students.');
      }
    } catch (err) {
      console.error('Failed to load eligible students:', err);
      setErrorMsg('Failed to load eligible students.');
    }
  };

  const handleSaveAttendanceSession = async () => {
    if (!selectedBatchId || !activeSlotForAttendance || !scheduleData?.version) return;
    setIsSavingAttendance(true);
    setErrorMsg(null);

    const absentStudentIds = Array.from(absentStudentIdsSet);

    try {
      const res = await fetch('/api/attendance/student/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: selectedBatchId,
          slotId: activeSlotForAttendance.id,
          date: attendanceDate,
          subBatchId: activeSlotForAttendance.sub_batch_id,
          absentStudentIds,
          confirmHoliday: scheduleData.isHoliday ? holidayConfirmed : false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'HOLIDAY_CONFIRMATION_REQUIRED') {
          setErrorMsg(data.error);
          setIsSavingAttendance(false);
          return;
        }
        throw new Error(data.error || 'Failed to save attendance session.');
      }

      setSuccessMsg('Student attendance saved successfully.');
      setShowAttendanceModal(false);
      fetchStudentSchedule(selectedBatchId, attendanceDate);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save attendance.');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !newVersionCode.trim() || !newVersionTitle.trim() || !newEffectiveFrom) {
      setErrorMsg('Please fill in all required fields for the timetable version.');
      return;
    }

    try {
      const res = await fetch('/api/attendance/timetable/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: selectedBatchId,
          versionCode: newVersionCode,
          title: newVersionTitle,
          effectiveFrom: newEffectiveFrom,
          effectiveTo: newEffectiveTo || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create timetable version.');
      }

      setSuccessMsg('Timetable version created successfully.');
      setShowNewVersionModal(false);
      setNewVersionCode('');
      setNewVersionTitle('');
      setNewEffectiveFrom('');
      setNewEffectiveTo('');
      fetchBatchDetails(selectedBatchId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create timetable version.');
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const isSubjectRequired = !isNonSubjectClassType(slotClassType, classTypes);
    if (
      !selectedVersionIdForSlot ||
      !slotWeekday ||
      !slotStartTime ||
      !slotEndTime ||
      (isSubjectRequired && (slotSubjectId === '' || slotSubjectId === null))
    ) {
      setErrorMsg(
        isSubjectRequired
          ? 'Please complete all required slot fields, including the curriculum subject.'
          : 'Please complete all required slot time and weekday fields.'
      );
      return;
    }

    try {
      const res = await fetch(`/api/attendance/timetable/versions/${selectedVersionIdForSlot}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekday: slotWeekday,
          startTime: slotStartTime,
          endTime: slotEndTime,
          subjectId: isSubjectRequired && slotSubjectId !== '' ? Number(slotSubjectId) : null,
          classType: slotClassType,
          subBatchId: slotSubBatchId !== '' ? Number(slotSubBatchId) : null,
          weekPattern: slotWeekPattern,
          locationOrRoom: slotLocation || null,
          notes: slotNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add timetable slot.');
      }

      setSuccessMsg('Timetable slot added successfully.');
      setShowAddSlotModal(false);
      setSlotStartTime('09:00');
      setSlotEndTime('10:00');
      setSlotSubjectId('');
      setSlotLocation('');
      setSlotNotes('');
      if (selectedBatchId) fetchBatchDetails(selectedBatchId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add timetable slot.');
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!confirm('Are you sure you want to remove this timetable slot?')) return;
    try {
      const res = await fetch(`/api/attendance/timetable/slots/${slotId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete slot.');
      setSuccessMsg('Slot removed successfully.');
      if (selectedBatchId) fetchBatchDetails(selectedBatchId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete slot.');
    }
  };

  const handleDeleteVersion = async (versionId: number) => {
    if (!confirm('Are you sure you want to delete this unused timetable version?')) return;
    try {
      const res = await fetch(`/api/attendance/timetable/versions/${versionId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete version.');
      setSuccessMsg('Timetable version deleted successfully.');
      if (selectedBatchId) fetchBatchDetails(selectedBatchId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete version.');
    }
  };

  const handleSaveSubBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !subBatchCode.trim() || !subBatchName.trim()) {
      setErrorMsg('Sub-batch code and name are required.');
      return;
    }

    try {
      const res = await fetch('/api/attendance/timetable/sub-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: selectedBatchId,
          code: subBatchCode,
          name: subBatchName,
          description: subBatchDesc || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save sub-batch.');

      setSuccessMsg('Sub-batch saved successfully.');
      setShowSubBatchModal(false);
      setSubBatchCode('');
      setSubBatchName('');
      setSubBatchDesc('');
      if (selectedBatchId) fetchBatchDetails(selectedBatchId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save sub-batch.');
    }
  };

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const canManageStudentAttendance = user && ['STUDENT_ATTENDANCE', 'PRINCIPAL', 'SUPER_ADMIN'].includes(user.role);

  return (
    <div className="space-y-6">
      {/* View Header Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Students Attendance</h1>
          <p className="text-xs text-stone-500">
            Student academic daily attendance, subject reports, and timetable setup.
          </p>
        </div>
        {canManageStudentAttendance && (
          <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-lg">
            <button
              onClick={() => {
                setActiveTab('student_attendance');
                if (selectedBatchId) fetchStudentSchedule(selectedBatchId, attendanceDate);
              }}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                activeTab === 'student_attendance'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Daily Student Attendance
            </button>
            <button
              onClick={() => {
                setActiveTab('reports');
                const bId = reportBatchId || selectedBatchId || (batches[0]?.id ?? null);
                if (bId) {
                  setReportBatchId(bId);
                  fetchReportsData(bId, reportFromDate, reportToDate, reportSubjectId, reportClassType, reportSubBatchId);
                }
              }}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                activeTab === 'reports'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Student Attendance Reports
            </button>
            <button
              onClick={() => setActiveTab('timetable')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                activeTab === 'timetable'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Timetable Setup
            </button>
            {user && ['PRINCIPAL', 'SUPER_ADMIN'].includes(user.role) && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'settings'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Settings
              </button>
            )}
          </div>
        )}
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 font-bold">&times;</button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 font-bold">&times;</button>
        </div>
      )}

      {activeTab === 'student_attendance' ? (
        <div className="space-y-6">
          {/* Batch Selector & Date Picker Bar */}
          <Card accentTop>
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                  <div className="w-full sm:w-64">
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Academic Batch
                    </label>
                    <select
                      value={selectedBatchId || ''}
                      onChange={(e) => {
                        const bId = Number(e.target.value);
                        setSelectedBatchId(bId);
                        fetchStudentSchedule(bId, attendanceDate);
                      }}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}) — Year {b.current_professional_year || 'N/A'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-48">
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Attendance Date
                    </label>
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => {
                        const dt = e.target.value;
                        setAttendanceDate(dt);
                        setHolidayConfirmed(false);
                        if (selectedBatchId) fetchStudentSchedule(selectedBatchId, dt);
                      }}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => selectedBatchId && fetchStudentSchedule(selectedBatchId, attendanceDate)}
                  className="bg-[#4B2E2E] hover:bg-[#382121] text-white text-xs font-medium"
                >
                  Load Schedule
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Holiday Warning Banner */}
          {scheduleData?.isHoliday && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
                <div>
                  <span className="font-bold">Institutional Holiday Notice:</span> {scheduleData.holidayName || 'Official Holiday'} on this date.
                </div>
              </div>
              <label className="flex items-center gap-2 bg-white border border-amber-300 px-3 py-1.5 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={holidayConfirmed}
                  onChange={(e) => setHolidayConfirmed(e.target.checked)}
                  className="rounded text-[#4B2E2E] focus:ring-[#4B2E2E]"
                />
                <span className="font-medium text-stone-800">Confirm Holiday Attendance Recording</span>
              </label>
            </div>
          )}

          {/* Scheduled Classes & Attendance Taking */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-stone-900">Scheduled Classes & Attendance Entry</h2>
                <p className="text-xs text-stone-500">
                  Select a scheduled class to mark absent students. All other eligible students are recorded as present by default.
                </p>
              </div>
              {scheduleData?.version && (
                <Badge variant="success" className="text-xs">
                  Active Timetable: {scheduleData.version.title} ({scheduleData.version.versionCode})
                </Badge>
              )}
            </div>

            {isLoadingSchedule ? (
              <div className="text-center py-12 text-stone-500 text-xs">Loading scheduled classes...</div>
            ) : !scheduleData?.version ? (
              <Card>
                <CardContent className="p-12 text-center text-stone-500 text-xs space-y-2">
                  <Calendar className="w-10 h-10 mx-auto text-stone-400 stroke-1" />
                  <p>No active timetable version found effective on {attendanceDate}.</p>
                  <p className="text-[11px] text-stone-400">Please create or adjust a timetable version covering this date in Timetable Setup.</p>
                </CardContent>
              </Card>
            ) : scheduleData.slots.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-stone-500 text-xs space-y-2">
                  <Clock className="w-10 h-10 mx-auto text-stone-400 stroke-1" />
                  <p>No classes scheduled for this weekday ({new Date(attendanceDate).toLocaleDateString('en-US', { weekday: 'long' })}) under the current timetable version.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduleData.slots.map((slot) => {
                  const hasRecorded = Boolean(slot.attendanceSession);
                  const absentCount = slot.attendanceSession?.absentCount || 0;
                  return (
                    <Card key={slot.id} accentTop={hasRecorded}>
                      <CardContent className="p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-stone-900">
                                {getSlotDisplaySubject(slot.subject_name, slot.class_type)}
                              </h3>
                              <Badge variant="neutral" className="text-[10px]">{slot.class_type}</Badge>
                            </div>
                            <p className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-stone-400" />
                              <span>{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</span>
                              {slot.sub_batch_code && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 rounded text-[10px] font-medium ml-2">
                                  Sub-Batch: {slot.sub_batch_code}
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            {hasRecorded ? (
                              <Badge variant="success" className="text-xs flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Recorded ({absentCount} Absent)
                              </Badge>
                            ) : (
                              <Badge variant="neutral" className="text-xs">
                                Pending Attendance
                              </Badge>
                            )}
                          </div>
                        </div>

                        {slot.location_or_room && (
                          <div className="text-[11px] text-stone-500">
                            Location: {slot.location_or_room}
                          </div>
                        )}

                        <div className="flex justify-end pt-2 border-t border-stone-100">
                          <Button
                            size="sm"
                            onClick={() => handleOpenAttendanceModal(slot)}
                            className="bg-[#4B2E2E] hover:bg-[#382121] text-white text-xs"
                          >
                            {hasRecorded ? 'Edit Attendance' : 'Take Attendance'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'reports' ? (
        <div className="space-y-6">
          {/* Reports Filter Card */}
          {reportSubTab === 'student_history' ? (
            <Card accentTop>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#4B2E2E]" />
                    <h3 className="text-sm font-bold text-stone-900">Student Attendance History Filters</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetHistoryFilters}
                    className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Academic Batch */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Academic Batch
                    </label>
                    <select
                      value={historyBatchId || ''}
                      onChange={(e) => {
                        const bId = Number(e.target.value);
                        setHistoryBatchId(bId || null);
                        setHistoryStudentId(null);
                        setHistoryData(null);
                        if (bId) {
                          fetchHistoryStudents(bId);
                          fetchBatchDetails(bId);
                        }
                      }}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    >
                      <option value="">Select Academic Batch...</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}) — Year {b.current_professional_year || 'N/A'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Student Selection */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Select Student
                    </label>
                    <select
                      value={historyStudentId || ''}
                      onChange={(e) => {
                        const sId = Number(e.target.value);
                        setHistoryStudentId(sId || null);
                        if (sId) {
                          fetchStudentHistory(sId, historyBatchId, historyFromDate, historyToDate, historySubjectId);
                        } else {
                          setHistoryData(null);
                        }
                      }}
                      disabled={!historyBatchId || historyStudentsList.length === 0}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E] disabled:bg-stone-100 disabled:text-stone-400"
                    >
                      <option value="">
                        {!historyBatchId
                          ? 'Select a batch first...'
                          : historyStudentsList.length === 0
                          ? 'No active students found in batch'
                          : 'Select student by roll or name...'}
                      </option>
                      {historyStudentsList.map((s) => (
                        <option key={s.id} value={s.id}>
                          [Roll: {s.temporary_roll_number || s.student_id_number}] {s.full_name} {s.permanent_university_number ? `(${s.permanent_university_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* From Date (Optional) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      From Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={historyFromDate}
                      onChange={(e) => setHistoryFromDate(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    />
                  </div>

                  {/* To Date (Optional) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      To Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={historyToDate}
                      onChange={(e) => setHistoryToDate(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                  <div className="w-full sm:w-64">
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Subject (Optional)
                    </label>
                    <select
                      value={historySubjectId}
                      onChange={(e) => setHistorySubjectId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    >
                      <option value="">All Subjects</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    onClick={() => {
                      if (historyStudentId) {
                        fetchStudentHistory(historyStudentId, historyBatchId, historyFromDate, historyToDate, historySubjectId);
                      }
                    }}
                    disabled={!historyStudentId || isLoadingHistory}
                    className="bg-[#4B2E2E] hover:bg-[#382121] text-white text-xs font-medium w-full sm:w-auto"
                  >
                    {isLoadingHistory ? 'Loading History...' : 'Apply Filters & View History'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card accentTop>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[#4B2E2E]" />
                    <h3 className="text-sm font-bold text-stone-900">Attendance Report Filters</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                    className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Academic Batch */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Academic Batch
                    </label>
                    <select
                      value={reportBatchId || ''}
                      onChange={(e) => {
                        const bId = Number(e.target.value);
                        setReportBatchId(bId);
                      }}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}) — Year {b.current_professional_year || 'N/A'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* From Date */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={reportFromDate}
                      onChange={(e) => setReportFromDate(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    />
                  </div>

                  {/* To Date */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={reportToDate}
                      onChange={(e) => setReportToDate(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    />
                  </div>

                  {/* Optional Subject */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Subject (Optional)
                    </label>
                    <select
                      value={reportSubjectId}
                      onChange={(e) => setReportSubjectId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    >
                      <option value="">All Subjects</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Optional Class Type */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Class Type (Optional)
                    </label>
                    <select
                      value={reportClassType}
                      onChange={(e) => setReportClassType(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    >
                      <option value="">All Types (LT, NLT, NLP, OTHER)</option>
                      <option value="LT">Lecture (LT)</option>
                      <option value="NLT">Non-Lecture Theory (NLT)</option>
                      <option value="NLP">Non-Lecture Practical (NLP)</option>
                      <option value="OTHER">Other / Activities</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                  <div className="w-full sm:w-64">
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Sub-Batch Scope (Optional)
                    </label>
                    <select
                      value={reportSubBatchId}
                      onChange={(e) => setReportSubBatchId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    >
                      <option value="">All Scopes (Whole Batch & Sub-Batches)</option>
                      {subBatches.map((sb) => (
                        <option key={sb.id} value={sb.id}>
                          {sb.code} — {sb.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    onClick={() =>
                      fetchReportsData(
                        reportBatchId,
                        reportFromDate,
                        reportToDate,
                        reportSubjectId,
                        reportClassType,
                        reportSubBatchId
                      )
                    }
                    disabled={isLoadingReports}
                    className="bg-[#4B2E2E] hover:bg-[#382121] text-white text-xs font-medium w-full sm:w-auto"
                  >
                    {isLoadingReports ? 'Generating Report...' : 'Apply Filters & View Report'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sub-Tabs Navigation & CSV Export Action */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-stone-100 p-2 rounded-xl border border-stone-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setReportSubTab('register')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                  reportSubTab === 'register'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <CalendarDays className="w-4 h-4 text-[#4B2E2E]" />
                Date-Wise Class Register
                <Badge variant={reportSubTab === 'register' ? 'gold' : 'neutral'} className="text-[10px]">
                  {registerReport?.items?.length ?? 0}
                </Badge>
              </button>

              <button
                onClick={() => setReportSubTab('absences')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                  reportSubTab === 'absences'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <FileText className="w-4 h-4 text-[#4B2E2E]" />
                Absent Student Report
                <Badge variant={reportSubTab === 'absences' ? 'gold' : 'neutral'} className="text-[10px]">
                  {absencesReport?.absences?.length ?? 0}
                </Badge>
              </button>

              <button
                onClick={() => {
                  setReportSubTab('student_history');
                  const bId = historyBatchId || reportBatchId || selectedBatchId || (batches[0]?.id ?? null);
                  if (bId) {
                    setHistoryBatchId(bId);
                    fetchHistoryStudents(bId);
                    fetchBatchDetails(bId);
                  }
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                  reportSubTab === 'student_history'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <UserCheck className="w-4 h-4 text-[#4B2E2E]" />
                Student-Wise History
                {historyData && (
                  <Badge variant={reportSubTab === 'student_history' ? 'gold' : 'neutral'} className="text-[10px]">
                    {historyData.summary.totalEligibleSessions} sessions
                  </Badge>
                )}
              </button>

              <button
                onClick={() => {
                  setReportSubTab('subject_summary');
                  const bId = reportBatchId || selectedBatchId || (batches[0]?.id ?? null);
                  if (bId) {
                    fetchSubjectSummaryData(bId, reportFromDate, reportToDate, reportSubjectId, null);
                  }
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                  reportSubTab === 'subject_summary'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-[#4B2E2E]" />
                Subject-Wise Summary
                <Badge variant={reportSubTab === 'subject_summary' ? 'gold' : 'neutral'} className="text-[10px]">
                  {subjectSummaryList.length} records
                </Badge>
              </button>

              <button
                onClick={() => {
                  setReportSubTab('missing_sessions');
                  const bId = reportBatchId || selectedBatchId || (batches[0]?.id ?? null);
                  if (bId) {
                    fetchMissingSessionsData(bId, reportFromDate, reportToDate);
                  }
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                  reportSubTab === 'missing_sessions'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <AlertCircle className="w-4 h-4 text-amber-700" />
                Missing Sessions
                <Badge variant={reportSubTab === 'missing_sessions' ? 'gold' : 'neutral'} className="text-[10px]">
                  {totalMissingSessionsCount} missing
                </Badge>
              </button>
            </div>

            <div className="w-full sm:w-auto flex justify-end">
              {reportSubTab === 'register' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportRegisterCsv}
                  disabled={!registerReport || registerReport.items.length === 0}
                  className="text-xs flex items-center gap-1.5 bg-white hover:bg-stone-50 border-stone-300 w-full sm:w-auto"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" /> Export Register CSV
                </Button>
              ) : reportSubTab === 'absences' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAbsencesCsv}
                  disabled={!absencesReport || absencesReport.absences.length === 0}
                  className="text-xs flex items-center gap-1.5 bg-white hover:bg-stone-50 border-stone-300 w-full sm:w-auto"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" /> Export Absences CSV
                </Button>
              ) : reportSubTab === 'student_history' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportStudentHistoryCsv}
                  disabled={!historyData || historyData.history.length === 0}
                  className="text-xs flex items-center gap-1.5 bg-white hover:bg-stone-50 border-stone-300 w-full sm:w-auto"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" /> Export Student History CSV
                </Button>
              ) : reportSubTab === 'subject_summary' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSubjectSummaryCsv}
                  disabled={subjectSummaryList.length === 0}
                  className="text-xs flex items-center gap-1.5 bg-white hover:bg-stone-50 border-stone-300 w-full sm:w-auto"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" /> Export Subject Summary CSV
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportMissingSessionsCsv}
                  disabled={missingSessionsList.length === 0}
                  className="text-xs flex items-center gap-1.5 bg-white hover:bg-stone-50 border-stone-300 w-full sm:w-auto"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" /> Export Missing Sessions CSV
                </Button>
              )}
            </div>
          </div>

          {/* Summary Metric Cards */}
          {reportSubTab === 'register' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Total Scheduled Classes
                </span>
                <div className="text-2xl font-bold text-stone-900 mt-1">
                  {registerReport?.totalClasses ?? 0}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">Classes in selected date range</p>
              </div>

              <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    Attendance Recorded
                  </span>
                  <Badge variant="success" className="text-[10px]">RECORDED</Badge>
                </div>
                <div className="text-2xl font-bold text-emerald-900 mt-1">
                  {registerReport?.recordedClasses ?? 0}
                </div>
                <p className="text-[11px] text-emerald-700 mt-0.5">Sessions marked by office/staff</p>
              </div>

              <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                    Pending / Not Recorded
                  </span>
                  <Badge variant="warning" className="text-[10px]">NOT RECORDED</Badge>
                </div>
                <div className="text-2xl font-bold text-amber-900 mt-1">
                  {registerReport?.unrecordedClasses ?? 0}
                </div>
                <p className="text-[11px] text-amber-700 mt-0.5">Classes awaiting attendance entry</p>
              </div>
            </div>
          ) : reportSubTab === 'absences' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Total Absent Occurrences
                </span>
                <div className="text-2xl font-bold text-stone-900 mt-1">
                  {absencesReport?.totalAbsences ?? 0}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">Total class sessions missed by students</p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Unique Absent Students
                </span>
                <div className="text-2xl font-bold text-[#4B2E2E] mt-1">
                  {absencesReport ? new Set(absencesReport.absences.map((a) => a.studentId)).size : 0}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">Distinct students with recorded absences</p>
              </div>
            </div>
          ) : reportSubTab === 'student_history' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Total Eligible Recorded Sessions
                </span>
                <div className="text-2xl font-bold text-stone-900 mt-1">
                  {historyData?.summary.totalEligibleSessions ?? 0}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Sessions where student was eligible and attendance was taken
                </p>
              </div>

              <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    Total Present Count
                  </span>
                  <Badge variant="success" className="text-[10px]">PRESENT</Badge>
                </div>
                <div className="text-2xl font-bold text-emerald-800 mt-1">
                  {historyData?.summary.presentCount ?? 0}
                </div>
                <p className="text-[11px] text-emerald-700 mt-0.5">Recorded sessions attended</p>
              </div>

              <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-800">
                    Total Absent Count
                  </span>
                  <Badge variant="warning" className="text-[10px] bg-rose-50 text-rose-800 border-rose-200">ABSENT</Badge>
                </div>
                <div className="text-2xl font-bold text-rose-800 mt-1">
                  {historyData?.summary.absentCount ?? 0}
                </div>
                <p className="text-[11px] text-rose-700 mt-0.5">Recorded sessions missed</p>
              </div>
            </div>
          ) : reportSubTab === 'subject_summary' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Total Records Calculated
                </span>
                <div className="text-2xl font-bold text-stone-900 mt-1">
                  {subjectSummaryList.length}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">Subject-wise student percentage summaries</p>
              </div>

              <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    Attendance 75% or Higher
                  </span>
                  <Badge variant="success" className="text-[10px]">SATISFACTORY</Badge>
                </div>
                <div className="text-2xl font-bold text-emerald-800 mt-1">
                  {subjectSummaryList.filter((s) => s.combined.percentage !== null && s.combined.percentage >= attendanceThreshold).length}
                </div>
                <p className="text-[11px] text-emerald-700 mt-0.5">Records meeting {attendanceThreshold}% threshold</p>
              </div>

              <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-800">
                    Attendance Below {attendanceThreshold}%
                  </span>
                  <Badge variant="warning" className="text-[10px] bg-rose-50 text-rose-800 border-rose-200">SHORTAGE</Badge>
                </div>
                <div className="text-2xl font-bold text-rose-800 mt-1">
                  {subjectSummaryList.filter((s) => s.combined.percentage !== null && s.combined.percentage < attendanceThreshold).length}
                </div>
                <p className="text-[11px] text-rose-700 mt-0.5">Records below {attendanceThreshold}% threshold</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">
                  Total Missing Sessions
                </span>
                <div className="text-2xl font-bold text-amber-900 mt-1">
                  {totalMissingSessionsCount}
                </div>
                <p className="text-[11px] text-amber-800 mt-0.5">Scheduled classes awaiting attendance entry</p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Subjects Affected
                </span>
                <div className="text-2xl font-bold text-stone-900 mt-1">
                  {new Set(missingSessionsList.map((m) => m.subjectId)).size}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">Distinct subjects with unrecorded classes</p>
              </div>

              <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-900">
                  Audit Policy Enforcement
                </span>
                <div className="text-xs font-bold text-emerald-800 mt-1.5 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> Excluded from Denominators
                </div>
                <p className="text-[11px] text-emerald-700 mt-0.5">Unrecorded classes never penalize students</p>
              </div>
            </div>
          )}

          {/* Unrecorded Class Policy Note for Student History */}
          {reportSubTab === 'student_history' && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 flex items-center gap-2">
              <span className="font-bold text-amber-800 shrink-0">Note:</span>
              <span>
                Only classes where attendance has been officially recorded by administrative staff are included in this history. Unrecorded scheduled classes are excluded and never treated as present or absent.
              </span>
            </div>
          )}

          {/* Quick Table Filter Input */}
          <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-xs">
            <Search className="w-4 h-4 text-stone-400 shrink-0" />
            <input
              type="text"
              placeholder={
                reportSubTab === 'register'
                  ? 'Filter by date, weekday, subject name, or class type...'
                  : reportSubTab === 'absences'
                  ? 'Filter by roll number, student name, university reg no, or subject...'
                  : reportSubTab === 'student_history'
                  ? 'Filter student history by date, weekday, subject name, code, or class type...'
                  : reportSubTab === 'subject_summary'
                  ? 'Filter student, roll number, or subject in summary table...'
                  : 'Filter missing sessions by date, subject, weekday, or class type...'
              }
              value={reportFilterQuery}
              onChange={(e) => setReportFilterQuery(e.target.value)}
              className="w-full text-xs bg-transparent border-none outline-none text-stone-900 placeholder-stone-400"
            />
            {reportFilterQuery && (
              <button
                onClick={() => setReportFilterQuery('')}
                className="text-xs text-stone-400 hover:text-stone-700 px-1 font-bold"
              >
                &times;
              </button>
            )}
          </div>

          {/* Tables Rendering */}
          {isLoadingReports || (reportSubTab === 'student_history' && isLoadingHistory) ? (
            <div className="text-center py-16 text-stone-500 text-xs">Loading attendance report...</div>
          ) : reportSubTab === 'register' ? (
            /* DATE-WISE REGISTER TABLE */
            <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-[#FAF3DC]/60 text-stone-800 border-b border-stone-200 uppercase font-semibold text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date & Day</th>
                      <th className="py-3 px-4">Time Slot</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Class Type</th>
                      <th className="py-3 px-4">Sub-Batch</th>
                      <th className="py-3 px-4 text-center">Eligible</th>
                      <th className="py-3 px-4 text-center">Present</th>
                      <th className="py-3 px-4 text-center">Absent</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(() => {
                      const items = (registerReport?.items || []).filter((item) => {
                        if (!reportFilterQuery) return true;
                        const q = reportFilterQuery.toLowerCase();
                        return (
                          item.date.includes(q) ||
                          item.weekday.toLowerCase().includes(q) ||
                          item.subjectName.toLowerCase().includes(q) ||
                          (item.subjectCode && item.subjectCode.toLowerCase().includes(q)) ||
                          item.classType.toLowerCase().includes(q) ||
                          (item.subBatchCode && item.subBatchCode.toLowerCase().includes(q))
                        );
                      });

                      if (items.length === 0) {
                        return (
                          <tr>
                            <td colSpan={10} className="text-center py-12 text-stone-400 text-xs">
                              No scheduled classes found matching the selected filters.
                            </td>
                          </tr>
                        );
                      }

                      return items.map((item, idx) => {
                        const isRecorded = item.status === 'RECORDED';
                        return (
                          <tr key={`${item.slotId}-${item.date}-${idx}`} className="hover:bg-stone-50 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-semibold text-stone-900">{item.date}</span>
                              <span className="block text-[10px] text-stone-500">{item.weekday}</span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-medium text-stone-700">
                              {item.startTime} - {item.endTime}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-stone-900">
                                {getSlotDisplaySubject(item.subjectName, item.classType)}
                              </span>
                              {item.subjectCode ? (
                                <span className="block text-[10px] text-stone-500 font-mono">{item.subjectCode}</span>
                              ) : (
                                <span className="block text-[9px] text-stone-400 italic">Non-Curriculum</span>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <Badge variant="neutral" className="text-[10px] font-bold">
                                {item.classType}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {item.subBatchCode ? (
                                <Badge variant="neutral" className="text-[10px]">
                                  {item.subBatchCode}
                                </Badge>
                              ) : (
                                <span className="text-stone-400 text-[11px]">Whole Batch</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-medium text-stone-800">
                              {item.eligibleCount}
                            </td>
                            <td className="py-3 px-4 text-center font-bold">
                              {isRecorded ? (
                                <span className="text-emerald-700">{item.presentCount}</span>
                              ) : (
                                <span className="text-stone-300" title="Not recorded">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-bold">
                              {isRecorded ? (
                                <span className={item.absentCount && item.absentCount > 0 ? 'text-rose-700' : 'text-stone-500'}>
                                  {item.absentCount}
                                </span>
                              ) : (
                                <span className="text-stone-300" title="Not recorded">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <Badge variant={isRecorded ? 'success' : 'warning'} className="text-[10px]">
                                {item.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {isRecorded ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedClassForAbsentees(item)}
                                  className="text-xs flex items-center gap-1 border-stone-200 hover:bg-stone-100"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#4B2E2E]" /> View Absentees
                                </Button>
                              ) : (
                                <span className="text-[11px] text-stone-400 italic">Not Recorded</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : reportSubTab === 'absences' ? (
            /* ABSENT STUDENT REPORT TABLE */
            <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-[#FAF3DC]/60 text-stone-800 border-b border-stone-200 uppercase font-semibold text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date & Day</th>
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Univ Reg No</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Class Time</th>
                      <th className="py-3 px-4">Class Type</th>
                      <th className="py-3 px-4">Sub-Batch</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(() => {
                      const absences = (absencesReport?.absences || []).filter((a) => {
                        if (!reportFilterQuery) return true;
                        const q = reportFilterQuery.toLowerCase();
                        return (
                          a.rollNumber.toLowerCase().includes(q) ||
                          a.studentName.toLowerCase().includes(q) ||
                          (a.permanentUniversityNumber && a.permanentUniversityNumber.toLowerCase().includes(q)) ||
                          a.subjectName.toLowerCase().includes(q) ||
                          (a.subjectCode && a.subjectCode.toLowerCase().includes(q)) ||
                          a.date.includes(q)
                        );
                      });

                      if (absences.length === 0) {
                        return (
                          <tr>
                            <td colSpan={9} className="text-center py-12 text-stone-400 text-xs">
                              No absent students recorded matching the selected filters.
                            </td>
                          </tr>
                        );
                      }

                      return absences.map((a) => (
                        <tr key={`${a.absenceId}-${a.sessionId}-${a.studentId}`} className="hover:bg-stone-50 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold text-stone-900">{a.date}</span>
                            <span className="block text-[10px] text-stone-500">{a.weekday}</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-[#4B2E2E]">{a.rollNumber}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-stone-900">{a.studentName}</span>
                            <span className="block text-[10px] text-stone-400 font-mono">{a.studentIdNumber}</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-stone-600">
                            {a.permanentUniversityNumber || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-stone-900">{a.subjectName}</span>
                            <span className="block text-[10px] text-stone-500 font-mono">{a.subjectCode}</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-stone-700">
                            {a.startTime} - {a.endTime}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge variant="neutral" className="text-[10px] font-bold">
                              {a.classType}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {a.subBatchCode ? (
                              <Badge variant="neutral" className="text-[10px]">
                                {a.subBatchCode}
                              </Badge>
                            ) : (
                              <span className="text-stone-400 text-[11px]">Whole Batch</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelectStudentForHistory(a.studentId, reportBatchId)}
                              className="text-xs flex items-center gap-1 border-stone-200 hover:bg-stone-100 text-[#4B2E2E]"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-[#4B2E2E]" /> View History
                            </Button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : reportSubTab === 'student_history' ? (
            /* STUDENT-WISE ATTENDANCE HISTORY VIEW */
            <div className="space-y-4">
              {!historyData?.student ? (
                <div className="bg-white rounded-xl border border-stone-200 p-12 text-center shadow-xs">
                  <UserCheck className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-stone-800">Select a Student</h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                    Please select an academic batch and a student from the filter panel above to inspect their full recorded attendance history.
                  </p>
                </div>
              ) : (
                <>
                  {/* Student Header Profile Card */}
                  <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#FAF3DC] text-[#4B2E2E] flex items-center justify-center font-bold text-lg border border-[#4B2E2E]/20 shrink-0">
                        {historyData.student.rollNumber || 'ST'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-stone-900">{historyData.student.name}</h2>
                          <Badge variant="neutral" className="font-mono text-[10px]">
                            Roll #{historyData.student.rollNumber}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 mt-1">
                          <span>
                            <strong>Univ Reg No:</strong>{' '}
                            <span className="font-mono text-stone-800">
                              {historyData.student.permanentUniversityNumber || 'Not assigned'}
                            </span>
                          </span>
                          <span>
                            <strong>Student ID:</strong>{' '}
                            <span className="font-mono text-stone-800">{historyData.student.studentIdNumber}</span>
                          </span>
                          <span>
                            <strong>Batch:</strong>{' '}
                            <span className="font-semibold text-stone-800">{historyData.student.batchCode}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-1">
                      <span className="text-[11px] font-semibold uppercase text-stone-500 tracking-wider">
                        Assigned Scope
                      </span>
                      {historyData.student.subBatches && historyData.student.subBatches.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {historyData.student.subBatches.map((sb) => (
                            <Badge key={sb.id} variant="neutral" className="text-[10px] font-semibold">
                              {sb.code} ({sb.name})
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-stone-600 bg-stone-100 px-2.5 py-1 rounded-md">
                          Whole Batch
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Student History Table */}
                  <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-stone-700">
                        <thead className="bg-[#FAF3DC]/60 text-stone-800 border-b border-stone-200 uppercase font-semibold text-[11px] tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Date & Day</th>
                            <th className="py-3 px-4">Scheduled Time</th>
                            <th className="py-3 px-4">Subject</th>
                            <th className="py-3 px-4">Class Type</th>
                            <th className="py-3 px-4">Scope</th>
                            <th className="py-3 px-4 text-center">Attendance Status</th>
                            <th className="py-3 px-4 text-right">Recorded By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {(() => {
                            const items = historyData.history.filter((h) => {
                              if (!reportFilterQuery) return true;
                              const q = reportFilterQuery.toLowerCase();
                              return (
                                h.date.includes(q) ||
                                h.weekday.toLowerCase().includes(q) ||
                                h.subjectName.toLowerCase().includes(q) ||
                                (h.subjectCode && h.subjectCode.toLowerCase().includes(q)) ||
                                h.classType.toLowerCase().includes(q) ||
                                h.status.toLowerCase().includes(q)
                              );
                            });

                            if (items.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={7} className="text-center py-12 text-stone-400 text-xs">
                                    No recorded attendance entries found for the selected filters.
                                  </td>
                                </tr>
                              );
                            }

                            return items.map((h, idx) => {
                              const isPresent = h.status === 'PRESENT';
                              return (
                                <tr key={`${h.sessionId}-${idx}`} className="hover:bg-stone-50 transition-colors">
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span className="font-semibold text-stone-900">{h.date}</span>
                                    <span className="block text-[10px] text-stone-500">{h.weekday}</span>
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap font-medium text-stone-700">
                                    {h.startTime} - {h.endTime}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="font-semibold text-stone-900">
                                      {getSlotDisplaySubject(h.subjectName, h.classType)}
                                    </span>
                                    {h.subjectCode ? (
                                      <span className="block text-[10px] text-stone-500 font-mono">{h.subjectCode}</span>
                                    ) : (
                                      <span className="block text-[9px] text-stone-400 italic">Non-Curriculum</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <Badge variant="neutral" className="text-[10px] font-bold">
                                      {h.classType}
                                    </Badge>
                                    {h.isAcademic === false && (
                                      <span className="block text-[9px] text-stone-400 font-medium mt-0.5">
                                        Excluded from %
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    {h.subBatchCode ? (
                                      <Badge variant="neutral" className="text-[10px]">
                                        {h.subBatchCode}
                                      </Badge>
                                    ) : (
                                      <span className="text-stone-400 text-[11px]">Whole Batch</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                        isPresent
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                                      }`}
                                    >
                                      {isPresent ? (
                                        <>
                                          <UserCheck className="w-3.5 h-3.5 text-emerald-700" /> PRESENT
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="w-3.5 h-3.5 text-rose-700" /> ABSENT
                                        </>
                                      )}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <span className="font-medium text-stone-800">{h.recorderName || 'Office Admin'}</span>
                                    <span className="block text-[10px] text-stone-400">
                                      {h.recordedAt ? new Date(h.recordedAt).toLocaleDateString() : '-'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : reportSubTab === 'subject_summary' ? (
            /* SUBJECT-WISE ATTENDANCE PERCENTAGES TABLE */
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-800 shrink-0">Note:</span>
                  <span>
                    Percentages are calculated strictly from conducted and recorded sessions for which each student was eligible. Unrecorded classes are excluded. Combined attendance is computed from total combined present count divided by total combined conducted count across LT, NLT, and NLP.
                  </span>
                </div>
                <Badge variant="gold" className="text-[10px] shrink-0">
                  {reportSubjectId ? 'Subject Overview' : 'Batch Overview (All Subjects)'}
                </Badge>
              </div>

              <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-700">
                    <thead className="bg-[#FAF3DC]/60 text-stone-800 border-b border-stone-200 uppercase font-semibold text-[11px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Roll & Student</th>
                        <th className="py-3 px-4">Univ Reg No</th>
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4 text-center">LT (P / Rec)</th>
                        <th className="py-3 px-4 text-center">NLT (P / Rec)</th>
                        <th className="py-3 px-4 text-center">NLP (P / Rec)</th>
                        <th className="py-3 px-4 text-center bg-[#FAF3DC]">Combined % (LT+NLT+NLP)</th>
                        <th className="py-3 px-4 text-center">OTHER (P / Rec)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(() => {
                        const items = subjectSummaryList.filter((item) => {
                          if (!reportFilterQuery) return true;
                          const q = reportFilterQuery.toLowerCase();
                          return (
                            item.rollNumber.toLowerCase().includes(q) ||
                            item.studentName.toLowerCase().includes(q) ||
                            (item.permanentUniversityNumber && item.permanentUniversityNumber.toLowerCase().includes(q)) ||
                            item.subjectCode.toLowerCase().includes(q) ||
                            item.subjectName.toLowerCase().includes(q)
                          );
                        });

                        if (isLoadingSubjectSummary) {
                          return (
                            <tr>
                              <td colSpan={8} className="text-center py-12 text-stone-400 text-xs">
                                Calculating subject-wise attendance percentages...
                              </td>
                            </tr>
                          );
                        }

                        if (items.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="text-center py-12 text-stone-400 text-xs">
                                No attendance records found matching the selected filters.
                              </td>
                            </tr>
                          );
                        }

                        return items.map((item, idx) => {
                          const renderPercentageCell = (cat: { recorded: number; present: number; percentage: number | null }) => {
                            if (cat.recorded === 0 || cat.percentage === null) {
                              return <span className="text-stone-400 italic">N/A</span>;
                            }
                            const pct = cat.percentage;
                            let colorClass = 'text-emerald-800 bg-emerald-50 border-emerald-200';
                            if (pct < attendanceThreshold) {
                              colorClass = 'text-rose-800 bg-rose-50 border-rose-200';
                            } else if (pct < attendanceThreshold + 5) {
                              colorClass = 'text-amber-800 bg-amber-50 border-amber-200';
                            }
                            return (
                              <div className="space-y-0.5">
                                <span className="font-semibold text-stone-900">{cat.present}/{cat.recorded}</span>
                                <span className={`block text-[10px] font-bold px-1.5 py-0.5 rounded border ${colorClass}`}>
                                  {pct.toFixed(2)}%
                                </span>
                              </div>
                            );
                          };

                          const renderCombinedCell = (cat: { recorded: number; present: number; percentage: number | null }) => {
                            if (cat.recorded === 0 || cat.percentage === null) {
                              return <span className="text-stone-400 italic font-semibold">N/A</span>;
                            }
                            const pct = cat.percentage;
                            let colorClass = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                            if (pct < attendanceThreshold) {
                              colorClass = 'bg-rose-100 text-rose-900 border-rose-300';
                            } else if (pct < attendanceThreshold + 5) {
                              colorClass = 'bg-amber-100 text-amber-900 border-amber-300';
                            }
                            return (
                              <div className="space-y-0.5">
                                <span className="font-bold text-stone-900">{cat.present}/{cat.recorded}</span>
                                <span className={`inline-block text-[11px] font-extrabold px-2 py-0.5 rounded-full border shadow-2xs ${colorClass}`}>
                                  {pct.toFixed(2)}%
                                </span>
                              </div>
                            );
                          };

                          return (
                            <tr key={`${item.studentId}-${item.subjectId}-${idx}`} className="hover:bg-stone-50 transition-colors">
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="font-bold text-stone-900">{item.studentName}</span>
                                <span className="block text-[10px] text-stone-500 font-mono">
                                  Roll #{item.rollNumber}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-stone-600 whitespace-nowrap">
                                {item.permanentUniversityNumber || 'Not assigned'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-semibold text-stone-900">{item.subjectName}</span>
                                <span className="block text-[10px] text-stone-500 font-mono">{item.subjectCode}</span>
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {renderPercentageCell(item.lt)}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {renderPercentageCell(item.nlt)}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {renderPercentageCell(item.nlp)}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap bg-[#FAF3DC]/30">
                                {renderCombinedCell(item.combined)}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {renderPercentageCell(item.other)}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* MISSING ATTENDANCE SESSIONS TABLE */
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  These scheduled timetable classes have no recorded attendance in the selected period. Unrecorded classes are strictly excluded from student attendance denominators and are NOT treated as absences.
                </span>
              </div>

              <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-700">
                    <thead className="bg-[#FAF3DC]/60 text-stone-800 border-b border-stone-200 uppercase font-semibold text-[11px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Date & Day</th>
                        <th className="py-3 px-4">Time Slot</th>
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4">Class Type</th>
                        <th className="py-3 px-4">Sub-Batch Scope</th>
                        <th className="py-3 px-4">Timetable Version</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(() => {
                        const items = missingSessionsList.filter((m) => {
                          if (!reportFilterQuery) return true;
                          const q = reportFilterQuery.toLowerCase();
                          return (
                            m.date.includes(q) ||
                            m.weekday.toLowerCase().includes(q) ||
                            m.subjectCode.toLowerCase().includes(q) ||
                            m.subjectName.toLowerCase().includes(q) ||
                            m.classType.toLowerCase().includes(q) ||
                            (m.subBatchCode && m.subBatchCode.toLowerCase().includes(q)) ||
                            m.timetableVersionCode.toLowerCase().includes(q)
                          );
                        });

                        if (isLoadingMissingSessions) {
                          return (
                            <tr>
                              <td colSpan={7} className="text-center py-12 text-stone-400 text-xs">
                                Identifying scheduled sessions with missing attendance...
                              </td>
                            </tr>
                          );
                        }

                        if (items.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="text-center py-12 text-emerald-700 text-xs font-medium">
                                No missing attendance sessions found for the selected batch and date range. All scheduled classes have recorded attendance.
                              </td>
                            </tr>
                          );
                        }

                        return items.map((m, idx) => (
                          <tr key={`${m.slotId}-${m.date}-${idx}`} className="hover:bg-stone-50 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-bold text-stone-900">{m.date}</span>
                              <span className="block text-[10px] text-stone-500 font-medium">{m.weekday}</span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-medium text-stone-700">
                              {m.startTime} - {m.endTime}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-stone-900">{m.subjectName}</span>
                              <span className="block text-[10px] text-stone-500 font-mono">{m.subjectCode}</span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <Badge variant="neutral" className="text-[10px] font-bold">
                                {m.classType}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {m.subBatchCode ? (
                                <Badge variant="neutral" className="text-[10px]">
                                  {m.subBatchCode} ({m.subBatchName || ''})
                                </Badge>
                              ) : (
                                <span className="text-stone-400 text-[11px]">Whole Batch</span>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-stone-600">
                              {m.timetableVersionCode}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <AlertCircle className="w-3 h-3 text-amber-700" /> NOT RECORDED
                              </span>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'settings' ? (
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-xs">
          <h2 className="text-lg font-bold text-stone-900 mb-4">Attendance Settings</h2>
          <div className="max-w-md">
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Attendance Shortage Threshold (%)
            </label>
            <div className="flex gap-4">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={attendanceThreshold}
                onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#4B2E2E]"
              />
              <Button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/attendance/settings/threshold', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ threshold: attendanceThreshold }),
                    }).then(r => r.json());
                    if (res.success) {
                        setSuccessMsg('Threshold updated successfully.');
                        fetchAttendanceThreshold();
                    } else {
                        setErrorMsg(res.error || 'Failed to update threshold.');
                    }
                  } catch (e) {
                    setErrorMsg('Failed to update threshold.');
                  }
                }}
              >
                Save Threshold
              </Button>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Students with attendance below this percentage will be flagged with a shortage warning.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Batch Selector & Summary Bar */}
          <Card accentTop>
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Building2 className="w-5 h-5 text-[#4B2E2E] shrink-0" />
                  <div className="w-full md:w-72">
                    <label className="block text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Select Academic Batch
                    </label>
                    <select
                      value={selectedBatchId || ''}
                      onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:ring-2 focus:ring-[#4B2E2E]"
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}) — Prof Year {b.current_professional_year || 'N/A'} [{b.scheme_code}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedBatch && (
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5">
                      <span className="text-stone-500">Scheme:</span>{' '}
                      <span className="font-semibold text-stone-900">{selectedBatch.scheme_name}</span>
                    </div>
                    <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5">
                      <span className="text-stone-500">Professional Year:</span>{' '}
                      <span className="font-semibold text-stone-900">Year {selectedBatch.current_professional_year || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sub-Batches Section */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4B2E2E]" />
                <h3 className="text-sm font-bold text-stone-900">Batch Sub-Divisions (Sub-Batches)</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSubBatchModal(true)}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Sub-Batch
              </Button>
            </div>

            {subBatches.length === 0 ? (
              <p className="text-xs text-stone-500 italic">
                No sub-batches defined for this batch yet. Slots will apply to the entire batch by default.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subBatches.map((sb) => (
                  <div key={sb.id} className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs flex items-center gap-3">
                    <div>
                      <span className="font-bold text-stone-900">{sb.code}</span> — {sb.name}
                    </div>
                    <Badge variant="neutral" className="text-[10px]">
                      {sb.student_count || 0} students
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timetable Versions & Slot Management */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-stone-900">Timetable Versions & Weekly Schedule</h2>
                <p className="text-xs text-stone-500">
                  Timetables are batch-specific with effective dates. Versions locked by attendance cannot be edited.
                </p>
              </div>
              <Button
                onClick={() => setShowNewVersionModal(true)}
                className="bg-[#4B2E2E] hover:bg-[#382121] text-white text-xs font-medium"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Create Timetable Version
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-stone-500 text-xs">Loading timetable versions...</div>
            ) : versions.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-stone-500 text-xs space-y-3">
                  <Calendar className="w-10 h-10 mx-auto text-stone-400 stroke-1" />
                  <p>No timetable versions created for this batch yet.</p>
                  <Button onClick={() => setShowNewVersionModal(true)} variant="outline" size="sm" className="text-xs">
                    Create First Timetable Version
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {versions.map((ver) => {
                  const isLocked = ver.hasAttendance;
                  return (
                    <Card key={ver.id} accentTop={ver.is_active}>
                      <CardContent className="p-6 space-y-5">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-stone-200">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-stone-900">{ver.title}</h3>
                              <Badge variant={ver.is_active ? 'success' : 'neutral'} className="text-[10px]">
                                {ver.is_active ? 'Active Version' : 'Historical Version'}
                              </Badge>
                              {isLocked && (
                                <Badge variant="warning" className="text-[10px]">
                                  Locked by Attendance Records
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-stone-500 mt-1">
                              Version Code: <span className="font-semibold text-stone-700">{ver.version_code}</span> | Effective From: <span className="font-semibold text-stone-700">{ver.effective_from}</span> {ver.effective_to ? `to ${ver.effective_to}` : '(Ongoing)'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {!isLocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedVersionIdForSlot(ver.id);
                                  setShowAddSlotModal(true);
                                }}
                                className="text-xs"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add Slot
                              </Button>
                            )}
                            {!isLocked && versions.length > 1 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteVersion(ver.id)}
                                className="text-xs text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Weekly Matrix Preview */}
                        <div>
                          <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#4B2E2E]" /> Weekly Schedule Matrix Preview
                          </h4>

                          {ver.slots.length === 0 ? (
                            <p className="text-xs text-stone-400 italic bg-stone-50 p-4 rounded-lg text-center">
                              No slots added to this timetable version yet.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {WEEKDAYS.map((day) => {
                                const daySlots = ver.slots.filter((s) => s.weekday === day);
                                if (daySlots.length === 0) return null;
                                return (
                                  <div key={day} className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
                                    <h5 className="text-xs font-bold text-stone-800 uppercase tracking-wide border-b border-stone-200 pb-1.5 flex justify-between items-center">
                                      <span>{day}</span>
                                      <span className="text-[10px] text-stone-500 font-normal">{daySlots.length} slot(s)</span>
                                    </h5>
                                    <div className="space-y-2">
                                      {daySlots.map((slot) => (
                                        <div key={slot.id} className="bg-white border border-stone-200 rounded p-2.5 text-xs space-y-1 shadow-2xs relative group">
                                          <div className="flex justify-between items-start">
                                            <span className="font-semibold text-stone-900">
                                              {getSlotDisplaySubject(slot.subject_name, slot.class_type)}
                                            </span>
                                            <Badge variant="neutral" className="text-[10px]">
                                              {slot.class_type}
                                            </Badge>
                                          </div>
                                          <div className="text-[11px] text-stone-600 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3 text-stone-400" />
                                            <span>{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</span>
                                            {slot.sub_batch_code && (
                                              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 rounded text-[9px] font-medium ml-auto">
                                                Sub-Batch: {slot.sub_batch_code}
                                              </span>
                                            )}
                                          </div>
                                          {slot.week_pattern !== 'EVERY_WEEK' && (
                                            <div className="text-[10px] text-indigo-600 font-medium">
                                              Pattern: {slot.week_pattern === 'ODD_WEEKS' ? 'Odd Weeks Only' : 'Even Weeks Only'}
                                            </div>
                                          )}
                                          {slot.location_or_room && (
                                            <div className="text-[10px] text-stone-500">
                                              Room: {slot.location_or_room}
                                            </div>
                                          )}
                                          {!isLocked && (
                                            <button
                                              onClick={() => handleDeleteSlot(slot.id)}
                                              className="absolute top-2 right-2 text-stone-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                              title="Remove Slot"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance Taking Modal */}
      {showAttendanceModal && activeSlotForAttendance && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-stone-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start pb-3 border-b border-stone-200">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Take Attendance: {getSlotDisplaySubject(activeSlotForAttendance.subject_name, activeSlotForAttendance.class_type)}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Date: <span className="font-semibold text-stone-800">{attendanceDate}</span> | Time: {activeSlotForAttendance.start_time.slice(0, 5)} – {activeSlotForAttendance.end_time.slice(0, 5)} | Type: {activeSlotForAttendance.class_type}
                  {activeSlotForAttendance.sub_batch_code && ` | Sub-Batch: ${activeSlotForAttendance.sub_batch_code}`}
                </p>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="text-stone-400 hover:text-stone-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Student Search & Quick Stats */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search student by name or roll..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                />
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="bg-stone-100 px-2.5 py-1 rounded-md font-medium text-stone-700">
                  Total Eligible: {eligibleStudents.length}
                </span>
                <span className="bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md font-medium">
                  Present: {eligibleStudents.length - absentStudentIdsSet.size}
                </span>
                <span className="bg-rose-50 text-rose-800 px-2.5 py-1 rounded-md font-medium">
                  Absent: {absentStudentIdsSet.size}
                </span>
              </div>
            </div>

            {/* Student Absence Checkbox List */}
            <div className="flex-1 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100 max-h-96">
              {eligibleStudents.length === 0 ? (
                <div className="p-8 text-center text-stone-500 text-xs">No active students found for this batch/sub-batch.</div>
              ) : (
                eligibleStudents
                  .filter((st) => {
                    const q = studentSearchQuery.toLowerCase();
                    const name = st.full_name.toLowerCase();
                    const roll = (st.temporary_roll_number || st.student_id_number || '').toLowerCase();
                    return name.includes(q) || roll.includes(q);
                  })
                  .map((st) => {
                    const isAbsent = absentStudentIdsSet.has(st.id);
                    return (
                      <div
                        key={st.id}
                        onClick={() => {
                          const next = new Set(absentStudentIdsSet);
                          if (isAbsent) {
                            next.delete(st.id);
                          } else {
                            next.add(st.id);
                          }
                          setAbsentStudentIdsSet(next);
                        }}
                        className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isAbsent ? 'bg-rose-50/70 hover:bg-rose-50' : 'bg-white hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isAbsent}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                          <div>
                            <div className="font-bold text-stone-900">{st.full_name}</div>
                            <div className="text-[11px] text-stone-500">
                              Roll: <span className="font-semibold">{st.temporary_roll_number || st.student_id_number}</span>
                              {st.permanent_university_number && ` | Univ Reg: ${st.permanent_university_number}`}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isAbsent ? (
                            <Badge variant="warning" className="text-[10px]">ABSENT</Badge>
                          ) : (
                            <span className="text-[11px] text-emerald-700 font-medium">PRESENT (Default)</span>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAttendanceModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAttendanceSession}
                disabled={isSavingAttendance}
                className="bg-[#4B2E2E] hover:bg-[#382121] text-white text-xs"
              >
                {isSavingAttendance ? 'Saving Attendance...' : 'Save Attendance Session'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Timetable Version Modal */}
      {showNewVersionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900">Create Timetable Version</h3>
            <p className="text-xs text-stone-500">
              Define effective dates for the new timetable version. The existing timetable applies until the effective-from date.
            </p>

            <form onSubmit={handleCreateVersion} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Version Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. V2-2026"
                  value={newVersionCode}
                  onChange={(e) => setNewVersionCode(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Title / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Second Term Timetable 2026"
                  value={newVersionTitle}
                  onChange={(e) => setNewVersionTitle(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Effective From (Date)</label>
                  <input
                    type="date"
                    required
                    value={newEffectiveFrom}
                    onChange={(e) => setNewEffectiveFrom(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Effective To (Optional)</label>
                  <input
                    type="date"
                    value={newEffectiveTo}
                    onChange={(e) => setNewEffectiveTo(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewVersionModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#4B2E2E] hover:bg-[#382121] text-white text-xs"
                >
                  Create Version
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {showAddSlotModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900">Add Timetable Slot</h3>
            <p className="text-xs text-stone-500">
              Configure a lecture, practical (1-3 hours), or activity slot.
            </p>

            <form onSubmit={handleAddSlot} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Weekday</label>
                  <select
                    value={slotWeekday}
                    onChange={(e) => setSlotWeekday(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Class Type</label>
                  <select
                    value={slotClassType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSlotClassType(val);
                      if (isNonSubjectClassType(val, classTypes)) {
                        setSlotSubjectId('');
                      }
                    }}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                  >
                    {classTypes.map((ct) => (
                      <option key={ct.id} value={ct.abbreviation}>
                        {ct.abbreviation} — {ct.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={slotStartTime}
                    onChange={(e) => setSlotStartTime(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">End Time (Supports 1-3 hr block)</label>
                  <input
                    type="time"
                    required
                    value={slotEndTime}
                    onChange={(e) => setSlotEndTime(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                  />
                </div>
              </div>

              {isNonSubjectClassType(slotClassType, classTypes) ? (
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-700">Subject Not Required</span>
                    <span className="text-[10px] bg-stone-200 text-stone-700 font-bold px-2 py-0.5 rounded">
                      Non-Curriculum Activity
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Mentor-Mentee, Sports, and Library sessions are non-academic institutional activities and do not require a curriculum subject. They are tracked separately and excluded from academic attendance percentages.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Subject <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={slotSubjectId}
                    onChange={(e) => setSlotSubjectId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                  >
                    <option value="">Select curriculum subject...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) — Year {s.professional_year}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Sub-Batch Scope (Optional)</label>
                  <select
                    value={slotSubBatchId}
                    onChange={(e) => setSlotSubBatchId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                  >
                    <option value="">Whole Batch (All Students)</option>
                    {subBatches.map((sb) => (
                      <option key={sb.id} value={sb.id}>{sb.code} — {sb.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Weekly Pattern</label>
                  <select
                    value={slotWeekPattern}
                    onChange={(e) => setSlotWeekPattern(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                  >
                    <option value="EVERY_WEEK">Every Week</option>
                    <option value="ODD_WEEKS">Odd Weeks Only</option>
                    <option value="EVEN_WEEKS">Even Weeks Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Location / Room (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Lecture Hall 1 / Dissection Hall"
                  value={slotLocation}
                  onChange={(e) => setSlotLocation(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddSlotModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#4B2E2E] hover:bg-[#382121] text-white text-xs"
                >
                  Add Slot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Sub-Batch Modal */}
      {showSubBatchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900">Add Batch Sub-Division</h3>
            <p className="text-xs text-stone-500">
              Create a sub-batch (e.g., Batch A, Batch B) for practical or clinical group rotations.
            </p>

            <form onSubmit={handleSaveSubBatch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Sub-Batch Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A"
                  value={subBatchCode}
                  onChange={(e) => setSubBatchCode(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Sub-Batch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Batch A (Roll 1-50)"
                  value={subBatchName}
                  onChange={(e) => setSubBatchName(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Roll number range"
                  value={subBatchDesc}
                  onChange={(e) => setSubBatchDesc(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#4B2E2E]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSubBatchModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#4B2E2E] hover:bg-[#382121] text-white text-xs"
                >
                  Save Sub-Batch
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Absentees Modal */}
      {selectedClassForAbsentees && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-stone-200">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Absent Students Record
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {selectedClassForAbsentees.subjectName} ({selectedClassForAbsentees.subjectCode})
                </p>
              </div>
              <button
                onClick={() => setSelectedClassForAbsentees(null)}
                className="text-stone-400 hover:text-stone-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-stone-500">Date:</span>{' '}
                  <span className="font-semibold text-stone-900">{selectedClassForAbsentees.date} ({selectedClassForAbsentees.weekday})</span>
                </div>
                <div>
                  <span className="text-stone-500">Time:</span>{' '}
                  <span className="font-semibold text-stone-900">{selectedClassForAbsentees.startTime} - {selectedClassForAbsentees.endTime}</span>
                </div>
                <div>
                  <span className="text-stone-500">Class Type:</span>{' '}
                  <span className="font-semibold text-stone-900">{selectedClassForAbsentees.classType}</span>
                </div>
                <div>
                  <span className="text-stone-500">Scope:</span>{' '}
                  <span className="font-semibold text-stone-900">{selectedClassForAbsentees.subBatchCode || 'Whole Batch'}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-stone-200 flex justify-between text-[11px] text-stone-600">
                <span>Eligible: <strong className="text-stone-900">{selectedClassForAbsentees.eligibleCount}</strong></span>
                <span>Present: <strong className="text-emerald-700">{selectedClassForAbsentees.presentCount}</strong></span>
                <span>Absent: <strong className="text-rose-700">{selectedClassForAbsentees.absentCount}</strong></span>
              </div>
            </div>

            {selectedClassForAbsentees.absentStudents.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg text-xs text-center">
                <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                <span className="font-bold">100% Attendance:</span> All {selectedClassForAbsentees.eligibleCount} eligible students were present. Zero absences were recorded for this session.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-stone-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px] uppercase">
                    <tr>
                      <th className="py-2 px-3">Roll No</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Univ Reg No</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {selectedClassForAbsentees.absentStudents.map((s) => (
                      <tr key={s.studentId} className="hover:bg-stone-50">
                        <td className="py-2 px-3 font-mono font-bold text-[#4B2E2E]">
                          {s.rollNumber}
                        </td>
                        <td className="py-2 px-3 font-medium text-stone-900">
                          {s.studentName}
                          <span className="block text-[10px] text-stone-400 font-mono">{s.studentIdNumber}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-stone-600">
                          {s.permanentUniversityNumber || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedClassForAbsentees.recorderName && (
              <p className="text-[11px] text-stone-400 text-right">
                Recorded by {selectedClassForAbsentees.recorderName} on {selectedClassForAbsentees.recordedAt ? new Date(selectedClassForAbsentees.recordedAt).toLocaleDateString() : '-'}
              </p>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedClassForAbsentees(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
