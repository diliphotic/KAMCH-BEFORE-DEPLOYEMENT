import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { checkDatabaseConnection, getPool } from '../server/db.ts';
import { authRouter } from '../server/routes/auth.routes.ts';
import { feesRouter } from '../server/routes/fees.routes.ts';
import { MemoryDatabase } from '../server/services/memory-db.ts';

function genSecret(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}!9`;
}

function extractCookies(res: Response): { session: string; csrf: string } {
  const getSetCookie = (res.headers as any).getSetCookie;
  const rawList: string[] = typeof getSetCookie === 'function'
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

function makeHeaders(sessionCookie: string, csrfToken: string) {
  return {
    'Content-Type': 'application/json',
    Cookie: `${sessionCookie}; kamch_csrf=${csrfToken}`,
    'X-CSRF-Token': csrfToken,
  };
}

async function runFeesStage2Tests() {
  console.log('================================================================');
  console.log('KAMCH ERP — FEES MANAGEMENT STAGE 2 BACKEND FINANCIAL ENGINE TEST');
  console.log('================================================================\n');

  await checkDatabaseConnection();

  const memDb = MemoryDatabase.getInstance();
  const initialPwd = genSecret('Init');
  const permPwd = genSecret('Perm');

  memDb.provisionInitialSuperAdmin({
    username: 'feesadmin',
    email: 'feesadmin@kamch.ac.in',
    password: initialPwd,
    mustChangePassword: true,
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/fees', feesRouter);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

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

  try {
    // 1. Login and change password
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'feesadmin', password: initialPwd }),
    });
    const loginCookies = extractCookies(loginRes);
    const loginData = await loginRes.json();

    const changePwdRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: makeHeaders(loginCookies.session, loginData.csrfToken),
      body: JSON.stringify({ currentPassword: initialPwd, newPassword: permPwd }),
    });
    assert(changePwdRes.status === 200, 'Super admin password change for fees test succeeds');

    const login2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'feesadmin', password: permPwd }),
    });
    const cookies2 = extractCookies(login2);
    const data2 = await login2.json();
    const headers = makeHeaders(cookies2.session, data2.csrfToken);

    // 2. Insert test student directly into database for testing
    const pool = getPool();
    const conn = await pool.getConnection();
    const studentIdNum = `STU-TEST-${Date.now()}`;
    const [studentIns] = await conn.query<any>(
      `INSERT INTO students (student_id_number, full_name, admission_category, admission_year, current_year_of_study, status)
       VALUES (?, 'Test Student Stage2', 'GOVERNMENT', 2026, 1, 'ACTIVE')`,
      [studentIdNum]
    );
    const testStudentId = studentIns.insertId;

    // Initialize assessment
    const initAssessRes = await fetch(`${baseUrl}/api/fees/students/${testStudentId}/initialize-assessment`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messEnrolled: true, hostelEnrolled: true }),
    });
    const initAssessData = await initAssessRes.json();
    assert(initAssessRes.status === 201, 'Student fee assessment initialized successfully');

    // Get assessment ID
    const [assessRows] = await conn.query<any[]>(
      'SELECT id FROM student_fee_assessments WHERE student_id = ? LIMIT 1',
      [testStudentId]
    );
    const aId = assessRows[0].id;

    // Get service billing period ID
    const [bpRows] = await conn.query<any[]>(
      'SELECT id FROM service_billing_periods WHERE student_id = ? LIMIT 1',
      [testStudentId]
    );
    const billingPeriodId = bpRows[0].id;

    conn.release();

    // 3. Test Financial Ledger calculation before payments
    const ledgerRes1 = await fetch(`${baseUrl}/api/fees/students/${testStudentId}/financial-ledger`, {
      headers,
    });
    const ledger1 = await ledgerRes1.json();
    assert(ledgerRes1.status === 200, 'Fetch initial 3-account financial ledger succeeds');
    assert(ledger1.accounts.COLLEGE.netPayable === 75750, 'College account net payable is correct (75,750)');
    assert(ledger1.accounts.DEVELOPMENT.netPayable === 50000, 'Development account net payable is correct (50,000)');
    assert(ledger1.accounts.HOSTEL_MESS.netPayable === 60000, 'Hostel & Mess account net payable is correct (60,000)');

    // 4. Test Collection Group with Multi-Account Payment Allocation & Destination Routing
    const cgPayload = {
      studentId: testStudentId,
      paymentDate: '2026-06-15',
      notes: 'Stage 2 multi-account test payment',
      payments: [
        {
          destination: 'COLLEGE_ACCOUNT',
          paymentMethod: 'CASH',
          amount: 50000,
          allocations: [
            { accountType: 'COLLEGE', allocatedAmount: 30000, assessmentId: aId },
            { accountType: 'HOSTEL_MESS', allocatedAmount: 20000, billingPeriodId },
          ],
        },
        {
          destination: 'SECRETARY_DEV_ACCOUNT',
          paymentMethod: 'CASH',
          amount: 20000,
          allocations: [
            { accountType: 'DEVELOPMENT', allocatedAmount: 20000, assessmentId: aId },
          ],
        },
      ],
    };

    const cgRes = await fetch(`${baseUrl}/api/fees/collection-groups`, {
      method: 'POST',
      headers,
      body: JSON.stringify(cgPayload),
    });
    const cgData = await cgRes.json();
    assert(cgRes.status === 201, 'Collection group creation with multi-destination payments succeeds');
    assert(Boolean(cgData.receiptNumber), 'Combined receipt generated for collection group');

    // 5. Test Ledger after payments
    const ledgerRes2 = await fetch(`${baseUrl}/api/fees/students/${testStudentId}/financial-ledger`, {
      headers,
    });
    const ledger2 = await ledgerRes2.json();
    assert(ledgerRes2.status === 200, 'Fetch updated financial ledger succeeds');
    assert(ledger2.accounts.COLLEGE.verifiedPaid === 30000, 'College account verified paid is ₹30,000');
    assert(ledger2.accounts.COLLEGE.outstandingBalance === 45750, 'College account outstanding is correct (₹45,750)');
    assert(ledger2.accounts.DEVELOPMENT.verifiedPaid === 20000, 'Development account verified paid is ₹20,000');
    assert(ledger2.accounts.DEVELOPMENT.outstandingBalance === 30000, 'Development account outstanding is correct (₹30,000)');
    assert(ledger2.accounts.HOSTEL_MESS.verifiedPaid === 20000, 'Hostel & Mess verified paid is ₹20,000');
    assert(ledger2.accounts.HOSTEL_MESS.outstandingBalance === 40000, 'Hostel & Mess outstanding is correct (₹40,000)');

    // 6. Test Validation Error: Destination mismatch (Secretarial Dev account receiving College fee)
    const invalidPayload = {
      studentId: testStudentId,
      paymentDate: '2026-06-16',
      payments: [
        {
          destination: 'SECRETARY_DEV_ACCOUNT',
          paymentMethod: 'CASH',
          amount: 10000,
          allocations: [
            { accountType: 'COLLEGE', allocatedAmount: 10000, assessmentId: aId },
          ],
        },
      ],
    };
    const invalidRes = await fetch(`${baseUrl}/api/fees/collection-groups`, {
      method: 'POST',
      headers,
      body: JSON.stringify(invalidPayload),
    });
    assert(invalidRes.status === 400, 'Server correctly rejects destination mismatch (SECRETARY_DEV_ACCOUNT for COLLEGE allocation)');

    // 7. Test Validation Error: Allocation sum mismatch
    const sumMismatchPayload = {
      studentId: testStudentId,
      paymentDate: '2026-06-16',
      payments: [
        {
          destination: 'COLLEGE_ACCOUNT',
          paymentMethod: 'CASH',
          amount: 10000,
          allocations: [
            { accountType: 'COLLEGE', allocatedAmount: 6000, assessmentId: aId },
          ],
        },
      ],
    };
    const sumMismatchRes = await fetch(`${baseUrl}/api/fees/collection-groups`, {
      method: 'POST',
      headers,
      body: JSON.stringify(sumMismatchPayload),
    });
    assert(sumMismatchRes.status === 400, 'Server correctly rejects allocation sum mismatch');

    console.log(`\nTest Results: Passed = ${passed}, Failed = ${failed}`);
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
  }
}

runFeesStage2Tests();
