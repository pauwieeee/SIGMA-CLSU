import test from 'node:test'
import assert from 'node:assert/strict'
import { retryAssistantOperation } from '../src/utils/assistantRetry.ts'

test('assistant retries transient operations and returns the successful result', async () => {
  let attempts = 0
  const value = await retryAssistantOperation(async () => {
    attempts += 1
    if (attempts < 3) throw new Error('temporary')
    return 'live result'
  }, { attempts: 3, delaysMs: [0, 0], wait: async () => undefined })

  assert.equal(value, 'live result')
  assert.equal(attempts, 3)
})

test('assistant stops retrying permanent failures', async () => {
  let attempts = 0
  await assert.rejects(() => retryAssistantOperation(async () => {
    attempts += 1
    throw new Error('permanent')
  }, {
    attempts: 3,
    shouldRetry: () => false,
    wait: async () => undefined,
  }), /permanent/)
  assert.equal(attempts, 1)
})
