import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isSameScholarshipTerm, shouldFlagMultipleActiveScholarships, studentNamesMatch, studentSearchText } from '../src/utils/workflowRules.ts'

test('student ID identity validation accepts normalized matching names and rejects mismatches', () => {
  assert.equal(studentNamesMatch(' Angela ', 'AGUILAR', 'angela', 'Aguilar'), true)
  assert.equal(studentNamesMatch('Angela', 'Aguilar', 'Maria', 'Aguilar'), false)
})

test('advanced student search contains every supported searchable field', () => {
  const text = studentSearchText({ student_number: '25-1001', full_name: 'Aguilar, Angela', college: 'Engineering', program: 'BSCE', scholarship: 'DOST-SEI', email: 'angela@example.test', contactNumber: '09171234567', academic_year: '2025-2026', semester: '1st Semester' })
  for (const query of ['agu', 'dost', '0917', '2025', '1st semester']) assert.equal(text.includes(query), true)
})

test('student record filters use live academic periods and support Summer', () => {
  const page = readFileSync('src/pages/StudentRecordsPage.tsx', 'utf8')
  assert.match(page, /academicYearOptions/)
  assert.match(page, /new Set\(rows\.map\(\(row\) => row\.academic_year\)/)
  assert.match(page, /'1st Semester', '2nd Semester', 'Summer'/)
  assert.doesNotMatch(page, /options=\{\['2025-2026'\]\}/)
})

test('spreadsheet imports enforce safe limits and do not use vulnerable SheetJS', () => {
  const importer = readFileSync('src/utils/importStudents.ts', 'utf8')
  assert.match(importer, /MAX_IMPORT_BYTES/)
  assert.match(importer, /MAX_IMPORT_ROWS/)
  assert.match(importer, /readXlsxFile\(file\)/)
  assert.doesNotMatch(importer, /from ['"]xlsx['"]/)
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

test('archive actions use SIGMA dialogs and the shared header remains sticky', () => {
  const scholarships = readFileSync('src/pages/ScholarshipsPage.tsx', 'utf8')
  const studentArchive = readFileSync('src/components/students/StudentArchiveModal.tsx', 'utf8')
  const studentRecords = readFileSync('src/pages/StudentRecordsPage.tsx', 'utf8')
  const styles = readFileSync('src/index.css', 'utf8')

  assert.doesNotMatch(scholarships, /\b(?:window\.)?confirm\s*\(/)
  assert.match(scholarships, /<ConfirmationDialog/)
  assert.match(scholarships, /Archive Scholarship\?/)
  assert.match(scholarships, /Show Archived/)
  assert.match(scholarships, /Scholarship archived successfully\./)
  assert.match(studentArchive, /Archive Student\?/)
  assert.match(studentArchive, /Show Archived/)
  assert.match(studentArchive, /will not be permanently deleted/)
  assert.match(studentRecords, /Student archived successfully\./)
  assert.match(styles, /\.sigma-site-header\s*\{[^}]*position:\s*fixed;[^}]*top:\s*0;[^}]*z-index:\s*60;/s)
  assert.match(styles, /\.sigma-site-header-spacer\s*\{[^}]*height:\s*68px;/s)
  assert.match(styles, /@media \(min-width:\s*768px\)[\s\S]*height:\s*124px;/)
  const layout = readFileSync('src/components/layout/AppLayout.tsx', 'utf8')
  assert.match(layout, /sigma-site-header-spacer/)
  assert.match(styles, /\.sigma-chat-window\s*\{[^}]*right:\s*12px !important;[^}]*left:\s*12px !important;/s)
})
