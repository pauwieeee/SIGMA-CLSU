export interface AssistantRetryOptions {
  attempts?: number
  delaysMs?: number[]
  shouldRetry?: (error: unknown) => boolean
  wait?: (milliseconds: number) => Promise<void>
}

const defaultWait = (milliseconds: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, milliseconds)
})

/** Retries transient assistant operations while preserving the original call. */
export async function retryAssistantOperation<T>(
  operation: () => Promise<T>,
  options: AssistantRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3)
  const delays = options.delaysMs ?? [250, 700]
  const wait = options.wait ?? defaultWait
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1 || (options.shouldRetry && !options.shouldRetry(error))) throw error
      await wait(delays[Math.min(attempt, delays.length - 1)] ?? 0)
    }
  }

  throw lastError
}
