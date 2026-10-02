import test from 'node:test'
import assert from 'node:assert/strict'
import { createProgramMatcher, normalizeProgramReference } from '../src/utils/programMatching.ts'

const programs = [
  { id: 'it', name: 'Bachelor of Science in Information Technology', code: 'BSIT' },
  { id: 'ag', name: 'Bachelor of Science in Agriculture', code: 'BSA' },
  { id: 'vet', name: 'Doctor of Veterinary Medicine', code: 'DVM' },
]

test('program normalization ignores case, surrounding whitespace, repeated spaces, and punctuation', () => {
  assert.equal(normalizeProgramReference('  Bachelor   OF Science in Information-Technology '), 'bachelor of science in information technology')
  const match = createProgramMatcher(programs)
  for (const value of [
    'Bachelor of Science in Information Technology',
    'bachelor OF science IN information technology',
    '  Bachelor   of Science in Information Technology  ',
    'Bachelor-of-Science-in-Information-Technology',
  ]) {
    const result = match(value)
    assert.equal(result.status, 'matched')
    if (result.status === 'matched') assert.equal(result.program.id, 'it')
  }
})

test('program matching resolves database codes and generated abbreviations without a hardcoded catalog', () => {
  const match = createProgramMatcher(programs)
  for (const value of ['BSIT', 'bsit', 'B.S.I.T.', 'BS Information Technology']) {
    const result = match(value)
    assert.equal(result.status, 'matched')
    if (result.status === 'matched') assert.equal(result.program.id, 'it')
  }
  assert.equal(match('BSA').status, 'matched')
  assert.equal(match('DVM').status, 'matched')
})

test('program matching rejects nonexistent and ambiguous aliases instead of creating or guessing', () => {
  const match = createProgramMatcher([
    ...programs,
    { id: 'other-it', name: 'Bachelor of Science in Industrial Technology', code: 'BSIT' },
  ])
  assert.equal(match('Imaginary Degree').status, 'unmatched')
  const ambiguous = match('BSIT')
  assert.equal(ambiguous.status, 'ambiguous')
  if (ambiguous.status === 'ambiguous') assert.equal(ambiguous.programs.length, 2)
})
