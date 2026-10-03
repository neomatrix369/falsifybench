import { afterEach, describe, expect, it, vi } from 'vitest'
import { UnsealTimeoutError, withTimeout } from './unsealTimeout'

const timeout = () => new UnsealTimeoutError('MAT-001', 15_000)

describe('withTimeout', () => {
  afterEach(() => vi.useRealTimers())

  it('resolves with the value when it arrives in time', async () => {
    await expect(withTimeout(Promise.resolve(7), 15_000, timeout)).resolves.toBe(7)
  })

  it('passes a rejection through unchanged', async () => {
    const err = new Error('chunk failed')
    await expect(withTimeout(Promise.reject(err), 15_000, timeout)).rejects.toBe(err)
  })

  it('rejects with the timeout error when nothing arrives', async () => {
    vi.useFakeTimers()
    const result = withTimeout(new Promise<never>(() => {}), 15_000, timeout)
    const check = expect(result).rejects.toThrow('The sealed evaluation for MAT-001 did not load within 15 s.')
    await vi.advanceTimersByTimeAsync(15_000)
    await check
  })
})
