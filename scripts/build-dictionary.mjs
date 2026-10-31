// Builds the auto-fix spelling dictionary (Phase 16): the en_US and en_GB
// Hunspell word lists (wooorm/dictionaries, MIT AND BSD, from SCOWL) merged
// into one, so British and American spellings both count as correct. They
// share one affix file. Run: node scripts/build-dictionary.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const read = (pkg, file) => readFileSync(new URL(`../node_modules/${pkg}/${file}`, import.meta.url), 'utf8')
const aff = read('dictionary-en', 'index.aff')
if (aff !== read('dictionary-en-gb', 'index.aff')) throw new Error('the two dictionaries no longer share an affix file')
const words = (pkg) => read(pkg, 'index.dic').split('\n').slice(1).filter(Boolean)
const merged = [...new Set([...words('dictionary-en'), ...words('dictionary-en-gb')])].sort()
const out = new URL('../public/dict/', import.meta.url)
mkdirSync(out, { recursive: true })
writeFileSync(new URL('en.aff', out), aff)
writeFileSync(new URL('en.dic', out), `${merged.length}\n${merged.join('\n')}\n`)
writeFileSync(
  new URL('LICENSE.txt', out),
  `en.dic and en.aff merge dictionary-en and dictionary-en-gb (wooorm/dictionaries).\n\n--- dictionary-en ---\n${read('dictionary-en', 'license')}\n\n--- dictionary-en-gb ---\n${read('dictionary-en-gb', 'license')}`,
)
console.log(`${merged.length} entries`)
