import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('dashboard and reports use canonical Supabase student-profile counts', () => {
  const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8')
  const reports = readFileSync('src/hooks/useReportAnalytics.ts', 'utf8')
  const assistant = readFileSync('src/utils/assistantClient.ts', 'utf8')
  const canonical = readFileSync('src/utils/studentAnalytics.ts', 'utf8')
  assert.match(canonical, /from\('system_counts'\)/)
  assert.match(canonical, /active_students/)
  assert.match(reports, /fetchCanonicalStudentCounts\(\)/)
  assert.match(reports, /countDistinctStudentIds\(filtered/)
  assert.match(assistant, /fetchCanonicalStudentCounts\(\)/)
  assert.match(assistant, /total_student_count/)
  assert.match(dashboard, /useReportAnalytics/)
})

test('SIGMAI separates canonical active profiles from active scholar assignments', () => {
  const assistant = readFileSync('src/utils/assistantClient.ts', 'utf8')
  assert.match(assistant, /studentProfileCountScope\(contextualQuestion\)/)
  assert.match(assistant, /counts\.activeStudents : counts\.allStudents/)
  assert.match(assistant, /active_student_count/)
  assert.match(assistant, /Total Active Students/)
  assert.match(assistant, /distinct student profiles/)
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
  assert.match(analytics, /countDistinctStudentIds\(filtered/)
  assert.match(analytics, /DATA_CHANGED_EVENT/)
  assert.match(scope, /sigma:analytics-academic-year/)
  assert.doesNotMatch(reportsPage, /useDashboardStats/)
})

test('student records apply term and status filters across assignment history', () => {
  const students = readFileSync('src/hooks/useStudentRecords.ts', 'utf8')
  assert.match(students, /assignmentHistory/)
  assert.match(students, /matchingAssignments/)
  assert.match(students, /assignment\.academicYear !== filters\.academicYear/)
  assert.match(students, /assignment\.semester !== filters\.semester/)
  assert.match(students, /assignment\.status !== filters\.status/)
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
