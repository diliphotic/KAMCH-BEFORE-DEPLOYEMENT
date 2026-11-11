import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Home,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  X,
  AlertOctagon,
  Users,
} from 'lucide-react';
import { StudentFeeItem, formatINR } from './fee-types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { BulkHostelMessEnrollmentModal } from './BulkHostelMessEnrollmentModal';

interface BillingPeriod {
  id: number;
  enrollment_id: number;
  student_id: number;
  service_type: 'HOSTEL' | 'MESS';
  period_start_date: string;
  period_end_date: string;
  assessed_amount: number;
  status: string;
}

interface HostelMessSectionProps {
  students: StudentFeeItem[];
  userRole?: string;
  csrfToken?: string;
  onRefresh?: () => void;
  onOpenLedger?: (student: StudentFeeItem) => void;
}

export const HostelMessSection: React.FC<HostelMessSectionProps> = ({
  students,
  userRole,
  csrfToken,
  onRefresh,
  onOpenLedger,
}) => {
  const canTerminate = userRole === 'SUPER_ADMIN' || userRole === 'PRINCIPAL';
  const canManageServices = userRole === 'SUPER_ADMIN' || userRole === 'PRINCIPAL' || userRole === 'OFFICE' || userRole === 'STAFF';

  const [billingPeriods, setBillingPeriods] = useState<BillingPeriod[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterService, setFilterService] = useState<'ALL' | 'HOSTEL' | 'MESS'>('ALL');

  // Bulk enrollment modal state
  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState<boolean>(false);

  // Service toggle / enrollment modal
  const [selectedStudentForService, setSelectedStudentForService] = useState<StudentFeeItem | null>(null);
  const [serviceActionData, setServiceActionData] = useState<{
    serviceType: 'HOSTEL' | 'MESS';
    action: 'JOIN' | 'LEAVE';
    annualFee: number;
  }>({
    serviceType: 'HOSTEL',
    action: 'JOIN',
    annualFee: 30000,
  });
  const [processingService, setProcessingService] = useState<boolean>(false);

  const fetchBillingPeriods = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/fees/services/billing-periods');
      if (!res.ok) throw new Error('Failed to retrieve service billing periods');
      const data = await res.json();
      setBillingPeriods(data.billingPeriods || []);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingPeriods();
  }, []);

  const handleEnrollmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForService) return;

    setProcessingService(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/fees/students/${selectedStudentForService.id}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify(serviceActionData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update student service enrollment');
      }

      setSuccessMsg(data.message || 'Service enrollment successfully updated.');
      setSelectedStudentForService(null);
      await fetchBillingPeriods();
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setProcessingService(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentIdNumber.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterService === 'HOSTEL') return matchesSearch && s.hostelEnrolled;
    if (filterService === 'MESS') return matchesSearch && s.messEnrolled;
    return matchesSearch;
  });

  return (
    <div className="space-y-5">
      {/* Header Info */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Hostel &amp; Mess Auxiliary Services</h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#4B2E2E]/10 text-[#4B2E2E]">
              Campus Operations
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Manage residential accommodations, mess dining enrollments, and annual operational billing cycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageServices && (
            <Button
              size="sm"
              onClick={() => setShowBulkEnrollModal(true)}
              className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white font-bold text-xs"
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Bulk Enroll Students
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={fetchBillingPeriods} disabled={loading} className="text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Policy Callout Banner */}
      <div className="p-4 rounded-xl border border-[#D4AF37]/50 bg-[#F5F5DC]/40 text-xs text-stone-700 space-y-1">
        <div className="font-bold text-[#4B2E2E] flex items-center gap-1.5">
          <Info className="w-4 h-4 text-[#D4AF37]" />
          <span>Annual Service Termination &amp; Billing Policy:</span>
        </div>
        <p className="text-stone-600">
          Enrolling in Hostel or Mess commits the student for the active annual academic term. Per institutional bylaws, voluntary termination during an active billing period does not abate the assessed annual operational charge; full annual liability remains payable unless explicitly waived by Principal resolution.
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Students & Enrollments Table */}
      <Card className="rounded-xl border border-stone-200/90 shadow-xs overflow-hidden bg-white">
        <div className="p-4 border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search students by name or college ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
              />
            </div>

            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg text-xs">
              {(['ALL', 'HOSTEL', 'MESS'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterService(s)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    filterService === s ? 'bg-white shadow-xs text-stone-900' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs text-stone-500">
            Showing {filteredStudents.length} students
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 font-semibold text-stone-600 uppercase tracking-wider">
                <th className="py-2.5 px-3">Student</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-center">Hostel Enrolled</th>
                <th className="py-2.5 px-3 text-center">Mess Enrolled</th>
                <th className="py-2.5 px-3 text-right">Hostel &amp; Mess Due</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-400">
                    No students matching search filter.
                  </td>
                </tr>
              ) : (
                filteredStudents.slice(0, 50).map((st) => (
                  <tr key={st.id} className="hover:bg-stone-50/70">
                    <td className="py-2.5 px-3 font-medium text-stone-900">
                      <div>{st.fullName}</div>
                      <div className="text-[10px] font-mono text-stone-500">
                        {st.studentIdNumber} • Year {st.currentYearOfStudy}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-stone-700">{st.admissionCategory}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          st.hostelEnrolled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        <Home className="w-3 h-3" />
                        {st.hostelEnrolled ? 'Enrolled' : 'Not Enrolled'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          st.messEnrolled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        <Utensils className="w-3 h-3" />
                        {st.messEnrolled ? 'Enrolled' : 'Not Enrolled'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-stone-900">
                      {st.currentAssessment
                        ? formatINR(
                            (st.currentAssessment.assessedHostelFee || 0) +
                              (st.currentAssessment.assessedMessFee || 0)
                          )
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canManageServices && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedStudentForService(st);
                              setServiceActionData({
                                serviceType: st.hostelEnrolled ? 'MESS' : 'HOSTEL',
                                action: 'JOIN',
                                annualFee: 30000,
                              });
                            }}
                            className="text-[11px] py-1 px-2.5 h-auto text-stone-700"
                          >
                            Manage Services
                          </Button>
                        )}

                        {onOpenLedger && (
                          <button
                            type="button"
                            onClick={() => onOpenLedger(st)}
                            className="text-[11px] text-[#4B2E2E] hover:underline font-semibold"
                          >
                            Ledger
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Service Enrollment Modal */}
      {selectedStudentForService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <h3 className="text-base font-bold text-stone-900">Manage Service Enrollment</h3>
                <p className="text-xs text-stone-500">
                  {selectedStudentForService.fullName} ({selectedStudentForService.studentIdNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForService(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEnrollmentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Service Type</label>
                <select
                  value={serviceActionData.serviceType}
                  onChange={(e) =>
                    setServiceActionData({
                      ...serviceActionData,
                      serviceType: e.target.value as any,
                    })
                  }
                  className="w-full py-1.5 px-3 border border-stone-300 rounded-lg bg-white font-semibold"
                >
                  <option value="HOSTEL">Hostel Residential Accommodation</option>
                  <option value="MESS">Mess Dining Services</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Action</label>
                <select
                  value={serviceActionData.action}
                  onChange={(e) =>
                    setServiceActionData({
                      ...serviceActionData,
                      action: e.target.value as any,
                    })
                  }
                  className="w-full py-1.5 px-3 border border-stone-300 rounded-lg bg-white font-semibold"
                >
                  <option value="JOIN">Enroll / Join Service (Adds Annual Fee)</option>
                  <option value="LEAVE">Leave Service (Subject to Termination Bylaw)</option>
                </select>
              </div>

              {serviceActionData.action === 'JOIN' && (
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Annual Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={serviceActionData.annualFee}
                    onChange={(e) =>
                      setServiceActionData({
                        ...serviceActionData,
                        annualFee: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full py-1.5 px-3 border border-stone-300 rounded-lg font-bold text-[#4B2E2E]"
                    required
                  />
                </div>
              )}

              {serviceActionData.action === 'LEAVE' && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 space-y-1">
                  <div className="flex items-center gap-1 font-bold">
                    <AlertOctagon className="w-4 h-4 text-amber-700" />
                    <span>Annual Charge Retained Notice:</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Leaving a service records the withdrawal date. The student's assessed annual liability for the active period is preserved on their financial ledger.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStudentForService(null)}
                  disabled={processingService}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={processingService}
                  className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white font-bold"
                >
                  {processingService ? 'Processing...' : 'Confirm Action'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Enrollment Modal */}
      {showBulkEnrollModal && (
        <BulkHostelMessEnrollmentModal
          csrfToken={csrfToken}
          onClose={() => setShowBulkEnrollModal(false)}
          onSuccess={() => {
            fetchBillingPeriods();
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
};
