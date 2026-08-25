import { describe, it, expect, vi, beforeEach } from 'vitest'

// Covers the parts of /api/leaderboard that decide *who gets published*: the
// blocklist subtraction added by issue 08, and the guarantees the endpoint's
// own docblock makes about identity. The ranking SQL itself is Postgres's job
// and is not reimplemented here; what is asserted is that the filters are in
// the query the handler builds, since a moderation filter that quietly stops
// being applied looks exactly like one that works.
process.env.DATABASE_URL = 'postgres://fake/unit-test'

const queries = []
// Every query since the module was imported, including the ones from a warm
// instance's one-time table setup, which beforeEach must not clear.
const allQueries = []
let canned = []

function sqlTag(strings, ...vals) {
  const text = strings.join('?')
  queries.push({ text, vals })
  allQueries.push({ text, vals })
  const hit = canned.find(([needle]) => text.includes(needle))
  return Promise.resolve(hit ? hit[1] : [])
}

vi.mock('@neondatabase/serverless', () => ({ neon: () => sqlTag }))

const { default: handler } = await import('../api/leaderboard.js')

function mockRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = code => { res.statusCode = code; return res }
  res.json = body => { res.body = body; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

async function get(query = {}) {
  const res = mockRes()
  await handler({ method: 'GET', query, headers: {} }, res)
  return res
}

function built(needle) {
  return queries.filter(q => q.text.includes(needle))
}

// The ranked-best subquery, as opposed to the CREATE TABLE that also mentions
// blocked_accounts.
function rankedFragments() {
  return queries.filter(q => q.text.includes('row_number()'))
}

const ROW = {
  rank: '1', player_name: 'Cassandra', ascension: 2, sigils_earned: 10,
  duration_ms: '900000', ended_at: '1750000000000', mode: 'default',
  game_version: '0.4', account_id: 'sub-1',
}

beforeEach(() => {
  queries.length = 0
  canned = []
})

describe('GET /api/leaderboard — method', () => {
  it('rejects anything but GET', async () => {
    const res = mockRes()
    await handler({ method: 'POST', query: {}, headers: {} }, res)
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('GET')
  })
})

describe('GET /api/leaderboard — moderation', () => {
  it('subtracts blocked accounts inside the ranked subquery', async () => {
    await get()
    // Inside, not after: excluding a blocked account once row_number() has
    // already run would leave a gap in the ranking where their row was.
    const ranked = rankedFragments()
    expect(ranked).toHaveLength(1)
    expect(ranked[0].text).toContain('not exists')
    expect(ranked[0].text).toContain('blocked_accounts')
  })

  it('applies the same exclusion to the caller\'s own rank query', async () => {
    await get({ me: 'sub-1' })
    // One fragment, used by both the page query and the caller's-own-rank
    // query, so the two always rank against the same population -- and a
    // blocked player cannot see their own row either.
    expect(rankedFragments()).toHaveLength(1)
    expect(built('order by rank asc')).toHaveLength(1)
    expect(built('from ? b where b.account_id =')).toHaveLength(1)
  })

  it('creates the blocklist table before querying it', async () => {
    // The board is public and runs on a cold database on a fresh deployment;
    // a missing relation here would 500 the whole page.
    expect(allQueries.some(q => q.text.includes('create table if not exists blocked_accounts')))
      .toBe(true)
  })

  it('still filters dev runs and handle-less runs', async () => {
    await get()
    const ranked = rankedFragments()[0]
    expect(ranked.text).toContain('dev is not true')
    expect(ranked.text).toContain("playerName")
  })
})

describe('GET /api/leaderboard — response', () => {
  it('never returns an account id', async () => {
    canned = [['order by rank asc', [ROW]]]
    const res = await get()
    expect(res.statusCode).toBe(200)
    expect(res.body.entries).toHaveLength(1)
    expect(JSON.stringify(res.body)).not.toContain('sub-1')
  })

  it('coerces the bigint strings Postgres returns', async () => {
    canned = [['order by rank asc', [ROW]]]
    const { body } = await get()
    expect(body.entries[0]).toMatchObject({
      rank: 1, durationMs: 900000, endedAt: 1750000000000, playerName: 'Cassandra',
    })
  })

  it('marks the caller\'s own rows', async () => {
    canned = [['order by rank asc', [ROW]]]
    const { body } = await get({ me: 'sub-1' })
    expect(body.entries[0].you).toBe(true)
  })

  it('does not mark rows for a guest caller — the id identifies no one', async () => {
    canned = [['order by rank asc', [{ ...ROW, account_id: 'guest' }]]]
    const { body } = await get({ me: 'guest' })
    expect(body.entries[0].you).toBe(false)
  })

  it('clamps limit to the maximum', async () => {
    await get({ limit: '5000' })
    const page = built('order by rank asc')[0]
    expect(page.vals).toContain(100)
  })

  it('falls back to the default limit for nonsense', async () => {
    await get({ limit: 'lots' })
    expect(built('order by rank asc')[0].vals).toContain(25)
  })
})
