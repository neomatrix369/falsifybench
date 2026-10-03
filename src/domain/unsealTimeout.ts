export const UNSEAL_TIMEOUT_MS = 15_000

export class UnsealTimeoutError extends Error {
  constructor(scenarioId: string, ms: number) {
    super(`The sealed evaluation for ${scenarioId} did not load within ${ms / 1000} s.`)
    this.name = 'UnsealTimeoutError'
  }
}

/** Settles like `promise`, or rejects with `onTimeout()` if it hasn't settled after `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}
