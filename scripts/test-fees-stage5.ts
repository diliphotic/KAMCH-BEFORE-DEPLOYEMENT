import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { checkDatabaseConnection, getPool } from '../server/db.ts';
import { authRouter } from '../server/routes/auth.routes.ts';
import { feesRouter } from '../server/routes/fees.routes.ts';
import { MemoryDatabase } from '../server/services/memory-db.ts';
import { createCollectionGroupPayment, calculateStudentFinancialLedger } from '../server/services/fees-financial.service.ts';
import { generateFeeReport } from '../server/services/fees-reports.service.ts';

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

async function runStage5Tests() {
  console.log('================================================================');
  console.log('KAMCH ERP — FEES MANAGEMENT STAGE 5 FINANCIAL INTEGRITY SUITE');
  console.log('================================================================\n');

  await checkDatabaseConnection();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Set up Express test server with auth and fee routes
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/fees', feesRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const memDb = MemoryDatabase.getInstance();
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    // 1. Reset Fee Tables for pristine testing
    await conn.query('DELETE FROM fee_payment_allocations');
    await conn.query('DELETE FROM fee_receipts');
    await conn.query('DELETE FROM fee_payments');
    await conn.query('DELETE FROM fee_collection_groups');
    await conn.query('DELETE FROM service_billing_periods');
    await conn.query('DELETE FROM service_enrollments');
    await conn.query('DELETE FROM student_fee_assessments');
    await conn.query('DELETE FROM fee_concessions');

    // 2. Provision test users for RBAC audit
    const pwdSuper = genSecret('Super');
    const pwdPrincipal = genSecret('Principal');
    const pwdSecretary = genSecret('Secretary');
    const pwdStaff = genSecret('Staff');
    const pwdFaculty = genSecret('Faculty');
    const pwdStudent = genSecret('Student');

    const uSuperId = memDb.generateId('users');
    const uPrincipalId = memDb.generateId('users');
    const uSecretaryId = memDb.generateId('users');
    const uStaffId = memDb.generateId('users');
    const uFacultyId = memDb.generateId('users');
    const uStudentId = memDb.generateId('users');

    const rSuper = memDb.roles.find((r) => r.code === 'SUPER_ADMIN') || { id: 1 };
    const rPrincipal = memDb.roles.find((r) => r.code === 'PRINCIPAL') || { id: 2 };
    const rSecretary = memDb.roles.find((r) => r.code === 'SECRETARY') || { id: 3 };
    const rStaff = memDb.roles.find((r) => r.code === 'STAFF') || { id: 5 };
    const rFaculty = memDb.roles.find((r) => r.code === 'FACULTY') || { id: 6 };
    const rStudent = memDb.roles.find((r) => r.code === 'STUDENT') || { id: 8 };

    memDb.users.push(
      {
        id: uSuperId,
        username: 'stage5_super',
        email: 'super5@kamch.ac.in',
        password_hash: bcrypt.hashSync(pwdSuper, 10),
        role_id: rSuper.id,
        department_id: null,
        teacher_id: null,
        full_name: 'Super Admin Five',
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
        username: 'stage5_principal',
        email: 'principal5@kamch.ac.in',
        password_hash: bcrypt.hashSync(pwdPrincipal, 10),
        role_id: rPrincipal.id,
        department_id: null,
        teacher_id: null,
        full_name: 'Principal Five',
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
        username: 'stage5_secretary',
        email: 'sec5@kamch.ac.in',
        password_hash: bcrypt.hashSync(pwdSecretary, 10),
        role_id: rSecretary.id,
        department_id: null,
        teacher_id: null,
        full_name: 'Secretary Five',
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
        username: 'stage5_staff',
        email: 'staff5@kamch.ac.in',
        password_hash: bcrypt.hashSync(pwdStaff, 10),
        role_id: rStaff.id,
        department_id: null,
        teacher_id: null,
        full_name: 'Accounts Staff Five',
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
        id: uStudentId,
        username: 'stage5_student',
        email: 'student5@kamch.ac.in',
        password_hash: bcrypt.hashSync(pwdStudent, 10),
        role_id: rStudent.id,
        department_id: null,
        teacher_id: null,
        full_name: 'Student Five',
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
        id: uFacultyId,
        username: 'stage5_faculty',
        email: 'faculty5@kamch.ac.in',
        password_hash: bcrypt.hashSync(pwdFaculty, 10),
        role_id: rFaculty.id,
        department_id: 1,
        teacher_id: null,
        full_name: 'Dr. Faculty Member',
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

    // Login helpers
    async function login(username: string, password: string) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: username, password }),
      });
      const data = await res.json();
      const cookies = extractCookies(res);
      const csrfToken = data.csrfToken || cookies.csrf;
      return { status: res.status, data, cookies, csrfToken };
    }

    const superAuth = await login('stage5_super', pwdSuper);
    const principalAuth = await login('stage5_principal', pwdPrincipal);
    const secretaryAuth = await login('stage5_secretary', pwdSecretary);
    const staffAuth = await login('stage5_staff', pwdStaff);
    const facultyAuth = await login('stage5_faculty', pwdFaculty);
    const studentAuth = await login('stage5_student', pwdStudent);

    // Setup Test Students
    // Student 101: Primary student
    const [existingStudent1] = await conn.query<any[]>('SELECT id FROM students WHERE id = ?', [101]);
    if (!existingStudent1 || existingStudent1.length === 0) {
      await conn.query(
        `INSERT INTO students (id, student_id_number, full_name, admission_category, admission_year, current_year_of_study, mess_enrolled, hostel_enrolled, status)
         VALUES (101, 'KAMCH-2026-101', 'Anand Kumar', 'GOVERNMENT', 2026, 1, TRUE, TRUE, 'ACTIVE')`
      );
    }

    // Student 102: Secondary student (for cross-student checks)
    const [existingStudent2] = await conn.query<any[]>('SELECT id FROM students WHERE id = ?', [102]);
    if (!existingStudent2 || existingStudent2.length === 0) {
      await conn.query(
        `INSERT INTO students (id, student_id_number, full_name, admission_category, admission_year, current_year_of_study, mess_enrolled, hostel_enrolled, status)
         VALUES (102, 'KAMCH-2026-102', 'Bhavya Rao', 'MANAGEMENT_PRIVATE', 2026, 1, FALSE, FALSE, 'ACTIVE')`
      );
    }

    // Student 101 assessments & billing periods
    const [aRes101] = await conn.query<any>(
      `INSERT INTO student_fee_assessments (student_id, academic_year, year_of_study, admission_category, assessed_college_fee, assessed_development_fee, assessed_mess_fee, assessed_hostel_fee, total_assessed_fee, concession_total, revised_payable, assessed_by)
       VALUES (101, '2026-2027', 1, 'GOVERNMENT', 75750, 50000, 30000, 30000, 185750, 0, 185750, 1)`
    );
    const assess101 = aRes101.insertId || 101;

    // Student 102 assessment
    const [aRes102] = await conn.query<any>(
      `INSERT INTO student_fee_assessments (student_id, academic_year, year_of_study, admission_category, assessed_college_fee, assessed_development_fee, assessed_mess_fee, assessed_hostel_fee, total_assessed_fee, concession_total, revised_payable, assessed_by)
       VALUES (102, '2026-2027', 1, 'MANAGEMENT_PRIVATE', 400000, 0, 0, 0, 400000, 0, 400000, 1)`
    );
    const assess102 = aRes102.insertId || 102;

    // Enrollments & billing periods for student 101
    const [enHostel] = await conn.query<any>(
      `INSERT INTO service_enrollments (student_id, service_type, start_date, annual_fee, status, created_by)
       VALUES (101, 'HOSTEL', '2026-11-01', 30000, 'ACTIVE', 1)`
    );
    const [bpHos] = await conn.query<any>(
      `INSERT INTO service_billing_periods (enrollment_id, student_id, service_type, period_start_date, period_end_date, assessed_amount, status)
       VALUES (?, 101, 'HOSTEL', '2026-11-01', '2027-10-31', 30000, 'ACTIVE')`,
      [enHostel.insertId]
    );
    const billingPeriodHostel101 = bpHos.insertId;

    const [enMess] = await conn.query<any>(
      `INSERT INTO service_enrollments (student_id, service_type, start_date, annual_fee, status, created_by)
       VALUES (101, 'MESS', '2026-11-01', 30000, 'ACTIVE', 1)`
    );
    const [bpMess] = await conn.query<any>(
      `INSERT INTO service_billing_periods (enrollment_id, student_id, service_type, period_start_date, period_end_date, assessed_amount, status)
       VALUES (?, 101, 'MESS', '2026-11-01', '2027-10-31', 30000, 'ACTIVE')`,
      [enMess.insertId]
    );
    const billingPeriodMess101 = bpMess.insertId;

    console.log('--- SCENARIO 1: One collection containing all three accounts ---');
    const cg1 = await createCollectionGroupPayment(
      {
        studentId: 101,
        paymentDate: '2026-11-03',
        recordedBy: uStaffId,
        notes: 'Scenario 1 all three accounts',
        payments: [
          {
            destination: 'COLLEGE_ACCOUNT',
            paymentMethod: 'CASH',
            amount: 35000,
            allocations: [
              { accountType: 'COLLEGE', allocatedAmount: 20000, assessmentId: assess101 },
              { accountType: 'HOSTEL_MESS', allocatedAmount: 15000, billingPeriodId: billingPeriodHostel101 },
            ],
          },
          {
            destination: 'SECRETARY_DEV_ACCOUNT',
            paymentMethod: 'CASH',
            amount: 15000,
            allocations: [
              { accountType: 'DEVELOPMENT', allocatedAmount: 15000, assessmentId: assess101 },
            ],
          },
        ],
      },
      conn
    );
    assert(Boolean(cg1.collectionGroupId), 'Scenario 1: Created collection group containing all 3 accounts (ID: ' + cg1.collectionGroupId + ')');
    const [p1] = await conn.query<any[]>('SELECT * FROM fee_payments WHERE collection_group_id = ?', [cg1.collectionGroupId]);
    assert(p1.length === 2, 'Scenario 1: Exactly 2 destination payments created for 3 accounts');

    console.log('\n--- SCENARIO 2: One collection containing only College Fees ---');
    const cg2 = await createCollectionGroupPayment(
      {
        studentId: 101,
        paymentDate: '2026-11-03',
        recordedBy: uStaffId,
        notes: 'Scenario 2 College fee only',
        payments: [
          {
            destination: 'COLLEGE_ACCOUNT',
            paymentMethod: 'CASH',
            amount: 10000,
            allocations: [
              { accountType: 'COLLEGE', allocatedAmount: 10000, assessmentId: assess101 },
            ],
          },
        ],
      },
      conn
    );
    assert(Boolean(cg2.collectionGroupId), 'Scenario 2: Single-account College Fee collection group created');

    console.log('\n--- SCENARIO 3: One collection containing only Development Fees ---');
    const cg3 = await createCollectionGroupPayment(
      {
        studentId: 101,
        paymentDate: '2026-11-03',
        recordedBy: uStaffId,
        notes: 'Scenario 3 Dev fee only',
        payments: [
          {
            destination: 'SECRETARY_DEV_ACCOUNT',
            paymentMethod: 'CASH',
            amount: 5000,
            allocations: [
              { accountType: 'DEVELOPMENT', allocatedAmount: 5000, assessmentId: assess101 },
            ],
          },
        ],
      },
      conn
    );
    assert(Boolean(cg3.collectionGroupId), 'Scenario 3: Single-account Development Fee collection group created');

    console.log('\n--- SCENARIO 4: One collection containing only Hostel & Mess Fees ---');
    const cg4 = await createCollectionGroupPayment(
      {
        studentId: 101,
        paymentDate: '2026-11-03',
        recordedBy: uStaffId,
        notes: 'Scenario 4 Hostel/Mess only',
        payments: [
          {
            destination: 'COLLEGE_ACCOUNT',
            paymentMethod: 'CASH',
            amount: 8000,
            allocations: [
              { accountType: 'HOSTEL_MESS', allocatedAmount: 8000, billingPeriodId: billingPeriodMess101 },
            ],
          },
        ],
      },
      conn
    );
    assert(Boolean(cg4.collectionGroupId), 'Scenario 4: Single-account Hostel/Mess Fee collection group created');

    console.log('\n--- SCENARIO 5: One collection spanning both bank destinations ---');
    const cg5 = await createCollectionGroupPayment(
      {
        studentId: 101,
        paymentDate: '2026-11-03',
        recordedBy: uStaffId,
        notes: 'Scenario 5 Multi-destination',
        payments: [
          {
            destination: 'COLLEGE_ACCOUNT',
            paymentMethod: 'BANK_TRANSFER',
            studentTxRef: 'UTR-S5-COL-999',
            amount: 12000,
            allocations: [
              { accountType: 'COLLEGE', allocatedAmount: 12000, assessmentId: assess101 },
            ],
          },
          {
            destination: 'SECRETARY_DEV_ACCOUNT',
            paymentMethod: 'ONLINE_DEV',
            studentTxRef: 'DEV-TX-S5-888',
            amount: 8000,
            allocations: [
              { accountType: 'DEVELOPMENT', allocatedAmount: 8000, assessmentId: assess101 },
            ],
          },
        ],
      },
      conn
    );
    const [cg5Rows] = await conn.query<any[]>('SELECT * FROM fee_collection_groups WHERE id = ?', [cg5.collectionGroupId]);
    assert(parseFloat(cg5Rows[0].total_amount) === 20000, 'Scenario 5: Total collection group matches sum of payments (₹20,000)');
    assert(cg5Rows[0].status === 'PENDING', 'Scenario 5: Multi-destination bank transfer starts with PENDING status');

    console.log('\n--- SCENARIO 6: Partial verification of a multi-destination collection ---');
    const [s5Payments] = await conn.query<any[]>('SELECT * FROM fee_payments WHERE collection_group_id = ?', [cg5.collectionGroupId]);
    const colPay = s5Payments.find((p: any) => p.destination === 'COLLEGE_ACCOUNT');
    const devPay = s5Payments.find((p: any) => p.destination === 'SECRETARY_DEV_ACCOUNT');

    // Verify COLLEGE_ACCOUNT transaction via API
    const vRes1 = await fetch(`${baseUrl}/api/fees/payments/${colPay.id}/verify`, {
      method: 'POST',
      headers: makeHeaders(superAuth.cookies.session, superAuth.csrfToken),
      body: JSON.stringify({ action: 'VERIFY', passbookTxRef: 'PBK-S6-VERIFIED-01' }),
    });
    assert(vRes1.status === 200, 'Scenario 6: College account bank transfer verified via Super Admin');

    // Check parent collection group status: should remain PENDING because devPay is still pending
    const [cg5AfterPart] = await conn.query<any[]>('SELECT * FROM fee_collection_groups WHERE id = ?', [cg5.collectionGroupId]);
    assert(cg5AfterPart[0].status === 'PENDING', 'Scenario 6: Parent collection group remains PENDING while one payment transaction is pending');

    console.log('\n--- SCENARIO 7: Rejection of one underlying transaction ---');
    // Reject devPay
    const rRes = await fetch(`${baseUrl}/api/fees/payments/${devPay.id}/verify`, {
      method: 'POST',
      headers: makeHeaders(superAuth.cookies.session, superAuth.csrfToken),
      body: JSON.stringify({ action: 'REJECT', rejectionReason: 'UTR not credited in Secretary Dev account' }),
    });
    assert(rRes.status === 200, 'Scenario 7: Secretary Dev bank transfer rejected with mandatory reason');

    const [cg5AfterRej] = await conn.query<any[]>('SELECT * FROM fee_collection_groups WHERE id = ?', [cg5.collectionGroupId]);
    assert(cg5AfterRej[0].status === 'REJECTED', 'Scenario 7: Collection group reflects REJECTED when any payment transaction is rejected');
    const [pRejRows] = await conn.query<any[]>('SELECT status, rejection_reason FROM fee_payments WHERE id = ?', [devPay.id]);
    assert(pRejRows[0].status === 'REJECTED' && pRejRows[0].rejection_reason.includes('not credited'), 'Scenario 7: Underlying transaction status and reason preserved');

    console.log('\n--- SCENARIO 8: Reversal of one transaction in a partially verified collection ---');
    // Reverse the verified colPay transaction
    const revRes = await fetch(`${baseUrl}/api/fees/payments/${colPay.id}/reverse`, {
      method: 'POST',
      headers: makeHeaders(principalAuth.cookies.session, principalAuth.csrfToken),
      body: JSON.stringify({ reversalReason: 'Bounced cheque / Bank chargeback reversed by Principal' }),
    });
    assert(revRes.status === 200, 'Scenario 8: Verified payment reversed by Principal');
    const [pRevRows] = await conn.query<any[]>('SELECT status, reversal_reason, reversed_by FROM fee_payments WHERE id = ?', [colPay.id]);
    assert(pRevRows[0].status === 'REVERSED', 'Scenario 8: Payment status set to REVERSED');
    assert(pRevRows[0].reversal_reason.includes('chargeback'), 'Scenario 8: Reversal reason recorded');

    // Verify associated receipt is REVERSED (not deleted or marked REJECTED)
    const [rcpRevRows] = await conn.query<any[]>(
      'SELECT * FROM fee_receipts WHERE collection_group_id = ? OR payment_id = ?',
      [cg5.collectionGroupId, colPay.id]
    );
    assert(rcpRevRows.length > 0 && rcpRevRows[0].status === 'REVERSED', 'Scenario 8: Receipt status set to REVERSED');

    console.log('\n--- SCENARIO 9: Duplicate collection submission ---');
    // Record payment with unique UTR
    const uniqueUtr = 'UTR-DUP-CHECK-111';
    await conn.query(
      `INSERT INTO fee_payments (assessment_id, student_id, payment_reference, amount, destination, payment_method, student_tx_ref, bank_transaction_ref, payment_date, recorded_by, status)
       VALUES (?, 101, 'PAY-DUP-1', 5000, 'COLLEGE_ACCOUNT', 'BANK_TRANSFER', ?, ?, '2026-11-03', 1, 'PENDING_VERIFICATION')`,
      [assess101, uniqueUtr, uniqueUtr]
    );

    // Attempting to record second payment with same UTR must fail
    const dupRes = await fetch(`${baseUrl}/api/fees/payments`, {
      method: 'POST',
      headers: makeHeaders(staffAuth.cookies.session, staffAuth.csrfToken),
      body: JSON.stringify({
        studentId: 101,
        assessmentId: assess101,
        amount: 5000,
        destination: 'COLLEGE_ACCOUNT',
        paymentMethod: 'BANK_TRANSFER',
        studentTxRef: uniqueUtr,
      }),
    });
    assert(dupRes.status === 409, 'Scenario 9: Duplicate bank transfer submission rejected with 409 Conflict');

    console.log('\n--- SCENARIO 10: Excess payment and advance/credit calculation ---');
    // Create student 103 with small fee
    await conn.query(
      `INSERT INTO students (id, student_id_number, full_name, admission_category, admission_year, current_year_of_study, status)
       VALUES (103, 'KAMCH-2026-103', 'Chaitra Hegde', 'GOVERNMENT', 2026, 1, 'ACTIVE')`
    );
    const [a103Res] = await conn.query<any>(
      `INSERT INTO student_fee_assessments (student_id, academic_year, year_of_study, admission_category, assessed_college_fee, assessed_development_fee, total_assessed_fee, concession_total, revised_payable, assessed_by)
       VALUES (103, '2026-2027', 1, 'GOVERNMENT', 10000, 5000, 15000, 0, 15000, 1)`
    );
    const a103 = a103Res.insertId;

    // Record verified payment of 20000 (exceeding 15000)
    const [pExcess] = await conn.query<any>(
      `INSERT INTO fee_payments (assessment_id, student_id, payment_reference, amount, destination, payment_method, payment_date, recorded_by, status)
       VALUES (?, 103, 'PAY-EXCESS-1', 20000, 'COLLEGE_ACCOUNT', 'CASH', '2026-11-03', 1, 'VERIFIED')`,
      [a103]
    );
    await conn.query(
      `INSERT INTO fee_payment_allocations (payment_id, account_type, allocated_amount, assessment_id)
       VALUES (?, 'COLLEGE', 20000, ?)`,
      [pExcess.insertId, a103]
    );

    const ledger103 = await calculateStudentFinancialLedger(103);
    assert(ledger103.consolidated.totalExcessCredit === 10000, 'Scenario 10: Advance/credit calculated accurately (₹10,000 excess on ₹10,000 college assessment)');
    assert(ledger103.accounts.COLLEGE.outstandingBalance === 0, 'Scenario 10: Outstanding balance floored at 0 without negative balances');

    console.log('\n--- SCENARIO 11: Cross-student allocation rejection ---');
    let crossStudentRejected = false;
    try {
      await createCollectionGroupPayment(
        {
          studentId: 101, // Student 101
          paymentDate: '2026-11-03',
          recordedBy: uStaffId,
          payments: [
            {
              destination: 'COLLEGE_ACCOUNT',
              paymentMethod: 'CASH',
              amount: 5000,
              allocations: [
                { accountType: 'COLLEGE', allocatedAmount: 5000, assessmentId: assess102 }, // Belongs to Student 102!
              ],
            },
          ],
        },
        conn
      );
    } catch (err: any) {
      crossStudentRejected = err.message.includes('does not belong to student');
    }
    assert(crossStudentRejected, 'Scenario 11: Cross-student allocation rejected with target student mismatch error');

    console.log('\n--- SCENARIO 12: Allocation sum mismatch rejection ---');
    let allocSumMismatchRejected = false;
    try {
      await createCollectionGroupPayment(
        {
          studentId: 101,
          paymentDate: '2026-11-03',
          recordedBy: uStaffId,
          payments: [
            {
              destination: 'COLLEGE_ACCOUNT',
              paymentMethod: 'CASH',
              amount: 10000,
              allocations: [
                { accountType: 'COLLEGE', allocatedAmount: 6000, assessmentId: assess101 }, // 6000 != 10000
              ],
            },
          ],
        },
        conn
      );
    } catch (err: any) {
      allocSumMismatchRejected = err.message.includes('does not equal underlying payment amount');
    }
    assert(allocSumMismatchRejected, 'Scenario 12: Allocation sum mismatch rejected');

    console.log('\n--- SCENARIO 13: Destination mismatch rejection ---');
    let destMismatchRejected = false;
    try {
      await createCollectionGroupPayment(
        {
          studentId: 101,
          paymentDate: '2026-11-03',
          recordedBy: uStaffId,
          payments: [
            {
              destination: 'SECRETARY_DEV_ACCOUNT', // Destination is Dev Account
              paymentMethod: 'CASH',
              amount: 5000,
              allocations: [
                { accountType: 'COLLEGE', allocatedAmount: 5000, assessmentId: assess101 }, // But allocating to COLLEGE!
              ],
            },
          ],
        },
        conn
      );
    } catch (err: any) {
      destMismatchRejected = err.message.includes('cannot be received into');
    }
    assert(destMismatchRejected, 'Scenario 13: Destination mismatch rejected (COLLEGE fee cannot go into SECRETARY_DEV_ACCOUNT)');

    console.log('\n--- SCENARIO 14: Legacy payment and receipt preservation ---');
    // Insert legacy record without collection_group_id
    const [legacyPay] = await conn.query<any>(
      `INSERT INTO fee_payments (assessment_id, student_id, payment_reference, amount, destination, payment_method, payment_date, recorded_by, status)
       VALUES (?, 102, 'PAY-LEGACY-001', 50000, 'COLLEGE_ACCOUNT', 'CASH', '2026-10-15', 1, 'VERIFIED')`,
      [assess102]
    );
    const [legacyRcp] = await conn.query<any>(
      `INSERT INTO fee_receipts (payment_id, student_id, receipt_number, receipt_type, destination, amount, requested_by, status)
       VALUES (?, 102, 'KAMCH/RCP/2026/LEGACY', 'FINAL_COLLEGE_RECEIPT', 'COLLEGE_ACCOUNT', 50000, 1, 'APPROVED')`,
      [legacyPay.insertId]
    );
    // Fetch via receipts endpoint
    const legRes = await fetch(`${baseUrl}/api/fees/receipts/${legacyRcp.insertId}`, {
      headers: makeHeaders(staffAuth.cookies.session, staffAuth.csrfToken),
    });
    assert(legRes.status === 200, 'Scenario 14: Legacy receipt accessible via GET /api/fees/receipts/:id');

    console.log('\n--- SCENARIO 15: Historical / unallocated payment handling ---');
    // Calculate ledger for student 102 with unallocated legacy payment
    const ledger102 = await calculateStudentFinancialLedger(102);
    assert(ledger102.accounts.COLLEGE.verifiedPaid === 50000, 'Scenario 15: Historical payment without allocation mapped to destination account (₹50,000)');

    console.log('\n--- SCENARIO 16: Duplicate verification prevention ---');
    // Attempting to re-verify an already reversed/rejected or verified payment
    const dupVerRes = await fetch(`${baseUrl}/api/fees/payments/${colPay.id}/verify`, {
      method: 'POST',
      headers: makeHeaders(superAuth.cookies.session, superAuth.csrfToken),
      body: JSON.stringify({ action: 'VERIFY', passbookTxRef: 'PBK-REVERIFY-ATTEMPT' }),
    });
    assert(dupVerRes.status === 400, 'Scenario 16: Duplicate verification on already processed payment rejected with 400');

    console.log('\n--- SCENARIO 17: Unauthorized reversal and termination attempts ---');
    // 1. Staff attempting reversal
    const staffRevRes = await fetch(`${baseUrl}/api/fees/payments/${legacyPay.insertId}/reverse`, {
      method: 'POST',
      headers: makeHeaders(staffAuth.cookies.session, staffAuth.csrfToken),
      body: JSON.stringify({ reversalReason: 'Unauthorized staff reversal' }),
    });
    assert(staffRevRes.status === 403, 'Scenario 17: Office staff blocked from reversing payment (403)');

    // 2. Secretary attempting reversal
    const secRevRes = await fetch(`${baseUrl}/api/fees/payments/${legacyPay.insertId}/reverse`, {
      method: 'POST',
      headers: makeHeaders(secretaryAuth.cookies.session, secretaryAuth.csrfToken),
      body: JSON.stringify({ reversalReason: 'Secretary unauthorized reversal' }),
    });
    assert(secRevRes.status === 403, 'Scenario 17: Secretary blocked from reversing payment (403)');

    // 3. Staff attempting service termination
    const staffTermRes = await fetch(`${baseUrl}/api/fees/services/enrollments/${enHostel.insertId}/terminate`, {
      method: 'POST',
      headers: makeHeaders(staffAuth.cookies.session, staffAuth.csrfToken),
      body: JSON.stringify({ reason: 'Unauthorized termination attempt' }),
    });
    assert(staffTermRes.status === 403, 'Scenario 17: Office staff blocked from terminating services (403)');

    // 4. Department / Faculty attempting fee modification
    const facRevRes = await fetch(`${baseUrl}/api/fees/payments/${legacyPay.insertId}/reverse`, {
      method: 'POST',
      headers: makeHeaders(facultyAuth.cookies.session, facultyAuth.csrfToken),
      body: JSON.stringify({ reversalReason: 'Faculty fee modification attempt' }),
    });
    assert(facRevRes.status === 403, 'Scenario 17: Department and faculty roles blocked from payment reversal (403)');
    assert(studentAuth.status === 401 && studentAuth.data.code === 'INVALID_CREDENTIALS', 'Scenario 17: Student accounts disabled from login and financial access (401)');

    console.log('\n--- SCENARIO 18: Hostel/Mess annual billing and termination behavior ---');
    // Super Admin terminates Hostel enrollment
    const termRes = await fetch(`${baseUrl}/api/fees/services/enrollments/${enHostel.insertId}/terminate`, {
      method: 'POST',
      headers: makeHeaders(superAuth.cookies.session, superAuth.csrfToken),
      body: JSON.stringify({ reason: 'Student moved to local guardian accommodation', effectiveDate: '2026-11-03' }),
    });
    assert(termRes.status === 200, 'Scenario 18: Service enrollment terminated by Super Admin');

    // Check billing period remains intact with full annual charge payable
    const [bpTermRows] = await conn.query<any[]>('SELECT * FROM service_billing_periods WHERE enrollment_id = ?', [enHostel.insertId]);
    assert(bpTermRows[0].status === 'TERMINATED', 'Scenario 18: Service billing period status set to TERMINATED');
    assert(parseFloat(bpTermRows[0].assessed_amount) === 30000, 'Scenario 18: Full annual assessed amount remains payable (₹30,000)');

    console.log('\n--- TESTING 8 FINANCIAL REPORTS & NON-DOUBLE-COUNTING ---');
    const r1 = await generateFeeReport({ reportType: 'COLLEGE_FEES' });
    assert(r1.reportType === 'COLLEGE_FEES', 'Report 1: College Fee Collection Report generated');

    const r2 = await generateFeeReport({ reportType: 'DEVELOPMENT_FEES' });
    assert(r2.reportType === 'DEVELOPMENT_FEES', 'Report 2: Development Fee Collection Report generated');

    const r3 = await generateFeeReport({ reportType: 'HOSTEL_MESS' });
    assert(r3.reportType === 'HOSTEL_MESS', 'Report 3: Hostel & Mess Collection Report generated');

    const r4 = await generateFeeReport({ reportType: 'BANK_DESTINATION' });
    assert(r4.reportType === 'BANK_DESTINATION', 'Report 4: Bank Destination-wise Collection Report generated');

    const r5 = await generateFeeReport({ reportType: 'PENDING_VERIFICATION' });
    assert(r5.reportType === 'PENDING_VERIFICATION', 'Report 5: Pending Passbook Verification Report generated');

    const r6 = await generateFeeReport({ reportType: 'REVERSED_PAYMENTS' });
    assert(r6.reportType === 'REVERSED_PAYMENTS', 'Report 6: Reversed Payment Audit Report generated');

    const r7 = await generateFeeReport({ reportType: 'STUDENT_OUTSTANDING' });
    assert(r7.reportType === 'STUDENT_OUTSTANDING', 'Report 7: Student Outstanding Report generated');

    const r8 = await generateFeeReport({ reportType: 'CONSOLIDATED_SUMMARY' });
    assert(r8.reportType === 'CONSOLIDATED_SUMMARY', 'Report 8: Consolidated Financial Summary generated');

    // Non-double-counting check: Consolidated verified sum must equal college + dev collections
    const sumDest = (r8 as any).summary.verifiedCollections.collegeAccount + (r8 as any).summary.verifiedCollections.secretaryDevAccount;
    assert((r8 as any).summary.verifiedCollections.total === sumDest, 'Non-Double-Counting Check: Total verified equals sum of destination accounts without duplicates');

    console.log('\n================================================================');
    console.log(`STAGE 5 INTEGRITY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    conn.release();
    server.close();
  }
}

runStage5Tests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
