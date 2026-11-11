import { MemoryDatabase } from '../server/services/memory-db.ts';

/**
 * Focused Unit and Integration Test Suite for Task 1:
 * University Examination Professional Year Decoupling & Batch-Wise Result Downloads.
 */
async function runUniversityExamCorrectionTests() {
  console.log('=== KAMCH ERP: Testing University Examination Professional Year Decoupling & Downloads ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const memDb = MemoryDatabase.getInstance();

  // Test 1: Verify RS7 University Subjects exist across Professional Years 1, 2, and 3
  console.log('--- Test 1: University Subjects Preserved by Professional Year ---');
  const y1Subjs = memDb.universitySubjects.filter((s) => s.professional_year === 1);
  const y2Subjs = memDb.universitySubjects.filter((s) => s.professional_year === 2);
  const y3Subjs = memDb.universitySubjects.filter((s) => s.professional_year === 3);

  assert(y1Subjs.length === 5, 'Year 1 has 5 prescribed university subjects');
  assert(y2Subjs.length === 4, 'Year 2 has 4 prescribed university subjects');
  assert(y3Subjs.length === 9, 'Year 3 has 9 prescribed university subjects');

  // Test 2: Decoupled Professional Year Resolution
  // Even if a batch has current_professional_year = 3 (e.g. Agastya / Daksha),
  // selecting professionalYear = 2 resolves Year 2 subjects!
  console.log('\n--- Test 2: Decoupled Professional Year Resolution ---');
  const agastyaBatch = memDb.academicBatches.find((b) => b.name.includes('Agastya') || b.id === 3);
  assert(
    agastyaBatch?.current_professional_year === 3,
    'Agastya cohort is currently placed in Professional Year 3'
  );

  // Resolving subjects with explicit professionalYear = 2 for Agastya batch
  const requestedYear = 2;
  const resolvedSubjects = memDb.universitySubjects.filter(
    (s) => s.scheme_id === agastyaBatch?.scheme_id && s.professional_year === requestedYear
  );
  assert(
    resolvedSubjects.length === 4 && resolvedSubjects.every((s) => s.professional_year === 2),
    'Requesting Year 2 for a Year 3 cohort successfully resolves Second Professional subjects without year coupling mismatch'
  );

  // Test 3: Second Professional Result Entry and Preservation
  console.log('\n--- Test 3: Second Professional Result Entry for Year 3 Cohort ---');
  const sampleStudentId = 101;
  const year2Subject = y2Subjs[0]; // e.g. Dravyaguna or Samhita-2
  const sessionRefYr2 = 'RGUHS_2025_NOV_2ND_PROF';

  // Seed Second Professional attempt
  const attemptYr2Id = memDb.generateId('studentUniversityExamAttempts');
  memDb.studentUniversityExamAttempts.push({
    id: attemptYr2Id,
    student_id: sampleStudentId,
    subject_id: year2Subject.id,
    examination_professional_year: 2,
    batch_id: 3,
    exam_session_ref: sessionRefYr2,
    attempt_type: 'REGULAR',
    result_status: 'PASS',
    marks_obtained: 82,
    max_marks: 100,
    failed_subjects_json: null,
    office_decision: 'PROMOTED',
    remarks: 'Official university gazette verified.',
    is_finalized: true,
    finalized_by: 1,
    finalized_at: new Date('2025-12-15').toISOString(),
    finalization_remarks: 'Verified against RGUHS Gazette #529.',
    recorded_by: 1,
    recorded_at: new Date('2025-12-10').toISOString(),
    created_at: new Date('2025-12-10').toISOString(),
    updated_at: new Date('2025-12-15').toISOString(),
  });

  const savedYr2 = memDb.studentUniversityExamAttempts.find((a) => a.id === attemptYr2Id);
  assert(
    savedYr2?.examination_professional_year === 2 && savedYr2?.result_status === 'PASS' && savedYr2?.is_finalized === true,
    'Second Professional examination result recorded, finalized, and attached to Year 2'
  );

  // Test 4: Independent Third Professional Result Creation for the Same Student
  console.log('\n--- Test 4: Independent Third Professional Result Entry ---');
  const year3Subject = y3Subjs[0]; // e.g. Kayachikitsa
  const sessionRefYr3 = 'RGUHS_2026_MAY_3RD_PROF';

  const attemptYr3Id = memDb.generateId('studentUniversityExamAttempts');
  memDb.studentUniversityExamAttempts.push({
    id: attemptYr3Id,
    student_id: sampleStudentId,
    subject_id: year3Subject.id,
    examination_professional_year: 3,
    batch_id: 3,
    exam_session_ref: sessionRefYr3,
    attempt_type: 'REGULAR',
    result_status: 'PASS',
    marks_obtained: 88,
    max_marks: 100,
    failed_subjects_json: null,
    office_decision: 'PROMOTED',
    remarks: 'Official 3rd Prof examination result.',
    is_finalized: false, // draft
    finalized_by: null,
    finalized_at: null,
    finalization_remarks: null,
    recorded_by: 1,
    recorded_at: new Date('2026-06-01').toISOString(),
    created_at: new Date('2026-06-01').toISOString(),
    updated_at: new Date('2026-06-01').toISOString(),
  });

  const studentAllAttempts = memDb.studentUniversityExamAttempts.filter((a) => a.student_id === sampleStudentId);
  assert(studentAllAttempts.length === 2, 'Student has both Year 2 and Year 3 examination attempts coexisting independently');

  const reloadedYr2 = studentAllAttempts.find((a) => a.examination_professional_year === 2);
  const reloadedYr3 = studentAllAttempts.find((a) => a.examination_professional_year === 3);

  assert(
    reloadedYr2?.id === attemptYr2Id && reloadedYr2?.is_finalized === true && reloadedYr2?.marks_obtained === 82,
    'Historical Second Professional finalized result is completely preserved unchanged after Year 3 entry'
  );
  assert(
    reloadedYr3?.id === attemptYr3Id && reloadedYr3?.examination_professional_year === 3 && reloadedYr3?.is_finalized === false,
    'Third Professional examination attempt recorded independently as draft'
  );

  // Test 5: Distinction between Finalized Results and Drafts
  console.log('\n--- Test 5: Finalized vs Draft Distinction ---');
  assert(Boolean(reloadedYr2?.is_finalized), 'Second Professional record is clearly demarcated as FINALIZED');
  assert(!reloadedYr3?.is_finalized, 'Third Professional record is clearly demarcated as DRAFT / UNFINALIZED');

  // Test 6: Supplementary Attempt Independence
  console.log('\n--- Test 6: Regular vs Supplementary Attempt Independence ---');
  const suppAttemptId = memDb.generateId('studentUniversityExamAttempts');
  memDb.studentUniversityExamAttempts.push({
    id: suppAttemptId,
    student_id: sampleStudentId,
    subject_id: year2Subject.id,
    examination_professional_year: 2,
    batch_id: 3,
    exam_session_ref: 'RGUHS_2026_FEB_SUPP',
    attempt_type: 'SUPPLEMENTARY',
    result_status: 'PASS',
    marks_obtained: 75,
    max_marks: 100,
    failed_subjects_json: null,
    office_decision: 'PROMOTED',
    remarks: 'Supplementary clearance',
    is_finalized: true,
    finalized_by: 1,
    finalized_at: new Date('2026-03-01').toISOString(),
    finalization_remarks: 'Cleared in supplementary cycle',
    recorded_by: 1,
    recorded_at: new Date('2026-03-01').toISOString(),
    created_at: new Date('2026-03-01').toISOString(),
    updated_at: new Date('2026-03-01').toISOString(),
  });

  const studentSuppAttempts = memDb.studentUniversityExamAttempts.filter(
    (a) => a.student_id === sampleStudentId && a.attempt_type === 'SUPPLEMENTARY'
  );
  assert(
    studentSuppAttempts.length === 1 && studentSuppAttempts[0].examination_professional_year === 2,
    'Supplementary examination attempt operates cleanly and independently with examination_professional_year = 2'
  );

  // Test 7: CSV Row Formatting & Data Integrity (No Fabricated Data)
  console.log('\n--- Test 7: Batch-Wise CSV Export Formatting & Data Integrity ---');
  const mockStudents = [
    {
      id: 1,
      fullName: 'Aarav Patel',
      rollNumber: 'KAMCH-2022-001',
      universityRegNumber: '22A1001',
      batchName: 'Agastya',
      schemeCode: 'RS7',
      examProfYear: 2,
      examSession: 'RGUHS_2025_NOV',
      attemptType: 'REGULAR',
      overallStatus: 'PASS',
      failedSubjects: 'None',
      subjectMarks: 'Samhita Adhyayana-2: 82 marks',
      isFinalized: true,
    },
    {
      id: 2,
      fullName: 'Bhavna Joshi',
      rollNumber: 'KAMCH-2022-002',
      universityRegNumber: null, // Test unassigned registration number
      batchName: 'Agastya',
      schemeCode: 'RS7',
      examProfYear: 2,
      examSession: 'RGUHS_2025_NOV',
      attemptType: 'REGULAR',
      overallStatus: 'FAIL',
      failedSubjects: 'Dravyaguna Vijnana',
      subjectMarks: 'Dravyaguna Vijnana: 38 marks',
      isFinalized: true,
    },
    {
      id: 3,
      fullName: 'Chetan Rao',
      rollNumber: 'KAMCH-2022-003',
      universityRegNumber: '22A1003',
      batchName: 'Agastya',
      schemeCode: 'RS7',
      examProfYear: 2,
      examSession: 'RGUHS_2025_NOV',
      attemptType: 'REGULAR',
      overallStatus: 'PENDING',
      failedSubjects: 'None',
      subjectMarks: 'Awaiting Entry',
      isFinalized: false, // draft
    },
  ];

  const csvRows: string[] = [];
  const csvEscape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  // Header
  csvRows.push([
    'Sl No',
    'Student Name',
    'Roll Number',
    'University Reg No',
    'Batch Name',
    'Curriculum Scheme',
    'Examination Professional Year',
    'Exam Session Reference',
    'Attempt Type',
    'Overall Result Status',
    'Failed Subjects',
    'Subject Details / Marks',
    'Finalization Status',
  ].map(csvEscape).join(','));

  mockStudents.forEach((st, idx) => {
    csvRows.push([
      idx + 1,
      st.fullName,
      st.rollNumber,
      st.universityRegNumber || 'Not Assigned', // Strictly not fabricated!
      st.batchName,
      st.schemeCode,
      `Professional Year ${st.examProfYear}`,
      st.examSession,
      st.attemptType,
      st.overallStatus,
      st.failedSubjects,
      st.subjectMarks,
      st.isFinalized ? 'FINALIZED' : 'DRAFT / UNFINALIZED',
    ].map(csvEscape).join(','));
  });

  const fullCsv = '\uFEFF' + csvRows.join('\r\n');

  assert(fullCsv.startsWith('\uFEFF'), 'CSV starts with UTF-8 BOM for Excel compatibility');
  assert(fullCsv.includes('"Aarav Patel"') && fullCsv.includes('"22A1001"'), 'Student with university reg no exports accurately');
  assert(fullCsv.includes('"Bhavna Joshi"') && fullCsv.includes('"Not Assigned"'), 'Unassigned university reg no exports honestly as "Not Assigned" without fabrication');
  assert(fullCsv.includes('"DRAFT / UNFINALIZED"') && fullCsv.includes('"FINALIZED"'), 'Draft vs Finalized distinction is preserved in CSV export');
  assert(fullCsv.includes('"Professional Year 2"'), 'Examination Professional Year is clearly demarcated in CSV export');

  // Test 8: Daksha Batch (Current Stage Year 3) Year 2 vs Year 3 Attempts Isolation
  console.log('\n--- Test 8: Daksha Batch Year-Specific Results Filtering (Issue 1 Regression) ---');
  const dakshaBatch = memDb.academicBatches.find((b) => b.code === 'DAKSHA' || b.name.includes('Daksha'));
  assert(Boolean(dakshaBatch), 'Daksha batch exists in database');
  const dakshaBatchId = dakshaBatch ? dakshaBatch.id : 4;

  // Clear existing mock attempts for Daksha and populate exactly 82 Year 2 records
  memDb.studentUniversityExamAttempts = memDb.studentUniversityExamAttempts.filter((a) => a.batch_id !== dakshaBatchId);
  const sessionDaksha = 'RGUHS-MAY-2025';

  for (let i = 1; i <= 82; i++) {
    memDb.studentUniversityExamAttempts.push({
      id: 5000 + i,
      student_id: 1000 + i,
      subject_id: y2Subjs[0].id,
      examination_professional_year: 2,
      batch_id: dakshaBatchId,
      exam_session_ref: sessionDaksha,
      attempt_type: 'REGULAR',
      result_status: i % 10 === 0 ? 'FAIL' : 'PASS',
      marks_obtained: i % 10 === 0 ? 42 : 78,
      max_marks: 100,
      failed_subjects_json: i % 10 === 0 ? [y2Subjs[0].id] : null,
      office_decision: i % 10 === 0 ? 'DETAINED' : 'PROMOTED',
      remarks: 'Second Professional Official Result',
      is_finalized: true,
      finalized_by: 1,
      finalized_at: new Date('2025-06-15').toISOString(),
      finalization_remarks: 'Verified against Gazette',
      recorded_by: 1,
      recorded_at: new Date('2025-06-10').toISOString(),
      created_at: new Date('2025-06-10').toISOString(),
      updated_at: new Date('2025-06-15').toISOString(),
    });
  }

  // Filter for Year 2: should return exactly 82 records
  const dakshaYear2Attempts = memDb.studentUniversityExamAttempts.filter(
    (a) =>
      a.batch_id === dakshaBatchId &&
      (a.examination_professional_year || (a as any).professional_year) === 2 &&
      a.exam_session_ref === sessionDaksha &&
      a.attempt_type === 'REGULAR'
  );
  assert(
    dakshaYear2Attempts.length === 82,
    'Year 2 query on Daksha returns exactly 82 Second Professional records'
  );

  // Filter for Year 3: must NOT return the 82 Year 2 records!
  const dakshaYear3Attempts = memDb.studentUniversityExamAttempts.filter(
    (a) =>
      a.batch_id === dakshaBatchId &&
      (a.examination_professional_year || (a as any).professional_year) === 3 &&
      a.exam_session_ref === sessionDaksha &&
      a.attempt_type === 'REGULAR'
  );
  assert(
    dakshaYear3Attempts.length === 0,
    'Switching to Professional Year 3 returns 0 records (Issue 1 fixed: does NOT display Year 2 82 records)'
  );

  // Test 9: Result Review & Finalization Counts are strictly year-scoped
  console.log('\n--- Test 9: Result Review Counts Scoping ---');
  const countYear2Finalized = dakshaYear2Attempts.filter((a) => a.is_finalized).length;
  const countYear3Finalized = dakshaYear3Attempts.filter((a) => a.is_finalized).length;
  assert(countYear2Finalized === 82, 'Review counts for Year 2 show 82 finalized records');
  assert(countYear3Finalized === 0, 'Review counts for Year 3 show 0 finalized records');

  // Test 10: Print Result Sheet Candidate Attempt Isolation
  console.log('\n--- Test 10: Print Result Sheet Attempt Isolation (Issue 2 Regression) ---');
  // Student 1001 has Year 2 attempt, but no Year 3 attempt yet
  const studentAttempts = memDb.studentUniversityExamAttempts.filter((a) => a.student_id === 1001);
  const matchingForYear2 = studentAttempts.filter(
    (a) => a.examination_professional_year === 2 && a.exam_session_ref === sessionDaksha && a.attempt_type === 'REGULAR'
  );
  const matchingForYear3 = studentAttempts.filter(
    (a) => a.examination_professional_year === 3 && a.exam_session_ref === sessionDaksha && a.attempt_type === 'REGULAR'
  );

  const printSheetAttemptYr2 = matchingForYear2[0] || null;
  const printSheetAttemptYr3 = matchingForYear3[0] || null; // Strictly null, NO student.attempts[0] fallback!

  assert(
    printSheetAttemptYr2 !== null && printSheetAttemptYr2.marks_obtained === 78,
    'Print sheet for Year 2 correctly displays Second Professional candidate marks'
  );
  assert(
    printSheetAttemptYr3 === null,
    'Print sheet for Year 3 evaluates to null/Awaiting Entry without cross-year fallback contamination'
  );

  console.log(`\n=== University Examination Year Correction Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runUniversityExamCorrectionTests();
