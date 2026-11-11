import { MemoryDatabase } from '../server/services/memory-db.ts';
import {
  getPermittedModules,
  canAccessModule,
  getDefaultModuleForRole,
} from '../src/config/permissions.ts';

async function runDashboardTests() {
  console.log('================================================================');
  console.log('KAMCH ERP — TASK 6: DASHBOARD & OVERVIEW ALIGNMENT TEST SUITE');
  console.log('================================================================\n');

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

  // 1. Role Module Visibility Verification
  console.log('--- 1. Role Module Visibility ---');
  const superAdminMods = getPermittedModules('SUPER_ADMIN');
  assert(superAdminMods.includes('welcome'), 'SUPER_ADMIN includes welcome');
  assert(superAdminMods.includes('user_mgmt'), 'SUPER_ADMIN includes user_mgmt');
  assert(superAdminMods.includes('fees_mgmt'), 'SUPER_ADMIN includes fees_mgmt');
  assert(superAdminMods.includes('student_records'), 'SUPER_ADMIN includes student_records');
  assert(superAdminMods.includes('teacher_records'), 'SUPER_ADMIN includes teacher_records');
  assert(superAdminMods.includes('marks_mgmt'), 'SUPER_ADMIN includes marks_mgmt');
  assert(superAdminMods.includes('univ_exams'), 'SUPER_ADMIN includes univ_exams');
  assert(superAdminMods.includes('dept_portal'), 'SUPER_ADMIN includes dept_portal');
  assert(superAdminMods.includes('library_mgmt'), 'SUPER_ADMIN includes library_mgmt');
  assert(superAdminMods.includes('leave_mgmt'), 'SUPER_ADMIN includes leave_mgmt');
  assert(superAdminMods.includes('attendance_mgmt'), 'SUPER_ADMIN includes attendance_mgmt');

  const officeMods = getPermittedModules('OFFICE');
  assert(!officeMods.includes('user_mgmt'), 'OFFICE cannot access user_mgmt');
  assert(!officeMods.includes('library_mgmt'), 'OFFICE cannot access library_mgmt');
  assert(officeMods.includes('fees_mgmt'), 'OFFICE can access fees_mgmt');
  assert(officeMods.includes('student_records'), 'OFFICE can access student_records');
  assert(officeMods.includes('teacher_records'), 'OFFICE can access teacher_records');
  assert(officeMods.includes('marks_mgmt'), 'OFFICE can access marks_mgmt');
  assert(officeMods.includes('univ_exams'), 'OFFICE can access univ_exams');

  const libraryMods = getPermittedModules('LIBRARY');
  assert(libraryMods.length === 1 && libraryMods[0] === 'library_mgmt', 'LIBRARY role has access strictly to library_mgmt only');

  const facultyMods = getPermittedModules('FACULTY');
  assert(facultyMods.includes('leave_mgmt'), 'FACULTY includes leave_mgmt');
  assert(facultyMods.includes('attendance_mgmt'), 'FACULTY includes attendance_mgmt');
  assert(!facultyMods.includes('user_mgmt'), 'FACULTY cannot access user_mgmt');
  assert(!facultyMods.includes('fees_mgmt'), 'FACULTY cannot access fees_mgmt');

  // 2. Default Redirect / Landing Module Verification
  console.log('\n--- 2. Default Role Landing Modules ---');
  assert(getDefaultModuleForRole('SUPER_ADMIN') === 'welcome', 'SUPER_ADMIN lands on welcome overview');
  assert(getDefaultModuleForRole('DEPARTMENT') === 'dept_portal', 'DEPARTMENT lands on dept_portal');
  assert(getDefaultModuleForRole('LIBRARY') === 'library_mgmt', 'LIBRARY lands on library_mgmt');
  assert(getDefaultModuleForRole('FACULTY') === 'welcome', 'FACULTY lands on welcome overview');

  // 3. Unauthenticated Access Protection
  console.log('\n--- 3. Unauthenticated Access Protection ---');
  assert(canAccessModule(null, 'welcome'), 'Unauthenticated user can view public welcome overview');
  assert(!canAccessModule(null, 'user_mgmt'), 'Unauthenticated user CANNOT view user_mgmt');
  assert(!canAccessModule(null, 'fees_mgmt'), 'Unauthenticated user CANNOT view fees_mgmt');
  assert(!canAccessModule(null, 'student_records'), 'Unauthenticated user CANNOT view student_records');

  // Summary
  console.log('\n================================================================');
  console.log(`TOTAL DASHBOARD TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runDashboardTests().catch((err) => {
  console.error('Error running dashboard tests:', err);
  process.exit(1);
});
