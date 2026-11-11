import { getPool } from '../db.ts';
import { calculateStudentFinancialLedger } from './fees-financial.service.ts';

export interface FeeReportOptions {
  reportType?: string;
  dateFrom?: string;
  dateTo?: string;
  destination?: string;
  method?: string;
  status?: string;
  category?: string;
  serviceType?: string;
  outstandingStatus?: string;
}

export async function generateFeeReport(options: FeeReportOptions) {
  const pool = getPool();
  const reportType = (options.reportType || 'ALL').toUpperCase();

  switch (reportType) {
    case 'COLLEGE_FEES':
      return generateCollegeFeeReport(pool, options);
    case 'DEVELOPMENT_FEES':
      return generateDevelopmentFeeReport(pool, options);
    case 'HOSTEL_MESS':
      return generateHostelMessReport(pool, options);
    case 'BANK_DESTINATION':
      return generateBankDestinationReport(pool, options);
    case 'PENDING_VERIFICATION':
      return generatePendingVerificationReport(pool, options);
    case 'REVERSED_PAYMENTS':
      return generateReversedPaymentReport(pool, options);
    case 'STUDENT_OUTSTANDING':
      return generateStudentOutstandingReport(pool, options);
    case 'CONSOLIDATED_SUMMARY':
      return generateConsolidatedSummaryReport(pool, options);
    default:
      return generateStandardTransactionsReport(pool, options);
  }
}

/**
 * 1. College Fee Collection Report
 */
async function generateCollegeFeeReport(pool: any, opts: FeeReportOptions) {
  const [allocRows] = await pool.query(
    `SELECT 
      fpa.id AS allocation_id,
      fpa.allocated_amount,
      fpa.financial_account,
      fp.id AS payment_id,
      fp.payment_reference,
      fp.payment_date,
      fp.payment_method,
      fp.destination,
      fp.student_tx_ref,
      fp.passbook_tx_ref,
      fp.status AS payment_status,
      s.id AS student_id,
      s.student_id_number,
      s.full_name AS student_name,
      s.admission_category,
      recorder.full_name AS recorder_name,
      verifier.full_name AS verifier_name,
      fr.receipt_number
     FROM fee_payment_allocations fpa
     JOIN fee_payments fp ON fpa.payment_id = fp.id
     JOIN students s ON fp.student_id = s.id
     JOIN users recorder ON fp.recorded_by = recorder.id
     LEFT JOIN users verifier ON fp.verified_by = verifier.id
     LEFT JOIN fee_receipts fr ON fp.id = fr.payment_id
     WHERE fpa.financial_account = 'COLLEGE'
     ORDER BY fp.payment_date DESC, fpa.id DESC`
  );

  let records = (allocRows || []).map((r: any) => ({
    id: r.allocation_id,
    paymentId: r.payment_id,
    paymentReference: r.payment_reference,
    paymentDate: r.payment_date,
    studentId: r.student_id,
    studentIdNumber: r.student_id_number,
    studentName: r.student_name,
    admissionCategory: r.admission_category,
    paymentMethod: r.payment_method,
    destination: r.destination,
    studentTxRef: r.student_tx_ref,
    passbookTxRef: r.passbook_tx_ref,
    amount: parseFloat(r.allocated_amount || '0'),
    status: r.payment_status,
    receiptNumber: r.receipt_number || '—',
    recorderName: r.recorder_name,
    verifierName: r.verifier_name,
  }));

  // Apply filters
  if (opts.dateFrom) records = records.filter((r: any) => r.paymentDate >= opts.dateFrom!);
  if (opts.dateTo) records = records.filter((r: any) => r.paymentDate <= opts.dateTo!);
  if (opts.category && opts.category !== 'ALL') records = records.filter((r: any) => r.admissionCategory === opts.category);
  if (opts.method && opts.method !== 'ALL') records = records.filter((r: any) => r.paymentMethod === opts.method);
  if (opts.status && opts.status !== 'ALL') records = records.filter((r: any) => r.status === opts.status);

  const totalVerified = records
    .filter((r: any) => r.status === 'VERIFIED')
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  const totalPending = records
    .filter((r: any) => r.status === 'PENDING_VERIFICATION')
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  const totalReversed = records
    .filter((r: any) => r.status === 'REVERSED')
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  const totalRejected = records
    .filter((r: any) => r.status === 'REJECTED')
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  return {
    reportType: 'COLLEGE_FEES',
    title: 'College Fee Collection Report',
    receivingDestination: 'COLLEGE_ACCOUNT',
    records,
    summary: {
      totalVerified,
      totalPending,
      totalReversed,
      totalRejected,
      count: records.length,
    },
  };
}

/**
 * 2. Development Fee Collection Report
 */
async function generateDevelopmentFeeReport(pool: any, opts: FeeReportOptions) {
  const [allocRows] = await pool.query(
    `SELECT 
      fpa.id AS allocation_id,
      fpa.allocated_amount,
      fpa.financial_account,
      fp.id AS payment_id,
      fp.payment_reference,
      fp.payment_date,
      fp.payment_method,
      fp.destination,
      fp.student_tx_ref,
      fp.status AS payment_status,
      s.id AS student_id,
      s.student_id_number,
      s.full_name AS student_name,
      s.admission_category,
      recorder.full_name AS recorder_name,
      verifier.full_name AS verifier_name,
      fr.receipt_number
     FROM fee_payment_allocations fpa
     JOIN fee_payments fp ON fpa.payment_id = fp.id
     JOIN students s ON fp.student_id = s.id
     JOIN users recorder ON fp.recorded_by = recorder.id
     LEFT JOIN users verifier ON fp.verified_by = verifier.id
     LEFT JOIN fee_receipts fr ON fp.id = fr.payment_id
     WHERE fpa.financial_account = 'DEVELOPMENT'
     ORDER BY fp.payment_date DESC, fpa.id DESC`
  );

  let records = (allocRows || []).map((r: any) => ({
    id: r.allocation_id,
    paymentId: r.payment_id,
    paymentReference: r.payment_reference,
    paymentDate: r.payment_date,
    studentId: r.student_id,
    studentIdNumber: r.student_id_number,
    studentName: r.student_name,
    admissionCategory: r.admission_category,
    paymentMethod: r.payment_method,
    destination: r.destination,
    studentTxRef: r.student_tx_ref,
    amount: parseFloat(r.allocated_amount || '0'),
    status: r.payment_status,
    receiptNumber: r.receipt_number || '—',
    recorderName: r.recorder_name,
    verifierName: r.verifier_name,
  }));

  if (opts.dateFrom) records = records.filter((r: any) => r.paymentDate >= opts.dateFrom!);
  if (opts.dateTo) records = records.filter((r: any) => r.paymentDate <= opts.dateTo!);
  if (opts.category && opts.category !== 'ALL') records = records.filter((r: any) => r.admissionCategory === opts.category);
  if (opts.method && opts.method !== 'ALL') records = records.filter((r: any) => r.paymentMethod === opts.method);
  if (opts.status && opts.status !== 'ALL') records = records.filter((r: any) => r.status === opts.status);

  const totalVerified = records
    .filter((r: any) => r.status === 'VERIFIED')
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  const totalPending = records
    .filter((r: any) => r.status === 'PENDING_VERIFICATION')
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  const totalReversed = records
    .filter((r: any) => r.status === 'REVERSED')
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  return {
    reportType: 'DEVELOPMENT_FEES',
    title: 'Development Fee Collection Report',
    receivingDestination: 'SECRETARY_DEV_ACCOUNT',
    records,
    summary: {
      totalVerified,
      totalPending,
      totalReversed,
      count: records.length,
    },
  };
}

/**
 * 3. Hostel & Mess Collection Report
 */
async function generateHostelMessReport(pool: any, opts: FeeReportOptions) {
  const [allocRows] = await pool.query(
    `SELECT 
      fpa.id AS allocation_id,
      fpa.allocated_amount,
      fpa.billing_period_id,
      sbp.service_type,
      fp.id AS payment_id,
      fp.payment_reference,
      fp.payment_date,
      fp.payment_method,
      fp.student_tx_ref,
      fp.passbook_tx_ref,
      fp.status AS payment_status,
      s.id AS student_id,
      s.student_id_number,
      s.full_name AS student_name,
      s.admission_category,
      recorder.full_name AS recorder_name,
      verifier.full_name AS verifier_name,
      fr.receipt_number
     FROM fee_payment_allocations fpa
     JOIN fee_payments fp ON fpa.payment_id = fp.id
     JOIN students s ON fp.student_id = s.id
     LEFT JOIN service_billing_periods sbp ON fpa.billing_period_id = sbp.id
     JOIN users recorder ON fp.recorded_by = recorder.id
     LEFT JOIN users verifier ON fp.verified_by = verifier.id
     LEFT JOIN fee_receipts fr ON fp.id = fr.payment_id
     WHERE fpa.financial_account = 'HOSTEL_MESS'
     ORDER BY fp.payment_date DESC, fpa.id DESC`
  );

  let records = (allocRows || []).map((r: any) => ({
    id: r.allocation_id,
    paymentId: r.payment_id,
    paymentReference: r.payment_reference,
    paymentDate: r.payment_date,
    studentId: r.student_id,
    studentIdNumber: r.student_id_number,
    studentName: r.student_name,
    admissionCategory: r.admission_category,
    serviceType: r.service_type || 'COMBINED',
    paymentMethod: r.payment_method,
    studentTxRef: r.student_tx_ref,
    passbookTxRef: r.passbook_tx_ref,
    amount: parseFloat(r.allocated_amount || '0'),
    status: r.payment_status,
    receiptNumber: r.receipt_number || '—',
    recorderName: r.recorder_name,
    verifierName: r.verifier_name,
  }));

  if (opts.dateFrom) records = records.filter((r: any) => r.paymentDate >= opts.dateFrom!);
  if (opts.dateTo) records = records.filter((r: any) => r.paymentDate <= opts.dateTo!);
  if (opts.serviceType && opts.serviceType !== 'ALL') records = records.filter((r: any) => r.serviceType === opts.serviceType);
  if (opts.method && opts.method !== 'ALL') records = records.filter((r: any) => r.paymentMethod === opts.method);
  if (opts.status && opts.status !== 'ALL') records = records.filter((r: any) => r.status === opts.status);

  const totalVerified = records
    .filter((r: any) => r.status === 'VERIFIED')
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  const totalPending = records
    .filter((r: any) => r.status === 'PENDING_VERIFICATION')
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  const totalReversed = records
    .filter((r: any) => r.status === 'REVERSED')
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  return {
    reportType: 'HOSTEL_MESS',
    title: 'Hostel & Mess Collection Report',
    receivingDestination: 'COLLEGE_ACCOUNT',
    records,
    summary: {
      totalVerified,
      totalPending,
      totalReversed,
      count: records.length,
    },
  };
}

/**
 * 4. Bank Destination-wise Collection Report
 */
async function generateBankDestinationReport(pool: any, opts: FeeReportOptions) {
  const [payments] = await pool.query(
    `SELECT 
      fp.id,
      fp.payment_reference,
      fp.amount,
      fp.destination,
      fp.payment_method,
      fp.student_tx_ref,
      fp.passbook_tx_ref,
      fp.payment_date,
      fp.status,
      s.student_id_number,
      s.full_name AS student_name,
      s.admission_category,
      recorder.full_name AS recorder_name,
      fr.receipt_number
     FROM fee_payments fp
     JOIN students s ON fp.student_id = s.id
     JOIN users recorder ON fp.recorded_by = recorder.id
     LEFT JOIN fee_receipts fr ON fp.id = fr.payment_id
     ORDER BY fp.payment_date DESC, fp.id DESC`
  );

  let records = (payments || []).map((r: any) => ({
    id: r.id,
    paymentReference: r.payment_reference,
    paymentDate: r.payment_date,
    studentName: r.student_name,
    studentIdNumber: r.student_id_number,
    admissionCategory: r.admission_category,
    destination: r.destination,
    paymentMethod: r.payment_method,
    studentTxRef: r.student_tx_ref,
    passbookTxRef: r.passbook_tx_ref,
    amount: parseFloat(r.amount),
    status: r.status,
    receiptNumber: r.receipt_number || '—',
    recorderName: r.recorder_name,
  }));

  if (opts.dateFrom) records = records.filter((r: any) => r.paymentDate >= opts.dateFrom!);
  if (opts.dateTo) records = records.filter((r: any) => r.paymentDate <= opts.dateTo!);
  if (opts.destination && opts.destination !== 'ALL') records = records.filter((r: any) => r.destination === opts.destination);
  if (opts.method && opts.method !== 'ALL') records = records.filter((r: any) => r.paymentMethod === opts.method);
  if (opts.status && opts.status !== 'ALL') records = records.filter((r: any) => r.status === opts.status);

  // Group by destination
  const collegePayments = records.filter((r: any) => r.destination === 'COLLEGE_ACCOUNT');
  const devPayments = records.filter((r: any) => r.destination === 'SECRETARY_DEV_ACCOUNT');

  const destinationBreakdown = {
    collegeAccount: {
      verified: collegePayments.filter((p: any) => p.status === 'VERIFIED').reduce((s: number, p: any) => s + p.amount, 0),
      pending: collegePayments.filter((p: any) => p.status === 'PENDING_VERIFICATION').reduce((s: number, p: any) => s + p.amount, 0),
      reversed: collegePayments.filter((p: any) => p.status === 'REVERSED').reduce((s: number, p: any) => s + p.amount, 0),
      cash: collegePayments.filter((p: any) => p.paymentMethod === 'CASH' && p.status === 'VERIFIED').reduce((s: number, p: any) => s + p.amount, 0),
      bankTransfer: collegePayments.filter((p: any) => p.paymentMethod === 'BANK_TRANSFER' && p.status === 'VERIFIED').reduce((s: number, p: any) => s + p.amount, 0),
      count: collegePayments.length,
    },
    secretaryDevAccount: {
      verified: devPayments.filter((p: any) => p.status === 'VERIFIED').reduce((s: number, p: any) => s + p.amount, 0),
      pending: devPayments.filter((p: any) => p.status === 'PENDING_VERIFICATION').reduce((s: number, p: any) => s + p.amount, 0),
      reversed: devPayments.filter((p: any) => p.status === 'REVERSED').reduce((s: number, p: any) => s + p.amount, 0),
      cash: devPayments.filter((p: any) => p.paymentMethod === 'CASH' && p.status === 'VERIFIED').reduce((s: number, p: any) => s + p.amount, 0),
      onlineDev: devPayments.filter((p: any) => p.paymentMethod === 'ONLINE_DEV' && p.status === 'VERIFIED').reduce((s: number, p: any) => s + p.amount, 0),
      count: devPayments.length,
    },
  };

  const totalVerified = destinationBreakdown.collegeAccount.verified + destinationBreakdown.secretaryDevAccount.verified;
  const totalPending = destinationBreakdown.collegeAccount.pending + destinationBreakdown.secretaryDevAccount.pending;
  const totalReversed = destinationBreakdown.collegeAccount.reversed + destinationBreakdown.secretaryDevAccount.reversed;

  return {
    reportType: 'BANK_DESTINATION',
    title: 'Bank Destination-wise Collection Report',
    records,
    destinationBreakdown,
    summary: {
      totalVerified,
      totalPending,
      totalReversed,
      count: records.length,
    },
  };
}

/**
 * 5. Pending Passbook Verification Report
 */
async function generatePendingVerificationReport(pool: any, opts: FeeReportOptions) {
  const [rows] = await pool.query(
    `SELECT 
      fp.id,
      fp.payment_reference,
      fp.amount,
      fp.destination,
      fp.fee_component,
      fp.payment_method,
      fp.student_tx_ref,
      fp.bank_name,
      fp.payment_date,
      fp.status,
      s.student_id_number,
      s.full_name AS student_name,
      s.admission_category,
      recorder.full_name AS recorder_name
     FROM fee_payments fp
     JOIN students s ON fp.student_id = s.id
     JOIN users recorder ON fp.recorded_by = recorder.id
     WHERE fp.status = 'PENDING_VERIFICATION'
     ORDER BY fp.payment_date ASC, fp.id ASC`
  );

  let records = (rows || []).map((r: any) => {
    const daysPending = Math.max(0, Math.floor((Date.now() - new Date(r.payment_date).getTime()) / (1000 * 60 * 60 * 24)));
    return {
      id: r.id,
      paymentReference: r.payment_reference,
      paymentDate: r.payment_date,
      studentName: r.student_name,
      studentIdNumber: r.student_id_number,
      admissionCategory: r.admission_category,
      destination: r.destination,
      feeComponent: r.fee_component || (r.destination === 'SECRETARY_DEV_ACCOUNT' ? 'DEVELOPMENT' : 'COLLEGE'),
      paymentMethod: r.payment_method,
      studentTxRef: r.student_tx_ref,
      bankName: r.bank_name || '—',
      amount: parseFloat(r.amount),
      daysPending,
      recordedBy: r.recorder_name,
    };
  });

  if (opts.destination && opts.destination !== 'ALL') records = records.filter((r: any) => r.destination === opts.destination);

  const totalPendingAmount = records.reduce((s: number, r: any) => s + r.amount, 0);
  const collegeAccountPending = records.filter((r: any) => r.destination === 'COLLEGE_ACCOUNT').reduce((s: number, r: any) => s + r.amount, 0);
  const secretaryDevPending = records.filter((r: any) => r.destination === 'SECRETARY_DEV_ACCOUNT').reduce((s: number, r: any) => s + r.amount, 0);

  return {
    reportType: 'PENDING_VERIFICATION',
    title: 'Pending Passbook Verification Report',
    records,
    summary: {
      totalPendingAmount,
      totalPendingCount: records.length,
      collegeAccountPending,
      secretaryDevPending,
    },
  };
}

/**
 * 6. Reversed Payment Report
 */
async function generateReversedPaymentReport(pool: any, opts: FeeReportOptions) {
  const [rows] = await pool.query(
    `SELECT 
      fp.id,
      fp.payment_reference,
      fp.amount,
      fp.destination,
      fp.payment_method,
      fp.payment_date,
      fp.status,
      fp.reversal_reason,
      fp.reversed_at,
      s.student_id_number,
      s.full_name AS student_name,
      s.admission_category,
      recorder.full_name AS recorder_name,
      reverser.full_name AS reverser_name
     FROM fee_payments fp
     JOIN students s ON fp.student_id = s.id
     JOIN users recorder ON fp.recorded_by = recorder.id
     LEFT JOIN users reverser ON fp.reversed_by = reverser.id
     WHERE fp.status = 'REVERSED'
     ORDER BY fp.reversed_at DESC, fp.id DESC`
  );

  let records = (rows || []).map((r: any) => ({
    id: r.id,
    paymentReference: r.payment_reference,
    paymentDate: r.payment_date,
    studentName: r.student_name,
    studentIdNumber: r.student_id_number,
    admissionCategory: r.admission_category,
    destination: r.destination,
    paymentMethod: r.payment_method,
    amount: parseFloat(r.amount),
    reversalDate: r.reversed_at || r.payment_date,
    reversedBy: r.reverser_name || 'Super Admin / Principal',
    reversalReason: r.reversal_reason || 'Administrative Financial Reversal',
  }));

  if (opts.dateFrom) records = records.filter((r: any) => r.paymentDate >= opts.dateFrom!);
  if (opts.dateTo) records = records.filter((r: any) => r.paymentDate <= opts.dateTo!);
  if (opts.destination && opts.destination !== 'ALL') records = records.filter((r: any) => r.destination === opts.destination);

  const totalReversedAmount = records.reduce((s: number, r: any) => s + r.amount, 0);
  const collegeAccountReversed = records.filter((r: any) => r.destination === 'COLLEGE_ACCOUNT').reduce((s: number, r: any) => s + r.amount, 0);
  const secretaryDevReversed = records.filter((r: any) => r.destination === 'SECRETARY_DEV_ACCOUNT').reduce((s: number, r: any) => s + r.amount, 0);

  return {
    reportType: 'REVERSED_PAYMENTS',
    title: 'Reversed Payment Audit Report',
    records,
    summary: {
      totalReversedAmount,
      totalReversedCount: records.length,
      collegeAccountReversed,
      secretaryDevReversed,
    },
  };
}

/**
 * 7. Student Outstanding Report
 */
async function generateStudentOutstandingReport(pool: any, opts: FeeReportOptions) {
  const [students] = await pool.query(
    `SELECT id, student_id_number, full_name, admission_category, admission_year, current_year_of_study
     FROM students
     WHERE status = 'ACTIVE'
     ORDER BY id ASC`
  );

  const studentLedgers: any[] = [];
  for (const s of students || []) {
    try {
      const ledger = await calculateStudentFinancialLedger(s.id);
      const grossAssessed = ledger.consolidated.totalAssessed;
      const concessions = ledger.consolidated.totalConcessions;
      const netPayable = ledger.consolidated.totalNetPayable;
      const verifiedPaid = ledger.consolidated.totalVerifiedPaid;
      const pendingTransfers = ledger.consolidated.totalPendingVerification;
      const outstandingBalance = ledger.consolidated.totalOutstandingBalance;
      const advanceBalance = ledger.consolidated.totalExcessCredit;

      let status = 'CLEARED';
      if (outstandingBalance > 0) status = 'DUE';
      else if (advanceBalance > 0) status = 'ADVANCE_CREDIT';
      else if (pendingTransfers > 0 && outstandingBalance === 0) status = 'PENDING_CLEARANCE';

      studentLedgers.push({
        studentId: s.id,
        studentIdNumber: s.student_id_number,
        fullName: s.full_name,
        admissionCategory: s.admission_category,
        yearOfStudy: s.current_year_of_study,
        grossAssessed,
        concessions,
        netPayable,
        verifiedPaid,
        pendingTransfers,
        outstandingBalance,
        advanceBalance,
        status,
        accounts: ledger.accounts,
      });
    } catch {
      // Ignore student ledger error if assessment not initialized yet
    }
  }

  let records = studentLedgers;
  if (opts.category && opts.category !== 'ALL') {
    records = records.filter((r) => r.admissionCategory === opts.category);
  }
  if (opts.outstandingStatus && opts.outstandingStatus !== 'ALL') {
    if (opts.outstandingStatus === 'DUE_ONLY') records = records.filter((r) => r.outstandingBalance > 0);
    else if (opts.outstandingStatus === 'CLEARED_ONLY') records = records.filter((r) => r.outstandingBalance === 0);
    else if (opts.outstandingStatus === 'ADVANCE_ONLY') records = records.filter((r) => r.advanceBalance > 0);
  }

  const totalGrossAssessed = records.reduce((s, r) => s + r.grossAssessed, 0);
  const totalConcessions = records.reduce((s, r) => s + r.concessions, 0);
  const totalNetPayable = records.reduce((s, r) => s + r.netPayable, 0);
  const totalVerifiedPaid = records.reduce((s, r) => s + r.verifiedPaid, 0);
  const totalOutstanding = records.reduce((s, r) => s + r.outstandingBalance, 0);
  const totalAdvanceBalance = records.reduce((s, r) => s + r.advanceBalance, 0);
  const totalPendingTransfers = records.reduce((s, r) => s + r.pendingTransfers, 0);

  const clearedCount = records.filter((r) => r.outstandingBalance === 0).length;
  const dueCount = records.filter((r) => r.outstandingBalance > 0).length;
  const advanceCount = records.filter((r) => r.advanceBalance > 0).length;

  return {
    reportType: 'STUDENT_OUTSTANDING',
    title: 'Student Outstanding & Balance Report',
    records,
    summary: {
      totalGrossAssessed,
      totalConcessions,
      totalNetPayable,
      totalVerifiedPaid,
      totalOutstanding,
      totalAdvanceBalance,
      totalPendingTransfers,
      clearedCount,
      dueCount,
      advanceCount,
      studentCount: records.length,
    },
  };
}

/**
 * 8. Consolidated Financial Summary Report
 * Strict non-double-counting guarantees across accounts, destinations, and collection groups.
 */
async function generateConsolidatedSummaryReport(pool: any, _opts: FeeReportOptions) {
  // 1. Gross assessments
  const [assessRows] = await pool.query(
    `SELECT 
      COALESCE(SUM(assessed_college_fee), 0) AS total_college_assessed,
      COALESCE(SUM(assessed_development_fee), 0) AS total_dev_assessed,
      COALESCE(SUM(assessed_mess_fee + assessed_hostel_fee), 0) AS total_hm_assessed,
      COALESCE(SUM(total_assessed_fee), 0) AS total_gross_assessed,
      COALESCE(SUM(concession_total), 0) AS total_concessions,
      COALESCE(SUM(revised_payable), 0) AS total_net_payable
     FROM student_fee_assessments`
  );
  const a = assessRows[0] || {};
  const collegeAssessed = parseFloat(a.total_college_assessed || '0');
  const devAssessed = parseFloat(a.total_dev_assessed || '0');
  const hmAssessed = parseFloat(a.total_hm_assessed || '0');
  const grossAssessedTotal = parseFloat(a.total_gross_assessed || '0');
  const concessionsTotal = parseFloat(a.total_concessions || '0');
  const netPayableTotal = parseFloat(a.total_net_payable || String(grossAssessedTotal - concessionsTotal));

  // 2. Verified collections by bank destination (never double-counting)
  const [payments] = await pool.query(
    `SELECT destination, status, payment_method, amount FROM fee_payments`
  );

  let collegeAccountVerified = 0;
  let devAccountVerified = 0;
  let totalPending = 0;
  let pendingCount = 0;
  let totalReversed = 0;
  let reversedCount = 0;
  let totalRejected = 0;

  for (const p of payments || []) {
    const amt = parseFloat(p.amount || '0');
    if (p.status === 'VERIFIED') {
      if (p.destination === 'SECRETARY_DEV_ACCOUNT') devAccountVerified += amt;
      else collegeAccountVerified += amt;
    } else if (p.status === 'PENDING_VERIFICATION') {
      totalPending += amt;
      pendingCount++;
    } else if (p.status === 'REVERSED') {
      totalReversed += amt;
      reversedCount++;
    } else if (p.status === 'REJECTED') {
      totalRejected += amt;
    }
  }

  const verifiedTotal = collegeAccountVerified + devAccountVerified;
  const netOutstanding = Math.max(0, netPayableTotal - verifiedTotal);
  const advanceCreditTotal = Math.max(0, verifiedTotal - netPayableTotal);
  const collectionRatio = netPayableTotal > 0 ? Math.round((verifiedTotal / netPayableTotal) * 1000) / 10 : 0;

  // 3. Student coverage
  const [students] = await pool.query('SELECT COUNT(*) AS total_students FROM students WHERE status = "ACTIVE"');
  const totalStudents = parseInt(students[0]?.total_students || '0', 10);

  return {
    reportType: 'CONSOLIDATED_SUMMARY',
    title: 'Consolidated Institutional Financial Summary',
    summary: {
      grossAssessed: {
        college: collegeAssessed,
        development: devAssessed,
        hostelMess: hmAssessed,
        total: grossAssessedTotal,
      },
      concessions: {
        total: concessionsTotal,
      },
      netPayable: {
        total: netPayableTotal,
      },
      verifiedCollections: {
        collegeAccount: collegeAccountVerified,
        secretaryDevAccount: devAccountVerified,
        total: verifiedTotal,
      },
      pendingCollections: {
        total: totalPending,
        count: pendingCount,
      },
      reversedTransactions: {
        total: totalReversed,
        count: reversedCount,
      },
      rejectedTransactions: {
        total: totalRejected,
      },
      outstandingReceivable: {
        total: netOutstanding,
      },
      advanceCredit: {
        total: advanceCreditTotal,
      },
      collectionEfficiencyPercentage: collectionRatio,
      students: {
        totalEnrolled: totalStudents,
      },
    },
  };
}

/**
 * Standard Transactions Report (backward compatible)
 */
async function generateStandardTransactionsReport(pool: any, opts: FeeReportOptions) {
  const whereClauses: string[] = [];
  const queryParams: any[] = [];

  if (opts.dateFrom) {
    whereClauses.push('fp.payment_date >= ?');
    queryParams.push(opts.dateFrom);
  }
  if (opts.dateTo) {
    whereClauses.push('fp.payment_date <= ?');
    queryParams.push(opts.dateTo);
  }
  if (opts.destination && opts.destination !== 'ALL') {
    whereClauses.push('fp.destination = ?');
    queryParams.push(opts.destination);
  }
  if (opts.method && opts.method !== 'ALL') {
    whereClauses.push('fp.payment_method = ?');
    queryParams.push(opts.method);
  }
  if (opts.status && opts.status !== 'ALL') {
    whereClauses.push('fp.status = ?');
    queryParams.push(opts.status);
  }
  if (opts.category && opts.category !== 'ALL') {
    whereClauses.push('s.admission_category = ?');
    queryParams.push(opts.category);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT 
      fp.id,
      fp.payment_reference,
      fp.amount,
      fp.destination,
      fp.payment_method,
      fp.student_tx_ref,
      fp.passbook_tx_ref,
      fp.payment_date,
      fp.status,
      s.student_id_number,
      s.full_name AS student_name,
      s.admission_category,
      recorder.full_name AS recorder_name,
      verifier.full_name AS verifier_name,
      fr.receipt_number,
      fr.receipt_type
     FROM fee_payments fp
     JOIN students s ON fp.student_id = s.id
     JOIN users recorder ON fp.recorded_by = recorder.id
     LEFT JOIN users verifier ON fp.verified_by = verifier.id
     LEFT JOIN fee_receipts fr ON fp.id = fr.payment_id
     ${whereSql}
     ORDER BY fp.payment_date DESC, fp.id DESC`,
    queryParams
  );

  const totalAmount = (rows || [])
    .filter((r: any) => r.status === 'VERIFIED')
    .reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);

  const pendingAmount = (rows || [])
    .filter((r: any) => r.status === 'PENDING_VERIFICATION')
    .reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);

  return {
    reportType: 'ALL',
    records: rows || [],
    totalVerified: totalAmount,
    totalPending: pendingAmount,
    count: (rows || []).length,
  };
}
