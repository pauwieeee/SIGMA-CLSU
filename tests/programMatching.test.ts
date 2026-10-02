import test from 'node:test'
import assert from 'node:assert/strict'
import { createProgramMatcher, findProgramsInText, normalizeProgramReference } from '../src/utils/programMatching.ts'

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

test('natural-language program matching supports abbreviations, punctuation, and minor spelling variations', () => {
  for (const question of [
    'students in Bachelor of Science in Information Technology',
    'how many BSIT scholars?',
    'list scholars under B.S.I.T.',
    'students in information technlogy',
  ]) {
    const matches = findProgramsInText(question, programs)
    assert.deepEqual(matches.map((program) => program.id), ['it'])
  }
  assert.deepEqual(findProgramsInText('students in imaginary studies', programs), [])
})

test('natural-language matching returns every plausible official program for disambiguation', () => {
  const matches = findProgramsInText('show BSIT scholars', [
    ...programs,
    { id: 'industrial', name: 'Bachelor of Science in Industrial Technology', code: 'BSIT' },
  ])
  assert.deepEqual(matches.map((program) => program.id).sort(), ['industrial', 'it'])
})

test('reported short degree names map to their official Supabase-style program records', () => {
  const officialPrograms = [
    ['agriculture', 'Bachelor of Science in Agriculture', 'BSA', 'BS Agriculture'],
    ['development', 'Bachelor of Science in Development Communication', 'BSDC', 'BS Development Communication'],
    ['psychology', 'Bachelor of Science in Psychology', 'BSP', 'BS Psychology'],
    ['literature', 'Bachelor of Arts in Literature', 'BAL', 'BA Literature'],
    ['social-sciences', 'Bachelor of Arts in Social Sciences', 'BASS', 'BA Social Sciences'],
    ['filipino', 'Bachelor of Arts in Filipino', 'BAF', 'BA Filipino'],
    ['international', 'Bachelor of Arts in International Studies – Global Sustainable Development', 'BAIS', 'BA International Studies - Global Sustainable Development'],
    ['accountancy', 'Bachelor of Science in Accountancy', 'BSAcc', 'BS Accountancy'],
    ['marketing', 'Bachelor of Science in Business Administration – Marketing Management', 'BSBA-MM', 'BS Business Administration - Marketing Management'],
    ['economics', 'Bachelor of Science in Business Administration – Business Economics', 'BSBA-BE', 'BS Business Administration - Business Economics'],
    ['human-resources', 'Bachelor of Science in Business Administration – Human Resource Management', 'BSBA-HRM', 'BS Business Administration - Human Resource Management'],
    ['entrepreneurship', 'Bachelor of Science in Entrepreneurship', 'BSE', 'BS Entrepreneurship'],
    ['management-accounting', 'Bachelor of Science in Management Accounting', 'BSMA', 'BS Management Accounting'],
  ].map(([id, name, code, uploadName]) => ({ id, name, code, uploadName }))
  const match = createProgramMatcher(officialPrograms)
  for (const program of officialPrograms) {
    const result = match(program.uploadName)
    assert.equal(result.status, 'matched', program.uploadName)
    if (result.status === 'matched') assert.equal(result.program.id, program.id)
  }
})

test('descriptive program words take priority over colliding acronyms', () => {
  const collisionPrograms = [
    { id: 'agriculture', name: 'Bachelor of Science in Agriculture', code: 'BSA' },
    { id: 'accountancy', name: 'Bachelor of Science in Accountancy', code: 'BSAcc' },
    { id: 'entrepreneurship', name: 'Bachelor of Science in Entrepreneurship', code: 'BSE' },
    { id: 'secondary-education', name: 'Bachelor of Secondary Education', code: 'BSED' },
  ]
  const match = createProgramMatcher(collisionPrograms)
  const accountancy = match('BS Accountancy')
  const entrepreneurship = match('BS Entrepreneurship')
  assert.equal(accountancy.status, 'matched')
  assert.equal(entrepreneurship.status, 'matched')
  if (accountancy.status === 'matched') assert.equal(accountancy.program.id, 'accountancy')
  if (entrepreneurship.status === 'matched') assert.equal(entrepreneurship.program.id, 'entrepreneurship')
})
