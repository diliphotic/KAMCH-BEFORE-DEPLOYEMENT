import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  Search,
  UserPlus,
  Receipt,
  CheckCircle2,
  Clock,
  Printer,
  ShieldCheck,
  AlertCircle,
  FileText,
  BadgePercent,
  Calendar,
  Building,
  DollarSign,
  Utensils,
  RefreshCw,
  Sliders,
  RotateCcw,
  X,
  PieChart,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FeeDashboardSection } from '../components/fees/FeeDashboardSection';
import { StudentFeesSection } from '../components/fees/StudentFeesSection';
import { PaymentCollectionSection } from '../components/fees/PaymentCollectionSection';
import { BankVerificationSection } from '../components/fees/BankVerificationSection';
import { ReceiptsSection } from '../components/fees/ReceiptsSection';
import { HostelMessSection } from '../components/fees/HostelMessSection';
import { FeeStructuresSection } from '../components/fees/FeeStructuresSection';
import { ConcessionsSection } from '../components/fees/ConcessionsSection';
import { FinancialReportsSection } from '../components/fees/FinancialReportsSection';
import { AcademicYearSettingsSection } from '../components/fees/AcademicYearSettingsSection';
import { SingleComponentPaymentModal } from '../components/fees/SingleComponentPaymentModal';
import { StudentLedgerModal } from '../components/fees/StudentLedgerModal';
import { PrintableReceiptModal } from '../components/fees/PrintableReceiptModal';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Notification } from '../components/ui/Notification';
import { StudentFeeItem, FeeStructure, formatINR, FeeComponentType } from '../components/fees/fee-types';

export { formatINR };
export type { FeeStructure, StudentFeeItem };

export type FeesTab =
  | 'student_fees'
  | 'verification'
  | 'receipts'
  | 'hostel_mess'
  | 'structures'
  | 'concessions'
  | 'reports'
  | 'settings';

export interface FeesManagementViewProps {
  initialSelectedStudentId?: number | null;
  onClearInitialSelectedStudent?: () => void;
  onRegisterInStudentManagement?: () => void;
  onOpenStudentProfile?: (studentId: number) => void;
}

export const FeesManagementView: React.FC<FeesManagementViewProps> = ({
  initialSelectedStudentId,
  onClearInitialSelectedStudent,
  onRegisterInStudentManagement,
  onOpenStudentProfile,
}) => {
  const { user, csrfToken } = useAuth();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isPrincipal = user?.role === 'PRINCIPAL';
  const isSecretary = user?.role === 'SECRETARY';
  const isOfficeOrStaff = user?.role === 'OFFICE' || user?.role === 'STAFF';

  // Navigation state
  const [activeTab, setActiveTab] = useState<FeesTab>('student_fees');

  // Key Institutional Stats
  const [stats, setStats] = useState({
    totalAssessed: 0,
    totalCollected: 0,
    totalPending: 0,
    totalOutstanding: 0,
    pendingTransfersCount: 0,
    unprintedReceiptsCount: 0,
    studentCount: 0,
  });

  // Students List
  const [students, setStudents] = useState<StudentFeeItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);

  // Notification Banner
  const [notification, setNotification] = useState<{
    type: 'success' | 'warning' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'warning' | 'info', title: string, message: string) => {
    setNotification({ type, title, message });
  };

  // Potential duplicate student diagnostics
  const [potentialDuplicates, setPotentialDuplicates] = useState<
    Array<{
      studentAId: number;
      studentAIdNumber: string;
      studentAName: string;
      studentBId: number;
      studentBIdNumber: string;
      studentBName: string;
      reasons: string[];
    }>
  >([]);

  // Modals state
  const [singlePaymentStudent, setSinglePaymentStudent] = useState<StudentFeeItem | null>(null);
  const [ledgerModalStudent, setLedgerModalStudent] = useState<StudentFeeItem | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/fees/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          ...data,
          unprintedReceiptsCount: data.unprintedReceiptsCount || 0,
        });
      }
    } catch (err) {
      console.warn('Failed to fetch fee stats:', err);
    }
  }, []);

  // Fetch Students List
  const fetchStudents = useCallback(async () => {
    setIsLoadingStudents(true);
    try {
      const res = await fetch('/api/fees/students');
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (err) {
      console.warn('Failed to fetch students:', err);
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  const fetchRegistryDiagnostics = useCallback(async () => {
    try {
      const res = await fetch('/api/students/registry-diagnostics');
      if (res.ok) {
        const data = await res.json();
        setPotentialDuplicates(data.potentialDuplicates || []);
      }
    } catch {
      // Ignore diagnostics fetch failure if role lacks access
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStats(), fetchStudents(), fetchRegistryDiagnostics()]);
  }, [fetchStats, fetchStudents, fetchRegistryDiagnostics]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Handle Initial selected student if passed from route
  useEffect(() => {
    if (initialSelectedStudentId && students.length > 0) {
      const match = students.find((s) => s.id === initialSelectedStudentId);
      if (match) {
        setLedgerModalStudent(match);
        if (onClearInitialSelectedStudent) {
          onClearInitialSelectedStudent();
        }
      }
    }
  }, [initialSelectedStudentId, students, onClearInitialSelectedStudent]);

  // Initialize 2026-2027 Fee Assessment
  const handleInitializeAssessment = async (studentId: number) => {
    if (!csrfToken) {
      showNotification('warning', 'Session Notice', 'Session expired. Please refresh the page.');
      return;
    }

    try {
      const res = await fetch(`/api/fees/students/${studentId}/initialize-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', 'Fee Assessment Initialized', data.message || 'Assessment successfully generated.');
        await refreshAll();
        const updated = students.find((s) => s.id === studentId);
        if (updated) {
          setLedgerModalStudent(updated);
        }
      } else {
        showNotification('warning', 'Assessment Notice', data.error || 'Failed to initialize fee assessment.');
      }
    } catch {
      showNotification('warning', 'Network Notice', 'Network error while initializing fee assessment.');
    }
  };

  // Safe tab switcher ensuring role boundaries
  const handleNavigateTab = (tab: string) => {
    if (isSecretary && !['student_fees', 'verification', 'receipts', 'reports'].includes(tab)) {
      showNotification('warning', 'Access Restricted', 'Secretary access is strictly limited to Development fee management.');
      return;
    }
    setActiveTab(tab as FeesTab);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 print:p-0 print:m-0 print:max-w-none">
      <div className="space-y-6 print:hidden">
        {/* Page Header */}
        <PageHeader
          title="Fees Management"
          description="Institutional fee management engine: 4-component accounting (College, Development, Hostel, Mess), bank verification, receipts print queue, and financial reconciliation."
          breadcrumbs={[
            { label: 'ERP Home', href: '#' },
            { label: 'Institutional Accounts', href: '#' },
            { label: 'Fees Management', current: true },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAll}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
              {!isSecretary && onRegisterInStudentManagement && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onRegisterInStudentManagement}
                  className="flex items-center gap-1.5 bg-[#4B2E2E] text-white hover:bg-[#3d2525]"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Register Student
                </Button>
              )}
            </div>
          }
        />

        {/* Notifications */}
        {notification && (
          <Notification
            type={notification.type}
            title={notification.title}
            message={notification.message}
            onDismiss={() => setNotification(null)}
          />
        )}

        {/* Diagnostic Notice */}
        {potentialDuplicates.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1.5">
            <div className="font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                {potentialDuplicates.length} Potential Duplicate Student Record Pair(s) Detected in Shared Registry (Read-Only Alert)
              </span>
            </div>
            <p className="text-[11px] text-amber-900">
              Verify exact Student ID before recording fee collections:
            </p>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-900">
              {potentialDuplicates.slice(0, 5).map((d, idx) => (
                <li key={idx}>
                  <span className="font-mono font-semibold">{d.studentAIdNumber}</span> ({d.studentAName}) &harr;{' '}
                  <span className="font-mono font-semibold">{d.studentBIdNumber}</span> ({d.studentBName}) — {d.reasons.join('; ')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick KPI Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl border border-stone-200/70 shadow-xs bg-white hover:border-amber-200 transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Total Assessed Fees</p>
                <h3 className="text-xl font-bold text-stone-900 mt-1">₹{stats.totalAssessed.toLocaleString('en-IN')}</h3>
                <p className="text-xs text-stone-500 mt-0.5">{stats.studentCount} enrolled student{stats.studentCount === 1 ? '' : 's'}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-[#D4AF37]">
                <DollarSign className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-stone-200/70 shadow-xs bg-white hover:border-emerald-200 transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Verified Collections</p>
                <h3 className="text-xl font-bold text-emerald-700 mt-1">₹{stats.totalCollected.toLocaleString('en-IN')}</h3>
                <p className="text-xs text-emerald-600 mt-0.5">Cash &amp; verified bank transfers</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-stone-200/70 shadow-xs bg-white hover:border-amber-200 transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Pending Bank Transfers</p>
                <h3 className="text-xl font-bold text-amber-700 mt-1">₹{stats.totalPending.toLocaleString('en-IN')}</h3>
                <p className="text-xs text-amber-600 mt-0.5">{stats.pendingTransfersCount} awaiting passbook check</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-stone-200/70 shadow-xs bg-white hover:border-rose-200 transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Outstanding Balance</p>
                <h3 className="text-xl font-bold text-rose-700 mt-1">₹{stats.totalOutstanding.toLocaleString('en-IN')}</h3>
                <p className="text-xs text-stone-500 mt-0.5">Excludes unverified transfers</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertCircle className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Square Navigation Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
          {/* 1. Student Fees */}
          <button
            type="button"
            onClick={() => handleNavigateTab('student_fees')}
            className={`p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer aspect-square relative group ${
              activeTab === 'student_fees'
                ? 'bg-[#4B2E2E] text-white border-[#4B2E2E] shadow-md ring-2 ring-[#4B2E2E]/20'
                : 'bg-white text-stone-700 border-stone-200/80 hover:border-[#4B2E2E]/40 hover:bg-[#F5F5DC]/40 shadow-xs'
            }`}
          >
            <div className={`p-2 rounded-lg mb-2 ${activeTab === 'student_fees' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-stone-100 text-[#4B2E2E] group-hover:bg-[#4B2E2E]/10'}`}>
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-xs font-bold leading-tight">Student Fees</span>
          </button>

          {/* 2. Bank Verification */}
          <button
            type="button"
            onClick={() => handleNavigateTab('verification')}
            className={`p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer aspect-square relative group ${
              activeTab === 'verification'
                ? 'bg-[#4B2E2E] text-white border-[#4B2E2E] shadow-md ring-2 ring-[#4B2E2E]/20'
                : 'bg-white text-stone-700 border-stone-200/80 hover:border-[#4B2E2E]/40 hover:bg-[#F5F5DC]/40 shadow-xs'
            }`}
          >
            {stats.pendingTransfersCount > 0 && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white shadow-xs">
                {stats.pendingTransfersCount}
              </span>
            )}
            <div className={`p-2 rounded-lg mb-2 ${activeTab === 'verification' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-stone-100 text-[#4B2E2E] group-hover:bg-[#4B2E2E]/10'}`}>
              <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-xs font-bold leading-tight">Bank Verification</span>
          </button>

          {/* 3. Receipts */}
          <button
            type="button"
            onClick={() => handleNavigateTab('receipts')}
            className={`p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer aspect-square relative group ${
              activeTab === 'receipts'
                ? 'bg-[#4B2E2E] text-white border-[#4B2E2E] shadow-md ring-2 ring-[#4B2E2E]/20'
                : 'bg-white text-stone-700 border-stone-200/80 hover:border-[#4B2E2E]/40 hover:bg-[#F5F5DC]/40 shadow-xs'
            }`}
          >
            {stats.unprintedReceiptsCount > 0 && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D4AF37] text-stone-900 shadow-xs">
                {stats.unprintedReceiptsCount}
              </span>
            )}
            <div className={`p-2 rounded-lg mb-2 ${activeTab === 'receipts' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-stone-100 text-[#4B2E2E] group-hover:bg-[#4B2E2E]/10'}`}>
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-xs font-bold leading-tight">Receipts</span>
          </button>

          {/* 4. Hostel & Mess */}
          {!isSecretary && (
            <button
              type="button"
              onClick={() => handleNavigateTab('hostel_mess')}
              className={`p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer aspect-square relative group ${
                activeTab === 'hostel_mess'
                  ? 'bg-[#4B2E2E] text-white border-[#4B2E2E] shadow-md ring-2 ring-[#4B2E2E]/20'
                  : 'bg-white text-stone-700 border-stone-200/80 hover:border-[#4B2E2E]/40 hover:bg-[#F5F5DC]/40 shadow-xs'
              }`}
            >
              <div className={`p-2 rounded-lg mb-2 ${activeTab === 'hostel_mess' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-stone-100 text-[#4B2E2E] group-hover:bg-[#4B2E2E]/10'}`}>
                <Utensils className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-xs font-bold leading-tight">Hostel &amp; Mess</span>
            </button>
          )}

          {/* 5. Fee Structures */}
          {!isSecretary && (isSuperAdmin || isPrincipal) && (
            <button
              type="button"
              onClick={() => handleNavigateTab('structures')}
              className={`p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer aspect-square relative group ${
                activeTab === 'structures'
                  ? 'bg-[#4B2E2E] text-white border-[#4B2E2E] shadow-md ring-2 ring-[#4B2E2E]/20'
                  : 'bg-white text-stone-700 border-stone-200/80 hover:border-[#4B2E2E]/40 hover:bg-[#F5F5DC]/40 shadow-xs'
              }`}
            >
              <div className={`p-2 rounded-lg mb-2 ${activeTab === 'structures' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-stone-100 text-[#4B2E2E] group-hover:bg-[#4B2E2E]/10'}`}>
                <Sliders className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-xs font-bold leading-tight">Fee Structures</span>
            </button>
          )}

          {/* 6. Concessions */}
          {!isSecretary && (isSuperAdmin || isPrincipal) && (
            <button
              type="button"
              onClick={() => handleNavigateTab('concessions')}
              className={`p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer aspect-square relative group ${
                activeTab === 'concessions'
                  ? 'bg-[#4B2E2E] text-white border-[#4B2E2E] shadow-md ring-2 ring-[#4B2E2E]/20'
                  : 'bg-white text-stone-700 border-stone-200/80 hover:border-[#4B2E2E]/40 hover:bg-[#F5F5DC]/40 shadow-xs'
              }`}
            >
              <div className={`p-2 rounded-lg mb-2 ${activeTab === 'concessions' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-stone-100 text-[#4B2E2E] group-hover:bg-[#4B2E2E]/10'}`}>
                <BadgePercent className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-xs font-bold leading-tight">Concessions</span>
            </button>
          )}

          {/* 7. Financial Reports */}
          <button
            type="button"
            onClick={() => handleNavigateTab('reports')}
            className={`p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer aspect-square relative group ${
              activeTab === 'reports'
                ? 'bg-[#4B2E2E] text-white border-[#4B2E2E] shadow-md ring-2 ring-[#4B2E2E]/20'
                : 'bg-white text-stone-700 border-stone-200/80 hover:border-[#4B2E2E]/40 hover:bg-[#F5F5DC]/40 shadow-xs'
            }`}
          >
            <div className={`p-2 rounded-lg mb-2 ${activeTab === 'reports' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-stone-100 text-[#4B2E2E] group-hover:bg-[#4B2E2E]/10'}`}>
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-xs font-bold leading-tight">Financial Reports</span>
          </button>

          {/* 8. Academic Year Settings */}
          {!isSecretary && (
            <button
              type="button"
              onClick={() => handleNavigateTab('settings')}
              className={`p-3.5 sm:p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer aspect-square relative group ${
                activeTab === 'settings'
                  ? 'bg-[#4B2E2E] text-white border-[#4B2E2E] shadow-md ring-2 ring-[#4B2E2E]/20'
                  : 'bg-white text-stone-700 border-stone-200/80 hover:border-[#4B2E2E]/40 hover:bg-[#F5F5DC]/40 shadow-xs'
              }`}
            >
              <div className={`p-2 rounded-lg mb-2 ${activeTab === 'settings' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-stone-100 text-[#4B2E2E] group-hover:bg-[#4B2E2E]/10'}`}>
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-xs font-bold leading-tight">Academic Year Settings</span>
            </button>
          )}
        </div>

        {/* SECTION: Student Fees (with Pay button on every row) */}
        {activeTab === 'student_fees' && (
          <StudentFeesSection
            students={students}
            loading={isLoadingStudents}
            onRefresh={refreshAll}
            onPayStudent={(s) => setSinglePaymentStudent(s)}
            onOpenLedger={(s) => setLedgerModalStudent(s)}
            onInitializeAssessment={handleInitializeAssessment}
            userRole={user?.role}
          />
        )}

        {/* SECTION 4: Bank Transfer Verification */}
        {activeTab === 'verification' && (
          <BankVerificationSection
            userRole={user?.role}
            csrfToken={csrfToken ?? undefined}
            onPaymentProcessed={refreshAll}
            onOpenLedger={(stId) => {
              const st = students.find((s) => s.id === stId);
              if (st) setLedgerModalStudent(st);
            }}
          />
        )}

        {/* SECTION 5: Receipts (Queue & History) */}
        {activeTab === 'receipts' && (
          <ReceiptsSection
            userRole={user?.role}
            csrfToken={csrfToken ?? undefined}
          />
        )}

        {/* SECTION 6: Hostel & Mess Management */}
        {activeTab === 'hostel_mess' && !isSecretary && (
          <HostelMessSection
            students={students}
            userRole={user?.role}
            csrfToken={csrfToken ?? undefined}
            onRefresh={refreshAll}
            onOpenLedger={(s) => setLedgerModalStudent(s)}
          />
        )}

        {/* SECTION 7: Fee Structures Configuration */}
        {activeTab === 'structures' && !isSecretary && (
          <FeeStructuresSection
            userRole={user?.role}
            csrfToken={csrfToken ?? undefined}
          />
        )}

        {/* SECTION 8: Fee Concessions */}
        {activeTab === 'concessions' && !isSecretary && (
          <ConcessionsSection
            students={students}
            userRole={user?.role}
            csrfToken={csrfToken ?? undefined}
            onConcessionGranted={refreshAll}
            onOpenLedger={(s) => setLedgerModalStudent(s)}
          />
        )}

        {/* SECTION 9: Financial Reports */}
        {activeTab === 'reports' && (
          <FinancialReportsSection
            userRole={user?.role}
            onOpenLedger={(stId) => {
              const st = students.find((s) => s.id === stId);
              if (st) setLedgerModalStudent(st);
            }}
            onNavigateTab={handleNavigateTab}
          />
        )}

        {/* SECTION 10: Academic Year Settings */}
        {activeTab === 'settings' && !isSecretary && (
          <AcademicYearSettingsSection
            userRole={user?.role}
            csrfToken={csrfToken ?? undefined}
          />
        )}

        {/* MODAL: Single Component Payment Modal */}
        {singlePaymentStudent && (
          <SingleComponentPaymentModal
            student={singlePaymentStudent}
            userRole={user?.role}
            csrfToken={csrfToken ?? undefined}
            onClose={() => setSinglePaymentStudent(null)}
            onSuccess={(_recNum, recId) => {
              setSinglePaymentStudent(null);
              refreshAll();
              if (recId) {
                setSelectedReceiptId(recId);
              }
            }}
            onViewReceipt={(id) => setSelectedReceiptId(id)}
          />
        )}

        {/* MODAL: Student Financial Ledger Modal */}
        {ledgerModalStudent && (
          <StudentLedgerModal
            student={ledgerModalStudent}
            userRole={user?.role}
            csrfToken={csrfToken ?? undefined}
            onClose={() => setLedgerModalStudent(null)}
            onPayClicked={() => {
              const s = ledgerModalStudent;
              setLedgerModalStudent(null);
              setSinglePaymentStudent(s);
            }}
            onViewReceipt={(id) => setSelectedReceiptId(id)}
            onLedgerUpdated={refreshAll}
          />
        )}

        {/* MODAL: Official Printable Receipt Modal with Reprint Watermark & Mark Printed Confirmation */}
        {selectedReceiptId && (
          <PrintableReceiptModal
            receiptId={selectedReceiptId}
            csrfToken={csrfToken ?? undefined}
            onClose={() => setSelectedReceiptId(null)}
            onPrintConfirmed={refreshAll}
          />
        )}
      </div>
    </div>
  );
};
export default FeesManagementView;
