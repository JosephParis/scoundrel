import { describe, it, expect, vi, beforeEach } from 'vitest'

// Exercises the /api/moderation handler (issue 08) against a stand-in for the
// Neon client. What matters here is the auth gate and which SQL each request
// actually runs -- a moderation endpoint that silently no-ops is worse than
// none, because it is trusted.
//
// Env must be set before the import: the module builds its client at module
// scope and reads ADMIN_TOKEN on every call.
process.env.DATABASE_URL = 'postgres://fake/unit-test'
process.env.ADMIN_TOKEN = 'unit-test-admin-token'

const queries = []
// Rows the next matching query should return, as [substring, rows] pairs.
let canned = []

function sqlTag(strings, ...vals) {
  const text = strings.join('?')
  queries.push({ text, vals })
  const hit = canned.find(([needle]) => text.includes(needle))
  return Promise.resolve(hit ? hit[1] : [])
}

vi.mock('@neondatabase/serverless', () => ({ neon: () => sqlTag }))

const { default: handler } = await import('../api/moderation.js')

const TOKEN = 'unit-test-admin-token'

function mockRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = code => { res.statusCode = code; return res }
  res.json = body => { res.body = body; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

async function call({ method = 'GET', body, query = {}, token = TOKEN } = {}) {
  const res = mockRes()
  await handler({
    method,
    body,
    query,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }, res)
  return res
}

function ran(needle) {
  return queries.filter(q => q.text.includes(needle))
}

beforeEach(() => {
  queries.length = 0
  canned = []
  process.env.ADMIN_TOKEN = TOKEN
})

describe('/api/moderation — auth', () => {
  it('rejects a request with no token', async () => {
    const res = await call({ token: null })
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('unauthorized')
  })

  it('rejects a wrong token', async () => {
    const res = await call({ token: 'not-the-token' })
    expect(res.statusCode).toBe(401)
  })

  it('runs no SQL at all when unauthorized', async () => {
    await call({ method: 'DELETE', query: { runKey: 'guest:1' }, token: 'wrong' })
    expect(queries).toHaveLength(0)
  })

  it('fails closed when ADMIN_TOKEN is not configured', async () => {
    delete process.env.ADMIN_TOKEN
    const res = await call({ token: null })
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('admin_token_not_configured')
    // Crucially not 200: an unset secret must not read as "no auth needed".
    expect(queries).toHaveLength(0)
  })

  it('rejects an unsupported method before anything else', async () => {
    const res = await call({ method: 'PUT' })
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('GET, POST, DELETE')
  })

  it('never lets a response be cached', async () => {
    const res = await call()
    expect(res.headers['Cache-Control']).toBe('no-store')
  })
})

describe('/api/moderation — blocking', () => {
  it('lists blocked accounts', async () => {
    canned = [['from blocked_accounts', [
      { account_id: 'sub-1', reason: 'slur in handle', created_at: '2026-08-25' },
    ]]]
    const res = await call()
    expect(res.statusCode).toBe(200)
    expect(res.body.blocked).toEqual([
      { accountId: 'sub-1', reason: 'slur in handle', createdAt: '2026-08-25' },
    ])
  })

  it('blocks an account with a reason', async () => {
    const res = await call({ method: 'POST', body: { accountId: 'sub-1', reason: 'spam' } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, accountId: 'sub-1', blocked: true })
    const insert = ran('insert into blocked_accounts')
    expect(insert).toHaveLength(1)
    expect(insert[0].vals).toEqual(['sub-1', 'spam'])
  })

  it('accepts a JSON string body, as some runtimes deliver it', async () => {
    const res = await call({ method: 'POST', body: JSON.stringify({ accountId: 'sub-2' }) })
    expect(res.statusCode).toBe(200)
    expect(ran('insert into blocked_accounts')[0].vals).toEqual(['sub-2', null])
  })

  it('updates the reason when the account is already blocked', async () => {
    await call({ method: 'POST', body: { accountId: 'sub-1', reason: 'second thought' } })
    expect(ran('insert into blocked_accounts')[0].text).toContain('on conflict')
  })

  it('refuses to block the shared guest id', async () => {
    // Every guest run carries it, so this would empty half the board.
    const res = await call({ method: 'POST', body: { accountId: 'guest' } })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('cannot_block_guest')
    expect(ran('insert into blocked_accounts')).toHaveLength(0)
  })

  it('requires an account id', async () => {
    const res = await call({ method: 'POST', body: { reason: 'nobody in particular' } })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('account_id_required')
  })

  it('unblocks an account', async () => {
    canned = [['delete from blocked_accounts', [{ account_id: 'sub-1' }]]]
    const res = await call({ method: 'DELETE', query: { accountId: 'sub-1' } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, accountId: 'sub-1', blocked: false, found: true })
  })

  it('reports an unblock that matched nothing without failing', async () => {
    const res = await call({ method: 'DELETE', query: { accountId: 'never-blocked' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.found).toBe(false)
  })
})

describe('/api/moderation — deleting rows', () => {
  it('deletes one run by key', async () => {
    canned = [['delete from runs', [{ run_key: 'sub-1:123' }]]]
    const res = await call({ method: 'DELETE', query: { runKey: 'sub-1:123' } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, runKey: 'sub-1:123' })
    expect(ran('delete from runs')[0].vals).toEqual(['sub-1:123'])
  })

  it('404s a run key that is not there, rather than reporting success', async () => {
    const res = await call({ method: 'DELETE', query: { runKey: 'nope' } })
    expect(res.statusCode).toBe(404)
    expect(res.body.error).toBe('run_not_found')
  })

  it('deletes one feedback note by id', async () => {
    canned = [['delete from feedback', [{ id: '42' }]]]
    const res = await call({ method: 'DELETE', query: { feedbackId: '42' } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, feedbackId: 42 })
  })

  it('rejects a non-numeric feedback id before touching the database', async () => {
    const res = await call({ method: 'DELETE', query: { feedbackId: '1; drop table feedback' } })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('bad_feedback_id')
    expect(ran('delete from feedback')).toHaveLength(0)
  })

  it('404s a feedback id that is not there', async () => {
    const res = await call({ method: 'DELETE', query: { feedbackId: '999' } })
    expect(res.statusCode).toBe(404)
  })

  it('rejects a DELETE that names nothing', async () => {
    const res = await call({ method: 'DELETE' })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('nothing_to_delete')
  })

  it('deletes exactly one thing when a request names several', async () => {
    // Order is fixed (account, run, feedback) so the behaviour is predictable
    // rather than dependent on object key order.
    canned = [['delete from blocked_accounts', [{ account_id: 'sub-1' }]]]
    await call({ method: 'DELETE', query: { accountId: 'sub-1', runKey: 'k', feedbackId: '1' } })
    expect(ran('delete from runs')).toHaveLength(0)
    expect(ran('delete from feedback')).toHaveLength(0)
  })
})
