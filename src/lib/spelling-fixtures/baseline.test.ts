import { readFileSync, writeFileSync } from 'node:fs'
import nspell from 'nspell'
import { describe, expect, it } from 'vitest'
import { setFrequencies, suggestionFor } from '@/lib/spelling'

// Records today's answers on the English typo fixture (en-typos.tsv) into
// en-baseline.json — the gate for switching the engine (open decision #30):
// a new engine plus Jot's ranking must give the same answers.
//   SPELL_BASELINE=1 pnpm vitest run src/lib/spelling-fixtures
// Skipped without the variable, so `pnpm test` doesn't rewrite the file.

const DIR = 'src/lib/spelling-fixtures'

describe.skipIf(!process.env.SPELL_BASELINE)('English spelling baseline', () => {
  it('records suggestionFor() for every case', () => {
    // The speller as loadSpeller() builds it, read from disk instead of fetched.
    setFrequencies(readFileSync('public/dict/en.freq', 'utf8'))
    const spell = nspell(readFileSync('public/dict/en.aff', 'utf8'), readFileSync('public/dict/en.dic', 'utf8'))
    const [header, ...lines] = readFileSync(`${DIR}/en-typos.tsv`, 'utf8').trimEnd().split('\n')
    expect(header).toBe('typed\texpected\tkind\tsource\tbefore')
    const cases = lines.map((line) => {
      const [typed, , , , before = ''] = line.split('\t')
      const found = suggestionFor(spell, typed, before)
      return { typed, before, fixes: found?.fixes ?? null, sure: found?.sure ?? null }
    })
    expect(cases.length).toBeGreaterThan(0)
    // One case per line, so a changed answer is a one-line diff.
    writeFileSync(`${DIR}/en-baseline.json`, `[\n${cases.map((c) => JSON.stringify(c)).join(',\n')}\n]\n`)
  }, 600_000)
})
