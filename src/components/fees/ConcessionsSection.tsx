import React, { useState, useEffect } from 'react';
import {
  BadgePercent,
  Search,
  Plus,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Building,
  User,
  ArrowRight,
} from 'lucide-react';
import { StudentFeeItem, StudentFinancialLedger, FeeComponentType, formatINR } from './fee-types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ConcessionsSectionProps {
  students: StudentFeeItem[];
  userRole?: string;
  csrfToken?: string;
  onConcessionGranted?: () => void;
  onOpenLedger?: (student: StudentFeeItem) => void;
}

export const ConcessionsSection: React.FC<ConcessionsSectionProps> = ({
  students,
  userRole,
  csrfToken,
  onConcessionGranted,
  onOpenLedger,
}) => {
  const canGrant = userRole === 'SUPER_ADMIN' || userRole === 'PRINCIPAL';

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentFeeItem | null>(null);
  const [ledger, setLedger] = useState<StudentFinancialLedger | null>(null);
  const [loadingLedger, setLoadingLedger] = useState<boolean>(false);

  // Concession Form
  const [feeComponent, setFeeComponent] = useState<FeeComponentType>('COLLEGE');
  const [concessionType, setConcessionType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [value, setValue] = useState<number>(10000);
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch student financial ledger when student is selected
  useEffect(() => {
    if (!selectedStudent) {
      setLedger(null);
      return;
    }
    const fetchLedger = async () => {
      setLoadingLedger(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/fees/students/${selectedStudent.id}/financial-ledger`);
        if (!res.ok) throw new Error('Failed to retrieve student ledger');
        const data = await res.json();
        setLedger(data);
      } catch (err) {
        setErrorMsg((err as Error).message);
      } finally {
        setLoadingLedger(false);
      }
    };
    fetchLedger();
  }, [selectedStudent]);

  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentIdNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCompLedger = ledger?.components[feeComponent];

  const handleGrantConcession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGrant || !selectedStudent || !selectedStudent.currentAssessment) return;

    if (!reason.trim()) {
      setErrorMsg('Mandatory institutional justification reason is required.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/fees/concessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          assessmentId: selectedStudent.currentAssessment.id,
          concessionType,
          value,
          reason,
          feeComponent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to grant fee concession');
      }

      setSuccessMsg(data.message || 'Fee concession granted and ledger recalculated.');
      setReason('');
      setValue(0);

      // Refresh ledger
      const ledgerRes = await fetch(`/api/fees/students/${selectedStudent.id}/financial-ledger`);
      if (ledgerRes.ok) {
        const updatedLedger = await ledgerRes.json();
        setLedger(updatedLedger);
      }

      if (onConcessionGranted) {
        onConcessionGranted();
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Info */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Student Fee Concessions</h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#4B2E2E]/10 text-[#4B2E2E]">
              Restricted (Super Admin &amp; Principal)
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Grant institutional fee waivers strictly allocated to an exact fee component (College, Development, Hostel, or Mess).
          </p>
        </div>
      </div>

      {/* Policy Callout Banner */}
      <div className="p-4 rounded-xl border border-[#D4AF37]/50 bg-[#F5F5DC]/40 text-xs text-stone-700 space-y-1">
        <div className="font-bold text-[#4B2E2E] flex items-center gap-1.5">
          <Info className="w-4 h-4 text-[#D4AF37]" />
          <span>Approved Concession Attribution Rule:</span>
        </div>
        <p className="text-stone-600">
          All new concessions must specify <strong>one exact fee component</strong> (<code className="font-mono text-[11px]">COLLEGE</code>, <code className="font-mono text-[11px]">DEVELOPMENT</code>, <code className="font-mono text-[11px]">HOSTEL</code>, or <code className="font-mono text-[11px]">MESS</code>). Generic unallocated "ALL" concessions are strictly disabled. Historical ALL concessions are permanently preserved using the verified 50/50 College/Development attribution formula.
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

      {!canGrant ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
          <p className="font-semibold text-stone-800 text-sm">Access Restricted</p>
          <p className="text-xs text-stone-500 mt-1">
            Only Super Administrator and Principal possess authority to grant or modify institutional fee concessions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Student Selector */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white rounded-xl border border-stone-200/90 shadow-xs p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                1. Select Target Student
              </h3>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search by name or college ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
                />
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-stone-100 text-xs">
                {filteredStudents.length === 0 ? (
                  <p className="text-stone-400 text-center py-6">No matching students found.</p>
                ) : (
                  filteredStudents.slice(0, 30).map((st) => (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStudent(st)}
                      className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
                        selectedStudent?.id === st.id
                          ? 'bg-[#4B2E2E]/10 border border-[#4B2E2E]/30 font-medium'
                          : 'hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-stone-900">{st.fullName}</span>
                        <span className="text-[10px] font-mono text-stone-500">{st.studentIdNumber}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-stone-600 mt-0.5">
                        <span>{st.admissionCategory} • Yr {st.currentYearOfStudy}</span>
                        <span className="font-semibold text-rose-800">
                          Due: {formatINR(st.outstandingBalance)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Concession Entry Form & Ledger Preview */}
          <div className="lg:col-span-7 space-y-4">
            {selectedStudent ? (
              <div className="bg-white rounded-xl border border-stone-200/90 shadow-xs p-5 space-y-5">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Granting Concession For
                    </span>
                    <h3 className="text-base font-bold text-stone-900">{selectedStudent.fullName}</h3>
                    <p className="text-xs text-stone-500">
                      {selectedStudent.studentIdNumber} • {selectedStudent.admissionCategory} Quota • Year {selectedStudent.currentYearOfStudy}
                    </p>
                  </div>

                  {onOpenLedger && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenLedger(selectedStudent)}
                      className="text-xs"
                    >
                      Full Ledger
                    </Button>
                  )}
                </div>

                {loadingLedger ? (
                  <div className="py-8 text-center text-stone-500 text-xs">
                    <div className="inline-block animate-spin w-5 h-5 border-2 border-[#4B2E2E] border-t-transparent rounded-full mb-2" />
                    <p>Loading financial ledger...</p>
                  </div>
                ) : ledger ? (
                  <form onSubmit={handleGrantConcession} className="space-y-4 text-xs">
                    {/* Component Selector */}
                    <div>
                      <label className="block font-bold text-stone-700 mb-1.5">
                        Target Fee Component (Mandatory Single Component)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(['COLLEGE', 'DEVELOPMENT', 'HOSTEL', 'MESS'] as FeeComponentType[]).map((comp) => {
                          const cData = ledger.components[comp];
                          return (
                            <button
                              key={comp}
                              type="button"
                              onClick={() => setFeeComponent(comp)}
                              className={`p-2.5 rounded-lg border text-left transition-all ${
                                feeComponent === comp
                                  ? 'border-[#4B2E2E] bg-[#4B2E2E]/10 ring-1 ring-[#4B2E2E]'
                                  : 'border-stone-200 hover:border-stone-300 bg-white'
                              }`}
                            >
                              <span className="font-bold text-stone-900 block text-xs">{comp}</span>
                              <span className="text-[10px] text-stone-500 block">
                                Gross: {formatINR(cData?.assessedAmount || 0)}
                              </span>
                              <span className="text-[10px] text-stone-500 block">
                                Concessions: {formatINR(cData?.concessionAmount || 0)}
                              </span>
                              <span className="text-[11px] font-bold text-rose-800 block mt-1">
                                Net: {formatINR(cData?.netPayable || 0)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Component Status Summary */}
                    {activeCompLedger && (
                      <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-stone-500 block">Gross Assessed:</span>
                          <span className="font-bold text-stone-800">
                            {formatINR(activeCompLedger.assessedAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-500 block">Current Concessions:</span>
                          <span className="font-bold text-stone-800">
                            {formatINR(activeCompLedger.concessionAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-500 block">Current Net Payable:</span>
                          <span className="font-bold text-[#4B2E2E]">
                            {formatINR(activeCompLedger.netPayable)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Concession Type & Value */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium text-stone-700 mb-1">Concession Type</label>
                        <select
                          value={concessionType}
                          onChange={(e) => setConcessionType(e.target.value as any)}
                          className="w-full py-1.5 px-3 border border-stone-300 rounded-lg bg-white font-semibold"
                        >
                          <option value="FIXED">Fixed Amount (₹)</option>
                          <option value="PERCENTAGE">Percentage (%)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium text-stone-700 mb-1">
                          {concessionType === 'FIXED' ? 'Concession Amount (₹)' : 'Percentage (%)'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={concessionType === 'PERCENTAGE' ? 100 : activeCompLedger?.netPayable || 1000000}
                          value={value}
                          onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                          className="w-full py-1.5 px-3 border border-stone-300 rounded-lg font-bold text-[#4B2E2E]"
                          required
                        />
                      </div>
                    </div>

                    {/* Mandatory Reason */}
                    <div>
                      <label className="block font-medium text-stone-700 mb-1">
                        Mandatory Institutional Justification Reason
                      </label>
                      <textarea
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Merit scholarship approval ref KAMCH/CONC/2026/044 approved by Governing Body"
                        className="w-full py-1.5 px-3 border border-stone-300 rounded-lg text-xs"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={saving || !value || !reason.trim()}
                        className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white font-bold px-4"
                      >
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        {saving ? 'Recording Concession...' : 'Grant Concession'}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-500 space-y-2">
                <BadgePercent className="w-10 h-10 text-stone-300 mx-auto" />
                <p className="font-semibold text-stone-800 text-sm">No Student Selected</p>
                <p className="text-xs text-stone-500">
                  Select a student from the list on the left to evaluate their fee ledger and allocate a component concession.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
