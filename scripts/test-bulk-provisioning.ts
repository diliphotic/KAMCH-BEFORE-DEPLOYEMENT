import bcrypt from 'bcryptjs';
import { MemoryDatabase } from '../server/services/memory-db.ts';
import {
  ROLES,
  ASSIGNABLE_ACCOUNT_ROLES,
  NON_LOGIN_ROLES,
  USER_MANAGEMENT_ROLES,
} from '../server/permissions.ts';

function validatePasswordPolicy(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one number or symbol' };
  }
  return { valid: true };
}

function generateRandomPassword(): string {
  const charsUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const charsLower = 'abcdefghijkmnopqrstuvwxyz';
  const charsDigits = '23456789';
  const charsSymbols = '!@#$%^&*';

  const getRandom = (str: string) => str.charAt(Math.floor(Math.random() * str.length));

  const p1 = getRandom(charsUpper);
  const p2 = getRandom(charsUpper);
  const p3 = getRandom(charsLower);
  const p4 = getRandom(charsLower);
  const p5 = getRandom(charsLower);
  const p6 = getRandom(charsDigits);
  const p7 = getRandom(charsDigits);
  const p8 = getRandom(charsSymbols);

  const arr = [p1, p2, p3, p4, p5, p6, p7, p8];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return 'K' + arr.join('');
}

function generateUsernameFromTeacher(
  teacher: { fullName: string; employeeCode?: string; teacherCode?: string },
  scheme: 'first_last' | 'employee_code' | 'teacher_code'
): string {
  if (scheme === 'employee_code' && teacher.employeeCode) {
    return teacher.employeeCode.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  }
  if (scheme === 'teacher_code' && teacher.teacherCode) {
    return teacher.teacherCode.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  }
  const parts = teacher.fullName
    .toLowerCase()
    .trim()
    .replace(/^(dr\.|prof\.|mr\.|mrs\.|ms\.)\s+/i, '')
    .split(/\s+/);
  if (parts.length === 1) return parts[0].replace(/[^a-z0-9]/g, '');
  const first = parts[0].replace(/[^a-z0-9]/g, '');
  const last = parts[parts.length - 1].replace(/[^a-z0-9]/g, '');
  return `${first}.${last}`;
}

async function runBulkProvisioningTests() {
  console.log('================================================================');
  console.log('KAMCH ERP — TASK 5: BULK PROVISIONING SUITE');
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

  // 1. Password Policy Validation Tests
  console.log('--- 1. Password Policy Validation ---');
  assert(validatePasswordPolicy('Kamch2026!#').valid, 'Valid password with uppercase and symbol passes');
  assert(!validatePasswordPolicy('short').valid, 'Password under 8 chars fails');
  assert(!validatePasswordPolicy('lowercaseonly!1').valid, 'Password without uppercase fails');
  assert(!validatePasswordPolicy('NOOPERCASELETTERSHERE').valid, 'Password without number/symbol fails');

  // 2. Password Generator Strength Tests
  console.log('\n--- 2. Random Password Generator Strength ---');
  for (let i = 0; i < 5; i++) {
    const p = generateRandomPassword();
    assert(p.length >= 8, `Generated password ${p} length >= 8`);
    assert(validatePasswordPolicy(p).valid, `Generated password ${p} passes policy check`);
  }

  // 3. Username Scheme Generation Tests
  console.log('\n--- 3. Username Scheme Generation ---');
  const sampleTeacher = {
    fullName: 'Dr. Ramesh Sharma',
    employeeCode: 'TCH001',
    teacherCode: 'AYU-TCH-001',
  };
  assert(
    generateUsernameFromTeacher(sampleTeacher, 'first_last') === 'ramesh.sharma',
    'firstname.lastname scheme strips prefixes and outputs ramesh.sharma'
  );
  assert(
    generateUsernameFromTeacher(sampleTeacher, 'employee_code') === 'tch001',
    'employee_code scheme outputs tch001'
  );
  assert(
    generateUsernameFromTeacher(sampleTeacher, 'teacher_code') === 'ayu-tch-001',
    'teacher_code scheme outputs ayu-tch-001'
  );

  // 4. Role Guards and Super Admin Protection
  console.log('\n--- 4. Role Guards and Security Policy ---');
  assert(!ASSIGNABLE_ACCOUNT_ROLES.includes(ROLES.SUPER_ADMIN), 'SUPER_ADMIN is excluded from assignable roles');
  assert(!ASSIGNABLE_ACCOUNT_ROLES.includes(ROLES.STUDENT), 'STUDENT is excluded from assignable roles');
  assert(ASSIGNABLE_ACCOUNT_ROLES.includes(ROLES.FACULTY), 'FACULTY is assignable');
  assert(ASSIGNABLE_ACCOUNT_ROLES.includes(ROLES.DEPARTMENT), 'DEPARTMENT is assignable');

  // Summary
  console.log('\n================================================================');
  console.log(`TOTAL BULK PROVISIONING TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runBulkProvisioningTests().catch((err) => {
  console.error('Error running bulk provisioning tests:', err);
  process.exit(1);
});
