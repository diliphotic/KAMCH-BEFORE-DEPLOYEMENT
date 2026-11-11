import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FormField, Input, Select, Textarea } from '../ui/FormField';
import { useAuth } from '../../context/AuthContext';

interface HolidayItem {
  date: string;
  name: string;
  isSunday: boolean;
  description?: string;
}

interface WorkingDaysData {
  year: number;
  month: number;
  daysInMonth: number;
  sundaysCount: number;
  additionalHolidaysCount: number;
  workingDays: number;
  holidays: HolidayItem[];
}

export const InstitutionalHolidaysWorkspace: React.FC = () => {
  const { csrfToken } = useAuth();
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

  const [calendarData, setCalendarData] = useState<WorkingDaysData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayDescription, setHolidayDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const fetchHolidays = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/attendance/holidays?year=${year}&month=${month}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch institutional holidays');
      setCalendarData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading institutional holidays.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHolidays(selectedYear, selectedMonth);
  }, [fetchHolidays, selectedYear, selectedMonth]);

  const handleMonthShift = (direction: number) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const getDatePreview = (dateStr: string) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    const weekday = dt.toLocaleDateString('en-IN', { weekday: 'long' });
    const formatted = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${weekday}, ${formatted}`;
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanDate = holidayDate.trim();
    const cleanName = holidayName.trim();

    if (!cleanDate || !cleanName) {
      setErrorMsg('Holiday date and holiday name are required.');
      return;
    }

    if (calendarData && calendarData.holidays && editingDate !== cleanDate) {
      const existing = calendarData.holidays.find((h) => h.date === cleanDate);
      if (existing) {
        setErrorMsg(`An institutional holiday ('${existing.name}') is already declared for ${cleanDate}. Please choose a different date or edit the existing entry.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/attendance/holidays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          holidayDate: cleanDate,
          holidayName: cleanName,
          description: holidayDescription.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save holiday');

      setSuccessMsg(`Successfully declared institutional holiday: "${cleanName}" on ${cleanDate}.`);
      setHolidayDate('');
      setHolidayName('');
      setHolidayDescription('');
      setEditingDate(null);
      if (data.year && data.month) {
        setSelectedYear(data.year);
        setSelectedMonth(data.month);
        setCalendarData(data);
      } else {
        fetchHolidays(selectedYear, selectedMonth);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save institutional holiday.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditHoliday = (h: HolidayItem) => {
    setHolidayDate(h.date);
    setHolidayName(h.name);
    setHolidayDescription(h.description || '');
    setEditingDate(h.date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteHoliday = async (dateStr: string) => {
    if (!confirm(`Are you sure you want to remove the institutional holiday on ${dateStr}? This will restore the date as an active working day.`)) {
      return;
    }

    setDeletingDate(dateStr);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/attendance/holidays/${dateStr}`, {
        method: 'DELETE',
        headers: {
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove holiday');

      setSuccessMsg(`Successfully removed holiday on ${dateStr}. Working days updated.`);
      fetchHolidays(selectedYear, selectedMonth);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove holiday.');
    } finally {
      setDeletingDate(null);
    }
  };

  const datePreviewText = getDatePreview(holidayDate);

  return (
    <div className="space-y-6">
      <Card accentTop>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Institutional Working Days &amp; Holidays Calendar</CardTitle>
              <CardDescription>
                Configure official college holidays, working-day exclusions, and monitor net monthly working days for faculty attendance calculations.
              </CardDescription>
            </div>

            {/* Month & Year Controls */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleMonthShift(-1)} title="Previous Month">
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Select
                value={String(selectedMonth)}
                onChange={(e: any) => setSelectedMonth(Number(e.target.value))}
                className="text-xs py-1 h-8 font-serif font-bold w-32"
              >
                {monthNames.map((name, idx) => (
                  <option key={name} value={String(idx + 1)}>
                    {name}
                  </option>
                ))}
              </Select>

              <Select
                value={String(selectedYear)}
                onChange={(e: any) => setSelectedYear(Number(e.target.value))}
                className="text-xs py-1 h-8 font-mono font-bold w-24"
              >
                {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr}
                  </option>
                ))}
              </Select>

              <Button variant="outline" size="sm" onClick={() => handleMonthShift(1)} title="Next Month">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 font-bold">&times;</button>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 font-bold">&times;</button>
            </div>
          )}

          {/* Working Days Summary Bar */}
          {calendarData && (
            <div className="p-4 bg-[#FAF9F5] border border-stone-200/90 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs shadow-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Days in Month</span>
                <span className="text-lg font-bold text-stone-900 mt-0.5 block">{calendarData.daysInMonth} Days</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Sundays Off</span>
                <span className="text-lg font-bold text-stone-800 mt-0.5 block">{calendarData.sundaysCount} Sundays</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-700 block">Declared Holidays</span>
                <span className="text-lg font-bold text-indigo-800 mt-0.5 block">{calendarData.additionalHolidaysCount} Holidays</span>
              </div>
              <div className="bg-[#FAF3DC]/60 p-2 -my-2 rounded-lg border border-[#D4AF37]/30">
                <span className="text-[10px] uppercase font-bold text-[#4B2E2E] block">Net Working Days</span>
                <span className="text-xl font-bold font-mono text-[#4B2E2E] mt-0.5 block">{calendarData.workingDays} Days</span>
              </div>
            </div>
          )}

          {/* Holiday Declaration & Edit Form */}
          <form onSubmit={handleSaveHoliday} className="p-5 bg-white border border-stone-200 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2 font-bold text-xs text-stone-900 font-serif">
                <Calendar className="w-4 h-4 text-[#4B2E2E]" />
                <span>{editingDate ? `Edit Institutional Holiday (${editingDate})` : 'Declare New Institutional Holiday'}</span>
              </div>
              {editingDate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDate(null);
                    setHolidayDate('');
                    setHolidayName('');
                    setHolidayDescription('');
                  }}
                  className="text-xs text-rose-700 hover:underline font-medium"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="hol-date" label="Holiday Date" required>
                <Input
                  id="hol-date"
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="text-xs font-mono"
                />
                {datePreviewText && (
                  <div className="text-[11px] text-emerald-800 font-medium mt-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                    <span>Selected: <strong>{datePreviewText}</strong></span>
                  </div>
                )}
              </FormField>

              <FormField id="hol-name" label="Holiday Name" required>
                <Input
                  id="hol-name"
                  placeholder="e.g. Karnataka Rajyotsava / Deepavali"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  className="text-xs"
                />
              </FormField>
            </div>

            <FormField id="hol-desc" label="Description / Remarks (Optional)">
              <Textarea
                id="hol-desc"
                rows={2}
                placeholder="Optional institutional notes regarding holiday observance..."
                value={holidayDescription}
                onChange={(e) => setHolidayDescription(e.target.value)}
                className="text-xs"
              />
            </FormField>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              {editingDate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingDate(null);
                    setHolidayDate('');
                    setHolidayName('');
                    setHolidayDescription('');
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving}
                className="bg-[#4B2E2E] hover:bg-[#3B2424] text-white"
              >
                {isSaving ? 'Saving...' : editingDate ? 'Update Holiday' : 'Add Institutional Holiday'}
              </Button>
            </div>
          </form>

          {/* Declared Holidays List for Selected Month */}
          <div className="space-y-3">
            <div className="font-serif font-bold text-sm text-stone-900 flex items-center justify-between">
              <span>Declared Institutional Holidays — {monthNames[selectedMonth - 1]} {selectedYear}</span>
              <span className="text-xs font-mono font-normal text-stone-500">
                {calendarData?.holidays ? calendarData.holidays.length : 0} Total
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-stone-500">Loading holidays calendar...</div>
            ) : !calendarData || calendarData.holidays.length === 0 ? (
              <div className="py-12 text-center text-xs text-stone-500 bg-[#FAF9F5] rounded-xl border border-dashed border-stone-200 space-y-1">
                <Calendar className="w-8 h-8 text-stone-300 mx-auto mb-1" />
                <div className="font-bold text-stone-700">No institutional holidays declared for this month.</div>
                <p className="text-stone-400">All regular weekdays in {monthNames[selectedMonth - 1]} count as working days.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-stone-200 rounded-xl shadow-xs bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF9F5] border-b border-stone-200 text-[10px] font-semibold uppercase text-stone-600">
                    <tr>
                      <th className="py-3 px-4">Date &amp; Weekday</th>
                      <th className="py-3 px-4">Holiday Name</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {calendarData.holidays.map((h) => {
                      const dtStr = h.date;
                      const [y, m, d] = dtStr.split('-').map(Number);
                      const dtObj = new Date(y, m - 1, d);
                      const weekdayName = dtObj.toLocaleDateString('en-IN', { weekday: 'short' });

                      return (
                        <tr key={h.date} className="hover:bg-stone-50 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-stone-900">{h.date}</span>
                            <span className="text-[11px] text-stone-500 ml-2 font-serif">({weekdayName})</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-stone-900 font-serif">
                            {h.name}
                          </td>
                          <td className="py-3 px-4 text-stone-600 italic max-w-xs truncate">
                            {h.description || '—'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge variant={h.isSunday ? 'neutral' : 'institutional'} size="sm">
                              {h.isSunday ? 'Sunday Holiday' : 'Official Working-Day Off'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {!h.isSunday && (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditHoliday(h)}
                                  className="text-[#4B2E2E] hover:bg-stone-100 border-stone-200 text-[11px] py-1 px-2.5 h-7"
                                  title="Edit Holiday"
                                >
                                  <Edit2 className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteHoliday(h.date)}
                                  disabled={deletingDate === h.date}
                                  className="text-rose-700 hover:bg-rose-50 border-rose-200 text-[11px] py-1 px-2.5 h-7"
                                  title="Remove Holiday"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Remove
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
