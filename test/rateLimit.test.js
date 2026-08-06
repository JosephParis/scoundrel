import { describe, it, expect, vi } from 'vitest'
import { bucketFor, clientIp, checkRateLimit } from '../api/_lib/rateLimit.js'

describe('bucketFor', () => {
  const WINDOW = 60_000
  // Window-aligned, so "start + WINDOW - 1" genuinely stays inside one window.
  // An arbitrary timestamp would straddle a boundary and make the test lie.
  const ALIGNED = 17 * WINDOW

  it('is stable within a window', () => {
    const a = bucketFor('runs', '1.2.3.4', WINDOW, ALIGNED)
    const b = bucketFor('runs', '1.2.3.4', WINDOW, ALIGNED + WINDOW - 1)
    expect(a).toBe(b)
  })

  it('rotates at the window boundary', () => {
    const a = bucketFor('runs', '1.2.3.4', WINDOW, ALIGNED + WINDOW - 1)
    const b = bucketFor('runs', '1.2.3.4', WINDOW, ALIGNED + WINDOW)
    expect(a).not.toBe(b)
  })

  it('separates endpoints and addresses', () => {
    const t = 1_000_000
    expect(bucketFor('runs', '1.2.3.4', WINDOW, t)).not.toBe(bucketFor('feedback', '1.2.3.4', WINDOW, t))
    expect(bucketFor('runs', '1.2.3.4', WINDOW, t)).not.toBe(bucketFor('runs', '5.6.7.8', WINDOW, t))
  })
})

describe('clientIp', () => {
  it('takes the left-most x-forwarded-for entry', () => {
    // The original client; everything after is proxy hops.
    expect(clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1, 10.0.0.2' } }))
      .toBe('9.9.9.9')
  })

  it('handles a header delivered as an array', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': ['9.9.9.9, 10.0.0.1'] } })).toBe('9.9.9.9')
  })

  it('falls back to x-real-ip', () => {
    expect(clientIp({ headers: { 'x-real-ip': '8.8.8.8' } })).toBe('8.8.8.8')
  })

  it('falls back to the socket address', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '7.7.7.7' } })).toBe('7.7.7.7')
  })

  it('never throws on a request with nothing useful', () => {
    expect(clientIp({})).toBe('unknown')
    expect(clientIp({ headers: { 'x-forwarded-for': '   ' } })).toBe('unknown')
  })
})

describe('checkRateLimit', () => {
  const opts = { name: 'runs', ip: '1.2.3.4', limit: 3, windowMs: 60_000, now: 1_000_000 }

  // Minimal stand-in for the neon tagged-template client: returns whatever rows
  // it is told to, and records that it was called.
  function fakeSql(rows) {
    const fn = vi.fn(() => {
      const p = Promise.resolve(rows)
      p.catch = () => p
      return p
    })
    return fn
  }

  it('allows a request at the limit', async () => {
    const result = await checkRateLimit(fakeSql([{ hits: 3 }]), opts)
    expect(result).toEqual({ allowed: true, hits: 3 })
  })

  it('blocks the request after the limit', async () => {
    const result = await checkRateLimit(fakeSql([{ hits: 4 }]), opts)
    expect(result).toEqual({ allowed: false, hits: 4 })
  })

  it('allows everything when there is no database configured', async () => {
    // Endpoints already 503 without DATABASE_URL; the limiter must not pretend
    // to be enforcing something it cannot.
    expect(await checkRateLimit(null, opts)).toEqual({ allowed: true, hits: null })
  })

  it('fails open when the limiter itself errors', async () => {
    // A limiter outage must not stop real runs being recorded: losing player data
    // is worse than briefly accepting abuse.
    const throwing = vi.fn(() => Promise.reject(new Error('db down')))
    expect(await checkRateLimit(throwing, opts)).toEqual({ allowed: true, hits: null })
  })

  it('treats a missing hits column as zero rather than throwing', async () => {
    expect(await checkRateLimit(fakeSql([]), opts)).toEqual({ allowed: true, hits: 0 })
  })
})
