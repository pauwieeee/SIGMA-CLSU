import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('dashboard and reports use canonical Supabase student-profile counts', () => {
  const dashboard = readFileSync('src/hooks/useDashboardData.ts', 'utf8')
  const reports = readFileSync('src/hooks/useReportAnalytics.ts', 'utf8')
  for (const source of [dashboard, reports]) {
    assert.match(source, /from\('students'\)/)
    assert.match(source, /count: 'exact'/)
    assert.match(source, /is\('archived_at', null\)/)
  }
  assert.match(reports, /new Set\(filtered\.map\(\(row\) => row\.student_id\)\)\.size/)
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
