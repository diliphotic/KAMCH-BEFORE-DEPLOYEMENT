import React from 'react';
import {
  CreditCard,
  Building,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  Users,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { formatINR } from './fee-types';
import { Button } from '../ui/Button';

interface FeeDashboardSectionProps {
  stats: {
    totalAssessed: number;
    totalCollected: number;
    totalPending: number;
    totalOutstanding: number;
    pendingTransfersCount: number;
    unprintedReceiptsCount: number;
    studentCount: number;
  };
  userRole?: string;
  onNavigateTab: (tab: string) => void;
}

export const FeeDashboardSection: React.FC<FeeDashboardSectionProps> = ({
  stats,
  userRole,
  onNavigateTab,
}) => {
  const isSecretary = userRole === 'SECRETARY';

  return (
    <div className="space-y-6">
      {/* Top Banner / Academic Notice */}
      <div className="bg-[#4B2E2E] text-white rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -right-10 -bottom-10 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none"
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold">
              <Building className="w-3.5 h-3.5" />
              <span>KAMCH Academic Session 2026–2027</span>
            </div>
            <h1 className="text-xl font-black text-[#F5F5DC] tracking-tight">
              Institutional Fees &amp; Financial Ledger
            </h1>
            <p className="text-xs text-[#F5F5DC]/80 max-w-xl">
              {isSecretary
                ? 'Secretary Institutional Development Fund portal. Manage development fee collections, bank reconciliations, and verified receipts.'
                : 'Central financial engine governing College, Development, Hostel, and Mess fee accounting with segregated bank destinations and strict passbook verification.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              onClick={() => onNavigateTab('student_fees')}
              className="bg-[#D4AF37] hover:bg-[#c5a030] text-stone-900 font-bold text-xs"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              Collect Fees
            </Button>
            {stats.pendingTransfersCount > 0 && (
              <Button
                size="sm"
                onClick={() => onNavigateTab('verification')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
              >
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                Verify Bank ({stats.pendingTransfersCount})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('receipts')}
              className="border-[#F5F5DC]/30 text-[#F5F5DC] hover:bg-white/10 text-xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Receipts Queue ({stats.unprintedReceiptsCount})
            </Button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assessed */}
        <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Assessed</span>
            <div className="p-1.5 rounded-md bg-stone-100 text-stone-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-stone-900">
            {formatINR(stats.totalAssessed)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            Across {stats.studentCount} enrolled student records
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Verified Collected</span>
            <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-800">
            {formatINR(stats.totalCollected)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Confirmed &amp; reconciled in bank
          </div>
        </div>

        {/* Pending Verification */}
        <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Bank Transfers</span>
            <div className="p-1.5 rounded-md bg-amber-100 text-amber-800">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-800">
            {formatINR(stats.totalPending)}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            {stats.pendingTransfersCount} transfer(s) awaiting passbook check
          </div>
        </div>

        {/* Actual Outstanding */}
        <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Actual Outstanding</span>
            <div className="p-1.5 rounded-md bg-[#4B2E2E]/10 text-[#4B2E2E]">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-[#4B2E2E]">
            {formatINR(stats.totalOutstanding)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            Net balance remaining payable
          </div>
        </div>
      </div>

      {/* The Approved Four Components Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Approved Single-Component Fee Architecture
          </h2>
          <span className="text-xs text-stone-500 font-mono">
            Isolated Banking Destinations
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* College Component */}
          <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">1. COLLEGE FEE</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                COLLEGE_ACCOUNT
              </span>
            </div>
            <p className="text-xs text-stone-600">
              Annual tuition, laboratory, and library fees. Received exclusively into the college general account.
            </p>
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
              <span className="text-stone-500">Method</span>
              <span className="font-semibold text-stone-800">Cash / Bank Transfer</span>
            </div>
          </div>

          {/* Development Component */}
          <div className="bg-white rounded-xl border border-[#D4AF37]/50 bg-[#F5F5DC]/20 p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#4B2E2E]">2. DEVELOPMENT FEE</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#D4AF37]/30 text-stone-900 border border-[#D4AF37]">
                SECRETARY_DEV_ACCOUNT
              </span>
            </div>
            <p className="text-xs text-stone-600">
              Institutional infrastructure and campus expansion fund. Maintained under Secretary oversight.
            </p>
            <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px]">
              <span className="text-stone-500">Dedicated Receipt</span>
              <span className="font-mono font-bold text-[#4B2E2E]">KAMCH/RCP/DEV/...</span>
            </div>
          </div>

          {/* Hostel Component */}
          <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">3. HOSTEL FEE</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                COLLEGE_ACCOUNT
              </span>
            </div>
            <p className="text-xs text-stone-600">
              Student hostel room accommodation, utilities, and maintenance. Annual assessed billing.
            </p>
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
              <span className="text-stone-500">Service Policy</span>
              <span className="font-semibold text-stone-800">Annual charge payable</span>
            </div>
          </div>

          {/* Mess Component */}
          <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">4. MESS FEE</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                COLLEGE_ACCOUNT
              </span>
            </div>
            <p className="text-xs text-stone-600">
              Dining hall boarding and meal facility charges. Fixed annual assessment per billing period.
            </p>
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
              <span className="text-stone-500">Destination</span>
              <span className="font-semibold text-stone-800">College General Account</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Matrix */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
          Operational Quick Navigation
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigateTab('student_fees')}
            className="p-3 rounded-lg border border-stone-200 hover:border-[#4B2E2E] hover:bg-[#4B2E2E]/5 text-left transition-all group"
          >
            <CreditCard className="w-5 h-5 text-[#4B2E2E] mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-stone-900">Student Fees</div>
            <div className="text-[10px] text-stone-500 mt-0.5">Roster &amp; Payment</div>
          </button>

          <button
            onClick={() => onNavigateTab('verification')}
            className="p-3 rounded-lg border border-stone-200 hover:border-amber-600 hover:bg-amber-50 text-left transition-all group"
          >
            <Clock className="w-5 h-5 text-amber-700 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-stone-900">Bank Queue</div>
            <div className="text-[10px] text-stone-500 mt-0.5">{stats.pendingTransfersCount} transfers pending</div>
          </button>

          <button
            onClick={() => onNavigateTab('receipts')}
            className="p-3 rounded-lg border border-stone-200 hover:border-[#4B2E2E] hover:bg-[#4B2E2E]/5 text-left transition-all group"
          >
            <Printer className="w-5 h-5 text-[#4B2E2E] mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-stone-900">Receipts</div>
            <div className="text-[10px] text-stone-500 mt-0.5">Print queue &amp; reprint</div>
          </button>

          {!isSecretary && (
            <>
              <button
                onClick={() => onNavigateTab('hostel_mess')}
                className="p-3 rounded-lg border border-stone-200 hover:border-blue-600 hover:bg-blue-50 text-left transition-all group"
              >
                <Building className="w-5 h-5 text-blue-700 mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-stone-900">Hostel &amp; Mess</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Services &amp; billing</div>
              </button>

              <button
                onClick={() => onNavigateTab('reports')}
                className="p-3 rounded-lg border border-stone-200 hover:border-emerald-600 hover:bg-emerald-50 text-left transition-all group"
              >
                <TrendingUp className="w-5 h-5 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-stone-900">Financial Reports</div>
                <div className="text-[10px] text-stone-500 mt-0.5">8 Institutional audits</div>
              </button>

              <button
                onClick={() => onNavigateTab('settings')}
                className="p-3 rounded-lg border border-stone-200 hover:border-[#D4AF37] hover:bg-[#F5F5DC]/40 text-left transition-all group"
              >
                <Calendar className="w-5 h-5 text-[#B8860B] mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-stone-900">Academic Year</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Cutoff date settings</div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
