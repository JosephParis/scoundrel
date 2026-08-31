import { describe, it, expect, vi, beforeEach } from 'vitest'

// Exercises /api/claim, the one endpoint that can change a run already stored.
// /api/runs is `on conflict do nothing` precisely so a replayed backlog cannot
// rewrite history, so this is the exception and its gate is the whole point:
// who is allowed to rename whose run.
//
// Env must be set before the import: the module builds its client at module
// scope and reads SESSION_SECRET through api/_lib/session.js.
process.env.DATABASE_URL = 'postgres://fake/unit-test'
process.env.SESSION_SECRET = 'unit-test-secret'

const limiter = { hits: 1 }
const queries = []
// Rows the next `update ... returning` should report as changed.
let updated = [{ run_key: 'x' }]

function sqlTag(strings, ...vals) {
  const text = strings.join('?')
  queries.push({ text, vals })
  if (text.includes('rate_limits') && text.includes('returning hits')) {
    return Promise.resolve([{ hits: limiter.hits }])
  }
  if (text.includes('update runs')) return Promise.resolve(updated)
  return Promise.resolve([])
}

vi.mock('@neondatabase/serverless', () => ({ neon: () => sqlTag }))

const { default: handler, parseRunKey } = await import('../api/claim.js')
const { signSession } = await import('../api/_lib/session.js')

const NOW = Date.now()
const SEED = 'a1b2c3d4'

function mockRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = code => { res.statusCode = code; return res }
  res.json = body => { res.body = body; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

async function call({ method = 'POST', body, token } = {}) {
  const res = mockRes()
  await handler({
    method,
    body,
    headers: {
      'x-forwarded-for': '203.0.113.7',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }, res)
  return res
}

function ran(needle) {
  return queries.filter(q => q.text.includes(needle))
}

beforeEach(() => {
  queries.length = 0
  limiter.hits = 1
  updated = [{ run_key: 'x' }]
})

describe('parseRunKey', () => {
  it('reads the account out of a signed-in key', () => {
    expect(parseRunKey(`sub-123:${NOW}:${SEED}`))
      .toEqual({ accountId: 'sub-123', proven: true })
  })

  it('treats a guest key carrying its run seed as self-proving', () => {
    // The seed is minted at run start and lives only in that player's record,
    // so knowing the whole key is evidence of having played the run.
    expect(parseRunKey(`guest:${NOW}:${SEED}`))
      .toEqual({ accountId: 'guest', proven: true })
  })

  it('refuses to prove a legacy guest key with no seed', () => {
    // "guest:<startedAt>" is a timestamp anyone can iterate. Renaming rows off
    // a guessed key is exactly the hole the seed closes.
    expect(parseRunKey(`guest:${NOW}`)).toEqual({ accountId: 'guest', proven: false })
  })

  it('still identifies a signed-in key with no seed', () => {
    // Legacy account runs are safe without one: the session has to match.
    expect(parseRunKey(`sub-123:${NOW}`)).toEqual({ accountId: 'sub-123', proven: true })
  })

  it('rejects what is not a run key at all', () => {
    expect(parseRunKey('')).toBeNull()
    expect(parseRunKey(null)).toBeNull()
    expect(parseRunKey(42)).toBeNull()
    expect(parseRunKey('nocolons')).toBeNull()
    expect(parseRunKey('guest:notatimestamp')).toBeNull()
    expect(parseRunKey(`guest:${NOW}:${SEED}:extra`)).toBeNull()
    expect(parseRunKey(`:${NOW}:${SEED}`)).toBeNull()
  })
})

describe('/api/claim — method and rate limit', () => {
  it('accepts POST only', async () => {
    const res = await call({ method: 'GET' })
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('POST')
  })

  it('rate limits before touching the run', async () => {
    limiter.hits = 999
    const res = await call({ body: { runKey: `guest:${NOW}:${SEED}`, playerName: 'Rook' } })
    expect(res.statusCode).toBe(429)
    expect(ran('update runs')).toHaveLength(0)
  })
})

describe('/api/claim — who may rename a run', () => {
  it('lets a guest rename a run whose seed they present', async () => {
    const res = await call({ body: { runKey: `guest:${NOW}:${SEED}`, playerName: 'Rookwarden' } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, playerName: 'Rookwarden' })
  })

  it('refuses a guest key with no seed', async () => {
    const res = await call({ body: { runKey: `guest:${NOW}`, playerName: 'Rookwarden' } })
    expect(res.statusCode).toBe(403)
    expect(ran('update runs')).toHaveLength(0)
  })

  it('refuses an account run with no session', async () => {
    const res = await call({ body: { runKey: `sub-123:${NOW}:${SEED}`, playerName: 'Rook' } })
    expect(res.statusCode).toBe(401)
    expect(ran('update runs')).toHaveLength(0)
  })

  it('refuses an account run when the session is somebody else', async () => {
    // The forgeable-leaderboard failure from issue 07, in rename form.
    const token = signSession({ sub: 'sub-999' }, process.env.SESSION_SECRET)
    const res = await call({ body: { runKey: `sub-123:${NOW}:${SEED}`, playerName: 'Rook' }, token })
    expect(res.statusCode).toBe(401)
    expect(ran('update runs')).toHaveLength(0)
  })

  it('lets the owner rename their own run', async () => {
    const token = signSession({ sub: 'sub-123' }, process.env.SESSION_SECRET)
    const res = await call({ body: { runKey: `sub-123:${NOW}:${SEED}`, playerName: 'Rook' }, token })
    expect(res.statusCode).toBe(200)
  })

  it('rejects a malformed key before anything else', async () => {
    const res = await call({ body: { runKey: 'garbage', playerName: 'Rook' } })
    expect(res.statusCode).toBe(400)
  })

  it('reports a key that matches no stored run', async () => {
    updated = []
    const res = await call({ body: { runKey: `guest:${NOW}:${SEED}`, playerName: 'Rook' } })
    expect(res.statusCode).toBe(404)
  })
})

describe('/api/claim — what it writes', () => {
  it('changes only playerName, and scopes the update to the key and account', async () => {
    await call({ body: { runKey: `guest:${NOW}:${SEED}`, playerName: 'Rookwarden' } })
    const [q] = ran('update runs')
    expect(q.text).toContain('jsonb_set')
    expect(q.text).toContain("'{playerName}'")
    expect(q.text).toContain('run_key = ')
    expect(q.text).toContain('account_id = ')
    // Nothing about the run itself may move.
    expect(q.text).not.toContain('outcome')
    expect(q.text).not.toContain('duration_ms')
    expect(q.text).not.toContain('ended_at')
    expect(q.vals).toContain(`guest:${NOW}:${SEED}`)
    expect(q.vals).toContain('guest')
  })

  it('stores a screened name as null and says so, rather than refusing', async () => {
    // Same rule as /api/runs: keep the row, drop the name, and do not tell the
    // author which words to try next.
    const res = await call({ body: { runKey: `guest:${NOW}:${SEED}`, playerName: 'xXnaziXx' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.playerName).toBeNull()
    expect(ran('update runs')[0].vals).toContain('null')
  })

  it('treats a reserved name the same way', async () => {
    const res = await call({ body: { runKey: `guest:${NOW}:${SEED}`, playerName: 'admin' } })
    expect(res.body.playerName).toBeNull()
  })

  it('sanitizes before storing', async () => {
    const res = await call({ body: { runKey: `guest:${NOW}:${SEED}`, playerName: '  Rook@warden!  ' } })
    expect(res.body.playerName).toBe('Rookwarden')
  })

  it('clamps an over-long name to the handle limit', async () => {
    const res = await call({ body: { runKey: `guest:${NOW}:${SEED}`, playerName: 'a'.repeat(40) } })
    expect(res.body.playerName).toHaveLength(16)
  })

  it('accepts an empty name as "list this run without one"', async () => {
    const res = await call({ body: { runKey: `guest:${NOW}:${SEED}`, playerName: '' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.playerName).toBeNull()
  })

  it('parses a string body, the way a raw POST arrives', async () => {
    const res = await call({
      body: JSON.stringify({ runKey: `guest:${NOW}:${SEED}`, playerName: 'Rook' }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.body.playerName).toBe('Rook')
  })

  it('rejects an unparseable string body rather than throwing', async () => {
    const res = await call({ body: '{not json' })
    expect(res.statusCode).toBe(400)
  })
})
