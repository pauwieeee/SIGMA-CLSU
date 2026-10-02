import test from 'node:test'
import assert from 'node:assert/strict'
import { paginationItems } from '../src/utils/assistantPagination.ts'

test('assistant pagination shows all page numbers for short lists', () => {
  assert.deepEqual(paginationItems(2, 4), [1, 2, 3, 4])
})

test('assistant pagination keeps first, nearby, and last pages for long lists', () => {
  assert.deepEqual(paginationItems(7, 14), [1, 'ellipsis', 6, 7, 8, 'ellipsis', 14])
})
