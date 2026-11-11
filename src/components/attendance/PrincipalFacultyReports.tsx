import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  Download,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Users,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Eye,
  Layers,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FormField, Input, Select } from '../ui/FormField';
import { useAuth } from '../../context/AuthContext';

interface WorkingDaysCalendar {
  year: number;
  month: number;
  daysInMonth: number;
  sundaysCount: number;
  additionalHolidaysCount: number;
  workingDays: number;
  holidays: Array<{ date: string; name: string; isSunday: boolean }>;
}

interface MonthlyReportRow {
  id: number | null;
  teacher_id: number;
  teacher_name: string;
  employee_code: string | null;
  designation: string;
  department_name: string | null;
  total_working_days: number;
  days_present: number;
  attendance_percentage: number;
  approved_leave_days: number;
  provisional_days_present: number;
  provisional_percentage: number;
  has_conflict: boolean;
  status: 'PENDING' | 'FINALIZED';
  finalized_by: number | null;
  finalized_at: string | null;
}

export const PrincipalFacultyReports: React.FC = () => {
  const { csrfToken } = useAuth();
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

  // Subtab navigation: 'register' | 'individual'
  const [activeSubTab, setActiveSubTab] = useState<'register' | 'individual'>('register');

  // Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Monthly Register Data
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReportRow[]>([]);
  const [calendarCalc, setCalendarCalc] = useState<WorkingDaysCalendar | null>(null);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [searchTeacher, setSearchTeacher] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Low attendance alert modal state
  const [alertModalTeacher, setAlertModalTeacher] = useState<MonthlyReportRow | null>(null);
  const [alertRemarks, setAlertRemarks] = useState('');
  const [isSendingAlert, setIsSendingAlert] = useState(false);

  // 2. Individual Faculty Inspection
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [individualData, setIndividualData] = useState<any>(null);
  const [isLoadingIndividual, setIsLoadingIndividual] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Fetch Monthly Register
  const fetchMonthlyRegister = useCallback(async (year: number, month: number) => {
    setIsLoadingMonthly(true);
    try {
      const res = await fetch(`/api/attendance/reports?year=${year}&month=${month}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch attendance register');
      setMonthlyReports(data.reports || []);
      setCalendarCalc(data.calendar || null);
      if (data.reports && data.reports.length > 0 && !selectedTeacherId) {
        setSelectedTeacherId(data.reports[0].teacher_id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching monthly reports.');
    } finally {
      setIsLoadingMonthly(false);
    }
  }, [selectedTeacherId]);

  // Fetch Individual History
  const fetchIndividualHistory = useCallback(async (teacherId: number, year: number, month: number) => {
    setIsLoadingIndividual(true);
    try {
      const res = await fetch(`/api/attendance/teacher/my-report?teacherId=${teacherId}&year=${year}&month=${month}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch individual log');
      setIndividualData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingIndividual(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthlyRegister(selectedYear, selectedMonth);
  }, [fetchMonthlyRegister, selectedYear, selectedMonth]);

  useEffect(() => {
    if (selectedTeacherId && activeSubTab === 'individual') {
      fetchIndividualHistory(selectedTeacherId, selectedYear, selectedMonth);
    }
  }, [selectedTeacherId, selectedYear, selectedMonth, activeSubTab, fetchIndividualHistory]);

  // Finalize Month
  const handleFinalizeMonth = async () => {
    if (
      !confirm(
        `Are you sure you want to officially finalize the monthly attendance report for ${monthNames[selectedMonth - 1]} ${selectedYear}? This will lock the records and send notifications to all faculty accounts.`
      )
    ) {
      return;
    }

    setIsFinalizing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/attendance/reports/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ year: selectedYear, month: selectedMonth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize attendance report');
      setSuccessMsg(
        `Successfully finalized ${data.count} teacher attendance reports for ${monthNames[selectedMonth - 1]} ${selectedYear}.`
      );
      fetchMonthlyRegister(selectedYear, selectedMonth);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to finalize report.');
    } finally {
      setIsFinalizing(false);
    }
  };

  // Send Low Attendance Notice
  const handleSendNotice = async () => {
    if (!alertModalTeacher || !alertModalTeacher.teacher_id) return;
    setIsSendingAlert(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/attendance/low-attendance-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          teacherId: alertModalTeacher.teacher_id,
          year: selectedYear,
          month: selectedMonth,
          threshold: 75,
          customMessage: alertRemarks.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send low attendance notice');
      setSuccessMsg(`Official low attendance notice sent to ${alertModalTeacher.teacher_name}.`);
      setAlertModalTeacher(null);
      setAlertRemarks('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send notice.');
    } finally {
      setIsSendingAlert(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (monthlyReports.length === 0) return;
    const headers = [
      'Teacher Name',
      'Employee Code',
      'Designation',
      'Department',
      'Working Days',
      'Days Present',
      'Approved Leave Days',
      'Attendance Percentage',
      'Status',
    ];
    const rows = monthlyReports.map((r) => [
      `"${r.teacher_name}"`,
      `"${r.employee_code || ''}"`,
      `"${r.designation}"`,
      `"${r.department_name || ''}"`,
      r.total_working_days,
      r.days_present,
      r.approved_leave_days,
      `${r.attendance_percentage}%`,
      r.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Teacher_Attendance_Report_${monthNames[selectedMonth - 1]}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Departments list for filter
  const departments = Array.from(new Set(monthlyReports.map((r) => r.department_name).filter(Boolean)));

  const filteredReports = monthlyReports.filter((r) => {
    const matchesSearch =
      r.teacher_name.toLowerCase().includes(searchTeacher.toLowerCase()) ||
      (r.employee_code && r.employee_code.toLowerCase().includes(searchTeacher.toLowerCase())) ||
      (r.department_name && r.department_name.toLowerCase().includes(searchTeacher.toLowerCase()));
    const matchesDept = deptFilter === 'ALL' || r.department_name === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      <Card accentTop>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle>Institutional Faculty Attendance &amp; Monthly Register</CardTitle>
              <CardDescription>
                Review aggregated monthly attendance summaries, inspect individual faculty logs, finalize monthly reports, and issue low attendance notices.
              </CardDescription>
            </div>

            {/* Period Selector Controls */}
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <Select
                value={String(selectedMonth)}
                onChange={(e: any) => setSelectedMonth(Number(e.target.value))}
                className="text-xs py-1 h-8"
              >
                {monthNames.map((name, idx) => (
                  <option key={name} value={String(idx + 1)}>
                    {name}
                  </option>
                ))}
              </Select>

              <Input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-20 text-xs py-1 font-mono h-8"
              />

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchMonthlyRegister(selectedYear, selectedMonth);
                  if (selectedTeacherId) fetchIndividualHistory(selectedTeacherId, selectedYear, selectedMonth);
                }}
                className="h-8 w-8 p-0"
                title="Refresh All"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMonthly ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Subtab Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-stone-200/60">
            <button
              onClick={() => setActiveSubTab('register')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'register'
                  ? 'bg-[#4B2E2E] text-white shadow-xs'
                  : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Monthly Attendance Register</span>
            </button>

            <button
              onClick={() => setActiveSubTab('individual')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'individual'
                  ? 'bg-[#4B2E2E] text-white shadow-xs'
                  : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Individual Faculty History</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-lg flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 font-bold">&times;</button>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 font-bold">&times;</button>
            </div>
          )}

          {/* =========================================================================
              SUBTAB 1: MONTHLY ATTENDANCE REGISTER
              ========================================================================= */}
          {activeSubTab === 'register' && (
            <div className="space-y-4">
              {/* Working Days Summary Bar */}
              {calendarCalc && (
                <div className="p-3 bg-[#FAF9F5] border border-stone-200/90 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Days</span>
                    <span className="text-base font-bold text-stone-900 mt-0.5 block">{calendarCalc.daysInMonth} Days</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">Sundays Off</span>
                    <span className="text-base font-bold text-stone-800 mt-0.5 block">{calendarCalc.sundaysCount} Sundays</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">Declared Holidays</span>
                    <span className="text-base font-bold text-indigo-700 mt-0.5 block">{calendarCalc.additionalHolidaysCount} Holidays</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#4B2E2E] block">Net Working Days</span>
                    <span className="text-lg font-bold font-mono text-[#4B2E2E] mt-0.5 block">{calendarCalc.workingDays} Days</span>
                  </div>
                </div>
              )}

              {/* Filters and Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                    <Input
                      placeholder="Search faculty..."
                      value={searchTeacher}
                      onChange={(e) => setSearchTeacher(e.target.value)}
                      className="pl-8 text-xs py-1 h-8"
                    />
                  </div>

                  <Select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="text-xs py-1 h-8"
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d!}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    icon={<Download className="w-3.5 h-3.5" />}
                    className="text-xs h-8"
                  >
                    Export CSV
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleFinalizeMonth}
                    disabled={isFinalizing || monthlyReports.length === 0}
                    className="bg-[#4B2E2E] hover:bg-[#3B2424] text-white text-xs h-8"
                  >
                    {isFinalizing ? 'Finalizing...' : 'Finalize Monthly Register'}
                  </Button>
                </div>
              </div>

              {/* Monthly Register Table */}
              {isLoadingMonthly ? (
                <div className="py-12 text-center text-xs text-stone-500">Loading monthly register...</div>
              ) : filteredReports.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500">No faculty attendance records found.</div>
              ) : (
                <div className="overflow-x-auto border border-stone-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF9F5] border-b border-stone-200 text-[10px] font-semibold uppercase text-stone-600">
                      <tr>
                        <th className="py-2.5 px-3">Faculty Member</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3">Working Days</th>
                        <th className="py-2.5 px-3">Days Present</th>
                        <th className="py-2.5 px-3">Approved Leave</th>
                        <th className="py-2.5 px-3">Attendance Rate</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredReports.map((row) => {
                        const isShortage = row.attendance_percentage < 75;
                        return (
                          <tr key={row.teacher_id} className="hover:bg-stone-50 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-stone-900 block font-serif">{row.teacher_name}</span>
                              <span className="text-[10px] font-mono text-stone-400">
                                {row.employee_code || `FAC-${row.teacher_id}`} · {row.designation}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-stone-700 whitespace-nowrap">
                              {row.department_name || 'Ayurvedic Samhita'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-stone-800">
                              {row.total_working_days}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">
                              {row.days_present}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-purple-800">
                              {row.approved_leave_days}d
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">
                              <span className={isShortage ? 'text-rose-700 font-extrabold' : 'text-emerald-800'}>
                                {row.attendance_percentage}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant={row.status === 'FINALIZED' ? 'success' : 'neutral'} size="sm">
                                {row.status === 'FINALIZED' ? 'FINALIZED' : 'NOT FINALIZED'}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTeacherId(row.teacher_id);
                                    setActiveSubTab('individual');
                                  }}
                                  className="text-[11px] py-0.5 px-2 h-7"
                                  title="Inspect Daily History"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  Log
                                </Button>

                                {isShortage && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAlertModalTeacher(row)}
                                    className="text-[11px] text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 py-0.5 px-2 h-7"
                                    title="Send low attendance notice"
                                  >
                                    <Send className="w-3 h-3 mr-1" />
                                    Notice
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              SUBTAB 2: INDIVIDUAL FACULTY ATTENDANCE HISTORY
              ========================================================================= */}
          {activeSubTab === 'individual' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#FAF9F5] border border-stone-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-[#4B2E2E]">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-stone-500 block">
                      Select Faculty Member to Inspect
                    </label>
                    <Select
                      value={selectedTeacherId ? String(selectedTeacherId) : ''}
                      onChange={(e: any) => setSelectedTeacherId(Number(e.target.value))}
                      className="text-xs py-1 h-8 font-serif mt-0.5"
                    >
                      {monthlyReports.map((t) => (
                        <option key={t.teacher_id} value={String(t.teacher_id)}>
                          {t.teacher_name} ({t.employee_code || `FAC-${t.teacher_id}`}) — {t.department_name || 'Faculty'}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {individualData && (
                  <div className="flex items-center gap-3 text-xs bg-white p-2 rounded border border-stone-200">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-stone-400 block">Present</span>
                      <span className="font-bold text-emerald-800 font-mono">{individualData.daysPresent}d</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-stone-400 block">Leaves</span>
                      <span className="font-bold text-purple-800 font-mono">{individualData.approvedLeaveDays}d</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-stone-400 block">Rate</span>
                      <span className="font-bold text-[#4B2E2E] font-mono">{individualData.attendancePercentage}%</span>
                    </div>
                  </div>
                )}
              </div>

              {isLoadingIndividual ? (
                <div className="py-12 text-center text-xs text-stone-500">Loading daily log for selected faculty...</div>
              ) : individualData ? (
                <div className="overflow-x-auto border border-stone-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF9F5] border-b border-stone-200 text-[10px] font-semibold uppercase text-stone-600">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Day</th>
                        <th className="py-2.5 px-3">Attendance Status</th>
                        <th className="py-2.5 px-3">Details / Recorded Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {individualData.dailyHistory?.map((day: any) => (
                        <tr
                          key={day.date}
                          className={`hover:bg-stone-50 transition-colors ${
                            day.isSunday ? 'bg-stone-50/50' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-mono font-medium text-stone-900 whitespace-nowrap">
                            {day.date}
                          </td>
                          <td className="py-2 px-3 text-stone-600 whitespace-nowrap font-serif">
                            {day.dayOfWeek}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                day.status === 'PRESENT'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : day.status === 'ON_LEAVE'
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : day.status === 'ABSENT'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : day.status === 'SUNDAY'
                                  ? 'bg-stone-100 text-stone-500 border-stone-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}
                            >
                              {day.displayStatus || day.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-stone-600 text-[11px]">
                            {day.isHoliday && day.holidayName ? (
                              <span className="font-semibold text-indigo-900">
                                Institutional Holiday: {day.holidayName}
                              </span>
                            ) : day.status === 'ON_LEAVE' && day.approvedLeave ? (
                              <div>
                                <span className="font-medium text-stone-800">
                                  Approved {day.approvedLeave.category}: &quot;{day.approvedLeave.reason}&quot;
                                </span>
                                {day.approvedLeave.decisionRemarks && (
                                  <span className="text-[10px] text-stone-400 block italic">
                                    Remarks: {day.approvedLeave.decisionRemarks}
                                  </span>
                                )}
                              </div>
                            ) : day.reason ? (
                              <span className="italic text-stone-600">&quot;{day.reason}&quot;</span>
                            ) : day.status === 'PRESENT' ? (
                              <span className="text-stone-400 italic">Working day present by default</span>
                            ) : (
                              <span className="text-stone-400 italic">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low Attendance Notice Modal */}
      {alertModalTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-stone-300 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#4B2E2E]">Send Low Attendance Notice</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Official notification for {alertModalTeacher.teacher_name}
                </p>
              </div>
              <button
                onClick={() => setAlertModalTeacher(null)}
                className="text-stone-400 hover:text-stone-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded space-y-1">
              <div className="font-bold">Current Attendance: {alertModalTeacher.attendance_percentage}%</div>
              <div className="text-[11px]">
                {alertModalTeacher.days_present} present days out of {alertModalTeacher.total_working_days} working days.
                Threshold is 75%.
              </div>
            </div>

            <FormField id="notice-msg" label="Custom Directive / Principal Remarks">
              <Input
                id="notice-msg"
                placeholder="e.g. Please submit written explanation for shortage to Principal's office by Monday."
                value={alertRemarks}
                onChange={(e) => setAlertRemarks(e.target.value)}
              />
            </FormField>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <Button variant="outline" size="sm" onClick={() => setAlertModalTeacher(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendNotice}
                disabled={isSendingAlert}
                className="bg-[#4B2E2E] hover:bg-[#3B2424] text-white"
              >
                {isSendingAlert ? 'Sending...' : 'Send Notice'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
