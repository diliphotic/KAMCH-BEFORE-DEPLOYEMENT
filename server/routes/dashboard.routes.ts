import { Router, Request, Response } from 'express';
import { getPool } from '../db.ts';
import { requireAuth, requirePasswordChangeClear } from '../middleware/auth.ts';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.use(requirePasswordChangeClear);

/**
 * GET /api/dashboard/stats
 * Provides role-tailored live database summary statistics for the Overview Dashboard.
 */
dashboardRouter.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const pool = getPool();

    const stats: Record<string, any> = {
      timestamp: new Date().toISOString(),
      role: user.role,
    };

    // 1. Core Institutional Counts (Students, Teachers, Departments, Users)
    try {
      const [stuRows] = await pool.query<any[]>(
        "SELECT COUNT(*) AS total FROM students WHERE status = 'ACTIVE'"
      );
      stats.studentCount = Number(stuRows?.[0]?.total || 0);
    } catch {
      stats.studentCount = 0;
    }

    try {
      const [tchRows] = await pool.query<any[]>(
        "SELECT COUNT(*) AS total FROM teachers WHERE status = 'ACTIVE'"
      );
      stats.teacherCount = Number(tchRows?.[0]?.total || 0);
    } catch {
      stats.teacherCount = 0;
    }

    try {
      const [deptRows] = await pool.query<any[]>(
        "SELECT COUNT(*) AS total FROM departments WHERE is_active = TRUE"
      );
      stats.departmentCount = Number(deptRows?.[0]?.total || 0);
    } catch {
      stats.departmentCount = 0;
    }

    if (['SUPER_ADMIN', 'PRINCIPAL', 'SECRETARY'].includes(user.role)) {
      try {
        const [usrRows] = await pool.query<any[]>(
          "SELECT COUNT(*) AS total FROM users WHERE is_deactivated = FALSE"
        );
        stats.userCount = Number(usrRows?.[0]?.total || 0);
      } catch {
        stats.userCount = 0;
      }
    }

    // 2. Fees Statistics (Authorized roles only)
    if (['SUPER_ADMIN', 'PRINCIPAL', 'SECRETARY', 'OFFICE', 'STAFF'].includes(user.role)) {
      try {
        const [feesRows] = await pool.query<any[]>(
          "SELECT SUM(amount) AS total FROM fee_collections WHERE is_verified = TRUE"
        );
        const [pendingRows] = await pool.query<any[]>(
          "SELECT COUNT(*) AS total FROM fee_collections WHERE payment_mode = 'BANK_TRANSFER' AND is_verified = FALSE"
        );
        stats.feeStats = {
          totalCollected: Number(feesRows?.[0]?.total || 0),
          pendingTransfersCount: Number(pendingRows?.[0]?.total || 0),
        };
      } catch {
        stats.feeStats = { totalCollected: 0, pendingTransfersCount: 0 };
      }
    }

    // 3. Internal Assessment & University Exam Stats
    if (['SUPER_ADMIN', 'PRINCIPAL', 'SECRETARY', 'OFFICE', 'STAFF', 'DEPARTMENT', 'HOD'].includes(user.role)) {
      try {
        const [iaRows] = await pool.query<any[]>(
          "SELECT COUNT(*) AS total FROM ia_office_approvals WHERE status = 'PENDING'"
        );
        stats.iaPendingOfficeApprovals = Number(iaRows?.[0]?.total || 0);
      } catch {
        stats.iaPendingOfficeApprovals = 0;
      }
    }

    if (['SUPER_ADMIN', 'PRINCIPAL', 'SECRETARY', 'OFFICE', 'STAFF'].includes(user.role)) {
      try {
        const [examRows] = await pool.query<any[]>(
          "SELECT COUNT(*) AS total FROM university_exam_results"
        );
        stats.univExamResultsCount = Number(examRows?.[0]?.total || 0);
      } catch {
        stats.univExamResultsCount = 0;
      }
    }

    // 4. Library Stats
    if (['SUPER_ADMIN', 'PRINCIPAL', 'SECRETARY', 'LIBRARY'].includes(user.role)) {
      try {
        const [bookRows] = await pool.query<any[]>(
          "SELECT SUM(total_copies) AS total_copies, SUM(available_copies) AS available_copies FROM library_books"
        );
        const [issueRows] = await pool.query<any[]>(
          "SELECT COUNT(*) AS total FROM library_issues WHERE status = 'ISSUED'"
        );
        const [overdueRows] = await pool.query<any[]>(
          "SELECT COUNT(*) AS total FROM library_issues WHERE status = 'ISSUED' AND due_date < CURDATE()"
        );
        stats.libraryStats = {
          totalBooks: Number(bookRows?.[0]?.total_copies || 0),
          availableCopies: Number(bookRows?.[0]?.available_copies || 0),
          activeIssues: Number(issueRows?.[0]?.total || 0),
          overdueCount: Number(overdueRows?.[0]?.total || 0),
        };
      } catch {
        stats.libraryStats = { totalBooks: 0, availableCopies: 0, activeIssues: 0, overdueCount: 0 };
      }
    }

    // 5. Leave & Attendance Stats
    if (['SUPER_ADMIN', 'PRINCIPAL', 'SECRETARY'].includes(user.role)) {
      try {
        const [leaveRows] = await pool.query<any[]>(
          "SELECT COUNT(*) AS total FROM teacher_leave_applications WHERE status = 'PENDING'"
        );
        const [absentRows] = await pool.query<any[]>(
          "SELECT COUNT(*) AS total FROM teacher_daily_attendance WHERE status = 'ABSENT' AND attendance_date = CURDATE()"
        );
        stats.leaveStats = {
          pendingLeaves: Number(leaveRows?.[0]?.total || 0),
          todayAbsences: Number(absentRows?.[0]?.total || 0),
        };
      } catch {
        stats.leaveStats = { pendingLeaves: 0, todayAbsences: 0 };
      }
    }

    // 6. Faculty Specific Leave Balance Stats
    if (user.role === 'FACULTY' && user.teacherId) {
      try {
        const [appRows] = await pool.query<any[]>(
          "SELECT COUNT(*) AS total FROM teacher_leave_applications WHERE teacher_id = ? AND status = 'PENDING'",
          [user.teacherId]
        );
        stats.facultyStats = {
          pendingApplications: Number(appRows?.[0]?.total || 0),
        };
      } catch {
        stats.facultyStats = { pendingApplications: 0 };
      }
    }

    res.json(stats);
  } catch (err) {
    console.error('[KAMCH Dashboard] Error fetching stats:', (err as Error).message);
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics', code: 'DATABASE_ERROR' });
  }
});
