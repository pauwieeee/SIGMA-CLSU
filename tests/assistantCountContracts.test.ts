import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const assistant = readFileSync('src/utils/assistantClient.ts', 'utf8')
const studentForm = readFileSync('src/components/students/StudentFormModal.tsx', 'utf8')
const assistantUi = readFileSync('src/components/assistant/SigmaAssistant.tsx', 'utf8')

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
  assert.match(assistant, /currently has \*\*\$\{matchingStudentCount\}\*\* student/)
})

test('scholarship counts use the same non-archived assignment joins as Reports', () => {
  assert.match(assistant, /programs\(name, code, colleges\(name, code\)\)/)
  assert.doesNotMatch(assistant, /programs!inner\(name, code, colleges!inner/)
  assert.match(assistant, /\.is\('scholarships\.archived_at', null\)/)
  assert.match(assistant, /distinctScholarRows\(filtered\)/)
})

test('scholarship rankings and summaries use distinct live beneficiaries instead of catalog counts', () => {
  assert.match(assistant, /fetchScholarshipBeneficiarySummary/)
  assert.match(assistant, /asksForScholarshipRanking/)
  assert.match(assistant, /asksForScholarshipSummary/)
  assert.match(assistant, /new Map<string, Set<string>>\(\)/)
  assert.match(assistant, /beneficiaryIds\.get\(assignment\.scholarship_id\)!\.add\(assignment\.student_id\)/)
  assert.match(assistant, /Highest Number of Beneficiaries/)
  assert.match(assistant, /Top Scholarships by Distinct Beneficiaries/)
  assert.match(assistant, /\.is\('students\.archived_at', null\)/)
  assert.match(assistant, /\.is\('scholarships\.archived_at', null\)/)
})

test('scholar follow-ups persist category context and produce explicit category answers', () => {
  assert.match(assistant, /categories: string\[\]/)
  assert.match(assistant, /previousContext\.categories/)
  assert.match(assistant, /explicitScholarshipCategory\(normalizedCurrentQuestion\)/)
  assert.match(assistant, /exactCategoryLabel/)
  assert.match(assistant, /under \$\{exactCategoryLabel\} scholarships/)
})

test('college scholar counts normalize aliases without accidental program filters', () => {
  assert.match(assistant, /explicitCollegeName\(normalizedCurrentQuestion\)/)
  assert.match(assistant, /matchedByType\[collegeIndex\]\.names = \[currentCollege\]/)
  assert.match(assistant, /matchedByType\.splice\(programIndex, 1\)/)
  assert.match(assistant, /exactCollegeLabel/)
  assert.match(assistant, /under the \$\{exactCollegeLabel\}/)
  assert.match(assistant, /summarizeAssignmentPopulation/)
})

test('status, semester, category, and Needs Review use Student Records rules', () => {
  assert.match(assistant, /matchesStudentRecordAssignment/)
  assert.match(assistant, /scholarships!inner\(name, code, status, archived_at/)
  assert.match(assistant, /currentNeedsReview/)
  assert.match(assistant, /openDuplicateStudentIds/)
  assert.match(assistant, /\.in\('status', \['Open', 'Under Review'\]\)/)
  assert.match(assistant, /hasRecognizedFilter/)
  assert.match(assistant, /appliedSemester/)
  assert.match(assistant, /distinct students matching/)
})

test('SIGMAI Edge Function treats Open and Under Review as unresolved duplicate cases', () => {
  const edgeFunction = readFileSync('supabase/functions/sigma-assistant/index.ts', 'utf8')
  assert.match(edgeFunction, /\.in\('status', \['Open', 'Under Review'\]\)/)
  assert.doesNotMatch(edgeFunction, /\.eq\('status', 'Open'\)/)
})

test('assistant resolves programs from the complete Supabase catalog with shared matching', () => {
  assert.match(assistant, /from\('programs'\)/)
  assert.match(assistant, /findProgramsInText/)
  assert.match(assistant, /ambiguous_program_filter/)
  assert.match(assistant, /programCatalog/)
})

test('assistant preserves an ambiguous program choice for the next conversational reply', () => {
  assert.match(assistant, /pendingPrograms\?: ProgramReference\[\]/)
  assert.match(assistant, /pendingProgramQuestion\?: string/)
  assert.match(assistant, /findProgramsInText\(normalizedCurrentQuestion, previousContext\.pendingPrograms\)/)
  assert.match(assistant, /resolvesPendingProgram/)
  assert.match(assistant, /pendingPrograms: currentProgramMatches/)
  assert.match(assistant, /pendingProgramQuestion: contextualQuestion/)
})

test('assistant keeps structured scholar filters for pronoun and enrollment follow-ups', () => {
  assert.match(assistant, /continuesScholarContext && previousContext\?\.kind === 'scholars'/)
  assert.match(assistant, /requestedEnrollment/)
  assert.match(assistant, /enrollment: requestedEnrollment/)
  assert.match(assistant, /previousResultCount: matchingStudentCount/)
  assert.match(assistant, /program: String\(row\.students\?\.programs\?\.name/)
  assert.match(assistant, /what scholarships\?\|what programs\?/)
})

test('assistant UI persists a user-scoped local conversation thread and compact query context', () => {
  assert.match(assistantUi, /sigma:assistant-conversation:/)
  assert.match(assistantUi, /threadId:/)
  assert.match(assistantUi, /crypto\.randomUUID\(\)/)
  assert.match(assistantUi, /assignments: \[\], studentIds: \[\]/)
  assert.match(assistantUi, /messages\.slice\(-20\)/)
  assert.match(assistantUi, /sessionStorage\.setItem/)
})

test('live database retrieval retries before reporting a precise service error', () => {
  assert.match(assistant, /retryAssistantOperation/)
  assert.match(assistant, /attempts: 3/)
  assert.match(assistant, /error\.code === 'database_error'/)
  assert.match(assistantUi, /temporarily unable to access the scholarship database/)
  assert.match(assistantUi, /language service is temporarily unavailable/)
  assert.doesNotMatch(assistantUi, /Check your connection and try again/)
})

test('scoped abbreviation counts remain deterministic when the language service is unavailable', () => {
  assert.match(assistant, /scopedCountWithoutNoun/)
  assert.match(assistant, /!\/\\bscholarships\?\\b\//)
  assert.match(assistant, /could not identify a supported live-data query/)
  assert.match(assistant, /assistant_service_error.*assistant_bad_response.*network_error/)
  assert.match(assistant, /isStructuredDatabaseQuestion\(question\)/)
  assert.match(assistant, /Structured database questions must never depend on the language service/)
})

test('assistant prioritizes IDs and supports academic-year, college-alias, and detailed duplicate queries', () => {
  const idLookup = assistant.indexOf('const studentNumber = extractStudentNumber(contextualQuestion)')
  const duplicateLookup = assistant.indexOf("contextualQ.includes('duplicate')")
  assert.ok(idLookup >= 0 && idLookup < duplicateLookup, 'Student ID intent should run before generic duplicate analytics')
  assert.match(assistant, /lastAcademicYearText\(normalizedCurrentQuestion\)/)
  for (const alias of ['CEN', 'CEAT', 'CASS', 'CBAA', 'COE', 'CAS']) assert.match(assistant, new RegExp(`${alias}:`))
  assert.match(assistant, /requestedDuplicateResultLimit\(question, Number\.MAX_SAFE_INTEGER\)/)
  assert.match(assistant, /a:student_scholarship_id_a/)
  assert.match(assistant, /b:student_scholarship_id_b/)
  assert.match(assistant, /\['Student ID', 'Name', 'Conflicting Scholarships', 'Academic Term', 'Status'\]/)
})

test('duplicate example requests return unique live students rather than an aggregate summary', () => {
  assert.match(assistant, /duplicateQueryMode\(q\)/)
  assert.match(assistant, /requestedDuplicateResultLimit\(question, Number\.MAX_SAFE_INTEGER\)/)
  assert.match(assistant, /const uniqueStudents = new Map/)
  assert.match(assistant, /studentRows\.slice\(0, resultLimit\)/)
  assert.match(assistant, /Conflicting Scholarships/)
  assert.match(assistant, /Academic Term/)
  assert.match(assistant, /duplicate_student_list/)
  assert.match(assistant, /pageSize: 10/)
})

test('student email clearing is persisted as null and verified from the returned row', () => {
  assert.match(studentForm, /const emailValue = form\.email\.trim\(\) \|\| null/)
  assert.match(studentForm, /email: emailValue/)
  assert.match(studentForm, /select\('id, email'\)/)
  assert.match(studentForm, /savedStudent\.email !== emailValue/)
})
