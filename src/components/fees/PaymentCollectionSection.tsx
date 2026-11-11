import React, { useState } from 'react';
import {
  DollarSign,
  Search,
  CreditCard,
  Building,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { StudentFeeItem, FeeComponentType, formatINR } from './fee-types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface PaymentCollectionSectionProps {
  students: StudentFeeItem[];
  userRole?: string;
  onPayStudent: (student: StudentFeeItem, component?: FeeComponentType) => void;
  onOpenLedger: (student: StudentFeeItem) => void;
}

export const PaymentCollectionSection: React.FC<PaymentCollectionSectionProps> = ({
  students,
  userRole,
  onPayStudent,
  onOpenLedger,
}) => {
  const isSecretary = userRole === 'SECRETARY';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentIdNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || s.admissionCategory === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Payment Collection Counter</h2>
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                isSecretary
                  ? 'bg-purple-100 text-purple-900'
                  : 'bg-[#4B2E2E]/10 text-[#4B2E2E]'
              }`}
            >
              {isSecretary ? 'Secretary Development Desk' : 'Central Cashier & Accounts'}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            {isSecretary
              ? 'Authorized strictly for Development Fee collections credited to SECRETARY_DEV_ACCOUNT.'
              : 'Direct payment intake for College, Development, Hostel, and Mess fee components.'}
          </p>
        </div>
      </div>

      {/* Quick Lookup Bar */}
      <Card className="p-4 rounded-xl border border-stone-200/90 shadow-xs bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search student by name or college ID (e.g., KMC2026001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs py-2 px-3 border border-stone-300 rounded-lg bg-white text-stone-700"
            >
              <option value="ALL">All Categories</option>
              <option value="GOVERNMENT">Government Quota</option>
              <option value="MANAGEMENT_PRIVATE">Management / Private</option>
              <option value="NRI">NRI Quota</option>
            </select>
            <span className="text-xs text-stone-500 whitespace-nowrap">
              {filteredStudents.length} students found
            </span>
          </div>
        </div>
      </Card>

      {/* Student Collection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full py-16 text-center text-stone-400 bg-white rounded-xl border border-stone-200">
            No matching students found.
          </div>
        ) : (
          filteredStudents.slice(0, 30).map((st) => (
            <Card
              key={st.id}
              className="rounded-xl border border-stone-200/90 shadow-xs bg-white overflow-hidden flex flex-col justify-between hover:border-stone-300 transition-colors"
            >
              <div className="p-4 border-b border-stone-100 flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                    {st.studentIdNumber}
                  </span>
                  <h3 className="text-sm font-bold text-stone-900 mt-1">{st.fullName}</h3>
                  <p className="text-[11px] text-stone-500">
                    {st.admissionCategory} • Year {st.currentYearOfStudy}
                  </p>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    st.outstandingBalance <= 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {st.outstandingBalance <= 0 ? 'CLEARED' : 'DUE'}
                </span>
              </div>

              <div className="p-4 space-y-2 text-xs flex-1">
                <div className="flex justify-between items-center text-stone-600">
                  <span>Assessed Fee:</span>
                  <span className="font-semibold text-stone-900">
                    {formatINR(st.currentAssessment?.totalAssessedFee || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-stone-600">
                  <span>Verified Paid:</span>
                  <span className="font-semibold text-emerald-800">{formatINR(st.totalPaid)}</span>
                </div>
                {st.totalPending > 0 && (
                  <div className="flex justify-between items-center text-amber-800">
                    <span>Pending Bank UTR:</span>
                    <span className="font-semibold">{formatINR(st.totalPending)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-stone-100">
                  <span className="font-bold text-stone-800">Actual Outstanding:</span>
                  <span className="text-sm font-black text-rose-800">
                    {formatINR(st.outstandingBalance)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-3 bg-stone-50/80 border-t border-stone-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenLedger(st)}
                  className="text-xs text-[#4B2E2E] hover:underline font-semibold"
                >
                  View Ledger
                </button>

                <div className="flex items-center gap-1.5">
                  {isSecretary ? (
                    <Button
                      size="sm"
                      onClick={() => onPayStudent(st, 'DEVELOPMENT')}
                      className="bg-purple-800 hover:bg-purple-900 text-white text-xs font-bold"
                    >
                      <DollarSign className="w-3.5 h-3.5 mr-1" />
                      Collect Dev Fee
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => onPayStudent(st, 'COLLEGE')}
                      className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white text-xs font-bold"
                    >
                      <DollarSign className="w-3.5 h-3.5 mr-1" />
                      Collect Payment
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
