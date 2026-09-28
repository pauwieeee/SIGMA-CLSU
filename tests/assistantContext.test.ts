import test from 'node:test'
import assert from 'node:assert/strict'
import { isContextualFollowUp, lastAcademicYearText, normalizeAcademicYearText, relativeAcademicYear } from '../src/utils/assistantContext.ts'
import { normalizeAssistantQuestion } from '../src/utils/assistantFuzzy.ts'

test('academic years normalize hyphen, en dash, and em dash consistently', () => {
  assert.equal(normalizeAcademicYearText('AY 2023-2024'), '2023-2024')
  assert.equal(normalizeAcademicYearText('A.Y. 2023–2024'), '2023-2024')
  assert.equal(normalizeAcademicYearText('academic year 2023—2024'), '2023-2024')
})

test('follow-up year overrides the earlier year in a conversation chain', () => {
  assert.equal(lastAcademicYearText('active scholars 2025-2026 How about 2023–2024?'), '2023-2024')
})

test('relative academic-year follow-ups derive from structured context', () => {
  assert.equal(relativeAcademicYear('What about the previous academic year?', '2025-2026'), '2024-2025')
  assert.equal(relativeAcademicYear('How about the next academic year?', '2025-2026'), '2026-2027')
  assert.equal(relativeAcademicYear('How about this year?', '2025-2026'), '2025-2026')
})

test('required conversational phrases are classified as follow-ups', () => {
  for (const question of ['How about 2023-2024?', 'And for 2024-2025?', 'How many for 2023-2024?', 'Who are they?', 'List them.']) {
    assert.equal(isContextualFollowUp(question), true, question)
  }
  assert.equal(isContextualFollowUp('How many students are in BSIT?'), false)
})

test('assistant normalizes minor intent spelling mistakes', () => {
  assert.equal(normalizeAssistantQuestion('enroled studnts'), 'enrolled students')
  assert.equal(normalizeAssistantQuestion('dost scholrs in acadmic year'), 'dost scholars in academic year')
  assert.equal(normalizeAssistantQuestion('resolved duplicate cases'), 'resolved duplicate cases')
})
