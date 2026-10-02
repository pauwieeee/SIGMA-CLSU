import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { summarizeAssignmentPopulation } from '../src/utils/studentAnalyticsCore.ts'

test('filtered analytics separates distinct students from scholarship assignment records', () => {
  const rows = [
    { studentId: 'student-a', status: 'Active' },
    { studentId: 'student-a', status: 'Active' },
    { studentId: 'student-b', status: 'Active' },
    { studentId: 'student-c', status: 'Inactive' },
  ]
  const summary = summarizeAssignmentPopulation(rows, (row) => row.studentId, (row) => row.status === 'Active')
  assert.deepEqual(summary, {
    distinctStudents: 3,
    assignmentRecords: 4,
    activeAssignmentRecords: 3,
  })
})

test('dashboard and reports use canonical Supabase student-profile counts', () => {
  const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8')
  const reports = readFileSync('src/hooks/useReportAnalytics.ts', 'utf8')
  const assistant = readFileSync('src/utils/assistantClient.ts', 'utf8')
  const canonical = readFileSync('src/utils/studentAnalytics.ts', 'utf8')
  assert.match(canonical, /from\('students'\)/)
  assert.match(canonical, /\.select\('id, archived_at'\)/)
  assert.match(canonical, /\.range\(from, from \+ pageSize - 1\)/)
  assert.match(canonical, /student\.archived_at == null/)
  assert.match(canonical, /allStudents: rows\.length/)
  assert.doesNotMatch(canonical, /from\('system_counts'\)/)
  assert.match(reports, /fetchCanonicalStudentCounts\(\)/)
  assert.match(reports, /assignmentStudentCount/)
  assert.match(reports, /inconsistentEmptyCount/)
  assert.match(reports, /console\.error\('Canonical student-profile count failed:'/)
  assert.match(reports, /summarizeAssignmentPopulation/)
  assert.match(assistant, /fetchCanonicalStudentCounts\(\)/)
  assert.match(assistant, /total_student_count/)
  assert.match(dashboard, /useReportAnalytics/)
})

test('dashboard never silently presents a failed canonical count as a valid zero', () => {
  const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8')
  const reports = readFileSync('src/hooks/useReportAnalytics.ts', 'utf8')
  assert.match(dashboard, /analytics\.error/)
  assert.match(dashboard, /live-record fallback/)
  assert.doesNotMatch(reports, /return \{ activeStudents: 0, archivedStudents: 0, allStudents: 0 \}/)
})

test('reports do not describe current Supabase query failures as historical-data failures', () => {
  const reportsPage = readFileSync('src/pages/ReportsPage.tsx', 'utf8')
  assert.match(reportsPage, /Some live report data is temporarily unavailable/)
  assert.doesNotMatch(reportsPage, /Historical report data could not be loaded/)
})

test('SIGMAI separates canonical active profiles from active scholar assignments', () => {
  const assistant = readFileSync('src/utils/assistantClient.ts', 'utf8')
  assert.match(assistant, /studentProfileCountScope\(contextualQuestion\)/)
  assert.match(assistant, /counts\.activeStudents : counts\.allStudents/)
  assert.match(assistant, /active_student_count/)
  assert.match(assistant, /Total Active Students/)
  assert.match(assistant, /distinct student profiles/)
  assert.match(assistant, /summarizeAssignmentPopulation/)
})

test('dashboard and reports consume one shared analytics service and academic-year scope', () => {
  const dashboardPage = readFileSync('src/pages/DashboardPage.tsx', 'utf8')
  const reportsPage = readFileSync('src/pages/ReportsPage.tsx', 'utf8')
  const analytics = readFileSync('src/hooks/useReportAnalytics.ts', 'utf8')
  const scope = readFileSync('src/hooks/useAnalyticsAcademicYear.ts', 'utf8')
  for (const page of [dashboardPage, reportsPage]) {
    assert.match(page, /useReportAnalytics/)
    assert.match(page, /useAnalyticsAcademicYear/)
  }
  assert.match(analytics, /categoryData, trendData, options, metrics/)
  assert.match(analytics, /summarizeAssignmentPopulation/)
  assert.match(analytics, /matchesStudentRecordAssignment/)
  assert.match(analytics, /effectiveStudentRecordStatus/)
  assert.match(analytics, /DATA_CHANGED_EVENT/)
  assert.match(scope, /sigma:analytics-academic-year/)
  assert.doesNotMatch(reportsPage, /useDashboardStats/)
})

test('student records apply term and status filters across assignment history', () => {
  const students = readFileSync('src/hooks/useStudentRecords.ts', 'utf8')
  const analytics = readFileSync('src/hooks/useReportAnalytics.ts', 'utf8')
  assert.match(students, /assignmentHistory/)
  assert.match(students, /matchesStudentRecordAssignment/)
  assert.match(students, /effectiveStudentRecordStatus/)
  assert.match(students, /matchingAssignments/)
  const sharedFilters = readFileSync('src/utils/studentRecordFilters.ts', 'utf8')
  assert.match(sharedFilters, /assignment\.academicYear !== filters\.academicYear/)
  assert.match(sharedFilters, /assignment\.semester !== filters\.semester/)
  assert.match(sharedFilters, /effectiveStudentRecordStatus/)
  for (const field of ['college', 'program', 'scholarship', 'enrollment']) assert.match(sharedFilters, new RegExp(`filters\\.${field}`))
  assert.match(students, /scholarship: filters\.scholarship/)
  assert.match(analytics, /scholarship: filters\.scholarship/)
})

test('data mutations broadcast a shared refresh event', () => {
  const activity = readFileSync('src/utils/logActivity.ts', 'utf8')
  const sync = readFileSync('src/utils/dataSync.ts', 'utf8')
  const students = readFileSync('src/hooks/useStudentRecords.ts', 'utf8')
  assert.match(sync, /sigma:data-changed/)
  assert.match(activity, /notifyDataChanged/)
  assert.match(students, /DATA_CHANGED_EVENT/)
})

test('database exposes distinct profile totals independent of assignments', () => {
  const migration = readFileSync('supabase/migrations/0038_canonical_system_counts.sql', 'utf8')
  assert.match(migration, /count\(\*\) from public\.students where archived_at is null/)
  assert.doesNotMatch(migration, /count\(.*student_scholarships.*active_students/)
})
