import test from 'node:test'
import assert from 'node:assert/strict'
import { isSameScholarshipTerm, shouldFlagMultipleActiveScholarships, studentNamesMatch, studentSearchText } from '../src/utils/workflowRules.ts'

test('student ID identity validation accepts normalized matching names and rejects mismatches', () => {
  assert.equal(studentNamesMatch(' Angela ', 'AGUILAR', 'angela', 'Aguilar'), true)
  assert.equal(studentNamesMatch('Angela', 'Aguilar', 'Maria', 'Aguilar'), false)
})

test('advanced student search contains every supported searchable field', () => {
  const text = studentSearchText({ student_number: '25-1001', full_name: 'Aguilar, Angela', college: 'Engineering', program: 'BSCE', scholarship: 'DOST-SEI', email: 'angela@example.test', contactNumber: '09171234567', academic_year: '2025-2026', semester: '1st Semester' })
  for (const query of ['agu', 'dost', '0917', '2025', '1st semester']) assert.equal(text.includes(query), true)
})

test('renewal duplicate validation matches scholarship, academic year, and semester', () => {
  const source = { scholarshipId: 'dost', academicYear: '2025-2026', semester: '1st Semester' }
  assert.equal(isSameScholarshipTerm(source, { ...source }), true)
  assert.equal(isSameScholarshipTerm(source, { ...source, semester: '2nd Semester' }), false)
})

test('duplicate flag requires same student, term, and two Active assignments', () => {
  const left = { studentId: 'student-1', academicYear: '2025-2026', semester: '1st Semester', status: 'Active' }
  assert.equal(shouldFlagMultipleActiveScholarships(left, { ...left }), true)
  assert.equal(shouldFlagMultipleActiveScholarships(left, { ...left, semester: '2nd Semester' }), false)
  assert.equal(shouldFlagMultipleActiveScholarships(left, { ...left, status: 'Inactive' }), false)
})
