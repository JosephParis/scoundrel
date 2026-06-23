/**
 * Edge-detecting PostHog analytics for a Scoundrel run.
 *
 * `useRunAnalytics(game, user)` watches the single game-state object and the
 * signed-in user and emits events at run/descent boundaries. It is purely an
 * observer: nothing here mutates game state, and every emission is best-effort
 * wrapped in try/catch so analytics can never break play.
 *
 * The PostHog client is deferred past window.load in main.jsx, so usePostHog()
 * returns null for the first stretch of a session. Events fired in that window
 * are buffered and flushed once the client appears.
 *
 * Events:
 *   run_started      a new run object begins (begin-again, replay, first load)
 *   descent_started  the player drops into a descent
 *   run_ended        a run reaches a terminal phase (victory/death/retire)
 */

import { useEffect, useRef } from 'react'
import { usePostHog } from '@posthog/react'
import { buildRunRecord } from './history'

// Flatten a stored run record into PostHog-friendly properties: scalar
// dimensions stay scalar (filterable), id-bearing lists collapse to id arrays.
function runEndedProps(r) {
  // Death detail (null on victory/retire). Flattened to scalars so each
  // dimension is filterable/groupable in PostHog: "where and how they died".
  const d = r.death || {}
  return {
    outcome: r.outcome,
    death_source: d.source || null,
    death_card_suit: d.card?.suit ?? null,
    death_card_rank: d.card?.rank ?? null,
    death_card_eff_rank: d.card?.effRank ?? null,
    death_boss: d.card?.boss ?? null,
    death_barehanded: d.barehanded ?? null,
    death_weapon_rank: d.weaponRank ?? null,
    death_damage: d.damage ?? null,
    death_hp_before: d.hpBefore ?? null,
    death_descent: d.descent ?? null,
    death_theme: d.theme ?? null,
    death_rooms_this_descent: d.roomsThisDescent ?? null,
    death_deck_remaining: d.deckRemaining ?? null,
    mode: r.mode?.id,
    mode_name: r.mode?.name,
    ascension: r.ascension || 0,
    ascension_name: r.ascensionName || null,
    sigils_earned: r.sigilsEarned,
    sigil_target: r.sigilTarget,
    duration_ms: r.durationMs,
    rooms_entered: r.roomsEntered,
    monsters_slain: r.monstersSlain,
    biggest_kill: r.biggestKill,
    boons: r.boons.map(b => b.id),
    boon_count: r.boons.length,
    themes_faced: r.themesFaced.map(t => t.id),
    bosses_defeated: r.bossesDefeated,
    boss_count: r.bossesDefeated.length,
    inscribed_count: (r.endingDeck || []).filter(c => c.inscribed).length,
    kit_size: (r.endingDeck || []).length,
    final_weapon_rank: r.finalWeapon?.rank ?? null,
  }
}

export function useRunAnalytics(game, user) {
  const posthog = usePostHog()

  const pending = useRef([])
  const seeded = useRef(false)
  const prevPhase = useRef(null)
  const lastRunStarted = useRef(null)
  const lastDescentKey = useRef(null)
  const endedRuns = useRef(new Set())
  const identified = useRef(null)

  // Send now, or buffer until the deferred client loads.
  const capture = (event, props) => {
    if (posthog) {
      try { posthog.capture(event, props) } catch { /* never break play */ }
    } else {
      pending.current.push([event, props])
    }
  }

  // Flush whatever queued before the client was ready.
  useEffect(() => {
    if (!posthog || pending.current.length === 0) return
    const queued = pending.current
    pending.current = []
    for (const [event, props] of queued) {
      try { posthog.capture(event, props) } catch { /* ignore */ }
    }
  }, [posthog])

  // Tie a signed-in player's events to one person profile; reset on sign-out.
  useEffect(() => {
    if (!posthog) return
    try {
      if (user?.sub && identified.current !== user.sub) {
        posthog.identify(user.sub, { email: user.email, name: user.name })
        identified.current = user.sub
      } else if (!user?.sub && identified.current) {
        posthog.reset()
        identified.current = null
      }
    } catch { /* ignore */ }
  }, [posthog, user])

  useEffect(() => {
    if (!game) return
    const runStart = game.runStartedAt || null
    const descentNumber = (game.sigilsEarned || 0) + 1

    if (!seeded.current) {
      // First observation this session. Seed the edge refs so resuming an
      // in-progress save doesn't replay its past transitions as new events.
      seeded.current = true
      lastRunStarted.current = runStart
      prevPhase.current = game.phase
      if (game.phase === 'descent') lastDescentKey.current = `${runStart}:${descentNumber}`
      // A brand-new opening run (sanctuary, nothing done yet) counts as a
      // start; a resumed mid-run save does not.
      const opening =
        game.phase === 'sanctuary' &&
        (game.sigilsEarned || 0) === 0 &&
        (game.runRoomsEntered || 0) === 0
      if (opening) {
        capture('run_started', {
          mode: game.mode,
          ascension: game.ascension || 0,
          tutorial: !!game.tutorial,
        })
      }
    } else {
      // A new run object (begin again, replay, skip tutorial) carries a fresh
      // runStartedAt. The tutorial shares its run's runStartedAt, so this fires
      // once per run, not once per descent.
      if (runStart && runStart !== lastRunStarted.current) {
        lastRunStarted.current = runStart
        capture('run_started', {
          mode: game.mode,
          ascension: game.ascension || 0,
          tutorial: !!game.tutorial,
        })
      }

      // Dropped into a descent. Keyed by run + ordinal so each leg fires once.
      // Tutorial walks are skipped (mirrors the history-persistence rule).
      if (game.phase === 'descent' && prevPhase.current !== 'descent' && !game.tutorial) {
        const key = `${runStart}:${descentNumber}`
        if (lastDescentKey.current !== key) {
          lastDescentKey.current = key
          capture('descent_started', {
            mode: game.mode,
            ascension: game.ascension || 0,
            theme: game.theme,
            descent_number: descentNumber,
            boon_count: (game.boons || []).length,
          })
        }
      }
    }

    // Terminal phase. Dedupe by runStartedAt so an effect re-fire or a resumed
    // already-finished save records the run once. Skips the tutorial walk.
    const terminal = game.phase === 'gameover' || game.phase === 'victory'
    if (terminal && !game.tutorial && runStart && !endedRuns.current.has(runStart)) {
      endedRuns.current.add(runStart)
      capture('run_ended', runEndedProps(buildRunRecord(game, user)))
    }

    prevPhase.current = game.phase
    // posthog intentionally omitted: capture() buffers without it, and the
    // flush effect drains the queue when it loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, user])
}
