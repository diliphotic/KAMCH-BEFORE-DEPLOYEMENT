import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Printer,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertTriangle,
  Layers,
  PieChart,
} from 'lucide-react';
import { formatINR } from './fee-types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface FinancialReportsSectionProps {
  userRole?: string;
  onOpenLedger?: (studentId: number) => void;
  onNavigateTab?: (tab: string) => void;
}

export const FinancialReportsSection: React.FC<FinancialReportsSectionProps> = ({
  userRole,
  onOpenLedger,
  onNavigateTab,
}) => {
  const [reportFilters, setReportFilters] = useState({
    reportType: 'COLLEGE_FEES',
    dateFrom: '',
    dateTo: '',
    category: 'ALL',
    destination: 'ALL',
    serviceType: 'ALL',
    method: 'ALL',
    status: 'ALL',
    outstandingStatus: 'ALL',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = new URLSearchParams();
      if (reportFilters.reportType) q.set('reportType', reportFilters.reportType);
      if (reportFilters.dateFrom) q.set('dateFrom', reportFilters.dateFrom);
      if (reportFilters.dateTo) q.set('dateTo', reportFilters.dateTo);
      if (reportFilters.category && reportFilters.category !== 'ALL') q.set('category', reportFilters.category);
      if (reportFilters.destination && reportFilters.destination !== 'ALL') q.set('destination', reportFilters.destination);
      if (reportFilters.serviceType && reportFilters.serviceType !== 'ALL') q.set('serviceType', reportFilters.serviceType);
      if (reportFilters.method && reportFilters.method !== 'ALL') q.set('method', reportFilters.method);
      if (reportFilters.status && reportFilters.status !== 'ALL') q.set('status', reportFilters.status);
      if (reportFilters.outstandingStatus && reportFilters.outstandingStatus !== 'ALL') q.set('outstandingStatus', reportFilters.outstandingStatus);

      const res = await fetch(`/api/fees/reports?${q.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to generate report');
      }
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [reportFilters.reportType]);

  const reportPills = [
    { id: 'COLLEGE_FEES', label: '1. College Fee Collection' },
    { id: 'DEVELOPMENT_FEES', label: '2. Development Fee Collection' },
    { id: 'HOSTEL_MESS', label: '3. Hostel & Mess Collection' },
    { id: 'BANK_DESTINATION', label: '4. Bank Destination-wise' },
    { id: 'PENDING_VERIFICATION', label: '5. Pending Verification' },
    { id: 'REVERSED_PAYMENTS', label: '6. Reversed Payments' },
    { id: 'STUDENT_OUTSTANDING', label: '7. Student Outstanding' },
    { id: 'CONSOLIDATED_SUMMARY', label: '8. Consolidated Summary' },
  ];

  return (
    <div className="space-y-5">
      {/* Report Selector Pills */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-stone-100/90 rounded-xl border border-stone-200">
        {reportPills.map((rpt) => (
          <button
            key={rpt.id}
            type="button"
            onClick={() => setReportFilters((prev) => ({ ...prev, reportType: rpt.id }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              reportFilters.reportType === rpt.id
                ? 'bg-[#4B2E2E] text-white shadow-xs'
                : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            {rpt.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter Bar */}
      {reportFilters.reportType !== 'CONSOLIDATED_SUMMARY' && (
        <Card className="rounded-xl border border-stone-200/80 shadow-xs p-4 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">From Date</label>
              <input
                type="date"
                value={reportFilters.dateFrom}
                onChange={(e) => setReportFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">To Date</label>
              <input
                type="date"
                value={reportFilters.dateTo}
                onChange={(e) => setReportFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
              />
            </div>

            {['COLLEGE_FEES', 'DEVELOPMENT_FEES', 'HOSTEL_MESS', 'STUDENT_OUTSTANDING'].includes(reportFilters.reportType) && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Admission Category</label>
                <select
                  value={reportFilters.category}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
                >
                  <option value="ALL">All Categories</option>
                  <option value="GOVERNMENT">Government Quota</option>
                  <option value="MANAGEMENT_PRIVATE">Management / Private</option>
                  <option value="NRI">NRI Quota</option>
                </select>
              </div>
            )}

            {['BANK_DESTINATION', 'PENDING_VERIFICATION', 'REVERSED_PAYMENTS'].includes(reportFilters.reportType) && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Bank Destination</label>
                <select
                  value={reportFilters.destination}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, destination: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
                >
                  <option value="ALL">All Destinations</option>
                  <option value="COLLEGE_ACCOUNT">College Account (College, Hostel, Mess)</option>
                  <option value="SECRETARY_DEV_ACCOUNT">Secretary Dev Account (Development)</option>
                </select>
              </div>
            )}

            {reportFilters.reportType === 'HOSTEL_MESS' && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Service Type</label>
                <select
                  value={reportFilters.serviceType}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, serviceType: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
                >
                  <option value="ALL">Hostel &amp; Mess Combined</option>
                  <option value="HOSTEL">Hostel Only</option>
                  <option value="MESS">Mess Only</option>
                </select>
              </div>
            )}

            {reportFilters.reportType === 'STUDENT_OUTSTANDING' && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Balance Status</label>
                <select
                  value={reportFilters.outstandingStatus}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, outstandingStatus: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
                >
                  <option value="ALL">All Accounts</option>
                  <option value="DUE_ONLY">Outstanding Balance Due</option>
                  <option value="CLEARED_ONLY">Fully Cleared</option>
                  <option value="ADVANCE_ONLY">Advance / Credit Balance</option>
                </select>
              </div>
            )}

            {['COLLEGE_FEES', 'DEVELOPMENT_FEES', 'HOSTEL_MESS', 'BANK_DESTINATION'].includes(reportFilters.reportType) && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Payment Method</label>
                <select
                  value={reportFilters.method}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, method: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
                >
                  <option value="ALL">All Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer (UTR)</option>
                  <option value="ONLINE_DEV">Online Development Portal</option>
                </select>
              </div>
            )}

            {['COLLEGE_FEES', 'DEVELOPMENT_FEES', 'HOSTEL_MESS', 'BANK_DESTINATION'].includes(reportFilters.reportType) && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Status</label>
                <select
                  value={reportFilters.status}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="VERIFIED">Verified Collected</option>
                  <option value="PENDING_VERIFICATION">Pending Verification</option>
                  <option value="REVERSED">Reversed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
            <span className="text-xs text-stone-500">
              {reportData?.title || 'Report'} • Showing {reportData?.records?.length || 0} records
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReports}
              disabled={loading}
              className="bg-[#4B2E2E] text-white hover:bg-[#3d2525] text-xs px-4 rounded-lg flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Apply Filters
            </Button>
          </div>
        </Card>
      )}

      {/* REPORT 8: Consolidated Financial Summary */}
      {reportFilters.reportType === 'CONSOLIDATED_SUMMARY' && reportData?.summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-xs">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Gross Assessed Fees</p>
              <h3 className="text-2xl font-bold text-stone-900 mt-1">
                {formatINR(reportData.summary.grossAssessed?.total || 0)}
              </h3>
              <div className="text-[11px] text-stone-500 mt-2 space-y-0.5">
                <div>College: {formatINR(reportData.summary.grossAssessed?.college || 0)}</div>
                <div>Dev: {formatINR(reportData.summary.grossAssessed?.development || 0)}</div>
                <div>Hostel &amp; Mess: {formatINR(reportData.summary.grossAssessed?.hostelMess || 0)}</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Verified Collections</p>
              <h3 className="text-2xl font-bold text-emerald-950 mt-1">
                {formatINR(reportData.summary.verifiedCollections?.total || 0)}
              </h3>
              <div className="text-[11px] text-emerald-700 mt-2 space-y-0.5">
                <div>College Destination: {formatINR(reportData.summary.verifiedCollections?.collegeAccount || 0)}</div>
                <div>Secretary Destination: {formatINR(reportData.summary.verifiedCollections?.secretaryDevAccount || 0)}</div>
                <div className="font-semibold text-emerald-900">
                  Efficiency: {reportData.summary.collectionEfficiencyPercentage}%
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 shadow-xs">
              <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Net Outstanding Receivable</p>
              <h3 className="text-2xl font-bold text-rose-950 mt-1">
                {formatINR(reportData.summary.outstandingReceivable?.total || 0)}
              </h3>
              <div className="text-[11px] text-rose-700 mt-2 space-y-0.5">
                <div>Concessions Granted: {formatINR(reportData.summary.concessions?.total || 0)}</div>
                <div>Net Payable Total: {formatINR(reportData.summary.netPayable?.total || 0)}</div>
                <div>Advance/Credit Held: {formatINR(reportData.summary.advanceCredit?.total || 0)}</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Audit &amp; Transit Flow</p>
              <h3 className="text-2xl font-bold text-amber-950 mt-1">
                {formatINR(reportData.summary.pendingCollections?.total || 0)}
              </h3>
              <div className="text-[11px] text-amber-800 mt-2 space-y-0.5">
                <div>Pending Transfers: {reportData.summary.pendingCollections?.count || 0} transactions</div>
                <div>
                  Reversals: {formatINR(reportData.summary.reversedTransactions?.total || 0)} (
                  {reportData.summary.reversedTransactions?.count || 0} reversed)
                </div>
                <div>Active Students: {reportData.summary.students?.totalEnrolled || 0}</div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[#D4AF37]/50 bg-[#F5F5DC]/40 text-xs text-stone-700 space-y-1">
            <span className="font-bold text-[#4B2E2E] block">Non-Double-Counting Guarantee &amp; Account Separation:</span>
            <p>
              This report verifies that collection envelopes (<code className="font-mono text-[11px]">fee_collection_groups</code>)
              are never aggregated alongside underlying payment transactions (<code className="font-mono text-[11px]">fee_payments</code>).
              College Account and Secretary Development Account banking receipts are fully isolated with independent ledger reconciliations.
            </p>
          </div>
        </div>
      )}

      {/* REPORT 4: Bank Destination Breakdown Cards */}
      {reportFilters.reportType === 'BANK_DESTINATION' && reportData?.destinationBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h4 className="font-bold text-stone-900 text-sm">COLLEGE_ACCOUNT Destination</h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700">Bank &amp; Cash</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-stone-500">Verified Collections:</span>
                <p className="text-base font-bold text-emerald-800">
                  {formatINR(reportData.destinationBreakdown.collegeAccount?.verified || 0)}
                </p>
              </div>
              <div>
                <span className="text-stone-500">Pending Transfers:</span>
                <p className="text-base font-bold text-amber-800">
                  {formatINR(reportData.destinationBreakdown.collegeAccount?.pending || 0)}
                </p>
              </div>
              <div>
                <span className="text-stone-500">Cash Collections:</span>
                <p className="font-semibold text-stone-800">
                  {formatINR(reportData.destinationBreakdown.collegeAccount?.cash || 0)}
                </p>
              </div>
              <div>
                <span className="text-stone-500">Bank Transfers (Verified):</span>
                <p className="font-semibold text-stone-800">
                  {formatINR(reportData.destinationBreakdown.collegeAccount?.bankTransfer || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 shadow-xs">
            <div className="flex items-center justify-between border-b border-purple-100 pb-2">
              <h4 className="font-bold text-purple-900 text-sm">SECRETARY_DEV_ACCOUNT Destination</h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">Dev Portal &amp; Cash</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-purple-600">Verified Collections:</span>
                <p className="text-base font-bold text-emerald-800">
                  {formatINR(reportData.destinationBreakdown.secretaryDevAccount?.verified || 0)}
                </p>
              </div>
              <div>
                <span className="text-purple-600">Pending Online/Transfers:</span>
                <p className="text-base font-bold text-amber-800">
                  {formatINR(reportData.destinationBreakdown.secretaryDevAccount?.pending || 0)}
                </p>
              </div>
              <div>
                <span className="text-purple-600">Cash Collections:</span>
                <p className="font-semibold text-stone-800">
                  {formatINR(reportData.destinationBreakdown.secretaryDevAccount?.cash || 0)}
                </p>
              </div>
              <div>
                <span className="text-purple-600">Online Dev Portal:</span>
                <p className="font-semibold text-stone-800">
                  {formatINR(reportData.destinationBreakdown.secretaryDevAccount?.onlineDev || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Metrics for Standard & Allocation Reports */}
      {['COLLEGE_FEES', 'DEVELOPMENT_FEES', 'HOSTEL_MESS'].includes(reportFilters.reportType) && reportData?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800 uppercase">Verified Collections</p>
              <h4 className="text-xl font-bold text-emerald-900 mt-0.5">
                {formatINR(reportData.summary.totalVerified || 0)}
              </h4>
            </div>
            <CheckCircle2 className="w-7 h-7 text-emerald-600 opacity-80" />
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase">Pending Bank Transfers</p>
              <h4 className="text-xl font-bold text-amber-900 mt-0.5">
                {formatINR(reportData.summary.totalPending || 0)}
              </h4>
            </div>
            <Clock className="w-7 h-7 text-amber-600 opacity-80" />
          </div>

          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-600 uppercase">Reversed / Voided</p>
              <h4 className="text-xl font-bold text-stone-800 mt-0.5">
                {formatINR(reportData.summary.totalReversed || 0)}
              </h4>
            </div>
            <RotateCcw className="w-7 h-7 text-stone-400 opacity-80" />
          </div>
        </div>
      )}

      {/* Main Report Table */}
      {reportFilters.reportType !== 'CONSOLIDATED_SUMMARY' && (
        <Card className="rounded-xl border border-stone-200/80 shadow-xs overflow-hidden bg-white">
          <div className="overflow-x-auto">
            {reportFilters.reportType === 'STUDENT_OUTSTANDING' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200/80 font-semibold text-stone-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Assessed</th>
                    <th className="py-2.5 px-3 text-right">Concessions</th>
                    <th className="py-2.5 px-3 text-right">Net Payable</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right font-bold text-rose-800">Outstanding</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {!reportData?.records || reportData.records.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-stone-400">
                        {loading ? 'Generating report...' : 'No student records matching selected criteria.'}
                      </td>
                    </tr>
                  ) : (
                    reportData.records.map((r: any) => (
                      <tr key={r.studentId} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-3 font-medium text-stone-900">
                          <div>{r.fullName}</div>
                          <div className="text-[10px] font-mono text-stone-500">
                            {r.studentIdNumber} • Yr {r.yearOfStudy}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-stone-700">{r.admissionCategory}</td>
                        <td className="py-2.5 px-3 text-right text-stone-800">{formatINR(r.grossAssessed)}</td>
                        <td className="py-2.5 px-3 text-right text-stone-600">{formatINR(r.concessions)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-stone-900">{formatINR(r.netPayable)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-800 font-semibold">{formatINR(r.verifiedPaid)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-900">
                          {r.outstandingBalance > 0 ? formatINR(r.outstandingBalance) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              r.status === 'CLEARED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'ADVANCE_CREDIT'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.status === 'ADVANCE_CREDIT' ? `Credit ${formatINR(r.advanceBalance)}` : r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {onOpenLedger && (
                            <button
                              type="button"
                              onClick={() => onOpenLedger(r.studentId)}
                              className="text-xs text-[#4B2E2E] hover:underline font-semibold"
                            >
                              View Ledger
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : reportFilters.reportType === 'REVERSED_PAYMENTS' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200/80 font-semibold text-stone-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Payment Date</th>
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Destination</th>
                    <th className="py-2.5 px-3 text-right">Reversed Amount</th>
                    <th className="py-2.5 px-3">Reversed By</th>
                    <th className="py-2.5 px-3">Reversal Reason</th>
                    <th className="py-2.5 px-3 text-center">Receipt Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {!reportData?.records || reportData.records.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-400">
                        {loading ? 'Generating report...' : 'No reversed payments recorded in the audit registry.'}
                      </td>
                    </tr>
                  ) : (
                    reportData.records.map((r: any) => (
                      <tr key={r.id} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-3 font-mono text-stone-600">{r.paymentDate}</td>
                        <td className="py-2.5 px-3 font-medium text-stone-900">
                          {r.studentName} ({r.studentIdNumber})
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              r.destination === 'SECRETARY_DEV_ACCOUNT'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {r.destination === 'SECRETARY_DEV_ACCOUNT' ? 'Secretary Dev' : 'College Account'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-purple-900">{formatINR(r.amount)}</td>
                        <td className="py-2.5 px-3 text-stone-700">{r.reversedBy}</td>
                        <td className="py-2.5 px-3 font-medium text-rose-800">{r.reversalReason}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                            REVERSED / VOID
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : reportFilters.reportType === 'PENDING_VERIFICATION' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200/80 font-semibold text-stone-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Transfer Date</th>
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Bank Destination</th>
                    <th className="py-2.5 px-3">Student UTR / Ref</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Transit Time</th>
                    <th className="py-2.5 px-3">Recorded By</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {!reportData?.records || reportData.records.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-400">
                        {loading ? 'Generating report...' : 'No bank transfers pending verification.'}
                      </td>
                    </tr>
                  ) : (
                    reportData.records.map((r: any) => (
                      <tr key={r.id} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-3 font-mono text-stone-600">{r.paymentDate}</td>
                        <td className="py-2.5 px-3 font-medium text-stone-900">
                          {r.studentName} ({r.studentIdNumber})
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              r.destination === 'SECRETARY_DEV_ACCOUNT'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {r.destination === 'SECRETARY_DEV_ACCOUNT' ? 'Secretary Dev' : 'College Account'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-stone-800">{r.studentTxRef || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-900">{formatINR(r.amount)}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200">
                            {r.daysPending === 0 ? 'Today' : `${r.daysPending} days ago`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-stone-600">{r.recordedBy}</td>
                        <td className="py-2.5 px-3 text-center">
                          {onNavigateTab && (
                            <button
                              type="button"
                              onClick={() => onNavigateTab('verification')}
                              className="text-xs text-[#4B2E2E] hover:underline font-semibold"
                            >
                              Go to Verification
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              /* Reports 1, 2, 3, 4: Collections & Allocations */
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200/80 font-semibold text-stone-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Destination</th>
                    <th className="py-2.5 px-3">Method / Tx Ref</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {!reportData?.records || reportData.records.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-400">
                        {loading ? 'Generating report...' : 'No transactions found for the selected criteria.'}
                      </td>
                    </tr>
                  ) : (
                    reportData.records.map((r: any) => (
                      <tr key={r.id} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-3 font-mono text-stone-600">{r.paymentDate || r.payment_date}</td>
                        <td className="py-2.5 px-3 font-medium text-stone-900">
                          {r.studentName || r.student_name} ({r.studentIdNumber || r.student_id_number})
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              r.destination === 'SECRETARY_DEV_ACCOUNT'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {r.destination === 'SECRETARY_DEV_ACCOUNT' ? 'Secretary Dev' : 'College Account'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-stone-800">{r.paymentMethod || r.payment_method}</div>
                          {(r.studentTxRef || r.student_tx_ref) && (
                            <div className="text-[10px] font-mono text-stone-500">
                              UTR: {r.studentTxRef || r.student_tx_ref}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-stone-900">{formatINR(r.amount)}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              r.status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'PENDING_VERIFICATION'
                                ? 'bg-amber-100 text-amber-800'
                                : r.status === 'REVERSED'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-stone-600">{r.receiptNumber || r.receipt_number || '—'}</td>
                        <td className="py-2.5 px-3 text-stone-500">{r.recorderName || r.recorder_name}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
