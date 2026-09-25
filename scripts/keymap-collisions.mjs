// T2.2 check: does the editor's keymap give any key two competing meanings?
// Run: node --experimental-strip-types scripts/keymap-collisions.mjs
//
// 1. The editor loads the vscode keymap alone, never layered over CM6's
//    default keymaps — this lists what layering them *would* collide on,
//    as the evidence for that choice.
// 2. Our own additions (src/editor/keymap.ts) must not land on any key the
//    vscode keymap binds, except the declared Escape fallback.
import { vscodeKeymap } from '@replit/codemirror-vscode-keymap'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { foldKeymap } from '@codemirror/language'
import { completionKeymap, closeBracketsKeymap } from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'
import { supplementKeymap, escapeFallback } from '../src/editor/keymap.ts'

const platforms = ['mac', 'win', 'linux']
const norm = (k) => k.split(/-(?!$)/).map((p) => p.toLowerCase()).sort().join('-')

function keysFor(binding, platform) {
  const key = binding[platform] ?? binding.key
  if (!key) return []
  const mod = platform === 'mac' ? 'Meta' : 'Ctrl'
  const base = norm(key.replace(/Mod/g, mod).replace(/Cmd/g, 'Meta'))
  return binding.shift ? [base, norm('Shift-' + key.replace(/Mod/g, mod).replace(/Cmd/g, 'Meta'))] : [base]
}
const keySet = (map, platform) => new Set(map.flatMap((b) => keysFor(b, platform)))

let failures = 0
for (const platform of platforms) {
  const vs = keySet(vscodeKeymap, platform)

  const cm6 = { defaultKeymap, historyKeymap, searchKeymap, foldKeymap, completionKeymap, closeBracketsKeymap, lintKeymap }
  const wouldCollide = Object.entries(cm6).map(([name, map]) => [name, [...keySet(map, platform)].filter((k) => vs.has(k)).length])
  console.log(`${platform}: keys CM6 defaults share with the vscode keymap (not loaded): ${wouldCollide.map(([n, c]) => `${n} ${c}`).join(', ')}`)

  for (const k of keySet(supplementKeymap, platform)) {
    if (vs.has(k)) {
      failures++
      console.log(`  COLLISION ${platform}: supplement key ${k} is already bound by the vscode keymap`)
    }
  }
  for (const k of keySet(escapeFallback, platform)) {
    if (k !== 'escape') {
      failures++
      console.log(`  COLLISION ${platform}: unexpected fallback key ${k}`)
    }
  }
}
console.log(failures ? `\n${failures} collision(s)` : '\n0 collisions in the loaded keymap')
process.exit(failures ? 1 : 0)
