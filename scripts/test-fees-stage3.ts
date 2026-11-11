import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { checkDatabaseConnection, getPool } from '../server/db.ts';
import { authRouter } from '../server/routes/auth.routes.ts';
import { feesRouter } from '../server/routes/fees.routes.ts';
import { MemoryDatabase } from '../server/services/memory-db.ts';

import bcrypt from 'bcryptjs';

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

async function runFeesStage3Tests() {
  console.log('================================================================');
  console.log('KAMCH ERP — FEES MANAGEMENT STAGE 3 VERIFICATION & REVERSAL TEST');
  console.log('================================================================\n');

  await checkDatabaseConnection();

  const memDb = MemoryDatabase.getInstance();
  const pwdSuper = genSecret('Super');
  const pwdPrincipal = genSecret('Principal');
  const pwdStaff = genSecret('Staff');
  const pwdSecretary = genSecret('Sec');

  // Provision users for each required role
  const uSuperId = memDb.generateId('users');
  const uPrincipalId = memDb.generateId('users');
  const uStaffId = memDb.generateId('users');
  const uSecretaryId = memDb.generateId('users');

  const rSuper = memDb.roles.find(r => r.code === 'SUPER_ADMIN') || { id: 1 };
  const rPrincipal = memDb.roles.find(r => r.code === 'PRINCIPAL') || { id: 2 };
  const rStaff = memDb.roles.find(r => r.code === 'STAFF') || { id: 5 };
  const rSecretary = memDb.roles.find(r => r.code === 'SECRETARY') || { id: 3 };

  memDb.users.push(
    {
      id: uSuperId,
      username: 'superadmin3',
      email: 'super3@kamch.ac.in',
      password_hash: bcrypt.hashSync(pwdSuper, 10),
      role_id: rSuper.id,
      department_id: null,
      teacher_id: null,
      full_name: 'Super Admin Three',
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
      id: uPrincipalId,
      username: 'principal3',
      email: 'principal3@kamch.ac.in',
      password_hash: bcrypt.hashSync(pwdPrincipal, 10),
      role_id: rPrincipal.id,
      department_id: null,
      teacher_id: null,
      full_name: 'Principal Three',
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
      id: uStaffId,
      username: 'staff3',
      email: 'staff3@kamch.ac.in',
      password_hash: bcrypt.hashSync(pwdStaff, 10),
      role_id: rStaff.id,
      department_id: null,
      teacher_id: null,
      full_name: 'Staff Accounts Three',
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
      id: uSecretaryId,
      username: 'secretary3',
      email: 'sec3@kamch.ac.in',
      password_hash: bcrypt.hashSync(pwdSecretary, 10),
      role_id: rSecretary.id,
      department_id: null,
      teacher_id: null,
      full_name: 'Secretary Three',
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
    // Authenticate users
    async function login(username: string, password: string) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: username, password }),
      });
      const cookies = extractCookies(res);
      const data = await res.json();
      return { cookies, data };
    }

    const superSession = await login('superadmin3', pwdSuper);
    const principalSession = await login('principal3', pwdPrincipal);
    const staffSession = await login('staff3', pwdStaff);
    const secretarySession = await login('secretary3', pwdSecretary);

    const pool = getPool();
    // Setup test student
    const [stRes] = await pool.query<any>(
      `INSERT INTO students (student_id_number, full_name, admission_category, admission_year, current_year_of_study, is_kea_eligible, mess_enrolled, hostel_enrolled, status)
       VALUES ('KAMCH-2026-ST3-001', 'Test Student Stage3', 'GOVERNMENT', 2026, 1, FALSE, TRUE, TRUE, 'ACTIVE')`
    );
    const studentId = stRes.insertId;

    // Initialize fee assessment
    const initRes = await fetch(`${baseUrl}/api/fees/students/${studentId}/initialize-assessment`, {
      method: 'POST',
      headers: makeHeaders(superSession.cookies.session, superSession.data.csrfToken),
      body: JSON.stringify({ messEnrolled: true, hostelEnrolled: true }),
    });
    const initData = await initRes.json();
    assert(initRes.status === 201, 'Initialize student assessment for Stage 3 test');
    const assessmentId = initData.assessmentId;

    // Fetch billing period ID created during initialization
    const [bpRows] = await pool.query<any[]>(
      'SELECT id FROM service_billing_periods WHERE student_id = ? AND service_type = "MESS" LIMIT 1',
      [studentId]
    );
    const messBillingPeriodId = bpRows[0]?.id;

    // -------------------------------------------------------------------------
    // TEST 1: Record pending bank transfer for COLLEGE_ACCOUNT
    // -------------------------------------------------------------------------
    const pay1Res = await fetch(`${baseUrl}/api/fees/payments`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        amount: 20000,
        destination: 'COLLEGE_ACCOUNT',
        paymentMethod: 'BANK_TRANSFER',
        studentTxRef: 'UTR-COL-1001',
        bankName: 'SBI Bank',
      }),
    });
    const pay1Data = await pay1Res.json();
    assert(pay1Res.status === 201 && pay1Data.status === 'PENDING_VERIFICATION', 'Test 1: Record pending bank transfer for COLLEGE_ACCOUNT');
    const p1Id = pay1Data.paymentId;

    // -------------------------------------------------------------------------
    // TEST 2: Verify COLLEGE_ACCOUNT transfer with passbook reference
    // -------------------------------------------------------------------------
    const ver1Res = await fetch(`${baseUrl}/api/fees/payments/${p1Id}/verify`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        action: 'VERIFY',
        passbookTxRef: 'PB-COL-1001',
      }),
    });
    const ver1Data = await ver1Res.json();
    assert(ver1Res.status === 200 && ver1Data.success, 'Test 2: Verify COLLEGE_ACCOUNT transfer with passbook reference');

    // -------------------------------------------------------------------------
    // TEST 3: Record pending bank transfer for SECRETARY_DEV_ACCOUNT
    // -------------------------------------------------------------------------
    const pay2Res = await fetch(`${baseUrl}/api/fees/payments`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        amount: 15000,
        destination: 'SECRETARY_DEV_ACCOUNT',
        paymentMethod: 'BANK_TRANSFER',
        studentTxRef: 'UTR-DEV-2002',
        bankName: 'HDFC Bank',
      }),
    });
    const pay2Data = await pay2Res.json();
    assert(pay2Res.status === 201 && pay2Data.status === 'PENDING_VERIFICATION', 'Test 3: Record pending bank transfer for SECRETARY_DEV_ACCOUNT');
    const p2Id = pay2Data.paymentId;

    // -------------------------------------------------------------------------
    // TEST 4: Verify SECRETARY_DEV_ACCOUNT transfer with passbook reference
    // -------------------------------------------------------------------------
    const ver2Res = await fetch(`${baseUrl}/api/fees/payments/${p2Id}/verify`, {
      method: 'POST',
      headers: makeHeaders(secretarySession.cookies.session, secretarySession.data.csrfToken),
      body: JSON.stringify({
        action: 'VERIFY',
        passbookTxRef: 'PB-DEV-2002',
      }),
    });
    const ver2Data = await ver2Res.json();
    assert(ver2Res.status === 200 && ver2Data.success, 'Test 4: Verify SECRETARY_DEV_ACCOUNT transfer with passbook reference');

    // -------------------------------------------------------------------------
    // TEST 5: Verification destination & allocation type mismatch rejection
    // -------------------------------------------------------------------------
    // Create collection group with COLLEGE_ACCOUNT payment containing DEVELOPMENT allocation manually or test validation
    const mismatchCgRes = await fetch(`${baseUrl}/api/fees/collection-groups`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        studentId,
        payments: [
          {
            destination: 'COLLEGE_ACCOUNT',
            paymentMethod: 'BANK_TRANSFER',
            amount: 5000,
            studentTxRef: 'UTR-MISMATCH-1',
            allocations: [{ accountType: 'DEVELOPMENT', allocatedAmount: 5000, assessmentId }],
          },
        ],
      }),
    });
    assert(mismatchCgRes.status === 400, 'Test 5: Reject payment allocation mismatch at creation or verification');

    // -------------------------------------------------------------------------
    // TEST 6: Verification attempt without passbook reference fails
    // -------------------------------------------------------------------------
    const pay3Res = await fetch(`${baseUrl}/api/fees/payments`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        amount: 10000,
        destination: 'COLLEGE_ACCOUNT',
        paymentMethod: 'BANK_TRANSFER',
        studentTxRef: 'UTR-COL-3003',
      }),
    });
    const pay3Data = await pay3Res.json();
    const p3Id = pay3Data.paymentId;

    const noPassbookRes = await fetch(`${baseUrl}/api/fees/payments/${p3Id}/verify`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        action: 'VERIFY',
        passbookTxRef: '',
      }),
    });
    const noPassbookData = await noPassbookRes.json();
    assert(noPassbookRes.status === 400 && noPassbookData.code === 'MISSING_PASSBOOK_REF', 'Test 6: Verify attempt without passbook reference fails');

    // -------------------------------------------------------------------------
    // TEST 7: Reject bank transfer with mandatory rejection reason
    // -------------------------------------------------------------------------
    const rejRes = await fetch(`${baseUrl}/api/fees/payments/${p3Id}/verify`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        action: 'REJECT',
        rejectionReason: 'UTR reference not found in bank passbook statement',
      }),
    });
    const rejData = await rejRes.json();
    assert(rejRes.status === 200 && rejData.success, 'Test 7: Reject bank transfer with mandatory reason');

    // -------------------------------------------------------------------------
    // TEST 8: Collection group with 2 pending transfers has group status PENDING
    // -------------------------------------------------------------------------
    const cg8Res = await fetch(`${baseUrl}/api/fees/collection-groups`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        studentId,
        payments: [
          {
            destination: 'COLLEGE_ACCOUNT',
            paymentMethod: 'BANK_TRANSFER',
            amount: 5000,
            studentTxRef: 'UTR-CG8-A',
            allocations: [{ accountType: 'COLLEGE', allocatedAmount: 5000, assessmentId }],
          },
          {
            destination: 'SECRETARY_DEV_ACCOUNT',
            paymentMethod: 'BANK_TRANSFER',
            amount: 5000,
            studentTxRef: 'UTR-CG8-B',
            allocations: [{ accountType: 'DEVELOPMENT', allocatedAmount: 5000, assessmentId }],
          },
        ],
      }),
    });
    const cg8Data = await cg8Res.json();
    assert(cg8Res.status === 201, 'Test 8: Create collection group with 2 pending bank transfers');
    const cg8Id = cg8Data.collectionGroupId;

    const [cg8Payments] = await pool.query<any[]>(
      'SELECT id FROM fee_payments WHERE collection_group_id = ?',
      [cg8Id]
    );
    const pCg8_1 = cg8Payments[0].id;
    const pCg8_2 = cg8Payments[1].id;

    // -------------------------------------------------------------------------
    // TEST 9: Verify 1 payment of collection group -> group status remains PENDING
    // -------------------------------------------------------------------------
    await fetch(`${baseUrl}/api/fees/payments/${pCg8_1}/verify`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({ action: 'VERIFY', passbookTxRef: 'PB-CG8-A' }),
    });

    const [cg9Rows] = await pool.query<any[]>(
      'SELECT status FROM fee_collection_groups WHERE id = ?',
      [cg8Id]
    );
    assert(cg9Rows[0]?.status === 'PENDING', 'Test 9: Partial verification leaves collection group status PENDING');

    // -------------------------------------------------------------------------
    // TEST 10: Verify 2nd payment of collection group -> group status becomes VERIFIED
    // -------------------------------------------------------------------------
    await fetch(`${baseUrl}/api/fees/payments/${pCg8_2}/verify`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({ action: 'VERIFY', passbookTxRef: 'PB-CG8-B' }),
    });

    const [cg10Rows] = await pool.query<any[]>(
      'SELECT status FROM fee_collection_groups WHERE id = ?',
      [cg8Id]
    );
    assert(cg10Rows[0]?.status === 'VERIFIED', 'Test 10: Complete verification updates collection group status to VERIFIED');

    // -------------------------------------------------------------------------
    // TEST 11: Collection group with rejected payment -> group status becomes REJECTED
    // -------------------------------------------------------------------------
    const cg11Res = await fetch(`${baseUrl}/api/fees/collection-groups`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        studentId,
        payments: [
          {
            destination: 'COLLEGE_ACCOUNT',
            paymentMethod: 'BANK_TRANSFER',
            amount: 2000,
            studentTxRef: 'UTR-CG11-A',
            allocations: [{ accountType: 'COLLEGE', allocatedAmount: 2000, assessmentId }],
          },
        ],
      }),
    });
    const cg11Data = await cg11Res.json();
    const cg11Id = cg11Data.collectionGroupId;
    const [cg11Payments] = await pool.query<any[]>(
      'SELECT id FROM fee_payments WHERE collection_group_id = ?',
      [cg11Id]
    );

    await fetch(`${baseUrl}/api/fees/payments/${cg11Payments[0].id}/verify`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({ action: 'REJECT', rejectionReason: 'Transaction dishonoured' }),
    });

    const [cg11Rows] = await pool.query<any[]>(
      'SELECT status FROM fee_collection_groups WHERE id = ?',
      [cg11Id]
    );
    assert(cg11Rows[0]?.status === 'REJECTED', 'Test 11: Collection group with rejected payment updates status to REJECTED');

    // -------------------------------------------------------------------------
    // TEST 12: Super Admin reverses verified payment with mandatory reason
    // -------------------------------------------------------------------------
    const rev12Res = await fetch(`${baseUrl}/api/fees/payments/${p1Id}/reverse`, {
      method: 'POST',
      headers: makeHeaders(superSession.cookies.session, superSession.data.csrfToken),
      body: JSON.stringify({ reversalReason: 'Duplicate entry correction by Super Admin' }),
    });
    const rev12Data = await rev12Res.json();
    assert(rev12Res.status === 200 && rev12Data.success, 'Test 12: Super Admin reverses verified payment with mandatory reason');

    // -------------------------------------------------------------------------
    // TEST 13: Principal reverses verified payment with mandatory reason
    // -------------------------------------------------------------------------
    const rev13Res = await fetch(`${baseUrl}/api/fees/payments/${p2Id}/reverse`, {
      method: 'POST',
      headers: makeHeaders(principalSession.cookies.session, principalSession.data.csrfToken),
      body: JSON.stringify({ reversalReason: 'Accounting adjustment authorized by Principal' }),
    });
    const rev13Data = await rev13Res.json();
    assert(rev13Res.status === 200 && rev13Data.success, 'Test 13: Principal reverses verified payment');

    // -------------------------------------------------------------------------
    // TEST 14: Office/Staff user reversal attempt is blocked (403 Forbidden)
    // -------------------------------------------------------------------------
    const rev14Res = await fetch(`${baseUrl}/api/fees/payments/${pCg8_1}/reverse`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({ reversalReason: 'Staff unauthorized attempt' }),
    });
    assert(rev14Res.status === 403, 'Test 14: Office/Staff reversal attempt blocked with 403 Forbidden');

    // -------------------------------------------------------------------------
    // TEST 15: Secretary user reversal attempt is blocked (403 Forbidden)
    // -------------------------------------------------------------------------
    const rev15Res = await fetch(`${baseUrl}/api/fees/payments/${pCg8_1}/reverse`, {
      method: 'POST',
      headers: makeHeaders(secretarySession.cookies.session, secretarySession.data.csrfToken),
      body: JSON.stringify({ reversalReason: 'Secretary unauthorized attempt' }),
    });
    assert(rev15Res.status === 403, 'Test 15: Secretary reversal attempt blocked with 403 Forbidden');

    // -------------------------------------------------------------------------
    // TEST 16: Reversal attempt without mandatory reason fails
    // -------------------------------------------------------------------------
    const rev16Res = await fetch(`${baseUrl}/api/fees/payments/${pCg8_1}/reverse`, {
      method: 'POST',
      headers: makeHeaders(superSession.cookies.session, superSession.data.csrfToken),
      body: JSON.stringify({ reversalReason: '' }),
    });
    const rev16Data = await rev16Res.json();
    assert(rev16Res.status === 400 && rev16Data.code === 'MISSING_REASON', 'Test 16: Reversal without reason fails with MISSING_REASON');

    // -------------------------------------------------------------------------
    // TEST 17: Financial ledger recalculation accurately reflects balance after reversal
    // -------------------------------------------------------------------------
    const ledgerRes = await fetch(`${baseUrl}/api/fees/students/${studentId}/financial-ledger`, {
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
    });
    const ledgerData = await ledgerRes.json();
    assert(
      ledgerRes.status === 200 &&
      ledgerData.consolidated.totalVerifiedPaid === 10000 &&
      ledgerData.accounts.COLLEGE.verifiedPaid === 5000,
      'Test 17: Financial ledger accurately reflects verified paid after reversals'
    );

    // -------------------------------------------------------------------------
    // TEST 18: Create annual service billing period and prevent overlapping active period
    // -------------------------------------------------------------------------
    const bp18Res = await fetch(`${baseUrl}/api/fees/services/billing-periods`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        enrollmentId: messBillingPeriodId,
        studentId,
        serviceType: 'MESS',
        periodStartDate: '2026-06-01',
        periodEndDate: '2027-05-31',
        assessedAmount: 30000,
      }),
    });
    const bp18Data = await bp18Res.json();
    assert(
      bp18Res.status === 400 && bp18Data.code === 'OVERLAPPING_BILLING_PERIOD',
      'Test 18: Prevent creation of overlapping active service billing period'
    );

    // -------------------------------------------------------------------------
    // TEST 19: Terminate service enrollment as Principal/Super Admin with mandatory reason
    // -------------------------------------------------------------------------
    const [enrollRows] = await pool.query<any[]>(
      'SELECT id FROM service_enrollments WHERE student_id = ? AND service_type = "MESS" LIMIT 1',
      [studentId]
    );
    const messEnrollmentId = enrollRows[0]?.id;

    const term19Res = await fetch(`${baseUrl}/api/fees/services/enrollments/${messEnrollmentId}/terminate`, {
      method: 'POST',
      headers: makeHeaders(principalSession.cookies.session, principalSession.data.csrfToken),
      body: JSON.stringify({
        effectiveDate: '2026-10-31',
        reason: 'Student opted out of mess service mid-year',
      }),
    });
    const term19Data = await term19Res.json();
    assert(term19Res.status === 200 && term19Data.success, 'Test 19: Principal terminates service enrollment with effective date and mandatory reason');

    // Verify current billing period assessed amount preserved in financial ledger
    const ledgerPostTermRes = await fetch(`${baseUrl}/api/fees/students/${studentId}/financial-ledger`, {
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
    });
    const ledgerPostTermData = await ledgerPostTermRes.json();
    assert(
      ledgerPostTermData.accounts.HOSTEL_MESS.assessedAmount >= 30000,
      'Test 19b: Annual assessed charge remains payable in ledger after service termination'
    );

    // -------------------------------------------------------------------------
    // TEST 20: Office/Staff attempts service termination -> 403 Forbidden
    // -------------------------------------------------------------------------
    const [hostelEnrollRows] = await pool.query<any[]>(
      'SELECT id FROM service_enrollments WHERE student_id = ? AND service_type = "HOSTEL" LIMIT 1',
      [studentId]
    );
    const hostelEnrollmentId = hostelEnrollRows[0]?.id;

    const term20Res = await fetch(`${baseUrl}/api/fees/services/enrollments/${hostelEnrollmentId}/terminate`, {
      method: 'POST',
      headers: makeHeaders(staffSession.cookies.session, staffSession.data.csrfToken),
      body: JSON.stringify({
        effectiveDate: '2026-11-01',
        reason: 'Unauthorized staff attempt',
      }),
    });
    assert(term20Res.status === 403, 'Test 20: Office/Staff service termination attempt blocked with 403 Forbidden');

  } catch (err) {
    console.error('Unhandled error during Stage 3 test execution:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`STAGE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFeesStage3Tests();
