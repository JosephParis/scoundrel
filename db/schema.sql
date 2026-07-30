-- Scoundrel run-analytics table (Neon Postgres).
--
-- The api/runs.js endpoint creates this automatically on first call, so you do
-- NOT need to run this by hand. It is kept here as documentation and as the
-- canonical place to add indexes/migrations later.
--
-- Each finished run is one row. Scalar columns are denormalized for cheap
-- filtering; the full buildRunRecord() blob lives in `record` (jsonb) so the
-- schema never churns as the record shape evolves.

create table if not exists runs (
  run_key       text primary key,        -- "<account_id>:<started_at>", stable per run
  account_id    text not null,           -- google sub, or 'guest'
  outcome       text not null,           -- victory | death | retired
  mode          text,
  ascension     integer,
  sigils_earned integer,
  started_at    bigint,                  -- epoch ms
  ended_at      bigint,                  -- epoch ms
  duration_ms   bigint,
  game_version  text,                    -- balance version stamp (GAME_VERSION); null on legacy rows
  record        jsonb not null,          -- full buildRunRecord blob
  created_at    timestamptz not null default now()
);

-- Added after the table first shipped; api/runs.js applies the same migration
-- in place so existing deployments pick it up. Old rows keep a null version.
alter table runs add column if not exists game_version text;

create index if not exists runs_outcome_idx on runs (outcome);
create index if not exists runs_account_idx on runs (account_id);
create index if not exists runs_ended_idx   on runs (ended_at);
create index if not exists runs_version_idx on runs (game_version);

-- ---------------------------------------------------------------------------
-- Fixed-window rate limiting for the open write endpoints (issue 07).
-- Created automatically by api/_lib/rateLimit.js, which owns this DDL.
--
-- One row per (endpoint, ip, window). The bucket key embeds floor(now/window),
-- so windows rotate on their own and stale rows are simply never read again; a
-- probabilistic sweep on write deletes expired ones instead of a cron. Stored in
-- Postgres rather than process memory because Vercel runs many short-lived
-- instances, and an in-memory counter is bypassed by landing on another one.
-- ---------------------------------------------------------------------------

create table if not exists rate_limits (
  bucket     text primary key,        -- "<endpoint>:<ip>:<window index>"
  hits       integer not null default 0,
  expires_at timestamptz not null     -- one full window past the one it counts
);

-- Filter any stat by balance version with a predicate on game_version, e.g.
--   where game_version = '0.1'                 -- one version
--   where game_version in ('0.2','0.3','0.4')  -- a range of versions
-- GET /api/stats?versions=<v1,v2,...> does this across every aggregation (the
-- dashboard turns a From/To range over VERSION_HISTORY into the list). Legacy
-- null rows only show when unfiltered ("All versions").

-- ---------------------------------------------------------------------------
-- Example analytics queries (dev-only; run from the Neon SQL console / psql).
-- ---------------------------------------------------------------------------

-- Winrate per boon (min sample size 20):
--   select b.v->>'id' as boon,
--          round(avg((outcome = 'victory')::int), 3) as winrate,
--          count(*) as n
--   from runs r, jsonb_array_elements(r.record->'boons') b
--   group by 1 having count(*) >= 20 order by winrate desc;

-- Winrate per boon PAIR (the thing PostHog is bad at):
--   select b1.v->>'id' as boon_a, b2.v->>'id' as boon_b,
--          round(avg((outcome = 'victory')::int), 3) as winrate,
--          count(*) as n
--   from runs r,
--        jsonb_array_elements(r.record->'boons') b1,
--        jsonb_array_elements(r.record->'boons') b2
--   where b1.v->>'id' < b2.v->>'id'
--   group by 1, 2 having count(*) >= 20 order by winrate desc;

-- Where & how players die (source x descent reached):
--   select record->'death'->>'source' as source,
--          (record->'death'->>'descent')::int as descent,
--          count(*) as deaths
--   from runs
--   where outcome = 'death' and record->'death' is not null
--   group by 1, 2 order by deaths desc;

-- Winrate per theme faced:
--   select t.v->>'id' as theme,
--          round(avg((outcome = 'victory')::int), 3) as winrate,
--          count(*) as n
--   from runs r, jsonb_array_elements(r.record->'themesFaced') t
--   group by 1 having count(*) >= 20 order by winrate desc;

-- --- Decision funnels (record v3+) -----------------------------------------

-- Boon pick rate: how often a boon is taken when it shows up in an offer.
-- Pairs with the winrate-per-boon query above to separate "good" from
-- "frequently offered".
--   select boon,
--          sum(picked) as times_picked,
--          count(*)    as times_offered,
--          round(sum(picked)::numeric / count(*), 3) as pick_rate
--   from (
--     select o.v as boon, (o.v = (p->>'picked'))::int as picked
--     from runs r,
--          jsonb_array_elements(r.record->'boonPicks') p,
--          jsonb_array_elements_text(p->'offered') o(v)
--   ) x
--   group by boon having count(*) >= 20 order by pick_rate desc;

-- Forge edit skip rate by type (inscribe / upgrade / remove):
--   select e->>'type' as type,
--          round(avg((e->>'skipped')::boolean::int), 3) as skip_rate,
--          count(*) as n
--   from runs r, jsonb_array_elements(r.record->'forgeEdits') e
--   group by 1 order by 1;

-- Most-chosen inscribe frames (what players actually inscribe):
--   select e->'chosen'->>'inscribed' as frame, count(*) as n
--   from runs r, jsonb_array_elements(r.record->'forgeEdits') e
--   where e->>'type' = 'inscribe' and e->'chosen'->>'inscribed' is not null
--   group by 1 order by n desc;

-- --- Timeline / soft-death / run-shape (record v4+) ------------------------

-- Per-descent funnel (the difficulty wall): clear/death/retire counts by
-- descent number.
--   select (d->>'descent')::int as descent,
--          count(*) as entered,
--          count(*) filter (where d->>'outcome' = 'cleared') as cleared,
--          count(*) filter (where d->>'outcome' = 'died') as died,
--          count(*) filter (where d->>'outcome' = 'retired') as retired
--   from runs r, jsonb_array_elements(r.record->'descents') d
--   group by 1 order by descent;

-- Where players quit (soft death): sanctuary (between descents) vs mid-descent.
--   select record->'retire'->>'phase' as phase, count(*) as n
--   from runs where outcome = 'retired' and record->'retire' is not null
--   group by 1 order by n desc;

-- Run shape by outcome (uses the denormalized top-level counts):
--   select outcome, count(*) n,
--          round(avg((record->>'kitEdits')::numeric), 1) avg_kit_edits,
--          round(avg((record->>'boonCount')::numeric), 1) avg_boons,
--          round(avg((record->>'inscribedCount')::numeric), 1) avg_inscribed
--   from runs group by 1 order by 1;

-- Theme survival ("chance of beating that theme"): clear vs death when the
-- theme was actually faced, from the per-descent timeline. Unbiased by run
-- depth, unlike winrate-by-theme. Beat rate excludes retires.
--   select th.v as theme,
--          count(*) as faced,
--          count(*) filter (where d->>'outcome' = 'cleared') as cleared,
--          count(*) filter (where d->>'outcome' = 'died') as died,
--          round(
--            count(*) filter (where d->>'outcome' = 'cleared')::numeric
--            / nullif(count(*) filter (where d->>'outcome' in ('cleared','died')), 0), 3
--          ) as beat_rate
--   from runs r,
--        jsonb_array_elements(r.record->'descents') d,
--        jsonb_array_elements_text(d->'themes') th(v)
--   group by 1 order by beat_rate desc;
