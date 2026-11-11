import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';
import bcrypt from 'bcryptjs';
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

async function runStage4Tests() {
  console.log('================================================================');
  console.log('KAMCH ERP — STAGE 4: STUDENT ATTENDANCE REPORTS VERIFICATION');
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

  // Setup Express app with cookieParser, authRouter, and attendanceRouter
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
    // 1. Setup roles, users and sessions
    console.log('\n--- 1. Setting Up Authenticated Roles & Logins ---');
    const [roles] = await pool.query<any[]>('SELECT id, code FROM roles');
    const officeRole = roles.find((r) => r.code === 'OFFICE');
    const facultyRole = roles.find((r) => r.code === 'FACULTY');
    const principalRole = roles.find((r) => r.code === 'PRINCIPAL');

    if (!officeRole || !facultyRole || !principalRole) {
      throw new Error('Required roles missing from database.');
    }

    const testPassword = 'PasswordTest123!';
    const pwdHash = await bcrypt.hash(testPassword, 10);

    const memDb = (await import('../server/services/memory-db.ts')).MemoryDatabase.getInstance();
    memDb.users = memDb.users.filter((u: any) => ![991, 992, 993].includes(u.id));

    memDb.users.push(
      {
        id: 991,
        username: 'test_office_stage4',
        email: 'office_stage4@kamch.ac.in',
        password_hash: pwdHash,
        full_name: 'Office Admin Test',
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
        id: 992,
        username: 'test_faculty_stage4',
        email: 'faculty_stage4@kamch.ac.in',
        password_hash: pwdHash,
        full_name: 'Faculty Test',
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
      },
      {
        id: 993,
        username: 'test_principal_stage4',
        email: 'principal_stage4@kamch.ac.in',
        password_hash: pwdHash,
        full_name: 'Principal Test',
        role_id: principalRole.id,
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

    // Perform real logins via POST /api/auth/login
    const offLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'test_office_stage4', password: testPassword }),
    });
    const officeCookies = extractCookies(offLoginRes);
    const officeHeaders = { Cookie: officeCookies.session };

    const facLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'test_faculty_stage4', password: testPassword }),
    });
    const facultyCookies = extractCookies(facLoginRes);
    const facultyHeaders = { Cookie: facultyCookies.session };

    const princLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'test_principal_stage4', password: testPassword }),
    });
    const principalCookies = extractCookies(princLoginRes);
    const principalHeaders = { Cookie: principalCookies.session };

    assert(Boolean(officeCookies.session), 'Office user logged in successfully');
    assert(Boolean(facultyCookies.session), 'Faculty user logged in successfully');
    assert(Boolean(principalCookies.session), 'Principal user logged in successfully');

    // 2. Clean & Seed data for testing
    console.log('\n--- 2. Setting Up Test Academic Batch, Timetable & Attendance Sessions ---');

    await pool.query('DELETE FROM attendance_absences');
    await pool.query('DELETE FROM attendance_sessions');
    await pool.query('DELETE FROM attendance_timetable_slots');
    await pool.query('DELETE FROM attendance_timetable_versions');
    await pool.query('DELETE FROM sub_batch_students');
    await pool.query('DELETE FROM sub_batches');

    // Ensure curriculum scheme
    await pool.query(
      `INSERT INTO curriculum_schemes (id, code, name, total_duration_years, status)
       VALUES (1, 'NCISM-2021', 'NCISM BAMS 2021 Scheme', 5.5, 'ACTIVE')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`
    );

    // Ensure batch 901 in memDb
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

    // Ensure subjects in memDb
    const s801 = memDb.iaSubjects.find((s: any) => s.id === 801);
    if (!s801) {
      memDb.iaSubjects.push(
        { id: 801, code: 'AY-101', name: 'Samhita Siddhanta', professional_year: 1, ia_maximum: 50, is_active: true } as any,
        { id: 802, code: 'AY-102', name: 'Rachana Sharira', professional_year: 1, ia_maximum: 50, is_active: true } as any
      );
    }

    // Ensure students in batch 901
    memDb.students = memDb.students.filter(
      (st: any) => st.original_batch_id !== 901 && st.current_placement_batch_id !== 901
    );
    memDb.students.push(
      { id: 701, student_id_number: 'KAMCH/2024/001', temporary_roll_number: '01', permanent_university_number: 'U24001', full_name: 'Aditya Sharma', original_batch_id: 901, current_placement_batch_id: 901, status: 'ACTIVE' } as any,
      { id: 702, student_id_number: 'KAMCH/2024/002', temporary_roll_number: '02', permanent_university_number: 'U24002', full_name: 'Bhavna Patel', original_batch_id: 901, current_placement_batch_id: 901, status: 'ACTIVE' } as any,
      { id: 703, student_id_number: 'KAMCH/2024/003', temporary_roll_number: '03', permanent_university_number: 'U24003', full_name: 'Chetan Verma', original_batch_id: 901, current_placement_batch_id: 901, status: 'ACTIVE' } as any,
      { id: 704, student_id_number: 'KAMCH/2024/004', temporary_roll_number: '04', permanent_university_number: 'U24004', full_name: 'Divya Joshi', original_batch_id: 901, current_placement_batch_id: 901, status: 'ACTIVE' } as any,
      { id: 705, student_id_number: 'KAMCH/2024/005', temporary_roll_number: '05', permanent_university_number: 'U24005', full_name: 'Eshan Kumar', original_batch_id: 901, current_placement_batch_id: 901, status: 'ACTIVE' } as any
    );

    // Insert Sub-batch A
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

    // Create Timetable Version effective from 2026-10-01
    const [verRes]: any = await pool.query(
      `INSERT INTO attendance_timetable_versions (batch_id, version_code, title, effective_from, effective_to, is_active, created_by)
       VALUES (901, 'VER-TEST-01', 'Test First Prof Schedule', '2026-10-01', NULL, TRUE, 991)`
    );
    const versionId = verRes.insertId || verRes.id;

    // Create Slots:
    // Slot 1: Monday 10:00 - 11:00 AY-101 (LT, Whole Batch)
    // Slot 2: Monday 11:00 - 13:00 AY-102 (NLP, Sub-batch A)
    // Slot 3: Tuesday 10:00 - 11:00 AY-101 (NLT, Whole Batch)
    const [slot1Res]: any = await pool.query(
      `INSERT INTO attendance_timetable_slots (timetable_version_id, weekday, start_time, end_time, subject_id, class_type, sub_batch_id, week_pattern, location_or_room)
       VALUES (?, 'MONDAY', '10:00', '11:00', 801, 'LT', NULL, 'EVERY_WEEK', 'Hall 1')`,
      [versionId]
    );
    const slot1Id = slot1Res.insertId || slot1Res.id;

    const [slot2Res]: any = await pool.query(
      `INSERT INTO attendance_timetable_slots (timetable_version_id, weekday, start_time, end_time, subject_id, class_type, sub_batch_id, week_pattern, location_or_room)
       VALUES (?, 'MONDAY', '11:00', '13:00', 802, 'NLP', ?, 'EVERY_WEEK', 'Dissection Lab')`,
      [versionId, subBatchAId]
    );
    const slot2Id = slot2Res.insertId || slot2Res.id;

    const [slot3Res]: any = await pool.query(
      `INSERT INTO attendance_timetable_slots (timetable_version_id, weekday, start_time, end_time, subject_id, class_type, sub_batch_id, week_pattern, location_or_room)
       VALUES (?, 'TUESDAY', '10:00', '11:00', 801, 'NLT', NULL, 'EVERY_WEEK', 'Hall 2')`,
      [versionId]
    );
    const slot3Id = slot3Res.insertId || slot3Res.id;

    // Record attendance on Monday 2026-10-05:
    // For Slot 1 (Whole Batch, 5 eligible): Student 702 and 704 absent (3 present, 2 absent)
    const [sess1Res]: any = await pool.query(
      `INSERT INTO attendance_sessions (timetable_version_id, slot_id, batch_id, sub_batch_id, attendance_date, created_by, updated_by)
       VALUES (?, ?, 901, NULL, '2026-10-05', 991, 991)`,
      [versionId, slot1Id]
    );
    const sess1Id = sess1Res.insertId || sess1Res.id;

    await pool.query(
      `INSERT INTO attendance_absences (session_id, student_id)
       VALUES (?, 702), (?, 704)`,
      [sess1Id, sess1Id]
    );

    // For Slot 2 (Sub-Batch A, 3 eligible): Student 703 absent (2 present, 1 absent)
    const [sess2Res]: any = await pool.query(
      `INSERT INTO attendance_sessions (timetable_version_id, slot_id, batch_id, sub_batch_id, attendance_date, created_by, updated_by)
       VALUES (?, ?, 901, ?, '2026-10-05', 991, 991)`,
      [versionId, slot2Id, subBatchAId]
    );
    const sess2Id = sess2Res.insertId || sess2Res.id;

    await pool.query(
      `INSERT INTO attendance_absences (session_id, student_id)
       VALUES (?, 703)`,
      [sess2Id]
    );

    // Tuesday 2026-10-06: Slot 3 is scheduled, but NO attendance is recorded!
    console.log('[PASS] Test academic batch, timetable, and attendance sessions seeded.');

    // 3. Test Role Permissions
    console.log('\n--- 3. Role Permissions Check ---');
    const facRes = await fetch(`${baseUrl}/api/attendance/reports/student/register?batchId=901&fromDate=2026-10-01&toDate=2026-10-07`, {
      headers: facultyHeaders,
    });
    assert(facRes.status === 403, 'FACULTY role is blocked with 403 Forbidden on reports endpoints');

    const offRes = await fetch(`${baseUrl}/api/attendance/reports/student/register?batchId=901&fromDate=2026-10-01&toDate=2026-10-07`, {
      headers: officeHeaders,
    });
    const offText = await offRes.text();
    console.log('offRes status:', offRes.status, 'body:', offText);
    assert(offRes.status === 200, 'OFFICE role can access reports endpoints');

    const princRes = await fetch(`${baseUrl}/api/attendance/reports/student/register?batchId=901&fromDate=2026-10-01&toDate=2026-10-07`, {
      headers: principalHeaders,
    });
    assert(princRes.status === 200, 'PRINCIPAL role can access reports endpoints');

    // 4. Test Date Validation
    console.log('\n--- 4. Filter Validation Check ---');
    const invalidDateOrder = await fetch(`${baseUrl}/api/attendance/reports/student/register?batchId=901&fromDate=2026-10-10&toDate=2026-10-05`, {
      headers: officeHeaders,
    });
    assert(invalidDateOrder.status === 400, 'Rejects fromDate after toDate with 400 Bad Request');

    const wideRange = await fetch(`${baseUrl}/api/attendance/reports/student/register?batchId=901&fromDate=2026-01-01&toDate=2026-06-01`, {
      headers: officeHeaders,
    });
    assert(wideRange.status === 400, 'Rejects date ranges > 93 days with 400 Bad Request');

    // 5. Test Date-Wise Register Generation & Stats
    console.log('\n--- 5. Date-Wise Register Integrity & Unrecorded Session Distinction ---');
    const regRes = await fetch(`${baseUrl}/api/attendance/reports/student/register?batchId=901&fromDate=2026-10-05&toDate=2026-10-06`, {
      headers: officeHeaders,
    });
    const regData = await regRes.json();

    assert(regData.success === true, 'Successfully fetched date-wise register report');
    assert(regData.items.length === 3, 'Found exactly 3 scheduled classes (2 on Monday 10-05, 1 on Tuesday 10-06)', `Got ${regData.items.length}`);

    const slot1Item = regData.items.find((i: any) => i.date === '2026-10-05' && i.slotId === slot1Id);
    assert(slot1Item?.status === 'RECORDED', 'Slot 1 status is RECORDED');
    assert(slot1Item?.eligibleCount === 5, 'Slot 1 eligible count is 5 (whole batch)');
    assert(slot1Item?.absentCount === 2, 'Slot 1 absent count is 2');
    assert(slot1Item?.presentCount === 3, 'Slot 1 present count is 3 (5 - 2)');
    assert(slot1Item?.absentStudents.length === 2, 'Slot 1 absent student list contains 2 records');
    assert(slot1Item?.absentStudents[0]?.rollNumber === '02', 'Absent student roll number 02 captured correctly');

    const slot2Item = regData.items.find((i: any) => i.date === '2026-10-05' && i.slotId === slot2Id);
    assert(slot2Item?.status === 'RECORDED', 'Slot 2 (Sub-Batch A) status is RECORDED');
    assert(slot2Item?.eligibleCount === 3, 'Slot 2 eligible count is 3 (Sub-Batch A students)');
    assert(slot2Item?.absentCount === 1, 'Slot 2 absent count is 1');
    assert(slot2Item?.presentCount === 2, 'Slot 2 present count is 2 (3 - 1)');

    const slot3Item = regData.items.find((i: any) => i.date === '2026-10-06' && i.slotId === slot3Id);
    assert(slot3Item?.status === 'NOT_RECORDED', 'Slot 3 (Tuesday) is marked NOT_RECORDED');
    assert(slot3Item?.presentCount === null, 'CRITICAL: Slot 3 presentCount is null (never falsely reports present students)');
    assert(slot3Item?.absentCount === null, 'Slot 3 absentCount is null');

    // 6. Test Filters (Subject, Class Type, Sub-batch)
    console.log('\n--- 6. Subject, Class Type, and Sub-Batch Filters ---');
    const subjFilterRes = await fetch(`${baseUrl}/api/attendance/reports/student/register?batchId=901&fromDate=2026-10-05&toDate=2026-10-06&subjectId=802`, {
      headers: officeHeaders,
    });
    const subjFilterData = await subjFilterRes.json();
    assert(subjFilterData.items.length === 1 && subjFilterData.items[0].subjectId === 802, 'Subject filter returns only subject 802 classes');

    const classTypeFilterRes = await fetch(`${baseUrl}/api/attendance/reports/student/register?batchId=901&fromDate=2026-10-05&toDate=2026-10-06&classType=NLP`, {
      headers: officeHeaders,
    });
    const classTypeFilterData = await classTypeFilterRes.json();
    assert(classTypeFilterData.items.length === 1 && classTypeFilterData.items[0].classType === 'NLP', 'Class type filter returns only NLP classes');

    const subBatchFilterRes = await fetch(`${baseUrl}/api/attendance/reports/student/register?batchId=901&fromDate=2026-10-05&toDate=2026-10-06&subBatchId=${subBatchAId}`, {
      headers: officeHeaders,
    });
    const subBatchFilterData = await subBatchFilterRes.json();
    assert(subBatchFilterData.items.length === 1 && subBatchFilterData.items[0].subBatchId === subBatchAId, 'Sub-batch filter returns only Sub-Batch A classes');

    // 7. Test Absent Student Report
    console.log('\n--- 7. Absent Student Report Log ---');
    const absRes = await fetch(`${baseUrl}/api/attendance/reports/student/absences?batchId=901&fromDate=2026-10-05&toDate=2026-10-06`, {
      headers: officeHeaders,
    });
    const absData = await absRes.json();

    assert(absData.success === true, 'Successfully fetched absent students report');
    assert(absData.totalAbsences === 3, 'Total absence occurrences is 3', `Got ${absData.totalAbsences}`);

    const absRolls = absData.absences.map((a: any) => a.rollNumber).sort();
    assert(JSON.stringify(absRolls) === JSON.stringify(['02', '03', '04']), 'Report lists correct absent roll numbers [02, 03, 04]');

    const sampleAbs = absData.absences.find((a: any) => a.rollNumber === '02');
    assert(sampleAbs?.studentName === 'Bhavna Patel', 'Absent student name correctly joined');
    assert(sampleAbs?.permanentUniversityNumber === 'U24002', 'University registration number populated');
    assert(sampleAbs?.classType === 'LT', 'Class type populated');
    assert(sampleAbs?.startTime === '10:00', 'Class time populated');

  } catch (err) {
    console.error('Test execution failed with error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`STAGE 4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage4Tests().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
