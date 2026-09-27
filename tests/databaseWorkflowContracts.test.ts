import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const allMigrations = [
  'supabase/migrations/0024_database_audit_triggers.sql',
  'supabase/migrations/0025_student_archive_restore.sql',
  'supabase/migrations/0026_import_row_results.sql',
  'supabase/migrations/0027_scholarship_conflict_review.sql',
  'supabase/migrations/0029_selective_enrollment_reconciliation.sql',
  'supabase/migrations/0032_final_workflow_improvements.sql',
  'supabase/migrations/0033_audit_notifications_and_duplicate_reasons.sql',
].map((path) => readFileSync(path, 'utf8')).join('\n')

test('student create, edit, archive, and restore remain audit-backed', () => {
  for (const contract of ['trg_audit_students', "v_action := 'create'", "v_action := 'archive'", "v_action := 'restore'"]) assert.match(allMigrations, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('enrollment, renewal, duplicate detection, and resolution database workflows exist', () => {
  for (const routine of ['apply_selective_enrollment_updates', 'renew_student_scholarship', 'detect_duplicates_for_student', 'review_duplicate_flag', 'trg_log_student_enrollment_change']) assert.match(allMigrations, new RegExp(routine))
})

test('import reports isolate bad rows and preserve successful rows', () => {
  assert.match(allMigrations, /for item in select value from jsonb_array_elements/)
  assert.match(allMigrations, /exception when others/)
  assert.match(allMigrations, /result_status := 'Failed'/)
})

test('timeline receives student, scholarship, enrollment, and duplicate events', () => {
  assert.match(allMigrations, /get_student_activity_timeline/)
  for (const entity of ["'student'", "'student_scholarship'", "'duplicate_flag'"]) assert.match(allMigrations, new RegExp(entity))
})
