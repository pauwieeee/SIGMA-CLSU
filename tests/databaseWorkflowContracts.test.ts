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
  'supabase/migrations/0035_fix_student_import_results.sql',
  'supabase/migrations/0036_separate_import_duplicates_and_flags.sql',
  'supabase/migrations/0037_separate_student_audit_from_duplicate_history.sql',
  'supabase/migrations/0039_government_private_duplicate_rule.sql',
].map((path) => readFileSync(path, 'utf8')).join('\n')

test('student create, edit, archive, and restore remain audit-backed', () => {
  for (const contract of ['trg_audit_students', "v_action := 'create'", "v_action := 'archive'", "v_action := 'restore'"]) assert.match(allMigrations, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('enrollment, renewal, duplicate detection, and resolution database workflows exist', () => {
  for (const routine of ['apply_selective_enrollment_updates', 'renew_student_scholarship', 'detect_duplicates_for_student', 'review_duplicate_flag', 'trg_log_student_enrollment_change']) assert.match(allMigrations, new RegExp(routine))
})

test('latest duplicate rule requires active Government and Private scholarships in one term', () => {
  const migration = readFileSync('supabase/migrations/0039_government_private_duplicate_rule.sql', 'utf8')
  assert.match(migration, /ca\.name = 'Government' and cb\.name = 'Private'/)
  assert.match(migration, /ca\.name = 'Private' and cb\.name = 'Government'/)
  assert.match(migration, /a\.academic_year = b\.academic_year/)
  assert.match(migration, /a\.semester = b\.semester/)
  assert.match(migration, /a\.status = 'Active' and b\.status = 'Active'/)
})

test('import reports isolate bad rows and preserve successful rows', () => {
  assert.match(allMigrations, /for item in select value from jsonb_array_elements/)
  assert.match(allMigrations, /exception when others/)
  assert.match(allMigrations, /result_status := 'Failed'/)
})

test('latest importer avoids ambiguous student_id conflict references', () => {
  const importer = readFileSync('supabase/migrations/0035_fix_student_import_results.sql', 'utf8')
  assert.match(importer, /from public\.students as s/)
  assert.match(importer, /update public\.students as s/)
  assert.match(importer, /on conflict do nothing/)
  assert.doesNotMatch(importer, /on conflict\s*\(student_id/i)
})

test('timeline receives student, scholarship, enrollment, and duplicate events', () => {
  assert.match(allMigrations, /get_student_activity_timeline/)
  for (const entity of ["'student'", "'student_scholarship'", "'duplicate_flag'"]) assert.match(allMigrations, new RegExp(entity))
})

test('student import separates duplicate Excel rows from created review flags', () => {
  const importer = readFileSync('supabase/migrations/0036_separate_import_duplicates_and_flags.sql', 'utf8')
  const client = readFileSync('src/utils/importStudents.ts', 'utf8')
  assert.match(importer, /duplicate_flag_created boolean/)
  assert.match(importer, /perform public\.detect_duplicates_for_student/)
  assert.match(importer, /Existing student and scholarship assignment updated/)
  assert.match(importer, /Duplicate scholarship flag created for review/)
  assert.doesNotMatch(importer, /result_status\s*:=\s*'Skipped'/)
  assert.match(client, /errorType:'Duplicate Row'/)
  assert.match(client, /message:'Duplicate within uploaded file\.'/)
  assert.match(client, /duplicateFlagsCreated/)
})

test('student audit timeline excludes duplicate case events', () => {
  const migration = readFileSync('supabase/migrations/0037_separate_student_audit_from_duplicate_history.sql', 'utf8')
  assert.match(migration, /entity_type = 'student'/)
  assert.match(migration, /entity_type = 'student_scholarship'/)
  assert.doesNotMatch(migration, /entity_type = 'duplicate_flag'/)
  assert.match(migration, /order by al\.created_at desc/)
})
