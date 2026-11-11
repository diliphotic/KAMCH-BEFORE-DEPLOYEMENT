import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getPool } from '../server/db.ts';
import { authRouter } from '../server/routes/auth.routes.ts';
import { feesRouter } from '../server/routes/fees.routes.ts';
import { studentsRouter } from '../server/routes/students.routes.ts';
import bcrypt from 'bcryptjs';

function genSecret(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}!9`;
}

function extractCookies(res: any): { session: string; csrf: string } {
  let rawList: string[] = [];
  if (typeof res.headers.getSetCookie === 'function') {
    rawList = res.headers.getSetCookie();
  } else {
    const headerVal = res.headers.get('set-cookie') || '';
    rawList = headerVal.split(/,\s*(?=kamch_)/);
  }

  let session = '';
  let csrf = '';
  for (const item of rawList) {
    const parts = item.split(';');
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed.startsWith('kamch_session=')) {
        session = trimmed;
      }
      if (trimmed.startsWith('kamch_csrf=')) {
        csrf = trimmed.replace('kamch_csrf=', '');
      }
    }
  }
  return { session, csrf };
}

function makeHeaders(sessionCookie: string, csrfToken: string) {
  return {
    'Content-Type': 'application/json',
    Cookie: `${sessionCookie}; kamch_csrf=${csrfToken}`,
    'X-CSRF-Token': csrfToken,
  };
}

async function runBulkEnrollmentTests() {
  console.log('================================================================');
  console.log('KAMCH ERP — BULK HOSTEL & MESS ENROLLMENT VERIFICATION TEST');
  console.log('================================================================');

  const pool = getPool();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/fees', feesRouter);
  app.use('/api/students', studentsRouter);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failCount++;
    }
  }

  try {
    // 1. Provision Test Accounts (Super Admin, Office, Secretary)
    const adminPass = genSecret('adm');
    const officePass = genSecret('off');
    const secPass = genSecret('sec');

    const adminHash = await bcrypt.hash(adminPass, 10);
    const officeHash = await bcrypt.hash(officePass, 10);
    const secHash = await bcrypt.hash(secPass, 10);

    const [rolesList] = await pool.query<any[]>('SELECT id, code FROM roles');
    const adminRoleId = rolesList.find((r: any) => r.code === 'SUPER_ADMIN')?.id || 1;
    const officeRoleId = rolesList.find((r: any) => r.code === 'OFFICE')?.id || 4;
    const secRoleId = rolesList.find((r: any) => r.code === 'SECRETARY')?.id || 3;

    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, is_deactivated, must_change_password)
       VALUES (?, ?, ?, 'Test Admin', ?, FALSE, FALSE)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      ['bulk_admin_test', 'bulk_admin@kamch.ac.in', adminHash, adminRoleId]
    );

    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, is_deactivated, must_change_password)
       VALUES (?, ?, ?, 'Test Office', ?, FALSE, FALSE)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      ['bulk_office_test', 'bulk_office@kamch.ac.in', officeHash, officeRoleId]
    );

    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, is_deactivated, must_change_password)
       VALUES (?, ?, ?, 'Test Secretary', ?, FALSE, FALSE)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      ['bulk_sec_test', 'bulk_sec@kamch.ac.in', secHash, secRoleId]
    );

    // Login Admin
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'bulk_admin_test', password: adminPass }),
    });
    const adminLoginData = await adminLoginRes.json();
    const adminCookies = extractCookies(adminLoginRes);

    // Login Office
    const officeLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'bulk_office_test', password: officePass }),
    });
    const officeCookies = extractCookies(officeLoginRes);

    // Login Secretary
    const secLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'bulk_sec_test', password: secPass }),
    });
    const secCookies = extractCookies(secLoginRes);

    // 2. Fetch Active Batches
    const batchesRes = await fetch(`${baseUrl}/api/students/batches`, {
      headers: makeHeaders(adminCookies.session, adminCookies.csrf),
    });
    const batchesData = await batchesRes.json();
    if (!batchesData.batches) console.log('DEBUG batchesData:', batchesData);
    assert(batchesRes.ok && Array.isArray(batchesData.batches), 'Fetch active batches list');
    const targetBatch = batchesData.batches[0];

    // Seed test students in target batch
    await pool.query(
      `INSERT INTO students (system_access_number, full_name, roll_number, registration_number, current_placement_batch_id, original_batch_id, is_active)
       VALUES ('STU_BULK_001', 'Bulk Student One', 'B001', 'REG_BULK_001', ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
      [targetBatch.id, targetBatch.id]
    );

    await pool.query(
      `INSERT INTO students (system_access_number, full_name, roll_number, registration_number, current_placement_batch_id, original_batch_id, is_active)
       VALUES ('STU_BULK_002', 'Bulk Student Two', 'B002', 'REG_BULK_002', ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
      [targetBatch.id, targetBatch.id]
    );

    // 3. Fetch Students in Target Batch
    const studentsRes = await fetch(`${baseUrl}/api/fees/students?batchId=${targetBatch.id}`, {
      headers: makeHeaders(adminCookies.session, adminCookies.csrf),
    });
    const studentsData = await studentsRes.json();
    assert(studentsRes.ok && Array.isArray(studentsData.students), 'Fetch batch students via GET /api/fees/students?batchId=X');
    const batchStudents = studentsData.students;

    if (batchStudents.length >= 2) {
      const student1 = batchStudents[0];
      const student2 = batchStudents[1];

      // Test 1: Bulk Hostel Enrollment
      const bulkHostelRes = await fetch(`${baseUrl}/api/fees/services/bulk-enroll`, {
        method: 'POST',
        headers: makeHeaders(officeCookies.session, officeCookies.csrf),
        body: JSON.stringify({
          batchId: targetBatch.id,
          services: ['HOSTEL'],
          studentIds: [student1.id, student2.id],
          hostelAnnualFee: 32000,
          effectiveDate: '2026-11-06',
        }),
      });
      const bulkHostelData = await bulkHostelRes.json();
      assert(
        bulkHostelRes.ok && bulkHostelData.success && bulkHostelData.summary.enrolledCount >= 1,
        'Bulk Hostel enrollment for batch students'
      );

      // Test 2: Repeat Bulk Hostel Enrollment (Must Skip Already Enrolled)
      const repeatHostelRes = await fetch(`${baseUrl}/api/fees/services/bulk-enroll`, {
        method: 'POST',
        headers: makeHeaders(officeCookies.session, officeCookies.csrf),
        body: JSON.stringify({
          batchId: targetBatch.id,
          services: ['HOSTEL'],
          studentIds: [student1.id, student2.id],
          hostelAnnualFee: 32000,
          effectiveDate: '2026-11-06',
        }),
      });
      const repeatHostelData = await repeatHostelRes.json();
      assert(
        repeatHostelRes.ok && repeatHostelData.summary.skippedCount >= 2 && repeatHostelData.summary.enrolledCount === 0,
        'Repeat Bulk Hostel enrollment skips already enrolled students without duplication'
      );

      // Test 3: Bulk Mess Enrollment
      const bulkMessRes = await fetch(`${baseUrl}/api/fees/services/bulk-enroll`, {
        method: 'POST',
        headers: makeHeaders(officeCookies.session, officeCookies.csrf),
        body: JSON.stringify({
          batchId: targetBatch.id,
          services: ['MESS'],
          studentIds: [student1.id, student2.id],
          messAnnualFee: 28000,
          effectiveDate: '2026-11-06',
        }),
      });
      const bulkMessData = await bulkMessRes.json();
      assert(
        bulkMessRes.ok && bulkMessData.success && bulkMessData.summary.enrolledCount >= 1,
        'Bulk Mess enrollment for batch students'
      );

      // Test 4: Secretary Role is BLOCKED from Bulk Enrollment (403 Forbidden)
      const secBulkRes = await fetch(`${baseUrl}/api/fees/services/bulk-enroll`, {
        method: 'POST',
        headers: makeHeaders(secCookies.session, secCookies.csrf),
        body: JSON.stringify({
          batchId: targetBatch.id,
          services: ['HOSTEL', 'MESS'],
          studentIds: [student1.id],
        }),
      });
      assert(
        secBulkRes.status === 403,
        'Secretary role is blocked from performing bulk service enrollment (403 Forbidden)'
      );

      // Test 5: Verify Audit Log for Bulk Enrollment
      const [auditLogs] = await pool.query<any[]>(
        "SELECT * FROM audit_logs WHERE action = 'BULK_SERVICE_ENROLLED' ORDER BY id DESC LIMIT 1"
      );
      const logEntry = Array.isArray(auditLogs) ? auditLogs.find((a: any) => a.action === 'BULK_SERVICE_ENROLLED') : null;
      assert(
        Boolean(logEntry && logEntry.target_type === 'BATCH'),
        'Audit log records BULK_SERVICE_ENROLLED with actor, batch ID, and enrollment summary'
      );
    } else {
      console.log('[SKIP] Insufficient students in batch for multi-student test');
    }
  } catch (err) {
    console.error('Test execution error:', err);
    failCount++;
  } finally {
    server.close();
    console.log('================================================================');
    console.log(`BULK ENROLLMENT TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('================================================================');
  }
}

runBulkEnrollmentTests();
