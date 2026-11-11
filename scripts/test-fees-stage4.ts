import { getPool } from '../server/db.ts';
import { createCollectionGroupPayment, calculateStudentFinancialLedger } from '../server/services/fees-financial.service.ts';

async function runStage4Tests() {
  console.log('================================================================');
  console.log('KAMCH ERP — FEES MANAGEMENT STAGE 4 INTEGRATION TEST');
  console.log('================================================================');

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

  try {
    const pool = getPool();
    const conn = await pool.getConnection();

    // Reset tables for clean test
    await conn.query('DELETE FROM fee_payment_allocations');
    await conn.query('DELETE FROM fee_receipts');
    await conn.query('DELETE FROM fee_payments');
    await conn.query('DELETE FROM fee_collection_groups');
    await conn.query('DELETE FROM service_billing_periods');
    await conn.query('DELETE FROM service_enrollments');
    await conn.query('DELETE FROM student_fee_assessments');

    // Setup: Ensure student 1 exists
    const [existingStudents] = await conn.query<any[]>('SELECT id FROM students WHERE id = 1');
    if (!existingStudents || existingStudents.length === 0) {
      await conn.query(
        `INSERT INTO students (id, student_id_number, full_name, admission_category, admission_year, current_year_of_study, status)
         VALUES (1, 'KAMCH-2026-001', 'Test Student One', 'GOVERNMENT', 2026, 1, 'ACTIVE')`
      );
    }

    // Ensure student 1 has an active 2026-2027 fee assessment and a service billing period
    const [assessResult] = await conn.query<any>(
      `INSERT INTO student_fee_assessments (student_id, academic_year, year_of_study, admission_category, assessed_college_fee, assessed_development_fee, total_assessed_fee, concession_total, revised_payable, assessed_by)
       VALUES (1, '2026-2027', 1, 'GOVERNMENT', 75750, 50000, 125750, 0, 125750, 1)`
    );
    const assessmentId = assessResult.insertId || 1;

    // Create a service enrollment & billing period for HOSTEL_MESS
    const [enRes] = await conn.query<any>(
      `INSERT INTO service_enrollments (student_id, service_type, start_date, annual_fee, status, created_by)
       VALUES (1, 'HOSTEL', '2026-11-01', 30000, 'ACTIVE', 1)`
    );
    const enrollmentId = enRes.insertId || 1;

    const [bpRes] = await conn.query<any>(
      `INSERT INTO service_billing_periods (enrollment_id, student_id, service_type, period_start_date, period_end_date, assessed_amount, status)
       VALUES (?, 1, 'HOSTEL', '2026-11-01', '2027-10-31', 30000, 'ACTIVE')`,
      [enrollmentId]
    );
    const billingPeriodId = bpRes.insertId || 1;

    // 1. Create a collection group with multi-account payments
    const result = await createCollectionGroupPayment(
      {
        studentId: 1,
        paymentDate: '2026-11-03',
        recordedBy: 1,
        notes: 'Stage 4 Multi-account test collection',
        payments: [
          {
            destination: 'COLLEGE_ACCOUNT',
            paymentMethod: 'CASH',
            amount: 40000,
            allocations: [
              { accountType: 'COLLEGE', allocatedAmount: 25000, assessmentId },
              { accountType: 'HOSTEL_MESS', allocatedAmount: 15000, billingPeriodId },
            ],
          },
          {
            destination: 'SECRETARY_DEV_ACCOUNT',
            paymentMethod: 'CASH',
            amount: 10000,
            allocations: [
              { accountType: 'DEVELOPMENT', allocatedAmount: 10000, assessmentId },
            ],
          },
        ],
      },
      conn
    );

    assert(Boolean(result.collectionGroupId), 'Collection group created with ID: ' + result.collectionGroupId);
    assert(Boolean(result.receiptNumber), 'Combined receipt number generated: ' + result.receiptNumber);

    // 2. Query collection group record
    const [cgRows] = await conn.query<any[]>(
      'SELECT * FROM fee_collection_groups WHERE id = ?',
      [result.collectionGroupId]
    );
    assert(cgRows && cgRows.length > 0, 'Retrieved collection group record from database');
    const group = cgRows[0];
    const totalAmountNum = parseFloat(group.total_amount);
    assert(totalAmountNum === 50000, 'Collection group total amount is ₹50,000 (actual: ' + totalAmountNum + ')');

    // 3. Query allocations for this collection group
    const [allocations] = await conn.query<any[]>(
      `SELECT fpa.* FROM fee_payment_allocations fpa
       JOIN fee_payments fp ON fpa.payment_id = fp.id
       WHERE fp.collection_group_id = ?`,
      [result.collectionGroupId]
    );
    assert(allocations.length === 3, 'Found 3 itemized allocation rows for collection group');

    const collegeAlloc = allocations.find((a: any) => a.account_type === 'COLLEGE');
    const devAlloc = allocations.find((a: any) => a.account_type === 'DEVELOPMENT');
    const hmAlloc = allocations.find((a: any) => a.account_type === 'HOSTEL_MESS');

    assert(parseFloat(collegeAlloc?.allocated_amount) === 25000, 'College allocation is ₹25,000');
    assert(parseFloat(devAlloc?.allocated_amount) === 10000, 'Development allocation is ₹10,000');
    assert(parseFloat(hmAlloc?.allocated_amount) === 15000, 'Hostel & Mess allocation is ₹15,000');

    // 4. Calculate student 3-account financial ledger
    const ledger = await calculateStudentFinancialLedger(1);
    assert(Boolean(ledger), 'Calculated 3-account student ledger');
    assert(ledger.consolidated.totalVerifiedPaid === 50000, 'Consolidated verified paid is ₹50,000 (actual: ' + ledger.consolidated.totalVerifiedPaid + ')');

    conn.release();
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log(`\nStage 4 Test Results: Passed = ${passed}, Failed = ${failed}`);
  if (failed > 0) process.exit(1);
}

runStage4Tests();
