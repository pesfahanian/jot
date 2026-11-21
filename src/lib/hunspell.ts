import { createHunspellFromStrings } from 'hunspell-wasm'
import { affixHints, candidates } from './candidates'
import type { Speller } from './spelling'

// One language's speller (open decision #30): Hunspell, compiled to
// WebAssembly, looks words up; the candidates a typo could have meant are
// generated the way nspell did (lib/candidates.ts), so English keeps exactly
// the suggestions it had. For the packs, Hunspell's own suggestions are
// added after those — they catch what one or two edits can't (accidently →
// accidentally), and a new language has no old behaviour to keep. Words the
// dictionary marks NOSUGGEST (slurs) are never offered.

export async function hunspellSpeller(aff: string, dic: string, opts: { ownSuggestions: boolean }): Promise<Speller & { dispose(): void }> {
  const h = await createHunspellFromStrings(aff, dic)
  const hints = affixHints(aff)
  const flag = /^NOSUGGEST\s+(\S+)/m.exec(aff)?.[1]
  const noSuggest = new Set<string>()
  if (flag) {
    for (const line of dic.split('\n')) {
      const slash = line.indexOf('/')
      if (slash > 0 && line.slice(slash + 1).split(/\s/)[0].includes(flag)) noSuggest.add(line.slice(0, slash))
    }
  }
  const known = (w: string) => h.testSpelling(w) && (!noSuggest.size || !h.stemWord(w).some((s) => noSuggest.has(s)))
  return {
    correct: (w) => h.testSpelling(w),
    suggest: (w) => {
      const own = candidates(w, hints, known, !opts.ownSuggestions)
      return opts.ownSuggestions ? [...own, ...h.getSpellingSuggestions(w).filter((s) => !own.includes(s) && known(s))] : own
    },
    dispose: () => h.dispose(),
  }
}
