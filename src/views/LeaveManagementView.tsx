import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { FormField, Input, Select, Textarea } from '../components/ui/FormField';
import { PageHeader } from '../components/ui/PageHeader';
import { FacultyPersonalReport } from '../components/attendance/FacultyPersonalReport';
import { PrincipalFacultyReports } from '../components/attendance/PrincipalFacultyReports';
import { InstitutionalHolidaysWorkspace } from '../components/attendance/InstitutionalHolidaysWorkspace';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  UserX,
  FileText,
  Send,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Plus,
  Trash2,
  BellRing,
  Award,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Settings,
} from 'lucide-react';

export interface LeaveCategoryInfo {
  code: string;
  name: string;
  entitlementDays: number;
  maxDaysPerApp: number | null;
  minDaysPerApp: number | null;
  maxDailyCapacity: number | null;
  minGapMonths?: number;
  requiresReason: boolean;
  description: string;
}

export interface LeaveBalance {
  categoryCode: string;
  categoryName: string;
  entitlementDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  maxDaysPerApp: number | null;
  minDaysPerApp: number | null;
  maxDailyCapacity: number | null;
  requiresReason: boolean;
  description: string;
}

export interface LeaveApplication {
  id: number;
  teacher_id: number;
  teacher_name?: string;
  teacher_designation?: string;
  department_name?: string;
  leave_category: 'CL' | 'EL' | 'SPECIAL_SL' | 'PATERNITY' | 'MATERNITY';
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  submitted_at: string;
  decided_by: number | null;
  decided_at: string | null;
  decision_remarks: string | null;
  decider_name?: string | null;
}

export interface DailyTeacherStatus {
  teacherId: number;
  teacherName: string;
  employeeCode: string | null;
  designation: string;
  departmentName: string | null;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'UNRECORDED';
  recordedReason: string | null;
  recordedBy: string | null;
  recordedAt: string | null;
  approvedLeave: {
    id: number;
    leaveCategory: string;
    startDate: string;
    endDate: string;
    reason: string;
    decisionRemarks: string | null;
    decidedByName: string | null;
  } | null;
  pendingLeave: {
    id: number;
    leaveCategory: string;
    startDate: string;
    endDate: string;
    reason: string;
  } | null;
  rejectedLeave: {
    id: number;
    leaveCategory: string;
    startDate: string;
    endDate: string;
    reason: string;
    decisionRemarks: string | null;
  } | null;
}

export const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const calculateDays = (start: string, end: string) => {
  if (!start || !end) return 1;
  const [sy, sm, sd] = start.split('T')[0].split('-').map(Number);
  const [ey, em, ed] = end.split('T')[0].split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 1;
  const diff = Math.round((new Date(Date.UTC(ey, em - 1, ed)).getTime() - new Date(Date.UTC(sy, sm - 1, sd)).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
};

export interface LeaveManagementViewProps {
  initialTab?: 'daily' | 'applications' | 'reports' | 'monthly' | 'holidays' | 'apply';
}

export const LeaveManagementView: React.FC<LeaveManagementViewProps> = ({ initialTab = 'daily' }) => {
  const { user, csrfToken } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL' || user?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<'daily' | 'applications' | 'reports' | 'monthly' | 'holidays'>(
    initialTab === 'applications'
      ? 'applications'
      : initialTab === 'reports'
      ? 'reports'
      : initialTab === 'monthly'
      ? 'monthly'
      : initialTab === 'holidays'
      ? 'holidays'
      : 'daily'
  );

  const [facultyTab, setFacultyTab] = useState<'apply' | 'applications' | 'reports'>(
    initialTab === 'applications'
      ? 'applications'
      : initialTab === 'reports'
      ? 'reports'
      : 'apply'
  );

  // Notifications / Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Categories & Settings
  const [categories, setCategories] = useState<LeaveCategoryInfo[]>([]);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState<number>(20);
  const [minStartDate, setMinStartDate] = useState<string>('');
  const [maxStartDate, setMaxStartDate] = useState<string>('');

  // Tab 1: Daily Attendance States
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState<{
    date: string;
    summary: {
      totalTeachers: number;
      presentCount: number;
      absentCount: number;
      onLeaveCount: number;
      pendingLeaveCount: number;
      unrecordedCount: number;
    };
    teachers: DailyTeacherStatus[];
  } | null>(null);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [dailySearch, setDailySearch] = useState('');
  const [dailyDeptFilter, setDailyDeptFilter] = useState('ALL');
  const [dailyStatusFilter, setDailyStatusFilter] = useState('ALL');

  // Mark Absent Modal State
  const [markAbsentTeacher, setMarkAbsentTeacher] = useState<DailyTeacherStatus | null>(null);
  const [markAbsentReason, setMarkAbsentReason] = useState<string>('');
  const [isSavingDaily, setIsSavingDaily] = useState(false);

  // Tab 2: Leave Applications States
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [appSearch, setAppSearch] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('ALL');
  const [appCategoryFilter, setAppCategoryFilter] = useState('ALL');

  // Faculty Apply Form
  const [applyCategory, setApplyCategory] = useState<string>('CL');
  const [applyStartDate, setApplyStartDate] = useState<string>('');
  const [applyEndDate, setApplyEndDate] = useState<string>('');
  const [applyReason, setApplyReason] = useState<string>('');
  const [isSubmittingApply, setIsSubmittingApply] = useState(false);

  // Decision Remarks
  const [decisionRemarksMap, setDecisionRemarksMap] = useState<Record<number, string>>({});
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<number | null>(null);

  // Advance Window Setting Modal (Principal)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newMaxAdvanceDays, setNewMaxAdvanceDays] = useState<number>(20);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // 1. Fetch Categories & Settings
  const fetchSettingsAndCategories = useCallback(async () => {
    try {
      const [catRes, setRes] = await Promise.all([
        fetch('/api/leave/categories'),
        fetch('/api/leave/settings'),
      ]);
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }
      if (setRes.ok) {
        const setData = await setRes.json();
        setMaxAdvanceDays(setData.maxAdvanceDays || 20);
        setMinStartDate(setData.minStartDate || '');
        setMaxStartDate(setData.maxStartDate || '');
      }
    } catch (err) {
      console.error('Failed to load leave settings or categories:', err);
    }
  }, []);

  // 2. Fetch Daily Attendance
  const fetchDailyAttendance = useCallback(async (dateStr: string) => {
    setIsLoadingDaily(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/attendance/daily?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setDailyData(data);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to fetch daily attendance');
      }
    } catch {
      setErrorMsg('Error loading daily teacher attendance records');
    } finally {
      setIsLoadingDaily(false);
    }
  }, []);

  // 3. Fetch Applications
  const fetchApplications = useCallback(async () => {
    setIsLoadingApps(true);
    try {
      const endpoint = isPrincipal ? '/api/leave/all-applications' : '/api/leave/my-applications';
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setIsLoadingApps(false);
    }
  }, [isPrincipal]);

  // 4. Save Advance Window Settings (Principal)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = Number(newMaxAdvanceDays);
    if (isNaN(days) || days < 1 || days > 365) {
      setErrorMsg('Maximum advance window must be a positive number of days (1-365).');
      return;
    }
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/leave/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ maxAdvanceDays: days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update leave settings');
      setMaxAdvanceDays(data.maxAdvanceDays);
      setShowSettingsModal(false);
      setSuccessMsg(`Maximum advance leave application window updated to ${data.maxAdvanceDays} days.`);
      fetchSettingsAndCategories();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update leave settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 5. Cancel Leave Application (Faculty)
  const handleCancelApplication = async (appId: number) => {
    if (!confirm('Are you sure you want to cancel this pending leave application?')) return;
    try {
      const res = await fetch(`/api/leave/applications/${appId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel application');
      setSuccessMsg('Leave application cancelled successfully.');
      fetchApplications();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel application.');
    }
  };

  useEffect(() => {
    fetchSettingsAndCategories();
    fetchApplications();
    if (isPrincipal) {
      fetchDailyAttendance(selectedDate);
    }
  }, [
    fetchSettingsAndCategories,
    fetchApplications,
    fetchDailyAttendance,
    isPrincipal,
    selectedDate,
  ]);

  // Save Daily Attendance Entry
  // Save Absent Entry
  const handleSaveAbsentEntry = async () => {
    if (!markAbsentTeacher || !selectedDate) return;
    setIsSavingDaily(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/attendance/daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          attendanceDate: selectedDate,
          entries: [
            {
              teacherId: markAbsentTeacher.teacherId,
              status: 'ABSENT',
              recordedReason: markAbsentReason.trim() || null,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark absence');

      setSuccessMsg(`Marked ${markAbsentTeacher.teacherName} as ABSENT.`);
      setMarkAbsentTeacher(null);
      setMarkAbsentReason('');
      fetchDailyAttendance(selectedDate);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to mark absence');
    } finally {
      setIsSavingDaily(false);
    }
  };

  // Restore Default Present Status
  const handleRestorePresent = async (teacher: DailyTeacherStatus) => {
    if (!selectedDate) return;
    setIsSavingDaily(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/attendance/daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          attendanceDate: selectedDate,
          entries: [
            {
              teacherId: teacher.teacherId,
              status: 'PRESENT',
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore present status');

      setSuccessMsg(`Restored default PRESENT status for ${teacher.teacherName}.`);
      fetchDailyAttendance(selectedDate);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore present status');
    } finally {
      setIsSavingDaily(false);
    }
  };

  // Submit Leave Application
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!applyStartDate || !applyEndDate || !applyReason.trim()) {
      setErrorMsg('Start date, end date, and reason are required.');
      return;
    }

    setIsSubmittingApply(true);
    try {
      const res = await fetch('/api/leave/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          leaveCategory: applyCategory,
          startDate: applyStartDate,
          endDate: applyEndDate,
          reason: applyReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit leave application');

      setSuccessMsg(`Leave application submitted successfully for ${data.leaveCategory} (${data.durationDays} days).`);
      setApplyStartDate('');
      setApplyEndDate('');
      setApplyReason('');
      fetchApplications();
      if (isPrincipal) {
        fetchDailyAttendance(selectedDate);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsSubmittingApply(false);
    }
  };

  // Decide Application (Approve / Reject)
  const handleDecideApplication = async (appId: number, status: 'APPROVED' | 'REJECTED') => {
    setIsSubmittingDecision(appId);
    setErrorMsg(null);
    setSuccessMsg(null);

    const remarks = decisionRemarksMap[appId] || '';

    try {
      const res = await fetch(`/api/leave/${appId}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ status, remarks }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process decision');

      setSuccessMsg(`Leave application ${status.toLowerCase()} successfully.`);
      fetchApplications();
      fetchDailyAttendance(selectedDate);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsSubmittingDecision(null);
    }
  };

  // Helper date shift
  const shiftDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    setSelectedDate(dt.toISOString().split('T')[0]);
  };

  // Filtered teachers list for daily tracker
  const filteredDailyTeachers = (dailyData?.teachers || []).filter((t) => {
    const matchesSearch =
      t.teacherName.toLowerCase().includes(dailySearch.toLowerCase()) ||
      (t.employeeCode && t.employeeCode.toLowerCase().includes(dailySearch.toLowerCase())) ||
      (t.departmentName && t.departmentName.toLowerCase().includes(dailySearch.toLowerCase()));

    const matchesDept = dailyDeptFilter === 'ALL' || t.departmentName === dailyDeptFilter;
    const matchesStatus =
      dailyStatusFilter === 'ALL' ||
      (dailyStatusFilter === 'ABSENT' && (t.status === 'ABSENT' || t.status === 'ON_LEAVE')) ||
      t.status === dailyStatusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const selectedCategoryObj = categories.find((c) => c.code === applyCategory);

  // Calculate requested duration
  let applyDurationDays = 0;
  if (applyStartDate && applyEndDate && applyStartDate <= applyEndDate) {
    const [sy, sm, sd] = applyStartDate.split('-').map(Number);
    const [ey, em, ed] = applyEndDate.split('-').map(Number);
    applyDurationDays = Math.round((new Date(Date.UTC(ey, em - 1, ed)).getTime() - new Date(Date.UTC(sy, sm - 1, sd)).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  // Dedicated Faculty View: strictly Apply for Leave, My Applications, and My Attendance Reports
  if (user?.role === 'FACULTY') {
    return (
      <div className="space-y-6 pb-12">
        <PageHeader
          title="Teachers Management"
          kicker="FACULTY PERSONAL WORKSPACE"
          description="Apply for leave under official institutional categories with real-time rule enforcement, track administrative approval status, and view personal attendance reports."
        />

        {errorMsg && (
          <Card accentTop>
            <CardContent className="p-4 bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800 text-sm font-bold">
                &times;
              </button>
            </CardContent>
          </Card>
        )}

        {successMsg && (
          <Card accentTop>
            <CardContent className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 text-sm font-bold">
                &times;
              </button>
            </CardContent>
          </Card>
        )}

        {/* Faculty Sub-Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-2">
          <button
            type="button"
            onClick={() => setFacultyTab('apply')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              facultyTab === 'apply'
                ? 'bg-[#4B2E2E] text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Apply for Leave</span>
          </button>

          <button
            type="button"
            onClick={() => setFacultyTab('applications')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              facultyTab === 'applications'
                ? 'bg-[#4B2E2E] text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>My Leave Applications</span>
            {applications.filter((a) => a.status === 'PENDING').length > 0 && (
              <span className="bg-[#D4AF37] text-[#4B2E2E] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {applications.filter((a) => a.status === 'PENDING').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFacultyTab('reports')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              facultyTab === 'reports'
                ? 'bg-[#4B2E2E] text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>My Teacher Attendance Reports</span>
          </button>
        </div>

        {facultyTab === 'reports' ? (
          <FacultyPersonalReport />
        ) : facultyTab === 'apply' ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card accentTop>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-[#4B2E2E]" />
                  <div>
                    <CardTitle>Submit Leave Application</CardTitle>
                    <CardDescription>
                      Select an official category and date range.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleApplyLeave} className="space-y-4">
                  <FormField id="apply-cat" label="Leave Category" required>
                    <Select
                      id="apply-cat"
                      value={applyCategory}
                      onChange={(e) => setApplyCategory(e.target.value)}
                    >
                      <option value="CL">CL — Casual Leave (15 Days)</option>
                      <option value="EL">EL — Earned Leave (30 Days)</option>
                      <option value="SPECIAL_SL">Special SL (15 Days)</option>
                      <option value="PATERNITY">Paternity Leave (7 Days)</option>
                      <option value="MATERNITY">Maternity Leave (6 Months)</option>
                    </Select>
                  </FormField>

                  {selectedCategoryObj && (
                    <div className="p-3 bg-[#FAF9F5] border border-stone-200 rounded text-xs space-y-1">
                      <div className="font-bold text-[#4B2E2E]">{selectedCategoryObj.name} Rules</div>
                      <div className="text-stone-600 text-[11px] leading-relaxed">
                        {selectedCategoryObj.description}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormField id="apply-start" label="Start Date" required>
                      <Input
                        id="apply-start"
                        type="date"
                        value={applyStartDate}
                        min={minStartDate || undefined}
                        max={maxStartDate || undefined}
                        onChange={(e) => setApplyStartDate(e.target.value)}
                      />
                    </FormField>

                    <FormField id="apply-end" label="End Date" required>
                      <Input
                        id="apply-end"
                        type="date"
                        value={applyEndDate}
                        min={applyStartDate || minStartDate || undefined}
                        onChange={(e) => setApplyEndDate(e.target.value)}
                      />
                    </FormField>
                  </div>

                  {applyDurationDays > 0 && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 font-medium flex items-center justify-between">
                      <span>Requested Duration:</span>
                      <span className="font-bold text-sm">{applyDurationDays} Calendar Day(s)</span>
                    </div>
                  )}

                  <FormField
                    id="apply-reason"
                    label={selectedCategoryObj?.requiresReason ? 'Detailed Mandatory Reason' : 'Reason for Leave'}
                    required
                  >
                    <Textarea
                      id="apply-reason"
                      rows={3}
                      placeholder={
                        selectedCategoryObj?.requiresReason
                          ? 'Provide explicit medical / personal justification...'
                          : 'State purpose of leave application...'
                      }
                      value={applyReason}
                      onChange={(e) => setApplyReason(e.target.value)}
                    />
                  </FormField>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmittingApply}
                    className="w-full bg-[#4B2E2E] hover:bg-[#3B2424] text-white"
                  >
                    {isSubmittingApply ? 'Validating & Submitting...' : 'Submit Leave Application'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <Card accentTop>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle>My Leave Applications &amp; Status</CardTitle>
                    <CardDescription>
                      Track submitted applications, approval status, and remarks from the Principal.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Select
                      value={appStatusFilter}
                      onChange={(e) => setAppStatusFilter(e.target.value)}
                      className="text-xs py-1"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="CANCELLED">Cancelled</option>
                    </Select>

                    <Button variant="outline" size="sm" onClick={fetchApplications}>
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingApps ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isLoadingApps ? (
                  <div className="py-12 text-center text-xs text-stone-500">Loading leave applications...</div>
                ) : applications.length === 0 ? (
                  <div className="py-12 text-center text-xs text-stone-500">
                    No leave applications found matching current criteria.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-200">
                    {applications
                      .filter((a) => (appStatusFilter === 'ALL' ? true : a.status === appStatusFilter))
                      .map((app) => {
                        const isPending = app.status === 'PENDING';

                        return (
                          <div key={app.id} className="p-4 hover:bg-stone-50/70 transition-colors space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="text-xs text-stone-600 flex items-center gap-2 mt-0.5">
                                  <span className="font-semibold text-[#4B2E2E] bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                                    {app.leave_category || 'CL'}
                                  </span>
                                  <span className="font-medium text-stone-900">
                                    {formatDateDisplay(app.start_date)} — {formatDateDisplay(app.end_date)}
                                  </span>
                                  <span className="text-stone-400">
                                    ({calculateDays(app.start_date, app.end_date)}d)
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    app.status === 'APPROVED'
                                      ? 'success'
                                      : app.status === 'PENDING'
                                      ? 'warning'
                                      : 'neutral'
                                  }
                                  className={app.status === 'REJECTED' ? 'bg-rose-50 text-rose-800 border-rose-200' : ''}
                                  size="sm"
                                >
                                  {app.status}
                                </Badge>

                                {isPending && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCancelApplication(app.id)}
                                    className="text-[11px] text-rose-700 hover:bg-rose-50 border-rose-200 py-0.5 px-2 h-7"
                                  >
                                    Cancel Request
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="p-3 bg-[#FAF9F5] border border-stone-200 rounded text-xs text-stone-700">
                              <span className="font-semibold text-stone-900 block mb-0.5">Reason:</span>
                              &quot;{app.reason}&quot;
                            </div>

                            {(app.decision_remarks || app.decided_at) && (
                              <div className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded border border-stone-200">
                                <span className="font-semibold text-stone-800">
                                  Decided by {app.decider_name || 'Principal'}
                                </span>
                                {app.decided_at && (
                                  <span className="text-stone-400 text-[10px] ml-1">
                                    on {new Date(app.decided_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                                {app.decision_remarks && (
                                  <div className="text-[11px] italic text-stone-600 mt-0.5">
                                    Remarks: &quot;{app.decision_remarks}&quot;
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Teacher Attendance &amp; Leave Governance"
          kicker="PRINCIPAL ADMINISTRATION"
          description="Daily teacher attendance tracking, daily roster management, and leave application approvals."
        />
        {isPrincipal && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNewMaxAdvanceDays(maxAdvanceDays);
              setShowSettingsModal(true);
            }}
            icon={<Settings className="w-3.5 h-3.5 text-[#4B2E2E]" />}
            className="text-xs shrink-0 self-start sm:self-auto"
          >
            Advance Window ({maxAdvanceDays} Days)
          </Button>
        )}
      </div>

      {errorMsg && (
        <Card accentTop>
          <CardContent className="p-4 bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800 text-sm font-bold">
              &times;
            </button>
          </CardContent>
        </Card>
      )}

      {successMsg && (
        <Card accentTop>
          <CardContent className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 text-sm font-bold">
              &times;
            </button>
          </CardContent>
        </Card>
      )}

      {/* Main Tab Navigation (Principal / Super Admin) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'daily'
              ? 'bg-[#4B2E2E] text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Calendar &amp; Daily Absence Tracker</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'applications'
              ? 'bg-[#4B2E2E] text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Leave Applications &amp; Approvals</span>
          {applications.filter((a) => a.status === 'PENDING').length > 0 && isPrincipal && (
            <span className="bg-[#D4AF37] text-[#4B2E2E] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              {applications.filter((a) => a.status === 'PENDING').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-[#4B2E2E] text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Teacher Attendance Reports</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'monthly'
              ? 'bg-[#4B2E2E] text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Monthly Reports &amp; Holidays</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holidays')}
          className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'holidays'
              ? 'bg-[#4B2E2E] text-white shadow-xs'
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Institutional Working Days &amp; Holidays</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: CALENDAR & DAILY ABSENCE TRACKER
          ========================================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Date Selector Header Bar */}
          <Card accentTop>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Daily Teacher Attendance &amp; Absence Tracker</CardTitle>
                  <CardDescription>
                    Select any calendar date to view teachers recorded absent, approved leave details, pending applications, and record daily attendance.
                  </CardDescription>
                </div>

                {/* Date Control */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => shiftDate(-1)} title="Previous Day">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <div className="relative">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3 py-1.5 border border-stone-300 rounded text-xs font-mono bg-white font-semibold text-stone-800 shadow-xs focus:ring-[#4B2E2E]"
                    />
                  </div>

                  <Button variant="outline" size="sm" onClick={() => shiftDate(1)} title="Next Day">
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                    className="text-xs"
                  >
                    Today
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchDailyAttendance(selectedDate)}
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDaily ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {/* Daily Summary Cards */}
              {dailyData && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                  <div className="p-3 bg-[#FAF9F5] border border-stone-200 rounded">
                    <div className="text-[10px] uppercase font-bold text-stone-500">Total Teachers</div>
                    <div className="text-xl font-bold text-stone-900 mt-0.5">{dailyData.summary.totalTeachers}</div>
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded">
                    <div className="text-[10px] uppercase font-bold text-emerald-800">Present</div>
                    <div className="text-xl font-bold text-emerald-900 mt-0.5">{dailyData.summary.presentCount}</div>
                  </div>

                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded">
                    <div className="text-[10px] uppercase font-bold text-rose-800">Recorded Absences</div>
                    <div className="text-xl font-bold text-rose-900 mt-0.5">{dailyData.summary.absentCount}</div>
                  </div>

                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded">
                    <div className="text-[10px] uppercase font-bold text-purple-800">On Approved Leave</div>
                    <div className="text-xl font-bold text-purple-900 mt-0.5">{dailyData.summary.onLeaveCount}</div>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded">
                    <div className="text-[10px] uppercase font-bold text-amber-800">Pending Requests</div>
                    <div className="text-xl font-bold text-amber-900 mt-0.5">{dailyData.summary.pendingLeaveCount}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Table Card */}
          <Card accentTop>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#4B2E2E]" />
                  <span className="font-semibold text-xs text-stone-800">
                    Faculty Attendance Roster for {formatDateDisplay(selectedDate)}
                  </span>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
                    <Input
                      placeholder="Search teacher or department..."
                      value={dailySearch}
                      onChange={(e) => setDailySearch(e.target.value)}
                      className="pl-8 text-xs py-1 w-48"
                    />
                  </div>

                  <Select
                    value={dailyStatusFilter}
                    onChange={(e) => setDailyStatusFilter(e.target.value)}
                    className="text-xs py-1"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ABSENT">Absent / On Leave Only</option>
                    <option value="PRESENT">Present</option>
                    <option value="ON_LEAVE">Approved Leave</option>
                    <option value="UNRECORDED">Unrecorded</option>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoadingDaily ? (
                <div className="py-12 text-center text-xs text-stone-500">Loading daily attendance records...</div>
              ) : filteredDailyTeachers.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500">
                  No teacher records match the selected date or filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF9F5] border-b border-stone-200 text-[11px] font-semibold uppercase text-stone-600">
                      <tr>
                        <th className="py-3 px-4">Faculty Member</th>
                        <th className="py-3 px-4">Department &amp; Designation</th>
                        <th className="py-3 px-4">Daily Status</th>
                        <th className="py-3 px-4">Leave Category &amp; Recorded Reason</th>
                        <th className="py-3 px-4">Recorded By</th>
                        {isPrincipal && <th className="py-3 px-4 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {filteredDailyTeachers.map((t) => {
                        const isAbsentOrLeave = t.status === 'ABSENT' || t.status === 'ON_LEAVE';

                        return (
                          <tr key={t.teacherId} className={`hover:bg-stone-50/70 transition-colors ${isAbsentOrLeave ? 'bg-rose-50/20' : ''}`}>
                            <td className="py-3 px-4 font-medium text-stone-900">
                              <div>{t.teacherName}</div>
                              <div className="text-[11px] font-mono text-stone-500 mt-0.5">
                                {t.employeeCode || `ID #${t.teacherId}`}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-stone-800">{t.departmentName || 'General Dept'}</div>
                              <div className="text-[11px] text-stone-500">{t.designation}</div>
                            </td>
                            <td className="py-3 px-4">
                              {t.status === 'PRESENT' && (
                                <Badge variant="success" size="sm">
                                  PRESENT
                                </Badge>
                              )}
                              {t.status === 'ABSENT' && (
                                <Badge variant="warning" size="sm" className="bg-rose-100 text-rose-800 border-rose-300">
                                  ABSENT
                                </Badge>
                              )}
                              {t.status === 'ON_LEAVE' && (
                                <Badge variant="neutral" size="sm" className="bg-purple-100 text-purple-800 border-purple-300">
                                  ON LEAVE
                                </Badge>
                              )}
                              {t.status === 'HALF_DAY' && (
                                <Badge variant="warning" size="sm" className="bg-amber-100 text-amber-800 border-amber-300">
                                  HALF DAY
                                </Badge>
                              )}
                              {t.status === 'UNRECORDED' && (
                                <Badge variant="neutral" size="sm" className="bg-stone-100 text-stone-600 border-stone-300">
                                  UNRECORDED
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 max-w-xs">
                              {t.approvedLeave ? (
                                <div className="space-y-0.5">
                                  <div className="inline-block px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                                    {t.approvedLeave.leaveCategory} — Approved Leave
                                  </div>
                                  <div className="text-[11px] text-stone-700 italic">
                                    &quot;{t.approvedLeave.reason}&quot;
                                  </div>
                                  {t.approvedLeave.decisionRemarks && (
                                    <div className="text-[10px] text-stone-500">
                                      Remarks: {t.approvedLeave.decisionRemarks}
                                    </div>
                                  )}
                                </div>
                              ) : t.pendingLeave ? (
                                <div className="space-y-0.5">
                                  <div className="inline-block px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                                    {t.pendingLeave.leaveCategory} — Pending Application
                                  </div>
                                  <div className="text-[11px] text-stone-600 italic">
                                    &quot;{t.pendingLeave.reason}&quot;
                                  </div>
                                </div>
                              ) : t.rejectedLeave ? (
                                <div className="space-y-0.5">
                                  <div className="inline-block px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                                    {t.rejectedLeave.leaveCategory} — Rejected Application
                                  </div>
                                  <div className="text-[10px] text-stone-500">
                                    {t.rejectedLeave.decisionRemarks || 'No remarks'}
                                  </div>
                                </div>
                              ) : t.recordedReason ? (
                                <span className="text-stone-700 italic">&quot;{t.recordedReason}&quot;</span>
                              ) : (
                                <span className="text-stone-400 italic">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[11px] text-stone-600 font-mono">
                              {t.recordedBy ? (
                                <div>
                                  <div>{t.recordedBy}</div>
                                  <div className="text-[10px] text-stone-400">
                                    {t.recordedAt ? new Date(t.recordedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-stone-400 italic">—</span>
                              )}
                            </td>
                            {isPrincipal && (
                              <td className="py-3 px-4 text-right">
                                {t.status === 'ABSENT' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRestorePresent(t)}
                                    disabled={isSavingDaily}
                                    className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  >
                                    Restore Present
                                  </Button>
                                ) : t.status === 'ON_LEAVE' ? (
                                  <span className="text-stone-400 italic">—</span>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setMarkAbsentTeacher(t);
                                      setMarkAbsentReason('');
                                    }}
                                    disabled={isSavingDaily}
                                    className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                                  >
                                    Mark Absent
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LEAVE APPLICATIONS & APPROVALS (PRINCIPAL / ADMIN WORKSPACE ONLY)
          ========================================================================= */}
      {activeTab === 'applications' && (
        <div className="space-y-6">
          <Card accentTop>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Institutional Leave Approvals Workspace</CardTitle>
                  <CardDescription>
                    Review pending faculty leave applications, evaluate daily category limits, and process approvals.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Select
                    value={appStatusFilter}
                    onChange={(e) => setAppStatusFilter(e.target.value)}
                    className="text-xs py-1"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending Approval</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </Select>

                  <Button variant="outline" size="sm" onClick={fetchApplications}>
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingApps ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoadingApps ? (
                <div className="py-12 text-center text-xs text-stone-500">Loading leave applications...</div>
              ) : applications.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500">
                  No leave applications found matching current criteria.
                </div>
              ) : (
                <div className="divide-y divide-stone-200">
                  {applications
                    .filter((a) => (appStatusFilter === 'ALL' ? true : a.status === appStatusFilter))
                    .map((app) => {
                      const isPending = app.status === 'PENDING';

                      return (
                        <div key={app.id} className="p-4 hover:bg-stone-50/70 transition-colors space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              {app.teacher_name && (
                                <div className="font-bold text-stone-900 text-sm">{app.teacher_name}</div>
                              )}
                              <div className="text-xs text-stone-600 flex items-center gap-2 mt-0.5">
                                <span className="font-semibold text-[#4B2E2E] bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                                  {app.leave_category || 'CL'}
                                </span>
                                <span>
                                  {formatDateDisplay(app.start_date)} — {formatDateDisplay(app.end_date)}
                                </span>
                                {app.department_name && (
                                  <span className="text-stone-400">• {app.department_name}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {app.status === 'APPROVED' && (
                                <Badge variant="success" size="sm">
                                  APPROVED
                                </Badge>
                              )}
                              {app.status === 'REJECTED' && (
                                <Badge variant="warning" size="sm" className="bg-rose-100 text-rose-800 border-rose-300">
                                  REJECTED
                                </Badge>
                              )}
                              {app.status === 'PENDING' && (
                                <Badge variant="warning" size="sm" className="bg-amber-100 text-amber-800 border-amber-300">
                                  PENDING APPROVAL
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="p-3 bg-[#FAF9F5] border border-stone-200 rounded text-xs text-stone-700">
                            <span className="font-semibold text-stone-900 block mb-0.5">Reason:</span>
                            &quot;{app.reason}&quot;
                          </div>

                          {app.decision_remarks && (
                            <div className="text-xs text-stone-600 bg-stone-50 p-2 rounded border border-stone-200">
                              <span className="font-semibold text-stone-800">Decision Remarks:</span> {app.decision_remarks}
                            </div>
                          )}

                          {/* Principal Decision Action Box */}
                          {isPending && (
                            <div className="pt-2 border-t border-stone-200 flex flex-col sm:flex-row items-center gap-3">
                              <Input
                                placeholder="Enter optional decision remarks..."
                                value={decisionRemarksMap[app.id] || ''}
                                onChange={(e) =>
                                  setDecisionRemarksMap({ ...decisionRemarksMap, [app.id]: e.target.value })
                                }
                                className="text-xs py-1 flex-1"
                              />

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => handleDecideApplication(app.id, 'APPROVED')}
                                  disabled={isSubmittingDecision === app.id}
                                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
                                >
                                  <Check className="w-3.5 h-3.5 mr-1" />
                                  Approve
                                </Button>

                                <Button
                                  size="sm"
                                  onClick={() => handleDecideApplication(app.id, 'REJECTED')}
                                  disabled={isSubmittingDecision === app.id}
                                  className="bg-rose-700 hover:bg-rose-800 text-white text-xs"
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 3: TEACHER ATTENDANCE REPORTS
          ========================================================================= */}
      {activeTab === 'reports' && (
        <PrincipalFacultyReports />
      )}

      {/* =========================================================================
          TAB 4: MONTHLY REPORTS & HOLIDAYS
          ========================================================================= */}
      {activeTab === 'monthly' && (
        <PrincipalFacultyReports />
      )}

      {/* =========================================================================
          TAB 5: INSTITUTIONAL WORKING DAYS & HOLIDAYS
          ========================================================================= */}
      {activeTab === 'holidays' && (
        <InstitutionalHolidaysWorkspace />
      )}

      {/* Max Advance Window Setting Modal (Principal / Super Admin) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl border border-stone-300 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#4B2E2E]">Configure Advance Application Window</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Set how many days in advance faculty can apply for leave.
                </p>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <FormField id="max-days" label="Maximum Advance Days (1 - 365)" required>
                <Input
                  id="max-days"
                  type="number"
                  min={1}
                  max={365}
                  value={newMaxAdvanceDays}
                  onChange={(e) => setNewMaxAdvanceDays(Number(e.target.value))}
                  className="font-mono text-sm"
                />
              </FormField>

              <div className="p-3 bg-[#FAF9F5] border border-stone-200 rounded text-stone-600 text-[11px] leading-relaxed">
                Faculty will only be allowed to pick leave start dates within the next{' '}
                <strong className="text-stone-900">{newMaxAdvanceDays || 20}</strong> calendar days.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettingsModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSavingSettings}
                  className="bg-[#4B2E2E] hover:bg-[#3B2424] text-white"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Teacher Absent Modal */}
      {markAbsentTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-stone-300 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#4B2E2E]">Mark Teacher Absent</h3>
                <div className="text-[11px] text-stone-500">
                  {markAbsentTeacher.teacherName} • {formatDateDisplay(selectedDate)}
                </div>
              </div>
              <button onClick={() => setMarkAbsentTeacher(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <FormField id="absent-reason" label="Absence Reason / Remarks (Optional)">
              <Input
                id="absent-reason"
                placeholder="e.g. Uninformed absence / Medical emergency"
                value={markAbsentReason}
                onChange={(e) => setMarkAbsentReason(e.target.value)}
              />
            </FormField>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <Button variant="outline" size="sm" onClick={() => setMarkAbsentTeacher(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAbsentEntry}
                disabled={isSavingDaily}
                className="bg-rose-700 hover:bg-rose-800 text-white"
              >
                {isSavingDaily ? 'Saving...' : 'Confirm Absence'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
