import { describe, expect, it } from 'vitest'
import { retryDelay, refreshOnVisible } from '../src/web'

describe('browser polling policy', () => {
  it('backs off 30 s, 60 s, 2 min and then caps at 5 min', () => {
    expect([1, 2, 3, 4, 5, 20].map(retryDelay)).toEqual([30_000, 60_000, 120_000, 300_000, 300_000, 300_000])
  })

  it('refreshes on becoming visible only when the last success is older than 30 s', () => {
    expect(refreshOnVisible(null, 100_000)).toBe(true)
    expect(refreshOnVisible(100_000, 129_999)).toBe(false)
    expect(refreshOnVisible(100_000, 130_000)).toBe(false)
    expect(refreshOnVisible(100_000, 130_001)).toBe(true)
  })
})
