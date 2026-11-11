import { PoolConnection } from 'mysql2/promise';
import { getPool } from '../db.ts';

export type FeeComponentType = 'COLLEGE' | 'DEVELOPMENT' | 'HOSTEL' | 'MESS';

export interface ComponentFinancialBalance {
  component: FeeComponentType;
  receivingDestination: 'COLLEGE_ACCOUNT' | 'SECRETARY_DEV_ACCOUNT';
  assessedAmount: number;
  concessionAmount: number;
  netPayable: number;
  verifiedPaid: number;
  pendingReserved: number;
  actualOutstanding: number;
  unreservedCapacity: number;
  maxPermittedNewPayment: number;
}

export interface StudentFinancialLedgerSummary {
  studentId: number;
  // Four approved components
  components: {
    COLLEGE: ComponentFinancialBalance;
    DEVELOPMENT: ComponentFinancialBalance;
    HOSTEL: ComponentFinancialBalance;
    MESS: ComponentFinancialBalance;
  };
  // Historical compatibility aggregates
  historical: {
    combinedHostelMessCredit: number; // H_hist from legacy 'HOSTEL_MESS' allocation
    unallocatedCredit: number;         // U_hist from legacy unallocated payments and allocation residuals
    residualAllocationsDiscrepancy: number; // Sum of payment amount - allocation sum discrepancies
    excessHostelMessCreditOverflow: number; // Over-credit on Hostel/Mess that overflows to total debt
  };
  // Backward compatibility alias for 3-account consumers
  accounts: {
    COLLEGE: {
      accountType: 'COLLEGE';
      receivingDestination: 'COLLEGE_ACCOUNT';
      assessedAmount: number;
      concessionAmount: number;
      netPayable: number;
      verifiedPaid: number;
      pendingVerification: number;
      outstandingBalance: number;
      excessCredit: number;
    };
    DEVELOPMENT: {
      accountType: 'DEVELOPMENT';
      receivingDestination: 'SECRETARY_DEV_ACCOUNT';
      assessedAmount: number;
      concessionAmount: number;
      netPayable: number;
      verifiedPaid: number;
      pendingVerification: number;
      outstandingBalance: number;
      excessCredit: number;
    };
    HOSTEL_MESS: {
      accountType: 'HOSTEL_MESS';
      receivingDestination: 'COLLEGE_ACCOUNT';
      assessedAmount: number;
      concessionAmount: number;
      netPayable: number;
      verifiedPaid: number;
      pendingVerification: number;
      outstandingBalance: number;
      excessCredit: number;
    };
  };
  consolidated: {
    totalAssessed: number;
    totalConcessions: number;
    totalNetPayable: number;
    totalVerifiedPaid: number;
    totalPendingVerification: number;
    totalOutstandingBalance: number; // Overall actual debt: Gross outstanding - H_hist - U_hist
    overallAvailableCollectionLimit: number; // Max total new collections permitted across all components
    totalExcessCredit: number;
  };
}

/**
 * Calculates the complete four-component financial ledger for a given student
 * strictly following Stages 1.6-1.9 and Targeted Architecture Supplement specifications.
 */
export async function calculateStudentFinancialLedger(
  studentId: number,
  conn?: PoolConnection
): Promise<StudentFinancialLedgerSummary> {
  const pool = getPool();
  const db = conn || pool;

  // 1. Fetch student info
  const [studentRows] = await db.query<any[]>(
    'SELECT * FROM students WHERE id = ? LIMIT 1',
    [studentId]
  );
  if (!studentRows || studentRows.length === 0) {
    throw new Error(`Student not found with ID ${studentId}`);
  }
  const student = studentRows[0];

  // 2. Fetch active fee assessments
  const [assessments] = await db.query<any[]>(
    'SELECT * FROM student_fee_assessments WHERE student_id = ? ORDER BY id DESC',
    [studentId]
  );

  let collegeAssessed = 0;
  let devAssessed = 0;
  let hostelAssessed = 0;
  let messAssessed = 0;

  for (const a of assessments) {
    collegeAssessed += parseFloat(a.assessed_college_fee || '0');
    devAssessed += parseFloat(a.assessed_development_fee || '0');
    hostelAssessed += parseFloat(a.assessed_hostel_fee || '0');
    messAssessed += parseFloat(a.assessed_mess_fee || '0');
  }

  // Fallback for Hostel/Mess from service_billing_periods or service_enrollments if assessment is 0
  if (hostelAssessed === 0 && messAssessed === 0) {
    const [billingPeriods] = await db.query<any[]>(
      "SELECT * FROM service_billing_periods WHERE student_id = ? AND status != 'CANCELLED'",
      [studentId]
    );
    for (const bp of billingPeriods) {
      const amt = parseFloat(bp.assessed_amount || '0');
      if (bp.service_type === 'HOSTEL') hostelAssessed += amt;
      else if (bp.service_type === 'MESS') messAssessed += amt;
    }
    if (billingPeriods.length === 0) {
      const [enrollments] = await db.query<any[]>(
        "SELECT * FROM service_enrollments WHERE student_id = ? AND status = 'ACTIVE'",
        [studentId]
      );
      for (const en of enrollments) {
        const amt = parseFloat(en.annual_fee || '30000');
        if (en.service_type === 'HOSTEL') hostelAssessed += amt;
        else if (en.service_type === 'MESS') messAssessed += amt;
      }
    }
  }

  // 3. Fetch concessions
  const [concessions] = await db.query<any[]>(
    'SELECT * FROM fee_concessions WHERE student_id = ?',
    [studentId]
  );

  let collegeConcession = 0;
  let devConcession = 0;
  let hostelConcession = 0;
  let messConcession = 0;

  for (const c of concessions) {
    const reduction = parseFloat(c.calculated_reduction || '0');
    const comp = String(c.fee_component || 'ALL').toUpperCase();

    if (comp === 'COLLEGE') {
      collegeConcession += reduction;
    } else if (comp === 'DEVELOPMENT') {
      devConcession += reduction;
    } else if (comp === 'HOSTEL') {
      hostelConcession += reduction;
    } else if (comp === 'MESS') {
      messConcession += reduction;
    } else if (comp === 'HOSTEL_MESS') {
      // Split evenly between hostel and mess if specified as HOSTEL_MESS
      hostelConcession += reduction / 2;
      messConcession += reduction / 2;
    } else {
      // Historical 'ALL' concessions: Existing 50/50 College/Development rule preserved
      collegeConcession += reduction / 2;
      devConcession += reduction / 2;
    }
  }

  // 4. Fetch payments and allocations
  // Query all fee_payments for this student
  const [payments] = await db.query<any[]>(
    'SELECT * FROM fee_payments WHERE student_id = ?',
    [studentId]
  );

  // Query all allocations for this student
  const [allocations] = await db.query<any[]>(
    `SELECT 
       fpa.*, 
       fpa.financial_account AS resolved_account,
       fp.status AS payment_status,
       fp.amount AS parent_payment_amount
     FROM fee_payment_allocations fpa
     JOIN fee_payments fp ON fpa.payment_id = fp.id
     WHERE fp.student_id = ?`,
    [studentId]
  );

  // Map of payment_id -> sum of allocated_amounts
  const allocSumByPaymentId = new Map<number, number>();
  for (const alloc of allocations) {
    const pId = Number(alloc.payment_id);
    const amt = parseFloat(alloc.allocated_amount || '0');
    allocSumByPaymentId.set(pId, (allocSumByPaymentId.get(pId) || 0) + amt);
  }

  // Component collections
  let vCollege = 0;
  let vDev = 0;
  let vHostel = 0;
  let vMess = 0;

  let pCollege = 0;
  let pDev = 0;
  let pHostel = 0;
  let pMess = 0;

  let hHist = 0; // Combined Hostel/Mess historical credit
  let uHist = 0; // Unallocated historical credit
  let residualDiscrepancyTotal = 0;

  // Process allocation rows (Historical multi-account payments)
  for (const alloc of allocations) {
    const amt = parseFloat(alloc.allocated_amount || '0');
    const status = alloc.payment_status;
    const acct = String(alloc.resolved_account || alloc.financial_account || '').toUpperCase();

    if (status === 'VERIFIED') {
      if (acct === 'COLLEGE') {
        vCollege += amt;
      } else if (acct === 'DEVELOPMENT') {
        vDev += amt;
      } else if (acct === 'HOSTEL_MESS') {
        hHist += amt;
      }
    } else if (status === 'PENDING_VERIFICATION') {
      if (acct === 'COLLEGE') {
        pCollege += amt;
      } else if (acct === 'DEVELOPMENT') {
        pDev += amt;
      }
    }
  }

  // Process fee_payments rows
  // A. New single-component payments (fee_component is set, or no allocation rows exist)
  // B. Allocation residuals detection (payment amount > sum of allocations)
  // C. Unallocated legacy payments (destination without allocations)
  for (const p of payments) {
    const payId = Number(p.id);
    const payAmt = parseFloat(p.amount || '0');
    const status = p.status;
    const comp = p.fee_component ? String(p.fee_component).toUpperCase() : null;
    const allocSum = allocSumByPaymentId.get(payId);

    if (status === 'VERIFIED') {
      if (comp) {
        // Direct single-component payment (new architecture)
        if (comp === 'COLLEGE') vCollege += payAmt;
        else if (comp === 'DEVELOPMENT') vDev += payAmt;
        else if (comp === 'HOSTEL') vHostel += payAmt;
        else if (comp === 'MESS') vMess += payAmt;
      } else if (allocSum !== undefined) {
        // Had allocations. Check for residual discrepancy:
        if (payAmt > allocSum + 0.01) {
          const residual = payAmt - allocSum;
          uHist += residual;
          residualDiscrepancyTotal += residual;
        }
      } else {
        // Legacy payment with NO allocation row and NO fee_component
        if (p.destination === 'SECRETARY_DEV_ACCOUNT') {
          // If destination is DEV account and no allocation row
          vDev += payAmt;
        } else {
          // COLLEGE_ACCOUNT without component proof -> Unallocated Historical Credit
          uHist += payAmt;
        }
      }
    } else if (status === 'PENDING_VERIFICATION') {
      if (comp) {
        if (comp === 'COLLEGE') pCollege += payAmt;
        else if (comp === 'DEVELOPMENT') pDev += payAmt;
        else if (comp === 'HOSTEL') pHostel += payAmt;
        else if (comp === 'MESS') pMess += payAmt;
      } else if (allocSum === undefined) {
        if (p.destination === 'SECRETARY_DEV_ACCOUNT') {
          pDev += payAmt;
        } else {
          pCollege += payAmt;
        }
      }
    }
  }

  // 5. Component calculations
  // Net Payable: N_c = MAX(0, A_c - D_c)
  const nCollege = Math.max(0, collegeAssessed - collegeConcession);
  const nDev = Math.max(0, devAssessed - devConcession);
  const nHostel = Math.max(0, hostelAssessed - hostelConcession);
  const nMess = Math.max(0, messAssessed - messConcession);

  // Actual Component Outstanding: O_c = MAX(0, N_c - V_c)
  const oCollege = Math.max(0, nCollege - vCollege);
  const oDev = Math.max(0, nDev - vDev);
  const oHostel = Math.max(0, nHostel - vHostel);
  const oMess = Math.max(0, nMess - vMess);

  // Component Unreserved Capacity: C_c = MAX(0, N_c - (V_c + P_c))
  const cCollege = Math.max(0, nCollege - (vCollege + pCollege));
  const cDev = Math.max(0, nDev - (vDev + pDev));
  const cHostel = Math.max(0, nHostel - (vHostel + pHostel));
  const cMess = Math.max(0, nMess - (vMess + pMess));

  // Combined Hostel & Mess calculations
  const grossHmPayable = nHostel + nMess;
  const explicitHmVerified = vHostel + vMess;
  const explicitHmPending = pHostel + pMess;
  const oHm = Math.max(0, grossHmPayable - (explicitHmVerified + hHist));

  // Excess Hostel/Mess Credit Overflow: E_HM = MAX(0, (V_HM + H_hist) - N_HM)
  const excessHmOverflow = Math.max(0, (explicitHmVerified + hHist) - grossHmPayable);

  // Overall Actual Student Outstanding:
  // O_TOTAL = MAX(0, O_COLLEGE + O_DEVELOPMENT + O_HM - E_HM - U_hist)
  const grossStudentOutstanding = oCollege + oDev + oHm;
  const totalOutstandingBalance = Math.max(0, grossStudentOutstanding - excessHmOverflow - uHist);

  // Overall Available Collection Limit:
  // L_TOTAL = MAX(0, Gross_Net_Payable - (Total_Verified + Total_Pending + H_hist + U_hist))
  const grossNetPayable = nCollege + nDev + nHostel + nMess;
  const totalVerifiedPaid = vCollege + vDev + vHostel + vMess;
  const totalPendingVerification = pCollege + pDev + pHostel + pMess;
  const totalCreditsAndReservations = totalVerifiedPaid + totalPendingVerification + hHist + uHist;
  const overallAvailableCollectionLimit = Math.max(0, grossNetPayable - totalCreditsAndReservations);

  // Maximum Permitted New Payment for each component:
  // M_c = MIN(C_c, L_TOTAL)  (and bounded by O_HM for Hostel & Mess)
  const mCollege = Math.min(cCollege, overallAvailableCollectionLimit);
  const mDev = Math.min(cDev, overallAvailableCollectionLimit);
  const mHostel = Math.min(cHostel, overallAvailableCollectionLimit, oHm);
  const mMess = Math.min(cMess, overallAvailableCollectionLimit, oHm);

  // Excess credits per component
  const collegeExcess = Math.max(0, vCollege - nCollege);
  const devExcess = Math.max(0, vDev - nDev);
  const hostelExcess = Math.max(0, vHostel - nHostel);
  const messExcess = Math.max(0, vMess - nMess);
  const totalExcessCredit = collegeExcess + devExcess + excessHmOverflow;

  const collegeBalance: ComponentFinancialBalance = {
    component: 'COLLEGE',
    receivingDestination: 'COLLEGE_ACCOUNT',
    assessedAmount: collegeAssessed,
    concessionAmount: collegeConcession,
    netPayable: nCollege,
    verifiedPaid: vCollege,
    pendingReserved: pCollege,
    actualOutstanding: oCollege,
    unreservedCapacity: cCollege,
    maxPermittedNewPayment: mCollege,
  };

  const devBalance: ComponentFinancialBalance = {
    component: 'DEVELOPMENT',
    receivingDestination: 'SECRETARY_DEV_ACCOUNT',
    assessedAmount: devAssessed,
    concessionAmount: devConcession,
    netPayable: nDev,
    verifiedPaid: vDev,
    pendingReserved: pDev,
    actualOutstanding: oDev,
    unreservedCapacity: cDev,
    maxPermittedNewPayment: mDev,
  };

  const hostelBalance: ComponentFinancialBalance = {
    component: 'HOSTEL',
    receivingDestination: 'COLLEGE_ACCOUNT',
    assessedAmount: hostelAssessed,
    concessionAmount: hostelConcession,
    netPayable: nHostel,
    verifiedPaid: vHostel,
    pendingReserved: pHostel,
    actualOutstanding: oHostel,
    unreservedCapacity: cHostel,
    maxPermittedNewPayment: mHostel,
  };

  const messBalance: ComponentFinancialBalance = {
    component: 'MESS',
    receivingDestination: 'COLLEGE_ACCOUNT',
    assessedAmount: messAssessed,
    concessionAmount: messConcession,
    netPayable: nMess,
    verifiedPaid: vMess,
    pendingReserved: pMess,
    actualOutstanding: oMess,
    unreservedCapacity: cMess,
    maxPermittedNewPayment: mMess,
  };

  // Backward compatibility 3-account structures
  const legacyHmVerified = vHostel + vMess + hHist;
  const legacyHmPending = pHostel + pMess;
  const legacyHmNet = nHostel + nMess;
  const legacyHmOutstanding = Math.max(0, legacyHmNet - legacyHmVerified);
  const legacyHmExcess = Math.max(0, legacyHmVerified - legacyHmNet);

  return {
    studentId,
    components: {
      COLLEGE: collegeBalance,
      DEVELOPMENT: devBalance,
      HOSTEL: hostelBalance,
      MESS: messBalance,
    },
    historical: {
      combinedHostelMessCredit: hHist,
      unallocatedCredit: uHist,
      residualAllocationsDiscrepancy: residualDiscrepancyTotal,
      excessHostelMessCreditOverflow: excessHmOverflow,
    },
    accounts: {
      COLLEGE: {
        accountType: 'COLLEGE',
        receivingDestination: 'COLLEGE_ACCOUNT',
        assessedAmount: collegeAssessed,
        concessionAmount: collegeConcession,
        netPayable: nCollege,
        verifiedPaid: vCollege + uHist,
        pendingVerification: pCollege,
        outstandingBalance: Math.max(0, nCollege - (vCollege + uHist)),
        excessCredit: Math.max(0, (vCollege + uHist) - nCollege),
      },
      DEVELOPMENT: {
        accountType: 'DEVELOPMENT',
        receivingDestination: 'SECRETARY_DEV_ACCOUNT',
        assessedAmount: devAssessed,
        concessionAmount: devConcession,
        netPayable: nDev,
        verifiedPaid: vDev,
        pendingVerification: pDev,
        outstandingBalance: oDev,
        excessCredit: devExcess,
      },
      HOSTEL_MESS: {
        accountType: 'HOSTEL_MESS',
        receivingDestination: 'COLLEGE_ACCOUNT',
        assessedAmount: hostelAssessed + messAssessed,
        concessionAmount: hostelConcession + messConcession,
        netPayable: legacyHmNet,
        verifiedPaid: legacyHmVerified,
        pendingVerification: legacyHmPending,
        outstandingBalance: legacyHmOutstanding,
        excessCredit: legacyHmExcess,
      },
    },
    consolidated: {
      totalAssessed: collegeAssessed + devAssessed + hostelAssessed + messAssessed,
      totalConcessions: collegeConcession + devConcession + hostelConcession + messConcession,
      totalNetPayable: grossNetPayable,
      totalVerifiedPaid: totalVerifiedPaid + hHist,
      totalPendingVerification,
      totalOutstandingBalance,
      overallAvailableCollectionLimit,
      totalExcessCredit,
    },
  };
}

/**
 * Generates an atomic sequential receipt number for College or Development destination.
 * College sequence: KAMCH/RCP/COLLEGE/{YYYY}/{SEQ}
 * Dev sequence:     KAMCH/RCP/DEV/{YYYY}/{SEQ}
 */
export async function generateAtomicReceiptNumber(
  conn: PoolConnection,
  destination: 'COLLEGE_ACCOUNT' | 'SECRETARY_DEV_ACCOUNT'
): Promise<string> {
  const yearSuffix = new Date().getFullYear();
  const prefix = destination === 'SECRETARY_DEV_ACCOUNT'
    ? `KAMCH/RCP/DEV/${yearSuffix}/`
    : `KAMCH/RCP/COLLEGE/${yearSuffix}/`;

  // Lock and query latest receipt with this prefix
  const [rows] = await conn.query<any[]>(
    'SELECT receipt_number FROM fee_receipts WHERE receipt_number LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE',
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (rows && rows.length > 0 && rows[0]?.receipt_number) {
    const parts = String(rows[0].receipt_number).split('/');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Legacy support for collection groups during Stage 1 transition
 */
export async function createCollectionGroupPayment(
  params: {
    studentId: number;
    paymentDate: string;
    recordedBy: number;
    notes?: string;
    payments: Array<{
      destination: 'COLLEGE_ACCOUNT' | 'SECRETARY_DEV_ACCOUNT';
      paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'ONLINE_DEV';
      amount: number;
      studentTxRef?: string;
      bankName?: string;
      allocations: Array<{
        accountType: 'COLLEGE' | 'DEVELOPMENT' | 'HOSTEL_MESS';
        allocatedAmount: number;
        assessmentId?: number;
        billingPeriodId?: number;
      }>;
    }>;
  },
  conn: PoolConnection
): Promise<{ collectionGroupId: number; receiptNumber: string }> {
  const { studentId, paymentDate, recordedBy, notes, payments } = params;

  if (!payments || payments.length === 0) {
    throw new Error('At least one payment transaction is required in a collection group.');
  }

  // Enforce Secretary restriction on backend: Secretary can collect Development Fees only
  const [userRows] = await conn.query<any[]>(
    'SELECT r.code AS role_code FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? LIMIT 1',
    [recordedBy]
  );
  const roleCode = userRows[0]?.role_code;
  if (roleCode === 'SECRETARY') {
    for (const p of payments) {
      if (p.destination !== 'SECRETARY_DEV_ACCOUNT') {
        throw new Error('Secretary can only collect Development Fees via SECRETARY_DEV_ACCOUNT.');
      }
      for (const alloc of p.allocations) {
        if (alloc.accountType !== 'DEVELOPMENT') {
          throw new Error('Secretary can only collect Development Fees (DEVELOPMENT account).');
        }
      }
    }
  }

  let totalCollectionAmount = 0;
  for (const p of payments) {
    if (p.amount <= 0) {
      throw new Error('Payment amount must be positive.');
    }
    if (p.destination === 'SECRETARY_DEV_ACCOUNT') {
      for (const alloc of p.allocations) {
        if (alloc.accountType !== 'DEVELOPMENT') {
          throw new Error(`Fee type ${alloc.accountType} cannot be received into destination SECRETARY_DEV_ACCOUNT. Destination SECRETARY_DEV_ACCOUNT can only receive DEVELOPMENT fee allocations.`);
        }
      }
    } else if (p.destination === 'COLLEGE_ACCOUNT') {
      for (const alloc of p.allocations) {
        if (alloc.accountType === 'DEVELOPMENT') {
          throw new Error(`Fee type DEVELOPMENT cannot be received into destination COLLEGE_ACCOUNT. Destination COLLEGE_ACCOUNT cannot receive DEVELOPMENT fee allocations.`);
        }
      }
    }

    for (const alloc of p.allocations) {
      if (alloc.assessmentId) {
        const [assessRows] = await conn.query<any[]>(
          'SELECT student_id FROM student_fee_assessments WHERE id = ? LIMIT 1',
          [alloc.assessmentId]
        );
        if (assessRows && assessRows.length > 0 && Number(assessRows[0].student_id) !== Number(studentId)) {
          throw new Error(`Assessment ${alloc.assessmentId} does not belong to student ${studentId}.`);
        }
      }
    }

    const allocSum = p.allocations.reduce((s, a) => s + a.allocatedAmount, 0);
    if (Math.abs(allocSum - p.amount) > 0.01) {
      throw new Error(`Allocation sum (${allocSum}) does not equal underlying payment amount (${p.amount}) for destination ${p.destination}`);
    }

    totalCollectionAmount += p.amount;
  }

  const receiptNumber = await generateAtomicReceiptNumber(conn, payments[0]?.destination || 'COLLEGE_ACCOUNT');

  const isPendingGroup = payments.some(
    (p) => p.paymentMethod === 'BANK_TRANSFER' || (p.paymentMethod === 'ONLINE_DEV' && p.destination === 'SECRETARY_DEV_ACCOUNT')
  );
  const initialGroupStatus = isPendingGroup ? 'PENDING' : 'VERIFIED';

  // 1. Insert fee_collection_groups
  const [cgResult] = await conn.query<any>(
    `INSERT INTO fee_collection_groups (student_id, collection_reference, total_amount, payment_method, recorded_by, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [studentId, receiptNumber, totalCollectionAmount, payments[0]?.paymentMethod || 'CASH', recordedBy, notes || null, initialGroupStatus]
  );
  const collectionGroupId = cgResult.insertId;

  // 2. Insert fee_payments and fee_payment_allocations
  for (const p of payments) {
    const paymentRef = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const isPendingPayment = p.paymentMethod === 'BANK_TRANSFER' || (p.paymentMethod === 'ONLINE_DEV' && p.destination === 'SECRETARY_DEV_ACCOUNT');
    const paymentStatus = isPendingPayment ? 'PENDING_VERIFICATION' : 'VERIFIED';

    const [payResult] = await conn.query<any>(
      `INSERT INTO fee_payments 
        (assessment_id, student_id, collection_group_id, payment_reference, amount, destination, payment_method, student_tx_ref, bank_name, payment_date, recorded_by, notes, status, verified_by, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.allocations[0]?.assessmentId || null,
        studentId,
        collectionGroupId,
        paymentRef,
        p.amount,
        p.destination,
        p.paymentMethod,
        p.studentTxRef || null,
        p.bankName || null,
        paymentDate,
        recordedBy,
        notes || null,
        paymentStatus,
        paymentStatus === 'VERIFIED' ? recordedBy : null,
        paymentStatus === 'VERIFIED' ? new Date() : null,
      ]
    );
    const paymentId = payResult.insertId;

    for (const alloc of p.allocations) {
      await conn.query(
        `INSERT INTO fee_payment_allocations 
          (payment_id, student_id, financial_account, allocated_amount, assessment_id, service_enrollment_id, billing_period_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          studentId,
          alloc.accountType,
          alloc.allocatedAmount,
          alloc.assessmentId || null,
          alloc.billingPeriodId || null,
          alloc.billingPeriodId || null,
        ]
      );
    }

    // Only create receipt if verified cash
    if (!isPendingPayment) {
      await conn.query(
        `INSERT INTO fee_receipts 
          (payment_id, collection_group_id, student_id, receipt_number, receipt_type, destination, amount, requested_by, status, reviewed_by, reviewed_at, issued_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, NOW(), NOW())`,
        [
          paymentId,
          collectionGroupId,
          studentId,
          receiptNumber,
          p.destination === 'SECRETARY_DEV_ACCOUNT' ? 'SECRETARY_DEV_RECEIPT' : 'FINAL_COLLEGE_RECEIPT',
          p.destination,
          p.amount,
          recordedBy,
          recordedBy,
        ]
      );
    }
  }

  return { collectionGroupId, receiptNumber };
}
