import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Award,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FormField, Select, Input } from '../ui/FormField';

interface DailyLogEntry {
  date: string;
  dayOfWeek: string;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'SUNDAY' | 'HOLIDAY';
  displayStatus: string;
  reason: string | null;
  approvedLeave: {
    category: string;
    reason: string;
    decisionRemarks: string | null;
  } | null;
}

interface HistoricalReport {
  id: number;
  year: number;
  month: number;
  total_working_days: number;
  days_present: number;
  attendance_percentage: number;
  status: string;
}

interface PersonalReportData {
  success: boolean;
  teacherId: number;
  year: number;
  month: number;
  workingDays: number;
  daysPresent: number;
  daysAbsent: number;
  approvedLeaveDays: number;
  attendancePercentage: number;
  status: 'FINALIZED' | 'DRAFT';
  finalizedBy?: string;
  finalizedAt?: string;
  dailyHistory: DailyLogEntry[];
  historicalReports: HistoricalReport[];
}

export const FacultyPersonalReport: React.FC = () => {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);

  const [report, setReport] = useState<PersonalReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMyReport = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/attendance/teacher/my-report?year=${year}&month=${month}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load attendance report.');
      }
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching personal attendance report.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyReport(selectedYear, selectedMonth);
  }, [fetchMyReport, selectedYear, selectedMonth]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const shiftMonth = (delta: number) => {
    let newM = selectedMonth + delta;
    let newY = selectedYear;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    } else if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    setSelectedYear(newY);
    setSelectedMonth(newM);
  };

  return (
    <div className="space-y-6">
      {/* View Header & Period Selector */}
      <Card accentTop>
        <CardHeader className="pb-3 border-b border-stone-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FAF9F5] border border-stone-200 flex items-center justify-center text-[#4B2E2E]">
                  <Clock className="w-4 h-4 text-[#4B2E2E]" />
                </div>
                <div>
                  <CardTitle className="text-base font-serif">Personal Faculty Attendance Report</CardTitle>
                  <CardDescription className="text-xs">
                    View official recorded attendance, working days, absence logs, and institutional monthly summary.
                  </CardDescription>
                </div>
              </div>
            </div>

            {/* Period Navigation */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => shiftMonth(-1)}
                title="Previous Month"
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Select
                value={String(selectedMonth)}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
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
                onClick={() => shiftMonth(1)}
                title="Next Month"
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMyReport(selectedYear, selectedMonth)}
                title="Refresh"
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
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

          {isLoading && !report ? (
            <div className="py-12 text-center text-xs text-stone-500">
              Loading personal attendance records...
            </div>
          ) : report ? (
            <div className="space-y-6">
              {/* Report Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#FAF9F5] border border-stone-200/90 rounded-lg text-xs">
                <div className="flex items-center gap-2.5">
                  {report.status === 'FINALIZED' ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold text-stone-900">
                      {monthNames[selectedMonth - 1]} {selectedYear} Attendance Report
                    </span>
                    <span className="text-stone-500 block text-[11px] mt-0.5">
                      {report.status === 'FINALIZED'
                        ? `Officially signed and finalized by ${report.finalizedBy || 'Principal'} on ${
                            report.finalizedAt
                              ? new Date(report.finalizedAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '-'
                          }`
                        : 'Provisional attendance register — pending final institutional sign-off.'}
                    </span>
                  </div>
                </div>

                <div className="self-start sm:self-auto">
                  <Badge variant={report.status === 'FINALIZED' ? 'success' : 'neutral'} size="sm">
                    {report.status}
                  </Badge>
                </div>
              </div>

              {/* Monthly KPI Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 bg-white border border-stone-200/90 rounded-lg shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">
                    Net Working Days
                  </span>
                  <span className="text-xl font-bold font-mono text-[#4B2E2E] mt-1 block">
                    {report.workingDays} Days
                  </span>
                  <span className="text-[10px] text-stone-400">Excl. Sundays &amp; Holidays</span>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/90 rounded-lg shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">
                    Days Present
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-900 mt-1 block">
                    {report.daysPresent} Days
                  </span>
                  <span className="text-[10px] text-emerald-700">Present by default &amp; logs</span>
                </div>

                <div className="p-3.5 bg-purple-50/70 border border-purple-200/90 rounded-lg shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block tracking-wider">
                    Approved Leave
                  </span>
                  <span className="text-xl font-bold font-mono text-purple-900 mt-1 block">
                    {report.approvedLeaveDays} Days
                  </span>
                  <span className="text-[10px] text-purple-700">CL / EL / Special SL</span>
                </div>

                <div className="p-3.5 bg-rose-50/70 border border-rose-200/90 rounded-lg shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">
                    Recorded Absences
                  </span>
                  <span className="text-xl font-bold font-mono text-rose-900 mt-1 block">
                    {report.daysAbsent} Days
                  </span>
                  <span className="text-[10px] text-rose-700">Unapproved absences</span>
                </div>

                <div className="p-3.5 bg-[#FAF9F5] border border-stone-300 rounded-lg shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block tracking-wider">
                    Attendance Rate
                  </span>
                  <span
                    className={`text-xl font-bold font-mono mt-1 block ${
                      report.attendancePercentage >= 75 ? 'text-emerald-800' : 'text-rose-700'
                    }`}
                  >
                    {report.attendancePercentage}%
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {report.attendancePercentage >= 75 ? 'Meets threshold' : 'Below 75% target'}
                  </span>
                </div>
              </div>

              {/* Day-by-Day Calendar Log Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-stone-900">
                      Day-by-Day Attendance History Log
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Full daily breakdown for {monthNames[selectedMonth - 1]} {selectedYear}
                    </p>
                  </div>
                  <span className="text-xs text-stone-400 font-mono">
                    {report.dailyHistory.length} Days Recorded
                  </span>
                </div>

                <div className="overflow-x-auto border border-stone-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF9F5] border-b border-stone-200 text-[10px] font-semibold uppercase text-stone-600">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Day</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Details / Official Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {report.dailyHistory.map((day) => {
                        return (
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
                              {day.status === 'PRESENT' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Present
                                </span>
                              )}
                              {day.status === 'ON_LEAVE' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                  <Calendar className="w-3 h-3 text-purple-600" />
                                  On Leave ({day.approvedLeave?.category || 'Leave'})
                                </span>
                              )}
                              {day.status === 'ABSENT' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  Absent
                                </span>
                              )}
                              {day.status === 'HALF_DAY' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                  Half Day
                                </span>
                              )}
                              {day.status === 'SUNDAY' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-500 border border-stone-200">
                                  Sunday Off
                                </span>
                              )}
                              {day.status === 'HOLIDAY' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Holiday
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-stone-600 text-[11px]">
                              {day.isHoliday && day.holidayName ? (
                                <span className="font-semibold text-indigo-900">
                                  Declared Holiday: {day.holidayName}
                                </span>
                              ) : day.status === 'ON_LEAVE' && day.approvedLeave ? (
                                <div>
                                  <span className="font-medium text-stone-800">
                                    Reason: &quot;{day.approvedLeave.reason}&quot;
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
                                <span className="text-stone-400 italic">Working day attendance</span>
                              ) : (
                                <span className="text-stone-400 italic">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Past Months Attendance Summary */}
              {report.historicalReports && report.historicalReports.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-stone-200">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#4B2E2E]" />
                    <h3 className="font-serif font-bold text-sm text-stone-900">
                      Historical Monthly Attendance Records
                    </h3>
                  </div>

                  <div className="overflow-x-auto border border-stone-200 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#FAF9F5] border-b border-stone-200 text-[10px] font-semibold uppercase text-stone-600">
                        <tr>
                          <th className="py-2 px-3">Period</th>
                          <th className="py-2 px-3">Working Days</th>
                          <th className="py-2 px-3">Days Present</th>
                          <th className="py-2 px-3">Attendance %</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {report.historicalReports.map((hr) => (
                          <tr key={hr.id} className="hover:bg-stone-50 transition-colors">
                            <td className="py-2 px-3 font-medium text-stone-900 font-serif">
                              {monthNames[hr.month - 1]} {hr.year}
                            </td>
                            <td className="py-2 px-3 font-mono text-stone-700">
                              {hr.total_working_days}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-stone-900">
                              {hr.days_present}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold">
                              <span
                                className={
                                  hr.attendance_percentage >= 75
                                    ? 'text-emerald-800'
                                    : 'text-rose-700'
                                }
                              >
                                {hr.attendance_percentage}%
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <Badge
                                variant={hr.status === 'FINALIZED' ? 'success' : 'neutral'}
                                size="sm"
                              >
                                {hr.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
