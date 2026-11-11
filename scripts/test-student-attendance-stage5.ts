import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';
import bcrypt from 'bcryptjs';
import fetch from 'node-fetch';
import { getPool, checkDatabaseConnection } from '../server/db.ts';
import { authRouter } from '../server/routes/auth.routes.ts';
import { attendanceRouter } from '../server/routes/attendance.routes.ts';

function extractCookies(res: any): { session: string; csrf: string } {
  const getSetCookie = (res.headers as any).getSetCookie;
  const rawList: string[] =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(res.headers)
      : (res.headers.get('set-cookie') || '').split(/,(?=\s*kamch_)/);

  let session = '';
  let csrf = '';
  for (const item of rawList) {
    const pair = item.split(';')[0].trim();
    if (pair.startsWith('kamch_session=')) session = pair;
    if (pair.startsWith('kamch_csrf=')) csrf = pair.replace('kamch_csrf=', '');
  }
  return { session, csrf };
}

async function runStage5Tests() {
  console.log('================================================================');
  console.log('KAMCH ERP — STAGE 5: STUDENT-WISE ATTENDANCE HISTORY VERIFICATION');
  console.log('================================================================\n');

  await checkDatabaseConnection();
  const pool = getPool();

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

  // Setup Express server
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/attendance', attendanceRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Setup test users for Office & Faculty
    console.log('--- 1. Setting Up Authenticated Roles & Logins ---');
    const [roles] = await pool.query<any[]>('SELECT id, code FROM roles');
    const officeRole = roles.find((r) => r.code === 'OFFICE');
    const facultyRole = roles.find((r) => r.code === 'FACULTY');

    if (!officeRole || !facultyRole) {
      throw new Error('Required roles missing from database.');
    }

    const testPassword = 'PasswordTest123!';
    const pwdHash = await bcrypt.hash(testPassword, 10);

    const memDb = (await import('../server/services/memory-db.ts')).MemoryDatabase.getInstance();
    memDb.users = memDb.users.filter((u: any) => ![995, 996].includes(u.id));

    memDb.users.push(
      {
        id: 995,
        username: 'test_office_stage5',
        email: 'office_stage5@kamch.ac.in',
        password_hash: pwdHash,
        full_name: 'Office Admin Stage5',
        role_id: officeRole.id,
        department_id: null,
        teacher_id: null,
        must_change_password: false,
        failed_attempts: 0,
        is_locked: false,
        locked_at: null,
        is_suspended: false,
        suspended_at: null,
        suspension_reason: null,
        is_deactivated: false,
        deactivated_at: null,
        deactivation_reason: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 996,
        username: 'test_faculty_stage5',
        email: 'faculty_stage5@kamch.ac.in',
        password_hash: pwdHash,
        full_name: 'Faculty Stage5',
        role_id: facultyRole.id,
        department_id: null,
        teacher_id: null,
        must_change_password: false,
        failed_attempts: 0,
        is_locked: false,
        locked_at: null,
        is_suspended: false,
        suspended_at: null,
        suspension_reason: null,
        is_deactivated: false,
        deactivated_at: null,
        deactivation_reason: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    // Login Office Admin
    const officeLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'test_office_stage5', password: testPassword }),
    });
    const officeAuth = extractCookies(officeLoginRes);

    // Login Faculty
    const facultyLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'test_faculty_stage5', password: testPassword }),
    });
    const facultyAuth = extractCookies(facultyLoginRes);

    assert(Boolean(officeAuth.session), 'Office user login successful with session cookie');
    assert(Boolean(facultyAuth.session), 'Faculty user login successful with session cookie');

    // 2. Clean & Seed Test Data (Batch 901, Students 701-705, Timetable & Sessions)
    console.log('\n--- 2. Seeding Test Batch, Students & Attendance Sessions ---');
    await pool.query('DELETE FROM attendance_absences');
    await pool.query('DELETE FROM attendance_sessions');
    await pool.query('DELETE FROM attendance_timetable_slots');
    await pool.query('DELETE FROM attendance_timetable_versions');
    await pool.query('DELETE FROM sub_batch_students');
    await pool.query('DELETE FROM sub_batches');

    // Ensure Batch 901 in memDb
    const existingBatch = memDb.academicBatches.find((b: any) => b.id === 901);
    if (!existingBatch) {
      memDb.academicBatches.push({
        id: 901,
        code: 'BAMS-TEST-2024',
        name: 'Batch 2024-25 Test',
        admission_academic_year: '2024-2025',
        admission_year_start: 2024,
        course_name: 'BAMS',
        scheme_id: 1,
        current_cohort_stage: 'I_PROF',
        current_professional_year: 1,
        junior_batch_id: null,
        admission_status: 'IN_PROGRESS',
        is_active: true,
        display_order: 1,
        notes: null,
        created_by: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Ensure Subjects 801, 802 in memDb
    if (!memDb.iaSubjects.find((s: any) => s.id === 801)) {
      memDb.iaSubjects.push(
        { id: 801, code: 'AY-101', name: 'Samhita Siddhanta', professional_year: 1, ia_maximum: 50, is_active: true } as any,
        { id: 802, code: 'AY-102', name: 'Rachana Sharira', professional_year: 1, ia_maximum: 50, is_active: true } as any
      );
    }

    // Ensure Students 701-705 in memDb
    memDb.students = memDb.students.filter((st: any) => st.id < 701 || st.id > 705);
    memDb.students.push(
      { id: 701, student_id_number: 'KAMCH/2024/001', temporary_roll_number: '01', permanent_university_number: 'U24001', full_name: 'Aditya Sharma', original_batch_id: 901, current_placement_batch_id: 901, status: 'ACTIVE' } as any,
      { id: 702, student_id_number: 'KAMCH/2024/002', temporary_roll_number: '02', permanent_university_number: 'U24002', full_name: 'Bhavna Patel', original_batch_id: 901, current_placement_batch_id: 901, status: 'ACTIVE' } as any,
      { id: 703, student_id_number: 'KAMCH/2024/003', temporary_roll_number: '03', permanent_university_number: 'U24003', full_name: 'Chetan Verma', original_batch_id: 901, current_placement_batch_id: 901, status: 'ACTIVE' } as any,
      { id: 704, student_id_number: 'KAMCH/2024/004', temporary_roll_number: '04', permanent_university_number: 'U24004', full_name: 'Divya Joshi', original_batch_id: 901, current_placement_batch_id: 901, status: 'ACTIVE' } as any,
      { id: 705, student_id_number: 'KAMCH/2024/005', temporary_roll_number: '05', permanent_university_number: 'U24005', full_name: 'Eshan Kumar', original_batch_id: 901, current_placement_batch_id: 901, status: 'ACTIVE' } as any
    );

    // Create Sub-Batch A for Students 701-703
    const [subBatchRes]: any = await pool.query(
      `INSERT INTO sub_batches (batch_id, code, name, description)
       VALUES (901, 'A', 'Sub-Batch A (Roll 1-3)', 'Roll 01 to 03')`
    );
    const subBatchAId = subBatchRes.insertId || subBatchRes.id;

    await pool.query(
      `INSERT INTO sub_batch_students (sub_batch_id, student_id)
       VALUES (?, 701), (?, 702), (?, 703)`,
      [subBatchAId, subBatchAId, subBatchAId]
    );

    // Create Timetable Version & Slots
    const [verRes]: any = await pool.query(
      `INSERT INTO attendance_timetable_versions (batch_id, version_code, title, effective_from, effective_to, is_active, created_by)
       VALUES (901, 'VER-STAGE5-01', 'Stage 5 Test Schedule', '2026-10-01', NULL, TRUE, 995)`
    );
    const versionId = verRes.insertId || verRes.id;

    // Slot 1: Whole Batch LT (Mon 10:00 - 11:00)
    const [slot1Res]: any = await pool.query(
      `INSERT INTO attendance_timetable_slots (timetable_version_id, weekday, start_time, end_time, subject_id, class_type, sub_batch_id, week_pattern)
       VALUES (?, 'MONDAY', '10:00', '11:00', 801, 'LT', NULL, 'EVERY_WEEK')`,
      [versionId]
    );
    const slot1Id = slot1Res.insertId || slot1Res.id;

    // Slot 2: Sub-Batch A NLP (Mon 11:00 - 13:00)
    const [slot2Res]: any = await pool.query(
      `INSERT INTO attendance_timetable_slots (timetable_version_id, weekday, start_time, end_time, subject_id, class_type, sub_batch_id, week_pattern)
       VALUES (?, 'MONDAY', '11:00', '13:00', 802, 'NLP', ?, 'EVERY_WEEK')`,
      [versionId, subBatchAId]
    );
    const slot2Id = slot2Res.insertId || slot2Res.id;

    // Record Session 1 on 2026-10-05 (Slot 1) - Student 701 absent, Student 702 present
    const [sess1Res]: any = await pool.query(
      `INSERT INTO attendance_sessions (batch_id, slot_id, timetable_version_id, sub_batch_id, attendance_date, created_by)
       VALUES (901, ?, ?, NULL, '2026-10-05', 995)`,
      [slot1Id, versionId]
    );
    const sess1Id = sess1Res.insertId || sess1Res.id;

    await pool.query(
      `INSERT INTO attendance_absences (session_id, student_id, recorded_by)
       VALUES (?, 701, 995)`,
      [sess1Id]
    );

    // Record Session 2 on 2026-10-05 (Slot 2, Sub-Batch A) - Student 701 present, Student 702 absent
    const [sess2Res]: any = await pool.query(
      `INSERT INTO attendance_sessions (batch_id, slot_id, timetable_version_id, sub_batch_id, attendance_date, created_by)
       VALUES (901, ?, ?, ?, '2026-10-05', 995)`,
      [slot2Id, versionId, subBatchAId]
    );
    const sess2Id = sess2Res.insertId || sess2Res.id;

    await pool.query(
      `INSERT INTO attendance_absences (session_id, student_id, recorded_by)
       VALUES (?, 702, 995)`,
      [sess2Id]
    );

    // 3. Security Check (FACULTY -> 403)
    console.log('\n--- 3. Security & Role Permissions Check ---');
    const facultyAccessRes = await fetch(`${baseUrl}/api/attendance/reports/student/history?studentId=701`, {
      headers: { Cookie: facultyAuth.session, 'x-csrf-token': facultyAuth.csrf },
    });
    assert(facultyAccessRes.status === 403, 'FACULTY role denied access (403 Forbidden) to student history endpoint');

    // 4. Student History Querying Test (Student 701)
    console.log('\n--- 4. Student History Querying & Data Integrity ---');
    const historyRes = await fetch(
      `${baseUrl}/api/attendance/reports/student/history?studentId=701&batchId=901`,
      {
        headers: { Cookie: officeAuth.session, 'x-csrf-token': officeAuth.csrf },
      }
    );
    assert(historyRes.status === 200, 'OFFICE role granted access (200 OK) to student history endpoint');

    const historyData: any = await historyRes.json();
    assert(historyData.success === true, 'Student history API returns success: true');
    assert(Boolean(historyData.student), 'Response contains student profile object');
    assert(historyData.student?.rollNumber === '01', 'Student roll number matches temporary roll number (01)');
    assert(historyData.student?.name === 'Aditya Sharma', 'Student name matches (Aditya Sharma)');
    assert(historyData.student?.studentIdNumber === 'KAMCH/2024/001', 'Student ID number matches (KAMCH/2024/001)');
    assert(historyData.student?.permanentUniversityNumber === 'U24001', 'Permanent University Reg No matches (U24001)');
    assert(historyData.student?.subBatches?.length === 1, 'Assigned sub-batches list has 1 item (Sub-Batch A)');

    assert(Boolean(historyData.summary), 'Response contains attendance summary metrics');
    assert(historyData.summary?.totalEligibleSessions === 2, 'Summary totalEligibleSessions === 2');
    assert(historyData.summary?.presentCount === 1, 'Summary presentCount === 1');
    assert(historyData.summary?.absentCount === 1, 'Summary absentCount === 1');

    const sumMatches =
      historyData.summary.presentCount + historyData.summary.absentCount === historyData.summary.totalEligibleSessions;
    assert(sumMatches, 'Summary invariant holds: presentCount + absentCount === totalEligibleSessions');

    assert(Array.isArray(historyData.history) && historyData.history.length === 2, 'Response contains 2 chronological session items');

    if (historyData.history.length === 2) {
      const item1 = historyData.history[0]; // Session 1: Whole Batch LT
      const item2 = historyData.history[1]; // Session 2: Sub-Batch A NLP

      assert(item1.status === 'ABSENT', 'Session 1 status is ABSENT for Student 701');
      assert(item2.status === 'PRESENT', 'Session 2 status is PRESENT for Student 701');
      assert(item1.classType === 'LT', 'Session 1 class type is LT');
      assert(item2.classType === 'NLP', 'Session 2 class type is NLP');
      assert(item2.subBatchCode === 'A', 'Session 2 sub-batch code is A');
    }

    // 5. Date Range & Subject Filtering Test
    console.log('\n--- 5. Date Range & Subject Filtering Test ---');
    const filteredRes = await fetch(
      `${baseUrl}/api/attendance/reports/student/history?studentId=701&batchId=901&fromDate=2026-10-01&toDate=2026-10-31&subjectId=801`,
      {
        headers: { Cookie: officeAuth.session, 'x-csrf-token': officeAuth.csrf },
      }
    );
    const filteredData: any = await filteredRes.json();
    assert(filteredData.success === true, 'Filtered student history API returns success: true');
    assert(filteredData.history?.length === 1, 'Subject filter (801) returns exactly 1 session entry');
    assert(filteredData.history?.[0]?.subjectCode === 'AY-101', 'Returned filtered subject code is AY-101');

  } catch (err: any) {
    console.error('Test execution error:', err.message);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage5Tests();
