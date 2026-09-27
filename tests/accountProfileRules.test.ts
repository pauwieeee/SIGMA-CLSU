import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAccountProfile } from '../src/utils/accountProfileRules.ts'

test('account profile validation accepts valid persisted metadata fields', () => {
  assert.deepEqual(validateAccountProfile('Adminnie', 'Adrian Santos', '+63 917 123 4567'), { username: '', fullName: '', contact: '' })
})

test('account profile validation rejects short usernames and invalid contacts', () => {
  const errors = validateAccountProfile('A', '', 'not-a-number')
  assert.match(errors.username, /at least 2/)
  assert.match(errors.contact, /valid contact/)
})
