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

async function runStage7Tests() {
  console.log('================================================================');
  console.log('KAMCH ERP — STAGE 7: BATCH-WISE ATTENDANCE OVERVIEW VERIFICATION');
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
    // 1. Setup test users and seed memory DB
    console.log('--- 1. Setting Up Authenticated Roles & Test Data ---');
    const [roles] = await pool.query<any[]>('SELECT id, code FROM roles');
    const officeRole = roles.find((r) => r.code === 'OFFICE');
    const facultyRole = roles.find((r) => r.code === 'FACULTY');

    if (!officeRole || !facultyRole) {
      throw new Error('Required roles missing from database.');
    }

    const testPassword = 'PasswordStage7!';
    const pwdHash = await bcrypt.hash(testPassword, 10);

    const memDb = (await import('../server/services/memory-db.ts')).MemoryDatabase.getInstance();
    memDb.users = memDb.users.filter((u: any) => ![997, 998].includes(u.id));

    memDb.users.push(
      {
        id: 997,
        username: 'test_office_stage7',
        email: 'office_stage7@kamch.ac.in',
        password_hash: pwdHash,
        full_name: 'Office Admin Stage7',
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
        id: 998,
        username: 'test_faculty_stage7',
        email: 'faculty_stage7@kamch.ac.in',
        password_hash: pwdHash,
        full_name: 'Faculty User Stage7',
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

    // Login OFFICE role
    const officeLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'test_office_stage7', password: testPassword }),
    });
    const officeAuth = extractCookies(officeLoginRes);
    const officeCookieHeader = `${officeAuth.session}; kamch_csrf=${officeAuth.csrf}`;
    assert(officeLoginRes.status === 200, 'Logged in as OFFICE role user');

    // Login FACULTY role
    const facultyLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'test_faculty_stage7', password: testPassword }),
    });
    const facultyAuth = extractCookies(facultyLoginRes);
    const facultyCookieHeader = `${facultyAuth.session}; kamch_csrf=${facultyAuth.csrf}`;
    assert(facultyLoginRes.status === 200, 'Logged in as FACULTY role user');

    // Ensure student is seeded for Batch 1
    if (memDb.students.length > 0) {
      memDb.students[0].current_placement_batch_id = 1;
      memDb.students[0].original_batch_id = 1;
      memDb.students[0].status = 'ACTIVE';
      memDb.students[0].administrative_status = 'ACTIVE';
    } else {
      memDb.students.push({
        id: 701,
        student_id_number: 'KAMCH2023001',
        temporary_roll_number: '01',
        permanent_university_number: 'UNI701',
        full_name: 'Test Student Stage 7',
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

    const firstSubjectId = memDb.iaSubjects?.[0]?.id || 801;

    // 2. Permissions & Access Control Check
    console.log('\n--- 2. Permissions & Access Control Check ---');
    const facultyAccessRes = await fetch(`${baseUrl}/api/attendance/reports/missing-sessions?batchId=1`, {
      headers: { Cookie: facultyCookieHeader, 'x-csrf-token': facultyAuth.csrf },
    });
    assert(facultyAccessRes.status === 403, 'FACULTY role denied access to missing sessions report (403 Forbidden)');

    const officeAccessRes = await fetch(`${baseUrl}/api/attendance/reports/missing-sessions?batchId=1`, {
      headers: { Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
    });
    const officeAccessData: any = await officeAccessRes.json();
    assert(officeAccessRes.status === 200 && officeAccessData.success === true, 'OFFICE role granted access to missing sessions report (200 OK)');

    // 3. Setup Test Batch, Timetable, Slot
    console.log('\n--- 3. Setting Up Test Timetable & Scheduled Slots ---');
    const verCode = `S7-V1-${Date.now()}`;
    const versionRes = await fetch(`${baseUrl}/api/attendance/timetable/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
      body: JSON.stringify({
        batchId: 1,
        versionCode: verCode,
        title: 'Stage 7 Verification Timetable',
        effectiveFrom: '2026-03-01',
        effectiveTo: '2026-03-31',
      }),
    });
    const versionData: any = await versionRes.json();
    assert(versionRes.status === 200 && versionData.success, 'Created timetable version for Stage 7 testing');
    const timetableVersionId = versionData.versionId || versionData.version?.id;

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
    assert(Boolean(slotLtId), 'Created MONDAY LT slot');

    // 4. Missing Attendance Detection Test (2026-03-02 is a Monday)
    console.log('\n--- 4. Testing Missing Attendance Detection ---');
    const missingRes1 = await fetch(
      `${baseUrl}/api/attendance/reports/missing-sessions?batchId=1&fromDate=2026-03-02&toDate=2026-03-02`,
      { headers: { Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf } }
    );
    const missingData1: any = await missingRes1.json();
    assert(missingRes1.status === 200 && missingData1.success, 'Fetched missing sessions report');
    assert(missingData1.totalMissing === 1, 'Total missing sessions count equals 1 for unrecorded Monday slot');

    const missingItem1 = missingData1.missingSessions[0];
    if (missingItem1) {
      assert(missingItem1.date === '2026-03-02', 'Missing session date matches 2026-03-02');
      assert(missingItem1.weekday === 'MONDAY', 'Missing session weekday matches MONDAY');
      assert(missingItem1.status === 'NOT RECORDED', 'Missing session status is NOT RECORDED');
    }

    // 5. Unrecorded Class Policy Verification (Denominator Isolation)
    console.log('\n--- 5. Verifying Unrecorded Class Policy (Excluded from Denominators) ---');
    const reportBeforeRec = await fetch(
      `${baseUrl}/api/attendance/reports/subject-wise?batchId=1&fromDate=2026-03-01&toDate=2026-03-31&subjectId=${firstSubjectId}`,
      { headers: { Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf } }
    );
    const reportDataBefore: any = await reportBeforeRec.json();
    const summaryBefore = reportDataBefore.summary || [];
    assert(summaryBefore.length > 0, 'Subject-wise summary contains student record');
    if (summaryBefore.length > 0) {
      assert(summaryBefore[0].combined.recorded === 0, 'Unrecorded scheduled class is EXCLUDED from recorded sessions (recorded = 0)');
      assert(summaryBefore[0].combined.percentage === null, 'Percentage returns null (displays N/A in UI, NOT 0%)');
    }

    // 6. Record Attendance & Verify Instant Removal
    console.log('\n--- 6. Recording Attendance & Verifying List Removal ---');
    const sessionRes = await fetch(`${baseUrl}/api/attendance/student/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf },
      body: JSON.stringify({
        batchId: 1,
        slotId: slotLtId,
        date: '2026-03-02',
        absentStudentIds: [], // Student is present
      }),
    });
    assert(sessionRes.status === 200, 'Recorded student attendance session for 2026-03-02');

    const missingRes2 = await fetch(
      `${baseUrl}/api/attendance/reports/missing-sessions?batchId=1&fromDate=2026-03-02&toDate=2026-03-02`,
      { headers: { Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf } }
    );
    const missingData2: any = await missingRes2.json();
    assert(missingData2.totalMissing === 0, 'Recorded session is removed from missing sessions list (totalMissing = 0)');

    // 7. Verify Attendance Percentages Updated
    console.log('\n--- 7. Verifying Attendance Percentage Update ---');
    const reportAfterRec = await fetch(
      `${baseUrl}/api/attendance/reports/subject-wise?batchId=1&fromDate=2026-03-01&toDate=2026-03-31&subjectId=${firstSubjectId}`,
      { headers: { Cookie: officeCookieHeader, 'x-csrf-token': officeAuth.csrf } }
    );
    const reportDataAfter: any = await reportAfterRec.json();
    const summaryAfter = reportDataAfter.summary || [];
    assert(summaryAfter.length > 0, 'Subject-wise summary contains student record');
    if (summaryAfter.length > 0) {
      assert(summaryAfter[0].combined.recorded === 1 && summaryAfter[0].combined.present === 1, 'Recorded 1 present session');
      assert(summaryAfter[0].combined.percentage === 100.0, 'Attendance percentage updated to 100.00%');
    }

    console.log('\n===============================================================');
    console.log(`STAGE 7 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runStage7Tests().catch((err) => {
  console.error('\n[STAGE 7 TEST EXCEPTION]:', err);
  process.exit(1);
});
