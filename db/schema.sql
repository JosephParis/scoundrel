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
  record        jsonb not null,          -- full buildRunRecord blob
  created_at    timestamptz not null default now()
);

create index if not exists runs_outcome_idx on runs (outcome);
create index if not exists runs_account_idx on runs (account_id);
create index if not exists runs_ended_idx   on runs (ended_at);

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
