// Language packs for spell-checking (owner, 2026-11-21): each pack's
// Hunspell dictionary, served from jot.software at /packs/<code>/ and
// downloaded only when the person adds it in settings (lib/packs.ts).
// Never part of the offline copy (vite.config.ts skips packs/).
//
// French, Spanish, German, Dutch and Farsi come from wooorm/dictionaries
// (npm dictionary-*, devDependencies); Arabic (Ayaspell) isn't there, so
// public/packs/ar/ holds LibreOffice's copy as fetched, licence included.
// Each pack's licence ships beside it as LICENSE.txt.
//
//   node scripts/build-packs.mjs
// Then commit public/packs/ and src/lib/packSizes.json.

import { copyFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const FROM_NPM = ['fa', 'fr', 'es', 'de', 'nl']
const sizes = {}
for (const code of FROM_NPM) {
  const src = path.join(root, 'node_modules', `dictionary-${code}`)
  const out = path.join(root, 'public/packs', code)
  mkdirSync(out, { recursive: true })
  copyFileSync(path.join(src, 'index.aff'), path.join(out, 'index.aff'))
  copyFileSync(path.join(src, 'index.dic'), path.join(out, 'index.dic'))
  copyFileSync(path.join(src, 'license'), path.join(out, 'LICENSE.txt'))
}
for (const code of [...FROM_NPM, 'ar']) {
  const out = path.join(root, 'public/packs', code)
  sizes[code] = statSync(path.join(out, 'index.aff')).size + statSync(path.join(out, 'index.dic')).size
}
writeFileSync(path.join(root, 'src/lib/packSizes.json'), JSON.stringify(sizes, null, 2) + '\n')
console.log(sizes)
