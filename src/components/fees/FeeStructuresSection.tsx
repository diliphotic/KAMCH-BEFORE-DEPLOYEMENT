import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  Edit,
  Save,
  CheckCircle2,
  AlertTriangle,
  Building,
  RefreshCw,
  Info,
  Calendar,
  X,
  Layers,
} from 'lucide-react';
import { FeeStructure, formatINR } from './fee-types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface FeeStructuresSectionProps {
  userRole?: string;
  csrfToken?: string;
}

export const FeeStructuresSection: React.FC<FeeStructuresSectionProps> = ({
  userRole,
  csrfToken,
}) => {
  const canEdit = userRole === 'SUPER_ADMIN' || userRole === 'PRINCIPAL';

  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<FeeStructure | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    academicYear: '2026-2027',
    admissionCategory: 'GOVERNMENT' as 'GOVERNMENT' | 'MANAGEMENT_PRIVATE' | 'NRI',
    yearOfStudy: 1,
    collegeFee: 50000,
    developmentFee: 25000,
    messFee: 30000,
    hostelFee: 30000,
    description: '',
    isActive: true,
    scope: 'FUTURE_ONLY',
    reason: '',
  });

  const fetchStructures = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/fees/structures?academicYear=${encodeURIComponent(academicYear)}`);
      if (!res.ok) {
        throw new Error('Failed to retrieve fee structures');
      }
      const data = await res.json();
      setStructures(data.feeStructures || []);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStructures();
  }, [academicYear]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      academicYear,
      admissionCategory: 'GOVERNMENT',
      yearOfStudy: 1,
      collegeFee: 50000,
      developmentFee: 25000,
      messFee: 30000,
      hostelFee: 30000,
      description: 'Standard institutional fee schedule',
      isActive: true,
      scope: 'FUTURE_ONLY',
      reason: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: FeeStructure) => {
    setEditingItem(item);
    setFormData({
      academicYear: item.academic_year,
      admissionCategory: item.admission_category,
      yearOfStudy: item.year_of_study,
      collegeFee: item.college_fee,
      developmentFee: item.development_fee,
      messFee: item.mess_fee,
      hostelFee: item.hostel_fee,
      description: item.description || '',
      isActive: item.is_active,
      scope: 'FUTURE_ONLY',
      reason: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/fees/structures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({
          id: editingItem ? editingItem.id : undefined,
          ...formData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save fee structure');
      }

      setSuccessMsg(data.message || 'Fee structure configured successfully.');
      setIsModalOpen(false);
      await fetchStructures();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Fee Structure Configuration</h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#4B2E2E]/10 text-[#4B2E2E]">
              Academic Schedules
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Standard annual tuition, development, and auxiliary rates per admission quota and study year.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="text-xs py-1.5 px-3 border border-stone-200 rounded-lg bg-white text-stone-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
          >
            <option value="2026-2027">AY 2026–2027</option>
            <option value="2025-2026">AY 2025–2026</option>
            <option value="2024-2025">AY 2024–2025</option>
          </select>

          <Button variant="outline" size="sm" onClick={fetchStructures} disabled={loading} className="text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {canEdit && (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Structure
            </Button>
          )}
        </div>
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

      {/* Grid of Fee Structures */}
      {loading ? (
        <div className="py-16 text-center text-stone-500">
          <div className="inline-block animate-spin w-7 h-7 border-2 border-[#4B2E2E] border-t-transparent rounded-full mb-3" />
          <p className="text-sm">Loading fee schedules for {academicYear}...</p>
        </div>
      ) : structures.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-500 space-y-2">
          <Sliders className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="font-semibold text-stone-800 text-sm">No fee structures configured for {academicYear}</p>
          <p className="text-xs text-stone-500">Click "New Structure" to establish the annual fee schedule.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {structures.map((s) => (
            <Card
              key={s.id}
              className="rounded-xl border border-stone-200/90 shadow-xs bg-white overflow-hidden flex flex-col justify-between"
            >
              <div className="p-4 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Year {s.year_of_study} • {s.academic_year}
                  </span>
                  <h3 className="text-sm font-bold text-stone-900">
                    {s.admission_category === 'GOVERNMENT'
                      ? 'Government Quota'
                      : s.admission_category === 'MANAGEMENT_PRIVATE'
                      ? 'Management / Private'
                      : 'NRI Quota'}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {s.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(s)}
                      className="p-1 text-stone-400 hover:text-stone-800 transition-colors"
                      title="Edit structure"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-2 text-xs flex-1">
                <div className="flex justify-between items-center py-1 border-b border-stone-100">
                  <span className="text-stone-600 font-medium">College Tuition:</span>
                  <span className="font-bold text-[#4B2E2E]">{formatINR(s.college_fee)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-100">
                  <span className="text-stone-600 font-medium">Development Fee:</span>
                  <span className="font-bold text-purple-900">{formatINR(s.development_fee)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-100 text-stone-500">
                  <span>Hostel Fee (Optional):</span>
                  <span>{formatINR(s.hostel_fee)}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-stone-500">
                  <span>Mess Fee (Optional):</span>
                  <span>{formatINR(s.mess_fee)}</span>
                </div>

                {s.description && (
                  <p className="text-[11px] text-stone-500 pt-2 italic border-t border-stone-100">
                    {s.description}
                  </p>
                )}
              </div>

              <div className="p-3.5 bg-[#F5F5DC]/40 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="font-bold text-stone-700">Annual Mandatory Total:</span>
                <span className="text-sm font-black text-[#4B2E2E]">
                  {formatINR(s.total_annual_fee || s.college_fee + s.development_fee)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal for Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-base font-bold text-stone-900">
                {editingItem ? 'Edit Fee Structure' : 'Create New Fee Structure'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    className="w-full py-1.5 px-3 border border-stone-300 rounded-lg font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Year of Study</label>
                  <select
                    value={formData.yearOfStudy}
                    onChange={(e) => setFormData({ ...formData, yearOfStudy: parseInt(e.target.value, 10) })}
                    className="w-full py-1.5 px-3 border border-stone-300 rounded-lg bg-white font-semibold"
                  >
                    <option value={1}>1st Year (BAMS 1)</option>
                    <option value={2}>2nd Year (BAMS 2)</option>
                    <option value={3}>3rd Year (BAMS 3)</option>
                    <option value={4}>4th Year (BAMS 4)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Admission Category</label>
                <select
                  value={formData.admissionCategory}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      admissionCategory: e.target.value as any,
                    })
                  }
                  className="w-full py-1.5 px-3 border border-stone-300 rounded-lg bg-white font-semibold"
                >
                  <option value="GOVERNMENT">Government Quota (KEA Standard)</option>
                  <option value="MANAGEMENT_PRIVATE">Management / Private Quota</option>
                  <option value="NRI">NRI Quota</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">College Tuition Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.collegeFee}
                    onChange={(e) => setFormData({ ...formData, collegeFee: parseFloat(e.target.value) || 0 })}
                    className="w-full py-1.5 px-3 border border-stone-300 rounded-lg font-bold text-[#4B2E2E]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Development Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.developmentFee}
                    onChange={(e) => setFormData({ ...formData, developmentFee: parseFloat(e.target.value) || 0 })}
                    className="w-full py-1.5 px-3 border border-stone-300 rounded-lg font-bold text-purple-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Annual Hostel Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.hostelFee}
                    onChange={(e) => setFormData({ ...formData, hostelFee: parseFloat(e.target.value) || 0 })}
                    className="w-full py-1.5 px-3 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Annual Mess Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.messFee}
                    onChange={(e) => setFormData({ ...formData, messFee: parseFloat(e.target.value) || 0 })}
                    className="w-full py-1.5 px-3 border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Standard 2026 Government BAMS rate"
                  className="w-full py-1.5 px-3 border border-stone-300 rounded-lg"
                />
              </div>

              {editingItem && (
                <div className="space-y-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <label className="block font-bold text-amber-900">Application Scope</label>
                  <select
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                    className="w-full py-1 px-2 border border-amber-300 rounded bg-white text-xs"
                  >
                    <option value="FUTURE_ONLY">Future student assessments only</option>
                    <option value="SELECTED_BATCH">Update all existing students in this quota/year batch</option>
                  </select>
                  {formData.scope !== 'FUTURE_ONLY' && (
                    <div>
                      <label className="block font-medium text-amber-900 mt-1">
                        Mandatory Reason for Batch Modification
                      </label>
                      <input
                        type="text"
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="e.g., Syndicate resolution dated 12/04/2026"
                        className="w-full py-1 px-2 border border-amber-300 rounded bg-white text-xs mt-0.5"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="bg-[#4B2E2E] hover:bg-[#3d2525] text-white font-bold"
                >
                  {saving ? 'Saving...' : 'Save Structure'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
