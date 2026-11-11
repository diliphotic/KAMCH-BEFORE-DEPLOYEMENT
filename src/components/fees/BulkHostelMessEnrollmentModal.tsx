import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Home,
  Utensils,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Search,
  CheckSquare,
  Square,
  Building2,
  Calendar,
  Info,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { StudentFeeItem, formatINR } from './fee-types';
import { Button } from '../ui/Button';

interface BatchItem {
  id: number;
  code: string;
  name: string;
  currentProfessionalYear: number | null;
  currentPlacementCount: number;
  originalStudentCount: number;
  isActive?: boolean;
}

interface BulkEnrollmentModalProps {
  csrfToken?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProcessResult {
  summary: {
    batchId: number;
    services: string[];
    totalRequestedStudents: number;
    enrolledCount: number;
    skippedCount: number;
    failedCount: number;
  };
  enrolled: Array<{
    studentId: number;
    studentIdNumber: string;
    fullName: string;
    serviceType: string;
    feeAmount: number;
  }>;
  skipped: Array<{
    studentId: number;
    studentIdNumber: string;
    fullName: string;
    serviceType: string;
    reason: string;
  }>;
  failed: Array<{
    studentId: number;
    reason: string;
  }>;
}

export const BulkHostelMessEnrollmentModal: React.FC<BulkEnrollmentModalProps> = ({
  csrfToken,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Batch Selection
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [loadingBatches, setLoadingBatches] = useState<boolean>(true);

  // Step 2: Services & Fees Selection
  const [enrollHostel, setEnrollHostel] = useState<boolean>(true);
  const [enrollMess, setEnrollMess] = useState<boolean>(true);
  const [hostelAnnualFee, setHostelAnnualFee] = useState<number>(30000);
  const [messAnnualFee, setMessAnnualFee] = useState<number>(30000);
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Step 3: Student Selection
  const [batchStudents, setBatchStudents] = useState<StudentFeeItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());

  // Step 4: Review & Confirmation
  const [isConfirmChecked, setIsConfirmChecked] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Step 5: Results
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  // Global Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch active batches on mount
  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    setLoadingBatches(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/students/batches');
      if (!res.ok) throw new Error('Failed to load academic batches');
      const data = await res.json();
      const activeOnly = (data.batches || []).filter((b: any) => b.isActive !== false);
      setBatches(activeOnly);
      if (activeOnly.length > 0) {
        setSelectedBatch(activeOnly[0]);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoadingBatches(false);
    }
  };

  // Fetch students when stepping into Step 3 or when selectedBatch changes
  const fetchBatchStudents = async (batchId: number) => {
    setLoadingStudents(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/fees/students?batchId=${batchId}`);
      if (!res.ok) throw new Error('Failed to load students for selected batch');
      const data = await res.json();
      const rawStudents = data.students || [];

      // Map to StudentFeeItem format
      const mapped: StudentFeeItem[] = rawStudents.map((s: any) => ({
        id: s.id,
        studentIdNumber: s.student_id_number,
        fullName: s.full_name,
        admissionCategory: s.admission_category,
        admissionYear: String(s.admission_year || ''),
        currentYearOfStudy: s.current_year_of_study || 1,
        messEnrolled: Boolean(s.mess_enrolled),
        hostelEnrolled: Boolean(s.hostel_enrolled),
        currentAssessment: s.current_assessment_id
          ? {
              id: s.current_assessment_id,
              assessedHostelFee: parseFloat(s.assessed_hostel_fee || '0'),
              assessedMessFee: parseFloat(s.assessed_mess_fee || '0'),
            }
          : null,
      }));

      setBatchStudents(mapped);

      // Default selection: select students who are not already enrolled in ALL selected services
      const eligibleIds = new Set<number>();
      mapped.forEach((st) => {
        const isFullyEnrolled =
          (enrollHostel ? st.hostelEnrolled : true) &&
          (enrollMess ? st.messEnrolled : true);
        if (!isFullyEnrolled) {
          eligibleIds.add(st.id);
        }
      });
      setSelectedStudentIds(eligibleIds);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleNextStep1To2 = () => {
    if (!selectedBatch) {
      setErrorMsg('Please select an active academic batch.');
      return;
    }
    setErrorMsg(null);
    setCurrentStep(2);
  };

  const handleNextStep2To3 = () => {
    if (!enrollHostel && !enrollMess) {
      setErrorMsg('Please select at least one service (Hostel or Mess) for bulk enrollment.');
      return;
    }
    if (!selectedBatch) return;
    setErrorMsg(null);
    fetchBatchStudents(selectedBatch.id);
    setCurrentStep(3);
  };

  const handleNextStep3To4 = () => {
    if (selectedStudentIds.size === 0) {
      setErrorMsg('Please select at least one student for bulk enrollment.');
      return;
    }
    setErrorMsg(null);
    setIsConfirmChecked(false);
    setCurrentStep(4);
  };

  const handleProcessBulkEnrollment = async () => {
    if (!selectedBatch || !isConfirmChecked) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const services: Array<'HOSTEL' | 'MESS'> = [];
    if (enrollHostel) services.push('HOSTEL');
    if (enrollMess) services.push('MESS');

    try {
      const res = await fetch('/api/fees/services/bulk-enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({
          batchId: selectedBatch.id,
          services,
          studentIds: Array.from(selectedStudentIds),
          effectiveDate,
          hostelAnnualFee,
          messAnnualFee,
          notes: `Bulk enrolled for batch ${selectedBatch.code}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process bulk enrollment');
      }

      setProcessResult(data);
      setCurrentStep(5);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Student list filtering
  const filteredStudents = batchStudents.filter((st) => {
    const q = studentSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      st.fullName.toLowerCase().includes(q) ||
      st.studentIdNumber.toLowerCase().includes(q)
    );
  });

  const toggleSelectAllFiltered = () => {
    const newSelected = new Set(selectedStudentIds);
    const eligibleFiltered = filteredStudents.filter((st) => {
      const isFullyEnrolled =
        (enrollHostel ? st.hostelEnrolled : true) &&
        (enrollMess ? st.messEnrolled : true);
      return !isFullyEnrolled;
    });

    const allEligibleSelected = eligibleFiltered.every((st) => newSelected.has(st.id));

    if (allEligibleSelected) {
      eligibleFiltered.forEach((st) => newSelected.delete(st.id));
    } else {
      eligibleFiltered.forEach((st) => newSelected.add(st.id));
    }
    setSelectedStudentIds(newSelected);
  };

  const toggleStudentSelection = (studentId: number) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };

  // Computation for Review (Step 4)
  const computeReviewStats = () => {
    let newHostelCount = 0;
    let newMessCount = 0;
    let skippedHostelCount = 0;
    let skippedMessCount = 0;

    batchStudents.forEach((st) => {
      if (selectedStudentIds.has(st.id)) {
        if (enrollHostel) {
          if (st.hostelEnrolled) skippedHostelCount++;
          else newHostelCount++;
        }
        if (enrollMess) {
          if (st.messEnrolled) skippedMessCount++;
          else newMessCount++;
        }
      }
    });

    return {
      totalSelectedStudents: selectedStudentIds.size,
      totalNewEnrollments: newHostelCount + newMessCount,
      totalSkippedEnrollments: skippedHostelCount + skippedMessCount,
      newHostelCount,
      newMessCount,
      skippedHostelCount,
      skippedMessCount,
    };
  };

  const reviewStats = computeReviewStats();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col my-auto overflow-hidden border border-stone-200">
        {/* Header */}
        <div className="bg-[#4B2E2E] text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#D4AF37] text-stone-900 font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Bulk Hostel &amp; Mess Enrollment</h3>
              <p className="text-[11px] text-stone-300">
                Batch-wide residential and dining service onboarding
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close modal"
            className="p-1 rounded-md text-stone-300 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps Progress Bar */}
        <div className="bg-stone-100 border-b border-stone-200 px-4 py-2.5 shrink-0">
          <div className="flex items-center justify-between text-xs font-semibold max-w-2xl mx-auto">
            <div
              className={`flex items-center gap-1.5 ${
                currentStep === 1 ? 'text-[#4B2E2E] font-bold' : currentStep > 1 ? 'text-emerald-700' : 'text-stone-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                currentStep === 1 ? 'bg-[#4B2E2E] text-white' : currentStep > 1 ? 'bg-emerald-600 text-white' : 'bg-stone-300 text-stone-600'
              }`}>
                1
              </span>
              <span>Batch</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />

            <div
              className={`flex items-center gap-1.5 ${
                currentStep === 2 ? 'text-[#4B2E2E] font-bold' : currentStep > 2 ? 'text-emerald-700' : 'text-stone-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                currentStep === 2 ? 'bg-[#4B2E2E] text-white' : currentStep > 2 ? 'bg-emerald-600 text-white' : 'bg-stone-300 text-stone-600'
              }`}>
                2
              </span>
              <span>Services</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />

            <div
              className={`flex items-center gap-1.5 ${
                currentStep === 3 ? 'text-[#4B2E2E] font-bold' : currentStep > 3 ? 'text-emerald-700' : 'text-stone-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                currentStep === 3 ? 'bg-[#4B2E2E] text-white' : currentStep > 3 ? 'bg-emerald-600 text-white' : 'bg-stone-300 text-stone-600'
              }`}>
                3
              </span>
              <span>Students</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />

            <div
              className={`flex items-center gap-1.5 ${
                currentStep === 4 ? 'text-[#4B2E2E] font-bold' : currentStep > 4 ? 'text-emerald-700' : 'text-stone-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                currentStep === 4 ? 'bg-[#4B2E2E] text-white' : currentStep > 4 ? 'bg-emerald-600 text-white' : 'bg-stone-300 text-stone-600'
              }`}>
                4
              </span>
              <span>Review</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />

            <div
              className={`flex items-center gap-1.5 ${
                currentStep === 5 ? 'text-emerald-700 font-bold' : 'text-stone-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                currentStep === 5 ? 'bg-emerald-600 text-white' : 'bg-stone-300 text-stone-600'
              }`}>
                5
              </span>
              <span>Results</span>
            </div>
          </div>
        </div>

        {/* Error Callout */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body Canvas */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* STEP 1: Select Active Batch */}
          {currentStep === 1 && (
            <div className="space-y-4 text-xs">
              <div className="border-b border-stone-200 pb-2">
                <h4 className="font-bold text-stone-900 text-sm">Step 1 — Select Active Academic Batch</h4>
                <p className="text-stone-500">
                  Choose the academic batch whose students will be onboarded to Hostel or Mess services.
                </p>
              </div>

              {loadingBatches ? (
                <div className="py-12 text-center text-stone-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#4B2E2E]" />
                  <p>Loading active academic batches...</p>
                </div>
              ) : batches.length === 0 ? (
                <div className="py-10 text-center text-stone-500 bg-stone-50 rounded-lg border border-stone-200">
                  No active academic batches found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {batches.map((b) => {
                    const isSelected = selectedBatch?.id === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBatch(b)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#4B2E2E] bg-[#F5F5DC]/40 shadow-xs'
                            : 'border-stone-200 hover:border-stone-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-stone-900 text-sm block">{b.name}</span>
                            <span className="font-mono text-stone-500 text-[11px] block">
                              Code: {b.code} • Year {b.currentProfessionalYear || 'N/A'}
                            </span>
                          </div>
                          <input
                            type="radio"
                            name="selectedBatch"
                            checked={isSelected}
                            onChange={() => setSelectedBatch(b)}
                            className="mt-1 accent-[#4B2E2E]"
                          />
                        </div>
                        <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px] text-stone-600">
                          <span>Cohort Students:</span>
                          <strong className="text-[#4B2E2E]">
                            {b.currentPlacementCount || b.originalStudentCount || 0} students
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Select Services & Fee Rates */}
          {currentStep === 2 && (
            <div className="space-y-4 text-xs">
              <div className="border-b border-stone-200 pb-2">
                <h4 className="font-bold text-stone-900 text-sm">Step 2 — Select Services &amp; Annual Fees</h4>
                <p className="text-stone-500">
                  Select which residential or dining services to enroll students in, and set the annual fee rates.
                </p>
              </div>

              {/* Service Presets */}
              <div className="flex items-center gap-2 pb-2">
                <span className="font-semibold text-stone-700">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setEnrollHostel(true);
                    setEnrollMess(false);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                    enrollHostel && !enrollMess
                      ? 'bg-[#4B2E2E] text-white border-[#4B2E2E]'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Hostel Only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnrollHostel(false);
                    setEnrollMess(true);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                    !enrollHostel && enrollMess
                      ? 'bg-[#4B2E2E] text-white border-[#4B2E2E]'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Mess Only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnrollHostel(true);
                    setEnrollMess(true);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                    enrollHostel && enrollMess
                      ? 'bg-[#4B2E2E] text-white border-[#4B2E2E]'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Both Hostel &amp; Mess
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hostel Card */}
                <div
                  className={`p-4 rounded-xl border-2 transition-all ${
                    enrollHostel
                      ? 'border-[#4B2E2E] bg-[#F5F5DC]/30'
                      : 'border-stone-200 bg-stone-50/50 opacity-70'
                  }`}
                >
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enrollHostel}
                      onChange={(e) => setEnrollHostel(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#4B2E2E]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-stone-900 text-sm">
                        <Home className="w-4 h-4 text-[#4B2E2E]" />
                        <span>Hostel Accommodation</span>
                      </div>
                      <p className="text-stone-500 text-[11px] mt-0.5">
                        Campus residential quarters &amp; room allotment
                      </p>
                    </div>
                  </label>

                  {enrollHostel && (
                    <div className="mt-3 pt-3 border-t border-stone-200 space-y-1">
                      <label className="block text-[11px] font-semibold text-stone-700">
                        Hostel Annual Fee (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={hostelAnnualFee}
                        onChange={(e) => setHostelAnnualFee(parseFloat(e.target.value) || 0)}
                        className="w-full py-1.5 px-3 border border-stone-300 rounded-lg font-bold text-[#4B2E2E] bg-white"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Mess Card */}
                <div
                  className={`p-4 rounded-xl border-2 transition-all ${
                    enrollMess
                      ? 'border-[#4B2E2E] bg-[#F5F5DC]/30'
                      : 'border-stone-200 bg-stone-50/50 opacity-70'
                  }`}
                >
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enrollMess}
                      onChange={(e) => setEnrollMess(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#4B2E2E]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-stone-900 text-sm">
                        <Utensils className="w-4 h-4 text-[#4B2E2E]" />
                        <span>Mess Dining Services</span>
                      </div>
                      <p className="text-stone-500 text-[11px] mt-0.5">
                        Institutional dining hall catering &amp; meal subscription
                      </p>
                    </div>
                  </label>

                  {enrollMess && (
                    <div className="mt-3 pt-3 border-t border-stone-200 space-y-1">
                      <label className="block text-[11px] font-semibold text-stone-700">
                        Mess Annual Fee (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={messAnnualFee}
                        onChange={(e) => setMessAnnualFee(parseFloat(e.target.value) || 0)}
                        className="w-full py-1.5 px-3 border border-stone-300 rounded-lg font-bold text-[#4B2E2E] bg-white"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Effective Start Date */}
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 max-w-sm">
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Effective Enrollment Date
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full py-1.5 px-3 border border-stone-300 rounded-lg font-mono bg-white"
                  required
                />
              </div>
            </div>
          )}

          {/* STEP 3: Select Students */}
          {currentStep === 3 && (
            <div className="space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2">
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">
                    Step 3 — Select Students ({selectedBatch?.code})
                  </h4>
                  <p className="text-stone-500">
                    Select students to enroll. Students already enrolled in selected services will be skipped.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-stone-600 bg-stone-100 px-3 py-1.5 rounded-lg text-[11px] font-semibold">
                  <span>Selected:</span>
                  <strong className="text-[#4B2E2E] text-xs">
                    {selectedStudentIds.size} of {batchStudents.length}
                  </strong>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search by student name or roll number..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:ring-2 focus:ring-[#4B2E2E]/20"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAllFiltered}
                  className="text-xs shrink-0"
                >
                  Select / Deselect All
                </Button>
              </div>

              {/* Student Selection Table */}
              {loadingStudents ? (
                <div className="py-12 text-center text-stone-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#4B2E2E]" />
                  <p>Loading students for {selectedBatch?.name}...</p>
                </div>
              ) : (
                <div className="border border-stone-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 sticky top-0 z-10 font-semibold text-stone-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-3 text-center w-10">Select</th>
                        <th className="py-2 px-3">Student Name</th>
                        <th className="py-2 px-3">Roll / Reg No</th>
                        <th className="py-2 px-3 text-center">Hostel</th>
                        <th className="py-2 px-3 text-center">Mess</th>
                        <th className="py-2 px-3 text-center">Enrollment Eligibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-stone-400">
                            No students found in this batch matching query.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((st) => {
                          const isFullyEnrolled =
                            (enrollHostel ? st.hostelEnrolled : true) &&
                            (enrollMess ? st.messEnrolled : true);
                          const isChecked = selectedStudentIds.has(st.id);

                          return (
                            <tr
                              key={st.id}
                              className={`hover:bg-stone-50/80 transition-colors ${
                                isFullyEnrolled ? 'bg-stone-50/50 opacity-80' : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleStudentSelection(st.id)}
                                  className="accent-[#4B2E2E] w-4 h-4 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 font-medium text-stone-900">
                                {st.fullName}
                              </td>
                              <td className="py-2 px-3 font-mono text-stone-600 text-[11px]">
                                {st.studentIdNumber}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    st.hostelEnrolled
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-stone-100 text-stone-500'
                                  }`}
                                >
                                  {st.hostelEnrolled ? 'Active' : 'No'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    st.messEnrolled
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-stone-100 text-stone-500'
                                  }`}
                                >
                                  {st.messEnrolled ? 'Active' : 'No'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                {isFullyEnrolled ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
                                    Already Enrolled in Selected Service(s)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Eligible to Join
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Review and Confirm */}
          {currentStep === 4 && (
            <div className="space-y-4 text-xs">
              <div className="border-b border-stone-200 pb-2">
                <h4 className="font-bold text-stone-900 text-sm">
                  Step 4 — Review &amp; Confirm Bulk Enrollment
                </h4>
                <p className="text-stone-500">
                  Verify the bulk enrollment summary before updating student financial ledgers.
                </p>
              </div>

              {/* Review Summary Breakdown Box */}
              <div className="p-4 rounded-xl border border-[#D4AF37]/60 bg-[#F5F5DC]/40 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-stone-800">
                  <div>
                    <span className="text-stone-500 block text-[11px]">Academic Batch:</span>
                    <strong className="text-stone-900 text-xs">{selectedBatch?.name}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[11px]">Effective Date:</span>
                    <strong className="font-mono text-stone-900 text-xs">{effectiveDate}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[11px]">Selected Services:</span>
                    <strong className="text-[#4B2E2E] text-xs">
                      {[enrollHostel && 'Hostel', enrollMess && 'Mess'].filter(Boolean).join(' & ')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[11px]">Students Selected:</span>
                    <strong className="text-stone-900 text-xs">{reviewStats.totalSelectedStudents} students</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-stone-300/60">
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] block font-medium">New Enrollments To Create:</span>
                      <strong className="text-base font-black text-emerald-700">
                        {reviewStats.totalNewEnrollments} enrollment(s)
                      </strong>
                    </div>
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] block font-medium">Skipped (Already Active):</span>
                      <strong className="text-base font-black text-amber-700">
                        {reviewStats.totalSkippedEnrollments} enrollment(s)
                      </strong>
                    </div>
                    <Info className="w-6 h-6 text-amber-600 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Fee Rates Info */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-stone-700 space-y-1 text-[11px]">
                <div className="font-bold text-[#4B2E2E] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Financial Ledger Impact:</span>
                </div>
                <p>
                  {enrollHostel && `• Hostel Annual Fee: ${formatINR(hostelAnnualFee)} per student`}
                  {enrollHostel && enrollMess && ' | '}
                  {enrollMess && `• Mess Annual Fee: ${formatINR(messAnnualFee)} per student`}
                </p>
                <p className="text-stone-500">
                  Each new enrollment adds the annual service fee to the student's active 2026-2027 fee assessment and opens an active service billing period.
                </p>
              </div>

              {/* Explicit Confirmation Checkbox */}
              <label className="flex items-start gap-2 p-3 bg-stone-100 rounded-lg border border-stone-300 cursor-pointer text-xs font-medium text-stone-900">
                <input
                  type="checkbox"
                  checked={isConfirmChecked}
                  onChange={(e) => setIsConfirmChecked(e.target.checked)}
                  className="mt-0.5 accent-[#4B2E2E] w-4 h-4"
                />
                <span>
                  I confirm that I have reviewed the student list and authorize bulk enrollment of {reviewStats.totalSelectedStudents} selected student(s) into KAMCH Hostel &amp; Mess services.
                </span>
              </label>
            </div>
          )}

          {/* STEP 5: Results Summary */}
          {currentStep === 5 && processResult && (
            <div className="space-y-4 text-xs">
              <div className="border-b border-stone-200 pb-2">
                <h4 className="font-bold text-stone-900 text-sm">
                  Step 5 — Bulk Enrollment Results
                </h4>
                <p className="text-stone-500">
                  Execution completed successfully. Review the batch enrollment summary below.
                </p>
              </div>

              {/* Results Stat Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[11px] text-emerald-700 font-semibold block">Successfully Enrolled</span>
                  <strong className="text-2xl font-black text-emerald-800">
                    {processResult.summary.enrolledCount}
                  </strong>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <span className="text-[11px] text-amber-700 font-semibold block">Skipped (Active)</span>
                  <strong className="text-2xl font-black text-amber-800">
                    {processResult.summary.skippedCount}
                  </strong>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                  <span className="text-[11px] text-rose-700 font-semibold block">Failed</span>
                  <strong className="text-2xl font-black text-rose-800">
                    {processResult.summary.failedCount}
                  </strong>
                </div>
              </div>

              {/* Detailed Enrolled Table */}
              {processResult.enrolled.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="font-bold text-stone-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Newly Enrolled Students ({processResult.enrolled.length}):</span>
                  </h5>
                  <div className="border border-stone-200 rounded-lg max-h-44 overflow-y-auto bg-white">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-stone-50 border-b border-stone-200 font-semibold text-stone-600">
                        <tr>
                          <th className="py-2 px-3">Student Name</th>
                          <th className="py-2 px-3">Roll / Reg No</th>
                          <th className="py-2 px-3">Service Enrolled</th>
                          <th className="py-2 px-3 text-right">Annual Fee Added</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {processResult.enrolled.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-3 font-medium text-stone-900">{item.fullName}</td>
                            <td className="py-1.5 px-3 font-mono text-stone-600">{item.studentIdNumber}</td>
                            <td className="py-1.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                {item.serviceType}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-[#4B2E2E]">
                              {formatINR(item.feeAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed Skipped Table */}
              {processResult.skipped.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <h5 className="font-bold text-stone-800 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-600" />
                    <span>Skipped Students ({processResult.skipped.length}):</span>
                  </h5>
                  <div className="border border-stone-200 rounded-lg max-h-36 overflow-y-auto bg-stone-50/50">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-stone-100 border-b border-stone-200 font-semibold text-stone-600">
                        <tr>
                          <th className="py-2 px-3">Student Name</th>
                          <th className="py-2 px-3">Service</th>
                          <th className="py-2 px-3">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200/60">
                        {processResult.skipped.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-3 text-stone-800">{item.fullName} ({item.studentIdNumber})</td>
                            <td className="py-1.5 px-3 font-semibold text-stone-700">{item.serviceType}</td>
                            <td className="py-1.5 px-3 text-amber-800 font-medium">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0 text-xs">
          <div>
            {currentStep > 1 && currentStep < 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                disabled={isSubmitting}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 5 ? (
              <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            ) : null}

            {currentStep === 1 && (
              <Button
                size="sm"
                onClick={handleNextStep1To2}
                disabled={!selectedBatch}
                className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white font-bold"
              >
                Next: Select Services
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}

            {currentStep === 2 && (
              <Button
                size="sm"
                onClick={handleNextStep2To3}
                disabled={!enrollHostel && !enrollMess}
                className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white font-bold"
              >
                Next: Select Students
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}

            {currentStep === 3 && (
              <Button
                size="sm"
                onClick={handleNextStep3To4}
                disabled={selectedStudentIds.size === 0}
                className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white font-bold"
              >
                Review &amp; Confirm ({selectedStudentIds.size})
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}

            {currentStep === 4 && (
              <Button
                size="sm"
                onClick={handleProcessBulkEnrollment}
                disabled={!isConfirmChecked || isSubmitting}
                className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white font-bold"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Processing Enrollments...
                  </>
                ) : (
                  'Confirm & Process Bulk Enrollment'
                )}
              </Button>
            )}

            {currentStep === 5 && (
              <Button
                size="sm"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white font-bold"
              >
                Done &amp; Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
