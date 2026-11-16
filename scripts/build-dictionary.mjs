// Builds the spelling dictionary (Phase 16): the en_US and en_GB Hunspell
// word lists (wooorm/dictionaries, MIT AND BSD, from SCOWL) merged into one,
// so British and American spellings both count as correct. They share one
// affix file. Beside it, en.freq: how common each word is — SCOWL's size
// levels (wordlist-english), 10 the most common, to 50 — which ranks the
// suggestions for a typo (lib/spelling.ts). One line per level: the level,
// then its words. Run: node scripts/build-dictionary.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import wordlist from 'wordlist-english'

const read = (pkg, file) => readFileSync(new URL(`../node_modules/${pkg}/${file}`, import.meta.url), 'utf8')
const aff = read('dictionary-en', 'index.aff')
if (aff !== read('dictionary-en-gb', 'index.aff')) throw new Error('the two dictionaries no longer share an affix file')
const words = (pkg) => read(pkg, 'index.dic').split('\n').slice(1).filter(Boolean)
const merged = [...new Set([...words('dictionary-en'), ...words('dictionary-en-gb')])].sort()
const out = new URL('../public/dict/', import.meta.url)
mkdirSync(out, { recursive: true })
writeFileSync(new URL('en.aff', out), aff)
writeFileSync(new URL('en.dic', out), `${merged.length}\n${merged.join('\n')}\n`)
const seen = new Set()
const levels = ['10', '20', '35', '40', '50'].map((level) => {
  const ws = [...new Set([...wordlist[`english/${level}`], ...wordlist[`english/american/${level}`], ...wordlist[`english/british/${level}`]])].filter((w) => /^[A-Za-z']+$/.test(w) && !seen.has(w))
  for (const w of ws) seen.add(w)
  return `${level} ${ws.join(' ')}`
})
writeFileSync(new URL('en.freq', out), `${levels.join('\n')}\n`)
writeFileSync(
  new URL('LICENSE.txt', out),
  `en.dic and en.aff merge dictionary-en and dictionary-en-gb (wooorm/dictionaries). en.freq is SCOWL's size levels, from wordlist-english.\n\n--- dictionary-en ---\n${read('dictionary-en', 'license')}\n\n--- dictionary-en-gb ---\n${read('dictionary-en-gb', 'license')}\n\n--- wordlist-english (SCOWL) ---\n${read('wordlist-english', 'Copyright')}`,
)
console.log(`${merged.length} entries, ${seen.size} ranked`)
