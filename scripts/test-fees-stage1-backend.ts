import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { checkDatabaseConnection, getPool } from '../server/db.ts';
import { authRouter } from '../server/routes/auth.routes.ts';
import { feesRouter } from '../server/routes/fees.routes.ts';
import { MemoryDatabase } from '../server/services/memory-db.ts';
import { calculateStudentFinancialLedger } from '../server/services/fees-financial.service.ts';

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

async function runStage1BackendTestSuite() {
  console.log('========================================================================');
  console.log('KAMCH ERP — STAGE 1 APPROVED FEES MANAGEMENT BACKEND ARCHITECTURE TEST');
  console.log('========================================================================\n');

  await checkDatabaseConnection();
  const pool = getPool();
  const conn = await pool.getConnection();

  const memDb = MemoryDatabase.getInstance();
  const pwdSuper = genSecret('Super');
  const pwdPrincipal = genSecret('Princ');
  const pwdOffice = genSecret('Office');
  const pwdSecretary = genSecret('Sec');

  const rSuper = memDb.roles.find((r) => r.code === 'SUPER_ADMIN')!;
  const rPrincipal = memDb.roles.find((r) => r.code === 'PRINCIPAL')!;
  const rOffice = memDb.roles.find((r) => r.code === 'OFFICE')!;
  const rSecretary = memDb.roles.find((r) => r.code === 'SECRETARY')!;

  const uSuperId = memDb.generateId('users');
  const uPrincipalId = memDb.generateId('users');
  const uOfficeId = memDb.generateId('users');
  const uSecretaryId = memDb.generateId('users');

  memDb.users.push(
    {
      id: uSuperId,
      username: 'super_stage1',
      email: 'super1@kamch.ac.in',
      password_hash: bcrypt.hashSync(pwdSuper, 10),
      role_id: rSuper.id,
      department_id: null,
      teacher_id: null,
      full_name: 'Super Admin Stage1',
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
      username: 'principal_stage1',
      email: 'principal1@kamch.ac.in',
      password_hash: bcrypt.hashSync(pwdPrincipal, 10),
      role_id: rPrincipal.id,
      department_id: null,
      teacher_id: null,
      full_name: 'Principal Stage1',
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
      id: uOfficeId,
      username: 'office_stage1',
      email: 'office1@kamch.ac.in',
      password_hash: bcrypt.hashSync(pwdOffice, 10),
      role_id: rOffice.id,
      department_id: null,
      teacher_id: null,
      full_name: 'Office Staff Stage1',
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
      username: 'secretary_stage1',
      email: 'sec1@kamch.ac.in',
      password_hash: bcrypt.hashSync(pwdSecretary, 10),
      role_id: rSecretary.id,
      department_id: null,
      teacher_id: null,
      full_name: 'Secretary Stage1',
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
    async function login(username: string, pwd: string) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: username, password: pwd }),
      });
      const cookies = extractCookies(res);
      const data = await res.json();
      return { cookies, data };
    }

    const superAuth = await login('super_stage1', pwdSuper);
    const princAuth = await login('principal_stage1', pwdPrincipal);
    const officeAuth = await login('office_stage1', pwdOffice);
    const secAuth = await login('secretary_stage1', pwdSecretary);

    // =========================================================================
    // SECTION 1: ACADEMIC YEAR SETTINGS SINGLETON (Nov 30 default)
    // =========================================================================
    console.log('\n--- 1. Academic Year Settings Singleton & Configuration ---');
    const aysGetRes = await fetch(`${baseUrl}/api/fees/settings/academic-year`, {
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
    });
    const aysGetData = await aysGetRes.json();
    assert(aysGetRes.status === 200, 'GET /api/fees/settings/academic-year returns 200 OK');
    assert(aysGetData.commencementMonth === 11 && aysGetData.commencementDay === 30, 'Default commencement date is November 30 (month 11, day 30)');

    // Principal updates commencement date to November 15
    const aysPostRes = await fetch(`${baseUrl}/api/fees/settings/academic-year`, {
      method: 'POST',
      headers: makeHeaders(princAuth.cookies.session, princAuth.data.csrfToken),
      body: JSON.stringify({ commencementMonth: 11, commencementDay: 15 }),
    });
    const aysPostData = await aysPostRes.json();
    assert(aysPostRes.status === 200 && aysPostData.commencementDay === 15, 'Principal can update academic year commencement date');

    // Secretary is blocked from updating academic year settings
    const aysSecRes = await fetch(`${baseUrl}/api/fees/settings/academic-year`, {
      method: 'POST',
      headers: makeHeaders(secAuth.cookies.session, secAuth.data.csrfToken),
      body: JSON.stringify({ commencementMonth: 10, commencementDay: 1 }),
    });
    assert(aysSecRes.status === 403, 'Secretary is forbidden from modifying academic year settings (403)');

    // Restore to Nov 30
    await fetch(`${baseUrl}/api/fees/settings/academic-year`, {
      method: 'POST',
      headers: makeHeaders(princAuth.cookies.session, princAuth.data.csrfToken),
      body: JSON.stringify({ commencementMonth: 11, commencementDay: 30 }),
    });

    // =========================================================================
    // SECTION 2: STUDENT SETUP & 4-COMPONENT ASSESSMENT INITIALIZATION
    // =========================================================================
    console.log('\n--- 2. Student Setup & Assessment Initialization ---');
    const [stRes] = await conn.query<any>(
      `INSERT INTO students (student_id_number, full_name, admission_category, admission_year, current_year_of_study, is_kea_eligible, mess_enrolled, hostel_enrolled, status)
       VALUES ('KAMCH-2026-ARCH-01', 'Ananya Shenoy', 'GOVERNMENT', 2026, 1, FALSE, TRUE, TRUE, 'ACTIVE')`
    );
    const studentId = stRes.insertId;

    const initRes = await fetch(`${baseUrl}/api/fees/students/${studentId}/initialize-assessment`, {
      method: 'POST',
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
      body: JSON.stringify({ messEnrolled: true, hostelEnrolled: true }),
    });
    const initData = await initRes.json();
    assert(initRes.status === 201, 'Office staff initialized fee assessment successfully');
    const assessmentId = initData.assessmentId;

    // Check 4-component ledger
    const ledger1 = await calculateStudentFinancialLedger(studentId);
    assert(ledger1.components.COLLEGE.assessedAmount === 75750, 'College assessed fee is ₹75,750');
    assert(ledger1.components.DEVELOPMENT.assessedAmount === 50000, 'Development assessed fee is ₹50,000');
    assert(ledger1.components.HOSTEL.assessedAmount === 30000, 'Hostel assessed fee is ₹30,000');
    assert(ledger1.components.MESS.assessedAmount === 30000, 'Mess assessed fee is ₹30,000');
    assert(ledger1.consolidated.totalNetPayable === 185750, 'Total net payable is ₹1,85,750');

    // =========================================================================
    // SECTION 3: CONCESSION RULES ENFORCEMENT
    // =========================================================================
    console.log('\n--- 3. Concession Rules Enforcement ---');
    // Attempting new ALL concession must be rejected with 400 ALL_CONCESSION_DISABLED
    const allConcRes = await fetch(`${baseUrl}/api/fees/concessions`, {
      method: 'POST',
      headers: makeHeaders(princAuth.cookies.session, princAuth.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        feeComponent: 'ALL',
        concessionType: 'MERIT',
        value: 10000,
        reason: 'Attempted ALL concession',
      }),
    });
    const allConcData = await allConcRes.json();
    assert(allConcRes.status === 400 && allConcData.code === 'ALL_CONCESSION_DISABLED', 'Server strictly rejects new ALL concession with ALL_CONCESSION_DISABLED');

    // Secretary cannot grant concessions (403)
    const secConcRes = await fetch(`${baseUrl}/api/fees/concessions`, {
      method: 'POST',
      headers: makeHeaders(secAuth.cookies.session, secAuth.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        feeComponent: 'DEVELOPMENT',
        concessionType: 'FIXED',
        value: 5000,
        reason: 'Secretary concession attempt',
      }),
    });
    assert(secConcRes.status === 403, 'Secretary is forbidden from creating fee concessions (403)');

    // Principal grants valid component-specific concession (e.g. ₹5,000 on DEVELOPMENT)
    const devConcRes = await fetch(`${baseUrl}/api/fees/concessions`, {
      method: 'POST',
      headers: makeHeaders(princAuth.cookies.session, princAuth.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        feeComponent: 'DEVELOPMENT',
        concessionType: 'FIXED',
        value: 5000,
        reason: 'Merit concession on Development fee',
      }),
    });
    const devConcData = await devConcRes.json();
    if (devConcRes.status !== 201) console.error('devConcRes failed:', devConcRes.status, devConcData);
    assert(devConcRes.status === 201, 'Principal successfully creates ₹5,000 concession on DEVELOPMENT component');

    // Concession exceeding component fee ceiling is rejected
    const excessConcRes = await fetch(`${baseUrl}/api/fees/concessions`, {
      method: 'POST',
      headers: makeHeaders(princAuth.cookies.session, princAuth.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        feeComponent: 'DEVELOPMENT',
        concessionType: 'FIXED',
        value: 50000, // Remaining is 45,000
        reason: 'Excess concession attempt',
      }),
    });
    assert(excessConcRes.status === 400, 'Server rejects concession exceeding component fee ceiling');

    // Verify revised net payable after concession
    const ledger2 = await calculateStudentFinancialLedger(studentId);
    assert(ledger2.components.DEVELOPMENT.netPayable === 45000, 'Development net payable reduced to ₹45,000 (A_c - D_c)');
    assert(ledger2.consolidated.totalNetPayable === 180750, 'Consolidated net payable reduced to ₹1,80,750');

    // =========================================================================
    // SECTION 4: CASH PAYMENT FLOW & ATOMIC RECEIPT ISSUANCE
    // =========================================================================
    console.log('\n--- 4. Single-Component Cash Payment & Atomic Receipt Generation ---');
    // Cash payment for COLLEGE fee into COLLEGE_ACCOUNT (₹25,000)
    const cashPayRes = await fetch(`${baseUrl}/api/fees/payments`, {
      method: 'POST',
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        feeComponent: 'COLLEGE',
        destination: 'COLLEGE_ACCOUNT',
        paymentMethod: 'CASH',
        amount: 25000,
        paymentDate: '2026-11-05',
        notes: 'First installment college fee in cash',
      }),
    });
    const cashPayData = await cashPayRes.json();
    assert(cashPayRes.status === 201 && cashPayData.status === 'VERIFIED', 'Cash payment immediately created in VERIFIED status');
    assert(Boolean(cashPayData.receiptNumber), `Immediate atomic receipt issued: ${cashPayData.receiptNumber}`);
    assert(cashPayData.receiptNumber.startsWith('KAMCH/RCP/COLLEGE/'), 'Receipt follows prefix pattern KAMCH/RCP/COLLEGE/{YYYY}/{SEQ}');
    const collegeReceiptId = cashPayData.receiptId;

    // Check ledger after cash payment
    const ledger3 = await calculateStudentFinancialLedger(studentId);
    assert(ledger3.components.COLLEGE.verifiedPaid === 25000, 'College verified paid is ₹25,000 (V_c)');
    assert(ledger3.components.COLLEGE.actualOutstanding === 50750, 'College actual outstanding is ₹50,750 (N_c - V_c)');
    assert(ledger3.components.COLLEGE.unreservedCapacity === 50750, 'College unreserved capacity is ₹50,750 (C_c)');

    // =========================================================================
    // SECTION 5: BANK TRANSFER PENDING RESERVATION & CAPACITY CONTROL
    // =========================================================================
    console.log('\n--- 5. Bank Transfer Pending Reservation & Capacity Guard ---');
    // Record Bank Transfer for DEVELOPMENT into SECRETARY_DEV_ACCOUNT (₹20,000)
    const btRes = await fetch(`${baseUrl}/api/fees/payments`, {
      method: 'POST',
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        feeComponent: 'DEVELOPMENT',
        destination: 'SECRETARY_DEV_ACCOUNT',
        paymentMethod: 'BANK_TRANSFER',
        amount: 20000,
        studentTxRef: 'UTR-DEV-STG1-001',
        bankName: 'HDFC Bank',
        paymentDate: '2026-11-05',
      }),
    });
    const btData = await btRes.json();
    assert(btRes.status === 201 && btData.status === 'PENDING_VERIFICATION', 'Bank transfer recorded as PENDING_VERIFICATION');
    assert(!btData.receiptNumber, 'No receipt issued while bank transfer is pending verification');
    const btPaymentId = btData.paymentId;

    // Check ledger: pendingReserved must be ₹20,000, unreservedCapacity reduced to ₹25,000
    const ledger4 = await calculateStudentFinancialLedger(studentId);
    assert(ledger4.components.DEVELOPMENT.pendingReserved === 20000, 'Development pending reserved is ₹20,000 (P_c)');
    assert(ledger4.components.DEVELOPMENT.actualOutstanding === 45000, 'Development actual outstanding remains ₹45,000 until verified');
    assert(ledger4.components.DEVELOPMENT.unreservedCapacity === 25000, 'Development unreserved capacity reduced to ₹25,000 (C_c = N_c - V_c - P_c)');
    assert(ledger4.components.DEVELOPMENT.maxPermittedNewPayment === 25000, 'Maximum permitted new payment for Development is ₹25,000 (M_c)');

    // Attempting to pay more than M_c (e.g. ₹30,000 when capacity is ₹25,000) must be BLOCKED
    const excessPayRes = await fetch(`${baseUrl}/api/fees/payments`, {
      method: 'POST',
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        feeComponent: 'DEVELOPMENT',
        destination: 'SECRETARY_DEV_ACCOUNT',
        paymentMethod: 'CASH',
        amount: 30000,
      }),
    });
    const excessPayData = await excessPayRes.json();
    assert(excessPayRes.status === 400 && excessPayData.code === 'EXCESS_PAYMENT_BLOCKED', 'Server prevents over-collection exceeding M_c with EXCESS_PAYMENT_BLOCKED');

    // =========================================================================
    // SECTION 6: BANK TRANSFER VERIFICATION & ATOMIC RECEIPT ISSUANCE
    // =========================================================================
    console.log('\n--- 6. Bank Transfer Verification & Atomic Receipt Issuance ---');
    // Verification without passbookTxRef must fail
    const noRefRes = await fetch(`${baseUrl}/api/fees/payments/${btPaymentId}/verify`, {
      method: 'POST',
      headers: makeHeaders(princAuth.cookies.session, princAuth.data.csrfToken),
      body: JSON.stringify({ action: 'VERIFY' }),
    });
    assert(noRefRes.status === 400, 'Bank transfer verification requires mandatory passbook reference');

    // Principal verifies bank transfer with passbook reference
    const verifyRes = await fetch(`${baseUrl}/api/fees/payments/${btPaymentId}/verify`, {
      method: 'POST',
      headers: makeHeaders(princAuth.cookies.session, princAuth.data.csrfToken),
      body: JSON.stringify({ action: 'VERIFY', passbookTxRef: 'PBK-SEC-2026-991' }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.success, 'Principal verified bank transfer successfully');
    assert(verifyData.finalReceiptNumber.startsWith('KAMCH/RCP/DEV/'), `Atomic receipt generated for verified Development payment: ${verifyData.finalReceiptNumber}`);

    // Check ledger: pendingReserved cleared (0), verifiedPaid updated to ₹20,000, actualOutstanding is ₹25,000
    const ledger5 = await calculateStudentFinancialLedger(studentId);
    assert(ledger5.components.DEVELOPMENT.pendingReserved === 0, 'Pending reserved cleared to 0 after verification');
    assert(ledger5.components.DEVELOPMENT.verifiedPaid === 20000, 'Development verified paid updated to ₹20,000');
    assert(ledger5.components.DEVELOPMENT.actualOutstanding === 25000, 'Development actual outstanding updated to ₹25,000');

    // =========================================================================
    // SECTION 7: BANK TRANSFER REJECTION & RESERVATION RELEASE
    // =========================================================================
    console.log('\n--- 7. Bank Transfer Rejection & Reservation Release ---');
    // Record another bank transfer for HOSTEL (₹10,000)
    const btHostelRes = await fetch(`${baseUrl}/api/fees/payments`, {
      method: 'POST',
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        feeComponent: 'HOSTEL',
        destination: 'COLLEGE_ACCOUNT',
        paymentMethod: 'BANK_TRANSFER',
        amount: 10000,
        studentTxRef: 'UTR-HST-TEST-1',
        bankName: 'Canara Bank',
      }),
    });
    const btHostelData = await btHostelRes.json();
    const hstPayId = btHostelData.paymentId;

    // Check reservation was created
    const ledger6a = await calculateStudentFinancialLedger(studentId);
    assert(ledger6a.components.HOSTEL.pendingReserved === 10000, 'Hostel pending reserved is ₹10,000');

    // Reject transfer with mandatory reason
    const rejRes = await fetch(`${baseUrl}/api/fees/payments/${hstPayId}/verify`, {
      method: 'POST',
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
      body: JSON.stringify({ action: 'REJECT', rejectionReason: 'Transaction not found in bank statement' }),
    });
    assert(rejRes.status === 200, 'Office staff rejected bank transfer with reason');

    // Check reservation is released
    const ledger6b = await calculateStudentFinancialLedger(studentId);
    assert(ledger6b.components.HOSTEL.pendingReserved === 0, 'Hostel pending reserved released back to 0 on rejection');
    assert(ledger6b.components.HOSTEL.unreservedCapacity === 30000, 'Hostel unreserved capacity fully restored to ₹30,000');

    // =========================================================================
    // SECTION 8: RECEIPT PRINT CONFIRMATION ENDPOINT
    // =========================================================================
    console.log('\n--- 8. Receipt Print Confirmation Workflow ---');
    // Check initial print status
    const printStatus1 = await fetch(`${baseUrl}/api/fees/receipts/${collegeReceiptId}/print-status`, {
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
    });
    const ps1Data = await printStatus1.json();
    assert(ps1Data.printCount === 0 && ps1Data.printedAt === null, 'Initial print count is 0 and printedAt is null');

    // Confirm print via POST /api/fees/receipts/:id/confirm-print
    const confirmPrintRes = await fetch(`${baseUrl}/api/fees/receipts/${collegeReceiptId}/confirm-print`, {
      method: 'POST',
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
    });
    const cpData = await confirmPrintRes.json();
    assert(confirmPrintRes.status === 200 && cpData.printCount === 1, 'POST /api/fees/receipts/:id/confirm-print increments printCount to 1');
    assert(Boolean(cpData.printedAt), 'printedAt timestamp recorded on print confirmation');

    // Re-confirming print increments counter
    const confirmPrint2 = await fetch(`${baseUrl}/api/fees/receipts/${collegeReceiptId}/confirm-print`, {
      method: 'POST',
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
    });
    const cp2Data = await confirmPrint2.json();
    assert(cp2Data.printCount === 2, 'Second print confirmation increments printCount to 2');

    // =========================================================================
    // SECTION 9: ROLE RESTRICTIONS & PERMISSION ENFORCEMENT
    // =========================================================================
    console.log('\n--- 9. Role Permissions & Security Hardening ---');
    // Secretary can collect DEVELOPMENT fee into SECRETARY_DEV_ACCOUNT
    const secPayDevRes = await fetch(`${baseUrl}/api/fees/payments`, {
      method: 'POST',
      headers: makeHeaders(secAuth.cookies.session, secAuth.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        feeComponent: 'DEVELOPMENT',
        destination: 'SECRETARY_DEV_ACCOUNT',
        paymentMethod: 'CASH',
        amount: 5000,
      }),
    });
    assert(secPayDevRes.status === 201, 'Secretary can collect Development fee into SECRETARY_DEV_ACCOUNT');

    // Secretary CANNOT collect COLLEGE fee (403)
    const secPayColRes = await fetch(`${baseUrl}/api/fees/payments`, {
      method: 'POST',
      headers: makeHeaders(secAuth.cookies.session, secAuth.data.csrfToken),
      body: JSON.stringify({
        studentId,
        assessmentId,
        feeComponent: 'COLLEGE',
        destination: 'COLLEGE_ACCOUNT',
        paymentMethod: 'CASH',
        amount: 5000,
      }),
    });
    assert(secPayColRes.status === 403, 'Secretary is strictly blocked from collecting COLLEGE fee (403)');

    // Secretary CANNOT reverse payments (403)
    const secRevRes = await fetch(`${baseUrl}/api/fees/payments/${cashPayData.paymentId}/reverse`, {
      method: 'POST',
      headers: makeHeaders(secAuth.cookies.session, secAuth.data.csrfToken),
      body: JSON.stringify({ reversalReason: 'Secretary unauthorized reversal attempt' }),
    });
    assert(secRevRes.status === 403, 'Secretary is strictly blocked from reversing payments (403)');

    // Office staff CANNOT reverse payments (403) - Reversal restricted to Super Admin and Principal
    const officeRevRes = await fetch(`${baseUrl}/api/fees/payments/${cashPayData.paymentId}/reverse`, {
      method: 'POST',
      headers: makeHeaders(officeAuth.cookies.session, officeAuth.data.csrfToken),
      body: JSON.stringify({ reversalReason: 'Office unauthorized reversal attempt' }),
    });
    assert(officeRevRes.status === 403, 'Office staff is blocked from payment reversal (403)');

    console.log(`\n========================================================================`);
    console.log(`STAGE 1 BACKEND TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during Stage 1 backend tests:', err);
    process.exit(1);
  } finally {
    conn.release();
    server.close();
  }
}

runStage1BackendTestSuite();
