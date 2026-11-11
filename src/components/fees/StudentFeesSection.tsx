import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  CreditCard,
  FileText,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Building,
  User,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { StudentFeeItem, formatINR } from './fee-types';
import { Button } from '../ui/Button';

interface StudentFeesSectionProps {
  students: StudentFeeItem[];
  loading: boolean;
  onRefresh: () => void;
  onPayStudent: (student: StudentFeeItem) => void;
  onOpenLedger: (student: StudentFeeItem) => void;
  onInitializeAssessment: (studentId: number) => void;
  userRole?: string;
}

export const StudentFeesSection: React.FC<StudentFeesSectionProps> = ({
  students,
  loading,
  onRefresh,
  onPayStudent,
  onOpenLedger,
  onInitializeAssessment,
  userRole,
}) => {
  const isSecretary = userRole === 'SECRETARY';

  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (categoryFilter !== 'ALL' && s.admissionCategory !== categoryFilter) return false;
      if (yearFilter !== 'ALL' && String(s.currentYearOfStudy) !== yearFilter) return false;
      if (statusFilter === 'OUTSTANDING' && s.outstandingBalance <= 0) return false;
      if (statusFilter === 'PAID' && s.outstandingBalance > 0) return false;
      if (statusFilter === 'PENDING' && s.totalPending <= 0) return false;

      if (search.trim()) {
        const term = search.toLowerCase();
        return (
          s.fullName.toLowerCase().includes(term) ||
          s.studentIdNumber.toLowerCase().includes(term) ||
          (s.temporaryRollNumber || '').toLowerCase().includes(term) ||
          (s.permanentUniversityNumber || '').toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [students, categoryFilter, yearFilter, statusFilter, search]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search student name, ID number, roll..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
          >
            <option value="ALL">All Categories</option>
            <option value="GOVERNMENT">Government</option>
            <option value="MANAGEMENT_PRIVATE">Management / Private</option>
            <option value="NRI">NRI</option>
          </select>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
          >
            <option value="ALL">All Years</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-2 px-3 border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="OUTSTANDING">With Outstanding Balance</option>
            <option value="PAID">Fully Settled</option>
            <option value="PENDING">Pending Bank Transfers</option>
          </select>

          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-xl border border-stone-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-stone-500">
            <div className="inline-block animate-spin w-7 h-7 border-2 border-[#4B2E2E] border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-medium">Loading student fee records...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-stone-500 px-4">
            <AlertCircle className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-stone-800">No Students Found</h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              No student records matched your current search and filter selections.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#4B2E2E]/5 border-b border-stone-200 text-stone-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-3">Admission &amp; Services</th>
                  <th className="py-3 px-3 text-right">Assessed Fee</th>
                  <th className="py-3 px-3 text-right">Verified Paid</th>
                  <th className="py-3 px-3 text-right">Pending</th>
                  <th className="py-3 px-3 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredStudents.map((st) => {
                  const hasAssessment = Boolean(st.currentAssessment);
                  const isFullyPaid = hasAssessment && st.outstandingBalance <= 0;

                  return (
                    <tr key={st.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900 text-sm">{st.fullName}</div>
                        <div className="text-[11px] font-mono text-stone-500 mt-0.5">
                          {st.studentIdNumber}
                          {st.temporaryRollNumber && st.temporaryRollNumber !== st.studentIdNumber && (
                            <span className="ml-1 text-stone-400">({st.temporaryRollNumber})</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-stone-800 font-medium">
                          Year {st.currentYearOfStudy} · {st.admissionCategory.replace('_', ' ')}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {st.hostelEnrolled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Hostel
                            </span>
                          )}
                          {st.messEnrolled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              Mess
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-medium text-stone-700">
                        {hasAssessment ? (
                          <>
                            <div>{formatINR(st.currentAssessment!.revisedPayable)}</div>
                            {st.currentAssessment!.concessionTotal > 0 && (
                              <div className="text-[10px] text-emerald-700">
                                -{formatINR(st.currentAssessment!.concessionTotal)} conc.
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-stone-400 italic">Unassessed</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-semibold text-emerald-800">
                        {formatINR(st.totalPaid)}
                      </td>

                      <td className="py-3 px-3 text-right">
                        {st.totalPending > 0 ? (
                          <span className="font-semibold text-amber-700 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatINR(st.totalPending)}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        {hasAssessment ? (
                          isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" />
                              Settled
                            </span>
                          ) : (
                            <span className="font-bold text-[#4B2E2E] text-sm">
                              {formatINR(st.outstandingBalance)}
                            </span>
                          )
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasAssessment ? (
                            <>
                              {/* Prominent PAY button on every student row */}
                              <Button
                                size="sm"
                                onClick={() => onPayStudent(st)}
                                className="bg-[#4B2E2E] hover:bg-[#3D2525] text-white text-xs px-3 py-1 font-bold shadow-xs"
                              >
                                <CreditCard className="w-3.5 h-3.5 mr-1" />
                                {isSecretary ? 'Pay Dev' : 'Pay'}
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenLedger(st)}
                                className="text-stone-700 hover:text-stone-900 text-xs px-2.5 py-1"
                              >
                                <FileText className="w-3.5 h-3.5 mr-1" />
                                Ledger
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => onInitializeAssessment(st.id)}
                              className="bg-[#D4AF37] hover:bg-[#c5a030] text-stone-900 text-xs px-2.5 py-1 font-semibold"
                            >
                              <UserPlus className="w-3.5 h-3.5 mr-1" />
                              Initialize
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
