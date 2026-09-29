import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const assistant = readFileSync('src/utils/assistantClient.ts', 'utf8')
const studentForm = readFileSync('src/components/students/StudentFormModal.tsx', 'utf8')

test('assistant has dedicated live enrollment and resolved-duplicate count intents', () => {
  assert.match(assistant, /not_enrolled_student_count/)
  assert.match(assistant, /enrolled_student_count/)
  assert.match(assistant, /resolved_duplicate_count/)
  assert.match(assistant, /duplicateQuery\.in\('status', \['Resolved', 'Confirmed Valid'\]\)/)
  assert.match(assistant, /caseCount: rows\.length, studentCount: studentRows\.length/)
})

test('scholarship counts use the complete live catalog so zero assignments remain a valid result', () => {
  assert.match(assistant, /stripScholarshipReferenceMetadata\(contextualQuestion\)/)
  assert.match(assistant, /from\('scholarships'\)/)
  assert.match(assistant, /const scholarshipCatalog/)
  assert.match(assistant, /for \(const scholarship of scholarshipCatalog\)/)
  assert.match(assistant, /currently has \*\*\$\{scholarRows\.length\}\*\* student/)
})

test('scholarship counts use the same non-archived assignment joins as Reports', () => {
  assert.match(assistant, /programs\(name, code, colleges\(name, code\)\)/)
  assert.doesNotMatch(assistant, /programs!inner\(name, code, colleges!inner/)
  assert.match(assistant, /\.is\('scholarships\.archived_at', null\)/)
  assert.match(assistant, /distinctScholarRows\(filtered\)/)
})

test('assistant prioritizes IDs and supports academic-year, college-alias, and detailed duplicate queries', () => {
  const idLookup = assistant.indexOf('const studentNumber = extractStudentNumber(contextualQuestion)')
  const duplicateLookup = assistant.indexOf("contextualQ.includes('duplicate')")
  assert.ok(idLookup >= 0 && idLookup < duplicateLookup, 'Student ID intent should run before generic duplicate analytics')
  assert.match(assistant, /lastAcademicYearText\(contextualQuestion\)/)
  for (const alias of ['CEN', 'CEAT', 'CASS', 'CBAA', 'COE', 'CAS']) assert.match(assistant, new RegExp(`${alias}:`))
  assert.match(assistant, /requestedDuplicateResultLimit\(question\)/)
  assert.match(assistant, /a:student_scholarship_id_a/)
  assert.match(assistant, /b:student_scholarship_id_b/)
  assert.match(assistant, /\['Student ID', 'Name', 'Conflicting Scholarships', 'Academic Term', 'Status'\]/)
})

test('duplicate example requests return unique live students rather than an aggregate summary', () => {
  assert.match(assistant, /duplicateQueryMode\(q\)/)
  assert.match(assistant, /requestedDuplicateResultLimit\(question\)/)
  assert.match(assistant, /const uniqueStudents = new Map/)
  assert.match(assistant, /studentRows\.slice\(0, resultLimit\)/)
  assert.match(assistant, /Conflicting Scholarships/)
  assert.match(assistant, /Academic Term/)
  assert.match(assistant, /duplicate_student_list/)
})

test('student email clearing is persisted as null and verified from the returned row', () => {
  assert.match(studentForm, /const emailValue = form\.email\.trim\(\) \|\| null/)
  assert.match(studentForm, /email: emailValue/)
  assert.match(studentForm, /select\('id, email'\)/)
  assert.match(studentForm, /savedStudent\.email !== emailValue/)
})
