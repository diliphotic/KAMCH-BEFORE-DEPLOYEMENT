import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Building,
  User,
  ShieldCheck,
  Calendar,
  X,
} from 'lucide-react';
import { PendingBankTransfer, formatINR } from './fee-types';
import { Button } from '../ui/Button';

interface BankVerificationSectionProps {
  userRole?: string;
  csrfToken?: string;
  onPaymentProcessed?: () => void;
  onOpenLedger?: (studentId: number) => void;
}

export const BankVerificationSection: React.FC<BankVerificationSectionProps> = ({
  userRole,
  csrfToken,
  onPaymentProcessed,
  onOpenLedger,
}) => {
  const isSecretary = userRole === 'SECRETARY';

  const [queue, setQueue] = useState<PendingBankTransfer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [componentFilter, setComponentFilter] = useState<string>('ALL');

  // Modals for Verify and Reject
  const [verifyModal, setVerifyModal] = useState<{
    item: PendingBankTransfer;
    passbookTxRef: string;
  } | null>(null);

  const [rejectModal, setRejectModal] = useState<{
    item: PendingBankTransfer;
    rejectionReason: string;
  } | null>(null);

  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/fees/reports?reportType=PENDING_VERIFICATION');
      if (!res.ok) {
        throw new Error('Failed to load pending bank transfer queue');
      }
      const data = await res.json();
      let records: PendingBankTransfer[] = data.records || [];

      // Secretary role filter: SECRETARY_DEV_ACCOUNT only
      if (isSecretary) {
        records = records.filter((r) => r.destination === 'SECRETARY_DEV_ACCOUNT');
      }

      setQueue(records);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isSecretary]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Filtered queue
  const filteredQueue = queue.filter((item) => {
    if (componentFilter !== 'ALL' && item.feeComponent !== componentFilter) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        item.studentName.toLowerCase().includes(term) ||
        item.studentIdNumber.toLowerCase().includes(term) ||
        (item.studentTxRef || '').toLowerCase().includes(term) ||
        item.bankName.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Verify submission
  const handleConfirmVerify = async () => {
    if (!verifyModal || !verifyModal.passbookTxRef.trim()) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/fees/payments/${verifyModal.item.id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({
          action: 'VERIFY',
          passbookTxRef: verifyModal.passbookTxRef.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify payment');
      }

      setFeedback({
        type: 'success',
        message: `Payment verified against passbook ref "${verifyModal.passbookTxRef.trim()}". Final Receipt #${data.finalReceiptNumber} issued!`,
      });
      setVerifyModal(null);
      await fetchQueue();
      if (onPaymentProcessed) onPaymentProcessed();
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setActionLoading(false);
    }
  };

  // Reject submission
  const handleConfirmReject = async () => {
    if (!rejectModal || !rejectModal.rejectionReason.trim()) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/fees/payments/${rejectModal.item.id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({
          action: 'REJECT',
          rejectionReason: rejectModal.rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject payment');
      }

      setFeedback({
        type: 'success',
        message: 'Bank transfer rejected and capacity reservation released back to student.',
      });
      setRejectModal(null);
      await fetchQueue();
      if (onPaymentProcessed) onPaymentProcessed();
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Bank Transfer Verification Queue</h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
              {queue.length} Pending
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Reconcile unverified student bank transfers against official college bank passbook statements. Capacity is reserved until verified or released upon rejection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading} className="text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-sm flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-stone-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search by student name, ID, UTR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isSecretary && (
            <select
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
              className="text-xs py-2 px-3 border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
            >
              <option value="ALL">All Components</option>
              <option value="COLLEGE">College Fee</option>
              <option value="DEVELOPMENT">Development Fee</option>
              <option value="HOSTEL">Hostel Fee</option>
              <option value="MESS">Mess Fee</option>
            </select>
          )}
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-stone-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-stone-500">
            <div className="inline-block animate-spin w-7 h-7 border-2 border-[#4B2E2E] border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-medium">Loading verification queue...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-12 text-center text-rose-600 px-4">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <p className="text-sm font-semibold">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={fetchQueue} className="mt-3 text-xs">
              Retry
            </Button>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="py-16 text-center text-stone-500 px-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-stone-800">Verification Queue is Clear</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              There are no pending bank transfers requiring reconciliation at this time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#4B2E2E]/5 border-b border-stone-200 text-stone-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-3">Component &amp; Account</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3">Bank Reference</th>
                  <th className="py-3 px-3">Payment Date</th>
                  <th className="py-3 px-3">Recorded By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-900">{item.studentName}</div>
                      <div className="text-[11px] font-mono text-stone-500">{item.studentIdNumber}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-[#4B2E2E]">{item.feeComponent}</span>
                      <span className="block text-[10px] text-stone-500 font-mono">
                        {item.destination === 'SECRETARY_DEV_ACCOUNT' ? 'Dev Account' : 'College Account'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-bold text-stone-900 text-sm">
                        {formatINR(item.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono text-stone-800 font-medium">
                        {item.studentTxRef || '—'}
                      </div>
                      <div className="text-[11px] text-stone-500">{item.bankName}</div>
                    </td>
                    <td className="py-3 px-3 text-stone-600">
                      <div>{new Date(item.paymentDate).toLocaleDateString('en-IN')}</div>
                      <span className="text-[10px] text-amber-700">
                        {item.daysPending} day(s) pending
                      </span>
                    </td>
                    <td className="py-3 px-3 text-stone-600 text-[11px]">
                      {item.recordedBy}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => setVerifyModal({ item, passbookTxRef: '' })}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] px-2.5 py-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Verify
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRejectModal({ item, rejectionReason: '' })}
                          className="border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] px-2.5 py-1"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VERIFY MODAL */}
      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200">
            <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-sm">Verify Bank Transfer &amp; Issue Receipt</h3>
              </div>
              <button
                onClick={() => setVerifyModal(null)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs space-y-1">
                <div>Student: <strong>{verifyModal.item.studentName}</strong> ({verifyModal.item.studentIdNumber})</div>
                <div>Component: <strong>{verifyModal.item.feeComponent}</strong> · Amount: <strong className="text-emerald-700">{formatINR(verifyModal.item.amount)}</strong></div>
                <div>Student UTR: <span className="font-mono">{verifyModal.item.studentTxRef || '—'}</span> ({verifyModal.item.bankName})</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Passbook Transaction Reference / Statement Ref <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. PBK-2026-NOV-8910"
                  value={verifyModal.passbookTxRef}
                  onChange={(e) =>
                    setVerifyModal({ ...verifyModal, passbookTxRef: e.target.value })
                  }
                  className="w-full text-xs py-2 px-3 border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 font-mono font-medium"
                  autoFocus
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Mandatory: Enter the exact credit reference from the college bank passbook.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVerifyModal(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmVerify}
                  disabled={actionLoading || !verifyModal.passbookTxRef.trim()}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  {actionLoading ? 'Verifying...' : 'Confirm Verification & Issue Receipt'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200">
            <div className="bg-rose-800 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm">Reject Bank Transfer &amp; Release Capacity</h3>
              </div>
              <button
                onClick={() => setRejectModal(null)}
                className="text-rose-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs space-y-1">
                <div>Student: <strong>{rejectModal.item.studentName}</strong> ({rejectModal.item.studentIdNumber})</div>
                <div>Amount to Release: <strong className="text-rose-700">{formatINR(rejectModal.item.amount)}</strong></div>
                <div>UTR: <span className="font-mono">{rejectModal.item.studentTxRef || '—'}</span></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Mandatory Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. UTR reference not found in bank statement / Dishonoured transfer"
                  value={rejectModal.rejectionReason}
                  onChange={(e) =>
                    setRejectModal({ ...rejectModal, rejectionReason: e.target.value })
                  }
                  className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-600/30"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectModal(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmReject}
                  disabled={actionLoading || !rejectModal.rejectionReason.trim()}
                  className="bg-rose-700 hover:bg-rose-800 text-white"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject Transfer & Release Capacity'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
