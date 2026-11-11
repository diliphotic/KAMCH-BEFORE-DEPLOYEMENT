import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard,
  Building,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Receipt,
  User,
} from 'lucide-react';
import {
  FeeComponentType,
  PaymentDestination,
  PaymentMethod,
  StudentFeeItem,
  StudentFinancialLedger,
  formatINR,
} from './fee-types';
import { Button } from '../ui/Button';

interface SingleComponentPaymentModalProps {
  student: StudentFeeItem;
  userRole?: string;
  csrfToken?: string;
  onClose: () => void;
  onSuccess: (receiptNumber?: string, receiptId?: number) => void;
  onViewReceipt?: (receiptId: number) => void;
}

export const SingleComponentPaymentModal: React.FC<SingleComponentPaymentModalProps> = ({
  student,
  userRole,
  csrfToken,
  onClose,
  onSuccess,
  onViewReceipt,
}) => {
  const isSecretary = userRole === 'SECRETARY';

  // Financial ledger state
  const [ledger, setLedger] = useState<StudentFinancialLedger | null>(null);
  const [loadingLedger, setLoadingLedger] = useState<boolean>(true);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // Form state: Exactly ONE component
  const [selectedComponent, setSelectedComponent] = useState<FeeComponentType>(
    isSecretary ? 'DEVELOPMENT' : 'COLLEGE'
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountInput, setAmountInput] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [studentTxRef, setStudentTxRef] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    receiptNumber?: string;
    receiptId?: number;
    message: string;
    isPending: boolean;
  } | null>(null);

  // Fetch full student financial ledger
  const fetchLedger = async () => {
    setLoadingLedger(true);
    setLedgerError(null);
    try {
      const res = await fetch(`/api/fees/students/${student.id}/financial-ledger`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch financial ledger');
      }
      const data: StudentFinancialLedger = await res.json();
      setLedger(data);
    } catch (err) {
      setLedgerError((err as Error).message);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [student.id]);

  // Selected component metrics
  const activeBalance = useMemo(() => {
    if (!ledger) return null;
    return ledger.components[selectedComponent] || null;
  }, [ledger, selectedComponent]);

  // Automatically determine destination
  const targetDestination: PaymentDestination = useMemo(() => {
    return selectedComponent === 'DEVELOPMENT' ? 'SECRETARY_DEV_ACCOUNT' : 'COLLEGE_ACCOUNT';
  }, [selectedComponent]);

  const enteredAmount = parseFloat(amountInput) || 0;

  // Real-time dynamic math
  const actualOutstanding = activeBalance?.actualOutstanding ?? 0;
  const pendingReserved = activeBalance?.pendingReserved ?? 0;
  const maxPermitted = activeBalance?.maxPermittedNewPayment ?? 0;
  const projectedOutstanding = Math.max(0, actualOutstanding - enteredAmount);
  const isOverMax = enteredAmount > maxPermitted + 0.001;

  // Quick fill handlers
  const handlePayFullOutstanding = () => {
    if (activeBalance) {
      const fillAmount = Math.min(activeBalance.actualOutstanding, activeBalance.maxPermittedNewPayment);
      setAmountInput(fillAmount > 0 ? fillAmount.toString() : '');
    }
  };

  const handlePayFullCapacity = () => {
    if (activeBalance && activeBalance.maxPermittedNewPayment > 0) {
      setAmountInput(activeBalance.maxPermittedNewPayment.toString());
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledger) return;

    if (enteredAmount <= 0) {
      setErrorMsg('Please enter a valid positive payment amount.');
      return;
    }

    if (isOverMax) {
      setErrorMsg(`Entered amount exceeds maximum permitted payment of ${formatINR(maxPermitted)}.`);
      return;
    }

    if (paymentMethod === 'BANK_TRANSFER' && !studentTxRef.trim()) {
      setErrorMsg('Bank UTR / Transaction Reference is required for bank transfers.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/fees/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({
          studentId: student.id,
          assessmentId: student.currentAssessment?.id || null,
          feeComponent: selectedComponent,
          destination: targetDestination,
          paymentMethod,
          amount: enteredAmount,
          paymentDate,
          studentTxRef: paymentMethod === 'BANK_TRANSFER' ? studentTxRef.trim() : null,
          bankName: paymentMethod === 'BANK_TRANSFER' ? bankName.trim() : null,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      setSuccessInfo({
        receiptNumber: data.receiptNumber,
        receiptId: data.receiptId,
        message: data.message,
        isPending: data.status === 'PENDING_VERIFICATION',
      });
      onSuccess(data.receiptNumber, data.receiptId);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col my-auto overflow-hidden border border-stone-200">
        {/* Header */}
        <div className="bg-[#4B2E2E] text-white p-4 sm:p-5 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37]">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Single-Component Fee Payment</h2>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-[#F5F5DC]/80 mt-0.5">
                <span>{student.fullName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{student.studentIdNumber}</span>
                <span aria-hidden="true">·</span>
                <span>Year {student.currentYearOfStudy} ({student.admissionCategory.replace('_', ' ')})</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {successInfo ? (
          <div className="p-6 sm:p-8 text-center space-y-5 overflow-y-auto flex-1">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-stone-900">
                {successInfo.isPending ? 'Bank Transfer Recorded' : 'Payment Confirmed & Receipt Issued'}
              </h3>
              <p className="text-sm text-stone-600 max-w-md mx-auto">{successInfo.message}</p>
              {successInfo.receiptNumber && (
                <div className="inline-block p-3 rounded-lg bg-stone-100 border border-stone-200 mt-2">
                  <span className="text-xs text-stone-500 block">Official Receipt Number</span>
                  <span className="text-lg font-bold font-mono text-[#4B2E2E]">
                    {successInfo.receiptNumber}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-4 border-t border-stone-200">
              {successInfo.receiptId && onViewReceipt && (
                <Button
                  onClick={() => {
                    onViewReceipt(successInfo.receiptId!);
                    onClose();
                  }}
                  className="bg-[#4B2E2E] hover:bg-[#3D2525] text-white"
                >
                  <Receipt className="w-4 h-4 mr-1.5" />
                  View &amp; Print Receipt
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                Done / Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Loading / Error banner */}
              {loadingLedger && (
                <div className="py-8 text-center text-stone-500">
                  <div className="inline-block animate-spin w-6 h-6 border-2 border-[#4B2E2E] border-t-transparent rounded-full mb-2"></div>
                  <p className="text-sm">Retrieving student financial ledger and capacity...</p>
                </div>
              )}

              {ledgerError && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{ledgerError}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {ledger && (
                <>
                  {/* 1. Component Assessment & Outstanding Overview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Step 1: Select Exactly One Fee Component
                      </label>
                      <span className="text-xs text-stone-500">
                        Overall Student Limit: <strong className="text-stone-800">{formatINR(ledger.consolidated.overallAvailableCollectionLimit)}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(['COLLEGE', 'DEVELOPMENT', 'HOSTEL', 'MESS'] as FeeComponentType[]).map((comp) => {
                        const bal = ledger.components[comp];
                        const isSelected = selectedComponent === comp;
                        const isDisabled = isSecretary && comp !== 'DEVELOPMENT';

                        return (
                          <button
                            key={comp}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              setSelectedComponent(comp);
                              setErrorMsg(null);
                            }}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              isDisabled
                                ? 'opacity-40 cursor-not-allowed bg-stone-50 border-stone-200'
                                : isSelected
                                ? 'border-[#4B2E2E] bg-[#4B2E2E]/5 ring-2 ring-[#4B2E2E]/20'
                                : 'border-stone-200 hover:border-stone-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-stone-900">{comp}</span>
                              <span
                                className={`w-3 h-3 rounded-full border ${
                                  isSelected ? 'bg-[#4B2E2E] border-[#4B2E2E]' : 'border-stone-300'
                                }`}
                              />
                            </div>
                            <div className="text-[11px] text-stone-500 space-y-0.5">
                              <div>Net: <span className="font-semibold text-stone-800">{formatINR(bal.netPayable)}</span></div>
                              <div>Out: <span className="font-bold text-[#4B2E2E]">{formatINR(bal.actualOutstanding)}</span></div>
                              {bal.pendingReserved > 0 && (
                                <div className="text-amber-700 font-medium">Pending: {formatINR(bal.pendingReserved)}</div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Destination Account Callout */}
                    <div className="p-3 rounded-lg bg-[#F5F5DC]/60 border border-[#D4AF37]/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-stone-800">
                        <Building className="w-4 h-4 text-[#4B2E2E] shrink-0" />
                        <span>
                          Receiving Bank Destination: <strong>{targetDestination}</strong>
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-stone-600">
                        {targetDestination === 'SECRETARY_DEV_ACCOUNT'
                          ? 'Account: Secretary Dev Fund (Karnataka Bank)'
                          : 'Account: KAMCH College General Account (SBI)'}
                      </span>
                    </div>
                  </div>

                  {/* 2. Payment Method & Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                        Step 2: Payment Method
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('CASH')}
                          className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            paymentMethod === 'CASH'
                              ? 'bg-[#4B2E2E] text-white border-[#4B2E2E]'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <DollarSign className="w-4 h-4" />
                          CASH (Instant Receipt)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('BANK_TRANSFER')}
                          className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            paymentMethod === 'BANK_TRANSFER'
                              ? 'bg-[#4B2E2E] text-white border-[#4B2E2E]'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <Building className="w-4 h-4" />
                          BANK TRANSFER (Pending)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                        Payment Date
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="w-full text-xs py-2 px-3 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/30"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bank Transfer Details (if applicable) */}
                  {paymentMethod === 'BANK_TRANSFER' && (
                    <div className="p-4 rounded-lg bg-amber-50/70 border border-amber-200/80 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                        <Info className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Bank Transfer Credentials (Capacity will be reserved without receipt until verified)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Student UTR / Tx Ref <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={studentTxRef}
                            onChange={(e) => setStudentTxRef(e.target.value)}
                            placeholder="e.g. UTR1234567890"
                            className="w-full text-xs py-2 px-3 border border-stone-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/30"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            Remitting Bank Name
                          </label>
                          <input
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="e.g. State Bank of India, HDFC"
                            className="w-full text-xs py-2 px-3 border border-stone-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/30"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Amount Entry & Live Dynamic Math */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Step 3: Enter Amount (₹)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handlePayFullOutstanding}
                          className="text-[11px] px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                        >
                          Fill Outstanding ({formatINR(actualOutstanding)})
                        </button>
                        <button
                          type="button"
                          onClick={handlePayFullCapacity}
                          className="text-[11px] px-2 py-0.5 rounded bg-[#4B2E2E]/10 hover:bg-[#4B2E2E]/20 text-[#4B2E2E] font-medium transition-colors"
                        >
                          Fill Max Capacity ({formatINR(maxPermitted)})
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-base font-bold text-stone-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max={maxPermitted > 0 ? maxPermitted : undefined}
                        value={amountInput}
                        onChange={(e) => {
                          setAmountInput(e.target.value);
                          setErrorMsg(null);
                        }}
                        placeholder="0.00"
                        className={`w-full text-lg font-bold py-2.5 pl-8 pr-4 border rounded-lg focus:outline-hidden focus:ring-2 ${
                          isOverMax
                            ? 'border-rose-400 text-rose-700 focus:ring-rose-200 bg-rose-50/50'
                            : 'border-stone-200 text-stone-900 focus:ring-[#4B2E2E]/30'
                        }`}
                        required
                      />
                    </div>

                    {/* Real-time Financial Breakdown Display */}
                    <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-200/80 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider block">
                          Actual Outstanding (O_c)
                        </span>
                        <span className="text-sm font-bold text-stone-800">
                          {formatINR(actualOutstanding)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider block">
                          Pending Reserved (P_c)
                        </span>
                        <span className="text-sm font-bold text-amber-700">
                          {formatINR(pendingReserved)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider block">
                          Projected Outstanding
                        </span>
                        <span className={`text-sm font-bold ${projectedOutstanding === 0 ? 'text-emerald-700' : 'text-[#4B2E2E]'}`}>
                          {formatINR(projectedOutstanding)}
                        </span>
                      </div>
                    </div>

                    {isOverMax && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>
                          Amount exceeds maximum permitted payment of {formatINR(maxPermitted)} for {selectedComponent}.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Internal Notes / Narrative (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Term installment, DD number, Cheque details"
                      className="w-full text-xs py-2 px-3 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/30"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-3 shrink-0">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || loadingLedger || !ledger || enteredAmount <= 0 || isOverMax}
                className="bg-[#4B2E2E] hover:bg-[#3D2525] text-white"
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    {paymentMethod === 'CASH'
                      ? `Confirm & Issue Receipt (${formatINR(enteredAmount)})`
                      : `Record Pending Transfer (${formatINR(enteredAmount)})`}
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
