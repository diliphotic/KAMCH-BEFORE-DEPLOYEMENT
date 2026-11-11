export type FeeComponentType = 'COLLEGE' | 'DEVELOPMENT' | 'HOSTEL' | 'MESS';

export type PaymentDestination = 'COLLEGE_ACCOUNT' | 'SECRETARY_DEV_ACCOUNT';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER';

export const formatINR = (val: number | string | null | undefined): string => {
  const num = typeof val === 'number' ? val : parseFloat(String(val ?? 0));
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export interface StudentAssessment {
  id: number;
  academicYear: string;
  isKeaExceptionApplied: boolean;
  keaExceptionReason: string | null;
  assessedCollegeFee: number;
  assessedDevelopmentFee: number;
  assessedMessFee: number;
  assessedHostelFee: number;
  totalAssessedFee: number;
  concessionTotal: number;
  revisedPayable: number;
}

export interface StudentFeeItem {
  id: number;
  studentIdNumber: string;
  temporaryRollNumber?: string | null;
  permanentUniversityNumber?: string | null;
  universityRegStatus?: string;
  fullName: string;
  admissionCategory: 'GOVERNMENT' | 'MANAGEMENT_PRIVATE' | 'NRI';
  admissionYear: number;
  currentYearOfStudy: number;
  isKeaEligible: boolean;
  keaAcknowledgementNo: string | null;
  messEnrolled: boolean;
  hostelEnrolled: boolean;
  status: string;
  currentAssessment: StudentAssessment | null;
  totalPaid: number;
  totalPending: number;
  outstandingBalance: number;
}

export interface ComponentLedgerBalance {
  component: FeeComponentType;
  receivingDestination: PaymentDestination;
  assessedAmount: number;
  concessionAmount: number;
  netPayable: number;
  verifiedPaid: number;
  pendingReserved: number;
  actualOutstanding: number;
  unreservedCapacity: number;
  maxPermittedNewPayment: number;
}

export interface StudentFinancialLedger {
  studentId: number;
  components: {
    COLLEGE: ComponentLedgerBalance;
    DEVELOPMENT: ComponentLedgerBalance;
    HOSTEL: ComponentLedgerBalance;
    MESS: ComponentLedgerBalance;
  };
  historical: {
    combinedHostelMessCredit: number;
    unallocatedCredit: number;
    residualAllocationsDiscrepancy: number;
    excessHostelMessCreditOverflow: number;
  };
  consolidated: {
    totalAssessed: number;
    totalConcessions: number;
    totalNetPayable: number;
    totalVerifiedPaid: number;
    totalPendingVerification: number;
    totalOutstandingBalance: number;
    overallAvailableCollectionLimit: number;
    totalExcessCredit: number;
  };
  accounts?: {
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
}

export interface PendingBankTransfer {
  id: number;
  paymentReference: string;
  paymentDate: string;
  studentName: string;
  studentIdNumber: string;
  admissionCategory: string;
  destination: PaymentDestination;
  feeComponent: FeeComponentType;
  paymentMethod: string;
  studentTxRef: string | null;
  bankName: string;
  amount: number;
  daysPending: number;
  recordedBy: string;
}

export interface ReceiptListItem {
  id: number;
  receiptNumber: string;
  receiptType: string;
  destination: PaymentDestination;
  amount: number;
  status: string;
  printedAt: string | null;
  printCount: number;
  isPrinted: boolean;
  issuedAt: string;
  paymentId: number;
  studentId: number;
  studentIdNumber: string;
  studentName: string;
  admissionCategory: string;
  currentYearOfStudy: number;
  feeComponent: FeeComponentType;
  paymentMethod: string;
  paymentDate: string;
  paymentReference: string;
  passbookTxRef: string | null;
  studentTxRef: string | null;
  bankName: string | null;
}

export interface ReceiptDetails {
  receiptNumber: string;
  receiptType: string;
  paymentReference: string;
  destination: PaymentDestination;
  issueDate: string;
  status: string;
  approvedAt: string | null;
  approvedBy: string;
  approvedByRole: string;
  student: {
    idNumber: string;
    name: string;
    category: string;
    academicYear: string;
    yearOfStudy: number;
  };
  assessment: {
    collegeFee: number;
    developmentFee: number;
    messFee: number;
    hostelFee: number;
    totalAssessed: number;
    concessions: number;
    revisedPayable: number;
  };
  payment: {
    amount: number;
    amountInWords: string;
    method: string;
    studentTxRef: string | null;
    passbookTxRef: string | null;
    bankName: string | null;
    paymentDate: string;
  };
  totalPaidSoFar: number;
  remainingBalance: number;
  printedAt?: string | null;
  printCount?: number;
}

export interface FeeStructure {
  id: number;
  academic_year: string;
  admission_category: 'GOVERNMENT' | 'MANAGEMENT_PRIVATE' | 'NRI';
  year_of_study: number;
  college_fee: number;
  development_fee: number;
  mess_fee: number;
  hostel_fee: number;
  total_annual_fee: number;
  description: string;
  is_active: boolean;
}

export interface ServiceBillingPeriod {
  id: number;
  enrollment_id: number;
  student_id: number;
  student_id_number?: string;
  student_name?: string;
  service_type: 'HOSTEL' | 'MESS';
  period_start_date: string;
  period_end_date: string;
  assessed_amount: number;
  status: 'ACTIVE' | 'TERMINATED' | 'COMPLETED';
  termination_date: string | null;
  termination_reason: string | null;
}

export interface AcademicYearSettings {
  commencementMonth: number;
  commencementDay: number;
  commencementDateFormatted: string;
  updatedAt: string | null;
  updatedByName: string | null;
  defaultMonth: number;
  defaultDay: number;
}
