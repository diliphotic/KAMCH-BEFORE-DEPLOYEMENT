import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  AlertTriangle,
  CreditCard,
  Building,
  CheckCircle2,
  Clock,
  RotateCcw,
  Receipt,
  User,
  ShieldCheck,
} from 'lucide-react';
import {
  StudentFeeItem,
  StudentFinancialLedger,
  formatINR,
  FeeComponentType,
} from './fee-types';
import { Button } from '../ui/Button';

interface StudentLedgerModalProps {
  student: StudentFeeItem;
  userRole?: string;
  csrfToken?: string;
  onClose: () => void;
  onPayClicked: () => void;
  onViewReceipt?: (receiptId: number) => void;
  onLedgerUpdated?: () => void;
}

export const StudentLedgerModal: React.FC<StudentLedgerModalProps> = ({
  student,
  userRole,
  csrfToken,
  onClose,
  onPayClicked,
  onViewReceipt,
  onLedgerUpdated,
}) => {
  const canReverse = userRole === 'SUPER_ADMIN' || userRole === 'PRINCIPAL';

  const [ledger, setLedger] = useState<StudentFinancialLedger | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Student payments history
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState<boolean>(true);

  // Reversal dialog
  const [reversalModal, setReversalModal] = useState<{
    paymentId: number;
    amount: number;
    ref: string;
    reason: string;
  } | null>(null);
  const [reversing, setReversing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchLedger = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/fees/students/${student.id}/financial-ledger`);
      if (!res.ok) throw new Error('Failed to load student financial ledger');
      const data: StudentFinancialLedger = await res.json();
      setLedger(data);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const res = await fetch(`/api/fees/receipts?studentId=${student.id}`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.receipts || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    fetchPayments();
  }, [student.id]);

  // Handle payment reversal
  const handleConfirmReversal = async () => {
    if (!reversalModal || !reversalModal.reason.trim()) return;

    setReversing(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/fees/payments/${reversalModal.paymentId}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({ reversalReason: reversalModal.reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reverse payment');

      setFeedback({ type: 'success', message: 'Payment reversed and balance recalculated.' });
      setReversalModal(null);
      await fetchLedger();
      await fetchPayments();
      if (onLedgerUpdated) onLedgerUpdated();
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-6 overflow-hidden border border-stone-200">
        {/* Header */}
        <div className="bg-[#4B2E2E] text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37]">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Student Financial Statement &amp; Ledger</h2>
              <div className="flex items-center gap-2 text-xs text-[#F5F5DC]/80 mt-0.5">
                <span>{student.fullName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{student.studentIdNumber}</span>
                <span aria-hidden="true">·</span>
                <span>Year {student.currentYearOfStudy} ({student.admissionCategory.replace('_', ' ')})</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onPayClicked}
              className="bg-[#D4AF37] hover:bg-[#c5a030] text-stone-900 font-bold text-xs"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1" />
              Pay Fees
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-stone-300 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-3 text-xs flex items-center justify-between ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center text-stone-500">
              <div className="inline-block animate-spin w-7 h-7 border-2 border-[#4B2E2E] border-t-transparent rounded-full mb-3" />
              <p className="text-sm">Calculating student ledger...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : ledger ? (
            <>
              {/* Consolidated Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider block">Net Payable</span>
                  <span className="text-lg font-black text-stone-900">{formatINR(ledger.consolidated.totalNetPayable)}</span>
                </div>
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-[11px] text-emerald-700 uppercase tracking-wider block">Verified Paid</span>
                  <span className="text-lg font-black text-emerald-800">{formatINR(ledger.consolidated.totalVerifiedPaid)}</span>
                </div>
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-[11px] text-amber-700 uppercase tracking-wider block">Pending Verification</span>
                  <span className="text-lg font-black text-amber-800">{formatINR(ledger.consolidated.totalPendingVerification)}</span>
                </div>
                <div className="p-3.5 rounded-lg bg-stone-900 text-white border border-stone-800">
                  <span className="text-[11px] text-stone-300 uppercase tracking-wider block">Actual Outstanding</span>
                  <span className="text-lg font-black text-[#D4AF37]">{formatINR(ledger.consolidated.totalOutstandingBalance)}</span>
                </div>
              </div>

              {/* 4-Component Itemized Ledger */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Component-wise Assessment &amp; Balances
                </h3>
                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#4B2E2E]/5 border-b border-stone-200 text-stone-700 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Component</th>
                        <th className="py-2.5 px-3">Destination</th>
                        <th className="py-2.5 px-3 text-right">Assessed (A_c)</th>
                        <th className="py-2.5 px-3 text-right">Concession (D_c)</th>
                        <th className="py-2.5 px-3 text-right">Net (N_c)</th>
                        <th className="py-2.5 px-3 text-right">Paid (V_c)</th>
                        <th className="py-2.5 px-3 text-right">Pending (P_c)</th>
                        <th className="py-2.5 px-3 text-right">Outstanding (O_c)</th>
                        <th className="py-2.5 px-3 text-right">Max Pay (M_c)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(['COLLEGE', 'DEVELOPMENT', 'HOSTEL', 'MESS'] as FeeComponentType[]).map((c) => {
                        const bal = ledger.components[c];
                        return (
                          <tr key={c} className="hover:bg-stone-50/70">
                            <td className="py-2.5 px-3 font-bold text-stone-900">{c}</td>
                            <td className="py-2.5 px-3 font-mono text-[10px] text-stone-500">
                              {bal.receivingDestination === 'SECRETARY_DEV_ACCOUNT' ? 'Dev Acct' : 'College Acct'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-stone-600">{formatINR(bal.assessedAmount)}</td>
                            <td className="py-2.5 px-3 text-right text-stone-600">{formatINR(bal.concessionAmount)}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-stone-800">{formatINR(bal.netPayable)}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">{formatINR(bal.verifiedPaid)}</td>
                            <td className="py-2.5 px-3 text-right text-amber-700">{formatINR(bal.pendingReserved)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-[#4B2E2E]">{formatINR(bal.actualOutstanding)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-stone-800">{formatINR(bal.maxPermittedNewPayment)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historical Credits Callout (if any exist) */}
              {(ledger.historical.combinedHostelMessCredit > 0 || ledger.historical.unallocatedCredit > 0) && (
                <div className="p-3.5 rounded-lg bg-[#F5F5DC]/80 border border-[#D4AF37]/40 text-xs space-y-1">
                  <div className="font-bold text-[#4B2E2E]">Historical Financial Credits &amp; Safeguards:</div>
                  {ledger.historical.combinedHostelMessCredit > 0 && (
                    <div className="text-stone-700">
                      · Combined Historical Hostel/Mess Credit (H_hist): <strong>{formatINR(ledger.historical.combinedHostelMessCredit)}</strong>
                    </div>
                  )}
                  {ledger.historical.unallocatedCredit > 0 && (
                    <div className="text-stone-700">
                      · Unallocated Historical Payment (U_hist): <strong>{formatINR(ledger.historical.unallocatedCredit)}</strong> (Deducted from overall student outstanding without false component attribution).
                    </div>
                  )}
                </div>
              )}

              {/* Payment History & Reversals */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Recorded Payments &amp; Receipts
                </h3>
                {payments.length === 0 ? (
                  <p className="text-xs text-stone-500 py-4 text-center">No payment transactions recorded for this student yet.</p>
                ) : (
                  <div className="border border-stone-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#4B2E2E]/5 border-b border-stone-200 text-stone-700 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Receipt / Ref</th>
                          <th className="py-2 px-3">Component</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {payments.map((p) => (
                          <tr key={p.id} className="hover:bg-stone-50/70">
                            <td className="py-2 px-3 font-mono font-bold text-[#4B2E2E]">{p.receiptNumber}</td>
                            <td className="py-2 px-3">{p.feeComponent}</td>
                            <td className="py-2 px-3 text-right font-bold">{formatINR(p.amount)}</td>
                            <td className="py-2 px-3 text-stone-600">{p.paymentMethod}</td>
                            <td className="py-2 px-3 text-stone-600">{new Date(p.paymentDate || p.issuedAt).toLocaleDateString('en-IN')}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {p.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {onViewReceipt && (
                                  <button
                                    onClick={() => onViewReceipt(p.id)}
                                    className="text-[11px] text-[#4B2E2E] hover:underline font-medium"
                                  >
                                    View Receipt
                                  </button>
                                )}
                                {canReverse && p.status === 'APPROVED' && (
                                  <button
                                    onClick={() =>
                                      setReversalModal({
                                        paymentId: p.paymentId || p.id,
                                        amount: p.amount,
                                        ref: p.receiptNumber,
                                        reason: '',
                                      })
                                    }
                                    className="text-[11px] text-rose-700 hover:underline font-medium ml-2"
                                  >
                                    Reverse
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Statement
          </Button>
        </div>

        {/* REVERSAL MODAL */}
        {reversalModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200">
              <div className="bg-rose-800 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-200" />
                  <h4 className="font-bold text-sm">Reverse Verified Payment Transaction</h4>
                </div>
                <button onClick={() => setReversalModal(null)} className="text-rose-200 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-3 bg-stone-50 border rounded-lg text-xs space-y-1">
                  <div>Receipt: <strong>{reversalModal.ref}</strong></div>
                  <div>Amount to Reverse: <strong className="text-rose-700">{formatINR(reversalModal.amount)}</strong></div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Mandatory Reversal Audit Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Duplicate entry correction / Bank chargeback reversed by Principal"
                    value={reversalModal.reason}
                    onChange={(e) => setReversalModal({ ...reversalModal, reason: e.target.value })}
                    className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-600/30"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                  <Button variant="outline" size="sm" onClick={() => setReversalModal(null)} disabled={reversing}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmReversal}
                    disabled={reversing || !reversalModal.reason.trim()}
                    className="bg-rose-700 hover:bg-rose-800 text-white"
                  >
                    {reversing ? 'Reversing...' : 'Confirm Reversal'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
