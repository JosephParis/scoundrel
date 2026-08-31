// The design docs, checked against the code they describe (issue 23).
//
// DESIGN.md spent months asserting seven sigils, a previewed theme and a
// 44-card deck the player edits, none of which the game has done since the kit
// rework. Nothing caught it, because a stale sentence in a markdown file breaks
// no build. These assertions are that missing alarm: they read the two root
// design docs as text and hold them to the constants and the functions the
// shipped game actually uses.
//
// A failure here is a doc that has drifted, not code that is wrong. Fix the
// prose (or, if the game genuinely changed, fix the prose *and* this file).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SIGIL_TARGET } from '../src/games/scoundrel/constants'
import { buildStartingKit } from '../src/games/scoundrel/logic/deck'

const read = name => readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8')

const DESIGN = read('DESIGN.md')
const REWORK = read('REWORK.md')
const SANCTUARY = read('src/games/scoundrel/logic/sanctuary.js')

// Spelled-out counts, because that is how the docs write them in prose.
const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve']

describe('which doc describes the current game', () => {
  it('DESIGN.md says it is superseded, in its first screenful', () => {
    const opening = DESIGN.split('\n').slice(0, 25).join('\n')
    expect(opening).toMatch(/superseded/i)
    expect(opening).toContain('REWORK.md')
  })

  it('REWORK.md no longer calls itself an uncommitted proposal', () => {
    const opening = REWORK.split('\n').slice(0, 25).join('\n')
    expect(opening).not.toMatch(/nothing here is committed/i)
    expect(opening).toMatch(/design of record/i)
  })

  it('REWORK.md carries no open decisions', () => {
    // Section 11 was the register of unsettled questions; the kit size cap was
    // the last one, and it is answered. A new entry here means a live design
    // question is on the loose, which is worth its own issue.
    const section = REWORK.split('## 11.')[1].split('## 12.')[0]
    expect(section).toMatch(/none outstanding/i)
  })
})

describe('the escape condition', () => {
  it('is the same number in both docs as in the code', () => {
    const target = WORD[SIGIL_TARGET]
    for (const [name, doc] of [['DESIGN.md', DESIGN], ['REWORK.md', REWORK]]) {
      // Any prose of the form "<number> sigils" must be the real target. This
      // is what caught nothing when SIGIL_TARGET went 7 -> 10.
      //
      // Lines that cite `SIGIL_TARGET` are exempt: those are the corrections
      // themselves, which have to name the old wrong number to retire it.
      const counts = doc.split('\n')
        .filter(line => !line.includes('SIGIL_TARGET'))
        .flatMap(line => [...line.matchAll(/\b([a-z]+)[ -]sigils\b/gi)])
        .map(m => m[1].toLowerCase())
        .filter(w => WORD.includes(w))
      if (name === 'DESIGN.md') {
        // DESIGN.md is the doc that states the escape condition in prose, in
        // several places. Zero matches would mean this check stopped looking.
        expect(counts.length, 'DESIGN.md states a sigil count').toBeGreaterThan(0)
      }
      for (const word of counts) {
        expect(word, `${name} says "${word} sigils"`).toBe(target)
      }
    }
  })
})

describe('the pre-rework mechanics are not presented as current', () => {
  it('the Forge section of DESIGN.md is marked historical', () => {
    const heading = DESIGN.split('\n').find(l => l.startsWith('## 5.'))
    expect(heading).toMatch(/historical/i)
  })

  it('Strike appears only inside a section marked historical', () => {
    // Sections are `## N. ...`; a section is historical if its heading says so.
    const sections = DESIGN.split(/^## /m).slice(1)
    for (const section of sections) {
      const heading = section.split('\n')[0]
      if (/historical/i.test(heading)) continue
      // "Strike" the noun-verb, not "strikes as" or "strike-through".
      expect(section, `section "${heading}" presents Strike as current`)
        .not.toMatch(/\*\*Strike\*\*|\bStrike\b(?! (all|as))/)
    }
  })

  it('nothing claims the player edits the whole deck', () => {
    const sections = DESIGN.split(/^## /m).slice(1)
    for (const section of sections) {
      const heading = section.split('\n')[0]
      if (/historical/i.test(heading)) continue
      expect(section, `section "${heading}" describes whole-deck editing`)
        .not.toMatch(/edits? the (whole|entire) .{0,12}deck/i)
    }
  })
})

describe('REWORK.md matches the kit code it specifies', () => {
  it('the starting kit really is the low ten', () => {
    expect(REWORK).toMatch(/diamonds 2 to 6 and hearts 2 to 6/)
    const kit = buildStartingKit()
    expect(kit).toHaveLength(10)
    expect(kit.filter(c => c.suit === 'D').map(c => c.rank)).toEqual([2, 3, 4, 5, 6])
    expect(kit.filter(c => c.suit === 'H').map(c => c.rank)).toEqual([2, 3, 4, 5, 6])
  })

  it('the documented Inscribe rank cap is the one the Forge uses', () => {
    expect(REWORK).toMatch(/cap = 4 \+ sigils earned.{0,40}10/s)
    expect(SANCTUARY).toMatch(/Math\.min\(10, 4 \+ \(sigils \|\| 0\)\)/)
  })

  it('records that the kit has no size cap, matching a codebase that has none', () => {
    expect(REWORK).toMatch(/no (hard )?cap on kit size|no kit size limit/i)
    // A slot cap would have to be enforced where the kit grows, which is the
    // Inscribe path in sanctuary.js.
    expect(SANCTUARY).not.toMatch(/KIT_(SIZE_)?CAP|MAX_KIT/)
  })
})
