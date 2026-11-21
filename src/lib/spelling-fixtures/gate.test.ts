import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hunspellSpeller } from '@/lib/hunspell'
import { setFrequencies, suggestionFor } from '@/lib/spelling'

// The gate for the engine switch (open decision #30, owner 2026-11-21):
// Hunspell plus Jot's ranking gives exactly today's English answers —
// every fix, in order, and whether it's sure — on all 499 cases of the
// fixture (en-typos.tsv), as nspell recorded them (en-baseline.json).

const DIR = 'src/lib/spelling-fixtures'

describe('English with Hunspell', () => {
  it('matches the nspell baseline on every case', async () => {
    setFrequencies(readFileSync('public/dict/en.freq', 'utf8'))
    const spell = await hunspellSpeller(readFileSync('public/dict/en.aff', 'utf8'), readFileSync('public/dict/en.dic', 'utf8'), { ownSuggestions: false })
    const baseline = JSON.parse(readFileSync(`${DIR}/en-baseline.json`, 'utf8')) as { typed: string; before: string; fixes: string[] | null; sure: boolean | null }[]
    expect(baseline).toHaveLength(499)
    const differ = baseline
      .map((b) => {
        const f = suggestionFor(spell, b.typed, b.before)
        return { typed: b.typed, want: { fixes: b.fixes, sure: b.sure }, got: { fixes: f?.fixes ?? null, sure: f?.sure ?? null } }
      })
      .filter((c) => JSON.stringify(c.want) !== JSON.stringify(c.got))
    expect(differ).toEqual([])
    spell.dispose()
  }, 60_000)
})
