/**
 * Targeted verification script for Attendance Module Corrections & Teacher Schema Fix
 */

import { isNonAcademicClassType } from '../server/routes/attendance.routes.js';
import { isNonSubjectClassType, getSlotDisplaySubject } from '../src/views/AttendanceManagementView.js';

console.log('=== Running Verification: Attendance Corrections & Teacher Schema ===\n');

// Test 1: Non-academic class type classification in backend
console.log('Test 1: Backend Non-Academic Class Type Classifier');
const backendTypes = [
  { type: 'MENTOR', expected: true },
  { type: 'SPORTS', expected: true },
  { type: 'LIB', expected: true },
  { type: 'LIBRARY', expected: true },
  { type: 'LT', expected: false },
  { type: 'NLT', expected: false },
  { type: 'NLP', expected: false },
  { type: 'OTHER', expected: false },
];

for (const t of backendTypes) {
  const result = isNonAcademicClassType(t.type);
  if (result !== t.expected) {
    throw new Error(`Failed Test 1 for type ${t.type}: expected ${t.expected}, got ${result}`);
  }
}
console.log('✓ All backend class types classified accurately.\n');

// Test 2: Frontend non-subject classifier
console.log('Test 2: Frontend Non-Subject Class Type Classifier');
const mockClassTypesList = [
  { abbreviation: 'MENTOR', name: 'Mentor-Mentee' },
  { abbreviation: 'SPORTS', name: 'Sports & Physical Education' },
  { abbreviation: 'LIB', name: 'Library' },
  { abbreviation: 'LT', name: 'Lecture' },
  { abbreviation: 'NLT', name: 'Non-Lecture Theory' },
  { abbreviation: 'NLP', name: 'Non-Lecture Practical' },
];

const frontendTests = [
  { type: 'MENTOR', expected: true },
  { type: 'SPORTS', expected: true },
  { type: 'LIB', expected: true },
  { type: 'LT', expected: false },
  { type: 'NLT', expected: false },
  { type: 'NLP', expected: false },
];

for (const t of frontendTests) {
  const result = isNonSubjectClassType(t.type, mockClassTypesList);
  if (result !== t.expected) {
    throw new Error(`Failed Test 2 for frontend type ${t.type}: expected ${t.expected}, got ${result}`);
  }
}
console.log('✓ All frontend class types evaluated correctly.\n');

// Test 3: Display subject label resolution
console.log('Test 3: Slot Display Label Resolution');
if (getSlotDisplaySubject('Anatomy', 'LT') !== 'Anatomy') {
  throw new Error('Expected "Anatomy" when subjectName is present');
}
if (getSlotDisplaySubject(null, 'MENTOR') !== 'Mentor-Mentee') {
  throw new Error('Expected "Mentor-Mentee" fallback for null subject');
}
if (getSlotDisplaySubject(null, 'SPORTS') !== 'Sports & Physical Education') {
  throw new Error('Expected "Sports & Physical Education" fallback for null subject');
}
if (getSlotDisplaySubject(null, 'LIB') !== 'Library Classes') {
  throw new Error('Expected "Library Classes" fallback for null subject');
}
console.log('✓ Slot display subject fallbacks resolve correctly.\n');

// Test 4: Subject-wise attendance calculation simulation (academic vs non-academic exclusion)
console.log('Test 4: Simulation of Attendance Percentages with Academic & Non-Academic Slots');

const sampleSlots = [
  { id: 1, class_type: 'LT', subject_id: 10, is_academic: true, attended: true },
  { id: 2, class_type: 'LT', subject_id: 10, is_academic: true, attended: false },
  { id: 3, class_type: 'NLP', subject_id: 10, is_academic: true, attended: true },
  { id: 4, class_type: 'MENTOR', subject_id: null, is_academic: false, attended: true }, // must be excluded
  { id: 5, class_type: 'SPORTS', subject_id: null, is_academic: false, attended: false }, // must be excluded
  { id: 6, class_type: 'LIB', subject_id: null, is_academic: false, attended: true }, // must be excluded
];

let academicRecorded = 0;
let academicPresent = 0;

for (const s of sampleSlots) {
  if (isNonAcademicClassType(s.class_type)) {
    // Strictly excluded from academic calculation
    continue;
  }
  academicRecorded++;
  if (s.attended) academicPresent++;
}

const academicPercentage = academicRecorded > 0 ? (academicPresent / academicRecorded) * 100 : null;

if (academicRecorded !== 3) {
  throw new Error(`Expected exactly 3 academic sessions, found ${academicRecorded}`);
}
if (academicPresent !== 2) {
  throw new Error(`Expected exactly 2 attended academic sessions, found ${academicPresent}`);
}
if (Math.round(academicPercentage!) !== 67) {
  throw new Error(`Expected ~66.67% academic percentage, got ${academicPercentage}`);
}
console.log(`✓ Excluded all non-academic slots. Academic attendance: ${academicPresent}/${academicRecorded} (${academicPercentage?.toFixed(2)}%).\n`);

console.log('====================================================');
console.log('All targeted verification tests PASSED successfully!');
console.log('====================================================\n');
