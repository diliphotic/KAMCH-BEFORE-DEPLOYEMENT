import { Router, Request, Response } from 'express';
import { getPool } from '../db.ts';
import { requireAuth, requireRoles } from '../middleware/auth.ts';
import { ROLES } from '../permissions.ts';
import { recordAuditLog } from '../services/audit.ts';

export const leaveRouter = Router();

leaveRouter.use(requireAuth);

const requireLinkedTeacher = (req: Request, res: Response, next: any) => {
  if (!req.user || !req.user.teacherId) {
    res.status(403).json({ error: 'Access denied: Teacher account not linked.', code: 'UNLINKED_TEACHER' });
    return;
  }
  next();
};

export function getKolkataDateString(date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(date);
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().split('T')[0];
}

async function getLeaveMaxAdvanceDays(pool: any): Promise<number> {
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM institutional_settings WHERE setting_key = 'LEAVE_MAX_ADVANCE_DAYS' LIMIT 1"
    );
    if (rows && rows.length > 0) {
      const val = parseInt(rows[0].setting_value, 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch {
    // fallback default
  }
  return 20;
}

export const LEAVE_CATEGORIES = {
  CL: {
    code: 'CL',
    name: 'Casual Leave',
    entitlementDays: 15,
    maxDaysPerApp: 4,
    minDaysPerApp: 1,
    maxDailyCapacity: 5,
    requiresReason: false,
    description: '15 days entitlement; maximum 4 days per application; maximum 5 members per day',
  },
  EL: {
    code: 'EL',
    name: 'Earned Leave',
    entitlementDays: 30,
    maxDaysPerApp: 10,
    minDaysPerApp: 5,
    maxDailyCapacity: 4,
    minGapMonths: 3,
    requiresReason: false,
    description: '30 days entitlement; minimum 5 and maximum 10 days per application; maximum 4 members per day; minimum 3-month gap between applications',
  },
  SPECIAL_SL: {
    code: 'SPECIAL_SL',
    name: 'Special SL',
    entitlementDays: 15,
    maxDaysPerApp: 15,
    minDaysPerApp: 1,
    maxDailyCapacity: null,
    requiresReason: true,
    description: '15 days entitlement; mandatory detailed reason required; subject to approval',
  },
  PATERNITY: {
    code: 'PATERNITY',
    name: 'Paternity Leave',
    entitlementDays: 7,
    maxDaysPerApp: 7,
    minDaysPerApp: 1,
    maxDailyCapacity: null,
    requiresReason: false,
    description: '7 days entitlement',
  },
  MATERNITY: {
    code: 'MATERNITY',
    name: 'Maternity Leave',
    entitlementDays: 180, // ~6 months
    maxDaysPerApp: 180,
    minDaysPerApp: 1,
    maxDailyCapacity: null,
    requiresReason: false,
    description: '6 months entitlement',
  },
};

/**
 * GET /api/leave/categories
 * Returns official leave categories and application rules
 */
leaveRouter.get('/categories', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    categories: Object.values(LEAVE_CATEGORIES),
  });
});

/**
 * GET /api/leave/settings
 * Retrieves leave application window settings
 */
leaveRouter.get('/settings', async (_req: Request, res: Response) => {
  const pool = getPool();
  try {
    const maxAdvanceDays = await getLeaveMaxAdvanceDays(pool);
    const todayKolkata = getKolkataDateString();
    const minStartDate = addDaysToDateString(todayKolkata, 1);
    const maxStartDate = addDaysToDateString(todayKolkata, maxAdvanceDays);

    res.json({
      success: true,
      maxAdvanceDays,
      minAdvanceDays: 1,
      today: todayKolkata,
      minStartDate,
      maxStartDate,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve leave settings', code: 'DATABASE_ERROR' });
  }
});

/**
 * POST /api/leave/settings
 * Principal/Super Admin configures maximum advance leave application window
 */
leaveRouter.post(
  '/settings',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const { maxAdvanceDays } = req.body;
    const numDays = Number(maxAdvanceDays);

    if (isNaN(numDays) || numDays < 1 || numDays > 365) {
      res.status(400).json({
        error: 'Maximum advance window must be a positive number of days (1-365).',
        code: 'INVALID_WINDOW',
      });
      return;
    }

    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO institutional_settings (setting_key, setting_value, effective_date, updated_reason)
         VALUES ('LEAVE_MAX_ADVANCE_DAYS', ?, CURDATE(), 'Updated by Principal')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
        [String(numDays)]
      );

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'LEAVE_SETTINGS_UPDATED',
        targetType: 'INSTITUTIONAL_SETTING',
        targetId: 'LEAVE_MAX_ADVANCE_DAYS',
        ipAddress: req.ip || null,
        details: { maxAdvanceDays: numDays },
      });

      res.json({ success: true, maxAdvanceDays: numDays });
    } catch (err) {
      console.error('[Leave] Update settings error:', err);
      res.status(500).json({ error: 'Failed to update leave settings', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * GET /api/leave/balances
 * Returns entitlements, used balance, pending days, and remaining balance for a teacher
 */
leaveRouter.get('/balances', async (req: Request, res: Response) => {
  const isPrincipalOrAdmin = [ROLES.PRINCIPAL, ROLES.SUPER_ADMIN].includes(req.user!.role as any);
  const targetTeacherId = isPrincipalOrAdmin && req.query.teacherId
    ? Number(req.query.teacherId)
    : req.user!.teacherId;

  if (!targetTeacherId) {
    res.status(400).json({ error: 'Teacher ID required', code: 'MISSING_TEACHER_ID' });
    return;
  }

  const pool = getPool();
  try {
    const todayStr = getKolkataDateString();
    const [cy, cm] = todayStr.split('-').map(Number);
    const acadStart = cm >= 6 ? `${cy}-06-01` : `${cy - 1}-06-01`;

    const [rows] = await pool.query<any[]>(
      `SELECT leave_category, status, start_date, end_date FROM leave_applications
       WHERE teacher_id = ? AND status IN ('APPROVED', 'PENDING') AND start_date >= ?`,
      [targetTeacherId, acadStart]
    );

    const usedMap: Record<string, number> = { CL: 0, EL: 0, SPECIAL_SL: 0, PATERNITY: 0, MATERNITY: 0 };
    const pendingMap: Record<string, number> = { CL: 0, EL: 0, SPECIAL_SL: 0, PATERNITY: 0, MATERNITY: 0 };

    for (const app of rows || []) {
      const cat = (app.leave_category || 'CL').toUpperCase();
      const sStr = typeof app.start_date === 'string' ? app.start_date.split('T')[0] : new Date(app.start_date).toISOString().split('T')[0];
      const eStr = typeof app.end_date === 'string' ? app.end_date.split('T')[0] : new Date(app.end_date).toISOString().split('T')[0];
      const [sy, sm, sd] = sStr.split('-').map(Number);
      const [ey, em, ed] = eStr.split('-').map(Number);
      const durationDays = Math.round((new Date(Date.UTC(ey, em - 1, ed)).getTime() - new Date(Date.UTC(sy, sm - 1, sd)).getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (app.status === 'APPROVED') {
        usedMap[cat] = (usedMap[cat] || 0) + durationDays;
      } else if (app.status === 'PENDING') {
        pendingMap[cat] = (pendingMap[cat] || 0) + durationDays;
      }
    }

    const balances = Object.values(LEAVE_CATEGORIES).map((cat) => {
      const entitlement = cat.entitlementDays;
      const used = usedMap[cat.code] || 0;
      const pending = pendingMap[cat.code] || 0;
      // Approved remaining balance (does not deduct pending applications)
      const remaining = Math.max(0, entitlement - used);

      return {
        categoryCode: cat.code,
        categoryName: cat.name,
        entitlementDays: entitlement,
        usedDays: used,
        pendingDays: pending,
        remainingDays: remaining,
        maxDaysPerApp: cat.maxDaysPerApp,
        minDaysPerApp: cat.minDaysPerApp,
        maxDailyCapacity: cat.maxDailyCapacity,
        requiresReason: cat.requiresReason,
        description: cat.description,
      };
    });

    res.json({
      success: true,
      teacherId: targetTeacherId,
      balances,
    });
  } catch (err) {
    console.error('[Leave] Balances error:', err);
    res.status(500).json({ error: 'Failed to fetch leave balances', code: 'DATABASE_ERROR' });
  }
});

/**
 * POST /api/leave/apply
 * Submit a leave application with strict server-side rule validation
 */
leaveRouter.post(
  '/apply',
  requireLinkedTeacher,
  async (req: Request, res: Response) => {
    const { startDate, endDate, reason, leaveCategory } = req.body;
    const catCode = String(leaveCategory || 'CL').trim().toUpperCase();

    if (!startDate || !endDate || !reason || !String(reason).trim()) {
      res.status(400).json({ error: 'Start date, end date, and reason are required.', code: 'MISSING_FIELDS' });
      return;
    }

    const categoryConfig = (LEAVE_CATEGORIES as any)[catCode];
    if (!categoryConfig) {
      res.status(400).json({ error: 'Invalid leave category selected.', code: 'INVALID_CATEGORY' });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      res.status(400).json({ error: 'Start date cannot be after end date.', code: 'INVALID_DATE_RANGE' });
      return;
    }

    const [sy, sm, sd] = String(startDate).split('-').map(Number);
    const [ey, em, ed] = String(endDate).split('-').map(Number);
    const durationDays = Math.round((new Date(Date.UTC(ey, em - 1, ed)).getTime() - new Date(Date.UTC(sy, sm - 1, sd)).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // 1. Duration Limits
    if (catCode === 'CL') {
      if (durationDays < 1 || durationDays > 4) {
        res.status(400).json({
          error: `Casual Leave (CL) allows a maximum of 4 days per application. Requested duration is ${durationDays} days.`,
          code: 'CL_DURATION_EXCEEDED',
        });
        return;
      }
    } else if (catCode === 'EL') {
      if (durationDays < 5 || durationDays > 10) {
        res.status(400).json({
          error: `Earned Leave (EL) requires a minimum of 5 days and maximum of 10 days per application. Requested duration is ${durationDays} days.`,
          code: 'EL_DURATION_INVALID',
        });
        return;
      }
    } else if (catCode === 'SPECIAL_SL') {
      if (String(reason).trim().length < 5) {
        res.status(400).json({
          error: 'Special SL requires a mandatory, detailed reason.',
          code: 'SPECIAL_SL_REASON_REQUIRED',
        });
        return;
      }
    } else if (catCode === 'PATERNITY') {
      if (durationDays > 7) {
        res.status(400).json({
          error: `Paternity Leave cannot exceed 7 days entitlement. Requested duration is ${durationDays} days.`,
          code: 'PATERNITY_DURATION_EXCEEDED',
        });
        return;
      }
    } else if (catCode === 'MATERNITY') {
      if (durationDays > 183) {
        res.status(400).json({
          error: 'Maternity Leave cannot exceed 6 calendar months (~180 days).',
          code: 'MATERNITY_DURATION_EXCEEDED',
        });
        return;
      }
    }

    const pool = getPool();
    const maxAdvanceDays = await getLeaveMaxAdvanceDays(pool);
    const todayKolkata = getKolkataDateString();
    const minStartDate = addDaysToDateString(todayKolkata, 1);
    const maxStartDate = addDaysToDateString(todayKolkata, maxAdvanceDays);

    if (startDate < minStartDate) {
      res.status(400).json({
        error: `Leave applications cannot start today or in the past. Earliest permitted start date is ${minStartDate}.`,
        code: 'INVALID_START_DATE_TOO_EARLY',
      });
      return;
    }

    if (startDate > maxStartDate) {
      res.status(400).json({
        error: `Start date exceeds the maximum advance application window of ${maxAdvanceDays} days (${maxStartDate}).`,
        code: 'INVALID_START_DATE_TOO_LATE',
      });
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 2. Check Teacher's Remaining Balance for Category
      const [existingApps] = await conn.query<any[]>(
        `SELECT leave_category, start_date, end_date FROM leave_applications
         WHERE teacher_id = ? AND status IN ('APPROVED', 'PENDING') AND leave_category = ?`,
        [req.user!.teacherId, catCode]
      );

      let usedCatDays = 0;
      for (const a of existingApps) {
        const sStr = typeof a.start_date === 'string' ? a.start_date.split('T')[0] : new Date(a.start_date).toISOString().split('T')[0];
        const eStr = typeof a.end_date === 'string' ? a.end_date.split('T')[0] : new Date(a.end_date).toISOString().split('T')[0];
        const [asy, asm, asd] = sStr.split('-').map(Number);
        const [aey, aem, aed] = eStr.split('-').map(Number);
        const d = Math.round((new Date(Date.UTC(aey, aem - 1, aed)).getTime() - new Date(Date.UTC(asy, asm - 1, asd)).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        usedCatDays += d;
      }

      if (usedCatDays + durationDays > categoryConfig.entitlementDays) {
        await conn.rollback();
        res.status(400).json({
          error: `Requested duration (${durationDays} days) exceeds remaining balance for ${categoryConfig.name} (${categoryConfig.entitlementDays - usedCatDays} days remaining).`,
          code: 'INSUFFICIENT_LEAVE_BALANCE',
        });
        return;
      }

      // 3. Prevent Overlapping Leave Applications for Same Teacher
      const [overlapping] = await conn.query<any[]>(
        `SELECT id FROM leave_applications
         WHERE teacher_id = ? AND status IN ('APPROVED', 'PENDING')
           AND start_date <= ? AND end_date >= ?
         LIMIT 1`,
        [req.user!.teacherId, endDate, startDate]
      );

      if (overlapping && overlapping.length > 0) {
        await conn.rollback();
        res.status(400).json({
          error: 'You already have an active or pending leave application covering these dates.',
          code: 'OVERLAPPING_LEAVE_APPLICATION',
        });
        return;
      }

      // 4. Daily Capacity Limit Check (CL max 5, EL max 4 members/day)
      if (categoryConfig.maxDailyCapacity !== null) {
        let curDt = new Date(Date.UTC(sy, sm - 1, sd));
        const endDt = new Date(Date.UTC(ey, em - 1, ed));

        while (curDt <= endDt) {
          const curStr = curDt.toISOString().split('T')[0];
          const [dailyCountRows] = await conn.query<any[]>(
            `SELECT COUNT(DISTINCT teacher_id) AS cnt FROM leave_applications
             WHERE status = 'APPROVED'
               AND leave_category = ?
               AND start_date <= ? AND end_date >= ?`,
            [catCode, curStr, curStr]
          );

          const countOnDay = Number(dailyCountRows?.[0]?.cnt || 0);
          if (countOnDay >= categoryConfig.maxDailyCapacity) {
            await conn.rollback();
            res.status(400).json({
              error: `Daily ${categoryConfig.name} capacity limit (maximum ${categoryConfig.maxDailyCapacity} members per day) reached on ${curStr}.`,
              code: 'DAILY_CAPACITY_EXCEEDED',
              date: curStr,
            });
            return;
          }
          curDt.setUTCDate(curDt.getUTCDate() + 1);
        }
      }

      // 5. 3-Month Gap Check for Earned Leave (EL)
      if (catCode === 'EL') {
        const [prevElApps] = await conn.query<any[]>(
          `SELECT start_date, end_date FROM leave_applications
           WHERE teacher_id = ? AND status IN ('APPROVED', 'PENDING') AND leave_category = 'EL'
           ORDER BY end_date DESC LIMIT 1`,
          [req.user!.teacherId]
        );

        if (prevElApps && prevElApps.length > 0) {
          const prevEnd = typeof prevElApps[0].end_date === 'string'
            ? prevElApps[0].end_date.split('T')[0]
            : new Date(prevElApps[0].end_date).toISOString().split('T')[0];
          
          const [pey, pem, ped] = prevEnd.split('-').map(Number);
          const prevEndDt = new Date(Date.UTC(pey, pem - 1, ped));
          const newStartDt = new Date(Date.UTC(sy, sm - 1, sd));

          const diffDays = Math.round((newStartDt.getTime() - prevEndDt.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 90) { // Minimum 3 months gap (~90 days)
            await conn.rollback();
            res.status(400).json({
              error: `Earned Leave (EL) requires a minimum 3-month gap between leave applications. Last EL ended on ${prevEnd} (${diffDays} days ago).`,
              code: 'EL_GAP_VIOLATION',
            });
            return;
          }
        }
      }

      // 6. Insert Leave Application
      const [result] = await conn.query<any>(
        'INSERT INTO leave_applications (teacher_id, leave_category, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)',
        [req.user!.teacherId, catCode, startDate, endDate, String(reason).trim()]
      );
      const applicationId = result.insertId;

      await conn.commit();

      // Notify Principal and Super Admin
      const [teachers] = await pool.query<any[]>('SELECT full_name FROM teachers WHERE id = ?', [req.user!.teacherId]);
      const teacherName = teachers[0]?.full_name || 'A teacher';

      const [principals] = await pool.query<any[]>(
        `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.code IN ('PRINCIPAL', 'SUPER_ADMIN') AND u.is_deactivated = FALSE`
      );

      for (const p of principals) {
        const [existing] = await pool.query<any[]>(
          'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND related_id = ?',
          [p.id, 'LEAVE_SUBMISSION', applicationId]
        );
        if (existing.length === 0) {
          const title = `New ${categoryConfig.name} Application Submitted`;
          const message = `${teacherName} has requested ${categoryConfig.name} (${durationDays} days) from ${startDate} to ${endDate}. Reason: ${reason}`;
          await pool.query(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
            [p.id, title, message, 'LEAVE_SUBMISSION', applicationId]
          );
        }
      }

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'LEAVE_APPLICATION_SUBMITTED',
        targetType: 'LEAVE_APPLICATION',
        targetId: String(applicationId),
        ipAddress: req.ip || null,
        details: { teacherId: req.user!.teacherId, leaveCategory: catCode, startDate, endDate, durationDays },
      });

      res.status(201).json({ success: true, applicationId, leaveCategory: catCode, durationDays });
    } catch (err) {
      await conn.rollback();
      console.error('[Leave] Submission error:', err);
      res.status(500).json({ error: 'Failed to submit application', code: 'DATABASE_ERROR' });
    } finally {
      conn.release();
    }
  }
);

/**
 * GET /api/leave/my-applications
 * Teacher views own applications
 */
leaveRouter.get(
  '/my-applications',
  requireLinkedTeacher,
  async (req: Request, res: Response) => {
    const pool = getPool();
    try {
      const [rows] = await pool.query<any[]>(
        `SELECT la.*, u_dec.full_name AS decider_name 
         FROM leave_applications la 
         LEFT JOIN users u_dec ON la.decided_by = u_dec.id 
         WHERE la.teacher_id = ? 
         ORDER BY la.submitted_at DESC`,
        [req.user!.teacherId]
      );
      res.json({ success: true, applications: rows });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch applications', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * POST /api/leave/applications/:id/cancel
 * Faculty cancels their own pending leave application
 */
leaveRouter.post(
  '/applications/:id/cancel',
  requireLinkedTeacher,
  async (req: Request, res: Response) => {
    const applicationId = req.params.id;
    const pool = getPool();
    try {
      const [apps] = await pool.query<any[]>(
        'SELECT id, status FROM leave_applications WHERE id = ? AND teacher_id = ?',
        [applicationId, req.user!.teacherId]
      );
      if (apps.length === 0) {
        res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
        return;
      }
      if (apps[0].status !== 'PENDING') {
        res.status(400).json({ error: 'Only pending applications can be cancelled.', code: 'NOT_PENDING' });
        return;
      }
      await pool.query(
        "UPDATE leave_applications SET status = 'CANCELLED' WHERE id = ?",
        [applicationId]
      );
      res.json({ success: true, message: 'Leave application cancelled successfully.' });
    } catch (err) {
      console.error('[Leave] Cancel error:', err);
      res.status(500).json({ error: 'Failed to cancel application', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * GET /api/leave/all-applications
 * Principal views all applications
 */
leaveRouter.get(
  '/all-applications',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (_req: Request, res: Response) => {
    const pool = getPool();
    try {
      const [rows] = await pool.query<any[]>(
        `SELECT la.*, t.full_name AS teacher_name, t.designation AS teacher_designation, d.name AS department_name 
         FROM leave_applications la 
         JOIN teachers t ON la.teacher_id = t.id 
         LEFT JOIN departments d ON t.department_id = d.id 
         ORDER BY la.submitted_at DESC`
      );
      res.json({ success: true, applications: rows });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch applications', code: 'DATABASE_ERROR' });
    }
  }
);

/**
 * POST /api/leave/:id/decide
 * Principal approves/rejects application
 */
leaveRouter.post(
  '/:id/decide',
  requireRoles(ROLES.PRINCIPAL, ROLES.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const { status, remarks } = req.body;
    const applicationId = req.params.id;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'Invalid decision status', code: 'INVALID_STATUS' });
      return;
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [apps] = await conn.query<any[]>('SELECT teacher_id, leave_category, start_date, end_date FROM leave_applications WHERE id = ?', [applicationId]);
      if (apps.length === 0) {
        await conn.rollback();
        res.status(404).json({ error: 'Application not found' });
        return;
      }
      const app = apps[0];
      const teacherId = app.teacher_id;

      await conn.query(
        'UPDATE leave_applications SET status = ?, decided_by = ?, decided_at = NOW(), decision_remarks = ? WHERE id = ?',
        [status, req.user!.id, remarks || null, applicationId]
      );

      // If approved, update teacher daily attendance status to ON_LEAVE for dates
      if (status === 'APPROVED') {
        const sStr = typeof app.start_date === 'string' ? app.start_date.split('T')[0] : new Date(app.start_date).toISOString().split('T')[0];
        const eStr = typeof app.end_date === 'string' ? app.end_date.split('T')[0] : new Date(app.end_date).toISOString().split('T')[0];
        const [sy, sm, sd] = sStr.split('-').map(Number);
        const [ey, em, ed] = eStr.split('-').map(Number);

        let cur = new Date(Date.UTC(sy, sm - 1, sd));
        const endDt = new Date(Date.UTC(ey, em - 1, ed));

        while (cur <= endDt) {
          const curStr = cur.toISOString().split('T')[0];
          await conn.query(
            `INSERT INTO teacher_daily_attendance (teacher_id, attendance_date, status, leave_application_id, recorded_reason, recorded_by)
             VALUES (?, ?, 'ON_LEAVE', ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = 'ON_LEAVE', leave_application_id = VALUES(leave_application_id), recorded_reason = VALUES(recorded_reason)`,
            [teacherId, curStr, applicationId, `Approved ${app.leave_category || 'Leave'}`, req.user!.id]
          );
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }

      const [users] = await conn.query<any[]>('SELECT id FROM users WHERE teacher_id = ?', [teacherId]);
      if (users.length > 0) {
        const userId = users[0].id;
        const [existingNotif] = await conn.query<any[]>(
          'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND related_id = ?',
          [userId, 'LEAVE_DECISION', applicationId]
        );
        if (existingNotif.length === 0) {
          const message = status === 'APPROVED' 
            ? `Your ${app.leave_category || 'leave'} application has been approved. Remarks: ${remarks || 'None'}`
            : `Your ${app.leave_category || 'leave'} application has been rejected. Remarks: ${remarks || 'None'}`;
          await conn.query(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
            [userId, 'Leave Application Update', message, 'LEAVE_DECISION', applicationId]
          );
        }
      }

      await conn.commit();

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'LEAVE_APPLICATION_DECIDED',
        targetType: 'LEAVE_APPLICATION',
        targetId: String(applicationId),
        ipAddress: req.ip || null,
        details: { status, remarks, leaveCategory: app.leave_category },
      });

      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      console.error('[Leave] Decision error:', err);
      res.status(500).json({ error: 'Failed to update application', code: 'DATABASE_ERROR' });
    } finally {
      conn.release();
    }
  }
);
