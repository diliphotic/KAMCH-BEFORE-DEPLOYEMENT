import { Router, Request, Response } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth.ts';
import { ROLES } from '../permissions.ts';
import { getPool } from '../db.ts';
import { recordAuditLog } from '../services/audit.ts';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getKolkataDateString(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(now);
}

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

export interface WorkingDaysCalculation {
  year: number;
  month: number;
  daysInMonth: number;
  sundaysCount: number;
  additionalHolidaysCount: number;
  workingDays: number;
  holidays: Array<{ date: string; name: string; isSunday: boolean }>;
}

export async function calculateWorkingDaysForMonth(
  pool: any,
  year: number,
  month: number
): Promise<WorkingDaysCalculation> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  let holidaysRows: any[] = [];
  try {
    const [rows] = await pool.query(
      `SELECT holiday_date, holiday_name, description FROM institutional_holidays WHERE holiday_date BETWEEN ? AND ?`,
      [startDateStr, endDateStr]
    );
    holidaysRows = rows || [];
  } catch {
    //
  }

  const holidayMap = new Map<string, string>();
  for (const h of holidaysRows) {
    const dStr = typeof h.holiday_date === 'string' ? h.holiday_date.split('T')[0] : new Date(h.holiday_date).toISOString().split('T')[0];
    holidayMap.set(dStr, h.holiday_name);
  }

  let sundaysCount = 0;
  let additionalHolidaysCount = 0;
  let workingDays = 0;
  const holidaysList: Array<{ date: string; name: string; isSunday: boolean }> = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dt = new Date(year, month - 1, day);
    const isSunday = dt.getDay() === 0;
    const holidayName = holidayMap.get(dStr);

    if (isSunday) {
      sundaysCount++;
      if (holidayName) {
        holidaysList.push({ date: dStr, name: `${holidayName} (Sunday)`, isSunday: true });
      }
    } else if (holidayName) {
      additionalHolidaysCount++;
      holidaysList.push({ date: dStr, name: holidayName, isSunday: false });
    } else {
      workingDays++;
    }
  }

  return {
    year,
    month,
    daysInMonth,
    sundaysCount,
    additionalHolidaysCount,
    workingDays,
    holidays: holidaysList,
  };
}

async function getTeacherApprovedLeaveWorkingDays(
  pool: any,
  teacherId: number,
  year: number,
  month: number,
  holidaySet: Set<string>
): Promise<{ approvedLeaveDaysCount: number; approvedLeaveDates: string[] }> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  let leaves: any[] = [];
  try {
    const [rows] = await pool.query(
      `SELECT start_date, end_date FROM leave_applications
       WHERE teacher_id = ? AND status = 'APPROVED'
         AND start_date <= ? AND end_date >= ?`,
      [teacherId, monthEndStr, monthStartStr]
    );
    leaves = rows || [];
  } catch {
    //
  }

  const uniqueWorkingLeaveDates = new Set<string>();

  for (const l of leaves) {
    const sStr = typeof l.start_date === 'string' ? l.start_date.split('T')[0] : new Date(l.start_date).toISOString().split('T')[0];
    const eStr = typeof l.end_date === 'string' ? l.end_date.split('T')[0] : new Date(l.end_date).toISOString().split('T')[0];

    const [sy, sm, sd] = sStr.split('-').map(Number);
    const [ey, em, ed] = eStr.split('-').map(Number);

    const startDt = new Date(sy, sm - 1, sd);
    const endDt = new Date(ey, em - 1, ed);

    let cur = new Date(startDt);
    while (cur <= endDt) {
      const cy = cur.getFullYear();
      const cm = cur.getMonth() + 1;
      const cd = cur.getDate();
      const curStr = `${cy}-${String(cm).padStart(2, '0')}-${String(cd).padStart(2, '0')}`;

      if (cy === year && cm === month) {
        const dayOfWeek = cur.getDay();
        const isSunday = dayOfWeek === 0;
        const isHoliday = holidaySet.has(curStr);

        if (!isSunday && !isHoliday) {
          uniqueWorkingLeaveDates.add(curStr);
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return {
    approvedLeaveDaysCount: uniqueWorkingLeaveDates.size,
    approvedLeaveDates: Array.from(uniqueWorkingLeaveDates),
  };
}

/**
 * GET /api/attendance/holidays
 * Get configured institutional holidays for a month/year
 */
attendanceRouter.get('/holidays', async (req: Request, res: Response) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!year || !month || month < 1 || month > 12) {
    res.status(400).json({ error: 'Valid year and month are required.', code: 'INVALID_PERIOD' });
    return;
  }

  const pool = getPool();
  try {
    const calc = await calculateWorkingDaysForMonth(pool, year, month);
    res.json({ success: true, ...calc });
  } catch (err) {
    console.error('[Attendance] Get holidays error:', err);
    res.status(500).json({ error: 'Failed to fetch holidays', code: 'DATABASE_ERROR' });
  }
});

/**
 * POST /api/attendance/holidays
 * Add or update an institutional holiday
 */
attendanceRouter.post(
  '/holidays',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const { holidayDate, holidayName, description } = req.body;

    if (!holidayDate || !holidayName || !String(holidayDate).trim() || !String(holidayName).trim()) {
      res.status(400).json({ error: 'Holiday date and holiday name are required.', code: 'MISSING_FIELDS' });
      return;
    }

    const cleanDate = String(holidayDate).trim().split('T')[0];
    const cleanName = String(holidayName).trim();
    const cleanDesc = description ? String(description).trim() : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      res.status(400).json({ error: 'Holiday date must be in YYYY-MM-DD format.', code: 'INVALID_DATE' });
      return;
    }

    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO institutional_holidays (holiday_date, holiday_name, description, created_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE holiday_name = VALUES(holiday_name), description = VALUES(description), updated_at = NOW()`,
        [cleanDate, cleanName, cleanDesc, req.user!.id]
      );

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'INSTITUTIONAL_HOLIDAY_SAVED',
        targetType: 'HOLIDAY',
        targetId: cleanDate,
        ipAddress: req.ip || null,
        details: { holidayDate: cleanDate, holidayName: cleanName },
      });

      const [y, m] = cleanDate.split('-').map(Number);
      const calc = await calculateWorkingDaysForMonth(pool, y, m);

      res.json({ success: true, message: 'Holiday saved successfully.', ...calc });
    } catch (err) {
      console.error('[Attendance] Save holiday error:', err);
      res.status(500).json({ error: 'Failed to save holiday', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * DELETE /api/attendance/holidays/:date
 * Remove an institutional holiday
 */
attendanceRouter.delete(
  '/holidays/:date',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const cleanDate = String(req.params.date).trim().split('T')[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      res.status(400).json({ error: 'Valid holiday date in YYYY-MM-DD format is required.', code: 'INVALID_DATE' });
      return;
    }

    const pool = getPool();
    try {
      await pool.query('DELETE FROM institutional_holidays WHERE holiday_date = ?', [cleanDate]);

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'INSTITUTIONAL_HOLIDAY_REMOVED',
        targetType: 'HOLIDAY',
        targetId: cleanDate,
        ipAddress: req.ip || null,
        details: { holidayDate: cleanDate },
      });

      const [y, m] = cleanDate.split('-').map(Number);
      const calc = await calculateWorkingDaysForMonth(pool, y, m);

      res.json({ success: true, message: 'Holiday removed successfully.', ...calc });
    } catch (err) {
      console.error('[Attendance] Delete holiday error:', err);
      res.status(500).json({ error: 'Failed to remove holiday', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * GET /api/attendance/reports
 * Principal/Admin views attendance records for a specific month and year
 */
attendanceRouter.get(
  '/reports',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ error: 'Valid year and month (1-12) are required.', code: 'INVALID_PERIOD' });
      return;
    }

    const pool = getPool();
    try {
      // 1. Calculate working days for the calendar month
      const calendar = await calculateWorkingDaysForMonth(pool, year, month);
      const holidaySet = new Set(calendar.holidays.map((h) => h.date));

      // 2. Fetch active teachers
      const [teachers] = await pool.query<any[]>(
        `SELECT t.id AS teacher_id, t.full_name AS teacher_name, t.employee_code, t.designation, d.name AS department_name 
         FROM teachers t 
         LEFT JOIN departments d ON t.department_id = d.id 
         WHERE t.status = 'ACTIVE' 
         ORDER BY t.full_name ASC`
      );

      // 3. Fetch existing saved monthly records for this period
      const [existingRecords] = await pool.query<any[]>(
        'SELECT * FROM monthly_attendance WHERE year = ? AND month = ?',
        [year, month]
      );

      const recordMap = new Map<number, any>();
      for (const rec of existingRecords) {
        recordMap.set(rec.teacher_id, rec);
      }

      let needsRefinalization = false;

      // 4. Build comprehensive report entries with provisional formula
      const reports = await Promise.all(
        teachers.map(async (t) => {
          const rec = recordMap.get(t.teacher_id);
          const leaveData = await getTeacherApprovedLeaveWorkingDays(pool, t.teacher_id, year, month, holidaySet);

          const provisionalDaysPresent = Math.max(0, calendar.workingDays - leaveData.approvedLeaveDaysCount);
          const provisionalPercentage =
            calendar.workingDays > 0 ? Math.round(((provisionalDaysPresent / calendar.workingDays) * 100) * 100) / 100 : 0;

          if (rec) {
            const savedWorkingDays = Number(rec.total_working_days);
            const savedDaysPresent = Number(rec.days_present);
            const savedPercentage = Number(rec.attendance_percentage);
            const hasWorkingDaysConflict = savedWorkingDays !== calendar.workingDays;
            const hasFormulaConflict = savedDaysPresent !== provisionalDaysPresent;

            if (rec.status === 'FINALIZED' && hasWorkingDaysConflict) {
              needsRefinalization = true;
            }

            return {
              id: rec.id,
              teacher_id: t.teacher_id,
              teacher_name: t.teacher_name,
              employee_code: t.employee_code,
              designation: t.designation,
              department_name: t.department_name,
              total_working_days: savedWorkingDays,
              days_present: savedDaysPresent,
              attendance_percentage: savedPercentage,
              approved_leave_days: leaveData.approvedLeaveDaysCount,
              provisional_days_present: provisionalDaysPresent,
              provisional_percentage: provisionalPercentage,
              has_conflict: hasFormulaConflict || hasWorkingDaysConflict,
              status: rec.status,
              finalized_by: rec.finalized_by,
              finalized_at: rec.finalized_at,
            };
          } else {
            return {
              id: null,
              teacher_id: t.teacher_id,
              teacher_name: t.teacher_name,
              employee_code: t.employee_code,
              designation: t.designation,
              department_name: t.department_name,
              total_working_days: calendar.workingDays,
              days_present: provisionalDaysPresent,
              attendance_percentage: provisionalPercentage,
              approved_leave_days: leaveData.approvedLeaveDaysCount,
              provisional_days_present: provisionalDaysPresent,
              provisional_percentage: provisionalPercentage,
              has_conflict: false,
              status: 'PENDING',
              finalized_by: null,
              finalized_at: null,
            };
          }
        })
      );

      res.json({
        success: true,
        year,
        month,
        calendar,
        needsRefinalization,
        reports,
      });
    } catch (err) {
      console.error('[Attendance] Fetch reports error:', err);
      res.status(500).json({ error: 'Failed to fetch attendance reports', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * POST /api/attendance/entry
 * Principal/Admin saves manual attendance entries
 */
attendanceRouter.post(
  '/entry',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const { year, month, totalWorkingDays, entries } = req.body;

    const numYear = Number(year);
    const numMonth = Number(month);
    const numWorkingDays = Number(totalWorkingDays);

    if (!numYear || !numMonth || numMonth < 1 || numMonth > 12) {
      res.status(400).json({ error: 'Valid year and month (1-12) are required.', code: 'INVALID_PERIOD' });
      return;
    }

    if (!numWorkingDays || isNaN(numWorkingDays) || numWorkingDays <= 0) {
      res.status(400).json({ error: 'Working days must be greater than zero.', code: 'INVALID_WORKING_DAYS' });
      return;
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'At least one attendance entry is required.', code: 'MISSING_ENTRIES' });
      return;
    }

    // Validate all entries before saving
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const tid = Number(e.teacherId);
      const days = Number(e.daysPresent);

      if (!tid) {
        res.status(400).json({ error: `Entry ${i + 1}: Invalid teacher ID.`, code: 'INVALID_TEACHER_ID' });
        return;
      }

      if (isNaN(days) || days < 0 || days > numWorkingDays) {
        res.status(400).json({
          error: `Entry ${i + 1}: Days present (${days}) must be between 0 and total working days (${numWorkingDays}).`,
          code: 'INVALID_DAYS_PRESENT',
        });
        return;
      }
    }

    const pool = getPool();
    try {
      for (const e of entries) {
        const tid = Number(e.teacherId);
        const days = Number(e.daysPresent);
        const percentage = Math.round(((days / numWorkingDays) * 100) * 100) / 100;

        await pool.query(
          `INSERT INTO monthly_attendance (teacher_id, year, month, total_working_days, days_present, attendance_percentage, status)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
           ON DUPLICATE KEY UPDATE
             total_working_days = VALUES(total_working_days),
             days_present = VALUES(days_present),
             attendance_percentage = VALUES(attendance_percentage),
             updated_at = NOW()`,
          [tid, numYear, numMonth, numWorkingDays, days, percentage]
        );
      }

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'TEACHER_ATTENDANCE_SAVED',
        targetType: 'MONTHLY_ATTENDANCE',
        targetId: `${numYear}-${numMonth}`,
        ipAddress: req.ip || null,
        details: { year: numYear, month: numMonth, totalWorkingDays: numWorkingDays, entryCount: entries.length },
      });

      res.json({ success: true, updatedCount: entries.length });
    } catch (err) {
      console.error('[Attendance] Save entry error:', err);
      res.status(500).json({ error: 'Failed to save attendance entries', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * POST /api/attendance/import
 * Principal/Admin imports attendance records from CSV / template string
 */
attendanceRouter.post(
  '/import',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const { year, month, totalWorkingDays, csvText } = req.body;

    const numYear = Number(year);
    const numMonth = Number(month);
    const numWorkingDays = Number(totalWorkingDays);

    if (!numYear || !numMonth || numMonth < 1 || numMonth > 12) {
      res.status(400).json({ error: 'Valid year and month (1-12) are required.', code: 'INVALID_PERIOD' });
      return;
    }

    if (!numWorkingDays || isNaN(numWorkingDays) || numWorkingDays <= 0) {
      res.status(400).json({ error: 'Working days must be greater than zero.', code: 'INVALID_WORKING_DAYS' });
      return;
    }

    if (!csvText || typeof csvText !== 'string' || csvText.trim() === '') {
      res.status(400).json({ error: 'CSV text content is required for import.', code: 'MISSING_CSV' });
      return;
    }

    const pool = getPool();
    try {
      const [allTeachers] = await pool.query<any[]>('SELECT id, employee_code, full_name FROM teachers');
      const teacherByCodeMap = new Map<string, any>();
      for (const t of allTeachers) {
        if (t.employee_code) {
          teacherByCodeMap.set(String(t.employee_code).trim().toUpperCase(), t);
        }
        teacherByCodeMap.set(`ID:${t.id}`, t);
      }

      const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      const errors: string[] = [];
      const validEntries: Array<{ teacherId: number; daysPresent: number }> = [];

      let startIdx = 0;
      if (lines[0].toLowerCase().includes('employee') || lines[0].toLowerCase().includes('code') || lines[0].toLowerCase().includes('days')) {
        startIdx = 1; // Header row
      }

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length < 2) {
          errors.push(`Line ${i + 1}: Malformed line format (expected employee_code, days_present).`);
          continue;
        }

        const codeOrId = parts[0].toUpperCase();
        const days = Number(parts[1]);

        let teacher = teacherByCodeMap.get(codeOrId);
        if (!teacher && !isNaN(Number(codeOrId))) {
          teacher = teacherByCodeMap.get(`ID:${codeOrId}`);
        }

        if (!teacher) {
          errors.push(`Line ${i + 1}: Teacher identifier '${parts[0]}' not found in institutional records.`);
          continue;
        }

        if (isNaN(days) || days < 0 || days > numWorkingDays) {
          errors.push(`Line ${i + 1}: Days present (${parts[1]}) must be between 0 and total working days (${numWorkingDays}).`);
          continue;
        }

        validEntries.push({ teacherId: teacher.id, daysPresent: days });
      }

      if (errors.length > 0) {
        res.status(400).json({
          error: 'Spreadsheet import validation failed. Correct the errors and retry.',
          code: 'IMPORT_VALIDATION_FAILED',
          errors,
        });
        return;
      }

      for (const entry of validEntries) {
        const percentage = Math.round(((entry.daysPresent / numWorkingDays) * 100) * 100) / 100;
        await pool.query(
          `INSERT INTO monthly_attendance (teacher_id, year, month, total_working_days, days_present, attendance_percentage, status)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
           ON DUPLICATE KEY UPDATE
             total_working_days = VALUES(total_working_days),
             days_present = VALUES(days_present),
             attendance_percentage = VALUES(attendance_percentage),
             updated_at = NOW()`,
          [entry.teacherId, numYear, numMonth, numWorkingDays, entry.daysPresent, percentage]
        );
      }

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'TEACHER_ATTENDANCE_IMPORTED',
        targetType: 'MONTHLY_ATTENDANCE',
        targetId: `${numYear}-${numMonth}`,
        ipAddress: req.ip || null,
        details: { year: numYear, month: numMonth, importedCount: validEntries.length },
      });

      res.json({ success: true, count: validEntries.length });
    } catch (err) {
      console.error('[Attendance] Import error:', err);
      res.status(500).json({ error: 'Failed to import attendance data', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * POST /api/attendance/reports/finalize
 * Principal/Admin finalizes a month's attendance report and generates persistent in-app notifications
 */
attendanceRouter.post(
  '/reports/finalize',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const { year, month } = req.body;
    const numYear = Number(year);
    const numMonth = Number(month);

    if (!numYear || !numMonth || numMonth < 1 || numMonth > 12) {
      res.status(400).json({ error: 'Valid year and month (1-12) are required.', code: 'INVALID_PERIOD' });
      return;
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Calculate working days for the month
      const calendar = await calculateWorkingDaysForMonth(conn, numYear, numMonth);
      const holidaySet = new Set(calendar.holidays.map((h) => h.date));

      // 2. Fetch all active teachers
      const [teachers] = await conn.query<any[]>('SELECT id FROM teachers WHERE status = "ACTIVE"');

      const daysInMonth = new Date(numYear, numMonth, 0).getDate();
      const monthStartStr = `${numYear}-${String(numMonth).padStart(2, '0')}-01`;
      const monthEndStr = `${numYear}-${String(numMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      // 3. Fetch all absent records for active teachers in this month
      const [absentRows] = await conn.query<any[]>(
        `SELECT teacher_id, attendance_date FROM teacher_daily_attendance
         WHERE status = 'ABSENT' AND attendance_date BETWEEN ? AND ?`,
        [monthStartStr, monthEndStr]
      );
      const absentMap = new Map<number, Set<string>>();
      for (const r of absentRows) {
        const dStr = typeof r.attendance_date === 'string' ? r.attendance_date.split('T')[0] : new Date(r.attendance_date).toISOString().split('T')[0];
        if (!absentMap.has(r.teacher_id)) {
          absentMap.set(r.teacher_id, new Set());
        }
        absentMap.get(r.teacher_id)!.add(dStr);
      }

      // 4. Calculate and save monthly summaries for every active teacher
      const finalizedRecords: any[] = [];

      for (const t of teachers) {
        const leaveData = await getTeacherApprovedLeaveWorkingDays(conn, t.id, numYear, numMonth, holidaySet);
        const teacherAbsentDates = absentMap.get(t.id) || new Set();

        let daysPresent = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          const dStr = `${numYear}-${String(numMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dt = new Date(numYear, numMonth - 1, day);
          const isSunday = dt.getDay() === 0;
          const isHoliday = holidaySet.has(dStr);

          if (!isSunday && !isHoliday) {
            const isAbsent = teacherAbsentDates.has(dStr);
            const isOnLeave = leaveData.approvedLeaveDates.includes(dStr);
            if (!isAbsent && !isOnLeave) {
              daysPresent++;
            }
          }
        }

        const percentage = calendar.workingDays > 0 ? Math.round(((daysPresent / calendar.workingDays) * 100) * 100) / 100 : 0;

        await conn.query(
          `INSERT INTO monthly_attendance (teacher_id, year, month, total_working_days, days_present, attendance_percentage, status, finalized_by, finalized_at)
           VALUES (?, ?, ?, ?, ?, ?, 'FINALIZED', ?, NOW())
           ON DUPLICATE KEY UPDATE
             total_working_days = VALUES(total_working_days),
             days_present = VALUES(days_present),
             attendance_percentage = VALUES(attendance_percentage),
             status = 'FINALIZED',
             finalized_by = VALUES(finalized_by),
             finalized_at = NOW(),
             updated_at = NOW()`,
          [t.id, numYear, numMonth, calendar.workingDays, daysPresent, percentage, req.user!.id]
        );

        const [savedRec] = await conn.query<any[]>(
          'SELECT * FROM monthly_attendance WHERE teacher_id = ? AND year = ? AND month = ?',
          [t.id, numYear, numMonth]
        );
        if (savedRec.length > 0) {
          finalizedRecords.push(savedRec[0]);
        }
      }

      await conn.commit();

      const monthName = MONTH_NAMES[numMonth - 1] || `Month ${numMonth}`;
      let notificationCount = 0;

      for (const rec of finalizedRecords) {
        const [users] = await pool.query<any[]>('SELECT id FROM users WHERE teacher_id = ? AND is_deactivated = FALSE', [rec.teacher_id]);
        if (users.length > 0) {
          const userId = users[0].id;
          const notifTitle = `Monthly Attendance Report Finalized: ${monthName} ${numYear}`;
          const notifMsg = `Your attendance report for ${monthName} ${numYear} has been finalized. Days Present: ${rec.days_present} out of ${rec.total_working_days} working days. Attendance Percentage: ${rec.attendance_percentage}%.`;

          const [existingNotif] = await pool.query<any[]>(
            'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND related_id = ?',
            [userId, 'ATTENDANCE_FINALIZED', rec.id]
          );

          if (existingNotif.length === 0) {
            await pool.query(
              'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
              [userId, notifTitle, notifMsg, 'ATTENDANCE_FINALIZED', rec.id]
            );
          } else {
            await pool.query(
              'UPDATE notifications SET message = ?, is_read = FALSE, created_at = NOW() WHERE id = ?',
              [notifMsg, existingNotif[0].id]
            );
          }
          notificationCount++;
        }
      }

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'MONTHLY_ATTENDANCE_FINALIZED',
        targetType: 'MONTHLY_ATTENDANCE',
        targetId: `${numYear}-${numMonth}`,
        ipAddress: req.ip || null,
        details: { year: numYear, month: numMonth, recordCount: finalizedRecords.length, notificationsSent: notificationCount },
      });

      res.json({ success: true, count: finalizedRecords.length, notificationsSent: notificationCount });
    } catch (err) {
      await conn.rollback();
      console.error('[Attendance] Finalize report error:', err);
      res.status(500).json({ error: 'Failed to finalize attendance report', code: 'DATABASE_ERROR' });
    } finally {
      conn.release();
    }
  }
);

/**
 * POST /api/attendance/low-attendance-alert
 * Principal sends an individual low-attendance alert in-app notification to a teacher
 */
attendanceRouter.post(
  '/low-attendance-alert',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const { teacherId, year, month, threshold, customMessage } = req.body;
    const numTeacherId = Number(teacherId);
    const numYear = Number(year);
    const numMonth = Number(month);
    const targetThreshold = Number(threshold) || 75;

    if (!numTeacherId || !numYear || !numMonth) {
      res.status(400).json({ error: 'Teacher ID, year, and month are required.', code: 'MISSING_FIELDS' });
      return;
    }

    const pool = getPool();
    try {
      const [users] = await pool.query<any[]>('SELECT id FROM users WHERE teacher_id = ? AND is_deactivated = FALSE', [numTeacherId]);
      if (users.length === 0) {
        res.status(400).json({ error: 'No active user account found for this teacher.', code: 'NO_TEACHER_USER' });
        return;
      }

      const [reports] = await pool.query<any[]>(
        'SELECT * FROM monthly_attendance WHERE teacher_id = ? AND year = ? AND month = ?',
        [numTeacherId, numYear, numMonth]
      );

      if (reports.length === 0) {
        res.status(400).json({ error: 'No attendance record found for this teacher and period.', code: 'NO_REPORT_FOUND' });
        return;
      }

      const report = reports[0];
      const monthName = MONTH_NAMES[numMonth - 1] || `Month ${numMonth}`;
      const userId = users[0].id;

      const title = `Low Attendance Notice — ${monthName} ${numYear}`;
      const message = `Your attendance percentage for ${monthName} ${numYear} is ${report.attendance_percentage}% (${report.days_present}/${report.total_working_days} days), which is below the target threshold of ${targetThreshold}%. ${customMessage ? `Remarks: ${customMessage}` : ''}`;

      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
        [userId, title, message, 'LOW_ATTENDANCE_ALERT', report.id]
      );

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'LOW_ATTENDANCE_ALERT_SENT',
        targetType: 'TEACHER',
        targetId: String(numTeacherId),
        ipAddress: req.ip || null,
        details: { teacherId: numTeacherId, year: numYear, month: numMonth, percentage: report.attendance_percentage, threshold: targetThreshold },
      });

      res.json({ success: true });
    } catch (err) {
      console.error('[Attendance] Low attendance alert error:', err);
      res.status(500).json({ error: 'Failed to send low attendance alert', code: 'DATABASE_ERROR' });
    }
  }
);



/**
 * GET /api/attendance/daily?date=YYYY-MM-DD
 * Date-based attendance and leave tracker for all active teachers on a specific date
 */
attendanceRouter.get(
  '/daily',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN, ROLES.SECRETARY, ROLES.OFFICE, ROLES.STAFF),
  async (req: Request, res: Response) => {
  const targetDate = req.query.date ? String(req.query.date).trim().split('T')[0] : getKolkataDateString();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.', code: 'INVALID_DATE' });
    return;
  }

  const pool = getPool();
  try {
    // 1. Active teachers
    const [teachers] = await pool.query<any[]>(
      `SELECT t.id AS teacher_id, t.full_name AS teacher_name, t.employee_code, t.designation, d.name AS department_name 
       FROM teachers t 
       LEFT JOIN departments d ON t.department_id = d.id 
       WHERE t.status = 'ACTIVE' 
       ORDER BY t.full_name ASC`
    );

    // 2. Fetch recorded daily attendance entries for targetDate
    const [dailyRecords] = await pool.query<any[]>(
      `SELECT tda.*, u.full_name AS recorder_name 
       FROM teacher_daily_attendance tda
       LEFT JOIN users u ON tda.recorded_by = u.id
       WHERE tda.attendance_date = ?`,
      [targetDate]
    );

    const dailyMap = new Map<number, any>();
    for (const r of dailyRecords || []) {
      dailyMap.set(r.teacher_id, r);
    }

    // 3. Fetch leave applications covering targetDate
    const [leaveApps] = await pool.query<any[]>(
      `SELECT la.*, u_dec.full_name AS decider_name
       FROM leave_applications la
       LEFT JOIN users u_dec ON la.decided_by = u_dec.id
       WHERE la.start_date <= ? AND la.end_date >= ?
         AND la.status IN ('APPROVED', 'PENDING', 'REJECTED')`,
      [targetDate, targetDate]
    );

    const leaveMapByTeacher = new Map<number, any[]>();
    for (const l of leaveApps || []) {
      if (!leaveMapByTeacher.has(l.teacher_id)) {
        leaveMapByTeacher.set(l.teacher_id, []);
      }
      leaveMapByTeacher.get(l.teacher_id)!.push(l);
    }

    let presentCount = 0;
    let absentCount = 0;
    let onLeaveCount = 0;
    let pendingLeaveCount = 0;
    let unrecordedCount = 0;

    const teacherList = teachers.map((t) => {
      const daily = dailyMap.get(t.teacher_id);
      const teacherLeaves = leaveMapByTeacher.get(t.teacher_id) || [];
      const approvedLeave = teacherLeaves.find((l) => l.status === 'APPROVED');
      const pendingLeave = teacherLeaves.find((l) => l.status === 'PENDING');
      const rejectedLeave = teacherLeaves.find((l) => l.status === 'REJECTED');

      let computedStatus: 'PRESENT' | 'ABSENT' | 'ON_LEAVE' = 'PRESENT';
      let effectiveReason = daily?.recorded_reason || null;
      let recordedBy = daily?.recorder_name || null;

      if (daily && daily.status === 'ABSENT') {
        computedStatus = 'ABSENT';
      } else if (approvedLeave) {
        computedStatus = 'ON_LEAVE';
        effectiveReason = approvedLeave.reason;
        recordedBy = 'Leave System';
      }


      if (computedStatus === 'PRESENT') presentCount++;
      else if (computedStatus === 'ABSENT') absentCount++;
      else if (computedStatus === 'ON_LEAVE') onLeaveCount++;

      return {
        teacherId: t.teacher_id,
        teacherName: t.teacher_name,
        employeeCode: t.employee_code,
        designation: t.designation,
        departmentName: t.department_name,
        status: computedStatus,
        recordedReason: effectiveReason,
        recordedBy: daily?.recorder_name || null,
        recordedAt: daily?.recorded_at || null,
        approvedLeave: approvedLeave
          ? {
              id: approvedLeave.id,
              leaveCategory: approvedLeave.leave_category || 'CL',
              startDate: approvedLeave.start_date,
              endDate: approvedLeave.end_date,
              reason: approvedLeave.reason,
              decisionRemarks: approvedLeave.decision_remarks,
              decidedByName: approvedLeave.decider_name,
            }
          : null,
        pendingLeave: pendingLeave
          ? {
              id: pendingLeave.id,
              leaveCategory: pendingLeave.leave_category || 'CL',
              startDate: pendingLeave.start_date,
              endDate: pendingLeave.end_date,
              reason: pendingLeave.reason,
            }
          : null,
        rejectedLeave: rejectedLeave
          ? {
              id: rejectedLeave.id,
              leaveCategory: rejectedLeave.leave_category || 'CL',
              startDate: rejectedLeave.start_date,
              endDate: rejectedLeave.end_date,
              reason: rejectedLeave.reason,
              decisionRemarks: rejectedLeave.decision_remarks,
            }
          : null,
      };
    });

    res.json({
      success: true,
      date: targetDate,
      summary: {
        totalTeachers: teachers.length,
        presentCount,
        absentCount,
        onLeaveCount,
        pendingLeaveCount,
        unrecordedCount,
      },
      teachers: teacherList,
      trackerList: teacherList.filter(t => t.status === 'ABSENT' || t.status === 'ON_LEAVE'),
    });
  } catch (err) {
    console.error('[Attendance] Daily attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch daily attendance', code: 'DATABASE_ERROR' });
  }
});

/**
 * POST /api/attendance/daily
 * Principal/Super Admin records or corrects teacher daily attendance
 */
attendanceRouter.post(
  '/daily',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const { attendanceDate, entries } = req.body;
    const cleanDate = String(attendanceDate || '').trim().split('T')[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      res.status(400).json({ error: 'Valid attendance date in YYYY-MM-DD format is required.', code: 'INVALID_DATE' });
      return;
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'At least one teacher attendance entry is required.', code: 'MISSING_ENTRIES' });
      return;
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const e of entries) {
        const tid = Number(e.teacherId);
        const statusVal = String(e.status || 'PRESENT').trim().toUpperCase();
        const reasonVal = e.recordedReason ? String(e.recordedReason).trim() : null;
        
        if (statusVal === 'PRESENT') {
          // Make it present by deleting the absence record
          await conn.query(
            'DELETE FROM teacher_daily_attendance WHERE teacher_id = ? AND attendance_date = ?',
            [tid, cleanDate]
          );
        } else if (statusVal === 'ABSENT') {
          // Check for approved leave
          const [leave] = await conn.query<any[]>(
            'SELECT id FROM leave_applications WHERE teacher_id = ? AND status = "APPROVED" AND start_date <= ? AND end_date >= ?',
            [tid, cleanDate, cleanDate]
          );
          if (leave.length > 0) {
            await conn.rollback();
            res.status(400).json({ error: `Cannot mark teacher ID ${tid} as ABSENT: has approved leave for ${cleanDate}.`, code: 'APPROVED_LEAVE_EXISTS' });
            return;
          }

          await conn.query(
            `INSERT INTO teacher_daily_attendance (teacher_id, attendance_date, status, recorded_reason, recorded_by)
             VALUES (?, ?, 'ABSENT', ?, ?)
             ON DUPLICATE KEY UPDATE status = 'ABSENT', recorded_reason = VALUES(recorded_reason), recorded_by = VALUES(recorded_by), updated_at = NOW()`,
            [tid, cleanDate, reasonVal, req.user!.id]
          );
        } else {
            // Other statuses not allowed in new workflow
            await conn.rollback();
            res.status(400).json({ error: `Status '${statusVal}' is not supported. Only ABSENT or PRESENT allowed.`, code: 'INVALID_STATUS' });
            return;
        }
      }

      await conn.commit();

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'TEACHER_DAILY_ATTENDANCE_SAVED',
        targetType: 'DAILY_ATTENDANCE',
        targetId: cleanDate,
        ipAddress: req.ip || null,
        details: { attendanceDate: cleanDate, updatedEntriesCount: entries.length },
      });

      res.json({ success: true, message: `Successfully recorded daily attendance for ${entries.length} teacher(s).` });
    } catch (err) {
      await conn.rollback();
      console.error('[Attendance] Save daily attendance error:', err);
      res.status(500).json({ error: 'Failed to save daily attendance', code: 'DATABASE_ERROR' });
    } finally {
      conn.release();
    }
  }
);

/**
 * GET /api/attendance/teacher/my-report
 * Returns personal monthly attendance report, working days calculation,
 * and day-by-day attendance/absence log for a faculty member.
 * Faculty accounts can strictly only access their own linked teacher record.
 * Principal and Super Admin can optionally inspect any teacher's history via ?teacherId=X.
 */
attendanceRouter.get('/teacher/my-report', async (req: Request, res: Response) => {
  const isPrincipalOrAdmin = [ROLES.PRINCIPAL, ROLES.SUPER_ADMIN, ROLES.OFFICE, ROLES.STAFF].includes(req.user!.role as any);
  const targetTeacherId = isPrincipalOrAdmin && req.query.teacherId
    ? Number(req.query.teacherId)
    : req.user!.teacherId;

  if (!targetTeacherId) {
    res.status(403).json({ error: 'Access denied: No linked teacher profile.', code: 'NO_LINKED_TEACHER' });
    return;
  }

  const todayStr = getKolkataDateString();
  const [cy, cm] = todayStr.split('-').map(Number);
  const year = req.query.year ? Number(req.query.year) : cy;
  const month = req.query.month ? Number(req.query.month) : cm;

  if (!year || !month || month < 1 || month > 12) {
    res.status(400).json({ error: 'Valid year and month (1-12) are required.', code: 'INVALID_PERIOD' });
    return;
  }

  const pool = getPool();
  try {
    // 1. Fetch teacher profile
    const [teachers] = await pool.query<any[]>(
      `SELECT t.id, t.full_name, t.employee_code, t.teacher_code, t.designation, d.name AS department_name 
       FROM teachers t 
       LEFT JOIN departments d ON t.department_id = d.id 
       WHERE t.id = ?`,
      [targetTeacherId]
    );

    if (teachers.length === 0) {
      res.status(404).json({ error: 'Teacher record not found.', code: 'TEACHER_NOT_FOUND' });
      return;
    }
    const teacher = teachers[0];

    // 2. Working days and institutional holidays calculation for the month
    const calendar = await calculateWorkingDaysForMonth(pool, year, month);
    const holidayMap = new Map<string, string>();
    for (const h of calendar.holidays) {
      holidayMap.set(h.date, h.name);
    }
    const holidaySet = new Set(calendar.holidays.map((h) => h.date));

    // 3. Approved leave working days count
    const leaveData = await getTeacherApprovedLeaveWorkingDays(pool, targetTeacherId, year, month, holidaySet);

    // 4. Fetch daily attendance entries for the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const [dailyEntries] = await pool.query<any[]>(
      `SELECT tda.*, u.full_name AS recorder_name
       FROM teacher_daily_attendance tda
       LEFT JOIN users u ON tda.recorded_by = u.id
       WHERE tda.teacher_id = ? AND tda.attendance_date BETWEEN ? AND ?`,
      [targetTeacherId, monthStartStr, monthEndStr]
    );

    const dailyMap = new Map<string, any>();
    for (const d of dailyEntries || []) {
      const dStr = typeof d.attendance_date === 'string' ? d.attendance_date.split('T')[0] : new Date(d.attendance_date).toISOString().split('T')[0];
      dailyMap.set(dStr, d);
    }

    // 5. Fetch all leave applications covering the month
    const [monthLeaves] = await pool.query<any[]>(
      `SELECT la.*, u_dec.full_name AS decider_name
       FROM leave_applications la
       LEFT JOIN users u_dec ON la.decided_by = u_dec.id
       WHERE la.teacher_id = ? AND la.status IN ('APPROVED', 'PENDING', 'REJECTED')
         AND la.start_date <= ? AND la.end_date >= ?`,
      [targetTeacherId, monthEndStr, monthStartStr]
    );

    // 6. Day-by-day attendance history
    const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyHistory: any[] = [];
    let countedWorkingDaysPresent = 0;
    let countedWorkingDaysAbsent = 0;
    let countedApprovedLeaves = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dt = new Date(year, month - 1, day);
      const dayOfWeekIdx = dt.getDay();
      const weekdayName = WEEKDAY_NAMES[dayOfWeekIdx];
      const isSunday = dayOfWeekIdx === 0;
      const isHoliday = holidaySet.has(dateStr);
      const holidayName = holidayMap.get(dateStr) || null;
      const isFuture = dateStr > todayStr;

      const dailyRecord = dailyMap.get(dateStr);
      const matchingLeaves = (monthLeaves || []).filter((l: any) => {
        const sStr = typeof l.start_date === 'string' ? l.start_date.split('T')[0] : new Date(l.start_date).toISOString().split('T')[0];
        const eStr = typeof l.end_date === 'string' ? l.end_date.split('T')[0] : new Date(l.end_date).toISOString().split('T')[0];
        return dateStr >= sStr && dateStr <= eStr;
      });
      const approvedLeave = matchingLeaves.find((l: any) => l.status === 'APPROVED');
      const pendingLeave = matchingLeaves.find((l: any) => l.status === 'PENDING');

      let status = 'PRESENT';
      let remarks = dailyRecord?.recorded_reason || null;
      let leaveCategory: string | null = null;
      let deciderName: string | null = null;

      if (isFuture) {
        status = 'UPCOMING';
      } else if (isSunday) {
        status = 'SUNDAY';
      } else if (isHoliday) {
        status = 'HOLIDAY';
        remarks = holidayName;
      } else if (dailyRecord) {
        status = dailyRecord.status;
        if (status === 'ON_LEAVE' && approvedLeave) {
          leaveCategory = approvedLeave.leave_category;
          remarks = approvedLeave.reason;
          deciderName = approvedLeave.decider_name;
        }
      } else if (approvedLeave) {
        status = 'ON_LEAVE';
        leaveCategory = approvedLeave.leave_category;
        remarks = approvedLeave.reason;
        deciderName = approvedLeave.decider_name;
      } else {
        // Teacher is Present by default on past working days
        status = 'PRESENT';
      }

      if (!isSunday && !isHoliday && !isFuture) {
        if (status === 'PRESENT') {
          countedWorkingDaysPresent++;
        } else if (status === 'HALF_DAY') {
          countedWorkingDaysPresent += 0.5;
          countedWorkingDaysAbsent += 0.5;
        } else if (status === 'ON_LEAVE') {
          countedApprovedLeaves++;
        } else if (status === 'ABSENT') {
          countedWorkingDaysAbsent++;
        }
      }

      dailyHistory.push({
        date: dateStr,
        day,
        weekday: weekdayName,
        isSunday,
        isHoliday,
        holidayName,
        status,
        recordedReason: remarks,
        leaveCategory,
        leaveReason: approvedLeave?.reason || pendingLeave?.reason || null,
        pendingLeave: pendingLeave ? { id: pendingLeave.id, category: pendingLeave.leave_category, reason: pendingLeave.reason } : null,
        recorderName: dailyRecord?.recorder_name || deciderName || null,
        recordedAt: dailyRecord?.recorded_at || null,
      });
    }

    // 7. Check finalized monthly_attendance record
    const [monthlyRecs] = await pool.query<any[]>(
      'SELECT * FROM monthly_attendance WHERE teacher_id = ? AND year = ? AND month = ?',
      [targetTeacherId, year, month]
    );
    const savedRec = monthlyRecs[0] || null;

    const totalWorkingDays = savedRec ? Number(savedRec.total_working_days) : calendar.workingDays;
    const daysPresent = savedRec ? Number(savedRec.days_present) : Math.max(0, calendar.workingDays - leaveData.approvedLeaveDaysCount - countedWorkingDaysAbsent);
    const attendancePercentage = savedRec
      ? Number(savedRec.attendance_percentage)
      : totalWorkingDays > 0 ? Math.round(((daysPresent / totalWorkingDays) * 100) * 100) / 100 : 0;

    // 8. Fetch historical saved months for teacher
    const [allHistory] = await pool.query<any[]>(
      `SELECT ma.*, u_fin.full_name AS finalizer_name 
       FROM monthly_attendance ma 
       LEFT JOIN users u_fin ON ma.finalized_by = u_fin.id 
       WHERE ma.teacher_id = ? 
       ORDER BY ma.year DESC, ma.month DESC`,
      [targetTeacherId]
    );

    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        fullName: teacher.full_name,
        employeeCode: teacher.employee_code,
        teacherCode: teacher.teacher_code,
        designation: teacher.designation,
        departmentName: teacher.department_name,
      },
      year,
      month,
      monthName: MONTH_NAMES[month - 1] || `Month ${month}`,
      summary: {
        totalWorkingDays,
        daysPresent,
        daysAbsent: countedWorkingDaysAbsent,
        approvedLeaveDays: leaveData.approvedLeaveDaysCount,
        attendancePercentage,
        status: savedRec?.status || 'PROVISIONAL',
        finalizedBy: savedRec?.finalized_by || null,
        finalizedAt: savedRec?.finalized_at || null,
      },
      dailyHistory,
      historicalReports: allHistory || [],
      calendar,
    });
  } catch (err) {
    console.error('[Attendance] Teacher report error:', err);
    res.status(500).json({ error: 'Failed to fetch personal attendance report', code: 'DATABASE_ERROR' });
  }
});

/**
 * GET /api/attendance/teacher/department-summary
 * Aggregated attendance statistics by department for Principal & Admin.
 */
attendanceRouter.get(
  '/teacher/department-summary',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN, ROLES.OFFICE, ROLES.STAFF),
  async (req: Request, res: Response) => {
    const todayStr = getKolkataDateString();
    const [cy, cm] = todayStr.split('-').map(Number);
    const year = req.query.year ? Number(req.query.year) : cy;
    const month = req.query.month ? Number(req.query.month) : cm;

    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ error: 'Valid year and month (1-12) are required.', code: 'INVALID_PERIOD' });
      return;
    }

    const pool = getPool();
    try {
      const calendar = await calculateWorkingDaysForMonth(pool, year, month);
      const holidaySet = new Set(calendar.holidays.map((h) => h.date));

      const [teachers] = await pool.query<any[]>(
        `SELECT t.id AS teacher_id, t.full_name, t.department_id, COALESCE(d.name, 'Unassigned Department') AS department_name
         FROM teachers t
         LEFT JOIN departments d ON t.department_id = d.id
         WHERE t.status = 'ACTIVE'
         ORDER BY department_name ASC, t.full_name ASC`
      );

      const [existingRecords] = await pool.query<any[]>(
        'SELECT * FROM monthly_attendance WHERE year = ? AND month = ?',
        [year, month]
      );
      const recMap = new Map<number, any>();
      for (const r of existingRecords) {
        recMap.set(r.teacher_id, r);
      }

      const deptMap = new Map<string, {
        departmentName: string;
        teacherCount: number;
        totalWorkingDays: number;
        totalDaysPresent: number;
        avgAttendancePercentage: number;
        teachers: Array<{ teacherId: number; name: string; daysPresent: number; percentage: number }>;
      }>();

      for (const t of teachers) {
        const dName = t.department_name;
        if (!deptMap.has(dName)) {
          deptMap.set(dName, {
            departmentName: dName,
            teacherCount: 0,
            totalWorkingDays: calendar.workingDays,
            totalDaysPresent: 0,
            avgAttendancePercentage: 0,
            teachers: [],
          });
        }
        const dept = deptMap.get(dName)!;
        dept.teacherCount++;

        const saved = recMap.get(t.teacher_id);
        let daysPresent = calendar.workingDays;
        let percentage = 100;

        if (saved) {
          daysPresent = Number(saved.days_present);
          percentage = Number(saved.attendance_percentage);
        } else {
          const lData = await getTeacherApprovedLeaveWorkingDays(pool, t.teacher_id, year, month, holidaySet);
          daysPresent = Math.max(0, calendar.workingDays - lData.approvedLeaveDaysCount);
          percentage = calendar.workingDays > 0 ? Math.round(((daysPresent / calendar.workingDays) * 100) * 100) / 100 : 0;
        }

        dept.totalDaysPresent += daysPresent;
        dept.teachers.push({
          teacherId: t.teacher_id,
          name: t.full_name,
          daysPresent,
          percentage,
        });
      }

      const departmentSummaries = Array.from(deptMap.values()).map((d) => {
        const avgPct = d.teachers.length > 0
          ? Math.round((d.teachers.reduce((acc, curr) => acc + curr.percentage, 0) / d.teachers.length) * 100) / 100
          : 0;
        return {
          ...d,
          avgAttendancePercentage: avgPct,
        };
      });

      res.json({
        success: true,
        year,
        month,
        monthName: MONTH_NAMES[month - 1] || `Month ${month}`,
        calendar,
        departments: departmentSummaries,
      });
    } catch (err) {
      console.error('[Attendance] Department summary error:', err);
      res.status(500).json({ error: 'Failed to fetch department summary', code: 'DATABASE_ERROR' });
    }
  }
);

const OFFICE_ADMIN_ATTENDANCE_ROLES = [ROLES.STUDENT_ATTENDANCE, ROLES.PRINCIPAL, ROLES.SUPER_ADMIN];

export const NON_ACADEMIC_CLASS_TYPES = new Set(['MENTOR', 'SPORTS', 'LIB', 'LIBRARY']);

export function isNonAcademicClassType(classType?: string | null): boolean {
  if (!classType) return false;
  return NON_ACADEMIC_CLASS_TYPES.has(String(classType).trim().toUpperCase());
}

/**
 * GET /api/attendance/timetable/batches
 * Get active academic batches with curriculum scheme info for timetable setup
 */
attendanceRouter.get('/timetable/batches', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const pool = getPool();
  try {
    const [batches] = await pool.query<any[]>(
      `SELECT b.id, b.code, b.name, b.admission_academic_year, b.current_professional_year,
              cs.id AS scheme_id, cs.code AS scheme_code, cs.name AS scheme_name
       FROM academic_batches b
       LEFT JOIN curriculum_schemes cs ON b.scheme_id = cs.id
       WHERE b.is_active = TRUE
       ORDER BY b.display_order ASC`
    );
    res.json({ success: true, batches });
  } catch (err) {
    console.error('[Attendance Timetable] Get batches error:', err);
    res.status(500).json({ error: 'Failed to fetch academic batches', code: 'DATABASE_ERROR' });
  }
});

/**
 * GET /api/attendance/timetable/class-types
 * Get reusable class type abbreviations and mappings
 */
attendanceRouter.get('/timetable/class-types', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    const [classTypes] = await pool.query<any[]>(
      'SELECT * FROM attendance_class_type_mappings WHERE is_active = TRUE ORDER BY id ASC'
    );
    res.json({ success: true, classTypes });
  } catch (err) {
    console.error('[Attendance Timetable] Get class types error:', err);
    res.status(500).json({ error: 'Failed to fetch class types', code: 'DATABASE_ERROR' });
  }
});

/**
 * GET /api/attendance/timetable/subjects
 * Get applicable subjects for a batch's professional year
 */
attendanceRouter.get('/timetable/subjects', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const batchId = req.query.batchId ? Number(req.query.batchId) : null;
  const profYearQuery = req.query.professionalYear ? Number(req.query.professionalYear) : null;

  const pool = getPool();
  try {
    let profYear = profYearQuery;
    if (batchId && !profYear) {
      const [batchRows] = await pool.query<any[]>('SELECT current_professional_year FROM academic_batches WHERE id = ? LIMIT 1', [batchId]);
      if (batchRows.length > 0 && batchRows[0].current_professional_year) {
        profYear = Number(batchRows[0].current_professional_year);
      }
    }

    let query = 'SELECT id, code, name, professional_year, ia_maximum FROM subjects';
    const params: any[] = [];
    if (profYear && !isNaN(profYear)) {
      query += ' WHERE professional_year = ?';
      params.push(profYear);
    }
    query += ' ORDER BY name ASC';

    const [subjects] = await pool.query<any[]>(query, params);
    res.json({ success: true, subjects });
  } catch (err) {
    console.error('[Attendance Timetable] Get subjects error:', err);
    res.status(500).json({ error: 'Failed to fetch subjects', code: 'DATABASE_ERROR' });
  }
});

/**
 * GET /api/attendance/timetable/sub-batches
 * Get sub-batches for a specific academic batch
 */
attendanceRouter.get('/timetable/sub-batches', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const batchId = req.query.batchId ? Number(req.query.batchId) : null;
  if (!batchId) {
    res.status(400).json({ error: 'Batch ID is required.', code: 'MISSING_BATCH_ID' });
    return;
  }

  const pool = getPool();
  try {
    const [subBatches] = await pool.query<any[]>(
      'SELECT sb.*, (SELECT COUNT(*) FROM sub_batch_students sbs WHERE sbs.sub_batch_id = sb.id) AS student_count FROM sub_batches sb WHERE sb.batch_id = ? ORDER BY sb.code ASC',
      [batchId]
    );
    res.json({ success: true, subBatches });
  } catch (err) {
    console.error('[Attendance Timetable] Get sub-batches error:', err);
    res.status(500).json({ error: 'Failed to fetch sub-batches', code: 'DATABASE_ERROR' });
  }
});

/**
 * POST /api/attendance/timetable/sub-batches
 * Create or update a sub-batch for an academic batch
 */
attendanceRouter.post('/timetable/sub-batches', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const { batchId, code, name, description } = req.body;
  const numBatchId = Number(batchId);
  const cleanCode = code ? String(code).trim().toUpperCase() : '';
  const cleanName = name ? String(name).trim() : '';

  if (!numBatchId || !cleanCode || !cleanName) {
    res.status(400).json({ error: 'Batch ID, code, and name are required for sub-batch.', code: 'MISSING_FIELDS' });
    return;
  }

  const pool = getPool();
  try {
    const [result]: any = await pool.query(
      `INSERT INTO sub_batches (batch_id, code, name, description)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), updated_at = NOW()`,
      [numBatchId, cleanCode, cleanName, description ? String(description).trim() : null]
    );

    const subBatchId = result.insertId || result.id;
    await recordAuditLog({
      actorId: req.user!.id,
      action: 'SUB_BATCH_SAVED',
      targetType: 'SUB_BATCH',
      targetId: String(subBatchId || cleanCode),
      ipAddress: req.ip || null,
      details: { batchId: numBatchId, code: cleanCode, name: cleanName },
    });

    res.json({ success: true, subBatchId, message: 'Sub-batch saved successfully.' });
  } catch (err) {
    console.error('[Attendance Timetable] Save sub-batch error:', err);
    res.status(500).json({ error: 'Failed to save sub-batch', code: 'DATABASE_ERROR' });
  }
});

/**
 * GET /api/attendance/timetable/versions
 * Get timetable versions for an academic batch with slots and attendance usage status
 */
attendanceRouter.get('/timetable/versions', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const batchId = req.query.batchId ? Number(req.query.batchId) : null;
  if (!batchId) {
    res.status(400).json({ error: 'Batch ID is required.', code: 'MISSING_BATCH_ID' });
    return;
  }

  const pool = getPool();
  try {
    const [versions] = await pool.query<any[]>(
      `SELECT tv.*, u.full_name AS creator_name
       FROM attendance_timetable_versions tv
       LEFT JOIN users u ON tv.created_by = u.id
       WHERE tv.batch_id = ?
       ORDER BY tv.effective_from DESC, tv.id DESC`,
      [batchId]
    );

    const versionsWithDetails = await Promise.all(
      versions.map(async (ver) => {
        // Check if attendance has been recorded using this timetable version
        const [attCheck] = await pool.query<any[]>(
          'SELECT COUNT(*) AS cnt FROM attendance_sessions WHERE timetable_version_id = ?',
          [ver.id]
        );
        const hasAttendance = Number(attCheck?.[0]?.cnt || 0) > 0;

        // Fetch slots for this version
        const [slots] = await pool.query<any[]>(
          `SELECT s.*, sub.code AS subject_code, sub.name AS subject_name, sub.professional_year,
                  sb.code AS sub_batch_code, sb.name AS sub_batch_name
           FROM attendance_timetable_slots s
           LEFT JOIN subjects sub ON s.subject_id = sub.id
           LEFT JOIN sub_batches sb ON s.sub_batch_id = sb.id
           WHERE s.timetable_version_id = ?
           ORDER BY FIELD(s.weekday, 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'), s.start_time ASC`,
          [ver.id]
        );

        return {
          ...ver,
          hasAttendance,
          slots,
        };
      })
    );

    res.json({ success: true, versions: versionsWithDetails });
  } catch (err) {
    console.error('[Attendance Timetable] Get versions error:', err);
    res.status(500).json({ error: 'Failed to fetch timetable versions', code: 'DATABASE_ERROR' });
  }
});

/**
 * POST /api/attendance/timetable/versions
 * Create a new timetable version with an effective-from date for a batch
 */
attendanceRouter.post('/timetable/versions', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const { batchId, versionCode, title, effectiveFrom, effectiveTo } = req.body;
  const numBatchId = Number(batchId);
  const cleanCode = versionCode ? String(versionCode).trim() : '';
  const cleanTitle = title ? String(title).trim() : '';
  const cleanFrom = effectiveFrom ? String(effectiveFrom).trim().split('T')[0] : '';
  const cleanTo = effectiveTo && String(effectiveTo).trim() !== '' ? String(effectiveTo).trim().split('T')[0] : null;

  if (!numBatchId || !cleanCode || !cleanTitle || !cleanFrom) {
    res.status(400).json({ error: 'Batch ID, version code, title, and effective-from date are required.', code: 'MISSING_FIELDS' });
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanFrom) || (cleanTo && !/^\d{4}-\d{2}-\d{2}$/.test(cleanTo))) {
    res.status(400).json({ error: 'Effective dates must be in YYYY-MM-DD format.', code: 'INVALID_DATE' });
    return;
  }

  const pool = getPool();
  try {
    // Check batch exists
    const [batchRows] = await pool.query<any[]>('SELECT id FROM academic_batches WHERE id = ? LIMIT 1', [numBatchId]);
    if (batchRows.length === 0) {
      res.status(404).json({ error: 'Academic batch not found.', code: 'BATCH_NOT_FOUND' });
      return;
    }

    // Server-side validation: prevent overlapping effective periods for the same batch
    // Overlap condition: (existing.effective_from <= new.effective_to OR new.effective_to IS NULL)
    // AND (existing.effective_to >= new.effective_from OR existing.effective_to IS NULL)
    const [overlapRows] = await pool.query<any[]>(
      `SELECT id, version_code, title, effective_from, effective_to 
       FROM attendance_timetable_versions 
       WHERE batch_id = ? AND is_active = TRUE
         AND (? <= COALESCE(effective_to, '9999-12-31'))
         AND (COALESCE(effective_to, '9999-12-31') >= ?)`,
      [numBatchId, cleanFrom, cleanTo || cleanFrom]
    );

    if (overlapRows.length > 0) {
      res.status(400).json({
        error: `Effective date period overlaps with existing active timetable version '${overlapRows[0].version_code}' (${overlapRows[0].effective_from} to ${overlapRows[0].effective_to || 'ongoing'}).`,
        code: 'TIMETABLE_PERIOD_OVERLAP',
      });
      return;
    }

    // Automatically close previous active versions the day before the new effective date
    const prevDayDate = new Date(cleanFrom);
    prevDayDate.setDate(prevDayDate.getDate() - 1);
    const prevDayStr = prevDayDate.toISOString().split('T')[0];

    await pool.query(
      `UPDATE attendance_timetable_versions 
       SET effective_to = LEAST(COALESCE(effective_to, ?), ?), updated_at = NOW()
       WHERE batch_id = ? AND is_active = TRUE AND effective_from < ? AND (effective_to IS NULL OR effective_to >= ?)`,
      [prevDayStr, prevDayStr, numBatchId, cleanFrom, cleanFrom]
    );

    const [result]: any = await pool.query(
      `INSERT INTO attendance_timetable_versions (batch_id, version_code, title, effective_from, effective_to, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, TRUE, ?)`,
      [numBatchId, cleanCode, cleanTitle, cleanFrom, cleanTo, req.user!.id]
    );

    const versionId = result.insertId;
    await recordAuditLog({
      actorId: req.user!.id,
      action: 'TIMETABLE_VERSION_CREATED',
      targetType: 'TIMETABLE_VERSION',
      targetId: String(versionId),
      ipAddress: req.ip || null,
      details: { batchId: numBatchId, versionCode: cleanCode, effectiveFrom: cleanFrom },
    });

    res.json({ success: true, versionId, message: 'Timetable version created successfully.' });
  } catch (err) {
    console.error('[Attendance Timetable] Create version error:', err);
    res.status(500).json({ error: 'Failed to create timetable version', code: 'DATABASE_ERROR' });
  }
});

/**
 * POST /api/attendance/timetable/versions/:versionId/slots
 * Add or update a timetable slot in a version
 */
attendanceRouter.post('/timetable/versions/:versionId/slots', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const versionId = Number(req.params.versionId);
  const { weekday, startTime, endTime, subjectId, classType, subBatchId, weekPattern, locationOrRoom, notes } = req.body;

  const cleanClassType = classType ? String(classType).trim().toUpperCase() : 'LT';
  const requiresSubject = !isNonAcademicClassType(cleanClassType);

  if (!versionId || !weekday || !startTime || !endTime || (requiresSubject && !subjectId)) {
    res.status(400).json({
      error: requiresSubject
        ? 'Weekday, start time, end time, and subject are required.'
        : 'Weekday, start time, and end time are required.',
      code: 'MISSING_FIELDS'
    });
    return;
  }

  const cleanWeekday = String(weekday).trim().toUpperCase();
  const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  if (!validDays.includes(cleanWeekday)) {
    res.status(400).json({ error: 'Invalid weekday.', code: 'INVALID_WEEKDAY' });
    return;
  }

  const cleanPattern = weekPattern ? String(weekPattern).trim().toUpperCase() : 'EVERY_WEEK';

  const pool = getPool();
  try {
    // 1. Verify timetable version exists
    const [verRows] = await pool.query<any[]>('SELECT * FROM attendance_timetable_versions WHERE id = ? LIMIT 1', [versionId]);
    if (verRows.length === 0) {
      res.status(404).json({ error: 'Timetable version not found.', code: 'VERSION_NOT_FOUND' });
      return;
    }

    // 2. Server-side check: If attendance sessions exist for this version, reject changes
    const [attCheck] = await pool.query<any[]>(
      'SELECT COUNT(*) AS cnt FROM attendance_sessions WHERE timetable_version_id = ?',
      [versionId]
    );
    if (Number(attCheck?.[0]?.cnt || 0) > 0) {
      res.status(400).json({
        error: 'This timetable version has already been used for recording attendance and is locked. Create a new version for subsequent changes.',
        code: 'TIMETABLE_VERSION_LOCKED_BY_ATTENDANCE',
      });
      return;
    }

    const [result]: any = await pool.query(
      `INSERT INTO attendance_timetable_slots (timetable_version_id, weekday, start_time, end_time, subject_id, class_type, sub_batch_id, week_pattern, location_or_room, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        versionId,
        cleanWeekday,
        String(startTime).trim(),
        String(endTime).trim(),
        requiresSubject && subjectId ? Number(subjectId) : null,
        cleanClassType,
        subBatchId ? Number(subBatchId) : null,
        ['EVERY_WEEK', 'ODD_WEEKS', 'EVEN_WEEKS'].includes(cleanPattern) ? cleanPattern : 'EVERY_WEEK',
        locationOrRoom ? String(locationOrRoom).trim() : null,
        notes ? String(notes).trim() : null,
      ]
    );

    const slotId = result.insertId;
    await recordAuditLog({
      actorId: req.user!.id,
      action: 'TIMETABLE_SLOT_ADDED',
      targetType: 'TIMETABLE_SLOT',
      targetId: String(slotId),
      ipAddress: req.ip || null,
      details: { versionId, weekday: cleanWeekday, subjectId: requiresSubject && subjectId ? Number(subjectId) : null, classType: cleanClassType },
    });

    res.json({ success: true, slotId, message: 'Timetable slot added successfully.' });
  } catch (err) {
    console.error('[Attendance Timetable] Add slot error:', err);
    res.status(500).json({ error: 'Failed to add timetable slot', code: 'DATABASE_ERROR' });
  }
});

/**
 * DELETE /api/attendance/timetable/slots/:slotId
 * Remove a timetable slot
 */
attendanceRouter.delete('/timetable/slots/:slotId', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const slotId = Number(req.params.slotId);
  if (!slotId) {
    res.status(400).json({ error: 'Slot ID is required.', code: 'MISSING_SLOT_ID' });
    return;
  }

  const pool = getPool();
  try {
    const [slotRows] = await pool.query<any[]>(
      'SELECT s.*, tv.id AS version_id FROM attendance_timetable_slots s JOIN attendance_timetable_versions tv ON s.timetable_version_id = tv.id WHERE s.id = ? LIMIT 1',
      [slotId]
    );
    if (slotRows.length === 0) {
      res.status(404).json({ error: 'Timetable slot not found.', code: 'SLOT_NOT_FOUND' });
      return;
    }

    const versionId = slotRows[0].version_id;

    // Check attendance lock
    const [attCheck] = await pool.query<any[]>(
      'SELECT COUNT(*) AS cnt FROM attendance_sessions WHERE timetable_version_id = ?',
      [versionId]
    );
    if (Number(attCheck?.[0]?.cnt || 0) > 0) {
      res.status(400).json({
        error: 'Timetable version is locked due to existing attendance records. Cannot modify slots.',
        code: 'TIMETABLE_VERSION_LOCKED_BY_ATTENDANCE',
      });
      return;
    }

    await pool.query('DELETE FROM attendance_timetable_slots WHERE id = ?', [slotId]);

    await recordAuditLog({
      actorId: req.user!.id,
      action: 'TIMETABLE_SLOT_REMOVED',
      targetType: 'TIMETABLE_SLOT',
      targetId: String(slotId),
      ipAddress: req.ip || null,
      details: { slotId, versionId },
    });

    res.json({ success: true, message: 'Timetable slot removed successfully.' });
  } catch (err) {
    console.error('[Attendance Timetable] Remove slot error:', err);
    res.status(500).json({ error: 'Failed to remove timetable slot', code: 'DATABASE_ERROR' });
  }
});

/**
 * DELETE /api/attendance/timetable/versions/:versionId
 * Remove an unused timetable version
 */
attendanceRouter.delete('/timetable/versions/:versionId', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const versionId = Number(req.params.versionId);
  if (!versionId) {
    res.status(400).json({ error: 'Version ID is required.', code: 'MISSING_VERSION_ID' });
    return;
  }

  const pool = getPool();
  try {
    const [attCheck] = await pool.query<any[]>(
      'SELECT COUNT(*) AS cnt FROM attendance_sessions WHERE timetable_version_id = ?',
      [versionId]
    );
    if (Number(attCheck?.[0]?.cnt || 0) > 0) {
      res.status(400).json({
        error: 'Timetable version has been used for attendance and cannot be deleted.',
        code: 'TIMETABLE_VERSION_LOCKED_BY_ATTENDANCE',
      });
      return;
    }

    await pool.query('DELETE FROM attendance_timetable_versions WHERE id = ?', [versionId]);

    await recordAuditLog({
      actorId: req.user!.id,
      action: 'TIMETABLE_VERSION_DELETED',
      targetType: 'TIMETABLE_VERSION',
      targetId: String(versionId),
      ipAddress: req.ip || null,
      details: { versionId },
    });

    res.json({ success: true, message: 'Timetable version deleted successfully.' });
  } catch (err) {
    console.error('[Attendance Timetable] Delete version error:', err);
    res.status(500).json({ error: 'Failed to delete timetable version', code: 'DATABASE_ERROR' });
  }
});

/**
 * GET /api/attendance/student/eligible-students
 * Get eligible students for a batch and optional sub-batch
 */
attendanceRouter.get('/student/eligible-students', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const batchId = req.query.batchId ? Number(req.query.batchId) : null;
  const subBatchId = req.query.subBatchId ? Number(req.query.subBatchId) : null;

  if (!batchId) {
    res.status(400).json({ error: 'Batch ID is required.', code: 'MISSING_BATCH_ID' });
    return;
  }

  const pool = getPool();
  try {
    let query = `
      SELECT DISTINCT s.id, s.student_id_number, s.temporary_roll_number, s.permanent_university_number, s.full_name
      FROM students s
    `;
    const params: any[] = [];

    if (subBatchId) {
      query += ` JOIN sub_batch_students sbs ON s.id = sbs.student_id WHERE sbs.sub_batch_id = ? AND s.status = 'ACTIVE'`;
      params.push(subBatchId);
    } else {
      query += ` WHERE (s.current_placement_batch_id = ? OR s.original_batch_id = ?) AND s.status = 'ACTIVE'`;
      params.push(batchId, batchId);
    }

    query += ` ORDER BY COALESCE(s.temporary_roll_number, s.student_id_number) ASC`;

    const [students] = await pool.query<any[]>(query, params);
    res.json({ success: true, students });
  } catch (err) {
    console.error('[Student Attendance] Eligible students error:', err);
    res.status(500).json({ error: 'Failed to fetch eligible students', code: 'DATABASE_ERROR' });
  }
});

/**
 * GET /api/attendance/student/schedule
 * Get applicable timetable slots and attendance status for a batch on a specific date
 */
attendanceRouter.get('/student/schedule', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const batchId = req.query.batchId ? Number(req.query.batchId) : null;
  const targetDate = req.query.date ? String(req.query.date).trim().split('T')[0] : getKolkataDateString();

  if (!batchId || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    res.status(400).json({ error: 'Valid batch ID and date (YYYY-MM-DD) are required.', code: 'INVALID_PARAMS' });
    return;
  }

  const pool = getPool();
  try {
    // 1. Check if targetDate is an institutional holiday
    const [holidayRows] = await pool.query<any[]>(
      'SELECT holiday_name, description FROM institutional_holidays WHERE holiday_date = ? LIMIT 1',
      [targetDate]
    );
    const isHoliday = holidayRows.length > 0;
    const holidayName = isHoliday ? holidayRows[0].holiday_name : null;

    // 2. Find timetable version effective on targetDate
    const [versionRows] = await pool.query<any[]>(
      `SELECT * FROM attendance_timetable_versions
       WHERE batch_id = ? AND is_active = TRUE
         AND effective_from <= ?
         AND (effective_to IS NULL OR effective_to >= ?)
       ORDER BY effective_from DESC LIMIT 1`,
      [batchId, targetDate, targetDate]
    );

    if (versionRows.length === 0) {
      res.json({
        success: true,
        isHoliday,
        holidayName,
        version: null,
        slots: [],
        message: 'No active timetable version found effective on this date.',
      });
      return;
    }

    const version = versionRows[0];

    // 3. Determine weekday from targetDate
    const [y, m, d] = targetDate.split('-').map(Number);
    const targetDt = new Date(y, m - 1, d);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const weekday = dayNames[targetDt.getDay()];

    // 4. Calculate week pattern (ODD_WEEKS / EVEN_WEEKS / EVERY_WEEK) relative to effective_from
    const fromDt = new Date(version.effective_from);
    const diffTime = Math.abs(targetDt.getTime() - fromDt.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(diffDays / 7) + 1;
    const isOddWeek = weekNumber % 2 !== 0;

    // 5. Fetch slots for this version and weekday
    const [slots] = await pool.query<any[]>(
      `SELECT s.*, sub.code AS subject_code, sub.name AS subject_name, sub.professional_year,
              sb.code AS sub_batch_code, sb.name AS sub_batch_name
       FROM attendance_timetable_slots s
       LEFT JOIN subjects sub ON s.subject_id = sub.id
       LEFT JOIN sub_batches sb ON s.sub_batch_id = sb.id
       WHERE s.timetable_version_id = ? AND s.weekday = ?
       ORDER BY s.start_time ASC`,
      [version.id, weekday]
    );

    // Filter by week pattern
    const applicableSlots = slots.filter((slot) => {
      if (slot.week_pattern === 'EVERY_WEEK') return true;
      if (slot.week_pattern === 'ODD_WEEKS' && isOddWeek) return true;
      if (slot.week_pattern === 'EVEN_WEEKS' && !isOddWeek) return true;
      return false;
    });

    // 6. Check existing attendance sessions & absences for these slots on targetDate
    const slotsWithAttendance = await Promise.all(
      applicableSlots.map(async (slot) => {
        const [sessionRows] = await pool.query<any[]>(
          `SELECT id, created_at, updated_at FROM attendance_sessions
           WHERE timetable_version_id = ? AND slot_id = ? AND attendance_date = ? AND (sub_batch_id <=> ?)
           LIMIT 1`,
          [version.id, slot.id, targetDate, slot.sub_batch_id]
        );

        let session = null;
        let absentStudentIds: number[] = [];

        if (sessionRows.length > 0) {
          session = sessionRows[0];
          const [absenceRows] = await pool.query<any[]>(
            'SELECT student_id FROM attendance_absences WHERE session_id = ?',
            [session.id]
          );
          absentStudentIds = absenceRows.map((r) => r.student_id);
        }

        return {
          ...slot,
          attendanceSession: session
            ? {
                id: session.id,
                recordedAt: session.updated_at || session.created_at,
                absentStudentIds,
                absentCount: absentStudentIds.length,
              }
            : null,
        };
      })
    );

    res.json({
      success: true,
      isHoliday,
      holidayName,
      version: {
        id: version.id,
        versionCode: version.version_code,
        title: version.title,
        effectiveFrom: version.effective_from,
      },
      slots: slotsWithAttendance,
    });
  } catch (err) {
    console.error('[Student Attendance] Get schedule error:', err);
    res.status(500).json({ error: 'Failed to fetch student attendance schedule', code: 'DATABASE_ERROR' });
  }
});

/**
 * POST /api/attendance/student/session
 * Save or update student attendance absences for a scheduled class session on a date
 */
attendanceRouter.post('/student/session', requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES), async (req: Request, res: Response) => {
  const { batchId, slotId, date, subBatchId, absentStudentIds, confirmHoliday } = req.body;
  const numBatchId = Number(batchId);
  const numSlotId = Number(slotId);
  const cleanDate = date ? String(date).trim().split('T')[0] : '';
  const numSubBatchId = subBatchId !== undefined && subBatchId !== null && subBatchId !== '' ? Number(subBatchId) : null;
  const absIds = Array.isArray(absentStudentIds) ? absentStudentIds.map(Number).filter((n) => !isNaN(n)) : [];

  if (!numBatchId || !numSlotId || !cleanDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    res.status(400).json({ error: 'Valid batch ID, slot ID, and date (YYYY-MM-DD) are required.', code: 'MISSING_FIELDS' });
    return;
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Check if date is a holiday
    const [holidayRows] = await conn.query<any[]>(
      'SELECT holiday_name FROM institutional_holidays WHERE holiday_date = ? LIMIT 1',
      [cleanDate]
    );
    if (holidayRows.length > 0 && !confirmHoliday) {
      await conn.rollback();
      res.status(400).json({
        error: `Selected date is an institutional holiday (${holidayRows[0].holiday_name}). Confirm holiday override to record attendance.`,
        code: 'HOLIDAY_CONFIRMATION_REQUIRED',
        isHoliday: true,
        holidayName: holidayRows[0].holiday_name,
      });
      return;
    }

    // 2. Verify slot and timetable version
    const [slotRows] = await conn.query<any[]>(
      `SELECT s.*, tv.batch_id, tv.id AS version_id 
       FROM attendance_timetable_slots s
       JOIN attendance_timetable_versions tv ON s.timetable_version_id = tv.id
       WHERE s.id = ? AND tv.batch_id = ? LIMIT 1`,
      [numSlotId, numBatchId]
    );

    if (slotRows.length === 0) {
      await conn.rollback();
      res.status(404).json({ error: 'Timetable slot or batch not found.', code: 'SLOT_NOT_FOUND' });
      return;
    }

    const slot = slotRows[0];
    const versionId = slot.version_id;

    // 3. Upsert attendance session
    // UNIQUE KEY uq_slot_date_subbatch (slot_id, attendance_date, sub_batch_id)
    const [existingSessions] = await conn.query<any[]>(
      `SELECT id FROM attendance_sessions
       WHERE slot_id = ? AND attendance_date = ? AND (sub_batch_id <=> ?)
       LIMIT 1`,
      [numSlotId, cleanDate, numSubBatchId]
    );

    let sessionId: number;

    if (existingSessions.length > 0) {
      sessionId = existingSessions[0].id;
      await conn.query(
        'UPDATE attendance_sessions SET updated_by = ? WHERE id = ?',
        [req.user!.id, sessionId]
      );
    } else {
      const [insertRes]: any = await conn.query(
        `INSERT INTO attendance_sessions (timetable_version_id, slot_id, batch_id, sub_batch_id, attendance_date, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [versionId, numSlotId, numBatchId, numSubBatchId, cleanDate, req.user!.id, req.user!.id]
      );
      sessionId = insertRes.insertId;
    }

    // 4. Replace absences list transactionally
    await conn.query('DELETE FROM attendance_absences WHERE session_id = ?', [sessionId]);

    if (absIds.length > 0) {
      // Validate all absent student IDs belong to batch/sub-batch
      for (const studentId of absIds) {
        let checkQuery = `SELECT id FROM students WHERE id = ? AND (current_placement_batch_id = ? OR original_batch_id = ?)`;
        const checkParams: any[] = [studentId, numBatchId, numBatchId];

        if (numSubBatchId) {
          checkQuery = `SELECT s.id FROM students s JOIN sub_batch_students sbs ON s.id = sbs.student_id WHERE s.id = ? AND sbs.sub_batch_id = ?`;
          checkParams.length = 0;
          checkParams.push(studentId, numSubBatchId);
        }

        const [validStudent] = await conn.query<any[]>(checkQuery, checkParams);
        if (validStudent.length === 0) {
          await conn.rollback();
          res.status(400).json({
            error: `Student ID ${studentId} is not eligible for this batch/sub-batch.`,
            code: 'INVALID_STUDENT_ELIGIBILITY',
          });
          return;
        }

        await conn.query(
          'INSERT INTO attendance_absences (session_id, student_id) VALUES (?, ?)',
          [sessionId, studentId]
        );
      }
    }

    await conn.commit();

    await recordAuditLog({
      actorId: req.user!.id,
      action: 'STUDENT_ATTENDANCE_SAVED',
      targetType: 'ATTENDANCE_SESSION',
      targetId: String(sessionId),
      ipAddress: req.ip || null,
      details: { slotId: numSlotId, date: cleanDate, absentCount: absIds.length },
    });

    res.json({ success: true, sessionId, absentCount: absIds.length, message: 'Student attendance saved successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error('[Student Attendance] Save session error:', err);
    res.status(500).json({ error: 'Failed to save student attendance', code: 'DATABASE_ERROR' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/attendance/reports/student/register
 * Date-wise scheduled class attendance register within a batch and date range
 */
attendanceRouter.get(
  '/reports/student/register',
  requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES),
  async (req: Request, res: Response) => {
    const batchId = req.query.batchId ? Number(req.query.batchId) : null;
    const fromDate = req.query.fromDate ? String(req.query.fromDate).trim().split('T')[0] : '';
    const toDate = req.query.toDate ? String(req.query.toDate).trim().split('T')[0] : '';
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const classType = req.query.classType ? String(req.query.classType).trim().toUpperCase() : null;
    const subBatchId =
      req.query.subBatchId !== undefined && req.query.subBatchId !== null && req.query.subBatchId !== ''
        ? Number(req.query.subBatchId)
        : null;

    if (!batchId || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      res.status(400).json({ error: 'Valid batch ID and date range (YYYY-MM-DD) are required.', code: 'INVALID_PARAMS' });
      return;
    }

    if (fromDate > toDate) {
      res.status(400).json({ error: 'fromDate cannot be after toDate.', code: 'INVALID_DATE_RANGE' });
      return;
    }

    const startDt = new Date(fromDate);
    const endDt = new Date(toDate);
    const diffDays = Math.floor((endDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 93) {
      res.status(400).json({
        error: 'Date range cannot exceed 93 days (3 months). Please select a narrower period.',
        code: 'DATE_RANGE_TOO_LARGE',
      });
      return;
    }

    const pool = getPool();
    try {
      // 1. Fetch batch details
      const [batchRows] = await pool.query<any[]>(
        `SELECT b.id, b.code, b.name, b.admission_academic_year, b.current_professional_year,
                cs.id AS scheme_id, cs.code AS scheme_code, cs.name AS scheme_name
         FROM academic_batches b
         LEFT JOIN curriculum_schemes cs ON b.scheme_id = cs.id
         WHERE b.id = ? LIMIT 1`,
        [batchId]
      );
      if (batchRows.length === 0) {
        res.status(404).json({ error: 'Batch not found.', code: 'BATCH_NOT_FOUND' });
        return;
      }
      const batch = batchRows[0];

      // 2. Count active eligible students in the entire batch
      const [batchCountRows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS cnt FROM students
         WHERE (current_placement_batch_id = ? OR original_batch_id = ?) AND status = 'ACTIVE'`,
        [batchId, batchId]
      );
      const batchEligibleCount = Number(batchCountRows?.[0]?.cnt || 0);

      // 3. Count active students for each sub-batch
      const [subBatchCountRows] = await pool.query<any[]>(
        `SELECT sbs.sub_batch_id, COUNT(*) AS cnt
         FROM sub_batch_students sbs
         JOIN students s ON sbs.student_id = s.id
         WHERE s.status = 'ACTIVE'
         GROUP BY sbs.sub_batch_id`
      );
      const subBatchCountMap = new Map<number, number>();
      for (const r of subBatchCountRows || []) {
        subBatchCountMap.set(Number(r.sub_batch_id), Number(r.cnt));
      }

      // 4. Fetch all active timetable versions for this batch
      const [versions] = await pool.query<any[]>(
        `SELECT * FROM attendance_timetable_versions
         WHERE batch_id = ? AND is_active = TRUE
         ORDER BY effective_from ASC`,
        [batchId]
      );

      // 5. Fetch all timetable slots for these versions
      let allSlots: any[] = [];
      if (versions.length > 0) {
        const versionIds = versions.map((v) => v.id);
        const [slotRows] = await pool.query<any[]>(
          `SELECT s.*, sub.code AS subject_code, sub.name AS subject_name, sub.professional_year,
                  sb.code AS sub_batch_code, sb.name AS sub_batch_name
           FROM attendance_timetable_slots s
           JOIN subjects sub ON s.subject_id = sub.id
           LEFT JOIN sub_batches sb ON s.sub_batch_id = sb.id
           WHERE s.timetable_version_id IN (${versionIds.map(() => '?').join(',')})
           ORDER BY s.start_time ASC`,
          versionIds
        );
        allSlots = slotRows || [];
      }

      // 6. Fetch all recorded attendance sessions in date range
      const [sessionRows] = await pool.query<any[]>(
        `SELECT ats.*, u.full_name AS recorder_name
         FROM attendance_sessions ats
         LEFT JOIN users u ON ats.created_by = u.id
         WHERE ats.batch_id = ? AND ats.attendance_date BETWEEN ? AND ?`,
        [batchId, fromDate, toDate]
      );

      // Map sessions by key: `${slot_id}_${date}_${sub_batch_id ?? 'null'}`
      const sessionMap = new Map<string, any>();
      const sessionIds: number[] = [];
      for (const s of sessionRows || []) {
        const dStr =
          typeof s.attendance_date === 'string'
            ? s.attendance_date.split('T')[0]
            : new Date(s.attendance_date).toISOString().split('T')[0];
        const key = `${s.slot_id}_${dStr}_${s.sub_batch_id ?? 'null'}`;
        sessionMap.set(key, { ...s, attendance_date: dStr });
        sessionIds.push(s.id);
      }

      // Fetch absences for recorded sessions
      const absencesBySessionId = new Map<number, any[]>();
      if (sessionIds.length > 0) {
        const [absenceRows] = await pool.query<any[]>(
          `SELECT aa.session_id, aa.student_id,
                  COALESCE(s.temporary_roll_number, s.student_id_number) AS roll_number,
                  s.student_id_number, s.permanent_university_number, s.full_name AS student_name
           FROM attendance_absences aa
           JOIN students s ON aa.student_id = s.id
           WHERE aa.session_id IN (${sessionIds.map(() => '?').join(',')})
           ORDER BY COALESCE(s.temporary_roll_number, s.student_id_number) ASC`,
          sessionIds
        );
        for (const a of absenceRows || []) {
          if (!absencesBySessionId.has(a.session_id)) {
            absencesBySessionId.set(a.session_id, []);
          }
          absencesBySessionId.get(a.session_id)!.push({
            studentId: a.student_id,
            rollNumber: a.roll_number,
            studentIdNumber: a.student_id_number,
            permanentUniversityNumber: a.permanent_university_number || null,
            studentName: a.student_name,
          });
        }
      }

      // 7. Iterate through each calendar day in [fromDate, toDate]
      const items: any[] = [];
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

      const curr = new Date(startDt);
      while (curr <= endDt) {
        const cy = curr.getFullYear();
        const cm = curr.getMonth() + 1;
        const cd = curr.getDate();
        const dStr = `${cy}-${String(cm).padStart(2, '0')}-${String(cd).padStart(2, '0')}`;
        const weekday = dayNames[curr.getDay()];

        // Find applicable timetable version on this historical date
        const applicableVer = versions.find((v) => {
          const vFrom =
            typeof v.effective_from === 'string'
              ? v.effective_from.split('T')[0]
              : new Date(v.effective_from).toISOString().split('T')[0];
          const vTo = v.effective_to
            ? typeof v.effective_to === 'string'
              ? v.effective_to.split('T')[0]
              : new Date(v.effective_to).toISOString().split('T')[0]
            : null;
          return vFrom <= dStr && (!vTo || vTo >= dStr);
        });

        if (applicableVer) {
          const vFromDt = new Date(applicableVer.effective_from);
          const diffMs = Math.abs(curr.getTime() - vFromDt.getTime());
          const diffD = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const weekNumber = Math.floor(diffD / 7) + 1;
          const isOddWeek = weekNumber % 2 !== 0;

          // Find scheduled slots for this version and weekday
          const daySlots = allSlots.filter((slot) => {
            if (slot.timetable_version_id !== applicableVer.id) return false;
            if (slot.weekday !== weekday) return false;
            if (slot.week_pattern === 'ODD_WEEKS' && !isOddWeek) return false;
            if (slot.week_pattern === 'EVEN_WEEKS' && isOddWeek) return false;

            // Optional filters
            if (subjectId && slot.subject_id !== subjectId) return false;
            if (classType && slot.class_type !== classType) return false;
            if (subBatchId !== null && slot.sub_batch_id !== subBatchId) return false;

            return true;
          });

          for (const slot of daySlots) {
            const sessionKey = `${slot.id}_${dStr}_${slot.sub_batch_id ?? 'null'}`;
            const session = sessionMap.get(sessionKey);

            const eligibleCount = slot.sub_batch_id
              ? subBatchCountMap.get(slot.sub_batch_id) || 0
              : batchEligibleCount;

            if (session) {
              const absList = absencesBySessionId.get(session.id) || [];
              const absentCount = absList.length;
              const presentCount = Math.max(0, eligibleCount - absentCount);

              items.push({
                date: dStr,
                weekday,
                slotId: slot.id,
                timetableVersionId: applicableVer.id,
                versionCode: applicableVer.version_code,
                subjectId: slot.subject_id,
                subjectCode: slot.subject_code,
                subjectName: slot.subject_name,
                startTime: slot.start_time,
                endTime: slot.end_time,
                classType: slot.class_type,
                subBatchId: slot.sub_batch_id,
                subBatchCode: slot.sub_batch_code || null,
                subBatchName: slot.sub_batch_name || null,
                locationOrRoom: slot.location_or_room || null,
                eligibleCount,
                presentCount,
                absentCount,
                status: 'RECORDED',
                sessionId: session.id,
                recordedAt: session.updated_at || session.created_at,
                recorderName: session.recorder_name || null,
                absentStudents: absList,
              });
            } else {
              items.push({
                date: dStr,
                weekday,
                slotId: slot.id,
                timetableVersionId: applicableVer.id,
                versionCode: applicableVer.version_code,
                subjectId: slot.subject_id,
                subjectCode: slot.subject_code,
                subjectName: slot.subject_name,
                startTime: slot.start_time,
                endTime: slot.end_time,
                classType: slot.class_type,
                subBatchId: slot.sub_batch_id,
                subBatchCode: slot.sub_batch_code || null,
                subBatchName: slot.sub_batch_name || null,
                locationOrRoom: slot.location_or_room || null,
                eligibleCount,
                presentCount: null,
                absentCount: null,
                status: 'NOT_RECORDED',
                sessionId: null,
                recordedAt: null,
                recorderName: null,
                absentStudents: [],
              });
            }
          }
        }

        curr.setDate(curr.getDate() + 1);
      }

      res.json({
        success: true,
        batch: {
          id: batch.id,
          code: batch.code,
          name: batch.name,
          currentProfessionalYear: batch.current_professional_year,
          schemeName: batch.scheme_name,
        },
        fromDate,
        toDate,
        totalClasses: items.length,
        recordedClasses: items.filter((i) => i.status === 'RECORDED').length,
        unrecordedClasses: items.filter((i) => i.status === 'NOT_RECORDED').length,
        items,
      });
    } catch (err) {
      console.error('[Attendance Reports] Register error:', err);
      res.status(500).json({ error: 'Failed to generate date-wise attendance register', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * GET /api/attendance/reports/student/absences
 * Log of all absent student occurrences within a batch and date range
 */
attendanceRouter.get(
  '/reports/student/absences',
  requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES),
  async (req: Request, res: Response) => {
    const batchId = req.query.batchId ? Number(req.query.batchId) : null;
    const fromDate = req.query.fromDate ? String(req.query.fromDate).trim().split('T')[0] : '';
    const toDate = req.query.toDate ? String(req.query.toDate).trim().split('T')[0] : '';
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const classType = req.query.classType ? String(req.query.classType).trim().toUpperCase() : null;
    const subBatchId =
      req.query.subBatchId !== undefined && req.query.subBatchId !== null && req.query.subBatchId !== ''
        ? Number(req.query.subBatchId)
        : null;

    if (!batchId || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      res.status(400).json({ error: 'Valid batch ID and date range (YYYY-MM-DD) are required.', code: 'INVALID_PARAMS' });
      return;
    }

    if (fromDate > toDate) {
      res.status(400).json({ error: 'fromDate cannot be after toDate.', code: 'INVALID_DATE_RANGE' });
      return;
    }

    const pool = getPool();
    try {
      let query = `
        SELECT 
          aa.id AS absence_id,
          aa.session_id,
          s.id AS student_id,
          COALESCE(s.temporary_roll_number, s.student_id_number) AS roll_number,
          s.student_id_number,
          s.permanent_university_number,
          s.full_name AS student_name,
          ats.attendance_date,
          slot.weekday,
          slot.start_time,
          slot.end_time,
          slot.class_type,
          sub.id AS subject_id,
          sub.name AS subject_name,
          sub.code AS subject_code,
          sb.id AS sub_batch_id,
          sb.code AS sub_batch_code,
          sb.name AS sub_batch_name
        FROM attendance_absences aa
        JOIN attendance_sessions ats ON aa.session_id = ats.id
        JOIN attendance_timetable_slots slot ON ats.slot_id = slot.id
        LEFT JOIN subjects sub ON slot.subject_id = sub.id
        LEFT JOIN sub_batches sb ON ats.sub_batch_id = sb.id
        JOIN students s ON aa.student_id = s.id
        WHERE ats.batch_id = ?
          AND ats.attendance_date BETWEEN ? AND ?
          AND slot.class_type NOT IN ('MENTOR', 'SPORTS', 'LIB', 'LIBRARY')
      `;
      const params: any[] = [batchId, fromDate, toDate];

      if (subjectId) {
        query += ' AND slot.subject_id = ?';
        params.push(subjectId);
      }
      if (classType) {
        query += ' AND slot.class_type = ?';
        params.push(classType);
      }
      if (subBatchId !== null) {
        query += ' AND ats.sub_batch_id = ?';
        params.push(subBatchId);
      }

      query += ' ORDER BY ats.attendance_date ASC, slot.start_time ASC, roll_number ASC';

      const [rows] = await pool.query<any[]>(query, params);

      const formattedAbsences = (rows || []).map((r) => ({
        absenceId: r.absence_id,
        sessionId: r.session_id,
        studentId: r.student_id,
        rollNumber: r.roll_number,
        studentIdNumber: r.student_id_number,
        permanentUniversityNumber: r.permanent_university_number || null,
        studentName: r.student_name,
        date:
          typeof r.attendance_date === 'string'
            ? r.attendance_date.split('T')[0]
            : new Date(r.attendance_date).toISOString().split('T')[0],
        weekday: r.weekday,
        startTime: r.start_time,
        endTime: r.end_time,
        classType: r.class_type,
        subjectId: r.subject_id,
        subjectCode: r.subject_code,
        subjectName: r.subject_name,
        subBatchId: r.sub_batch_id || null,
        subBatchCode: r.sub_batch_code || null,
        subBatchName: r.sub_batch_name || null,
      }));

      res.json({
        success: true,
        fromDate,
        toDate,
        totalAbsences: formattedAbsences.length,
        absences: formattedAbsences,
      });
    } catch (err) {
      console.error('[Attendance Reports] Absences report error:', err);
      res.status(500).json({ error: 'Failed to generate absent student report', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * GET /api/attendance/reports/student/history
 * Chronological student-wise recorded attendance history with presence/absence evaluation
 */
attendanceRouter.get(
  '/reports/student/history',
  requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES),
  async (req: Request, res: Response) => {
    const studentId = req.query.studentId ? Number(req.query.studentId) : null;
    const requestedBatchId = req.query.batchId ? Number(req.query.batchId) : null;
    const fromDate = req.query.fromDate ? String(req.query.fromDate).trim().split('T')[0] : null;
    const toDate = req.query.toDate ? String(req.query.toDate).trim().split('T')[0] : null;
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;

    if (!studentId || isNaN(studentId)) {
      res.status(400).json({ error: 'Valid student ID is required.', code: 'INVALID_STUDENT_ID' });
      return;
    }

    if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      res.status(400).json({ error: 'fromDate must be in YYYY-MM-DD format.', code: 'INVALID_DATE' });
      return;
    }

    if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      res.status(400).json({ error: 'toDate must be in YYYY-MM-DD format.', code: 'INVALID_DATE' });
      return;
    }

    if (fromDate && toDate && fromDate > toDate) {
      res.status(400).json({ error: 'fromDate cannot be after toDate.', code: 'INVALID_DATE_RANGE' });
      return;
    }

    const pool = getPool();
    try {
      // 1. Fetch Student Details
      const [studentRows] = await pool.query<any[]>(
        `SELECT s.id, s.student_id_number, s.temporary_roll_number, s.permanent_university_number,
                s.full_name, s.current_placement_batch_id, s.original_batch_id, s.status,
                b.id AS batch_id, b.code AS batch_code, b.name AS batch_name, b.current_professional_year,
                cs.code AS scheme_code, cs.name AS scheme_name
         FROM students s
         LEFT JOIN academic_batches b ON COALESCE(s.current_placement_batch_id, s.original_batch_id) = b.id
         LEFT JOIN curriculum_schemes cs ON b.scheme_id = cs.id
         WHERE s.id = ?
         LIMIT 1`,
        [studentId]
      );

      if (!studentRows || studentRows.length === 0) {
        res.status(404).json({ error: 'Student not found in institutional records.', code: 'STUDENT_NOT_FOUND' });
        return;
      }

      const student = studentRows[0];
      const effectiveBatchId =
        requestedBatchId || student.batch_id || student.current_placement_batch_id || student.original_batch_id;

      if (!effectiveBatchId) {
        res.status(400).json({ error: 'Student is not assigned to an active academic batch.', code: 'NO_BATCH_ASSIGNED' });
        return;
      }

      // 2. Fetch Student's Assigned Sub-Batches
      const [subBatchRows] = await pool.query<any[]>(
        `SELECT sb.id, sb.code, sb.name
         FROM sub_batch_students sbs
         JOIN sub_batches sb ON sbs.sub_batch_id = sb.id
         WHERE sbs.student_id = ?
         ORDER BY sb.code ASC`,
        [studentId]
      );

      const subBatches = (subBatchRows || []).map((sb) => ({
        id: sb.id,
        code: sb.code,
        name: sb.name,
      }));
      const studentSubBatchIds = subBatches.map((sb) => sb.id);

      // 3. Fetch Recorded Attendance Sessions for which this student was eligible
      let sessionsSql = `
        SELECT 
          ats.id AS session_id,
          ats.attendance_date,
          ats.sub_batch_id,
          ats.created_at,
          ats.updated_at,
          u.full_name AS recorder_name,
          slot.id AS slot_id,
          slot.weekday,
          slot.start_time,
          slot.end_time,
          slot.class_type,
          sub.id AS subject_id,
          sub.code AS subject_code,
          sub.name AS subject_name,
          sb.code AS sub_batch_code,
          sb.name AS sub_batch_name,
          tv.id AS timetable_version_id,
          tv.version_code
        FROM attendance_sessions ats
        JOIN attendance_timetable_slots slot ON ats.slot_id = slot.id
        JOIN attendance_timetable_versions tv ON ats.timetable_version_id = tv.id
        LEFT JOIN subjects sub ON slot.subject_id = sub.id
        LEFT JOIN sub_batches sb ON ats.sub_batch_id = sb.id
        LEFT JOIN users u ON ats.created_by = u.id
        WHERE ats.batch_id = ?
      `;
      const params: any[] = [effectiveBatchId];

      if (fromDate) {
        sessionsSql += ' AND ats.attendance_date >= ?';
        params.push(fromDate);
      }
      if (toDate) {
        sessionsSql += ' AND ats.attendance_date <= ?';
        params.push(toDate);
      }
      if (subjectId) {
        sessionsSql += ' AND slot.subject_id = ?';
        params.push(subjectId);
      }

      // Respect sub-batch eligibility:
      // If student is in sub-batches, eligible for whole-batch (sub_batch_id IS NULL) OR their assigned sub-batches.
      // If student is not in any sub-batches, eligible only for whole-batch sessions.
      if (studentSubBatchIds.length === 0) {
        sessionsSql += ' AND ats.sub_batch_id IS NULL';
      } else {
        sessionsSql += ` AND (ats.sub_batch_id IS NULL OR ats.sub_batch_id IN (${studentSubBatchIds.map(() => '?').join(',')}))`;
        params.push(...studentSubBatchIds);
      }

      sessionsSql += ' ORDER BY ats.attendance_date ASC, slot.start_time ASC';

      const [sessionRows] = await pool.query<any[]>(sessionsSql, params);
      const sessions = sessionRows || [];

      // 4. Fetch Absences for this Student across these recorded sessions
      const sessionIds = sessions.map((s) => s.session_id);
      const absentSessionIds = new Set<number>();

      if (sessionIds.length > 0) {
        const [absenceRows] = await pool.query<any[]>(
          `SELECT session_id FROM attendance_absences
           WHERE student_id = ? AND session_id IN (${sessionIds.map(() => '?').join(',')})`,
          [studentId, ...sessionIds]
        );
        for (const a of absenceRows || []) {
          absentSessionIds.add(Number(a.session_id));
        }
      }

      // 5. Construct Chronological History Items
      const history = sessions.map((s) => {
        const isAbsent = absentSessionIds.has(s.session_id);
        const dStr =
          typeof s.attendance_date === 'string'
            ? s.attendance_date.split('T')[0]
            : new Date(s.attendance_date).toISOString().split('T')[0];
        const isAcademic = !isNonAcademicClassType(s.class_type);

        return {
          sessionId: s.session_id,
          date: dStr,
          weekday: s.weekday,
          startTime: s.start_time,
          endTime: s.end_time,
          subjectId: s.subject_id || null,
          subjectCode: s.subject_code || '',
          subjectName: s.subject_name || (isNonAcademicClassType(s.class_type) ? (s.class_type === 'MENTOR' ? 'Mentor-Mentee' : s.class_type === 'SPORTS' ? 'Sports' : 'Library Classes') : 'General Class'),
          classType: s.class_type,
          isAcademic,
          subBatchId: s.sub_batch_id || null,
          subBatchCode: s.sub_batch_code || null,
          subBatchName: s.sub_batch_name || null,
          status: (isAbsent ? 'ABSENT' : 'PRESENT') as 'PRESENT' | 'ABSENT',
          recordedAt: s.updated_at || s.created_at,
          recorderName: s.recorder_name || null,
        };
      });

      // 6. Calculate Summary Metrics for academic attendance only
      // Non-academic activities (Mentor-Mentee, Sports, Library Classes) are strictly excluded from academic totals, presents, and absences
      const academicHistory = history.filter((h) => h.isAcademic);
      const presentCount = academicHistory.filter((h) => h.status === 'PRESENT').length;
      const absentCount = academicHistory.filter((h) => h.status === 'ABSENT').length;
      const totalEligibleSessions = academicHistory.length;

      res.json({
        success: true,
        student: {
          id: student.id,
          rollNumber: student.temporary_roll_number || student.student_id_number,
          studentIdNumber: student.student_id_number,
          permanentUniversityNumber: student.permanent_university_number || null,
          name: student.full_name,
          batchId: student.batch_id,
          batchCode: student.batch_code,
          batchName: student.batch_name,
          currentProfessionalYear: student.current_professional_year,
          schemeCode: student.scheme_code,
          schemeName: student.scheme_name,
          subBatches,
        },
        filters: {
          fromDate: fromDate || null,
          toDate: toDate || null,
          subjectId: subjectId || null,
        },
        summary: {
          totalEligibleSessions,
          presentCount,
          absentCount,
          note: 'Counts include only scheduled academic sessions for which attendance was actually recorded and this student was eligible based on batch/sub-batch scope. Non-academic activities (Mentor-Mentee, Sports, Library Classes) and unrecorded classes are strictly excluded from academic attendance calculations.',
        },
        history,
      });
    } catch (err) {
      console.error('[Attendance Reports] Student history error:', err);
      res.status(500).json({ error: 'Failed to generate student attendance history', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * GET /api/attendance/reports/subject-wise
 * Subject-wise attendance summary with combined and category-specific (LT, NLT, NLP, OTHER) percentages.
 */
attendanceRouter.get(
  '/reports/subject-wise',
  requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES),
  async (req: Request, res: Response) => {
    const batchId = req.query.batchId ? Number(req.query.batchId) : null;
    const studentId = req.query.studentId ? Number(req.query.studentId) : null;
    const fromDate = req.query.fromDate ? String(req.query.fromDate).trim().split('T')[0] : null;
    const toDate = req.query.toDate ? String(req.query.toDate).trim().split('T')[0] : null;
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;

    if (!batchId || isNaN(batchId)) {
      res.status(400).json({ error: 'Valid batch ID is required.', code: 'INVALID_BATCH_ID' });
      return;
    }

    if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      res.status(400).json({ error: 'fromDate must be in YYYY-MM-DD format.', code: 'INVALID_DATE' });
      return;
    }

    if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      res.status(400).json({ error: 'toDate must be in YYYY-MM-DD format.', code: 'INVALID_DATE' });
      return;
    }

    if (fromDate && toDate && fromDate > toDate) {
      res.status(400).json({ error: 'fromDate cannot be after toDate.', code: 'INVALID_DATE_RANGE' });
      return;
    }

    const pool = getPool();
    try {
      // 1. Fetch Batch Details
      const [batchRows] = await pool.query<any[]>(
        `SELECT id, code, name, current_professional_year, scheme_id
         FROM academic_batches
         WHERE id = ?
         LIMIT 1`,
        [batchId]
      );

      if (!batchRows || batchRows.length === 0) {
        res.status(404).json({ error: 'Academic batch not found.', code: 'BATCH_NOT_FOUND' });
        return;
      }
      const batch = batchRows[0];

      // 2. Fetch Students in Batch
      let studentSql = `
        SELECT s.id, 
               COALESCE(s.temporary_roll_number, s.student_id_number) AS roll_number,
               s.student_id_number, 
               s.permanent_university_number, 
               s.full_name
        FROM students s
        WHERE (s.current_placement_batch_id = ? OR s.original_batch_id = ?)
          AND (s.status = 'ACTIVE' OR s.administrative_status = 'ACTIVE')
      `;
      const studentParams: any[] = [batchId, batchId];

      if (studentId) {
        studentSql += ' AND s.id = ?';
        studentParams.push(studentId);
      }

      studentSql += ' ORDER BY roll_number ASC, s.full_name ASC';

      const [studentRows] = await pool.query<any[]>(studentSql, studentParams);
      const students = studentRows || [];

      if (students.length === 0) {
        res.json({
          success: true,
          batch: {
            id: batch.id,
            code: batch.code,
            name: batch.name,
            currentProfessionalYear: batch.current_professional_year,
          },
          filters: {
            studentId: studentId || null,
            fromDate: fromDate || null,
            toDate: toDate || null,
            subjectId: subjectId || null,
          },
          totalStudents: 0,
          totalSubjects: 0,
          summary: [],
        });
        return;
      }

      // 3. Fetch Sub-Batch Mappings for Students
      const studentSubBatchMap = new Map<number, Set<number>>();
      const [subBatchStudentRows] = await pool.query<any[]>(
        `SELECT sbs.student_id, sbs.sub_batch_id
         FROM sub_batch_students sbs
         JOIN sub_batches sb ON sbs.sub_batch_id = sb.id
         WHERE sb.batch_id = ?`,
        [batchId]
      );

      for (const row of subBatchStudentRows || []) {
        const stId = Number(row.student_id);
        const sbId = Number(row.sub_batch_id);
        if (!studentSubBatchMap.has(stId)) {
          studentSubBatchMap.set(stId, new Set<number>());
        }
        studentSubBatchMap.get(stId)!.add(sbId);
      }

      // 4. Fetch Recorded Sessions for Batch
      let sessionSql = `
        SELECT 
          ats.id AS session_id,
          ats.slot_id,
          ats.sub_batch_id,
          ats.attendance_date,
          slot.subject_id,
          slot.class_type,
          sub.code AS subject_code,
          sub.name AS subject_name
        FROM attendance_sessions ats
        JOIN attendance_timetable_slots slot ON ats.slot_id = slot.id
        LEFT JOIN subjects sub ON slot.subject_id = sub.id
        WHERE ats.batch_id = ?
          AND slot.class_type NOT IN ('MENTOR', 'SPORTS', 'LIB', 'LIBRARY')
          AND slot.subject_id IS NOT NULL
      `;
      const sessionParams: any[] = [batchId];

      if (fromDate) {
        sessionSql += ' AND ats.attendance_date >= ?';
        sessionParams.push(fromDate);
      }
      if (toDate) {
        sessionSql += ' AND ats.attendance_date <= ?';
        sessionParams.push(toDate);
      }
      if (subjectId) {
        sessionSql += ' AND slot.subject_id = ?';
        sessionParams.push(subjectId);
      }

      const [sessionRows] = await pool.query<any[]>(sessionSql, sessionParams);
      const sessions = sessionRows || [];

      // 5. Fetch Absences for Recorded Sessions
      const sessionIds = sessions.map((s) => s.session_id);
      const absenceSet = new Set<string>();

      if (sessionIds.length > 0) {
        const [absenceRows] = await pool.query<any[]>(
          `SELECT session_id, student_id FROM attendance_absences
           WHERE session_id IN (${sessionIds.map(() => '?').join(',')})`,
          sessionIds
        );
        for (const a of absenceRows || []) {
          absenceSet.add(`${a.session_id}_${a.student_id}`);
        }
      }

      // 6. Gather Unique Subjects
      const subjectMap = new Map<number, { id: number; code: string; name: string }>();
      for (const sess of sessions) {
        if (!subjectMap.has(sess.subject_id)) {
          subjectMap.set(sess.subject_id, {
            id: sess.subject_id,
            code: sess.subject_code,
            name: sess.subject_name,
          });
        }
      }

      if (subjectMap.size === 0 || (subjectId && !subjectMap.has(subjectId))) {
        let subQuery = 'SELECT sub.id, sub.code, sub.name FROM subjects sub';
        const subParams: any[] = [];
        if (subjectId) {
          subQuery += ' WHERE sub.id = ?';
          subParams.push(subjectId);
        } else if (batch.scheme_id) {
          subQuery += ' WHERE sub.scheme_id = ?';
          subParams.push(batch.scheme_id);
        }
        const [subjRows] = await pool.query<any[]>(subQuery, subParams);
        for (const s of subjRows || []) {
          if (!subjectMap.has(s.id)) {
            subjectMap.set(s.id, { id: s.id, code: s.code, name: s.name });
          }
        }
      }

      const subjectList = Array.from(subjectMap.values());
      subjectList.sort((a, b) => a.code.localeCompare(b.code));

      // 7. Calculate Subject-Wise Percentages per Student
      const summary: any[] = [];

      for (const st of students) {
        const stSubBatches = studentSubBatchMap.get(st.id) || new Set<number>();

        for (const sub of subjectList) {
          const stats: Record<'LT' | 'NLT' | 'NLP' | 'OTHER', { recorded: number; present: number; absent: number }> = {
            LT: { recorded: 0, present: 0, absent: 0 },
            NLT: { recorded: 0, present: 0, absent: 0 },
            NLP: { recorded: 0, present: 0, absent: 0 },
            OTHER: { recorded: 0, present: 0, absent: 0 },
          };

          const subSessions = sessions.filter((s) => s.subject_id === sub.id);

          for (const sess of subSessions) {
            const isWholeBatch = sess.sub_batch_id === null;
            const isSubBatchMatch = sess.sub_batch_id !== null && stSubBatches.has(sess.sub_batch_id);

            if (!isWholeBatch && !isSubBatchMatch) {
              continue; // Student not eligible for this sub-batch session
            }

            const rawCat = String(sess.class_type || '').toUpperCase();
            if (isNonAcademicClassType(rawCat)) {
              continue;
            }
            const cat = (['LT', 'NLT', 'NLP', 'OTHER'].includes(rawCat) ? rawCat : 'OTHER') as 'LT' | 'NLT' | 'NLP' | 'OTHER';

            stats[cat].recorded++;

            const isAbsent = absenceSet.has(`${sess.session_id}_${st.id}`);
            if (isAbsent) {
              stats[cat].absent++;
            } else {
              stats[cat].present++;
            }
          }

          const calcCat = (cat: { recorded: number; present: number; absent: number }) => ({
            recorded: cat.recorded,
            present: cat.present,
            absent: cat.absent,
            percentage:
              cat.recorded > 0 ? Number(((cat.present / cat.recorded) * 100).toFixed(2)) : null,
          });

          const lt = calcCat(stats.LT);
          const nlt = calcCat(stats.NLT);
          const nlp = calcCat(stats.NLP);
          const other = calcCat(stats.OTHER);

          // Combined across LT, NLT, NLP (excluding OTHER)
          const combinedRecorded = stats.LT.recorded + stats.NLT.recorded + stats.NLP.recorded;
          const combinedPresent = stats.LT.present + stats.NLT.present + stats.NLP.present;
          const combinedAbsent = stats.LT.absent + stats.NLT.absent + stats.NLP.absent;
          const combinedPercentage =
            combinedRecorded > 0
              ? Number(((combinedPresent / combinedRecorded) * 100).toFixed(2))
              : null;

          summary.push({
            studentId: st.id,
            rollNumber: st.roll_number,
            studentIdNumber: st.student_id_number,
            permanentUniversityNumber: st.permanent_university_number || null,
            studentName: st.full_name,
            subjectId: sub.id,
            subjectCode: sub.code,
            subjectName: sub.name,
            lt,
            nlt,
            nlp,
            other,
            combined: {
              recorded: combinedRecorded,
              present: combinedPresent,
              absent: combinedAbsent,
              percentage: combinedPercentage,
            },
          });
        }
      }

      res.json({
        success: true,
        batch: {
          id: batch.id,
          code: batch.code,
          name: batch.name,
          currentProfessionalYear: batch.current_professional_year,
        },
        filters: {
          studentId: studentId || null,
          fromDate: fromDate || null,
          toDate: toDate || null,
          subjectId: subjectId || null,
        },
        totalStudents: students.length,
        totalSubjects: subjectList.length,
        summary,
      });
    } catch (err) {
      console.error('[Attendance Reports] Subject-wise percentage error:', err);
      res.status(500).json({ error: 'Failed to generate subject-wise attendance percentages', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * GET /api/attendance/reports/missing-sessions
 * Stage 7: Identify scheduled timetable slots with NO recorded attendance in a date range
 */
attendanceRouter.get(
  '/reports/missing-sessions',
  requireRoles(...OFFICE_ADMIN_ATTENDANCE_ROLES),
  async (req: Request, res: Response) => {
    const batchId = req.query.batchId ? Number(req.query.batchId) : null;
    const fromDate = req.query.fromDate ? String(req.query.fromDate).trim() : null;
    const toDate = req.query.toDate ? String(req.query.toDate).trim() : null;

    if (!batchId) {
      res.status(400).json({ error: 'Academic batch ID is required.', code: 'MISSING_BATCH_ID' });
      return;
    }

    const pool = getPool();
    try {
      // 1. Fetch batch details
      const [batchRows] = await pool.query<any[]>(
        'SELECT id, code, name, current_professional_year FROM academic_batches WHERE id = ? LIMIT 1',
        [batchId]
      );
      if (!batchRows || batchRows.length === 0) {
        res.status(404).json({ error: 'Academic batch not found.', code: 'BATCH_NOT_FOUND' });
        return;
      }
      const batch = batchRows[0];

      // 2. Determine date range
      const todayStr = new Date().toISOString().split('T')[0];
      const endDtStr = toDate && toDate <= todayStr ? toDate : todayStr;

      let startDtStr = fromDate;
      if (!startDtStr) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDtStr = d.toISOString().split('T')[0];
      }

      if (startDtStr > endDtStr) {
        res.status(400).json({ error: 'Invalid date range. fromDate cannot be after toDate.', code: 'INVALID_DATE_RANGE' });
        return;
      }

      // 3. Fetch institutional holidays in range
      const [holidayRows] = await pool.query<any[]>(
        'SELECT holiday_date FROM institutional_holidays WHERE holiday_date BETWEEN ? AND ?',
        [startDtStr, endDtStr]
      );
      const holidaySet = new Set<string>((holidayRows || []).map((h) => String(h.holiday_date).split('T')[0]));

      // 4. Fetch all active timetable versions for batch
      const [versionRows] = await pool.query<any[]>(
        `SELECT id, version_code, title, effective_from, effective_to
         FROM attendance_timetable_versions
         WHERE batch_id = ? AND is_active = TRUE
         ORDER BY effective_from ASC`,
        [batchId]
      );
      const versions = versionRows || [];

      if (versions.length === 0) {
        res.json({
          success: true,
          batch: { id: batch.id, code: batch.code, name: batch.name },
          filters: { batchId, fromDate: startDtStr, toDate: endDtStr },
          totalMissing: 0,
          missingSessions: [],
        });
        return;
      }

      // 5. Fetch all slots for these versions
      const versionIds = versions.map((v) => v.id);
      const [slotRows] = await pool.query<any[]>(
        `SELECT s.id, s.timetable_version_id, s.weekday, s.start_time, s.end_time, s.subject_id,
                s.class_type, s.sub_batch_id, s.week_pattern,
                sub.code AS subject_code, sub.name AS subject_name,
                sb.code AS sub_batch_code, sb.name AS sub_batch_name
         FROM attendance_timetable_slots s
         LEFT JOIN subjects sub ON s.subject_id = sub.id
         LEFT JOIN sub_batches sb ON s.sub_batch_id = sb.id
         WHERE s.timetable_version_id IN (${versionIds.map(() => '?').join(',')})
           AND s.class_type NOT IN ('MENTOR', 'SPORTS', 'LIB', 'LIBRARY')`,
        versionIds
      );
      const slots = slotRows || [];

      // 6. Fetch recorded sessions in date range for batch
      const [sessionRows] = await pool.query<any[]>(
        `SELECT slot_id, attendance_date
         FROM attendance_sessions
         WHERE batch_id = ? AND attendance_date >= ? AND attendance_date <= ?`,
        [batchId, startDtStr, endDtStr]
      );
      const recordedSet = new Set<string>();
      for (const sess of sessionRows || []) {
        const dStr = String(sess.attendance_date).split('T')[0];
        recordedSet.add(`${sess.slot_id}_${dStr}`);
      }

      // 7. Iterate date by date and identify unrecorded slots
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const missingSessions: any[] = [];

      const [y1, m1, d1] = startDtStr.split('-').map(Number);
      const [y2, m2, d2] = endDtStr.split('-').map(Number);
      const curr = new Date(y1, m1 - 1, d1);
      const end = new Date(y2, m2 - 1, d2);

      while (curr <= end) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        // Skip holidays and Sundays
        if (!holidaySet.has(dateStr) && curr.getDay() !== 0) {
          // Find effective timetable version on dateStr
          const effectiveVer = versions.find((v) => {
            const vFrom = String(v.effective_from).split('T')[0];
            const vTo = v.effective_to ? String(v.effective_to).split('T')[0] : null;
            return vFrom <= dateStr && (!vTo || vTo >= dateStr);
          });

          if (effectiveVer) {
            const weekday = dayNames[curr.getDay()];

            // Calculate week pattern
            const [vY, vM, vD] = String(effectiveVer.effective_from).split('T')[0].split('-').map(Number);
            const fromDt = new Date(vY, vM - 1, vD);
            const diffDays = Math.floor(Math.abs(curr.getTime() - fromDt.getTime()) / (1000 * 60 * 60 * 24));
            const weekNumber = Math.floor(diffDays / 7) + 1;
            const isOddWeek = weekNumber % 2 !== 0;

            const applicableSlots = slots.filter((slot) => {
              if (slot.timetable_version_id !== effectiveVer.id) return false;
              if (slot.weekday !== weekday) return false;
              if (slot.week_pattern === 'EVERY_WEEK') return true;
              if (slot.week_pattern === 'ODD_WEEKS' && isOddWeek) return true;
              if (slot.week_pattern === 'EVEN_WEEKS' && !isOddWeek) return true;
              return false;
            });

            for (const slot of applicableSlots) {
              const key = `${slot.id}_${dateStr}`;
              if (!recordedSet.has(key)) {
                missingSessions.push({
                  date: dateStr,
                  weekday,
                  slotId: slot.id,
                  startTime: slot.start_time,
                  endTime: slot.end_time,
                  subjectId: slot.subject_id,
                  subjectCode: slot.subject_code || 'SUB',
                  subjectName: slot.subject_name || 'Subject',
                  classType: slot.class_type,
                  subBatchId: slot.sub_batch_id || null,
                  subBatchCode: slot.sub_batch_code || null,
                  subBatchName: slot.sub_batch_name || null,
                  timetableVersionId: effectiveVer.id,
                  timetableVersionCode: effectiveVer.version_code,
                  status: 'NOT RECORDED',
                });
              }
            }
          }
        }

        curr.setDate(curr.getDate() + 1);
      }

      res.json({
        success: true,
        batch: { id: batch.id, code: batch.code, name: batch.name },
        filters: { batchId, fromDate: startDtStr, toDate: endDtStr },
        totalMissing: missingSessions.length,
        missingSessions,
      });
    } catch (err) {
      console.error('[Attendance Reports] Missing sessions error:', err);
      res.status(500).json({ error: 'Failed to generate missing attendance sessions report', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * GET /api/attendance/settings/threshold
 * Principal-Controlled setting for attendance shortage
 */
attendanceRouter.get(
  '/settings/threshold',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN, ROLES.OFFICE, ROLES.STAFF),
  async (req: Request, res: Response) => {
    const pool = getPool();
    try {
      const [rows] = await pool.query<any[]>('SELECT threshold FROM attendance_threshold_settings WHERE id = 1');
      res.json({ success: true, threshold: rows[0]?.threshold !== undefined ? Number(rows[0].threshold) : 75.00 });
    } catch (err: any) {
      if (err.code === 'ER_NO_SUCH_TABLE' || err.message?.includes("doesn't exist")) {
        // Table not yet migrated; return statutory default threshold gracefully rather than crashing
        res.json({ success: true, threshold: 75.00 });
        return;
      }
      console.error('[Attendance] Get threshold error:', err);
      res.status(500).json({ error: 'Failed to fetch attendance threshold.', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * POST /api/attendance/settings/threshold
 * Update the attendance shortage threshold
 */
attendanceRouter.post(
  '/settings/threshold',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const { threshold } = req.body;
    const numThreshold = Number(threshold);
    if (isNaN(numThreshold) || numThreshold < 0 || numThreshold > 100) {
      res.status(400).json({ error: 'Threshold must be a valid number between 0 and 100.', code: 'INVALID_THRESHOLD' });
      return;
    }

    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO attendance_threshold_settings (id, threshold, updated_by)
         VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE threshold = VALUES(threshold), updated_by = VALUES(updated_by)`,
        [numThreshold, req.user!.id]
      );
      await recordAuditLog({
        actorId: req.user!.id,
        action: 'ATTENDANCE_THRESHOLD_UPDATED',
        targetType: 'ATTENDANCE_THRESHOLD',
        targetId: '1',
        details: { newThreshold: numThreshold },
        ipAddress: req.ip || null,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('[Attendance] Update threshold error:', err);
      res.status(500).json({ error: 'Failed to update attendance threshold.', code: 'DATABASE_ERROR' });
    }
  }
);






