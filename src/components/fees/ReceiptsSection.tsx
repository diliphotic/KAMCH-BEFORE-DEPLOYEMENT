import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  RefreshCw,
  Building,
  User,
  ArrowRight,
  Eye,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { ReceiptListItem, formatINR } from './fee-types';
import { Button } from '../ui/Button';
import { PrintableReceiptModal } from './PrintableReceiptModal';

interface ReceiptsSectionProps {
  userRole?: string;
  csrfToken?: string;
}

export const ReceiptsSection: React.FC<ReceiptsSectionProps> = ({ userRole, csrfToken }) => {
  const isSecretary = userRole === 'SECRETARY';

  // Subtab: 'pending_print' | 'all_receipts'
  const [subTab, setSubTab] = useState<'pending_print' | 'all_receipts'>('pending_print');

  const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [destinationFilter, setDestinationFilter] = useState<string>('ALL');

  // Selected receipt for preview/print modal
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);

  // Quick "Mark as Printed" action state
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (subTab === 'pending_print') {
        params.append('printStatus', 'PENDING');
      }
      if (destinationFilter !== 'ALL') {
        params.append('destination', destinationFilter);
      }
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const res = await fetch(`/api/fees/receipts?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load receipts');
      }
      const data = await res.json();
      let list: ReceiptListItem[] = data.receipts || [];

      // Enforce Secretary restriction in UI
      if (isSecretary) {
        list = list.filter((r) => r.destination === 'SECRETARY_DEV_ACCOUNT');
      }

      setReceipts(list);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [subTab, destinationFilter, search, isSecretary]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Handle explicit "Mark as Printed" button click directly from list
  const handleDirectMarkPrinted = async (receiptId: number) => {
    setConfirmingId(receiptId);
    try {
      const res = await fetch(`/api/fees/receipts/${receiptId}/confirm-print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to mark receipt as printed');
      }
      await fetchReceipts();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Receipt Management &amp; Printing</h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#4B2E2E]/10 text-[#4B2E2E]">
              Official Ledger Receipts
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Generate, print, and track sequential receipts for confirmed College and Development fees. Reprinting displays a mandatory legal watermark.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReceipts} disabled={loading} className="text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Segmented Subtabs: Pending Print vs All Receipts */}
      <div className="flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSubTab('pending_print')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              subTab === 'pending_print'
                ? 'border-[#4B2E2E] text-[#4B2E2E]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Printer className="w-4 h-4" />
            Pending Print Queue
          </button>
          <button
            onClick={() => setSubTab('all_receipts')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              subTab === 'all_receipts'
                ? 'border-[#4B2E2E] text-[#4B2E2E]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Payment History &amp; Archive
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search receipt #, student name, roll..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isSecretary && (
            <select
              value={destinationFilter}
              onChange={(e) => setDestinationFilter(e.target.value)}
              className="text-xs py-2 px-3 border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
            >
              <option value="ALL">All Destinations</option>
              <option value="COLLEGE_ACCOUNT">College Account</option>
              <option value="SECRETARY_DEV_ACCOUNT">Secretary Dev Account</option>
            </select>
          )}
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-stone-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-stone-500">
            <div className="inline-block animate-spin w-7 h-7 border-2 border-[#4B2E2E] border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-medium">Loading receipts...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-12 text-center text-rose-600 px-4">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <p className="text-sm font-semibold">{errorMsg}</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="py-16 text-center text-stone-500 px-4">
            <FileCheck className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-stone-800">
              {subTab === 'pending_print' ? 'Pending Print Queue is Empty' : 'No Receipts Found'}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              {subTab === 'pending_print'
                ? 'All generated receipts have been marked as printed.'
                : 'No receipts match your search and filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#4B2E2E]/5 border-b border-stone-200 text-stone-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Receipt Number</th>
                  <th className="py-3 px-3">Student</th>
                  <th className="py-3 px-3">Component &amp; Mode</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Print Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#4B2E2E]">
                      {r.receiptNumber}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-stone-900">{r.studentName}</div>
                      <div className="text-[11px] font-mono text-stone-500">{r.studentIdNumber}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-stone-800">{r.feeComponent}</div>
                      <span className="text-[10px] text-stone-500">{r.paymentMethod}</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-bold text-stone-900 text-sm">
                        {formatINR(r.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-stone-600">
                      {new Date(r.issuedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      {r.printCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Printed ({r.printCount}x)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Unprinted
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => setSelectedReceiptId(r.id)}
                          className="bg-[#4B2E2E] hover:bg-[#3D2525] text-white text-[11px] px-2.5 py-1"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          {r.printCount > 0 ? 'Reprint' : 'Preview & Print'}
                        </Button>
                        {r.printCount === 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={confirmingId === r.id}
                            onClick={() => handleDirectMarkPrinted(r.id)}
                            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-[11px] px-2.5 py-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            {confirmingId === r.id ? 'Marking...' : 'Mark Printed'}
                          </Button>
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

      {/* PRINTABLE RECEIPT MODAL */}
      {selectedReceiptId && (
        <PrintableReceiptModal
          receiptId={selectedReceiptId}
          csrfToken={csrfToken}
          onClose={() => setSelectedReceiptId(null)}
          onPrintConfirmed={fetchReceipts}
        />
      )}
    </div>
  );
};
