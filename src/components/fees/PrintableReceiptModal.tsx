import React, { useState, useEffect } from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Download, AlertCircle } from 'lucide-react';
import { ReceiptDetails, formatINR } from './fee-types';
import { Button } from '../ui/Button';

interface PrintableReceiptModalProps {
  receiptId: number;
  csrfToken?: string;
  onClose: () => void;
  onPrintConfirmed?: () => void;
}

export const PrintableReceiptModal: React.FC<PrintableReceiptModalProps> = ({
  receiptId,
  csrfToken,
  onClose,
  onPrintConfirmed,
}) => {
  const [receipt, setReceipt] = useState<ReceiptDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmingPrint, setConfirmingPrint] = useState<boolean>(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);

  const fetchReceipt = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/fees/receipts/${receiptId}`);
      if (!res.ok) {
        throw new Error('Failed to load official receipt details');
      }
      const data: ReceiptDetails = await res.json();
      setReceipt(data);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipt();
  }, [receiptId]);

  // Handle physical print using isolated iframe for 100% reliable print output without modal backdrop/overflow clipping
  const handlePrint = () => {
    const receiptEl = document.getElementById('kamch-printable-receipt');
    if (!receiptEl) {
      window.print();
      return;
    }

    // Create an isolated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) {
      window.print();
      return;
    }

    // Copy all style tags and link stylesheets from current document
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Fee Receipt - ${receipt?.receiptNumber || 'KAMCH'}</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            body {
              background-color: #ffffff !important;
              color: #1c1917 !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: system-ui, -apple-system, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            #kamch-printable-receipt {
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              background: #ffffff !important;
              overflow: visible !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div id="kamch-printable-receipt" class="p-0 bg-white">
            ${receiptEl.innerHTML}
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    // Trigger print after iframe document finishes parsing
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('[KAMCH Fees] Iframe print error, falling back to window.print:', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    }, 250);
  };

  // Handle explicit "Mark as Printed" confirmation
  const handleConfirmPrint = async () => {
    setConfirmingPrint(true);
    setPrintSuccessMsg(null);
    try {
      const res = await fetch(`/api/fees/receipts/${receiptId}/confirm-print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to confirm receipt print');
      }
      setPrintSuccessMsg(`Receipt #${data.receiptNumber} recorded as printed (Print count: ${data.printCount}).`);
      if (receipt) {
        setReceipt({
          ...receipt,
          printCount: data.printCount,
          printedAt: data.printedAt,
        });
      }
      if (onPrintConfirmed) onPrintConfirmed();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setConfirmingPrint(false);
    }
  };

  const isReprint = (receipt?.printCount ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col my-auto overflow-hidden border border-stone-200 print:max-h-none print:shadow-none print:border-none print:w-full print:m-0">
        {/* Controls bar (hidden during print) */}
        <div className="bg-[#4B2E2E] text-white p-4 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">Official Fee Receipt</span>
            {isReprint && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#D4AF37] text-stone-900">
                REPRINT (Print #{receipt?.printCount})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-white hover:bg-stone-100 text-[#4B2E2E] text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              PRINT RECEIPT
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmPrint}
              disabled={confirmingPrint}
              className="bg-[#D4AF37] hover:bg-[#c5a030] text-stone-900 text-xs font-semibold"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {confirmingPrint ? 'Saving...' : 'Mark as Printed'}
            </Button>
            <button
              onClick={onClose}
              title="Close modal"
              className="p-1 rounded-md text-stone-300 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {printSuccessMsg && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shrink-0 print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{printSuccessMsg}</span>
            </div>
          </div>
        )}

        {/* Printable Paper Canvas Area */}
        <div
          id="kamch-printable-receipt"
          className="p-4 sm:p-8 bg-[#F5F5DC]/30 relative flex-1 overflow-y-auto print:p-0 print:bg-white print:overflow-visible"
        >
          {loading ? (
            <div className="py-16 text-center text-stone-500">
              <div className="inline-block animate-spin w-7 h-7 border-2 border-[#4B2E2E] border-t-transparent rounded-full mb-3" />
              <p className="text-sm">Loading receipt details...</p>
            </div>
          ) : errorMsg ? (
            <div className="py-12 text-center text-rose-600">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-semibold">{errorMsg}</p>
            </div>
          ) : receipt ? (
            <div className="relative border-2 border-[#4B2E2E] p-6 bg-white rounded-lg shadow-xs space-y-6 print:border-2 print:border-black print:shadow-none">
              {/* REPRINT Watermark */}
              {isReprint && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-10"
                >
                  <span className="text-8xl font-black text-rose-500/15 tracking-widest rotate-[-30deg] uppercase select-none border-4 border-rose-500/20 px-8 py-2 rounded-2xl">
                    REPRINT
                  </span>
                </div>
              )}

              {/* Institution Header */}
              <div className="text-center border-b-2 border-[#4B2E2E]/20 pb-4">
                <div className="inline-block px-3 py-1 rounded bg-[#4B2E2E] text-[#D4AF37] font-bold text-xs tracking-wider mb-1.5 uppercase">
                  KRISHNA AYURVEDIC MEDICAL COLLEGE AND HOSPITAL
                </div>
                <h1 className="text-lg font-black text-[#4B2E2E] tracking-tight">
                  KAMCH INSTITUTIONAL FEES MANAGEMENT
                </h1>
                <p className="text-xs text-stone-600 mt-0.5">
                  RPC Layout, Vijayanagar, Bengaluru — 560104 · Affiliated to RGUHS, Karnataka
                </p>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-800">
                  <span>{receipt.destination === 'SECRETARY_DEV_ACCOUNT' ? 'INSTITUTIONAL DEVELOPMENT RECEIPT' : 'COLLEGE GENERAL FEE RECEIPT'}</span>
                </div>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border-b border-stone-200 pb-4">
                <div>
                  <span className="text-stone-500 block">Receipt Number</span>
                  <span className="font-mono font-bold text-sm text-[#4B2E2E]">{receipt.receiptNumber}</span>
                  <span className="text-stone-500 block mt-2">Payment Reference</span>
                  <span className="font-mono text-stone-800 font-semibold">{receipt.paymentReference}</span>
                </div>
                <div className="text-right">
                  <span className="text-stone-500 block">Date of Issue</span>
                  <span className="font-semibold text-stone-800">{new Date(receipt.issueDate).toLocaleDateString('en-IN')}</span>
                  <span className="text-stone-500 block mt-2">Destination Account</span>
                  <span className="font-semibold text-stone-800 font-mono text-[11px]">{receipt.destination}</span>
                </div>
              </div>

              {/* Student Details */}
              <div className="bg-stone-50 p-3.5 rounded-lg border border-stone-200/80 text-xs grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <span className="text-stone-500">Student Name:</span>{' '}
                  <strong className="text-stone-900">{receipt.student.name}</strong>
                </div>
                <div>
                  <span className="text-stone-500">Student ID / Roll:</span>{' '}
                  <strong className="font-mono text-stone-900">{receipt.student.idNumber}</strong>
                </div>
                <div>
                  <span className="text-stone-500">Admission Category:</span>{' '}
                  <strong className="text-stone-900">{receipt.student.category.replace('_', ' ')}</strong>
                </div>
                <div>
                  <span className="text-stone-500">Year of Study:</span>{' '}
                  <strong className="text-stone-900">Year {receipt.student.yearOfStudy} ({receipt.student.academicYear})</strong>
                </div>
              </div>

              {/* Payment Details Table */}
              <div className="space-y-2">
                <table className="w-full text-xs border border-stone-200">
                  <thead className="bg-[#4B2E2E]/10 border-b border-stone-200 text-[#4B2E2E] font-bold">
                    <tr>
                      <th className="py-2 px-3 text-left">Description / Particulars</th>
                      <th className="py-2 px-3 text-left">Payment Mode &amp; Reference</th>
                      <th className="py-2 px-3 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-stone-200">
                      <td className="py-3 px-3">
                        <strong className="text-stone-900 block">
                          {receipt.destination === 'SECRETARY_DEV_ACCOUNT' ? 'Development Fee' : 'Tuition & Academic Fee'}
                        </strong>
                        <span className="text-[11px] text-stone-500">
                          Academic Session {receipt.student.academicYear}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-stone-700">
                        <div>Mode: <strong>{receipt.payment.method}</strong></div>
                        {receipt.payment.studentTxRef && (
                          <div className="font-mono text-[11px]">UTR: {receipt.payment.studentTxRef}</div>
                        )}
                        {receipt.payment.passbookTxRef && (
                          <div className="font-mono text-[11px] text-emerald-700">Passbook Ref: {receipt.payment.passbookTxRef}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-sm text-[#4B2E2E]">
                        {formatINR(receipt.payment.amount)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-stone-50 font-bold">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-right text-stone-700">
                        Total Amount Received:
                      </td>
                      <td className="py-2.5 px-3 text-right text-base text-[#4B2E2E]">
                        {formatINR(receipt.payment.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Amount in Words */}
                <div className="p-2.5 rounded bg-stone-50 border border-stone-200 text-xs text-stone-800">
                  <span className="text-stone-500">Amount in Words:</span>{' '}
                  <strong className="capitalize">{receipt.payment.amountInWords}</strong>
                </div>
              </div>

              {/* Balance Summary */}
              <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-stone-200">
                <div>
                  <span className="text-stone-500 block">Cumulative Verified Paid So Far</span>
                  <span className="font-semibold text-stone-900">{formatINR(receipt.totalPaidSoFar)}</span>
                </div>
                <div className="text-right">
                  <span className="text-stone-500 block">Remaining Student Balance</span>
                  <span className="font-bold text-[#4B2E2E]">{formatINR(receipt.remainingBalance)}</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-xs text-center border-t border-dashed border-stone-300">
                <div>
                  <div className="h-10 border-b border-stone-400 w-44 mx-auto mb-1"></div>
                  <span className="font-semibold text-stone-800 block">{receipt.approvedBy}</span>
                  <span className="text-[11px] text-stone-500">Cashier / Accounts Officer</span>
                </div>
                <div>
                  <div className="h-10 border-b border-stone-400 w-44 mx-auto mb-1"></div>
                  <span className="font-semibold text-stone-800 block">Dr. Manjunath S Gavimath</span>
                  <span className="text-[11px] font-medium text-stone-600 block">Principal / Authorized Signatory</span>
                  <span className="text-[11px] text-stone-500 block">KAMCH Institutional Seal</span>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-[10px] text-stone-400 text-center border-t border-stone-100 pt-3">
                Computer-generated official receipt · KRISHNA AYURVEDIC MEDICAL COLLEGE AND HOSPITAL · ERP Version 2026.1
                {receipt.printedAt && ` · Last Printed: ${new Date(receipt.printedAt).toLocaleString('en-IN')}`}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Action Bar (hidden during print) */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0 print:hidden">
          <div className="text-xs text-stone-500 font-mono hidden sm:block">
            {receipt ? `Receipt #${receipt.receiptNumber}` : ''}
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>
              CLOSE
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmPrint}
              disabled={confirmingPrint || !receipt}
              className="bg-[#D4AF37] hover:bg-[#c5a030] text-stone-900 font-semibold text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {confirmingPrint ? 'Saving...' : 'Mark as Printed'}
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={!receipt}
              className="bg-[#4B2E2E] hover:bg-[#3D2525] text-white font-semibold text-xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              PRINT RECEIPT
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
