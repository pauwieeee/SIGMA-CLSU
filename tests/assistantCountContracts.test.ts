import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const assistant = readFileSync('src/utils/assistantClient.ts', 'utf8')
const studentForm = readFileSync('src/components/students/StudentFormModal.tsx', 'utf8')

test('assistant has dedicated live enrollment and resolved-duplicate count intents', () => {
  assert.match(assistant, /not_enrolled_student_count/)
  assert.match(assistant, /enrolled_student_count/)
  assert.match(assistant, /resolved_duplicate_count/)
  assert.match(assistant, /select\('id', \{ count: 'exact', head: true \}\)/)
})

test('student email clearing is persisted as null and verified from the returned row', () => {
  assert.match(studentForm, /const emailValue = form\.email\.trim\(\) \|\| null/)
  assert.match(studentForm, /email: emailValue/)
  assert.match(studentForm, /select\('id, email'\)/)
  assert.match(studentForm, /savedStudent\.email !== emailValue/)
})
