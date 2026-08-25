import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SIGIL_TARGET, GAME_VERSION } from '../src/games/scoundrel/constants.js'

// Exercises the /api/runs handler's control flow -- the auth gate, the rate
// limiter and the validation wiring (issue 07) -- by standing in for the Neon
// client. The pure rules are covered in validate.test.js; this covers that the
// handler actually applies them, and in the right order.
//
// Env must be set before importing the module: it reads DATABASE_URL and builds
// its client at module scope.
process.env.DATABASE_URL = 'postgres://fake/unit-test'
process.env.SESSION_SECRET = 'unit-test-secret'

// How many hits the fake limiter reports for the next request.
const limiter = { hits: 1 }
const queries = []

// Minimal stand-in for neon's tagged-template client.
function sqlTag(strings, ...vals) {
  const text = strings.join('?')
  queries.push({ text, vals })
  if (text.includes('rate_limits') && text.includes('returning hits')) {
    return Promise.resolve([{ hits: limiter.hits }])
  }
  return Promise.resolve([])
}

vi.mock('@neondatabase/serverless', () => ({ neon: () => sqlTag }))

const { default: handler } = await import('../api/runs.js')
const { signSession } = await import('../api/_lib/session.js')

const NOW = Date.now()
const HOUR = 60 * 60 * 1000

function record(overrides = {}) {
  return {
    accountId: 'guest',
    startedAt: NOW - HOUR,
    endedAt: NOW,
    durationMs: HOUR - 1000,
    outcome: 'death',
    sigilsEarned: 3,
    sigilTarget: SIGIL_TARGET,
    gameVersion: GAME_VERSION,
    ...overrides,
  }
}

function mockReq({ method = 'POST', body, token } = {}) {
  return {
    method,
    body,
    headers: {
      'x-forwarded-for': '203.0.113.7',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }
}

function mockRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = code => { res.statusCode = code; return res }
  res.json = body => { res.body = body; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

async function post(opts) {
  const res = mockRes()
  await handler(mockReq(opts), res)
  return res
}

beforeEach(() => {
  limiter.hits = 1
  queries.length = 0
})

describe('POST /api/runs — method', () => {
  it('rejects non-POST with 405 and an Allow header', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'GET' }), res)
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('POST')
  })
})

describe('POST /api/runs — authentication', () => {
  it('accepts a guest record with no token', async () => {
    // Guest play is a first-class path and has no token to present.
    const res = await post({ body: record() })
    expect(res.statusCode).toBe(202)
  })

  it('rejects a record claiming a real account with no token', async () => {
    // The core hole: anyone could previously post a victory under any account.
    const res = await post({ body: record({ accountId: 'google-sub-123' }) })
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('account_not_authenticated')
  })

  it("rejects a token belonging to a different account", async () => {
    const token = signSession({ sub: 'google-sub-456' }, process.env.SESSION_SECRET)
    const res = await post({ body: record({ accountId: 'google-sub-123' }), token })
    expect(res.statusCode).toBe(401)
  })

  it('accepts a record whose token matches the claimed account', async () => {
    const token = signSession({ sub: 'google-sub-123' }, process.env.SESSION_SECRET)
    const res = await post({ body: record({ accountId: 'google-sub-123' }), token })
    expect(res.statusCode).toBe(202)
  })

  it('rejects a forged token', async () => {
    const token = signSession({ sub: 'google-sub-123' }, 'the-wrong-secret')
    const res = await post({ body: record({ accountId: 'google-sub-123' }), token })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a mixed batch where any record claims an unowned account', async () => {
    // Otherwise a guest batch could smuggle in one impersonating record.
    const res = await post({ body: [record(), record({ accountId: 'google-sub-123' })] })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/runs — rate limiting', () => {
  it('allows a request within the limit', async () => {
    limiter.hits = 30
    const res = await post({ body: record() })
    expect(res.statusCode).toBe(202)
  })

  it('returns 429 with Retry-After once over the limit', async () => {
    limiter.hits = 31
    const res = await post({ body: record() })
    expect(res.statusCode).toBe(429)
    expect(res.body.error).toBe('rate_limited')
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0)
  })

  it('is checked before anything is inserted', async () => {
    limiter.hits = 999
    await post({ body: record() })
    // Only the limiter's own statements should have run.
    expect(queries.some(q => q.text.includes('insert into runs'))).toBe(false)
  })
})

describe('POST /api/runs — validation', () => {
  it('rejects the placeholder-timestamp forgery with 400', async () => {
    const res = await post({
      body: {
        accountId: 'guest', startedAt: 1, endedAt: 1001, durationMs: 1000,
        outcome: 'victory', playerName: 'Fake',
      },
    })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('no_valid_records')
  })

  it('rejects a victory that never reached the sigil target', async () => {
    const res = await post({ body: record({ outcome: 'victory', sigilsEarned: 0 }) })
    expect(res.statusCode).toBe(400)
  })

  it('rejects an oversized batch without inserting any of it', async () => {
    const res = await post({ body: Array.from({ length: 201 }, () => record()) })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('batch_too_large')
    expect(queries.some(q => q.text.includes('insert into runs'))).toBe(false)
  })

  it('inserts a valid batch and reports the count', async () => {
    const res = await post({ body: [record(), record({ startedAt: NOW - 2 * HOUR })] })
    expect(res.statusCode).toBe(202)
    expect(res.body).toEqual({ ok: true, count: 2 })
    expect(queries.filter(q => q.text.includes('insert into runs'))).toHaveLength(2)
  })

  it('accepts a JSON string body, as some runtimes deliver it', async () => {
    const res = await post({ body: JSON.stringify(record()) })
    expect(res.statusCode).toBe(202)
  })

  it('rejects a body that is not JSON', async () => {
    const res = await post({ body: '{ not json' })
    expect(res.statusCode).toBe(400)
  })
})

// Issue 08. The client screens the handle too, but the client is a suggestion:
// this endpoint is reachable with curl, which is the whole reason the check has
// to exist twice. Storing-minus-the-name rather than rejecting is deliberate --
// see the note on scrubHandle.
describe('POST /api/runs — handle screening', () => {
  function insertedRecords() {
    return queries
      .filter(q => q.text.includes('insert into runs'))
      .map(q => JSON.parse(q.vals.find(v => typeof v === 'string' && v.startsWith('{'))))
  }

  it('stores an acceptable handle untouched', async () => {
    const res = await post({ body: record({ playerName: 'Cassandra' }) })
    expect(res.statusCode).toBe(202)
    expect(insertedRecords()[0].playerName).toBe('Cassandra')
  })

  it('stores the run but drops a denylisted handle', async () => {
    const res = await post({ body: record({ playerName: 'xXnaziXx' }) })
    expect(res.statusCode).toBe(202)
    const stored = insertedRecords()
    expect(stored).toHaveLength(1)              // the run itself is kept
    expect(stored[0].playerName).toBe(null)     // the name is not
  })

  it('drops a handle that only reads as a slur through leetspeak', async () => {
    await post({ body: record({ playerName: 'n1gg3r' }) })
    expect(insertedRecords()[0].playerName).toBe(null)
  })

  it('drops a handle impersonating the operator', async () => {
    await post({ body: record({ playerName: 'admin' }) })
    expect(insertedRecords()[0].playerName).toBe(null)
  })

  it('scrubs per record, not per batch', async () => {
    await post({
      body: [
        record({ playerName: 'Cassandra' }),
        record({ startedAt: NOW - 2 * HOUR, playerName: 'f4gg0t' }),
      ],
    })
    expect(insertedRecords().map(r => r.playerName)).toEqual(['Cassandra', null])
  })

  it('leaves a run with no handle alone', async () => {
    await post({ body: record() })
    expect(insertedRecords()[0].playerName).toBe(undefined)
  })
})
