import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Building,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { AcademicYearSettings } from './fee-types';
import { Button } from '../ui/Button';

interface AcademicYearSettingsSectionProps {
  userRole?: string;
  csrfToken?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const AcademicYearSettingsSection: React.FC<AcademicYearSettingsSectionProps> = ({
  userRole,
  csrfToken,
}) => {
  // Office, Principal, Super Admin can change it. Secretary is strictly blocked.
  const canEdit = userRole === 'SUPER_ADMIN' || userRole === 'PRINCIPAL' || userRole === 'OFFICE' || userRole === 'STAFF';

  const [settings, setSettings] = useState<AcademicYearSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form inputs
  const [month, setMonth] = useState<number>(11);
  const [day, setDay] = useState<number>(30);

  // Submit states
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  const fetchSettings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/fees/settings/academic-year');
      if (!res.ok) {
        throw new Error('Failed to retrieve institutional academic-year settings');
      }
      const data: AcademicYearSettings = await res.json();
      setSettings(data);
      setMonth(data.commencementMonth || 11);
      setDay(data.commencementDay || 30);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/fees/settings/academic-year', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({
          commencementMonth: month,
          commencementDay: day,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update academic-year commencement date');
      }

      setSuccessMsg(data.message || 'Academic-year cutoff date saved successfully.');
      setConfirmModalOpen(false);
      await fetchSettings();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-stone-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Academic-Year Commencement Setting</h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#4B2E2E]/10 text-[#4B2E2E]">
              Institutional Singleton
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Configure the annual admission cutoff date governing which academic year a newly admitted student belongs to.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loading} className="text-xs">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </Button>
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

      {/* Main Settings Card */}
      <div className="bg-white rounded-xl border border-stone-200/90 shadow-xs p-6 space-y-6">
        {loading ? (
          <div className="py-12 text-center text-stone-500">
            <div className="inline-block animate-spin w-7 h-7 border-2 border-[#4B2E2E] border-t-transparent rounded-full mb-3" />
            <p className="text-sm">Loading institutional configuration...</p>
          </div>
        ) : settings ? (
          <>
            {/* Current Setting Summary */}
            <div className="p-4 rounded-lg bg-[#F5F5DC]/60 border border-[#D4AF37]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                  Currently Effective Commencement Date
                </span>
                <div className="text-xl font-black text-[#4B2E2E] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#D4AF37]" />
                  <span>
                    {day} {MONTH_NAMES[month - 1]} (Cutoff: {String(day).padStart(2, '0')}/{String(month).padStart(2, '0')})
                  </span>
                </div>
              </div>

              {settings.updatedAt && (
                <div className="text-right text-xs text-stone-500">
                  <div>Last Updated: {new Date(settings.updatedAt).toLocaleDateString('en-IN')}</div>
                  {settings.updatedByName && (
                    <div className="font-medium text-stone-700">By: {settings.updatedByName}</div>
                  )}
                </div>
              )}
            </div>

            {/* Explanatory Policy Callout */}
            <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 text-xs space-y-2 text-stone-700">
              <div className="font-bold text-stone-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-stone-500" />
                <span>How the Commencement Cutoff Operates:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-stone-600 pl-1">
                <li>
                  Students admitted <strong>on or before</strong> {day} {MONTH_NAMES[month - 1]} are assessed for the admission year's academic session (e.g., admitted on 15 Nov 2026 $\rightarrow$ assessed for <strong>2026–2027</strong>).
                </li>
                <li>
                  Students admitted <strong>after</strong> this cutoff date belong to the subsequent academic year session (e.g., admitted on 5 Dec 2026 $\rightarrow$ assessed for <strong>2027–2028</strong>).
                </li>
                <li>
                  <strong>Historical Safeguard:</strong> Modifying this date affects future student admission assessment initializations only. All historical assessments, concessions, and payment ledgers remain permanently untouched.
                </li>
              </ul>
            </div>

            {/* Editable Form */}
            {canEdit ? (
              <div className="space-y-4 pt-2 border-t border-stone-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Configure Commencement Cutoff Date
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Commencement Month
                    </label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                      className="w-full text-xs py-2 px-3 border border-stone-200 rounded-lg bg-white text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20"
                    >
                      {MONTH_NAMES.map((mName, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {idx + 1} — {mName} {idx + 1 === 11 ? '(Institutional Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Day of Month (1 – 31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={day}
                      onChange={(e) => setDay(parseInt(e.target.value, 10) || 1)}
                      className="w-full text-xs py-2 px-3 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#4B2E2E]/20 font-semibold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMonth(11);
                      setDay(30);
                    }}
                    className="text-xs text-stone-600"
                  >
                    Reset to Default (30 November)
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => setConfirmModalOpen(true)}
                    disabled={saving}
                    className="bg-[#4B2E2E] hover:bg-[#3D2525] text-white text-xs font-bold"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save Commencement Setting
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-stone-100 text-stone-600 text-xs">
                Your role does not have authorization to modify institutional academic-year commencement settings.
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Confirmation Dialog */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-stone-200">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-stone-900">
                Confirm Academic-Year Cutoff Update
              </h3>
              <p className="text-xs text-stone-600">
                Are you sure you want to set the institutional academic-year commencement cutoff to{' '}
                <strong>{day} {MONTH_NAMES[month - 1]}</strong>?
              </p>
            </div>
            <div className="p-3 rounded-lg bg-stone-50 border text-[11px] text-stone-600">
              Future student assessment initializations will reference this cutoff date. Existing student assessments and fees remain unchanged.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#4B2E2E] hover:bg-[#3D2525] text-white font-bold"
              >
                {saving ? 'Saving...' : 'Yes, Update Cutoff Date'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
