import React, { useEffect, useState } from 'react';
import {
  Users,
  CreditCard,
  GraduationCap,
  Briefcase,
  Building2,
  BookOpen,
  ArrowRight,
  LogIn,
  Award,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { NavigationItemKey } from '../types';
import { useAuth } from '../context/AuthContext';
import { canAccessModule } from '../config/permissions';
import { CollegeLogo } from '../components/ui/CollegeLogo';

export interface WelcomeViewProps {
  onNavigate: (tab: NavigationItemKey) => void;
}

interface DashboardStats {
  studentCount?: number;
  teacherCount?: number;
  departmentCount?: number;
  userCount?: number;
  feeStats?: {
    totalCollected: number;
    pendingTransfersCount: number;
  };
  iaPendingOfficeApprovals?: number;
  univExamResultsCount?: number;
  libraryStats?: {
    totalBooks: number;
    availableCopies: number;
    activeIssues: number;
    overdueCount: number;
  };
  leaveStats?: {
    pendingLeaves: number;
    todayAbsences: number;
  };
  facultyStats?: {
    pendingApplications: number;
  };
}

interface FacultyLeaveBalance {
  categoryCode: string;
  categoryName: string;
  entitlementDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  description?: string;
}

interface FacultyLeaveApp {
  id: number;
  leave_category: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  decision_remarks: string | null;
  decider_name: string | null;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onNavigate }) => {
  const { user, openLoginModal } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Faculty Personal Leave State
  const [facultyLeaveBalances, setFacultyLeaveBalances] = useState<FacultyLeaveBalance[]>([]);
  const [recentLeaveApps, setRecentLeaveApps] = useState<FacultyLeaveApp[]>([]);
  const [isLoadingFacultyData, setIsLoadingFacultyData] = useState(false);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const [sy, sm, sd] = start.split('T')[0].split('-').map(Number);
    const [ey, em, ed] = end.split('T')[0].split('-').map(Number);
    if (!sy || !sm || !sd || !ey || !em || !ed) return 1;
    const diff = Math.round((new Date(Date.UTC(ey, em - 1, ed)).getTime() - new Date(Date.UTC(sy, sm - 1, sd)).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  const fetchFacultyLeaveData = async () => {
    if (!user || user.role !== 'FACULTY') return;
    setIsLoadingFacultyData(true);
    try {
      const [balRes, appsRes] = await Promise.all([
        fetch('/api/leave/balances'),
        fetch('/api/leave/my-applications'),
      ]);

      if (balRes.ok) {
        const balData = await balRes.json();
        if (balData && Array.isArray(balData.balances)) {
          setFacultyLeaveBalances(balData.balances);
        }
      }

      if (appsRes.ok) {
        const appsData = await appsRes.json();
        if (appsData && Array.isArray(appsData.applications)) {
          setRecentLeaveApps(appsData.applications);
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingFacultyData(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'FACULTY' && !user.mustChangePassword) {
      fetchFacultyLeaveData();
    }
  }, [user]);

  const showUsers = Boolean(user && canAccessModule(user.role, 'user_mgmt'));
  const showFees = Boolean(user && canAccessModule(user.role, 'fees_mgmt'));
  const showStudents = Boolean(user && canAccessModule(user.role, 'student_records'));
  const showTeachers = Boolean(user && canAccessModule(user.role, 'teacher_records'));
  const showMarks = Boolean(user && canAccessModule(user.role, 'marks_mgmt'));
  const showUnivExams = Boolean(user && canAccessModule(user.role, 'univ_exams'));
  const showDept = Boolean(user && canAccessModule(user.role, 'dept_portal'));
  const showLibrary = Boolean(user && canAccessModule(user.role, 'library_mgmt'));
  const showLeave = Boolean(user && canAccessModule(user.role, 'leave_mgmt'));
  const showAttendance = Boolean(user && canAccessModule(user.role, 'attendance_mgmt'));

  useEffect(() => {
    if (user && !user.mustChangePassword) {
      setIsLoadingStats(true);
      fetch('/api/dashboard/stats')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setStats(data);
          }
        })
        .catch(() => {
          // Ignore background stats load errors gracefully
        })
        .finally(() => {
          setIsLoadingStats(false);
        });
    } else {
      setStats(null);
    }
  }, [user]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-5">
      {/* Institutional Banner Header */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-[#D4AF37]/40 shadow-xs">
            <CollegeLogo size="md" className="w-full h-full" />
          </div>
          <div>
            <h1 className="font-serif text-lg sm:text-xl font-bold text-stone-900 leading-tight">
              Krishna Ayurvedic Medical College &amp; Hospital
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Institutional Enterprise Resource Planning
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <a
            href="/library-catalogue"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-700" />
            <span>Public Book Catalogue</span>
          </a>

          {user ? (
            <div className="flex items-center gap-2">
              <Badge variant="institutional" size="sm">
                {user.roleName}
              </Badge>
              {user.departmentName && (
                <Badge variant="gold" size="sm">
                  {user.departmentName}
                </Badge>
              )}
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<LogIn className="w-3.5 h-3.5 text-[#D4AF37]" />}
              onClick={openLoginModal}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>

      {/* Unauthenticated Landing Card */}
      {!user && (
        <Card accentTop>
          <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <h2 className="font-serif text-base font-bold text-[#4B2E2E]">
                Authorized Institutional Access
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Sign in with your assigned institutional username or email address to access permitted administrative and academic modules.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              icon={<LogIn className="w-4 h-4 text-[#D4AF37]" />}
              onClick={openLoginModal}
            >
              Sign In to KAMCH ERP
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Faculty Profile Card & Quick Actions */}
      {user && user.role === 'FACULTY' && !user.mustChangePassword && (
        <div className="space-y-6 max-w-5xl mx-auto">
          {/* 1. Faculty Profile Header */}
          <Card accentTop>
            <CardHeader className="pb-3 border-b border-stone-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#4B2E2E]/10 border border-[#4B2E2E]/20 flex items-center justify-center text-[#4B2E2E] shrink-0">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-900 font-serif leading-tight">
                      {user.fullName}
                    </h2>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {user.teacherDesignation || 'Faculty Member'}
                      {user.departmentName ? ` · Department of ${user.departmentName}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="success" size="sm">
                    Active Profile
                  </Badge>
                  <Badge variant="institutional" size="sm">
                    Faculty Workspace
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF9F5] p-3.5 rounded-lg border border-stone-200/80 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-stone-400 block tracking-wider">Username</span>
                  <span className="font-mono text-stone-800 font-bold text-xs">{user.username}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-stone-400 block tracking-wider">Teacher Code (NCISM)</span>
                  <span className="font-mono text-stone-800 font-bold text-xs">
                    {user.teacherCode || user.teacherEmployeeCode || 'NCISM-KAMCH'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-stone-400 block tracking-wider">Employee Code</span>
                  <span className="font-mono text-stone-800 font-bold text-xs">
                    {user.teacherEmployeeCode || 'FAC-00' + (user.teacherId || user.id)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-stone-400 block tracking-wider">Institutional Department</span>
                  <span className="font-serif text-stone-800 font-bold text-xs">
                    {user.departmentName || 'Ayurvedic Samhita'}
                  </span>
                </div>
              </div>

              {/* Action Shortcuts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                <div className="p-3.5 bg-white border border-[#4B2E2E]/20 rounded-xl space-y-2 flex flex-col justify-between hover:border-[#4B2E2E]/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 text-[#4B2E2E] font-bold text-xs font-serif">
                      <Calendar className="w-4 h-4 text-[#4B2E2E]" />
                      <span>Leave Management</span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                      Submit a new leave application or review previous application statuses.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-center bg-[#4B2E2E] hover:bg-[#3B2424] text-white"
                    icon={<ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />}
                    iconPosition="right"
                    onClick={() => onNavigate('leave_mgmt')}
                  >
                    Apply for Leave
                  </Button>
                </div>

                <div className="p-3.5 bg-white border border-stone-200 rounded-xl space-y-2 flex flex-col justify-between hover:border-stone-400 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 text-stone-900 font-bold text-xs font-serif">
                      <Clock className="w-4 h-4 text-[#4B2E2E]" />
                      <span>My Attendance Report</span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                      Review personal monthly working days, recorded attendance logs, and finalized reports.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                    iconPosition="right"
                    onClick={() => onNavigate('leave_mgmt')}
                  >
                    View Teacher Attendance Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Personal Leave Balance Summary */}
          <Card accentTop>
            <CardHeader className="pb-2 border-b border-stone-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#FAF9F5] border border-stone-200 flex items-center justify-center text-[#4B2E2E]">
                    <Award className="w-4 h-4 text-[#4B2E2E]" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Personal Leave Balance Summary</CardTitle>
                    <p className="text-[11px] text-stone-500">
                      Annual entitlement, approved usage, and remaining leave balance for current academic year
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchFacultyLeaveData}
                  className="text-xs"
                  title="Refresh leave balances"
                >
                  <Clock className={`w-3.5 h-3.5 ${isLoadingFacultyData ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {isLoadingFacultyData && facultyLeaveBalances.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  Loading personal leave balances...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Cards Grid for Leave Categories */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {facultyLeaveBalances.map((bal) => (
                      <div
                        key={bal.categoryCode}
                        className="bg-[#FAF9F5] border border-stone-200/90 rounded-lg p-3.5 space-y-2.5 flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-serif font-bold text-xs text-stone-900 block">
                              {bal.categoryName}
                            </span>
                            <span className="text-[10px] text-stone-500 font-mono">
                              Code: {bal.categoryCode}
                            </span>
                          </div>
                          <Badge
                            variant={bal.remainingDays > 0 ? 'success' : 'neutral'}
                            size="sm"
                          >
                            {bal.remainingDays}d Available
                          </Badge>
                        </div>

                        {/* Breakdown Metrics */}
                        <div className="grid grid-cols-3 gap-1.5 text-center bg-white p-2 rounded border border-stone-200/70 text-xs">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-stone-400 block">Entitled</span>
                            <span className="font-bold text-stone-800 text-xs font-mono">{bal.entitlementDays}d</span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-amber-600 block">Used</span>
                            <span className="font-bold text-amber-800 text-xs font-mono">{bal.usedDays}d</span>
                          </div>
                          <div className="bg-emerald-50 rounded">
                            <span className="text-[9px] uppercase font-bold text-emerald-700 block">Remaining</span>
                            <span className="font-bold text-emerald-900 text-xs font-mono">{bal.remainingDays}d</span>
                          </div>
                        </div>

                        {bal.pendingDays > 0 && (
                          <div className="text-[10px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-medium flex items-center justify-between">
                            <span>Pending approval:</span>
                            <span className="font-bold font-mono">{bal.pendingDays} day(s)</span>
                          </div>
                        )}

                        <div className="text-[10px] text-stone-500 leading-tight italic pt-1 border-t border-stone-200/60">
                          {bal.description || 'Institutional leave category'}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-stone-400 italic">
                    * Note: Remaining balance is based on approved applications. Pending applications are tracked separately and do not deduct from approved days until authorized by the Principal.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Recent Leave Applications History */}
          <Card accentTop>
            <CardHeader className="pb-2 border-b border-stone-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#FAF9F5] border border-stone-200 flex items-center justify-center text-[#4B2E2E]">
                    <FileText className="w-4 h-4 text-[#4B2E2E]" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Recent Leave Applications</CardTitle>
                    <p className="text-[11px] text-stone-500">
                      Personal leave submission history, administrative status, and principal remarks
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('leave_mgmt')}
                  className="text-xs"
                >
                  View Full History
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {isLoadingFacultyData && recentLeaveApps.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-500">
                  Loading recent applications...
                </div>
              ) : recentLeaveApps.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-500 bg-[#FAF9F5] rounded-lg border border-dashed border-stone-200">
                  <Calendar className="w-6 h-6 mx-auto mb-1 text-stone-400" />
                  <p className="font-semibold text-stone-700">No leave applications found.</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">Use the "Apply for Leave" button above to submit your first request.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-stone-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF9F5] border-b border-stone-200 text-[10px] font-semibold uppercase text-stone-600">
                      <tr>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Dates &amp; Duration</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Approval Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {recentLeaveApps.slice(0, 5).map((app) => (
                        <tr key={app.id} className="hover:bg-stone-50 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-stone-900 whitespace-nowrap">
                            <span className="font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded text-[10px] mr-1.5">
                              {app.leave_category}
                            </span>
                            {app.leave_category === 'CL'
                              ? 'Casual Leave'
                              : app.leave_category === 'EL'
                              ? 'Earned Leave'
                              : app.leave_category === 'SPECIAL_SL'
                              ? 'Special Sick Leave'
                              : app.leave_category === 'PATERNITY'
                              ? 'Paternity Leave'
                              : 'Maternity Leave'}
                          </td>
                          <td className="py-2.5 px-3 text-stone-700 whitespace-nowrap">
                            <span className="font-mono font-medium block text-stone-900">
                              {app.start_date ? app.start_date.split('T')[0] : ''} to {app.end_date ? app.end_date.split('T')[0] : ''}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              Duration: {calculateDays(app.start_date, app.end_date)} day(s)
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-stone-600 max-w-xs truncate" title={app.reason}>
                            {app.reason}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
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
                          </td>
                          <td className="py-2.5 px-3 text-stone-600 text-[11px]">
                            {app.status === 'APPROVED' || app.status === 'REJECTED' ? (
                              <div>
                                <span className="font-medium text-stone-800">
                                  {app.decider_name || 'Principal'}
                                </span>
                                {app.decided_at && (
                                  <span className="text-[10px] text-stone-400 block">
                                    on {new Date(app.decided_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                                {app.decision_remarks && (
                                  <span className="italic text-stone-500 block text-[10px] mt-0.5">
                                    "{app.decision_remarks}"
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-stone-400 italic">Awaiting decision</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Authenticated Operational Module Cards */}
      {user && user.role !== 'FACULTY' && !user.mustChangePassword && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Fees Management */}
          {showFees && (
            <Card accentTop className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4B2E2E]/10 flex items-center justify-center text-[#4B2E2E]">
                      <CreditCard className="w-4.5 h-4.5" />
                    </div>
                    <CardTitle>Fees Management</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Student fee assessments, cash and bank-transfer collections, passbook verification, receipts, and financial reports.
                  </p>
                  {stats?.feeStats && (
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/70">
                        <span className="text-[10px] text-stone-500 font-medium block">Verified Collected</span>
                        <span className="text-xs font-bold text-emerald-800">
                          {formatCurrency(stats.feeStats.totalCollected)}
                        </span>
                      </div>
                      <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/70">
                        <span className="text-[10px] text-stone-500 font-medium block">Pending Transfers</span>
                        <span className="text-xs font-bold text-amber-800">
                          {stats.feeStats.pendingTransfersCount} Pending
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-5 pt-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => onNavigate('fees_mgmt')}
                >
                  Open Fees Management
                </Button>
              </div>
            </Card>
          )}

          {/* User Management */}
          {showUsers && (
            <Card accentTop className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4B2E2E]/10 flex items-center justify-center text-[#4B2E2E]">
                      <Users className="w-4.5 h-4.5" />
                    </div>
                    <CardTitle>User Management</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Account creation, bulk teacher/dept provisioning, role assignment, suspension, password resets, and security audit logs.
                  </p>
                  {typeof stats?.userCount === 'number' && (
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/70 flex items-center justify-between text-xs">
                      <span className="text-stone-500 font-medium text-[11px]">Active Accounts</span>
                      <span className="font-bold text-stone-900 font-mono">{stats.userCount} Users</span>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-5 pt-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => onNavigate('user_mgmt')}
                >
                  Open User Management
                </Button>
              </div>
            </Card>
          )}

          {/* Student Management */}
          {showStudents && (
            <Card accentTop className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4B2E2E]/10 flex items-center justify-center text-[#4B2E2E]">
                      <GraduationCap className="w-4.5 h-4.5" />
                    </div>
                    <CardTitle>Student Management</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Central student registry across RS6 and RS7 cohorts, roll numbers, academic progression, internship tracking, and fee summaries.
                  </p>
                  {typeof stats?.studentCount === 'number' && (
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/70 flex items-center justify-between text-xs">
                      <span className="text-stone-500 font-medium text-[11px]">Active Enrolled Students</span>
                      <span className="font-bold text-stone-900 font-mono">{stats.studentCount} Students</span>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-5 pt-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => onNavigate('student_records')}
                >
                  Open Student Management
                </Button>
              </div>
            </Card>
          )}

          {/* Teacher Records */}
          {showTeachers && (
            <Card accentTop className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4B2E2E]/10 flex items-center justify-center text-[#4B2E2E]">
                      <Briefcase className="w-4.5 h-4.5" />
                    </div>
                    <CardTitle>Teacher Records</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Institutional registry of faculty and teaching staff across college departments.
                  </p>
                  {typeof stats?.teacherCount === 'number' && (
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/70 flex items-center justify-between text-xs">
                      <span className="text-stone-500 font-medium text-[11px]">Active Faculty Members</span>
                      <span className="font-bold text-stone-900 font-mono">{stats.teacherCount} Teachers</span>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-5 pt-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => onNavigate('teacher_records')}
                >
                  Open Teacher Records
                </Button>
              </div>
            </Card>
          )}

          {/* Internal Assessment */}
          {showMarks && (
            <Card accentTop className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4B2E2E]/10 flex items-center justify-center text-[#4B2E2E]">
                      <Award className="w-4.5 h-4.5" />
                    </div>
                    <CardTitle>Internal Assessment</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Internal examination mark entry, NCISM 20%/80% rules, departmental verification, and office approvals.
                  </p>
                  {typeof stats?.iaPendingOfficeApprovals === 'number' && (
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/70 flex items-center justify-between text-xs">
                      <span className="text-stone-500 font-medium text-[11px]">Pending Office Approvals</span>
                      <span className="font-bold text-amber-800 font-mono">
                        {stats.iaPendingOfficeApprovals} Pending
                      </span>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-5 pt-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => onNavigate('marks_mgmt')}
                >
                  Open Internal Assessment
                </Button>
              </div>
            </Card>
          )}

          {/* University Exams */}
          {showUnivExams && (
            <Card accentTop className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4B2E2E]/10 flex items-center justify-center text-[#4B2E2E]">
                      <FileText className="w-4.5 h-4.5" />
                    </div>
                    <CardTitle>University Examinations</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Professional year examination records, university result entry, finalization, promotion preview, and batch-wise mark sheets.
                  </p>
                  {typeof stats?.univExamResultsCount === 'number' && (
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/70 flex items-center justify-between text-xs">
                      <span className="text-stone-500 font-medium text-[11px]">Exam Results Recorded</span>
                      <span className="font-bold text-stone-900 font-mono">{stats.univExamResultsCount} Records</span>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-5 pt-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => onNavigate('univ_exams')}
                >
                  Open University Exams
                </Button>
              </div>
            </Card>
          )}

          {/* Department Workspace */}
          {showDept && (
            <Card accentTop className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4B2E2E]/10 flex items-center justify-center text-[#4B2E2E]">
                      <Building2 className="w-4.5 h-4.5" />
                    </div>
                    <CardTitle>Department Workspace</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Departmental overview, subject assignments, and assigned department faculty records.
                  </p>
                  {typeof stats?.departmentCount === 'number' && (
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/70 flex items-center justify-between text-xs">
                      <span className="text-stone-500 font-medium text-[11px]">College Departments</span>
                      <span className="font-bold text-stone-900 font-mono">{stats.departmentCount} Depts</span>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-5 pt-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => onNavigate('dept_portal')}
                >
                  Open Department Workspace
                </Button>
              </div>
            </Card>
          )}

          {/* Library */}
          {showLibrary && (
            <Card accentTop className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4B2E2E]/10 flex items-center justify-center text-[#4B2E2E]">
                      <BookOpen className="w-4.5 h-4.5" />
                    </div>
                    <CardTitle>Library Workspace</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Accession register, category cataloging, book issuance and returns, overdue tracking, and student library history.
                  </p>
                  {stats?.libraryStats && (
                    <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                      <div className="bg-stone-50 p-2 rounded-lg border border-stone-200/70">
                        <span className="text-[10px] text-stone-500 font-medium block">Total Volumes</span>
                        <span className="font-bold text-stone-900 font-mono">{stats.libraryStats.totalBooks}</span>
                      </div>
                      <div className="bg-stone-50 p-2 rounded-lg border border-stone-200/70">
                        <span className="text-[10px] text-stone-500 font-medium block">Active Issues</span>
                        <span className="font-bold text-amber-800 font-mono">{stats.libraryStats.activeIssues}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-5 pt-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => onNavigate('library_mgmt')}
                >
                  Open Library Workspace
                </Button>
              </div>
            </Card>
          )}

          {/* Teacher Attendance & Leave */}
          {showLeave && (
            <Card accentTop className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4B2E2E]/10 flex items-center justify-center text-[#4B2E2E]">
                      <Calendar className="w-4.5 h-4.5" />
                    </div>
                    <CardTitle>Teacher Attendance &amp; Leave</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Unified workspace for teacher leave application approvals, balance tracking, and daily attendance recording.
                  </p>
                  {stats?.leaveStats && (
                    <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                      <div className="bg-stone-50 p-2 rounded-lg border border-stone-200/70">
                        <span className="text-[10px] text-stone-500 font-medium block">Pending Approvals</span>
                        <span className="font-bold text-amber-800 font-mono">{stats.leaveStats.pendingLeaves}</span>
                      </div>
                      <div className="bg-stone-50 p-2 rounded-lg border border-stone-200/70">
                        <span className="text-[10px] text-stone-500 font-medium block">Today's Absences</span>
                        <span className="font-bold text-stone-900 font-mono">{stats.leaveStats.todayAbsences}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-5 pt-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => onNavigate('leave_mgmt')}
                >
                  Open Teachers Management
                </Button>
              </div>
            </Card>
          )}

          {/* Students Attendance */}
          {showAttendance && (
            <Card accentTop className="flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#4B2E2E]/10 flex items-center justify-center text-[#4B2E2E]">
                      <GraduationCap className="w-4.5 h-4.5" />
                    </div>
                    <CardTitle>Students Attendance</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Student academic daily attendance, subject-wise attendance reports, and timetable slot configuration.
                  </p>
                </CardContent>
              </div>
              <div className="p-5 pt-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => onNavigate('attendance_mgmt')}
                >
                  Open Students Attendance
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
