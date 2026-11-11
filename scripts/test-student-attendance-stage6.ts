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

async function runStage6Tests() {
  console.log('================================================================');
  console.log('KAMCH ERP — STAGE 6: SUBJECT-WISE ATTENDANCE PERCENTAGES VERIFICATION');
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
    // 1. Setup test users and seed students
    console.log('--- 1. Setting Up Authenticated Roles, Users & Student Records ---');
    const [roles] = await pool.query<any[]>('SELECT id, code FROM roles');
    const officeRole = roles.find((r) => r.code === 'OFFICE');
    const facultyRole = roles.find((r) => r.code === 'FACULTY');

    if (!officeRole || !facultyRole) {
      throw new Error('Required roles missing from database.');
    }

    const testPassword = 'PasswordTest123!';
    const pwdHash = await bcrypt.hash(testPassword, 10);

    const memDb = (await import('../server/services/memory-db.ts')).MemoryDatabase.getInstance();
    memDb.users = memDb.users.filter((u: any) => ![991, 992].includes(u.id));

    memDb.users.push(
      {
        id: 991,
        username: 'test_office_stage6',
        email: 'office_stage6@kamch.ac.in',
        password_hash: pwdHash,
        full_name: 'Office Admin Stage6',
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
        username: 'test_faculty_stage6',
        email: 'faculty_stage6@kamch.ac.in',
        password_hash: pwdHash,
        full_name: 'Faculty Stage6',
        role_id: facultyRole.id,
        department_id: null,
        teacher_id: 1,
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

    // Ensure student is seeded for Batch 1
    if (memDb.students.length > 0) {
      memDb.students[0].current_placement_batch_id = 1;
      memDb.students[0].original_batch_id = 1;
      memDb.students[0].status = 'ACTIVE';
      memDb.students[0].administrative_status = 'ACTIVE';
    } else {
      memDb.students.push({
        id: 101,
        student_id_number: 'KAMCH2023001',
        temporary_roll_number: '01',
        permanent_university_number: 'UNI12345',
        full_name: 'Test Student Stage 6',
        original_batch_id: 1,
        current_placement_batch_id: 1,
        status: 'ACTIVE',
        administrative_status: 'ACTIVE',
        admission_category: 'GOVERNMENT',
        admission_year: 2023,
        current_year_of_study: 1,
        is_kea_eligible: true,
        kea_acknowledgement_no: null,
        mess_enrolled: false,
        hostel_enrolled: false,
        contact_phone: null,
        contact_email: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const firstSubjectId = memDb.iaSubjects[0]?.id || 1;

    // Login as OFFICE
    const officeLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'test_office_stage6', password: testPassword }),
    });
    const officeAuth = extractCookies(officeLoginRes);
    const officeCookieHeader = `${officeAuth.session}; kamch_csrf=${officeAuth.csrf}`;

    // Login as FACULTY
    const facultyLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'test_faculty_stage6', password: testPassword }),
    });
    const facultyAuth = extractCookies(facultyLoginRes);
    const facultyCookieHeader = `${facultyAuth.session}; kamch_csrf=${facultyAuth.csrf}`;

    assert(officeLoginRes.status === 200, 'Logged in as OFFICE role user');
    assert(facultyLoginRes.status === 200, 'Logged in as FACULTY role user');

    // 2. Test Role Permissions
    console.log('\n--- 2. Permissions & Access Control ---');
    const facultyAccessRes = await fetch(`${baseUrl}/api/attendance/reports/subject-wise?batchId=1`, {
      headers: { Cookie: facultyCookieHeader, 'x-csrf-token': facultyAuth.csrf },
    });
    assert(facultyAccessRes.status === 403, 'FACULTY role denied access to subject-wise attendance percentage report (403 Forbidden)');

    const officeAccessRes = await fetch(`${baseUrl}/api/attendance/reports/subject-wise?batchId=1`, {
      headers: { Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
    });
    const officeAccessData: any = await officeAccessRes.json();
    assert(officeAccessRes.status === 200 && officeAccessData.success === true, 'OFFICE role granted access to subject-wise report (200 OK)');

    // 3. Setup Test Batch, Timetable, Slot & Attendance Data
    console.log('\n--- 3. Setting Up Test Data for Invariant Verification ---');
    const verCode = `S6-V1-${Date.now()}`;
    const versionRes = await fetch(`${baseUrl}/api/attendance/timetable/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
      body: JSON.stringify({
        batchId: 1,
        versionCode: verCode,
        title: 'Stage 6 Verification Timetable',
        effectiveFrom: '2026-03-01',
        effectiveTo: '2026-03-31',
      }),
    });
    const versionData: any = await versionRes.json();
    assert(versionRes.status === 200 && versionData.success, 'Created timetable version for Stage 6 testing');
    const timetableVersionId = versionData.versionId || versionData.version?.id;

    // Create 3 Slots using valid firstSubjectId
    const slotLtRes = await fetch(`${baseUrl}/api/attendance/timetable/versions/${timetableVersionId}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
      body: JSON.stringify({
        weekday: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
        subjectId: firstSubjectId,
        classType: 'LT',
        weekPattern: 'EVERY_WEEK',
      }),
    });
    const slotLtData: any = await slotLtRes.json();
    const slotLtId = slotLtData.slotId || slotLtData.slot?.id;

    const slotNltRes = await fetch(`${baseUrl}/api/attendance/timetable/versions/${timetableVersionId}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
      body: JSON.stringify({
        weekday: 'MONDAY',
        startTime: '10:00',
        endTime: '11:00',
        subjectId: firstSubjectId,
        classType: 'NLT',
        weekPattern: 'EVERY_WEEK',
      }),
    });
    const slotNltData: any = await slotNltRes.json();
    const slotNltId = slotNltData.slotId || slotNltData.slot?.id;

    const slotOtherRes = await fetch(`${baseUrl}/api/attendance/timetable/versions/${timetableVersionId}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
      body: JSON.stringify({
        weekday: 'MONDAY',
        startTime: '11:00',
        endTime: '12:00',
        subjectId: firstSubjectId,
        classType: 'OTHER',
        weekPattern: 'EVERY_WEEK',
      }),
    });
    const slotOtherData: any = await slotOtherRes.json();
    const slotOtherId = slotOtherData.slotId || slotOtherData.slot?.id;

    assert(Boolean(slotLtId && slotNltId && slotOtherId), 'Created LT, NLT, and OTHER slots');

    // Get active students for Batch 1
    const studentRes = await fetch(`${baseUrl}/api/attendance/student/eligible-students?batchId=1`, {
      headers: { Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
    });
    const studentData: any = await studentRes.json();
    const students = studentData.students || [];
    assert(students.length > 0, `Found ${students.length} active students in Batch 1`);
    const student1 = students[0];

    // Record Sessions via /api/attendance/student/session
    await fetch(`${baseUrl}/api/attendance/student/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
      body: JSON.stringify({
        batchId: 1,
        slotId: slotLtId,
        date: '2026-03-02',
        absentStudentIds: [student1.id],
      }),
    });

    await fetch(`${baseUrl}/api/attendance/student/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
      body: JSON.stringify({
        batchId: 1,
        slotId: slotLtId,
        date: '2026-03-09',
        absentStudentIds: [],
      }),
    });

    await fetch(`${baseUrl}/api/attendance/student/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
      body: JSON.stringify({
        batchId: 1,
        slotId: slotNltId,
        date: '2026-03-02',
        absentStudentIds: [],
      }),
    });

    await fetch(`${baseUrl}/api/attendance/student/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
      body: JSON.stringify({
        batchId: 1,
        slotId: slotOtherId,
        date: '2026-03-02',
        absentStudentIds: [],
      }),
    });

    // 4. Verify Attendance Percentages Calculation Invariants
    console.log('\n--- 4. Verifying Percentage Calculations & Formulas ---');
    const reportRes = await fetch(
      `${baseUrl}/api/attendance/reports/subject-wise?batchId=1&fromDate=2026-03-01&toDate=2026-03-31&subjectId=${firstSubjectId}&studentId=${student1.id}`,
      { headers: { Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf } }
    );
    const reportData: any = await reportRes.json();

    assert(reportRes.status === 200 && reportData.success, 'Fetched subject-wise percentage report');
    const summary = reportData.summary || [];
    assert(summary.length === 1, 'Summary contains 1 entry for target student and subject');

    const item = summary[0];
    if (item) {
      // LT Stats: Recorded 2, Present 1, Percentage 50.00%
      assert(
        item.lt.recorded === 2 && item.lt.present === 1 && item.lt.percentage === 50.0,
        `LT Category Stats: recorded=${item.lt.recorded} (expected 2), present=${item.lt.present} (expected 1), %=${item.lt.percentage}% (expected 50.00%)`
      );

      // NLT Stats: Recorded 1, Present 1, Percentage 100.00%
      assert(
        item.nlt.recorded === 1 && item.nlt.present === 1 && item.nlt.percentage === 100.0,
        `NLT Category Stats: recorded=${item.nlt.recorded} (expected 1), present=${item.nlt.present} (expected 1), %=${item.nlt.percentage}% (expected 100.00%)`
      );

      // NLP Stats: Recorded 0, Present 0, Percentage null ("N/A")
      assert(
        item.nlp.recorded === 0 && item.nlp.present === 0 && item.nlp.percentage === null,
        `NLP Category Stats: recorded=${item.nlp.recorded} (expected 0), percentage=${item.nlp.percentage} (expected null / N/A)`
      );

      // OTHER Stats: Recorded 1, Present 1, Percentage 100.00%
      assert(
        item.other.recorded === 1 && item.other.present === 1 && item.other.percentage === 100.0,
        `OTHER Category Stats: recorded=${item.other.recorded} (expected 1), percentage=${item.other.percentage}% (expected 100.00%)`
      );

      // Combined LT+NLT+NLP Formula Verification
      const expectedCombinedPercentage = 66.67;
      assert(
        item.combined.recorded === 3 &&
        item.combined.present === 2 &&
        item.combined.percentage === expectedCombinedPercentage,
        `Combined LT+NLT+NLP Invariant: Combined Present=${item.combined.present}/Recorded=${item.combined.recorded}, %=${item.combined.percentage}% (expected ${expectedCombinedPercentage}%, NOT average 75%)`
      );

      // Verify OTHER is EXCLUDED from Combined Total
      assert(
        item.combined.recorded === 3,
        'OTHER class type is correctly EXCLUDED from the combined LT+NLT+NLP percentage calculation'
      );
    }

    // 5. Zero Conducted Sessions Test (Denominator = 0 -> null / N/A)
    console.log('\n--- 5. Verifying Denominator = 0 (Null / N/A Output) ---');
    const emptyPeriodRes = await fetch(
      `${baseUrl}/api/attendance/reports/subject-wise?batchId=1&fromDate=2025-01-01&toDate=2025-01-31&studentId=${student1.id}`,
      { headers: { Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf } }
    );
    const emptyPeriodData: any = await emptyPeriodRes.json();

    const emptySummary = emptyPeriodData.summary || [];
    if (emptySummary.length > 0) {
      const emptyItem = emptySummary[0];
      assert(
        emptyItem.combined.recorded === 0 &&
        emptyItem.combined.percentage === null &&
        emptyItem.lt.percentage === null,
        'Zero conducted sessions returns null percentage (displays N/A rather than 0%)'
      );
    } else {
      assert(true, 'No sessions conducted in period returns empty summary / N/A');
    }

  } catch (err: any) {
    console.error('Unhandled error during Stage 6 test execution:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  console.log(`STAGE 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage6Tests();
