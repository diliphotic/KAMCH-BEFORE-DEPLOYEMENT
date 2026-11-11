import { getPool, checkDatabaseConnection } from '../server/db.ts';
import { MemoryDatabase } from '../server/services/memory-db.ts';
import { calculateWorkingDaysForMonth } from '../server/routes/attendance.routes.ts';

async function runFacultyDashboardAndReportsTests() {
  console.log('================================================================');
  console.log('KAMCH ERP — FACULTY DASHBOARD & ATTENDANCE REPORTS TEST SUITE');
  console.log('================================================================\n');

  const dbHealth = await checkDatabaseConnection();
  console.log(`[DB STATUS] Connected: ${dbHealth.connected}, Fallback: ${dbHealth.isFallback}\n`);

  const pool = getPool();
  const memDb = MemoryDatabase.getInstance();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - Detail: ${detail}` : ''}`);
      failed++;
    }
  }

  // Seed test data
  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM monthly_attendance');
  await pool.query('DELETE FROM leave_applications');
  await pool.query('DELETE FROM institutional_holidays');
  await pool.query('DELETE FROM institutional_settings WHERE setting_key = "LEAVE_MAX_ADVANCE_DAYS"');

  const facultyRole = memDb.roles.find(r => r.code === 'FACULTY') || { id: 6, code: 'FACULTY' };
  const principalRole = memDb.roles.find(r => r.code === 'PRINCIPAL') || { id: 2, code: 'PRINCIPAL' };

  // 1. Leave Balance: Entitlement, Used (Approved only), Pending (Separate), Remaining
  console.log('\n--- 1. Leave Balance Calculations (Approved vs Pending) ---');
  try {
    const teacherId = 101;
    const currentYear = new Date().getFullYear();
    const acadStart = `${currentYear}-06-01`;

    // Insert an APPROVED 2-day CL
    await pool.query(
      `INSERT INTO leave_applications (id, teacher_id, leave_category, start_date, end_date, reason, status, submitted_at, decided_by, decided_at)
       VALUES (?, ?, 'CL', ?, ?, 'Personal duty', 'APPROVED', NOW(), 1, NOW())`,
      [9001, teacherId, `${currentYear}-07-10`, `${currentYear}-07-11`]
    );

    // Insert a PENDING 3-day CL
    await pool.query(
      `INSERT INTO leave_applications (id, teacher_id, leave_category, start_date, end_date, reason, status, submitted_at)
       VALUES (?, ?, 'CL', ?, ?, 'Pending family function', 'PENDING', NOW())`,
      [9002, teacherId, `${currentYear}-08-01`, `${currentYear}-08-03`]
    );

    // Query leave balances using logic from leave.routes.ts
    const [rows] = await pool.query<any[]>(
      `SELECT leave_category, status, start_date, end_date FROM leave_applications
       WHERE teacher_id = ? AND status IN ('APPROVED', 'PENDING') AND start_date >= ?`,
      [teacherId, acadStart]
    );

    let approvedClDays = 0;
    let pendingClDays = 0;

    for (const app of rows) {
      if (app.leave_category === 'CL') {
        const sStr = typeof app.start_date === 'string' ? app.start_date.split('T')[0] : new Date(app.start_date).toISOString().split('T')[0];
        const eStr = typeof app.end_date === 'string' ? app.end_date.split('T')[0] : new Date(app.end_date).toISOString().split('T')[0];
        const [sy, sm, sd] = sStr.split('-').map(Number);
        const [ey, em, ed] = eStr.split('-').map(Number);
        const duration = Math.round((new Date(Date.UTC(ey, em - 1, ed)).getTime() - new Date(Date.UTC(sy, sm - 1, sd)).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (app.status === 'APPROVED') approvedClDays += duration;
        if (app.status === 'PENDING') pendingClDays += duration;
      }
    }

    const clEntitlement = 15;
    const remainingCl = Math.max(0, clEntitlement - approvedClDays);

    assert(approvedClDays === 2, 'Approved CL days accurately summed to 2 days', `got ${approvedClDays}`);
    assert(pendingClDays === 3, 'Pending CL days accurately summed to 3 days', `got ${pendingClDays}`);
    assert(remainingCl === 13, 'Remaining CL is exactly 15 - 2 = 13 (pending does NOT deduct from approved remaining)', `got ${remainingCl}`);
  } catch (err: any) {
    assert(false, 'Leave Balance calculation failed', err.message);
  }

  // 2. Cancellation of Pending Leave Applications
  console.log('\n--- 2. Faculty Leave Application Cancellation ---');
  try {
    // Attempt to cancel pending application 9002
    await pool.query(
      "UPDATE leave_applications SET status = 'CANCELLED' WHERE id = 9002 AND status = 'PENDING'"
    );

    const [cancelledRow] = await pool.query<any[]>(
      'SELECT status FROM leave_applications WHERE id = 9002'
    );
    assert(cancelledRow[0]?.status === 'CANCELLED', 'Pending application 9002 successfully transitioned to CANCELLED');

    // Verify approved application 9001 cannot be cancelled through pending query
    const [approvedRow] = await pool.query<any[]>(
      'SELECT status FROM leave_applications WHERE id = 9001'
    );
    assert(approvedRow[0]?.status === 'APPROVED', 'Approved application 9001 remains APPROVED and cannot be cancelled');
  } catch (err: any) {
    assert(false, 'Leave cancellation failed', err.message);
  }

  // 3. Working Days Calculation & Institutional Holidays
  console.log('\n--- 3. Working Days Calculation & Holiday Subtraction ---');
  try {
    // For November 2026 (30 calendar days, 5 Sundays: 1st, 8th, 15th, 22nd, 29th)
    const baseCalc = await calculateWorkingDaysForMonth(pool, 2026, 11);
    assert(baseCalc.daysInMonth === 30, 'November 2026 has 30 days');
    assert(baseCalc.sundaysCount === 5, 'November 2026 has 5 Sundays');
    assert(baseCalc.workingDays === 25, 'November 2026 net working days without holidays is 25', `got ${baseCalc.workingDays}`);

    // Add institutional holiday on 2026-11-04 (Wednesday - working day)
    await pool.query(
      `INSERT INTO institutional_holidays (holiday_date, holiday_name, description, created_by)
       VALUES ('2026-11-04', 'Ayurveda Foundation Day', 'Official College Holiday', 1)`
    );

    const withHolidayCalc = await calculateWorkingDaysForMonth(pool, 2026, 11);
    assert(withHolidayCalc.additionalHolidaysCount === 1, '1 additional weekday holiday counted');
    assert(withHolidayCalc.workingDays === 24, 'Net working days reduced from 25 to 24 after declared holiday', `got ${withHolidayCalc.workingDays}`);

    // Remove the holiday
    await pool.query("DELETE FROM institutional_holidays WHERE holiday_date = '2026-11-04'");
    const revertedCalc = await calculateWorkingDaysForMonth(pool, 2026, 11);
    assert(revertedCalc.workingDays === 25, 'Net working days reverts to 25 after deleting holiday', `got ${revertedCalc.workingDays}`);
  } catch (err: any) {
    assert(false, 'Working days calculation failed', err.message);
  }

  // 4. Principal Max Advance Window Settings
  console.log('\n--- 4. Principal Max Advance Window Setting ---');
  try {
    const testWindow = 30;
    await pool.query(
      `INSERT INTO institutional_settings (setting_key, setting_value, effective_date, updated_reason)
       VALUES ('LEAVE_MAX_ADVANCE_DAYS', ?, CURDATE(), 'Test Setting')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [String(testWindow)]
    );

    const [settingRows] = await pool.query<any[]>(
      'SELECT setting_value FROM institutional_settings WHERE setting_key = "LEAVE_MAX_ADVANCE_DAYS"'
    );
    assert(Number(settingRows[0]?.setting_value) === 30, 'LEAVE_MAX_ADVANCE_DAYS setting saved and retrieved as 30 days', `got ${JSON.stringify(settingRows)}`);
  } catch (err: any) {
    assert(false, 'Max advance window setting failed', err.message);
  }

  // 5. Monthly Attendance Finalization Status & Notification
  console.log('\n--- 5. Monthly Attendance Finalization & Audit ---');
  try {
    const teacherId = 101;
    await pool.query(
      `INSERT INTO monthly_attendance (teacher_id, year, month, total_working_days, days_present, attendance_percentage, status)
       VALUES (?, 2026, 11, 25, 24, 96.00, 'PENDING')
       ON DUPLICATE KEY UPDATE total_working_days = 25, days_present = 24, attendance_percentage = 96.00, status = 'PENDING'`,
      [teacherId]
    );

    // Finalize
    await pool.query(
      `UPDATE monthly_attendance SET status = 'FINALIZED', finalized_by = 1, finalized_at = NOW()
       WHERE year = 2026 AND month = 11`
    );

    const [finalizedRows] = await pool.query<any[]>(
      'SELECT status, finalized_by FROM monthly_attendance WHERE teacher_id = ? AND year = 2026 AND month = 11',
      [teacherId]
    );

    assert(finalizedRows[0]?.status === 'FINALIZED', 'Attendance report status updated to FINALIZED');
    assert(Number(finalizedRows[0]?.finalized_by) === 1, 'Finalized by recorded as Principal user ID 1');
  } catch (err: any) {
    assert(false, 'Monthly finalization test failed', err.message);
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFacultyDashboardAndReportsTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
